/**
 * Odds-API.io Collector
 *
 * Fetches odds from Odds-API.io (api.odds-api.io) for Asian bookmakers
 * that are not available on The Odds API (the-odds-api.com).
 *
 * Configured bookmakers: SBOBet, DafaBet (MaxBet white-label)
 *
 * Free tier: 100 requests/hour, 2 bookmakers
 * Endpoints:
 *   GET /v3/events?sport={slug}&apiKey={key}
 *   GET /v3/odds/multi?eventIds={ids}&bookmakers={list}&apiKey={key}
 */

const { createHttpClient } = require('../config/httpClient');
const { createServiceLogger } = require('../config/logger');
require('dotenv').config();

const log = createServiceLogger('OddsApiIo');
const http = createHttpClient('OddsApiIo', { timeout: 30000 });

const BASE_URL = 'https://api.odds-api.io/v3';
const API_KEY = process.env.ODDS_API_IO_KEY;

// Bookmakers to fetch (must match selected bookmakers on Odds-API.io dashboard)
const BOOKMAKERS = ['Sbobet', 'DafaBet'];

// Bookmaker key mapping (Odds-API.io name → our DB key)
const BM_KEY_MAP = {
  Sbobet: 'sbobet',
  DafaBet: 'dafabet',
};

// Bookmaker display title mapping
const BM_TITLE_MAP = {
  Sbobet: 'SBOBet',
  DafaBet: 'DafaBet (MaxBet)',
};

// Sports to track (Odds-API.io slug format)
const DEFAULT_SPORTS = ['football', 'basketball', 'baseball', 'ice-hockey'];
const SPORTS = process.env.ODDS_API_IO_SPORTS
  ? process.env.ODDS_API_IO_SPORTS.split(',').map((s) => s.trim())
  : DEFAULT_SPORTS;

// Sport slug → our sport_key prefix
const SPORT_PREFIX_MAP = {
  football: 'soccer',
  basketball: 'basketball',
  baseball: 'baseball',
  'ice-hockey': 'icehockey',
};

// League slug → our sport_key mapping (major leagues)
const LEAGUE_MAP = {
  'england-premier-league': 'soccer_epl',
  'spain-la-liga': 'soccer_spain_la_liga',
  'germany-bundesliga': 'soccer_germany_bundesliga',
  'italy-serie-a': 'soccer_italy_serie_a',
  'france-ligue-1': 'soccer_france_ligue_one',
  'international-clubs-uefa-champions-league': 'soccer_uefa_champs_league',
  'international-clubs-uefa-europa-league': 'soccer_uefa_europa_league',
  'international-clubs-uefa-europa-conference-league': 'soccer_uefa_europa_conf_league',
  'south-korea-k-league-1': 'soccer_korea_kleague1',
  'japan-j-league': 'soccer_japan_j_league',
  'usa-nba': 'basketball_nba',
  'international-clubs-euroleague': 'basketball_euroleague',
  'usa-mlb': 'baseball_mlb',
  'south-korea-kbo': 'baseball_kbo',
  'japan-npb': 'baseball_npb',
  'usa-nhl': 'icehockey_nhl',
};

// Minimum hours before match start to bother collecting (skip matches starting very soon)
const MIN_HOURS_BEFORE_START = 1;

// Track request count for rate limiting
let requestCount = 0;
let requestCountResetAt = null;

/**
 * Check if Odds-API.io is configured.
 */
function isConfigured() {
  return !!API_KEY;
}

/**
 * Rate-limited fetch wrapper.
 * Free tier: 100 requests/hour.
 */
async function rateLimitedFetch(url) {
  const now = Date.now();
  if (!requestCountResetAt || now > requestCountResetAt) {
    requestCount = 0;
    requestCountResetAt = now + 3600000; // Reset after 1 hour
  }

  if (requestCount >= 90) {
    // Leave 10 requests as buffer
    log.warn('Approaching rate limit (90/100), skipping request');
    return null;
  }

  requestCount++;
  const { data } = await http.get(url);
  return data;
}

/**
 * Fetch upcoming events for a sport.
 */
async function fetchEvents(sport) {
  try {
    const data = await rateLimitedFetch(
      `${BASE_URL}/events?sport=${sport}&apiKey=${API_KEY}`,
    );
    if (!data) return [];

    // Filter to upcoming and live events only
    const active = data.filter(
      (e) => e.status === 'upcoming' || e.status === 'live',
    );
    log.info(`Events ${sport}: ${active.length} active (${data.length} total)`);
    return active;
  } catch (err) {
    log.error(`Failed to fetch events for ${sport}`, { error: err.message });
    return [];
  }
}

/**
 * Fetch odds for multiple events (batch, up to 10 per request).
 */
async function fetchOddsBatch(eventIds) {
  if (eventIds.length === 0) return [];

  try {
    const data = await rateLimitedFetch(
      `${BASE_URL}/odds/multi?eventIds=${eventIds.join(',')}&bookmakers=${BOOKMAKERS.join(',')}&apiKey=${API_KEY}`,
    );
    return data || [];
  } catch (err) {
    log.error('Failed to fetch odds batch', { error: err.message });
    return [];
  }
}

/**
 * Map league slug to our sport_key.
 */
function mapSportKey(sportSlug, leagueSlug, leagueName) {
  // Try exact match first
  if (LEAGUE_MAP[leagueSlug]) return LEAGUE_MAP[leagueSlug];

  // Generate from sport prefix + league slug
  const prefix = SPORT_PREFIX_MAP[sportSlug] || sportSlug;
  const cleanSlug = leagueSlug.replace(/[^a-z0-9]+/g, '_');
  return `${prefix}_${cleanSlug}`;
}

/**
 * Transform Odds-API.io response to our DB format.
 *
 * Market name mapping:
 *   "ML"      → "h2h"
 *   "Spread"  → "spreads"
 *   "Totals"  → "totals"
 *
 * Odds structure:
 *   ML:     { home: "1.85", away: "2.10", draw: "3.40" }
 *   Spread: { hdp: -0.5, home: "1.85", away: "2.10" }
 *   Totals: { hdp: 2.5, over: "1.90", under: "1.95" }
 */
function transformData(eventsWithOdds) {
  const matches = [];
  const oddsRows = [];
  const seenExternalIds = new Set();

  for (const event of eventsWithOdds) {
    const externalId = `oddsapiio_${event.id}`;
    const sportKey = mapSportKey(
      event.sport?.slug || 'football',
      event.league?.slug || '',
      event.league?.name || '',
    );

    // Add match (dedupe)
    if (!seenExternalIds.has(externalId)) {
      seenExternalIds.add(externalId);
      matches.push({
        external_id: externalId,
        sport: sportKey,
        league: event.league?.name || 'Unknown',
        home_team: event.home,
        away_team: event.away,
        start_time: event.date,
      });
    }

    // Process bookmakers
    for (const [bmName, markets] of Object.entries(event.bookmakers || {})) {
      const bmKey = BM_KEY_MAP[bmName] || bmName.toLowerCase();
      const bmTitle = BM_TITLE_MAP[bmName] || bmName;

      for (const market of markets) {
        const odds = market.odds;
        if (!odds || odds.length === 0) continue;

        // Use the first (main) line
        const mainLine = odds[0];

        if (market.name === 'ML') {
          // Moneyline / H2H
          if (mainLine.home && mainLine.away) {
            oddsRows.push({
              match_external_id: externalId,
              bookmaker: bmKey,
              bookmaker_title: bmTitle,
              market_type: 'h2h',
              handicap_point: 0,
              outcome_1_odds: parseFloat(mainLine.home),
              outcome_2_odds: parseFloat(mainLine.away),
              outcome_draw_odds: mainLine.draw ? parseFloat(mainLine.draw) : null,
              source_type: 'international',
            });
          }
        } else if (market.name === 'Spread' || market.name === 'Spread HT') {
          // Spread / Handicap (skip HT for now, only use full game)
          if (market.name === 'Spread' && mainLine.home && mainLine.away && mainLine.hdp !== undefined) {
            oddsRows.push({
              match_external_id: externalId,
              bookmaker: bmKey,
              bookmaker_title: bmTitle,
              market_type: 'spreads',
              handicap_point: mainLine.hdp,
              outcome_1_odds: parseFloat(mainLine.home),
              outcome_2_odds: parseFloat(mainLine.away),
              outcome_draw_odds: null,
              source_type: 'international',
            });
          }
        } else if (market.name === 'Totals' || market.name === 'Totals HT') {
          // Totals / Over-Under (skip HT)
          if (market.name === 'Totals' && mainLine.over && mainLine.under && mainLine.hdp !== undefined) {
            oddsRows.push({
              match_external_id: externalId,
              bookmaker: bmKey,
              bookmaker_title: bmTitle,
              market_type: 'totals',
              handicap_point: mainLine.hdp,
              outcome_1_odds: parseFloat(mainLine.over),
              outcome_2_odds: parseFloat(mainLine.under),
              outcome_draw_odds: null,
              source_type: 'international',
            });
          }
        }
      }
    }
  }

  return { matches, oddsRows };
}

/**
 * Check if a league slug is a "major" league (defined in LEAGUE_MAP).
 */
function isMajorLeague(leagueSlug) {
  return !!LEAGUE_MAP[leagueSlug];
}

/**
 * Prioritize and filter events for efficient API usage.
 *
 * Strategy:
 * 1. Skip events starting within MIN_HOURS_BEFORE_START (they'll expire from frontend soon)
 * 2. Major leagues (LEAGUE_MAP) first — these are what users care about
 * 3. Within each group, sort by start_time ascending (nearest future first)
 * 4. Cap minor league events to avoid wasting API requests
 */
function prioritizeEvents(events) {
  const cutoff = new Date(Date.now() + MIN_HOURS_BEFORE_START * 3600000);

  // Filter out events starting too soon
  const future = events.filter((e) => {
    if (!e.date) return true; // keep if no date (let API decide)
    return new Date(e.date) > cutoff;
  });

  const skipped = events.length - future.length;
  if (skipped > 0) {
    log.info(`Skipped ${skipped} events starting within ${MIN_HOURS_BEFORE_START}h`);
  }

  // Split into major vs minor leagues
  const major = [];
  const minor = [];
  for (const ev of future) {
    if (isMajorLeague(ev.league?.slug || '')) {
      major.push(ev);
    } else {
      minor.push(ev);
    }
  }

  // Sort each group by start_time ascending
  const byTime = (a, b) => new Date(a.date || 0) - new Date(b.date || 0);
  major.sort(byTime);
  minor.sort(byTime);

  // Cap minor events to leave room for major leagues
  // Allocate: ~60 batches for major, ~20 batches for minor → ~200 minor events max
  const MAX_MINOR = 200;
  const cappedMinor = minor.slice(0, MAX_MINOR);
  if (minor.length > MAX_MINOR) {
    log.info(`Capped minor league events: ${MAX_MINOR}/${minor.length}`);
  }

  log.info(`Prioritized: ${major.length} major + ${cappedMinor.length} minor = ${major.length + cappedMinor.length} events`);

  // Major first, then minor
  return [...major, ...cappedMinor];
}

/**
 * Main collection function.
 * Fetches events → prioritizes → batches odds → transforms.
 */
async function collectOddsApiIo() {
  if (!isConfigured()) {
    log.info('Odds-API.io not configured (ODDS_API_IO_KEY missing), skipping');
    return { matches: [], oddsRows: [], skipped: true };
  }

  const startTime = Date.now();
  log.info(`Starting Odds-API.io collection for sports: [${SPORTS.join(', ')}]`);

  const allEvents = [];

  // Step 1: Fetch events per sport
  for (const sport of SPORTS) {
    const events = await fetchEvents(sport);
    allEvents.push(...events);

    // Small delay between requests
    await new Promise((r) => setTimeout(r, 500));
  }

  log.info(`Total active events across all sports: ${allEvents.length}`);

  if (allEvents.length === 0) {
    return { matches: [], oddsRows: [] };
  }

  // Step 2: Prioritize — major leagues first, skip near-start events
  const prioritized = prioritizeEvents(allEvents);

  if (prioritized.length === 0) {
    log.info('No events after prioritization');
    return { matches: [], oddsRows: [] };
  }

  // Step 3: Fetch odds in batches of 10 (using /odds/multi)
  const BATCH_SIZE = 10;
  const eventsWithOdds = [];

  for (let i = 0; i < prioritized.length; i += BATCH_SIZE) {
    const batch = prioritized.slice(i, i + BATCH_SIZE);
    const eventIds = batch.map((e) => e.id);

    const oddsData = await fetchOddsBatch(eventIds);

    if (Array.isArray(oddsData)) {
      eventsWithOdds.push(...oddsData);
    }

    // Delay between batches
    await new Promise((r) => setTimeout(r, 1000));

    // Check rate limit
    if (requestCount >= 90) {
      log.warn(`Rate limit approaching, processed ${i + BATCH_SIZE}/${prioritized.length} events`);
      break;
    }
  }

  // Step 4: Transform to our format
  const { matches, oddsRows } = transformData(eventsWithOdds);

  const duration = Date.now() - startTime;
  log.info(
    `Odds-API.io collection complete: ${matches.length} matches, ${oddsRows.length} odds rows (${duration}ms), ${requestCount} API requests used`,
  );

  return { matches, oddsRows };
}

/**
 * Get status info.
 */
function getOddsApiIoStatus() {
  return {
    configured: isConfigured(),
    bookmakers: BOOKMAKERS,
    sports: SPORTS,
    requestsUsed: requestCount,
    requestsResetAt: requestCountResetAt
      ? new Date(requestCountResetAt).toISOString()
      : null,
  };
}

module.exports = {
  collectOddsApiIo,
  isConfigured,
  getOddsApiIoStatus,
  SPORTS,
  BOOKMAKERS,
};

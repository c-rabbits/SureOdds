/**
 * Pinnacle Direct API Collector
 *
 * Fetches odds directly from Pinnacle's API (api.pinnacle.com).
 * Uses HTTP Basic Auth with Pinnacle account credentials.
 *
 * Key endpoints:
 *   GET /v1/sports         — list all sports
 *   GET /v1/leagues?sportId=X — list leagues for a sport
 *   GET /v1/fixtures?sportId=X — get events/matches
 *   GET /v1/odds?sportId=X    — get odds for events
 *
 * Rate limit: 1 request per 2 minutes per sportId per endpoint.
 * Uses `since` parameter for efficient delta polling.
 *
 * Sport IDs:  Soccer=29, Basketball=4, Baseball=3, Hockey=19
 */

const { createHttpClient } = require('../config/httpClient');
const { createServiceLogger } = require('../config/logger');
require('dotenv').config();

const log = createServiceLogger('Pinnacle');
const http = createHttpClient('Pinnacle', { timeout: 20000 });

const BASE_URL = 'https://api.pinnacle.com';
const USERNAME = process.env.PINNACLE_USERNAME;
const PASSWORD = process.env.PINNACLE_PASSWORD;

// Pinnacle sportId → our sport_key prefix
const SPORT_MAP = {
  29: 'soccer',
  4: 'basketball',
  3: 'baseball',
  19: 'icehockey',
};

// Default sports to track (can be overridden via PINNACLE_SPORTS env)
const DEFAULT_SPORT_IDS = [29]; // Soccer only by default
const SPORT_IDS = process.env.PINNACLE_SPORTS
  ? process.env.PINNACLE_SPORTS.split(',').map((s) => parseInt(s.trim(), 10))
  : DEFAULT_SPORT_IDS;

// Track delta `since` values per sportId per endpoint
const sinceCache = {
  fixtures: {},  // { sportId: sinceValue }
  odds: {},      // { sportId: sinceValue }
};

// In-memory cache of fixtures for matching odds to teams
const fixturesCache = {}; // { eventId: { home, away, league, starts, sportId } }

/**
 * Build auth header for HTTP Basic authentication.
 */
function getAuthHeaders() {
  if (!USERNAME || !PASSWORD) {
    return null;
  }
  const token = Buffer.from(`${USERNAME}:${PASSWORD}`).toString('base64');
  return {
    Authorization: `Basic ${token}`,
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };
}

/**
 * Check if Pinnacle credentials are configured.
 */
function isConfigured() {
  return !!(USERNAME && PASSWORD);
}

/**
 * GET /v1/fixtures?sportId=X — Fetch fixtures (events/matches).
 * Returns upcoming events with team names, start times, league info.
 */
async function fetchFixtures(sportId, useDelta = true) {
  const headers = getAuthHeaders();
  if (!headers) {
    log.warn('Pinnacle credentials not configured');
    return null;
  }

  const params = { sportId };
  if (useDelta && sinceCache.fixtures[sportId]) {
    params.since = sinceCache.fixtures[sportId];
  }

  try {
    const { data } = await http.get(`${BASE_URL}/v1/fixtures`, {
      headers,
      params,
    });

    // Update since value for delta polling
    if (data.last) {
      sinceCache.fixtures[sportId] = data.last;
    }

    // Cache fixtures for later odds matching
    const sportPrefix = SPORT_MAP[sportId] || 'other';
    let eventCount = 0;

    for (const league of data.league || []) {
      for (const event of league.events || []) {
        if (event.status === 'O' || event.status === 'I') {
          // O = Open/upcoming, I = In-progress (live)
          fixturesCache[event.id] = {
            home: event.home,
            away: event.away,
            leagueId: league.id,
            leagueName: league.name || `League ${league.id}`,
            starts: event.starts,
            sportId,
            sportPrefix,
          };
          eventCount++;
        }
      }
    }

    log.info(`Fixtures sportId=${sportId}: ${eventCount} events cached`);
    return data;
  } catch (err) {
    if (err.response?.status === 429) {
      log.warn(`Fixtures rate limited for sportId=${sportId}, will retry next cycle`);
    } else if (err.response?.status === 401) {
      log.error('Pinnacle auth failed — check PINNACLE_USERNAME/PASSWORD');
    } else {
      log.error(`Fixtures error sportId=${sportId}`, { error: err.message });
    }
    return null;
  }
}

/**
 * GET /v1/odds?sportId=X — Fetch odds.
 * Returns moneyline, spread, totals for each event/period.
 */
async function fetchOdds(sportId, useDelta = true) {
  const headers = getAuthHeaders();
  if (!headers) return null;

  const params = { sportId };
  if (useDelta && sinceCache.odds[sportId]) {
    params.since = sinceCache.odds[sportId];
  }

  try {
    const { data } = await http.get(`${BASE_URL}/v1/odds`, {
      headers,
      params,
    });

    if (data.last) {
      sinceCache.odds[sportId] = data.last;
    }

    return data;
  } catch (err) {
    if (err.response?.status === 429) {
      log.warn(`Odds rate limited for sportId=${sportId}`);
    } else {
      log.error(`Odds error sportId=${sportId}`, { error: err.message });
    }
    return null;
  }
}

/**
 * Map Pinnacle league to our sport_key.
 * Uses sportPrefix + league name heuristic.
 */
function mapSportKey(sportPrefix, leagueName) {
  const upper = (leagueName || '').toUpperCase();

  if (sportPrefix === 'soccer') {
    if (upper.includes('PREMIER LEAGUE') && upper.includes('ENGLAND')) return 'soccer_epl';
    if (upper.includes('LA LIGA') || upper.includes('SPAIN')) return 'soccer_spain_la_liga';
    if (upper.includes('BUNDESLIGA') && upper.includes('GERMANY')) return 'soccer_germany_bundesliga';
    if (upper.includes('SERIE A') && upper.includes('ITALY')) return 'soccer_italy_serie_a';
    if (upper.includes('LIGUE 1') && upper.includes('FRANCE')) return 'soccer_france_ligue_one';
    if (upper.includes('CHAMPIONS LEAGUE')) return 'soccer_uefa_champs_league';
    if (upper.includes('EUROPA LEAGUE')) return 'soccer_uefa_europa_league';
    if (upper.includes('K LEAGUE') || upper.includes('KOREA')) return 'soccer_korea_kleague1';
    if (upper.includes('J-LEAGUE') || upper.includes('J. LEAGUE') || upper.includes('JAPAN')) return 'soccer_japan_j_league';
    return `soccer_${leagueName.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`;
  }
  if (sportPrefix === 'basketball') {
    if (upper.includes('NBA')) return 'basketball_nba';
    if (upper.includes('EUROLEAGUE')) return 'basketball_euroleague';
    return `basketball_${leagueName.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`;
  }
  if (sportPrefix === 'baseball') {
    if (upper.includes('MLB') || upper.includes('MAJOR LEAGUE')) return 'baseball_mlb';
    if (upper.includes('KBO')) return 'baseball_kbo';
    if (upper.includes('NPB') || upper.includes('JAPAN')) return 'baseball_npb';
    return `baseball_${leagueName.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`;
  }
  if (sportPrefix === 'icehockey') {
    if (upper.includes('NHL')) return 'icehockey_nhl';
    return `icehockey_${leagueName.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`;
  }

  return `${sportPrefix}_${(leagueName || 'unknown').toLowerCase().replace(/[^a-z0-9]+/g, '_')}`;
}

/**
 * Transform Pinnacle odds response into our DB format.
 *
 * Pinnacle response structure:
 *   { sportId, last, leagues: [{ id, events: [{ id, periods: [...] }] }] }
 *
 * Each period has: moneyline, spreads[], totals[]
 * Period 0 = Full Game, Period 1 = 1st Half, etc.
 * We only care about Period 0 (Full Game).
 */
function transformPinnacleData(oddsData) {
  const matches = [];
  const oddsRows = [];
  const seenExternalIds = new Set();

  for (const league of oddsData.league || oddsData.leagues || []) {
    for (const event of league.events || []) {
      const fixture = fixturesCache[event.id];
      if (!fixture) continue; // Skip events we don't have fixture data for

      const externalId = `pinnacle_${event.id}`;
      const sportKey = mapSportKey(fixture.sportPrefix, fixture.leagueName);

      // Add match (dedupe)
      if (!seenExternalIds.has(externalId)) {
        seenExternalIds.add(externalId);
        matches.push({
          external_id: externalId,
          sport: sportKey,
          league: fixture.leagueName,
          home_team: fixture.home,
          away_team: fixture.away,
          start_time: fixture.starts,
        });
      }

      // Process periods — only period 0 (Full Game)
      for (const period of event.periods || []) {
        if (period.number !== 0) continue;

        // Moneyline (H2H)
        if (period.moneyline) {
          const ml = period.moneyline;
          if (ml.home && ml.away) {
            oddsRows.push({
              match_external_id: externalId,
              bookmaker: 'pinnacle',
              bookmaker_title: 'Pinnacle',
              market_type: 'h2h',
              handicap_point: 0,
              outcome_1_odds: ml.home,
              outcome_2_odds: ml.away,
              outcome_draw_odds: ml.draw || null,
              source_type: 'international',
            });
          }
        }

        // Spreads (Handicap) — take the main line (first entry)
        if (period.spreads && period.spreads.length > 0) {
          const spread = period.spreads[0]; // Main line
          if (spread.home && spread.away && spread.hdp !== undefined) {
            oddsRows.push({
              match_external_id: externalId,
              bookmaker: 'pinnacle',
              bookmaker_title: 'Pinnacle',
              market_type: 'spreads',
              handicap_point: spread.hdp,
              outcome_1_odds: spread.home,
              outcome_2_odds: spread.away,
              outcome_draw_odds: null,
              source_type: 'international',
            });
          }
        }

        // Totals (Over/Under) — take the main line (first entry)
        if (period.totals && period.totals.length > 0) {
          const total = period.totals[0]; // Main line
          if (total.over && total.under && total.points !== undefined) {
            oddsRows.push({
              match_external_id: externalId,
              bookmaker: 'pinnacle',
              bookmaker_title: 'Pinnacle',
              market_type: 'totals',
              handicap_point: total.points,
              outcome_1_odds: total.over,
              outcome_2_odds: total.under,
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
 * Main collection function: fetch fixtures + odds for all configured sports.
 * Respects rate limits by spacing requests.
 */
async function collectPinnacle() {
  if (!isConfigured()) {
    log.info('Pinnacle not configured (PINNACLE_USERNAME/PASSWORD missing), skipping');
    return { matches: [], oddsRows: [], skipped: true };
  }

  const startTime = Date.now();
  log.info(`Starting Pinnacle collection for sportIds: [${SPORT_IDS.join(', ')}]`);

  const allMatches = [];
  const allOddsRows = [];

  for (const sportId of SPORT_IDS) {
    // Step 1: Fetch fixtures (to get team names, leagues)
    await fetchFixtures(sportId);

    // Small delay to respect rate limits
    await new Promise((r) => setTimeout(r, 2000));

    // Step 2: Fetch odds
    const oddsData = await fetchOdds(sportId);
    if (!oddsData) continue;

    // Step 3: Transform to our format
    const { matches, oddsRows } = transformPinnacleData(oddsData);
    allMatches.push(...matches);
    allOddsRows.push(...oddsRows);

    log.info(`SportId ${sportId}: ${matches.length} matches, ${oddsRows.length} odds rows`);

    // Delay before next sport to avoid rate limiting
    if (SPORT_IDS.indexOf(sportId) < SPORT_IDS.length - 1) {
      await new Promise((r) => setTimeout(r, 3000));
    }
  }

  const duration = Date.now() - startTime;
  log.info(`Pinnacle collection complete: ${allMatches.length} matches, ${allOddsRows.length} odds rows (${duration}ms)`);

  return { matches: allMatches, oddsRows: allOddsRows };
}

/**
 * Get status info for API endpoints.
 */
function getPinnacleStatus() {
  return {
    configured: isConfigured(),
    sportIds: SPORT_IDS,
    cachedFixtures: Object.keys(fixturesCache).length,
    sinceValues: {
      fixtures: { ...sinceCache.fixtures },
      odds: { ...sinceCache.odds },
    },
  };
}

module.exports = {
  collectPinnacle,
  fetchFixtures,
  fetchOdds,
  transformPinnacleData,
  isConfigured,
  getPinnacleStatus,
  SPORT_IDS,
};

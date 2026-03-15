/**
 * Stake.com Odds Scraper
 *
 * Fetches public odds data from Stake.com GraphQL API via Vercel Edge proxy.
 * No login required — odds are publicly accessible through the "groups" query path.
 *
 * Stake.com API: https://stake.com/_api/graphql
 * Query pattern: slugSport → tournamentList → fixtureList → groups → templates → markets → outcomes
 *
 * Supported sports: soccer, basketball, baseball, ice-hockey, tennis
 * Market groups: "winner" (1x2/moneyline), "goals"/"totals" (Asian Total)
 */

const { createHttpClient } = require('../config/httpClient');
const { createServiceLogger } = require('../config/logger');
require('dotenv').config();

const log = createServiceLogger('Stake');
const http = createHttpClient('Stake', { timeout: 20000 });

// ─── Stake access strategy ───
// Stake.com is behind Cloudflare JS challenge, so direct Node.js requests fail.
// Route through Vercel Edge proxy (same pattern as Betman).
const VERCEL_PROXY_URL = process.env.VERCEL_PROXY_URL || 'https://sureodds-studio-coni.vercel.app';
const VERCEL_BYPASS_SECRET = process.env.VERCEL_BYPASS_SECRET || '';
const PROXY_ENDPOINT = `${VERCEL_PROXY_URL}/api/stake-proxy`;

// Sports to scrape (Stake slug → our sport_key prefix)
const SPORT_MAP = {
  soccer: 'soccer',
  basketball: 'basketball',
  baseball: 'baseball',
  'ice-hockey': 'icehockey',
  tennis: 'tennis',
};

// Default: only soccer (expand as needed)
const DEFAULT_SPORTS = ['soccer'];

// Tournament → sport_key mapping (common leagues)
const LEAGUE_MAP = {
  // Soccer
  'Premier League': 'soccer_epl',
  'La Liga': 'soccer_spain_la_liga',
  'Serie A': 'soccer_italy_serie_a',
  'Ligue 1': 'soccer_france_ligue_one',
  Bundesliga: 'soccer_germany_bundesliga',
  'Champions League': 'soccer_uefa_champs_league',
  'Europa League': 'soccer_uefa_europa_league',
  'K League 1': 'soccer_korea_kleague1',
  'J1 League': 'soccer_japan_j_league',
  'A-League Men': 'soccer_australia_aleague',
  MLS: 'soccer_usa_mls',
  // Basketball
  NBA: 'basketball_nba',
  KBL: 'basketball_kbl',
  // Baseball
  MLB: 'baseball_mlb',
  KBO: 'baseball_kbo',
  NPB: 'baseball_npb',
  // Hockey
  NHL: 'icehockey_nhl',
};

let lastScrapeResult = null;

function getLastScrapeResult() {
  return lastScrapeResult;
}

// ─── GraphQL Queries ───

const SPORT_ODDS_QUERY = `
query StakeOdds($sport: String!, $group: String!, $type: SportSearchEnum = upcoming) {
  slugSport(sport: $sport) {
    id
    name
    tournamentList(type: $type, limit: 10) {
      id
      name
      slug
      category { name countryCode }
      fixtureCount(type: $type)
      fixtureList(type: $type, limit: 30) {
        id
        slug
        status
        extId
        data {
          ... on SportFixtureDataMatch {
            startTime
            competitors { name extId }
          }
        }
        tournament { name slug category { name countryCode } }
        groups(groups: [$group], status: [active]) {
          name
          templates(limit: 10, includeEmpty: true) {
            extId
            name
            markets(limit: 1) {
              id
              name
              status
              extId
              specifiers
              outcomes { id name odds active }
            }
          }
        }
      }
    }
  }
}`;

/**
 * Execute a GraphQL query through the Vercel Edge proxy.
 */
async function queryStakeGraphQL(query, variables = {}) {
  const headers = {
    'Content-Type': 'application/json',
  };
  if (VERCEL_BYPASS_SECRET) {
    headers['x-vercel-protection-bypass'] = VERCEL_BYPASS_SECRET;
  }

  try {
    const { data } = await http.post(
      PROXY_ENDPOINT,
      { query, variables },
      { headers },
    );

    if (data.error || data.isCloudflare) {
      throw new Error(data.error || 'Cloudflare blocked request');
    }

    if (data.errors && data.errors.length > 0) {
      const msg = data.errors.map((e) => e.message).join('; ');
      throw new Error(`GraphQL error: ${msg}`);
    }

    return data.data;
  } catch (err) {
    if (err.response?.data?.isCloudflare) {
      throw new Error('Stake API: Cloudflare challenge (Edge proxy may not bypass)');
    }
    throw err;
  }
}

/**
 * Map Stake tournament name to a sport_key.
 */
function mapSportKey(sportSlug, tournamentName, categoryName) {
  const sport = SPORT_MAP[sportSlug] || sportSlug;

  // Check known leagues first
  for (const [keyword, key] of Object.entries(LEAGUE_MAP)) {
    if (tournamentName.includes(keyword)) return key;
  }

  // Fallback: generate from tournament name
  const sanitized = tournamentName
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');

  return `${sport}_${sanitized}`;
}

/**
 * Parse specifiers string (e.g., "total=0.75") into a numeric point.
 */
function parseSpecifiers(specifiers) {
  if (!specifiers) return 0;
  const match = specifiers.match(/(?:total|hcp)=([-\d.]+)/);
  return match ? parseFloat(match[1]) : 0;
}

/**
 * Scrape odds for a specific sport from Stake.com.
 */
async function scrapeSport(sportSlug, group = 'winner') {
  log.info(`Fetching ${sportSlug} odds (group: ${group})`);

  const data = await queryStakeGraphQL(SPORT_ODDS_QUERY, {
    sport: sportSlug,
    group,
    type: 'upcoming',
  });

  const sport = data?.slugSport;
  if (!sport) {
    log.warn(`No data for sport: ${sportSlug}`);
    return { matches: [], oddsRows: [] };
  }

  const matches = [];
  const oddsRows = [];
  const matchMap = {}; // extId → match info

  for (const tournament of sport.tournamentList || []) {
    const tournamentName = tournament.name || 'Unknown';
    const categoryName = tournament.category?.name || '';

    for (const fixture of tournament.fixtureList || []) {
      if (fixture.status !== 'active') continue;

      const matchData = fixture.data;
      if (!matchData || !matchData.competitors || matchData.competitors.length < 2) continue;

      const home = matchData.competitors[0];
      const away = matchData.competitors[1];

      // Build or reuse match entry
      const externalId = fixture.extId || `stake_${fixture.id}`;
      if (!matchMap[externalId]) {
        const matchEntry = {
          external_id: externalId,
          sport: mapSportKey(sportSlug, tournamentName, categoryName),
          league: `${tournamentName}`,
          home_team: home.name,
          away_team: away.name,
          start_time: new Date(matchData.startTime).toISOString(),
        };
        matchMap[externalId] = matchEntry;
        matches.push(matchEntry);
      }

      // Extract odds from groups → templates → markets → outcomes
      for (const grp of fixture.groups || []) {
        for (const template of grp.templates || []) {
          for (const market of template.markets || []) {
            if (market.status !== 'active') continue;
            if (!market.outcomes || market.outcomes.length < 2) continue;

            const activeOutcomes = market.outcomes.filter((o) => o.active && o.odds > 1);
            if (activeOutcomes.length < 2) continue;

            const oddsRow = buildOddsRow(
              externalId,
              template,
              market,
              activeOutcomes,
              home.name,
              away.name,
            );

            if (oddsRow) {
              oddsRows.push(oddsRow);
            }
          }
        }
      }
    }
  }

  log.info(`${sportSlug}/${group}: ${matches.length} matches, ${oddsRows.length} odds rows`);
  return { matches, oddsRows };
}

/**
 * Build an odds row from Stake market data.
 */
function buildOddsRow(externalId, template, market, outcomes, homeName, awayName) {
  const templateName = (template.name || market.name || '').toLowerCase();
  const specPoint = parseSpecifiers(market.specifiers);

  let marketType = null;
  let outcome1 = null; // home / over
  let outcome2 = null; // away / under
  let outcomeDraw = null;

  if (templateName.includes('1x2') || templateName === 'moneyline') {
    marketType = 'h2h';
    // Match outcomes to home/away/draw
    for (const o of outcomes) {
      const name = o.name.toLowerCase();
      if (name === 'draw' || name === 'x') {
        outcomeDraw = o.odds;
      } else if (name === homeName.toLowerCase() || name.includes('1')) {
        outcome1 = o.odds;
      } else if (name === awayName.toLowerCase() || name.includes('2')) {
        outcome2 = o.odds;
      } else {
        // Positional: first=home, last=away
        if (!outcome1) outcome1 = o.odds;
        else if (!outcome2) outcome2 = o.odds;
      }
    }
  } else if (
    templateName.includes('asian handicap') ||
    templateName.includes('handicap')
  ) {
    marketType = 'spreads';
    // Asian handicap: 2 outcomes (home/away)
    if (outcomes.length >= 2) {
      outcome1 = outcomes[0].odds;
      outcome2 = outcomes[1].odds;
    }
  } else if (
    templateName.includes('total') ||
    templateName.includes('over/under')
  ) {
    marketType = 'totals';
    for (const o of outcomes) {
      const name = o.name.toLowerCase();
      if (name.includes('over')) outcome1 = o.odds;
      else if (name.includes('under')) outcome2 = o.odds;
    }
  } else if (templateName.includes('draw no bet')) {
    // Map Draw No Bet to h2h (no draw)
    marketType = 'h2h';
    if (outcomes.length >= 2) {
      outcome1 = outcomes[0].odds;
      outcome2 = outcomes[1].odds;
    }
  } else {
    // Skip unsupported market types
    return null;
  }

  if (!marketType || outcome1 == null || outcome2 == null) return null;

  return {
    match_external_id: externalId,
    bookmaker: 'stake',
    bookmaker_title: 'Stake.com',
    market_type: marketType,
    handicap_point: specPoint,
    outcome_1_odds: outcome1,
    outcome_2_odds: outcome2,
    outcome_draw_odds: outcomeDraw,
    source_type: 'domestic',
  };
}

/**
 * Main scrape function: fetches odds for all configured sports.
 */
async function scrapeStake(sports = DEFAULT_SPORTS) {
  const startTime = Date.now();
  log.info('Starting Stake.com scrape');

  try {
    const allMatches = [];
    const allOddsRows = [];

    for (const sport of sports) {
      // Fetch 1x2/moneyline (winner group)
      try {
        const { matches, oddsRows } = await scrapeSport(sport, 'winner');
        allMatches.push(...matches);
        allOddsRows.push(...oddsRows);
      } catch (err) {
        log.error(`Error scraping ${sport}/winner`, { error: err.message });
      }

      // Small delay between requests
      await new Promise((r) => setTimeout(r, 500));

      // Fetch totals (goals group for soccer, totals for others)
      const totalsGroup = sport === 'soccer' ? 'goals' : 'totals';
      try {
        const { matches: _m, oddsRows } = await scrapeSport(sport, totalsGroup);
        // Don't add duplicate matches, just add new odds rows
        allOddsRows.push(...oddsRows);
      } catch (err) {
        log.error(`Error scraping ${sport}/${totalsGroup}`, { error: err.message });
      }
    }

    // Deduplicate matches by external_id
    const uniqueMatches = [];
    const seen = new Set();
    for (const m of allMatches) {
      if (!seen.has(m.external_id)) {
        seen.add(m.external_id);
        uniqueMatches.push(m);
      }
    }

    lastScrapeResult = {
      success: true,
      timestamp: new Date().toISOString(),
      duration: Date.now() - startTime,
      matches: uniqueMatches.length,
      oddsRows: allOddsRows.length,
      sports,
    };

    log.info(
      `Stake scrape complete: ${uniqueMatches.length} matches, ${allOddsRows.length} odds rows (${Date.now() - startTime}ms)`,
    );

    return { matches: uniqueMatches, oddsRows: allOddsRows };
  } catch (err) {
    log.error('Stake scrape error', { error: err.message, stack: err.stack });
    lastScrapeResult = {
      success: false,
      timestamp: new Date().toISOString(),
      duration: Date.now() - startTime,
      error: err.message,
    };
    return { matches: [], oddsRows: [] };
  }
}

module.exports = {
  scrapeStake,
  scrapeSport,
  getLastScrapeResult,
};

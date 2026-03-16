/**
 * API-Football v3 HTTP Client
 * https://www.api-football.com/documentation-v3
 *
 * Free tier: 100 requests/day
 * Used for: team statistics bootstrapping (standings endpoint)
 */

const axios = require('axios');
const { createServiceLogger } = require('../config/logger');

const log = createServiceLogger('API-Football');

const BASE_URL = 'https://v3.football.api-sports.io';
const API_KEY = process.env.API_FOOTBALL_KEY;

// Major league IDs
const LEAGUES = {
  EPL: { id: 39, name: 'Premier League', sport: 'soccer_epl' },
  LA_LIGA: { id: 140, name: 'La Liga', sport: 'soccer_spain_la_liga' },
  BUNDESLIGA: { id: 78, name: 'Bundesliga', sport: 'soccer_germany_bundesliga' },
  SERIE_A: { id: 135, name: 'Serie A', sport: 'soccer_italy_serie_a' },
  LIGUE_1: { id: 61, name: 'Ligue 1', sport: 'soccer_france_ligue_one' },
};

// Quota tracking
let quotaInfo = { used: null, remaining: null, limit: null, updatedAt: null };

function isConfigured() {
  return !!API_KEY;
}

function getQuotaInfo() {
  return { ...quotaInfo };
}

/**
 * Make a request to the API-Football v3 endpoint.
 */
async function apiRequest(endpoint, params = {}) {
  if (!isConfigured()) {
    throw new Error('API_FOOTBALL_KEY is not configured');
  }

  const url = `${BASE_URL}${endpoint}`;
  const response = await axios.get(url, {
    headers: { 'x-apisports-key': API_KEY },
    params,
    timeout: 15000,
  });

  // Track quota from response headers
  const remaining = response.headers['x-ratelimit-remaining'];
  const requestsUsed = response.headers['x-ratelimit-requests'];
  const requestLimit = response.headers['x-ratelimit-limit'];
  if (remaining != null) {
    quotaInfo = {
      used: requestsUsed ? parseInt(requestsUsed) : null,
      remaining: parseInt(remaining),
      limit: requestLimit ? parseInt(requestLimit) : 100,
      updatedAt: new Date().toISOString(),
    };
  }

  const data = response.data;
  if (data.errors && Object.keys(data.errors).length > 0) {
    throw new Error(`API-Football error: ${JSON.stringify(data.errors)}`);
  }

  return data.response;
}

/**
 * Fetch league standings (all teams with stats in one request).
 * Returns the standings array for the given league/season.
 */
async function fetchStandings(leagueId, season) {
  log.info(`Fetching standings: league=${leagueId}, season=${season}`);
  const response = await apiRequest('/standings', { league: leagueId, season });

  if (!response || response.length === 0) {
    log.warn(`No standings data for league=${leagueId}, season=${season}`);
    return [];
  }

  // response[0].league.standings is an array of groups (usually 1 for league format)
  const standings = response[0]?.league?.standings;
  if (!standings || standings.length === 0) {
    return [];
  }

  // Flatten groups (for leagues with single group, this is standings[0])
  return standings[0] || [];
}

/**
 * Fetch standings for all configured leagues.
 * Total: 5 API requests.
 */
async function fetchAllLeagueStandings(season) {
  const results = {};

  for (const [key, league] of Object.entries(LEAGUES)) {
    try {
      const standings = await fetchStandings(league.id, season);
      results[key] = { league, standings };
      log.info(`  ${league.name}: ${standings.length} teams`);
    } catch (err) {
      log.error(`Failed to fetch ${league.name}: ${err.message}`);
      results[key] = { league, standings: [] };
    }
  }

  const totalTeams = Object.values(results).reduce((sum, r) => sum + r.standings.length, 0);
  log.info(`Fetched standings for ${totalTeams} teams across ${Object.keys(results).length} leagues (quota: ${quotaInfo.remaining} remaining)`);

  return results;
}

module.exports = {
  isConfigured,
  getQuotaInfo,
  fetchStandings,
  fetchAllLeagueStandings,
  LEAGUES,
};

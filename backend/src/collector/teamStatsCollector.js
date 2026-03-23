/**
 * Team Stats Collector
 *
 * Orchestrates fetching team statistics from API-Football,
 * transforming them, and saving to Supabase team_stats table.
 * Runs daily via cron schedule.
 */

const cron = require('node-cron');
const { createServiceLogger } = require('../config/logger');
const supabase = require('../config/supabase');
const { isConfigured, fetchAllLeagueStandings, fetchAllLeagueFixtures, getQuotaInfo } = require('./apiFootball');
const { fetchAllScores } = require('./oddsApi');
const {
  transformStandingsToTeamStats,
  calculateLeagueRatings,
  calculateEloFromStandings,
  cleanForDb,
} = require('./teamStatsTransformer');
const { updateMatchScores, updateMatchScoresFromOddsApi, getUnprocessedCompletedMatches } = require('../services/matchResultService');
const { processMatchResults, recalculateForm } = require('../services/eloCalculator');
const { processCompletedPredictions } = require('../services/predictionAccuracyService');

const log = createServiceLogger('TeamStats');

let lastResult = null;

function getLastResult() {
  return lastResult;
}

/**
 * Main collection function.
 * Fetches standings for all 5 leagues, transforms, and upserts into team_stats.
 */
async function collectTeamStats() {
  const startTime = Date.now();
  log.info('=== Team Stats Collection Started ===');

  if (!isConfigured()) {
    log.warn('API_FOOTBALL_KEY not configured, skipping team stats collection');
    lastResult = { success: false, error: 'API_FOOTBALL_KEY not configured', timestamp: new Date().toISOString() };
    return lastResult;
  }

  try {
    // European football season runs Aug–May. If month >= Aug, season = this year; else last year.
    const now = new Date();
    const autoSeason = now.getMonth() >= 7 ? now.getFullYear() : now.getFullYear() - 1;
    const season = process.env.API_FOOTBALL_SEASON || String(autoSeason);

    // 1. Fetch standings from API-Football (5 requests)
    const allStandings = await fetchAllLeagueStandings(parseInt(season));

    // 2. Transform to team_stats rows
    let allTeamRows = [];
    for (const [leagueKey, { standings }] of Object.entries(allStandings)) {
      const rows = transformStandingsToTeamStats(standings, leagueKey, season);
      allTeamRows.push(...rows);
    }

    if (allTeamRows.length === 0) {
      log.warn('No team data to process');
      lastResult = { success: true, teamsUpdated: 0, timestamp: new Date().toISOString() };
      return lastResult;
    }

    // 3. Calculate ratings
    calculateLeagueRatings(allTeamRows);
    calculateEloFromStandings(allTeamRows);

    // 4. Clean for DB and upsert
    const dbRows = cleanForDb(allTeamRows);
    const { error } = await supabase
      .from('team_stats')
      .upsert(dbRows, { onConflict: 'team_name,sport,season' });

    if (error) {
      throw new Error(`Supabase upsert error: ${error.message}`);
    }

    const duration = Date.now() - startTime;
    const quota = getQuotaInfo();

    lastResult = {
      success: true,
      teamsUpdated: dbRows.length,
      leaguesProcessed: Object.keys(allStandings).length,
      season,
      duration,
      quota,
      timestamp: new Date().toISOString(),
    };

    // 5. Fetch match scores — primary: TheOddsAPI, fallback: API-Football
    let fixturesResult = { updated: 0 };
    let eloResult = { processed: 0 };
    let formResult = { updated: 0 };
    let accuracyResult = { processed: 0 };

    try {
      // 5a. TheOddsAPI scores (free, current season, reliable)
      log.info('--- Fetching scores from TheOddsAPI ---');
      const completedScores = await fetchAllScores(3);
      fixturesResult = await updateMatchScoresFromOddsApi(completedScores);

      // 5b. API-Football fixtures as fallback (may fail on free plan for current season)
      try {
        log.info('--- Fetching fixture results from API-Football (fallback) ---');
        const allFixtures = await fetchAllLeagueFixtures(parseInt(season), 7);
        const apiFbResult = await updateMatchScores(allFixtures);
        fixturesResult.updated += apiFbResult.updated;
      } catch (apiFbErr) {
        log.warn(`API-Football fixture fetch failed (non-fatal): ${apiFbErr.message}`);
      }

      // 6. Process unprocessed completed matches for ELO update
      log.info('--- Processing ELO updates ---');
      const unprocessed = await getUnprocessedCompletedMatches();
      eloResult = await processMatchResults(unprocessed);

      // 7. Recalculate form from match results
      log.info('--- Recalculating form ---');
      formResult = await recalculateForm();

      // 8. Process prediction accuracy for completed matches
      log.info('--- Processing prediction accuracy ---');
      accuracyResult = await processCompletedPredictions();
    } catch (fixtureErr) {
      log.warn(`Fixture/ELO processing failed (non-fatal): ${fixtureErr.message}`);
    }

    log.info(`=== Team Stats Collection Complete: ${dbRows.length} teams, ${fixturesResult.updated} scores, ${eloResult.processed} ELO updates, ${accuracyResult.processed} accuracy, ${duration}ms ===`);

    lastResult = {
      ...lastResult,
      fixturesUpdated: fixturesResult.updated,
      eloProcessed: eloResult.processed,
      formUpdated: formResult.updated,
      accuracyProcessed: accuracyResult.processed,
    };

    return lastResult;
  } catch (err) {
    const duration = Date.now() - startTime;
    log.error(`Team stats collection failed: ${err.message}`);

    lastResult = {
      success: false,
      error: err.message,
      duration,
      timestamp: new Date().toISOString(),
    };

    return lastResult;
  }
}

/**
 * Start the daily scheduler.
 * Runs at 06:00 daily + once immediately on startup.
 */
function startDailyScheduler() {
  if (!isConfigured()) {
    log.warn('API_FOOTBALL_KEY not set — team stats scheduler disabled');
    return;
  }

  // Run on startup only if not recently collected (within 12 hours)
  (async () => {
    try {
      const { data } = await supabase
        .from('team_stats')
        .select('updated_at')
        .order('updated_at', { ascending: false })
        .limit(1)
        .single();

      const lastUpdate = data?.updated_at ? new Date(data.updated_at) : null;
      const hoursSince = lastUpdate ? (Date.now() - lastUpdate.getTime()) / 3600000 : Infinity;

      if (hoursSince > 12) {
        log.info(`Last update ${hoursSince.toFixed(1)}h ago — running startup collection`);
        await collectTeamStats();
      } else {
        log.info(`Last update ${hoursSince.toFixed(1)}h ago — skipping startup collection`);
      }
    } catch (err) {
      log.error(`Startup check failed: ${err.message}`);
    }
  })();

  // Schedule daily at 06:00
  cron.schedule('0 6 * * *', () => {
    log.info('Daily team stats cron triggered');
    collectTeamStats().catch((err) => {
      log.error(`Scheduled collection failed: ${err.message}`);
    });
  });

  log.info('Team stats scheduler started (daily at 06:00 + startup)');
}

module.exports = {
  collectTeamStats,
  startDailyScheduler,
  getLastResult,
  getQuotaInfo,
};

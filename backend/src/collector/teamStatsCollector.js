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
const {
  transformStandingsToTeamStats,
  calculateLeagueRatings,
  calculateEloFromStandings,
  cleanForDb,
} = require('./teamStatsTransformer');
const { updateMatchScores, getUnprocessedCompletedMatches } = require('../services/matchResultService');
const { processMatchResults, recalculateForm } = require('../services/eloCalculator');

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
    const season = process.env.API_FOOTBALL_SEASON || '2024';

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

    // 5. Fetch fixture results and update match scores (5 more requests)
    let fixturesResult = { updated: 0 };
    let eloResult = { processed: 0 };
    let formResult = { updated: 0 };

    try {
      log.info('--- Fetching fixture results ---');
      const allFixtures = await fetchAllLeagueFixtures(parseInt(season), 7);
      fixturesResult = await updateMatchScores(allFixtures);

      // 6. Process unprocessed completed matches for ELO update
      log.info('--- Processing ELO updates ---');
      const unprocessed = await getUnprocessedCompletedMatches();
      eloResult = await processMatchResults(unprocessed);

      // 7. Recalculate form from match results
      log.info('--- Recalculating form ---');
      formResult = await recalculateForm();
    } catch (fixtureErr) {
      log.warn(`Fixture/ELO processing failed (non-fatal): ${fixtureErr.message}`);
    }

    log.info(`=== Team Stats Collection Complete: ${dbRows.length} teams, ${fixturesResult.updated} scores, ${eloResult.processed} ELO updates, ${duration}ms ===`);

    lastResult = {
      ...lastResult,
      fixturesUpdated: fixturesResult.updated,
      eloProcessed: eloResult.processed,
      formUpdated: formResult.updated,
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

  // Run immediately on startup
  log.info('Running initial team stats collection...');
  collectTeamStats().catch((err) => {
    log.error(`Initial collection failed: ${err.message}`);
  });

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

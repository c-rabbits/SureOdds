/**
 * ELO Calculator
 *
 * Standard ELO rating system adapted for football.
 * Processes completed match results and updates team_stats ELO ratings.
 */

const { createServiceLogger } = require('../config/logger');
const supabase = require('../config/supabase');

const log = createServiceLogger('ELO');

// ELO parameters
const K_FACTOR = 20;          // Standard K-factor for league matches
const HOME_ADVANTAGE = 50;    // Home team ELO boost (equivalent)
const DEFAULT_ELO = 1500;

/**
 * Calculate expected score (win probability) based on ELO ratings.
 * E = 1 / (1 + 10^((opponent_elo - my_elo) / 400))
 */
function expectedScore(myElo, opponentElo) {
  return 1 / (1 + Math.pow(10, (opponentElo - myElo) / 400));
}

/**
 * Get actual score value from match result.
 * Win = 1, Draw = 0.5, Loss = 0
 */
function actualScore(myGoals, opponentGoals) {
  if (myGoals > opponentGoals) return 1;
  if (myGoals === opponentGoals) return 0.5;
  return 0;
}

/**
 * Calculate ELO change for a single match.
 * Returns { homeChange, awayChange }
 */
function calculateEloChange(homeElo, awayElo, homeScore, awayScore) {
  // Home team gets advantage boost for expected score calculation
  const homeExpected = expectedScore(homeElo + HOME_ADVANTAGE, awayElo);
  const awayExpected = 1 - homeExpected;

  const homeActual = actualScore(homeScore, awayScore);
  const awayActual = 1 - homeActual;

  // Goal difference multiplier (bigger wins = bigger ELO change)
  const goalDiff = Math.abs(homeScore - awayScore);
  let gdMultiplier = 1;
  if (goalDiff === 2) gdMultiplier = 1.5;
  else if (goalDiff === 3) gdMultiplier = 1.75;
  else if (goalDiff >= 4) gdMultiplier = 1.75 + (goalDiff - 3) * 0.125;

  const homeChange = parseFloat((K_FACTOR * gdMultiplier * (homeActual - homeExpected)).toFixed(2));
  const awayChange = parseFloat((K_FACTOR * gdMultiplier * (awayActual - awayExpected)).toFixed(2));

  return { homeChange, awayChange };
}

/**
 * Process completed matches and update ELO ratings.
 * - Loads current ELO from team_stats
 * - Calculates changes for each match
 * - Updates team_stats
 * - Records changes in elo_history
 */
async function processMatchResults(completedMatches) {
  if (!completedMatches || completedMatches.length === 0) {
    log.info('No unprocessed matches for ELO update');
    return { processed: 0 };
  }

  log.info(`Processing ${completedMatches.length} matches for ELO update`);

  // Collect all unique team names
  const teamNames = new Set();
  for (const match of completedMatches) {
    teamNames.add(match.home_team);
    teamNames.add(match.away_team);
  }

  // Load current ELO ratings
  const { data: teamStats, error } = await supabase
    .from('team_stats')
    .select('team_name, sport, elo_rating')
    .in('team_name', [...teamNames]);

  if (error) {
    log.error(`Failed to load team stats: ${error.message}`);
    return { processed: 0, error: error.message };
  }

  // Build ELO lookup map: "teamName:sport" -> elo
  const eloMap = {};
  for (const ts of (teamStats || [])) {
    eloMap[`${ts.team_name}:${ts.sport}`] = ts.elo_rating || DEFAULT_ELO;
  }

  let processed = 0;
  const eloHistoryRows = [];
  const eloUpdates = {}; // "teamName:sport" -> newElo

  // Sort matches by start_time to process chronologically
  completedMatches.sort((a, b) => new Date(a.start_time) - new Date(b.start_time));

  for (const match of completedMatches) {
    const homeKey = `${match.home_team}:${match.sport}`;
    const awayKey = `${match.away_team}:${match.sport}`;

    const homeElo = eloUpdates[homeKey] || eloMap[homeKey] || DEFAULT_ELO;
    const awayElo = eloUpdates[awayKey] || eloMap[awayKey] || DEFAULT_ELO;

    const { homeChange, awayChange } = calculateEloChange(
      homeElo, awayElo, match.home_score, match.away_score
    );

    const newHomeElo = parseFloat((homeElo + homeChange).toFixed(2));
    const newAwayElo = parseFloat((awayElo + awayChange).toFixed(2));

    // Track updates
    eloUpdates[homeKey] = newHomeElo;
    eloUpdates[awayKey] = newAwayElo;

    // Prepare elo_history rows
    eloHistoryRows.push({
      team_name: match.home_team,
      sport: match.sport,
      match_id: match.id,
      elo_before: homeElo,
      elo_after: newHomeElo,
      elo_change: homeChange,
    });

    eloHistoryRows.push({
      team_name: match.away_team,
      sport: match.sport,
      match_id: match.id,
      elo_before: awayElo,
      elo_after: newAwayElo,
      elo_change: awayChange,
    });

    processed++;
  }

  // Batch insert elo_history
  if (eloHistoryRows.length > 0) {
    const { error: histErr } = await supabase
      .from('elo_history')
      .insert(eloHistoryRows);

    if (histErr) {
      log.error(`Failed to insert elo_history: ${histErr.message}`);
    } else {
      log.info(`Inserted ${eloHistoryRows.length} elo_history records`);
    }
  }

  // Update team_stats with new ELO ratings
  let eloUpdated = 0;
  for (const [key, newElo] of Object.entries(eloUpdates)) {
    const [teamName, sport] = key.split(':');
    const season = process.env.API_FOOTBALL_SEASON || '2024';

    const { error: updateErr } = await supabase
      .from('team_stats')
      .update({ elo_rating: newElo, updated_at: new Date().toISOString() })
      .eq('team_name', teamName)
      .eq('sport', sport)
      .eq('season', season);

    if (!updateErr) eloUpdated++;
  }

  log.info(`ELO update complete: ${processed} matches, ${eloUpdated} teams updated`);
  return { processed, eloHistoryInserted: eloHistoryRows.length, eloUpdated };
}

/**
 * Recalculate form (last 5 results) for all teams from matches table.
 */
async function recalculateForm() {
  const season = process.env.API_FOOTBALL_SEASON || '2024';

  // Get all teams from team_stats
  const { data: teams, error } = await supabase
    .from('team_stats')
    .select('team_name, sport')
    .eq('season', season);

  if (error || !teams) return { updated: 0 };

  let updated = 0;

  for (const team of teams) {
    // Get last 5 completed matches for this team
    const { data: homeMatches } = await supabase
      .from('matches')
      .select('home_score, away_score, start_time')
      .eq('home_team', team.team_name)
      .eq('sport', team.sport)
      .eq('status', 'completed')
      .not('home_score', 'is', null)
      .order('start_time', { ascending: false })
      .limit(5);

    const { data: awayMatches } = await supabase
      .from('matches')
      .select('home_score, away_score, start_time')
      .eq('away_team', team.team_name)
      .eq('sport', team.sport)
      .eq('status', 'completed')
      .not('home_score', 'is', null)
      .order('start_time', { ascending: false })
      .limit(5);

    // Combine and sort by start_time descending
    const allMatches = [
      ...(homeMatches || []).map(m => ({
        result: m.home_score > m.away_score ? 'W' : m.home_score === m.away_score ? 'D' : 'L',
        time: m.start_time,
      })),
      ...(awayMatches || []).map(m => ({
        result: m.away_score > m.home_score ? 'W' : m.away_score === m.home_score ? 'D' : 'L',
        time: m.start_time,
      })),
    ].sort((a, b) => new Date(b.time) - new Date(a.time)).slice(0, 5);

    if (allMatches.length === 0) continue;

    const form = allMatches.map(m => m.result).join('');

    const { error: updateErr } = await supabase
      .from('team_stats')
      .update({ form_last5: form, updated_at: new Date().toISOString() })
      .eq('team_name', team.team_name)
      .eq('sport', team.sport)
      .eq('season', season);

    if (!updateErr) updated++;
  }

  log.info(`Form recalculated for ${updated} teams`);
  return { updated };
}

module.exports = {
  calculateEloChange,
  processMatchResults,
  recalculateForm,
  expectedScore,
  actualScore,
};

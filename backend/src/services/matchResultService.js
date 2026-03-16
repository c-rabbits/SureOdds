/**
 * Match Result Service
 *
 * Updates matches table with scores from API-Football fixture results.
 * Matches API-Football team names to our existing match records.
 */

const { createServiceLogger } = require('../config/logger');
const supabase = require('../config/supabase');
const { normalizeTeamName } = require('../collector/teamStatsTransformer');

const log = createServiceLogger('MatchResult');

/**
 * Parse API-Football fixture data into a normalized result object.
 */
function parseFixture(fixture) {
  const homeTeam = normalizeTeamName(fixture.teams?.home?.name || '');
  const awayTeam = normalizeTeamName(fixture.teams?.away?.name || '');
  const homeScore = fixture.goals?.home;
  const awayScore = fixture.goals?.away;
  const startTime = fixture.fixture?.date; // ISO string
  const status = fixture.fixture?.status?.short; // FT, AET, PEN, etc.

  return {
    homeTeam,
    awayTeam,
    homeScore: homeScore != null ? homeScore : null,
    awayScore: awayScore != null ? awayScore : null,
    startTime,
    status: status === 'FT' || status === 'AET' || status === 'PEN' ? 'completed' : 'scheduled',
  };
}

/**
 * Update match scores in the matches table.
 * Matches by home_team + away_team + date (same day).
 * Returns list of successfully updated matches with their IDs.
 */
async function updateMatchScores(allFixtures) {
  const results = [];
  let updated = 0;
  let notFound = 0;

  for (const [leagueKey, { league, fixtures }] of Object.entries(allFixtures)) {
    for (const fixture of fixtures) {
      const parsed = parseFixture(fixture);
      if (parsed.homeScore == null || parsed.awayScore == null) continue;

      // Match by home_team + away_team + sport + approximate start_time (same day)
      const matchDate = new Date(parsed.startTime);
      const dayStart = new Date(matchDate);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(matchDate);
      dayEnd.setHours(23, 59, 59, 999);

      const { data: matches, error } = await supabase
        .from('matches')
        .select('id, home_team, away_team, home_score, status')
        .eq('sport', league.sport)
        .gte('start_time', dayStart.toISOString())
        .lte('start_time', dayEnd.toISOString())
        .or(`home_team.eq.${parsed.homeTeam},home_team.ilike.%${parsed.homeTeam.split(' ')[0]}%`)
        .limit(5);

      if (error) {
        log.warn(`Query error for ${parsed.homeTeam} vs ${parsed.awayTeam}: ${error.message}`);
        continue;
      }

      // Find best match by comparing both team names
      const match = (matches || []).find((m) => {
        const homeMatch = m.home_team === parsed.homeTeam ||
          m.home_team.toLowerCase().includes(parsed.homeTeam.split(' ')[0].toLowerCase());
        return homeMatch;
      });

      if (!match) {
        // Try broader search
        const { data: broadMatches } = await supabase
          .from('matches')
          .select('id, home_team, away_team, home_score, status')
          .eq('sport', league.sport)
          .gte('start_time', dayStart.toISOString())
          .lte('start_time', dayEnd.toISOString());

        const broadMatch = (broadMatches || []).find((m) => {
          const h = m.home_team.toLowerCase();
          const a = m.away_team.toLowerCase();
          const ph = parsed.homeTeam.toLowerCase();
          const pa = parsed.awayTeam.toLowerCase();
          return (h.includes(ph) || ph.includes(h) || h === ph) &&
                 (a.includes(pa) || pa.includes(a) || a === pa);
        });

        if (broadMatch) {
          // Skip if already has score
          if (broadMatch.home_score != null && broadMatch.status === 'completed') {
            results.push({ matchId: broadMatch.id, homeTeam: parsed.homeTeam, awayTeam: parsed.awayTeam, alreadyUpdated: true });
            continue;
          }

          const { error: updateErr } = await supabase
            .from('matches')
            .update({
              home_score: parsed.homeScore,
              away_score: parsed.awayScore,
              status: 'completed',
            })
            .eq('id', broadMatch.id);

          if (!updateErr) {
            updated++;
            results.push({
              matchId: broadMatch.id,
              homeTeam: parsed.homeTeam,
              awayTeam: parsed.awayTeam,
              homeScore: parsed.homeScore,
              awayScore: parsed.awayScore,
            });
          }
        } else {
          notFound++;
        }
        continue;
      }

      // Skip if already has score
      if (match.home_score != null && match.status === 'completed') {
        results.push({ matchId: match.id, homeTeam: parsed.homeTeam, awayTeam: parsed.awayTeam, alreadyUpdated: true });
        continue;
      }

      const { error: updateErr } = await supabase
        .from('matches')
        .update({
          home_score: parsed.homeScore,
          away_score: parsed.awayScore,
          status: 'completed',
        })
        .eq('id', match.id);

      if (!updateErr) {
        updated++;
        results.push({
          matchId: match.id,
          homeTeam: parsed.homeTeam,
          awayTeam: parsed.awayTeam,
          homeScore: parsed.homeScore,
          awayScore: parsed.awayScore,
        });
      }
    }
  }

  log.info(`Match scores updated: ${updated}, not found: ${notFound}, already up-to-date: ${results.filter(r => r.alreadyUpdated).length}`);
  return { updated, notFound, results };
}

/**
 * Get recently completed matches from our DB (for ELO processing).
 * Returns matches that have scores but haven't been ELO-processed yet.
 */
async function getUnprocessedCompletedMatches(sport) {
  // Get completed matches that don't have elo_history entries yet
  const { data: completed, error } = await supabase
    .from('matches')
    .select('id, sport, home_team, away_team, home_score, away_score, start_time')
    .eq('status', 'completed')
    .not('home_score', 'is', null)
    .order('start_time', { ascending: true });

  if (error || !completed) return [];

  // Filter to soccer only (for now)
  const soccerMatches = completed.filter(m => m.sport.startsWith('soccer_'));

  // Check which have already been processed (have elo_history entries)
  const matchIds = soccerMatches.map(m => m.id);
  if (matchIds.length === 0) return [];

  const { data: processed } = await supabase
    .from('elo_history')
    .select('match_id')
    .in('match_id', matchIds);

  const processedIds = new Set((processed || []).map(p => p.match_id));
  return soccerMatches.filter(m => !processedIds.has(m.id));
}

module.exports = {
  updateMatchScores,
  getUnprocessedCompletedMatches,
  parseFixture,
};

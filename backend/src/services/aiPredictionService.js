/**
 * AI Prediction Service
 * 배당 기반 AI 예측 생성 및 조회.
 */

const supabase = require('../config/supabase');
const { computePrediction } = require('./poissonModel');
const { bulkGetTeamStats } = require('./teamStrengthModel');
const { createServiceLogger } = require('../config/logger');

const log = createServiceLogger('AiPrediction');

/**
 * 오늘+내일 경기에 대해 AI 예측 일괄 생성/갱신.
 * 수집 사이클 후 호출.
 */
async function generatePredictions() {
  const now = new Date();
  const tomorrow = new Date(now.getTime() + 48 * 3600 * 1000);

  // 오늘~내일 경기 조회
  const { data: matches, error: mErr } = await supabase
    .from('matches')
    .select('id, sport, league, home_team, away_team, start_time')
    .gte('start_time', now.toISOString())
    .lte('start_time', tomorrow.toISOString())
    .order('start_time');

  if (mErr || !matches || matches.length === 0) return;

  // 벌크로 모든 팀의 통계 조회 (1회 쿼리)
  const allTeamNames = matches.flatMap((m) => [m.home_team, m.away_team]);
  const teamStatsMap = await bulkGetTeamStats(allTeamNames);
  const hybridCount = { total: 0, hybrid: 0 };

  let predicted = 0;
  let valueBetCount = 0;

  for (const match of matches) {
    try {
      // 해당 경기의 현재 배당 조회
      const { data: oddsRecords } = await supabase
        .from('odds')
        .select('*')
        .eq('match_id', match.id);

      if (!oddsRecords || oddsRecords.length < 2) continue;

      // 팀 통계 매칭
      const homeStats = teamStatsMap.get(match.home_team) || null;
      const awayStats = teamStatsMap.get(match.away_team) || null;
      const teamStats = (homeStats && awayStats) ? { home: homeStats, away: awayStats } : null;

      const prediction = computePrediction(match, oddsRecords, teamStats);
      if (!prediction) continue;

      hybridCount.total++;
      if (prediction.model_type === 'poisson_v2_hybrid') hybridCount.hybrid++;

      // Upsert into ai_predictions
      const { error: insertErr } = await supabase
        .from('ai_predictions')
        .upsert(prediction, { onConflict: 'match_id,model_type' });

      if (insertErr) {
        log.error('Error upserting prediction', {
          matchId: match.id,
          error: insertErr.message,
        });
      } else {
        predicted++;
        if (prediction.value_bets) valueBetCount += prediction.value_bets.length;
      }
    } catch (err) {
      log.error('Error computing prediction', {
        matchId: match.id,
        error: err.message,
      });
    }
  }

  if (predicted > 0) {
    log.info(`Generated ${predicted} predictions (${hybridCount.hybrid}/${hybridCount.total} hybrid), ${valueBetCount} value bets`);
  }
}

/**
 * 단건 경기 예측 조회.
 */
async function getPrediction(matchId) {
  const { data, error } = await supabase
    .from('ai_predictions')
    .select('*')
    .eq('match_id', matchId)
    .single();

  if (error) return null;
  return data;
}

/**
 * 오늘 경기 + 예측 조인 조회.
 * @param {Object} filters - { sport, date, limit }
 */
async function getMatchesWithPredictions(filters = {}) {
  const targetDate = filters.date ? new Date(filters.date) : new Date();
  const startOfDay = new Date(targetDate);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(targetDate);
  endOfDay.setHours(23, 59, 59, 999);

  // +1일까지 포함 (시차 고려)
  const endRange = new Date(endOfDay.getTime() + 24 * 3600 * 1000);

  let query = supabase
    .from('matches')
    .select(`
      id, sport, league, home_team, away_team, start_time,
      ai_predictions (
        id, model_type, home_win_prob, draw_prob, away_win_prob,
        expected_home_goals, expected_away_goals,
        over_2_5_prob, under_2_5_prob, confidence, value_bets, computed_at
      )
    `)
    .gte('start_time', startOfDay.toISOString())
    .lte('start_time', endRange.toISOString())
    .order('start_time');

  if (filters.sport) {
    query = query.ilike('sport', `%${filters.sport}%`);
  }

  if (filters.limit) {
    query = query.limit(filters.limit);
  }

  const { data, error } = await query;
  if (error) {
    log.error('Error fetching matches with predictions', { error: error.message });
    return [];
  }

  // 데이터 변환: ai_predictions 배열 → 단일 prediction 객체
  return (data || []).map((m) => ({
    ...m,
    prediction: m.ai_predictions && m.ai_predictions.length > 0 ? m.ai_predictions[0] : null,
    ai_predictions: undefined,
  }));
}

/**
 * 현재 밸류 베팅 기회 목록.
 */
async function getValueBets(filters = {}) {
  const now = new Date().toISOString();

  let query = supabase
    .from('ai_predictions')
    .select(`
      match_id, value_bets, confidence, home_win_prob, draw_prob, away_win_prob,
      matches (id, sport, league, home_team, away_team, start_time)
    `)
    .not('value_bets', 'is', null)
    .gte('matches.start_time', now);

  const { data, error } = await query;
  if (error) {
    log.error('Error fetching value bets', { error: error.message });
    return [];
  }

  // Flatten
  const results = (data || [])
    .filter((d) => d.matches && d.value_bets && d.value_bets.length > 0)
    .map((d) => ({
      match_id: d.match_id,
      home_team: d.matches.home_team,
      away_team: d.matches.away_team,
      sport: d.matches.sport,
      league: d.matches.league,
      start_time: d.matches.start_time,
      confidence: d.confidence,
      value_bets: d.value_bets,
      top_edge: Math.max(...d.value_bets.map((vb) => vb.edge)),
    }));

  // top_edge 내림차순
  results.sort((a, b) => b.top_edge - a.top_edge);
  return filters.limit ? results.slice(0, filters.limit) : results;
}

module.exports = {
  generatePredictions,
  getPrediction,
  getMatchesWithPredictions,
  getValueBets,
};

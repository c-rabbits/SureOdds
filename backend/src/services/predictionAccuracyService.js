/**
 * Prediction Accuracy Service (Phase 2 Step 4)
 *
 * 경기 완료 후 AI 예측과 실제 결과를 비교하여 정확도를 추적.
 * Brier Score, 적중률, 밸류 베팅 ROI 등 계산.
 */

const supabase = require('../config/supabase');
const { createServiceLogger } = require('../config/logger');

const log = createServiceLogger('PredAccuracy');

/**
 * 실제 경기 결과에서 outcome 문자열 반환.
 */
function getActualOutcome(homeScore, awayScore) {
  if (homeScore > awayScore) return 'home_win';
  if (homeScore < awayScore) return 'away_win';
  return 'draw';
}

/**
 * 예측에서 가장 높은 확률의 outcome 반환.
 */
function getPredictedOutcome(prediction) {
  const { home_win_prob, draw_prob, away_win_prob } = prediction;
  if (home_win_prob >= draw_prob && home_win_prob >= away_win_prob) return 'home_win';
  if (away_win_prob >= draw_prob && away_win_prob >= home_win_prob) return 'away_win';
  return 'draw';
}

/**
 * Brier Score 계산: (predicted_prob - actual)^2
 * actual은 실제 일어난 결과면 1, 아니면 0.
 * 낮을수록 좋음 (0 = 완벽, 0.25 = 동전 던지기).
 */
function calculateBrierScore(prediction, actualOutcome) {
  const probs = {
    home_win: prediction.home_win_prob,
    draw: prediction.draw_prob,
    away_win: prediction.away_win_prob,
  };

  let brierSum = 0;
  for (const outcome of ['home_win', 'draw', 'away_win']) {
    const actual = outcome === actualOutcome ? 1 : 0;
    brierSum += Math.pow(probs[outcome] - actual, 2);
  }
  return Math.round((brierSum / 3) * 10000) / 10000;
}

/**
 * 밸류 베팅 수익률 계산.
 * 단위 배팅(1유닛) 기준: 적중 시 (odds-1), 미적중 시 -1.
 */
function calculateValueBetProfit(valueBets, actualOutcome) {
  if (!valueBets || valueBets.length === 0) return null;

  // 가장 높은 edge의 밸류 베팅
  const topBet = valueBets[0]; // already sorted by edge desc

  const outcomeMap = { home: 'home_win', draw: 'draw', away: 'away_win' };
  const betOutcomeKey = outcomeMap[topBet.outcome];
  const won = betOutcomeKey === actualOutcome;

  return {
    had_value_bet: true,
    value_bet_outcome: topBet.outcome,
    value_bet_odds: topBet.odds,
    value_bet_edge: topBet.edge,
    value_bet_profit: won ? Math.round((topBet.odds - 1) * 10000) / 10000 : -1,
  };
}

/**
 * 완료된 경기 중 아직 정확도가 계산되지 않은 건을 처리.
 */
async function processCompletedPredictions() {
  // 완료된 경기 + 예측이 있지만 accuracy가 없는 건 조회
  const { data: completed, error } = await supabase
    .from('matches')
    .select(`
      id, home_team, away_team, home_score, away_score, sport, league,
      ai_predictions (
        id, match_id, model_type, home_win_prob, draw_prob, away_win_prob,
        expected_home_goals, expected_away_goals, confidence, value_bets, computed_at
      )
    `)
    .eq('status', 'completed')
    .not('home_score', 'is', null)
    .not('away_score', 'is', null);

  if (error || !completed) {
    log.error('Error fetching completed matches for accuracy', { error: error?.message });
    return { processed: 0 };
  }

  // 이미 처리된 match_id 목록
  const { data: existing } = await supabase
    .from('prediction_accuracy')
    .select('match_id');

  const existingMatchIds = new Set((existing || []).map((e) => e.match_id));

  let processed = 0;
  let correct = 0;
  let totalBrier = 0;
  let valueBetWins = 0;
  let valueBetTotal = 0;

  for (const match of completed) {
    const predictions = match.ai_predictions || [];
    if (predictions.length === 0) continue;

    for (const pred of predictions) {
      // 이미 처리된 건 스킵
      if (existingMatchIds.has(match.id)) continue;

      const actualOutcome = getActualOutcome(match.home_score, match.away_score);
      const predictedOutcome = getPredictedOutcome(pred);
      const isCorrect = predictedOutcome === actualOutcome;
      const brierScore = calculateBrierScore(pred, actualOutcome);

      // 예측된 outcome의 확률
      const predProb = predictedOutcome === 'home_win' ? pred.home_win_prob
        : predictedOutcome === 'away_win' ? pred.away_win_prob
        : pred.draw_prob;

      const row = {
        match_id: match.id,
        model_type: pred.model_type,
        predicted_outcome: predictedOutcome,
        predicted_prob: predProb,
        predicted_home_goals: pred.expected_home_goals,
        predicted_away_goals: pred.expected_away_goals,
        actual_outcome: actualOutcome,
        actual_home_goals: match.home_score,
        actual_away_goals: match.away_score,
        correct: isCorrect,
        brier_score: brierScore,
        confidence: pred.confidence,
        had_value_bet: false,
      };

      // 밸류 베팅 결과
      const vbResult = calculateValueBetProfit(pred.value_bets, actualOutcome);
      if (vbResult) {
        Object.assign(row, vbResult);
        valueBetTotal++;
        if (vbResult.value_bet_profit > 0) valueBetWins++;
      }

      const { error: insertErr } = await supabase
        .from('prediction_accuracy')
        .upsert(row, { onConflict: 'match_id,model_type' });

      if (insertErr) {
        log.error('Error inserting accuracy', { matchId: match.id, error: insertErr.message });
        continue;
      }

      processed++;
      if (isCorrect) correct++;
      totalBrier += brierScore;
    }
  }

  const result = {
    processed,
    correct,
    accuracy: processed > 0 ? Math.round((correct / processed) * 10000) / 10000 : null,
    avgBrier: processed > 0 ? Math.round((totalBrier / processed) * 10000) / 10000 : null,
    valueBets: { total: valueBetTotal, wins: valueBetWins },
  };

  if (processed > 0) {
    log.info(`Accuracy processed: ${processed} matches, ${correct} correct (${(result.accuracy * 100).toFixed(1)}%), avg Brier: ${result.avgBrier}`);
  }

  return result;
}

/**
 * 정확도 통계 조회.
 * @param {Object} filters - { model_type, league, limit }
 */
async function getAccuracyStats(filters = {}) {
  let query = supabase
    .from('prediction_accuracy')
    .select(`
      *,
      matches (home_team, away_team, sport, league, start_time)
    `)
    .order('calculated_at', { ascending: false });

  if (filters.model_type) {
    query = query.eq('model_type', filters.model_type);
  }

  if (filters.limit) {
    query = query.limit(filters.limit);
  }

  const { data, error } = await query;
  if (error) {
    log.error('Error fetching accuracy stats', { error: error.message });
    return { records: [], summary: null };
  }

  const records = (data || []).filter((d) => d.matches);

  // 리그 필터 (join 후 필터)
  const filtered = filters.league
    ? records.filter((r) => r.matches.league === filters.league)
    : records;

  // 요약 통계 계산
  const total = filtered.length;
  if (total === 0) return { records: [], summary: null };

  const correctCount = filtered.filter((r) => r.correct).length;
  const avgBrier = filtered.reduce((s, r) => s + (r.brier_score || 0), 0) / total;
  const avgConfidence = filtered.reduce((s, r) => s + (r.confidence || 0), 0) / total;

  // 밸류 베팅 ROI
  const vbRecords = filtered.filter((r) => r.had_value_bet);
  const vbTotal = vbRecords.length;
  const vbProfit = vbRecords.reduce((s, r) => s + (r.value_bet_profit || 0), 0);
  const vbROI = vbTotal > 0 ? vbProfit / vbTotal : null;

  // 모델별 분류
  const byModel = {};
  for (const r of filtered) {
    if (!byModel[r.model_type]) {
      byModel[r.model_type] = { total: 0, correct: 0, brierSum: 0 };
    }
    byModel[r.model_type].total++;
    if (r.correct) byModel[r.model_type].correct++;
    byModel[r.model_type].brierSum += r.brier_score || 0;
  }

  const modelStats = Object.entries(byModel).map(([model, stats]) => ({
    model,
    total: stats.total,
    correct: stats.correct,
    accuracy: Math.round((stats.correct / stats.total) * 10000) / 10000,
    avgBrier: Math.round((stats.brierSum / stats.total) * 10000) / 10000,
  }));

  const summary = {
    total,
    correct: correctCount,
    accuracy: Math.round((correctCount / total) * 10000) / 10000,
    avgBrier: Math.round(avgBrier * 10000) / 10000,
    avgConfidence: Math.round(avgConfidence * 10000) / 10000,
    valueBets: {
      total: vbTotal,
      profit: Math.round(vbProfit * 100) / 100,
      roi: vbROI !== null ? Math.round(vbROI * 10000) / 10000 : null,
    },
    byModel: modelStats,
  };

  return { records: filtered, summary };
}

module.exports = {
  processCompletedPredictions,
  getAccuracyStats,
  getActualOutcome,
  getPredictedOutcome,
  calculateBrierScore,
};

/**
 * Poisson-based Football Match Prediction Model (Phase 1)
 *
 * Phase 1 전략: 팀 통계 없이 시장 배당(implied probability)에서 기대골 역산.
 * Pinnacle(가장 sharp한 북메이커) 배당을 기준으로, 다른 북메이커와 비교하여 밸류 발굴.
 */

const { createServiceLogger } = require('../config/logger');
const log = createServiceLogger('PoissonModel');

// ─── 수학 유틸리티 ───

/** 팩토리얼 (캐시 사용) */
const factorialCache = [1, 1];
function factorial(n) {
  if (n < 0) return 1;
  if (factorialCache[n] !== undefined) return factorialCache[n];
  let result = factorialCache[factorialCache.length - 1];
  for (let i = factorialCache.length; i <= n; i++) {
    result *= i;
    factorialCache[i] = result;
  }
  return result;
}

/** P(X = k) for Poisson distribution */
function poissonPmf(lambda, k) {
  if (lambda <= 0) return k === 0 ? 1 : 0;
  return Math.pow(lambda, k) * Math.exp(-lambda) / factorial(k);
}

// ─── 배당 → 확률 변환 ───

/**
 * 배당 배열에서 implied probability 계산 (overround 제거).
 * @param {number[]} oddsArray - [homeOdds, drawOdds, awayOdds] 또는 [homeOdds, awayOdds]
 * @returns {number[]} 정규화된 확률 배열
 */
function oddsToProbs(oddsArray) {
  const impliedProbs = oddsArray.map((o) => (o > 0 ? 1 / o : 0));
  const total = impliedProbs.reduce((s, p) => s + p, 0);
  if (total <= 0) return impliedProbs;
  return impliedProbs.map((p) => p / total);
}

// ─── 기대골 역산 (Poisson 기반) ───

/**
 * 승/무/패 확률에서 Poisson 파라미터(기대골) 역산.
 * Newton-Raphson 대신 그리드 서치로 최적 λ_home, λ_away 탐색.
 *
 * @param {number} homeWinProb - 홈 승리 확률
 * @param {number} drawProb - 무승부 확률
 * @param {number} awayWinProb - 원정 승리 확률
 * @returns {{ lambdaHome: number, lambdaAway: number }}
 */
function estimateGoalsFromProbs(homeWinProb, drawProb, awayWinProb) {
  let bestLH = 1.3;
  let bestLA = 1.1;
  let bestError = Infinity;

  // 그리드 서치: 0.3 ~ 3.5 범위
  for (let lh = 0.3; lh <= 3.5; lh += 0.1) {
    for (let la = 0.3; la <= 3.5; la += 0.1) {
      const probs = calculateFromLambdas(lh, la);
      const error =
        Math.pow(probs.homeWin - homeWinProb, 2) +
        Math.pow(probs.draw - drawProb, 2) +
        Math.pow(probs.awayWin - awayWinProb, 2);

      if (error < bestError) {
        bestError = error;
        bestLH = lh;
        bestLA = la;
      }
    }
  }

  // 미세 조정: ±0.1 범위에서 0.01 스텝
  const refineLH = bestLH;
  const refineLA = bestLA;
  for (let lh = refineLH - 0.1; lh <= refineLH + 0.1; lh += 0.01) {
    for (let la = refineLA - 0.1; la <= refineLA + 0.1; la += 0.01) {
      if (lh < 0.1 || la < 0.1) continue;
      const probs = calculateFromLambdas(lh, la);
      const error =
        Math.pow(probs.homeWin - homeWinProb, 2) +
        Math.pow(probs.draw - drawProb, 2) +
        Math.pow(probs.awayWin - awayWinProb, 2);

      if (error < bestError) {
        bestError = error;
        bestLH = lh;
        bestLA = la;
      }
    }
  }

  return { lambdaHome: Math.round(bestLH * 100) / 100, lambdaAway: Math.round(bestLA * 100) / 100 };
}

/**
 * λ_home, λ_away에서 승/무/패 확률 계산 (스코어 매트릭스 0-6).
 */
function calculateFromLambdas(lambdaHome, lambdaAway) {
  const MAX_GOALS = 7;
  let homeWin = 0;
  let draw = 0;
  let awayWin = 0;
  let over25 = 0;

  for (let h = 0; h < MAX_GOALS; h++) {
    for (let a = 0; a < MAX_GOALS; a++) {
      const prob = poissonPmf(lambdaHome, h) * poissonPmf(lambdaAway, a);
      if (h > a) homeWin += prob;
      else if (h === a) draw += prob;
      else awayWin += prob;

      if (h + a > 2.5) over25 += prob;
    }
  }

  return { homeWin, draw, awayWin, over25, under25: 1 - over25 };
}

// ─── 스코어 확률 매트릭스 ───

/**
 * 가장 가능성 높은 스코어라인 반환.
 */
function getMostLikelyScores(lambdaHome, lambdaAway, topN = 5) {
  const scores = [];
  for (let h = 0; h <= 5; h++) {
    for (let a = 0; a <= 5; a++) {
      const prob = poissonPmf(lambdaHome, h) * poissonPmf(lambdaAway, a);
      scores.push({ home: h, away: a, prob });
    }
  }
  scores.sort((a, b) => b.prob - a.prob);
  return scores.slice(0, topN);
}

// ─── 메인 예측 함수 ───

/**
 * 경기의 배당 데이터에서 AI 예측 생성.
 *
 * @param {Object} match - { id, sport, home_team, away_team, ... }
 * @param {Object[]} oddsRecords - [{ bookmaker, market_type, outcome_1_odds, outcome_2_odds, outcome_draw_odds }]
 * @returns {Object|null} 예측 결과 or null
 */
function computePrediction(match, oddsRecords) {
  // h2h 배당만 사용
  const h2hOdds = oddsRecords.filter(
    (o) => o.market_type === 'h2h' && o.outcome_1_odds > 1 && o.outcome_2_odds > 1
  );

  if (h2hOdds.length < 2) return null;

  // 축구 종목만 3-way (draw 포함), 나머지는 2-way
  const isSoccer = ['soccer', 'soccer_epl', 'soccer_spain_la_liga', 'soccer_germany_bundesliga',
    'soccer_italy_serie_a', 'soccer_france_ligue_one', 'soccer_uefa_champs_league',
    'soccer_uefa_europa_league'].some((s) => (match.sport || '').includes('soccer'));

  // Sharp 북메이커 우선 (pinnacle > betfair > 평균)
  const sharpBookmakers = ['pinnacle', 'betfair_ex_eu', 'betfair'];
  let referenceOdds = h2hOdds.find((o) => sharpBookmakers.includes(o.bookmaker));
  if (!referenceOdds) {
    // 평균 사용
    referenceOdds = averageOdds(h2hOdds, isSoccer);
  }

  if (!referenceOdds) return null;

  const homeOdds = referenceOdds.outcome_1_odds;
  const awayOdds = referenceOdds.outcome_2_odds;
  const drawOdds = referenceOdds.outcome_draw_odds;

  let homeWinProb, drawProb, awayWinProb, lambdaHome, lambdaAway, over25Prob, under25Prob;

  if (isSoccer && drawOdds && drawOdds > 1) {
    // 3-way: 홈/무/원정
    const probs = oddsToProbs([homeOdds, drawOdds, awayOdds]);
    homeWinProb = probs[0];
    drawProb = probs[1];
    awayWinProb = probs[2];

    // Poisson λ 역산
    const { lambdaHome: lh, lambdaAway: la } = estimateGoalsFromProbs(homeWinProb, drawProb, awayWinProb);
    lambdaHome = lh;
    lambdaAway = la;

    const poissonProbs = calculateFromLambdas(lambdaHome, lambdaAway);
    over25Prob = poissonProbs.over25;
    under25Prob = poissonProbs.under25;
  } else {
    // 2-way: 홈/원정 (농구, 야구, 하키 등)
    const probs = oddsToProbs([homeOdds, awayOdds]);
    homeWinProb = probs[0];
    drawProb = 0;
    awayWinProb = probs[1];
    lambdaHome = null;
    lambdaAway = null;
    over25Prob = null;
    under25Prob = null;
  }

  // 모델 신뢰도: 북메이커 수 기반 (많을수록 합의가 강함)
  const confidence = Math.min(1, h2hOdds.length / 8);

  // 밸류 분석
  const valueBets = findValueBets(
    { homeWinProb, drawProb, awayWinProb, over25Prob },
    h2hOdds,
    match,
    isSoccer
  );

  return {
    match_id: match.id,
    model_type: 'poisson_v1',
    home_win_prob: round4(homeWinProb),
    draw_prob: round4(drawProb),
    away_win_prob: round4(awayWinProb),
    expected_home_goals: lambdaHome,
    expected_away_goals: lambdaAway,
    over_2_5_prob: over25Prob !== null ? round4(over25Prob) : null,
    under_2_5_prob: under25Prob !== null ? round4(under25Prob) : null,
    confidence: round4(confidence),
    value_bets: valueBets.length > 0 ? valueBets : null,
  };
}

/**
 * 여러 북메이커의 배당 평균 계산.
 */
function averageOdds(h2hOdds, isSoccer) {
  const sum1 = h2hOdds.reduce((s, o) => s + o.outcome_1_odds, 0);
  const sum2 = h2hOdds.reduce((s, o) => s + o.outcome_2_odds, 0);
  const n = h2hOdds.length;

  const result = {
    outcome_1_odds: sum1 / n,
    outcome_2_odds: sum2 / n,
    outcome_draw_odds: null,
    bookmaker: 'consensus',
  };

  if (isSoccer) {
    const drawOdds = h2hOdds.filter((o) => o.outcome_draw_odds && o.outcome_draw_odds > 1);
    if (drawOdds.length > 0) {
      result.outcome_draw_odds = drawOdds.reduce((s, o) => s + o.outcome_draw_odds, 0) / drawOdds.length;
    }
  }

  return result;
}

/**
 * AI 확률 vs 각 북메이커 implied 확률 비교 → 밸류 기회 필터.
 * edge > 3% 인 경우만 반환.
 */
function findValueBets(prediction, h2hOdds, match, isSoccer) {
  const EDGE_THRESHOLD = 0.03; // 3%
  const valueBets = [];

  for (const odds of h2hOdds) {
    // 홈 승
    if (odds.outcome_1_odds > 1) {
      const marketProb = 1 / odds.outcome_1_odds;
      const edge = prediction.homeWinProb - marketProb;
      if (edge > EDGE_THRESHOLD) {
        valueBets.push({
          outcome: 'home',
          outcome_label: '홈승',
          ai_prob: round4(prediction.homeWinProb),
          market_prob: round4(marketProb),
          edge: round4(edge),
          odds: odds.outcome_1_odds,
          bookmaker: odds.bookmaker,
        });
      }
    }

    // 무승부 (축구만)
    if (isSoccer && odds.outcome_draw_odds > 1 && prediction.drawProb > 0) {
      const marketProb = 1 / odds.outcome_draw_odds;
      const edge = prediction.drawProb - marketProb;
      if (edge > EDGE_THRESHOLD) {
        valueBets.push({
          outcome: 'draw',
          outcome_label: '무승부',
          ai_prob: round4(prediction.drawProb),
          market_prob: round4(marketProb),
          edge: round4(edge),
          odds: odds.outcome_draw_odds,
          bookmaker: odds.bookmaker,
        });
      }
    }

    // 원정 승
    if (odds.outcome_2_odds > 1) {
      const marketProb = 1 / odds.outcome_2_odds;
      const edge = prediction.awayWinProb - marketProb;
      if (edge > EDGE_THRESHOLD) {
        valueBets.push({
          outcome: 'away',
          outcome_label: '원정승',
          ai_prob: round4(prediction.awayWinProb),
          market_prob: round4(marketProb),
          edge: round4(edge),
          odds: odds.outcome_2_odds,
          bookmaker: odds.bookmaker,
        });
      }
    }
  }

  // edge 내림차순 정렬
  valueBets.sort((a, b) => b.edge - a.edge);
  return valueBets;
}

function round4(n) {
  return Math.round(n * 10000) / 10000;
}

module.exports = {
  computePrediction,
  poissonPmf,
  oddsToProbs,
  calculateFromLambdas,
  estimateGoalsFromProbs,
  getMostLikelyScores,
  findValueBets,
};

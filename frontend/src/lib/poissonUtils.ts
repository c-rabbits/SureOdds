/**
 * Poisson Distribution Utilities
 * AI 예측 상세 페이지에서 스코어 매트릭스, O/U, 핸디캡, BTTS 확률 계산에 사용.
 */

/** Poisson PMF: P(X = k) given λ */
export function poissonPmf(k: number, lambda: number): number {
  if (lambda <= 0) return k === 0 ? 1 : 0;
  let result = Math.exp(-lambda);
  for (let i = 1; i <= k; i++) {
    result *= lambda / i;
  }
  return result;
}

/** Poisson CDF: P(X <= k) given λ */
export function poissonCdf(k: number, lambda: number): number {
  let sum = 0;
  for (let i = 0; i <= k; i++) {
    sum += poissonPmf(i, lambda);
  }
  return sum;
}

/** Score probability matrix (homeGoals x awayGoals), each cell = P(home=i, away=j) */
export function scoreMatrix(homeLambda: number, awayLambda: number, maxGoals = 5): number[][] {
  const matrix: number[][] = [];
  for (let i = 0; i < maxGoals; i++) {
    const row: number[] = [];
    for (let j = 0; j < maxGoals; j++) {
      row.push(poissonPmf(i, homeLambda) * poissonPmf(j, awayLambda));
    }
    matrix.push(row);
  }
  return matrix;
}

/** Most likely score from matrix */
export function mostLikelyScore(homeLambda: number, awayLambda: number, maxGoals = 5): { home: number; away: number; prob: number } {
  let best = { home: 0, away: 0, prob: 0 };
  for (let i = 0; i < maxGoals; i++) {
    for (let j = 0; j < maxGoals; j++) {
      const p = poissonPmf(i, homeLambda) * poissonPmf(j, awayLambda);
      if (p > best.prob) best = { home: i, away: j, prob: p };
    }
  }
  return best;
}

/** Over/Under probabilities for a given line (e.g., 1.5, 2.5, 3.5) */
export function overUnderProbs(homeLambda: number, awayLambda: number, line: number): { over: number; under: number } {
  const maxGoals = 10;
  let under = 0;
  for (let i = 0; i <= maxGoals; i++) {
    for (let j = 0; j <= maxGoals; j++) {
      if (i + j < line) {
        under += poissonPmf(i, homeLambda) * poissonPmf(j, awayLambda);
      }
    }
  }
  return { over: 1 - under, under };
}

/** Handicap cover probability. handicap is applied to home team.
 *  e.g., handicap = -1.5 means home must win by 2+ goals */
export function handicapCoverProb(homeLambda: number, awayLambda: number, handicap: number): { home: number; away: number } {
  const maxGoals = 10;
  let homeCover = 0;
  for (let i = 0; i <= maxGoals; i++) {
    for (let j = 0; j <= maxGoals; j++) {
      const diff = i - j + handicap;
      if (diff > 0) {
        homeCover += poissonPmf(i, homeLambda) * poissonPmf(j, awayLambda);
      }
    }
  }
  return { home: homeCover, away: 1 - homeCover };
}

/** Both Teams To Score probability */
export function bttsProb(homeLambda: number, awayLambda: number): number {
  const homeScores = 1 - poissonPmf(0, homeLambda); // P(home >= 1)
  const awayScores = 1 - poissonPmf(0, awayLambda); // P(away >= 1)
  return homeScores * awayScores;
}

/**
 * Team Strength Model (Phase 2 Step 3)
 *
 * 팀 통계(ELO, 공격/수비 레이팅, 폼) 기반 기대골 산출.
 * Poisson 시장 모델과 블렌딩하여 하이브리드 예측 생성.
 */

const supabase = require('../config/supabase');
const { createServiceLogger } = require('../config/logger');

const log = createServiceLogger('TeamStrength');

// 리그별 평균 총 득점 (홈+원정 합산, 시즌 기반)
const LEAGUE_AVG_TOTAL_GOALS = {
  'Premier League': 2.75,
  'La Liga': 2.55,
  'Bundesliga': 3.05,
  'Serie A': 2.60,
  'Ligue 1': 2.55,
  default: 2.70,
};

const HOME_ADVANTAGE_FACTOR = 1.10; // 홈팀 10% 골 부스트

/**
 * 두 팀의 team_stats 조회.
 * @param {string} homeTeam
 * @param {string} awayTeam
 * @returns {{ home: Object|null, away: Object|null }}
 */
async function getTeamStatsForMatch(homeTeam, awayTeam) {
  const { data, error } = await supabase
    .from('team_stats')
    .select('*')
    .in('team_name', [homeTeam, awayTeam]);

  if (error || !data) return { home: null, away: null };

  const home = data.find((t) => t.team_name === homeTeam) || null;
  const away = data.find((t) => t.team_name === awayTeam) || null;
  return { home, away };
}

/**
 * 여러 팀의 team_stats 벌크 조회.
 * @param {string[]} teamNames
 * @returns {Map<string, Object>}
 */
async function bulkGetTeamStats(teamNames) {
  const unique = [...new Set(teamNames)];
  if (unique.length === 0) return new Map();

  const { data, error } = await supabase
    .from('team_stats')
    .select('*')
    .in('team_name', unique);

  if (error || !data) return new Map();

  const map = new Map();
  for (const row of data) {
    map.set(row.team_name, row);
  }
  return map;
}

/**
 * 팀 통계 기반 기대골(λ) 계산.
 *
 * 모델:
 *   λ_home = home.attack × away.defense × league_avg_per_team × home_advantage
 *   λ_away = away.attack × home.defense × league_avg_per_team
 *
 * attack_rating > 1 = 리그 평균 이상 공격력
 * defense_rating > 1 = 리그 평균 이상 실점 (약한 수비)
 * defense_rating < 1 = 리그 평균 이하 실점 (강한 수비)
 *
 * @param {Object} homeStats - team_stats row
 * @param {Object} awayStats - team_stats row
 * @returns {{ lambdaHome, lambdaAway, eloDiff, eloHomeWinProb }}
 */
function deriveGoalExpectations(homeStats, awayStats) {
  const league = homeStats.league || 'default';
  const avgTotalGoals = LEAGUE_AVG_TOTAL_GOALS[league] || LEAGUE_AVG_TOTAL_GOALS.default;
  const avgGoalsPerTeam = avgTotalGoals / 2;

  // attack/defense rating이 없으면 1.0 (리그 평균) 사용
  const homeAttack = homeStats.attack_rating || 1.0;
  const homeDefense = homeStats.defense_rating || 1.0;
  const awayAttack = awayStats.attack_rating || 1.0;
  const awayDefense = awayStats.defense_rating || 1.0;

  // 기대골 계산
  let lambdaHome = homeAttack * awayDefense * avgGoalsPerTeam * HOME_ADVANTAGE_FACTOR;
  let lambdaAway = awayAttack * homeDefense * avgGoalsPerTeam;

  // 범위 제한 (0.3 ~ 3.5)
  lambdaHome = Math.max(0.3, Math.min(3.5, lambdaHome));
  lambdaAway = Math.max(0.3, Math.min(3.5, lambdaAway));

  // ELO 기반 보정
  const homeElo = homeStats.elo_rating || 1500;
  const awayElo = awayStats.elo_rating || 1500;
  const eloDiff = homeElo - awayElo;
  const eloHomeWinProb = 1 / (1 + Math.pow(10, -eloDiff / 400));

  // ELO 차이가 크면 기대골에 미세 보정 적용 (±10% 까지)
  const eloAdjustment = Math.max(-0.1, Math.min(0.1, eloDiff / 2000));
  lambdaHome *= (1 + eloAdjustment);
  lambdaAway *= (1 - eloAdjustment);

  return {
    lambdaHome: Math.round(lambdaHome * 100) / 100,
    lambdaAway: Math.round(lambdaAway * 100) / 100,
    eloDiff: Math.round(eloDiff),
    eloHomeWinProb: Math.round(eloHomeWinProb * 10000) / 10000,
  };
}

/**
 * 폼 스트링에서 최근 성적 점수 계산.
 * "WWDLW" → 0.73 (W=1, D=0.5, L=0, 평균)
 */
function formToScore(formStr) {
  if (!formStr || formStr.length === 0) return 0.5;
  let total = 0;
  let count = 0;
  for (const c of formStr) {
    if (c === 'W') { total += 1; count++; }
    else if (c === 'D') { total += 0.5; count++; }
    else if (c === 'L') { total += 0; count++; }
  }
  return count > 0 ? total / count : 0.5;
}

module.exports = {
  getTeamStatsForMatch,
  bulkGetTeamStats,
  deriveGoalExpectations,
  formToScore,
  LEAGUE_AVG_TOTAL_GOALS,
};

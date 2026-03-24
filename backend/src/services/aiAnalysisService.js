/**
 * AI Analysis Service
 * Claude API를 활용한 심층 경기 분석 보고서 생성.
 *
 * 기존 데이터(Poisson 모델, ELO, 팀 통계, 배당, H2H)를 구조화된 프롬프트로
 * Claude에게 전달하여 전문 분석가 수준의 한국어 리포트 생성.
 */

const Anthropic = require('@anthropic-ai/sdk').default;
const supabase = require('../config/supabase');
const { computePrediction, calculateFromLambdas, getMostLikelyScores, poissonPmf } = require('./poissonModel');
const { bulkGetTeamStats, deriveGoalExpectations, formToScore } = require('./teamStrengthModel');
const { createServiceLogger } = require('../config/logger');

const log = createServiceLogger('AiAnalysis');

// Claude 클라이언트 (환경변수에서 키 로드)
let anthropic = null;
function getClient() {
  if (!anthropic) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY 환경변수가 설정되지 않았습니다');
    anthropic = new Anthropic({ apiKey });
  }
  return anthropic;
}

// ─── 분석 캐시 (DB 저장) ───

/**
 * 캐시된 분석 조회. 6시간 이내면 재사용.
 */
async function getCachedAnalysis(matchId) {
  const { data, error } = await supabase
    .from('ai_analysis_reports')
    .select('*')
    .eq('match_id', matchId)
    .order('created_at', { ascending: false })
    .limit(1);

  if (error || !data || data.length === 0) return null;

  const report = data[0];
  const age = Date.now() - new Date(report.created_at).getTime();
  const SIX_HOURS = 6 * 3600 * 1000;

  if (age > SIX_HOURS) return null; // 만료
  return report;
}

/**
 * 분석 보고서 DB 저장.
 */
async function saveAnalysis(matchId, report) {
  const { error } = await supabase
    .from('ai_analysis_reports')
    .upsert({
      match_id: matchId,
      report_data: report,
      model_used: 'claude-sonnet',
      created_at: new Date().toISOString(),
    }, { onConflict: 'match_id' });

  if (error) {
    log.error('Failed to save analysis report', { matchId, error: error.message });
  }
}

// ─── 경기 데이터 수집 ───

/**
 * 경기에 필요한 모든 데이터를 수집하여 구조화.
 */
async function gatherMatchData(matchId) {
  // 1. 경기 기본 정보
  const { data: match, error: mErr } = await supabase
    .from('matches')
    .select('*')
    .eq('id', matchId)
    .single();

  if (mErr || !match) throw new Error(`경기를 찾을 수 없습니다: ${matchId}`);

  // 2. 배당 데이터
  const { data: odds } = await supabase
    .from('odds')
    .select('*')
    .eq('match_id', matchId);

  // 3. 팀 통계
  const teamStatsMap = await bulkGetTeamStats([match.home_team, match.away_team]);
  const homeStats = teamStatsMap.get(match.home_team) || null;
  const awayStats = teamStatsMap.get(match.away_team) || null;

  // 4. AI 예측 (기존 Poisson 결과)
  const { data: prediction } = await supabase
    .from('ai_predictions')
    .select('*')
    .eq('match_id', matchId)
    .order('computed_at', { ascending: false })
    .limit(1);

  // 5. H2H 직접 대결 기록 (같은 두 팀 과거 경기)
  const { data: h2hMatches } = await supabase
    .from('matches')
    .select('id, home_team, away_team, home_score, away_score, start_time, status')
    .or(`and(home_team.eq.${match.home_team},away_team.eq.${match.away_team}),and(home_team.eq.${match.away_team},away_team.eq.${match.home_team})`)
    .neq('id', matchId)
    .eq('status', 'completed')
    .order('start_time', { ascending: false })
    .limit(10);

  // 6. 배당 변동 이력
  const { data: oddsHistory } = await supabase
    .from('odds_history')
    .select('*')
    .eq('match_id', matchId)
    .order('recorded_at', { ascending: true });

  // 7. Poisson 스코어 매트릭스 계산
  let scoreMatrix = null;
  let overUnder = null;
  let btts = null;
  let handicaps = null;

  const pred = prediction?.[0];
  if (pred && pred.expected_home_goals && pred.expected_away_goals) {
    const lh = pred.expected_home_goals;
    const la = pred.expected_away_goals;

    // 스코어 매트릭스
    scoreMatrix = getMostLikelyScores(lh, la, 10);

    // O/U 다양한 라인
    const probs = calculateFromLambdas(lh, la);
    const MAX = 7;
    let over15 = 0, over25 = 0, over35 = 0;
    for (let h = 0; h < MAX; h++) {
      for (let a = 0; a < MAX; a++) {
        const p = poissonPmf(lh, h) * poissonPmf(la, a);
        if (h + a > 1.5) over15 += p;
        if (h + a > 2.5) over25 += p;
        if (h + a > 3.5) over35 += p;
      }
    }
    overUnder = {
      'over_1.5': round(over15), 'under_1.5': round(1 - over15),
      'over_2.5': round(over25), 'under_2.5': round(1 - over25),
      'over_3.5': round(over35), 'under_3.5': round(1 - over35),
    };

    // BTTS
    const noHomeGoal = poissonPmf(lh, 0);
    const noAwayGoal = poissonPmf(la, 0);
    const bttsProb = 1 - noHomeGoal - noAwayGoal + (noHomeGoal * noAwayGoal);
    btts = { yes: round(bttsProb), no: round(1 - bttsProb) };

    // 핸디캡 분석
    handicaps = {};
    for (const line of [-1.5, -0.5, 0.5, 1.5]) {
      let homeCover = 0;
      for (let h = 0; h < MAX; h++) {
        for (let a = 0; a < MAX; a++) {
          const p = poissonPmf(lh, h) * poissonPmf(la, a);
          if ((h - a) > line) homeCover += p;
        }
      }
      handicaps[`home_${line > 0 ? '+' : ''}${line}`] = round(homeCover);
      handicaps[`away_${line > 0 ? '+' : ''}${line}`] = round(1 - homeCover);
    }
  }

  return {
    match,
    odds: odds || [],
    homeStats,
    awayStats,
    prediction: pred || null,
    h2hMatches: h2hMatches || [],
    oddsHistory: oddsHistory || [],
    scoreMatrix,
    overUnder,
    btts,
    handicaps,
  };
}

// ─── Claude 프롬프트 구성 ───

function buildAnalysisPrompt(data) {
  const { match, odds, homeStats, awayStats, prediction, h2hMatches, scoreMatrix, overUnder, btts, handicaps } = data;

  const h2hOdds = odds.filter(o => o.market_type === 'h2h');
  const spreadOdds = odds.filter(o => o.market_type === 'spreads');

  // 북메이커별 배당 정리
  const oddsTable = h2hOdds.map(o =>
    `${o.bookmaker}: 홈 ${o.outcome_1_odds} / 무 ${o.outcome_draw_odds || '-'} / 원정 ${o.outcome_2_odds}`
  ).join('\n');

  // H2H 기록 정리
  const h2hTable = h2hMatches.map(m => {
    const isHomeFirst = m.home_team === match.home_team;
    return `${new Date(m.start_time).toLocaleDateString('ko-KR')}: ${m.home_team} ${m.home_score}-${m.away_score} ${m.away_team}`;
  }).join('\n');

  // 팀 통계 정리
  const homeStatsStr = homeStats ? `
ELO: ${homeStats.elo_rating}, 공격력: ${homeStats.attack_rating?.toFixed(2)}, 수비력: ${homeStats.defense_rating?.toFixed(2)}
최근 폼: ${homeStats.form_last5 || '없음'} (점수: ${formToScore(homeStats.form_last5).toFixed(2)})
경기수: ${homeStats.matches_played}, 득점: ${homeStats.goals_scored}, 실점: ${homeStats.goals_conceded}
평균 득점: ${homeStats.avg_goals_scored?.toFixed(2)}, 평균 실점: ${homeStats.avg_goals_conceded?.toFixed(2)}` : '통계 없음';

  const awayStatsStr = awayStats ? `
ELO: ${awayStats.elo_rating}, 공격력: ${awayStats.attack_rating?.toFixed(2)}, 수비력: ${awayStats.defense_rating?.toFixed(2)}
최근 폼: ${awayStats.form_last5 || '없음'} (점수: ${formToScore(awayStats.form_last5).toFixed(2)})
경기수: ${awayStats.matches_played}, 득점: ${awayStats.goals_scored}, 실점: ${awayStats.goals_conceded}
평균 득점: ${awayStats.avg_goals_scored?.toFixed(2)}, 평균 실점: ${awayStats.avg_goals_conceded?.toFixed(2)}` : '통계 없음';

  // 예측 데이터 정리
  const predStr = prediction ? `
모델: ${prediction.model_type}
승무패 확률: 홈 ${(prediction.home_win_prob * 100).toFixed(1)}% / 무 ${(prediction.draw_prob * 100).toFixed(1)}% / 원정 ${(prediction.away_win_prob * 100).toFixed(1)}%
기대골: 홈 ${prediction.expected_home_goals} / 원정 ${prediction.expected_away_goals}
모델 일치도: ${prediction.model_agreement ? (prediction.model_agreement * 100).toFixed(0) + '%' : 'N/A'}
신뢰도: ${(prediction.confidence * 100).toFixed(0)}%
밸류베팅: ${prediction.value_bets ? prediction.value_bets.map(v => `${v.outcome_label} @${v.odds} (엣지 ${(v.edge * 100).toFixed(1)}%)`).join(', ') : '없음'}` : '예측 없음';

  // 스코어 매트릭스 정리
  const scoreStr = scoreMatrix ?
    scoreMatrix.slice(0, 5).map(s => `${s.home}-${s.away}: ${(s.prob * 100).toFixed(1)}%`).join(', ') : '없음';

  // O/U 정리
  const ouStr = overUnder ?
    `O1.5: ${(overUnder['over_1.5'] * 100).toFixed(0)}% | O2.5: ${(overUnder['over_2.5'] * 100).toFixed(0)}% | O3.5: ${(overUnder['over_3.5'] * 100).toFixed(0)}%` : '없음';

  // BTTS 정리
  const bttsStr = btts ? `YES ${(btts.yes * 100).toFixed(0)}% / NO ${(btts.no * 100).toFixed(0)}%` : '없음';

  // 핸디캡 정리
  const hcapStr = handicaps ? Object.entries(handicaps).map(([k, v]) => `${k}: ${(v * 100).toFixed(0)}%`).join(' | ') : '없음';

  return `당신은 전문 축구 분석가입니다. 아래 데이터를 기반으로 경기 심층 분석 보고서를 JSON 형식으로 작성하세요.

## 경기 정보
- 리그: ${match.league}
- 홈: ${match.home_team} vs 원정: ${match.away_team}
- 시간: ${new Date(match.start_time).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}

## 배당 데이터
${oddsTable || '없음'}

## 홈팀 (${match.home_team}) 통계
${homeStatsStr}

## 원정팀 (${match.away_team}) 통계
${awayStatsStr}

## AI 모델 예측 (Poisson Hybrid)
${predStr}

## 예상 스코어 TOP 5
${scoreStr}

## 오버/언더
${ouStr}

## 양팀득점 (BTTS)
${bttsStr}

## 핸디캡 분석
${hcapStr}

## H2H 직접 대결 기록 (최근 ${h2hMatches.length}경기)
${h2hTable || '기록 없음'}

---

다음 JSON 구조로 분석 보고서를 작성하세요. 모든 텍스트는 한국어로 작성합니다.

{
  "match_summary": "경기 개요 (2-3문장, 양 팀의 현재 상황과 이번 경기의 핵심 포인트)",

  "home_team_analysis": {
    "form_summary": "최근 폼 분석 (2-3문장)",
    "strengths": ["강점1", "강점2"],
    "weaknesses": ["약점1", "약점2"],
    "key_factors": "이번 경기에서 주목할 포인트"
  },

  "away_team_analysis": {
    "form_summary": "최근 폼 분석 (2-3문장)",
    "strengths": ["강점1", "강점2"],
    "weaknesses": ["약점1", "약점2"],
    "key_factors": "이번 경기에서 주목할 포인트"
  },

  "h2h_analysis": "H2H 직접 대결 분석 (기록이 있으면 트렌드 분석, 없으면 '직접 대결 기록 없음')",

  "key_metrics": {
    "home_form_label": "최근 폼 요약 (예: '4경기 무패')",
    "away_form_label": "최근 폼 요약",
    "h2h_trend": "H2H 트렌드 요약 (예: '최근 5경기 홈팀 3승')",
    "avg_goals": "H2H 평균 골 (예: '2.89골')"
  },

  "probability_analysis": {
    "model_confidence": "모델 신뢰도 평가 (높음/중간/낮음 + 이유)",
    "market_vs_model": "시장 배당 vs AI 모델 비교 분석",
    "value_assessment": "밸류베팅 평가 (있으면 구체적 분석)"
  },

  "market_analysis": {
    "handicap_pick": {
      "pick": "핸디캡 추천 (예: '홈 -0.5')",
      "confidence_stars": 4,
      "reasoning": "추천 이유 (2-3문장)"
    },
    "over_under_pick": {
      "pick": "오버/언더 추천 (예: '오버 2.5')",
      "confidence_stars": 3,
      "reasoning": "추천 이유"
    },
    "btts_pick": {
      "pick": "BTTS 추천 (YES/NO)",
      "confidence_stars": 3,
      "reasoning": "추천 이유"
    }
  },

  "betting_picks": {
    "main_pick": {
      "label": "메인 픽 (예: '홈 승 또는 무')",
      "odds": 1.85,
      "confidence": "81%",
      "reasoning": "핵심 추천 이유 (2-3문장)"
    },
    "secondary_pick": {
      "label": "보조 픽",
      "odds": 1.49,
      "confidence": "56%",
      "reasoning": "보조 추천 이유"
    },
    "alternative_pick": {
      "label": "대안 픽",
      "odds": 2.02,
      "confidence": "52%",
      "reasoning": "대안 추천 이유"
    }
  },

  "predicted_score": {
    "home": 1,
    "away": 0,
    "reasoning": "예상 스코어 근거"
  },

  "risk_warning": "주의사항 및 변수 (부상, 날씨, 동기부여 등 고려할 요소)",

  "overall_confidence": "전체 분석 신뢰도 (상/중/하 + 한 줄 이유)"
}

중요:
- 반드시 유효한 JSON만 출력하세요. 추가 텍스트 없이 JSON만 반환합니다.
- 배당과 확률 데이터를 기반으로 합리적인 분석을 하세요.
- 데이터가 부족한 부분은 "데이터 부족"으로 표시하세요.
- 과대 확신하지 말고 현실적으로 분석하세요.
- confidence_stars는 1-5 사이 정수입니다.`;
}

// ─── 메인 분석 함수 ───

/**
 * 경기 AI 분석 보고서 생성.
 * 캐시 확인 → 없으면 데이터 수집 → Claude API 호출 → 저장.
 */
async function generateAnalysis(matchId, forceRefresh = false) {
  // 1. 캐시 확인
  if (!forceRefresh) {
    const cached = await getCachedAnalysis(matchId);
    if (cached) {
      log.info(`Using cached analysis for match ${matchId}`);
      return cached.report_data;
    }
  }

  // 2. 데이터 수집
  log.info(`Gathering data for match ${matchId}`);
  const matchData = await gatherMatchData(matchId);

  // 3. 프롬프트 구성
  const prompt = buildAnalysisPrompt(matchData);

  // 4. Claude API 호출
  log.info(`Calling Claude API for match ${matchId}`);
  const client = getClient();
  const message = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    messages: [{ role: 'user', content: prompt }],
  });

  // 5. 응답 파싱
  const responseText = message.content[0].text;
  let report;
  try {
    // JSON 블록 추출 (```json ... ``` 또는 순수 JSON)
    const jsonMatch = responseText.match(/```json\s*([\s\S]*?)```/) ||
                      responseText.match(/(\{[\s\S]*\})/);
    report = JSON.parse(jsonMatch ? jsonMatch[1] : responseText);
  } catch (parseErr) {
    log.error('Failed to parse Claude response', { error: parseErr.message });
    throw new Error('AI 응답 파싱 실패');
  }

  // 6. 기존 수치 데이터 보강
  report._raw = {
    prediction: matchData.prediction,
    scoreMatrix: matchData.scoreMatrix,
    overUnder: matchData.overUnder,
    btts: matchData.btts,
    handicaps: matchData.handicaps,
    homeStats: matchData.homeStats,
    awayStats: matchData.awayStats,
    h2hMatches: matchData.h2hMatches,
    odds: matchData.odds,
    match: {
      id: matchData.match.id,
      sport: matchData.match.sport,
      league: matchData.match.league,
      home_team: matchData.match.home_team,
      away_team: matchData.match.away_team,
      start_time: matchData.match.start_time,
    },
  };

  // 7. DB 저장
  await saveAnalysis(matchId, report);

  log.info(`Analysis generated for match ${matchId}`, {
    tokens_in: message.usage?.input_tokens,
    tokens_out: message.usage?.output_tokens,
  });

  return report;
}

/**
 * 여러 경기 일괄 분석 생성 (관리자 배치 처리).
 */
async function batchGenerateAnalyses(matchIds) {
  const results = [];
  for (const id of matchIds) {
    try {
      const report = await generateAnalysis(id);
      results.push({ matchId: id, success: true, report });
    } catch (err) {
      log.error(`Batch analysis failed for match ${id}`, { error: err.message });
      results.push({ matchId: id, success: false, error: err.message });
    }
  }
  return results;
}

/**
 * 분석 가능한 경기 목록 (예측 데이터가 있는 오늘~내일 경기).
 */
async function getAnalyzableMatches() {
  const now = new Date();
  const twoDaysLater = new Date(now.getTime() + 48 * 3600 * 1000);

  const { data: matches } = await supabase
    .from('matches')
    .select(`
      id, sport, league, home_team, away_team, start_time,
      ai_predictions (id, home_win_prob, draw_prob, away_win_prob, confidence, value_bets, computed_at)
    `)
    .ilike('sport', '%soccer%')
    .gte('start_time', now.toISOString())
    .lte('start_time', twoDaysLater.toISOString())
    .order('start_time');

  if (!matches) return [];

  // 분석 캐시 확인
  const matchIds = matches.map(m => m.id);
  const { data: existingReports } = await supabase
    .from('ai_analysis_reports')
    .select('match_id, created_at')
    .in('match_id', matchIds);

  const reportMap = new Map((existingReports || []).map(r => [r.match_id, r.created_at]));

  return matches.map(m => ({
    id: m.id,
    sport: m.sport,
    league: m.league,
    home_team: m.home_team,
    away_team: m.away_team,
    start_time: m.start_time,
    has_prediction: m.ai_predictions && m.ai_predictions.length > 0,
    prediction: m.ai_predictions?.[0] || null,
    has_analysis: reportMap.has(m.id),
    analysis_at: reportMap.get(m.id) || null,
  }));
}

function round(n) {
  return Math.round(n * 10000) / 10000;
}

module.exports = {
  generateAnalysis,
  batchGenerateAnalyses,
  getAnalyzableMatches,
  getCachedAnalysis,
};

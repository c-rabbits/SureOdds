/**
 * Odds History Service
 * 배당 변동 스냅샷 저장 및 조회.
 */

const supabase = require('../config/supabase');
const { createServiceLogger } = require('../config/logger');

const log = createServiceLogger('OddsHistory');

/**
 * 현재 배당 데이터를 odds_history에 INSERT.
 * odds upsert 후 호출 — 변동 여부 무관하게 스냅샷 저장.
 * @param {Object[]} oddsRows - [{ match_id, bookmaker, bookmaker_title, market_type, handicap_point, outcome_1_odds, outcome_2_odds, outcome_draw_odds, source_type }]
 */
async function saveOddsSnapshot(oddsRows) {
  if (!oddsRows || oddsRows.length === 0) return;

  const historyRows = oddsRows.map((o) => ({
    match_id: o.match_id,
    bookmaker: o.bookmaker,
    bookmaker_title: o.bookmaker_title || null,
    market_type: o.market_type || 'h2h',
    handicap_point: o.handicap_point ?? 0,
    outcome_1_odds: o.outcome_1_odds,
    outcome_2_odds: o.outcome_2_odds,
    outcome_draw_odds: o.outcome_draw_odds || null,
    source_type: o.source_type || 'international',
  }));

  // 배치 INSERT (100개씩)
  const BATCH = 100;
  let inserted = 0;
  for (let i = 0; i < historyRows.length; i += BATCH) {
    const batch = historyRows.slice(i, i + BATCH);
    const { error } = await supabase.from('odds_history').insert(batch);
    if (error) {
      log.error('Error inserting odds_history batch', { error: error.message });
    } else {
      inserted += batch.length;
    }
  }

  if (inserted > 0) {
    log.info(`Saved ${inserted} odds history snapshots`);
  }
}

/**
 * 특정 경기의 배당 히스토리 조회 (시계열).
 * @param {string} matchId
 * @param {Object} [filters]
 * @param {string} [filters.bookmaker]
 * @param {string} [filters.marketType]
 * @returns {Object[]} 시계열 데이터
 */
async function getOddsHistory(matchId, filters = {}) {
  let query = supabase
    .from('odds_history')
    .select('*')
    .eq('match_id', matchId)
    .order('recorded_at', { ascending: true });

  if (filters.bookmaker) query = query.eq('bookmaker', filters.bookmaker);
  if (filters.marketType) query = query.eq('market_type', filters.marketType);

  const { data, error } = await query;
  if (error) {
    log.error('Error fetching odds history', { error: error.message });
    return [];
  }
  return data || [];
}

/**
 * 최근 N시간 내 배당 변동이 큰 경기 목록.
 * 각 경기의 첫 기록과 마지막 기록의 배당 차이를 계산.
 * @param {number} hours - 조회 기간 (기본 24시간)
 * @param {string} [sport] - 종목 필터
 * @param {number} [limit] - 반환 개수
 */
async function getOddsMovement(hours = 24, sport = null, limit = 30) {
  const since = new Date(Date.now() - hours * 3600 * 1000).toISOString();

  // 최근 히스토리 조회
  let query = supabase
    .from('odds_history')
    .select('match_id, bookmaker, market_type, outcome_1_odds, outcome_2_odds, outcome_draw_odds, recorded_at')
    .gte('recorded_at', since)
    .eq('market_type', 'h2h')
    .order('recorded_at', { ascending: true });

  const { data: historyData, error } = await query;
  if (error || !historyData || historyData.length === 0) return [];

  // match_id + bookmaker 별로 첫/마지막 기록 비교
  const groupKey = (h) => `${h.match_id}|${h.bookmaker}`;
  const groups = {};
  for (const h of historyData) {
    const key = groupKey(h);
    if (!groups[key]) {
      groups[key] = { first: h, last: h };
    } else {
      groups[key].last = h;
    }
  }

  // 변동폭 계산
  const movements = [];
  for (const [key, { first, last }] of Object.entries(groups)) {
    if (first.recorded_at === last.recorded_at) continue; // 단일 기록 = 변동 없음

    // 홈/원정 각각 변동 체크
    for (const outcome of ['outcome_1_odds', 'outcome_2_odds']) {
      const oldOdds = first[outcome];
      const newOdds = last[outcome];
      if (!oldOdds || !newOdds || oldOdds === newOdds) continue;

      const changePct = ((newOdds - oldOdds) / oldOdds) * 100;
      if (Math.abs(changePct) < 1) continue; // 1% 미만 무시

      movements.push({
        match_id: first.match_id,
        bookmaker: first.bookmaker,
        market_type: first.market_type,
        outcome: outcome === 'outcome_1_odds' ? 'home' : 'away',
        old_odds: oldOdds,
        new_odds: newOdds,
        change_pct: Math.round(changePct * 100) / 100,
        direction: newOdds > oldOdds ? 'up' : 'down',
        first_recorded: first.recorded_at,
        last_recorded: last.recorded_at,
      });
    }
  }

  // 변동폭 절대값 내림차순
  movements.sort((a, b) => Math.abs(b.change_pct) - Math.abs(a.change_pct));

  // 경기 정보 조인
  const matchIds = [...new Set(movements.map((m) => m.match_id))];
  let matchMap = {};
  if (matchIds.length > 0) {
    let matchQuery = supabase
      .from('matches')
      .select('id, home_team, away_team, sport, league, start_time')
      .in('id', matchIds.slice(0, 100));

    if (sport) matchQuery = matchQuery.ilike('sport', `%${sport}%`);

    const { data: matchData } = await matchQuery;
    if (matchData) {
      for (const m of matchData) matchMap[m.id] = m;
    }
  }

  return movements
    .filter((m) => matchMap[m.match_id])
    .map((m) => ({
      ...m,
      home_team: matchMap[m.match_id].home_team,
      away_team: matchMap[m.match_id].away_team,
      sport: matchMap[m.match_id].sport,
      league: matchMap[m.match_id].league,
      start_time: matchMap[m.match_id].start_time,
    }))
    .slice(0, limit);
}

module.exports = {
  saveOddsSnapshot,
  getOddsHistory,
  getOddsMovement,
};

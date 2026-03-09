/**
 * Betman (베트맨) Proto Odds Scraper — JSON API version
 *
 * Fetches fixed-odds data from betman.co.kr Proto Seungbusik (프로토 승부식)
 * using the internal JSON API: /buyPsblGame/gameInfoInq.do
 *
 * No login required — odds are publicly visible.
 *
 * API response.compSchedules:
 *   keys: column names
 *   datas: array of value arrays
 *
 * Key fields per record:
 *   itemCode  — SC(축구), BS(야구), BK(농구), VL(배구), IH(아이스하키)
 *   leagueName — league name in Korean
 *   homeName / awayName — team names in Korean
 *   gameDate — epoch ms for match start
 *   handi — game type: 0=h2h, 2=핸디캡, 9=언더오버, 5=더블찬스, 12/14=기타
 *   winAllot / drawAllot / loseAllot — h2h/핸디캡 odds
 *   winHandi / drawHandi / loseHandi — handicap/totals points
 *   matchSeq — unique sequence within round
 *   protoStatus — 4=closed, others may indicate on sale
 *   saleStatus (on currentLottery) — SaleProgress / SaleComplete / SaleBefore
 */

const axios = require('axios');

const BETMAN_BASE = 'https://www.betman.co.kr';
const GAME_INFO_URL = `${BETMAN_BASE}/buyPsblGame/gameInfoInq.do`;

// Common request headers to mimic browser AJAX call
const HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.8',
  Accept: 'application/json, text/javascript, */*; q=0.01',
  'Content-Type': 'application/json; charset=UTF-8',
  'X-Requested-With': 'XMLHttpRequest',
  Referer: `${BETMAN_BASE}/main/mainPage/gamebuy/gameSlip.do`,
};

// handi field → market type
const HANDI_TYPE_MAP = {
  0: 'h2h',
  2: 'spreads',
  9: 'totals',
};

// itemCode → sport
const ITEM_CODE_MAP = {
  SC: 'soccer',
  BS: 'baseball',
  BK: 'basketball',
  VL: 'volleyball',
  IH: 'hockey',
};

let lastScrapeResult = null;

function getLastScrapeResult() {
  return lastScrapeResult;
}

/**
 * Call the Betman JSON API for a specific round.
 * @param {string} gmId - Game ID (e.g., 'G101')
 * @param {string|number} gmTs - Round number (e.g., 260029)
 * @returns {Promise<object>} API response data
 */
async function fetchGameInfo(gmId, gmTs) {
  const body = {
    gmId,
    gmTs: String(gmTs),
    gameYear: '',
    _sbmInfo: { debugMode: 'false' },
  };

  const { data } = await axios.post(GAME_INFO_URL, body, {
    headers: HEADERS,
    timeout: 15000,
  });

  return data;
}

/**
 * Find current Proto Seungbusik rounds by probing recent round numbers.
 * gmTs format: YYMMRR where YY=year-2000, 00=padding, RR=round number
 * e.g., 260029 = year 2026, round 29
 *
 * Returns array of { gmId, gmTs, name, status } objects.
 */
async function findProtoRounds(includeOnSale = true, includeClosed = true) {
  const rounds = [];
  const now = new Date();
  const yearPrefix = (now.getFullYear() - 2000) * 10000; // e.g., 260000 for 2026

  // Probe the last 5 rounds to find active ones
  // Start from a high round number and work backward
  const probeStart = 40; // start probing from round 40 downward
  const probeEnd = 1;

  for (let r = probeStart; r >= probeEnd && rounds.length < 5; r--) {
    const gmTs = yearPrefix + r;
    try {
      const data = await fetchGameInfo('G101', gmTs);
      const cl = data.currentLottery;
      const recordCount = data.compSchedules?.datas?.length || 0;

      if (!cl || !cl.saleStatus || recordCount === 0) continue;

      const status = cl.saleStatus; // SaleProgress, SaleComplete, SaleBefore
      const roundNum = cl.gmOsidTs || r;

      let normalizedStatus = 'unknown';
      if (status === 'SaleProgress') normalizedStatus = 'on_sale';
      else if (status === 'SaleComplete') normalizedStatus = 'closed';
      else if (status === 'SaleBefore') normalizedStatus = 'before_sale';

      // Skip SaleBefore — no odds data available yet
      if (normalizedStatus === 'before_sale') continue;

      const include =
        (normalizedStatus === 'on_sale' && includeOnSale) ||
        (normalizedStatus === 'closed' && includeClosed);

      if (include) {
        rounds.push({
          gmId: 'G101',
          gmTs: String(gmTs),
          name: `프로토 승부식 ${roundNum}회차`,
          status: normalizedStatus,
          recordCount,
        });
      }
    } catch {
      // Round doesn't exist, skip
    }
  }

  // Sort: on_sale first, then before_sale, then closed
  const statusOrder = { on_sale: 0, before_sale: 1, closed: 2, unknown: 3 };
  rounds.sort((a, b) => (statusOrder[a.status] || 3) - (statusOrder[b.status] || 3));

  return rounds;
}

/**
 * Map itemCode + leagueName to a sport_key compatible with The Odds API.
 */
function mapSportKey(itemCode, leagueName) {
  const sport = ITEM_CODE_MAP[itemCode] || 'other';
  const upper = (leagueName || '').toUpperCase();

  if (sport === 'soccer') {
    if (upper.includes('EPL') || upper.includes('프리미어')) return 'soccer_epl';
    if (upper.includes('라리가') || upper.includes('LA LIGA') || upper.includes('LALIGA')) return 'soccer_spain_la_liga';
    if (upper.includes('분데스') || upper.includes('BUNDESLIGA')) return 'soccer_germany_bundesliga';
    if (upper.includes('세리에') || upper.includes('SERIE')) return 'soccer_italy_serie_a';
    if (upper.includes('리그1') || upper.includes('LIGUE')) return 'soccer_france_ligue_one';
    if (upper.includes('K리그') || upper.includes('K-LEAGUE') || upper.includes('KLEAGUE')) return 'soccer_korea_kleague1';
    if (upper.includes('J리그') || upper.includes('J-LEAGUE')) return 'soccer_japan_j_league';
    if (upper.includes('A리그') || upper.includes('A-LEAGUE')) return 'soccer_australia_aleague';
    return `soccer_${leagueName.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
  }
  if (sport === 'basketball') {
    if (upper.includes('NBA')) return 'basketball_nba';
    if (upper.includes('KBL')) return 'basketball_kbl';
    return `basketball_${leagueName.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
  }
  if (sport === 'baseball') {
    if (upper.includes('MLB')) return 'baseball_mlb';
    if (upper.includes('KBO')) return 'baseball_kbo';
    if (upper.includes('WBC')) return 'baseball_wbc';
    if (upper.includes('NPB')) return 'baseball_npb';
    return `baseball_${leagueName.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
  }
  if (sport === 'hockey') {
    if (upper.includes('NHL')) return 'icehockey_nhl';
    return `icehockey_${leagueName.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
  }

  return `${sport}_${(leagueName || 'unknown').toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
}

/**
 * Scrape Proto Seungbusik odds from a specific round via JSON API.
 * @param {string} gmId - Game ID (e.g., 'G101')
 * @param {string|number} gmTs - Round number (e.g., '260029')
 * @returns {{ matches: Array, oddsRows: Array }}
 */
async function scrapeProtoRound(gmId, gmTs) {
  console.log(`[Betman] Fetching round: gmId=${gmId}, gmTs=${gmTs}`);

  const data = await fetchGameInfo(gmId, gmTs);
  const cs = data.compSchedules;

  if (!cs || !cs.keys || !cs.datas || cs.datas.length === 0) {
    console.warn('[Betman] No compSchedules data in response');
    return { matches: [], oddsRows: [] };
  }

  const keys = cs.keys;
  const records = cs.datas.map((d) => {
    const obj = {};
    keys.forEach((k, i) => (obj[k] = d[i]));
    return obj;
  });

  const matches = [];
  const oddsRows = [];
  const matchMap = {}; // matchKey → match info

  for (const rec of records) {
    // Map handi to market type; skip unsupported types (5=더블찬스, 12, 14, etc.)
    const marketType = HANDI_TYPE_MAP[rec.handi];
    if (!marketType) continue;

    const homeName = rec.homeName || '';
    const awayName = rec.awayName || '';
    if (!homeName || !awayName) continue;

    // Group by unique match (same home+away+date)
    const matchDate = rec.gameDate ? new Date(rec.gameDate) : new Date();
    const matchKey = `${homeName}_${awayName}_${rec.gameDate}`;

    if (!matchMap[matchKey]) {
      const externalId = `betman_${gmTs}_${matchKey}`;
      matchMap[matchKey] = {
        external_id: externalId,
        sport: mapSportKey(rec.itemCode, rec.leagueName),
        league: `[KR] ${rec.leagueName || 'Unknown'}`,
        home_team: homeName,
        away_team: awayName,
        start_time: matchDate.toISOString(),
      };
      matches.push(matchMap[matchKey]);
    }

    // Build odds row
    const oddsRow = {
      match_external_id: matchMap[matchKey].external_id,
      bookmaker: 'betman_proto',
      bookmaker_title: '베트맨 프로토',
      market_type: marketType,
      handicap_point: 0,
      outcome_1_odds: null,
      outcome_2_odds: null,
      outcome_draw_odds: null,
      source_type: 'domestic',
    };

    if (marketType === 'h2h') {
      // winAllot = home win, drawAllot = draw, loseAllot = away win
      oddsRow.outcome_1_odds = rec.winAllot > 0 ? rec.winAllot : null;
      oddsRow.outcome_draw_odds = rec.drawAllot > 0 ? rec.drawAllot : null;
      oddsRow.outcome_2_odds = rec.loseAllot > 0 ? rec.loseAllot : null;
    } else if (marketType === 'spreads') {
      // winHandi = home handicap point (negative means home gives),
      // winAllot/loseAllot = home/away odds for handicap
      oddsRow.handicap_point = rec.winHandi || 0;
      oddsRow.outcome_1_odds = rec.winAllot > 0 ? rec.winAllot : null;
      oddsRow.outcome_draw_odds = rec.drawAllot > 0 ? rec.drawAllot : null;
      oddsRow.outcome_2_odds = rec.loseAllot > 0 ? rec.loseAllot : null;
    } else if (marketType === 'totals') {
      // winHandi = totals line, winAllot = over, loseAllot = under
      oddsRow.handicap_point = rec.winHandi || 0;
      oddsRow.outcome_1_odds = rec.winAllot > 0 ? rec.winAllot : null; // over
      oddsRow.outcome_2_odds = rec.loseAllot > 0 ? rec.loseAllot : null; // under
    }

    // Only add if we have at least 2 odds values
    const validOdds = [oddsRow.outcome_1_odds, oddsRow.outcome_2_odds, oddsRow.outcome_draw_odds].filter(
      (v) => v !== null
    );
    if (validOdds.length >= 2) {
      oddsRows.push(oddsRow);
    }
  }

  console.log(`[Betman] Round ${gmTs}: ${matches.length} matches, ${oddsRows.length} odds rows`);
  return { matches, oddsRows };
}

/**
 * Main scrape function: finds available Proto rounds and scrapes them.
 */
async function scrapeBetman() {
  const startTime = Date.now();
  console.log(`[Betman] Starting scrape at ${new Date().toISOString()}`);

  try {
    const rounds = await findProtoRounds(true, true);
    console.log(`[Betman] Found ${rounds.length} Proto rounds`);

    if (rounds.length === 0) {
      lastScrapeResult = {
        success: true,
        timestamp: new Date().toISOString(),
        duration: Date.now() - startTime,
        matches: 0,
        oddsRows: 0,
        message: 'No Proto rounds available',
      };
      return { matches: [], oddsRows: [] };
    }

    const allMatches = [];
    const allOddsRows = [];

    // Scrape each round (limit to 2 most relevant rounds)
    const toScrape = rounds.slice(0, 2);
    for (const round of toScrape) {
      try {
        const { matches, oddsRows } = await scrapeProtoRound(round.gmId, round.gmTs);
        allMatches.push(...matches);
        allOddsRows.push(...oddsRows);
      } catch (err) {
        console.error(`[Betman] Error scraping round ${round.name}:`, err.message);
      }
    }

    lastScrapeResult = {
      success: true,
      timestamp: new Date().toISOString(),
      duration: Date.now() - startTime,
      matches: allMatches.length,
      oddsRows: allOddsRows.length,
      rounds: toScrape.map((r) => r.name),
    };

    console.log(`[Betman] Scrape complete: ${allMatches.length} matches, ${allOddsRows.length} odds rows`);
    return { matches: allMatches, oddsRows: allOddsRows };
  } catch (err) {
    console.error('[Betman] Scrape error:', err.message);
    lastScrapeResult = {
      success: false,
      timestamp: new Date().toISOString(),
      duration: Date.now() - startTime,
      error: err.message,
    };
    return { matches: [], oddsRows: [] };
  }
}

module.exports = {
  scrapeBetman,
  scrapeProtoRound,
  findProtoRounds,
  getLastScrapeResult,
};

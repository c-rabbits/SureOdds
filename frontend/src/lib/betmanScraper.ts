/**
 * Client-side Betman Scraper
 *
 * Fetches betman.co.kr data via Vercel Edge proxy (/api/betman-proxy)
 * to bypass geo-blocking from overseas servers.
 *
 * Flow: Browser → Vercel Edge (Korea ICN) → betman.co.kr
 */

// handi field → market type
const HANDI_TYPE_MAP: Record<number, string> = {
  0: 'h2h',
  2: 'spreads',
  9: 'totals',
};

// itemCode → sport
const ITEM_CODE_MAP: Record<string, string> = {
  SC: 'soccer',
  BS: 'baseball',
  BK: 'basketball',
  VL: 'volleyball',
  IH: 'hockey',
};

interface BetmanMatch {
  external_id: string;
  sport: string;
  league: string;
  home_team: string;
  away_team: string;
  start_time: string;
}

interface BetmanOddsRow {
  match_external_id: string;
  bookmaker: string;
  bookmaker_title: string;
  market_type: string;
  handicap_point: number;
  outcome_1_odds: number | null;
  outcome_2_odds: number | null;
  outcome_draw_odds: number | null;
  source_type: string;
}

interface ProtoRound {
  gmId: string;
  gmTs: string;
  name: string;
  status: string;
  recordCount: number;
}

function mapSportKey(itemCode: string, leagueName: string): string {
  const sport = ITEM_CODE_MAP[itemCode] || 'other';
  const upper = (leagueName || '').toUpperCase();

  if (sport === 'soccer') {
    if (upper.includes('EPL') || upper.includes('프리미어')) return 'soccer_epl';
    if (upper.includes('라리가') || upper.includes('LA LIGA') || upper.includes('LALIGA')) return 'soccer_spain_la_liga';
    if (upper.includes('분데스') || upper.includes('BUNDESLIGA')) return 'soccer_germany_bundesliga';
    if (upper.includes('세리에') || upper.includes('SERIE')) return 'soccer_italy_serie_a';
    if (upper.includes('리그1') || upper.includes('LIGUE')) return 'soccer_france_ligue_one';
    if (upper.includes('UCL') || upper.includes('챔피언스') || upper.includes('UEFA CL')) return 'soccer_uefa_champs_league';
    if (upper.includes('UEL') || upper.includes('유로파') || upper.includes('UEFA EL')) return 'soccer_uefa_europa_league';
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
 * Call betman API via our Vercel Edge proxy.
 */
async function fetchBetmanViaProxy(gmId: string, gmTs: string | number): Promise<unknown> {
  const res = await fetch('/api/betman-proxy', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ gmId, gmTs: String(gmTs) }),
  });
  if (!res.ok) throw new Error(`Proxy error: ${res.status}`);
  return res.json();
}

/**
 * Find available Proto rounds via proxy.
 */
export async function findProtoRoundsViaProxy(): Promise<ProtoRound[]> {
  const now = new Date();
  const yearPrefix = (now.getFullYear() - 2000) * 10000;

  const dayOfYear = Math.floor((now.getTime() - new Date(now.getFullYear(), 0, 1).getTime()) / 86400000);
  const estimatedRound = Math.ceil(dayOfYear / 7 * 3) + 2;
  const probeStart = Math.min(estimatedRound + 3, 60);
  const probeEnd = Math.max(estimatedRound - 8, 1);

  console.log(`[Betman] Probing rounds ${probeEnd}-${probeStart} (estimated: ${estimatedRound})`);

  const probePromises = [];
  for (let r = probeStart; r >= probeEnd; r--) {
    const gmTs = yearPrefix + r;
    probePromises.push(
      fetchBetmanViaProxy('G101', gmTs)
        .then((data) => ({ gmTs, r, data: data as Record<string, unknown> }))
        .catch(() => null)
    );
  }

  const results = await Promise.all(probePromises);
  const rounds: ProtoRound[] = [];

  for (const result of results) {
    if (!result) continue;
    const { gmTs, r, data } = result;
    const cl = data.currentLottery as Record<string, unknown> | undefined;
    const cs = data.compSchedules as Record<string, unknown[]> | undefined;
    const recordCount = (cs?.datas as unknown[])?.length || 0;

    if (!cl || !cl.saleStatus || recordCount === 0) continue;

    const status = cl.saleStatus as string;
    const roundNum = (cl.gmOsidTs as number) || r;

    let normalizedStatus = 'unknown';
    if (status === 'SaleProgress') normalizedStatus = 'on_sale';
    else if (status === 'SaleComplete' || status === 'PayoStart' || status === 'PayoEnd') normalizedStatus = 'closed';
    else if (status === 'SaleBefore') normalizedStatus = 'before_sale';

    if (normalizedStatus === 'before_sale' || normalizedStatus === 'unknown') continue;

    rounds.push({
      gmId: 'G101',
      gmTs: String(gmTs),
      name: `프로토 승부식 ${roundNum}회차`,
      status: normalizedStatus,
      recordCount,
    });
  }

  const statusOrder: Record<string, number> = { on_sale: 0, closed: 1 };
  rounds.sort((a, b) => (statusOrder[a.status] ?? 9) - (statusOrder[b.status] ?? 9));

  return rounds.slice(0, 5);
}

/**
 * Scrape a single Proto round via proxy.
 */
export async function scrapeProtoRoundViaProxy(
  gmId: string,
  gmTs: string
): Promise<{ matches: BetmanMatch[]; oddsRows: BetmanOddsRow[] }> {
  const data = (await fetchBetmanViaProxy(gmId, gmTs)) as Record<string, unknown>;
  const cs = data.compSchedules as { keys?: string[]; datas?: unknown[][] } | undefined;

  if (!cs || !cs.keys || !cs.datas || cs.datas.length === 0) {
    return { matches: [], oddsRows: [] };
  }

  const keys = cs.keys;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const records: any[] = cs.datas.map((d) => {
    const obj: Record<string, unknown> = {};
    keys.forEach((k, i) => (obj[k] = d[i]));
    return obj;
  });

  const matches: BetmanMatch[] = [];
  const oddsRows: BetmanOddsRow[] = [];
  const matchMap: Record<string, BetmanMatch> = {};

  for (const rec of records) {
    const marketType = HANDI_TYPE_MAP[rec.handi];
    if (!marketType) continue;

    const homeName = rec.homeName || '';
    const awayName = rec.awayName || '';
    if (!homeName || !awayName) continue;

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

    const oddsRow: BetmanOddsRow = {
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
      oddsRow.outcome_1_odds = rec.winAllot > 0 ? rec.winAllot : null;
      oddsRow.outcome_draw_odds = rec.drawAllot > 0 ? rec.drawAllot : null;
      oddsRow.outcome_2_odds = rec.loseAllot > 0 ? rec.loseAllot : null;
    } else if (marketType === 'spreads') {
      oddsRow.handicap_point = rec.winHandi || 0;
      oddsRow.outcome_1_odds = rec.winAllot > 0 ? rec.winAllot : null;
      oddsRow.outcome_draw_odds = rec.drawAllot > 0 ? rec.drawAllot : null;
      oddsRow.outcome_2_odds = rec.loseAllot > 0 ? rec.loseAllot : null;
    } else if (marketType === 'totals') {
      oddsRow.handicap_point = rec.winHandi || 0;
      oddsRow.outcome_1_odds = rec.winAllot > 0 ? rec.winAllot : null;
      oddsRow.outcome_2_odds = rec.loseAllot > 0 ? rec.loseAllot : null;
    }

    const validOdds = [oddsRow.outcome_1_odds, oddsRow.outcome_2_odds, oddsRow.outcome_draw_odds].filter(
      (v) => v !== null
    );
    if (validOdds.length >= 2) {
      oddsRows.push(oddsRow);
    }
  }

  return { matches, oddsRows };
}

/**
 * Full betman scrape: find rounds → scrape → return data.
 */
export async function scrapeBetmanViaProxy(): Promise<{
  matches: BetmanMatch[];
  oddsRows: BetmanOddsRow[];
  rounds: string[];
}> {
  const rounds = await findProtoRoundsViaProxy();
  console.log(`[Betman] Found ${rounds.length} Proto rounds`);

  if (rounds.length === 0) {
    return { matches: [], oddsRows: [], rounds: [] };
  }

  const toScrape = rounds.slice(0, 2); // Limit to 2 most relevant
  const allMatches: BetmanMatch[] = [];
  const allOddsRows: BetmanOddsRow[] = [];

  // Scrape rounds in parallel
  const scrapeResults = await Promise.all(
    toScrape.map((round) =>
      scrapeProtoRoundViaProxy(round.gmId, round.gmTs).catch((err) => {
        console.error(`[Betman] Error scraping ${round.name}:`, err);
        return { matches: [], oddsRows: [] };
      })
    )
  );

  for (const result of scrapeResults) {
    allMatches.push(...result.matches);
    allOddsRows.push(...result.oddsRows);
  }

  console.log(`[Betman] Scraped: ${allMatches.length} matches, ${allOddsRows.length} odds rows`);
  return {
    matches: allMatches,
    oddsRows: allOddsRows,
    rounds: toScrape.map((r) => r.name),
  };
}

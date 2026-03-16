import { MarketType, Odds, MatchWithOdds, TableRow, SourceType } from '@/types';

/**
 * Format a date/time string for display.
 */
export function formatMatchTime(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatShortTime(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleString('en-US', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Sports configuration.
 */
export const SPORT_CATEGORIES = [
  { key: 'all', label: 'All', emoji: '' },
  { key: 'soccer', label: 'Soccer', emoji: '⚽' },
  { key: 'basketball', label: 'Basketball', emoji: '🏀' },
  { key: 'baseball', label: 'Baseball', emoji: '⚾' },
  { key: 'hockey', label: 'Hockey', emoji: '🏒' },
] as const;

export const SPORTS_CONFIG: Record<string, { label: string; category: string; emoji: string }> = {
  soccer_epl: { label: 'Premier League', category: 'soccer', emoji: '⚽' },
  soccer_spain_la_liga: { label: 'La Liga', category: 'soccer', emoji: '⚽' },
  soccer_germany_bundesliga: { label: 'Bundesliga', category: 'soccer', emoji: '⚽' },
  soccer_italy_serie_a: { label: 'Serie A', category: 'soccer', emoji: '⚽' },
  soccer_france_ligue_one: { label: 'Ligue 1', category: 'soccer', emoji: '⚽' },
  soccer_japan_j_league: { label: 'J-League', category: 'soccer', emoji: '⚽' },
  soccer_korea_kleague1: { label: 'K-League', category: 'soccer', emoji: '⚽' },
  basketball_nba: { label: 'NBA', category: 'basketball', emoji: '🏀' },
  basketball_euroleague: { label: 'Euroleague', category: 'basketball', emoji: '🏀' },
  baseball_mlb: { label: 'MLB', category: 'baseball', emoji: '⚾' },
  icehockey_nhl: { label: 'NHL', category: 'hockey', emoji: '🏒' },
};

/**
 * Get sport emoji.
 */
export function getSportEmoji(sport: string): string {
  if (SPORTS_CONFIG[sport]) return SPORTS_CONFIG[sport].emoji;
  if (sport.startsWith('soccer')) return '⚽';
  if (sport.startsWith('basketball')) return '🏀';
  if (sport.startsWith('baseball')) return '⚾';
  if (sport.startsWith('icehockey') || sport.startsWith('hockey')) return '🏒';
  return '🏆';
}

/**
 * Get sport category.
 * First checks SPORTS_CONFIG, then falls back to prefix matching (e.g. soccer_xxx → soccer).
 */
export function getSportCategory(sport: string): string {
  if (SPORTS_CONFIG[sport]) return SPORTS_CONFIG[sport].category;
  if (sport.startsWith('soccer')) return 'soccer';
  if (sport.startsWith('basketball')) return 'basketball';
  if (sport.startsWith('baseball')) return 'baseball';
  if (sport.startsWith('icehockey') || sport.startsWith('hockey')) return 'hockey';
  return 'other';
}

/**
 * Bookmaker configuration for filter UI.
 * Order determines display order in the toolbar.
 */
export interface BookmakerInfo {
  key: string;
  name: string;
  short: string;
  domestic: boolean;
}

export const BOOKMAKER_CONFIG: BookmakerInfo[] = [
  // 북메이커 (해외 3개 고정)
  { key: 'pinnacle', name: 'Pinnacle', short: 'PINN', domestic: false },
  { key: 'sbobet', name: 'SBOBet', short: 'SBO', domestic: false },
  { key: 'dafabet', name: 'MaxBet', short: 'MAX', domestic: false },
  // 국내 사이트
  { key: 'stake', name: 'Stake.com', short: 'STK', domestic: true },
  { key: 'betman_proto', name: '베트맨 프로토', short: 'BM', domestic: true },
  { key: 'manual_domestic', name: '수동 입력', short: '수동', domestic: true },
];

/**
 * Bookmaker betting page URLs.
 * Used for "바로가기" (Go to) links in the detail panel.
 */
export const BOOKMAKER_URLS: Record<string, string> = {
  pinnacle: 'https://www.pinnacle.com',
  sbobet: 'https://www.sbobet.com',
  dafabet: 'https://www.maxbet.com',
  stake: 'https://stake.com/sports',
  betman_proto: 'https://www.betman.co.kr/main/mainPage/gamebuy/gameSlip.do',
};

/**
 * Pinnacle league-level URL mapping.
 * Since Pinnacle doesn't support event-level deep links via API,
 * we link to the specific league matchups page instead of the homepage.
 */
const PINNACLE_LEAGUE_URLS: Record<string, string> = {
  soccer_epl: 'https://www.pinnacle.com/en/soccer/england-premier-league/matchups/',
  soccer_spain_la_liga: 'https://www.pinnacle.com/en/soccer/spain-la-liga/matchups/',
  soccer_germany_bundesliga: 'https://www.pinnacle.com/en/soccer/germany-bundesliga/matchups/',
  soccer_italy_serie_a: 'https://www.pinnacle.com/en/soccer/italy-serie-a/matchups/',
  soccer_france_ligue_one: 'https://www.pinnacle.com/en/soccer/france-ligue-1/matchups/',
  soccer_uefa_champs_league: 'https://www.pinnacle.com/en/soccer/uefa-champions-league/matchups/',
  soccer_uefa_europa_league: 'https://www.pinnacle.com/en/soccer/uefa-europa-league/matchups/',
  soccer_korea_kleague1: 'https://www.pinnacle.com/en/soccer/korea-republic-k-league-1/matchups/',
  soccer_japan_j_league: 'https://www.pinnacle.com/en/soccer/japan-j-league/matchups/',
  basketball_nba: 'https://www.pinnacle.com/en/basketball/nba/matchups/',
  basketball_euroleague: 'https://www.pinnacle.com/en/basketball/euroleague/matchups/',
  baseball_mlb: 'https://www.pinnacle.com/en/baseball/mlb/matchups/',
  baseball_kbo: 'https://www.pinnacle.com/en/baseball/south-korea-kbo/matchups/',
  baseball_npb: 'https://www.pinnacle.com/en/baseball/japan-npb/matchups/',
  icehockey_nhl: 'https://www.pinnacle.com/en/hockey/nhl/matchups/',
};

/**
 * Get betting page URL for a bookmaker.
 * For Pinnacle, returns league-specific matchups page if sport is provided.
 * Returns the URL string or null if not configured.
 */
export function getBookmakerUrl(key: string, sport?: string): string | null {
  // Pinnacle: prefer league-level URL
  if (key === 'pinnacle' && sport) {
    return PINNACLE_LEAGUE_URLS[sport] || BOOKMAKER_URLS[key] || null;
  }
  return BOOKMAKER_URLS[key] || null;
}

const BOOKMAKER_NAME_MAP: Record<string, string> = Object.fromEntries(
  BOOKMAKER_CONFIG.map((b) => [b.key, b.name])
);
const BOOKMAKER_SHORT_MAP: Record<string, string> = Object.fromEntries(
  BOOKMAKER_CONFIG.map((b) => [b.key, b.short])
);

/**
 * Get bookmaker display name.
 */
export function getBookmakerName(key: string): string {
  return BOOKMAKER_NAME_MAP[key] || key;
}

/**
 * Get short bookmaker name for table display.
 */
export function getBookmakerShort(key: string): string {
  return BOOKMAKER_SHORT_MAP[key] || key.toUpperCase().slice(0, 4);
}

/**
 * Check if a bookmaker is domestic (Korean).
 */
export function isDomesticBookmaker(key: string): boolean {
  // 북메이커 3개(pinnacle, sbobet, dafabet)만 해외, 나머지는 전부 국내
  const INTERNATIONAL_BOOKMAKERS = ['pinnacle', 'sbobet', 'dafabet'];
  return !INTERNATIONAL_BOOKMAKERS.includes(key);
}

/**
 * Get source type badge label.
 */
export function getSourceBadge(sourceType: SourceType): { label: string; emoji: string; color: string } {
  if (sourceType === 'domestic') {
    return { label: '국내', emoji: '🇰🇷', color: 'text-blue-400' };
  }
  return { label: '해외', emoji: '🌐', color: 'text-green-400' };
}

/**
 * Format odds as a decimal with 2 decimals.
 */
export function formatOdds(odds: number | null | undefined): string {
  if (!odds) return '-';
  return odds.toFixed(2);
}

/**
 * Format handicap point display.
 */
export function formatHandicap(point: number | null, marketType: MarketType): string {
  if (point === null || point === undefined) return '';
  if (marketType === 'spreads') {
    return point > 0 ? `+${point}` : `${point}`;
  }
  if (marketType === 'totals') {
    return `오/언 ${point}`;
  }
  return '';
}

/**
 * Get market type label.
 */
export function getMarketLabel(marketType: MarketType): string {
  switch (marketType) {
    case 'h2h': return '승무패';
    case 'spreads': return '핸디캡';
    case 'totals': return '오버/언더';
    default: return marketType;
  }
}

/**
 * Get outcome labels by market type.
 */
export function getOutcomeLabels(marketType: MarketType): [string, string, string?] {
  switch (marketType) {
    case 'h2h': return ['홈승', '원정승', '무승부'];
    case 'spreads': return ['홈', '원정'];
    case 'totals': return ['오버', '언더'];
    default: return ['1', '2'];
  }
}

/**
 * Get profit color class based on profit percentage.
 */
export function getProfitColorClass(profit: number): string {
  if (profit >= 3) return 'text-green-400';
  if (profit >= 1) return 'text-green-300';
  if (profit >= 0.5) return 'text-yellow-400';
  return 'text-orange-400';
}

/**
 * Find best odds for each outcome from an array of odds records.
 */
export function findBestOdds(oddsRecords: Odds[]): {
  best1: { odds: number; bookmaker: string } | null;
  best2: { odds: number; bookmaker: string } | null;
  bestDraw: { odds: number; bookmaker: string } | null;
} {
  let best1: { odds: number; bookmaker: string } | null = null;
  let best2: { odds: number; bookmaker: string } | null = null;
  let bestDraw: { odds: number; bookmaker: string } | null = null;

  for (const record of oddsRecords) {
    if (record.outcome_1_odds && (!best1 || record.outcome_1_odds > best1.odds)) {
      best1 = { odds: record.outcome_1_odds, bookmaker: record.bookmaker };
    }
    if (record.outcome_2_odds && (!best2 || record.outcome_2_odds > best2.odds)) {
      best2 = { odds: record.outcome_2_odds, bookmaker: record.bookmaker };
    }
    if (record.outcome_draw_odds && (!bestDraw || record.outcome_draw_odds > bestDraw.odds)) {
      bestDraw = { odds: record.outcome_draw_odds, bookmaker: record.bookmaker };
    }
  }

  return { best1, best2, bestDraw };
}

/**
 * Convert MatchWithOdds data into flattened TableRow array.
 */
export function flattenMatchesToRows(matches: MatchWithOdds[]): TableRow[] {
  const rows: TableRow[] = [];

  for (const match of matches) {
    const groups: Record<string, Odds[]> = {};
    for (const odd of match.odds || []) {
      const key = `${odd.market_type}|${odd.handicap_point ?? 'null'}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(odd);
    }

    const arbMap: Record<string, { profitPercent: number; arbFactor: number }> = {};
    for (const arb of match.arbitrage_opportunities || []) {
      const key = `${arb.market_type}|${arb.handicap_point ?? 'null'}`;
      arbMap[key] = { profitPercent: Number(arb.profit_percent), arbFactor: Number(arb.arb_factor) };
    }

    // Betman Proto closes betting ~2 hours before match start.
    // Exclude betman odds for matches starting within 2 hours.
    const BETMAN_CLOSE_HOURS = 2;
    const betmanCutoff = new Date(Date.now() + BETMAN_CLOSE_HOURS * 60 * 60 * 1000);
    const matchStart = new Date(match.start_time);
    const betmanLikelyClosed = matchStart <= betmanCutoff;

    for (const [key, oddsRecords] of Object.entries(groups)) {
      // Filter out betman odds if match is within cutoff (betting likely closed)
      const effectiveOdds = betmanLikelyClosed
        ? oddsRecords.filter((o) => !isDomesticBookmaker(o.bookmaker))
        : oddsRecords;

      // Skip markets with only one bookmaker — no comparison possible
      const uniqueBookmakers = new Set(effectiveOdds.map((o) => o.bookmaker));
      if (uniqueBookmakers.size < 2) continue;

      const [marketType, pointStr] = key.split('|');
      const handicapPoint = pointStr === 'null' ? null : parseFloat(pointStr);
      const { best1, best2, bestDraw } = findBestOdds(effectiveOdds);

      // Skip if best odds for both outcomes come from the same bookmaker
      if (best1 && best2 && best1.bookmaker === best2.bookmaker) continue;

      const arb = arbMap[key];

      let arbFactor: number | null = arb?.arbFactor ?? null;
      let profitPercent: number | null = arb?.profitPercent ?? null;
      let isArbitrage = !!arb;

      if (!arb && best1 && best2) {
        const oddsArr = bestDraw
          ? [best1.odds, bestDraw.odds, best2.odds]
          : [best1.odds, best2.odds];
        arbFactor = oddsArr.reduce((s, o) => s + 1 / o, 0);
        profitPercent = (1 - arbFactor) * 100;
        isArbitrage = arbFactor < 1;
      }

      // Detect cross-source: best odds come from different source types
      const bestBookmakers = [best1?.bookmaker, best2?.bookmaker, bestDraw?.bookmaker].filter(Boolean);
      const hasDomestic = bestBookmakers.some((b) => isDomesticBookmaker(b!));
      const hasInternational = bestBookmakers.some((b) => !isDomesticBookmaker(b!));
      const isCrossSource = hasDomestic && hasInternational;

      rows.push({
        matchId: match.id,
        sport: match.sport,
        league: match.league,
        homeTeam: match.home_team,
        awayTeam: match.away_team,
        startTime: match.start_time,
        marketType: marketType as MarketType,
        handicapPoint: handicapPoint,
        bestOutcome1: best1,
        bestOutcome2: best2,
        bestDraw: bestDraw,
        arbFactor,
        profitPercent,
        isArbitrage,
        isCrossSource,
        matchData: match,
      });
    }
  }

  return rows;
}

/**
 * How long ago a timestamp was.
 */
export function timeAgo(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

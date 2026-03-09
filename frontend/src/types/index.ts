export interface Match {
  id: string;
  external_id: string;
  sport: string;
  league: string;
  home_team: string;
  away_team: string;
  start_time: string;
  created_at: string;
}

export type MarketType = 'h2h' | 'spreads' | 'totals';

export type SourceType = 'international' | 'domestic';

export interface Odds {
  id: string;
  match_id: string;
  bookmaker: string;
  bookmaker_title: string;
  market_type: MarketType;
  handicap_point: number | null;
  outcome_1_odds: number | null;  // home (h2h/spreads) or over (totals)
  outcome_2_odds: number | null;  // away (h2h/spreads) or under (totals)
  outcome_draw_odds: number | null; // draw (h2h 3-way only)
  source_type: SourceType;
  updated_at: string;
}

export interface MatchWithOdds extends Match {
  odds: Odds[];
  arbitrage_opportunities: ArbitrageOpportunity[];
}

export interface ArbitrageOpportunity {
  id: string;
  match_id: string;
  market_type: MarketType;
  handicap_point: number | null;
  bookmaker_a: string;
  bookmaker_b: string;
  bookmaker_draw: string | null;
  odds_a: number;
  odds_b: number;
  odds_draw: number | null;
  profit_percent: number;
  arb_factor: number;
  detected_at: string;
  is_active: boolean;
  matches?: Match;
}

export interface StakeCalculation {
  totalStake: number;
  stakes: number[];
  returns: number[];
  profit: number;
  profitPercent: number;
  isArbitrage: boolean;
}

export interface CollectorStatus {
  lastResult: {
    success: boolean;
    timestamp: string;
    duration: number;
    matchesUpdated?: number;
    oddsRows?: number;
    arbitrageFound?: number;
    creditsUsed?: number;
    error?: string;
  } | null;
  quota: QuotaInfo;
  config: {
    sports: string[];
    markets: string[];
    defaultSports: string[];
  };
}

export interface QuotaInfo {
  used: number | null;
  remaining: number | null;
  updatedAt: string | null;
  monthlyUsed?: number;
  monthlyLimit?: number;
  monthlyRemaining?: number;
}

export type SortField = 'profit' | 'time' | 'sport' | 'league';
export type SortDirection = 'asc' | 'desc';

export type SourceFilter = 'all' | 'international' | 'domestic' | 'cross';

export interface FilterState {
  sports: string[];
  marketTypes: MarketType[];
  minProfit: number;
  bookmakers: string[];
  sortBy: SortField;
  sortDir: SortDirection;
  sourceFilter: SourceFilter;
}

// ============================================================
// Auth types
// ============================================================
export type UserRole = 'admin' | 'user';

export interface UserProfile {
  id: string;
  email: string;
  display_name: string | null;
  role: UserRole;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  last_sign_in_at?: string | null;
  email_confirmed_at?: string | null;
}

// Flattened row for the data table
export interface TableRow {
  matchId: string;
  sport: string;
  league: string;
  homeTeam: string;
  awayTeam: string;
  startTime: string;
  marketType: MarketType;
  handicapPoint: number | null;
  bestOutcome1: { odds: number; bookmaker: string } | null;
  bestOutcome2: { odds: number; bookmaker: string } | null;
  bestDraw: { odds: number; bookmaker: string } | null;
  arbFactor: number | null;
  profitPercent: number | null;
  isArbitrage: boolean;
  isCrossSource: boolean; // true if best odds come from different source types
  matchData: MatchWithOdds;
}

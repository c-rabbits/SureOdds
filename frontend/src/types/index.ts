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
  event_url: string | null;         // deep link to bookmaker's event page
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
export type UserRole = 'admin' | 'vip1' | 'vip2' | 'vip3' | 'vip4' | 'vip5' | 'test_vip1' | 'test_vip2' | 'test_vip3' | 'test_vip4' | 'test_vip5' | 'user';

export interface UserProfile {
  id: string;
  email: string;
  username: string | null;
  display_name: string | null;
  role: UserRole;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  last_sign_in_at?: string | null;
  email_confirmed_at?: string | null;
  telegram_chat_id?: string | null;
  telegram_linked_at?: string | null;
}

// ============================================================
// Available Sites (관리자가 관리하는 마스터 사이트 목록)
// ============================================================
export interface AvailableSite {
  id: string;
  site_url: string;
  site_name: string;
  description: string | null;
  is_active: boolean;
  no_login: boolean;
  created_at: string;
}

// ============================================================
// Site management types (사이트 추가 / 작업요청)
// ============================================================
export interface SiteRegistration {
  id: string;
  user_id: string;
  available_site_id?: string;
  site_url: string;
  site_name: string;
  group_name: string;
  login_id: string;
  check_interval: number;
  enable_cross: boolean;
  enable_handicap: boolean;
  enable_ou: boolean;
  is_active: boolean;
  status: 'active' | 'paused' | 'pending' | 'approved' | 'rejected';
  // 세션 릴레이 필드
  session_status: 'none' | 'active' | 'expired' | 'error';
  session_expires_at: string | null;
  session_last_checked_at: string | null;
  session_error: string | null;
  created_at: string;
  updated_at: string;
}

export interface SiteRequest {
  id: string;
  user_id: string;
  site_url: string;
  site_name: string | null;
  notes: string | null;
  status: 'pending' | 'approved' | 'rejected' | 'completed';
  admin_notes: string | null;
  created_at: string;
  updated_at: string;
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

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

export interface Odds {
  id: string;
  match_id: string;
  bookmaker: string;
  bookmaker_title: string;
  market_type: string;
  home_odds: number | null;
  draw_odds: number | null;
  away_odds: number | null;
  updated_at: string;
}

export interface ArbitrageOpportunity {
  id: string;
  match_id: string;
  market_type: string;
  bookmaker_a: string;
  bookmaker_b: string;
  bookmaker_draw: string | null;
  odds_a: number;
  odds_b: number;
  odds_draw: number | null;
  profit_percent: number;
  arb_factor: number;
  detected_at: string;
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

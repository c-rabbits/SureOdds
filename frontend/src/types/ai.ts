export interface AiPrediction {
  id: string;
  match_id: string;
  model_type: string;
  home_win_prob: number;
  draw_prob: number;
  away_win_prob: number;
  expected_home_goals: number | null;
  expected_away_goals: number | null;
  over_2_5_prob: number | null;
  under_2_5_prob: number | null;
  confidence: number;
  value_bets: ValueBet[] | null;
  computed_at: string;
}

export interface ValueBet {
  outcome: string;
  outcome_label: string;
  ai_prob: number;
  market_prob: number;
  edge: number;
  odds: number;
  bookmaker: string;
}

export interface MatchWithPrediction {
  id: string;
  sport: string;
  league: string;
  home_team: string;
  away_team: string;
  start_time: string;
  prediction: AiPrediction | null;
}

export interface OddsHistoryPoint {
  id: string;
  match_id: string;
  bookmaker: string;
  bookmaker_title: string | null;
  market_type: string;
  handicap_point: number;
  outcome_1_odds: number;
  outcome_2_odds: number;
  outcome_draw_odds: number | null;
  source_type: string;
  recorded_at: string;
}

export interface OddsMovementItem {
  match_id: string;
  home_team: string;
  away_team: string;
  sport: string;
  league: string;
  start_time: string;
  bookmaker: string;
  market_type: string;
  outcome: string;
  old_odds: number;
  new_odds: number;
  change_pct: number;
  direction: 'up' | 'down';
  first_recorded: string;
  last_recorded: string;
}

export interface MatchPredictionDetail {
  match: {
    id: string;
    sport: string;
    league: string;
    home_team: string;
    away_team: string;
    start_time: string;
  };
  odds: Array<{
    id: string;
    bookmaker: string;
    bookmaker_title: string | null;
    market_type: string;
    handicap_point: number;
    outcome_1_odds: number;
    outcome_2_odds: number;
    outcome_draw_odds: number | null;
    source_type: string;
    updated_at: string;
  }>;
  prediction: AiPrediction | null;
}

export interface ValueBetMatch {
  match_id: string;
  home_team: string;
  away_team: string;
  sport: string;
  league: string;
  start_time: string;
  confidence: number;
  value_bets: ValueBet[];
  top_edge: number;
}

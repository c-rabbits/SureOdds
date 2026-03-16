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
  // Hybrid model fields
  team_model_home_goals?: number | null;
  team_model_away_goals?: number | null;
  market_model_home_goals?: number | null;
  market_model_away_goals?: number | null;
  model_agreement?: number | null;
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

export interface TeamStatsInfo {
  team_name: string;
  sport: string;
  league: string;
  season: string;
  elo_rating: number | null;
  attack_rating: number | null;
  defense_rating: number | null;
  form_last5: string | null;
  avg_goals_scored: number | null;
  avg_goals_conceded: number | null;
  goals_scored: number | null;
  goals_conceded: number | null;
  matches_played: number | null;
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
  homeTeamStats: TeamStatsInfo | null;
  awayTeamStats: TeamStatsInfo | null;
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

export interface AccuracyRecord {
  match_id: string;
  model_type: string;
  predicted_outcome: string;
  predicted_prob: number;
  actual_outcome: string;
  actual_home_goals: number;
  actual_away_goals: number;
  correct: boolean;
  brier_score: number;
  confidence: number;
  had_value_bet: boolean;
  value_bet_outcome: string | null;
  value_bet_odds: number | null;
  value_bet_profit: number | null;
  calculated_at: string;
  matches: {
    home_team: string;
    away_team: string;
    sport: string;
    league: string;
    start_time: string;
  };
}

export interface AccuracySummary {
  total: number;
  correct: number;
  accuracy: number;
  avgBrier: number;
  avgConfidence: number;
  valueBets: {
    total: number;
    profit: number;
    roi: number | null;
  };
  byModel: Array<{
    model: string;
    total: number;
    correct: number;
    accuracy: number;
    avgBrier: number;
  }>;
}

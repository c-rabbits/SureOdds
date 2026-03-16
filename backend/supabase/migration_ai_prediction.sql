-- ============================================================
-- AI 예측 기능용 DB 마이그레이션
-- odds_history, ai_predictions, team_stats
-- ============================================================

-- 1. 배당 히스토리 (스냅샷, INSERT only)
CREATE TABLE IF NOT EXISTS odds_history (
  id              UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  match_id        UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  bookmaker       TEXT NOT NULL,
  bookmaker_title TEXT,
  market_type     TEXT NOT NULL DEFAULT 'h2h',
  handicap_point  DECIMAL(5,2) DEFAULT 0,
  outcome_1_odds  DECIMAL(6,3),
  outcome_2_odds  DECIMAL(6,3),
  outcome_draw_odds DECIMAL(6,3),
  source_type     TEXT DEFAULT 'international',
  recorded_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_odds_history_match ON odds_history(match_id);
CREATE INDEX IF NOT EXISTS idx_odds_history_time ON odds_history(recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_odds_history_match_bm ON odds_history(match_id, bookmaker, market_type);

ALTER TABLE odds_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read on odds_history"
  ON odds_history FOR SELECT USING (true);
CREATE POLICY "Allow service write on odds_history"
  ON odds_history FOR ALL USING (auth.role() = 'service_role');

-- 2. AI 예측 결과
CREATE TABLE IF NOT EXISTS ai_predictions (
  id              UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  match_id        UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  model_type      TEXT NOT NULL DEFAULT 'poisson_v1',
  home_win_prob   DECIMAL(5,4),
  draw_prob       DECIMAL(5,4),
  away_win_prob   DECIMAL(5,4),
  expected_home_goals DECIMAL(4,2),
  expected_away_goals DECIMAL(4,2),
  over_2_5_prob   DECIMAL(5,4),
  under_2_5_prob  DECIMAL(5,4),
  confidence      DECIMAL(5,4),
  value_bets      JSONB,
  computed_at     TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(match_id, model_type)
);

CREATE INDEX IF NOT EXISTS idx_ai_pred_match ON ai_predictions(match_id);
CREATE INDEX IF NOT EXISTS idx_ai_pred_time ON ai_predictions(computed_at DESC);

ALTER TABLE ai_predictions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read on ai_predictions"
  ON ai_predictions FOR SELECT USING (true);
CREATE POLICY "Allow service write on ai_predictions"
  ON ai_predictions FOR ALL USING (auth.role() = 'service_role');

-- 3. 팀 통계 (Phase 2 placeholder)
CREATE TABLE IF NOT EXISTS team_stats (
  id              UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  team_name       TEXT NOT NULL,
  sport           TEXT NOT NULL,
  league          TEXT,
  season          TEXT,
  matches_played  INTEGER DEFAULT 0,
  goals_scored    INTEGER DEFAULT 0,
  goals_conceded  INTEGER DEFAULT 0,
  avg_goals_scored  DECIMAL(4,2),
  avg_goals_conceded DECIMAL(4,2),
  attack_rating   DECIMAL(5,3),
  defense_rating  DECIMAL(5,3),
  elo_rating      DECIMAL(7,2) DEFAULT 1500,
  form_last5      TEXT,
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(team_name, sport, season)
);

CREATE INDEX IF NOT EXISTS idx_team_stats_name ON team_stats(team_name);
CREATE INDEX IF NOT EXISTS idx_team_stats_sport ON team_stats(sport);

ALTER TABLE team_stats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read on team_stats"
  ON team_stats FOR SELECT USING (true);
CREATE POLICY "Allow service write on team_stats"
  ON team_stats FOR ALL USING (auth.role() = 'service_role');

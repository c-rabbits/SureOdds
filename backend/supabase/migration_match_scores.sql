-- ============================================================
-- Migration: Add score columns to matches table
-- ============================================================
ALTER TABLE matches ADD COLUMN IF NOT EXISTS home_score INTEGER DEFAULT NULL;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS away_score INTEGER DEFAULT NULL;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'scheduled';
-- status values: 'scheduled', 'live', 'completed', 'cancelled'

CREATE INDEX IF NOT EXISTS idx_matches_status ON matches(status);

-- ============================================================
-- ELO History Table: Track ELO rating changes per match
-- ============================================================
CREATE TABLE IF NOT EXISTS elo_history (
  id           UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  team_name    TEXT NOT NULL,
  sport        TEXT NOT NULL,
  match_id     UUID REFERENCES matches(id) ON DELETE CASCADE,
  elo_before   DECIMAL(7,2) NOT NULL,
  elo_after    DECIMAL(7,2) NOT NULL,
  elo_change   DECIMAL(5,2) NOT NULL,
  recorded_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_elo_history_team ON elo_history(team_name);
CREATE INDEX IF NOT EXISTS idx_elo_history_match ON elo_history(match_id);

ALTER TABLE elo_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read on elo_history"
  ON elo_history FOR SELECT USING (true);
CREATE POLICY "Allow service write on elo_history"
  ON elo_history FOR ALL USING (auth.role() = 'service_role');

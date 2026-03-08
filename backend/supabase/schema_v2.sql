-- SureOdds Database Schema v2
-- Supports h2h, spreads, and totals markets
-- Run this AFTER schema.sql or as a fresh install

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- MATCHES TABLE (unchanged from v1)
-- ============================================================
CREATE TABLE IF NOT EXISTS matches (
  id            UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  external_id   TEXT UNIQUE NOT NULL,
  sport         TEXT NOT NULL,
  league        TEXT NOT NULL,
  home_team     TEXT NOT NULL,
  away_team     TEXT NOT NULL,
  start_time    TIMESTAMPTZ NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_matches_start_time ON matches(start_time);
CREATE INDEX IF NOT EXISTS idx_matches_sport ON matches(sport);

-- ============================================================
-- ODDS TABLE (v2 - multi-market support)
-- ============================================================
-- Drop old table if migrating
DROP TABLE IF EXISTS odds CASCADE;

CREATE TABLE IF NOT EXISTS odds (
  id                UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  match_id          UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  bookmaker         TEXT NOT NULL,
  bookmaker_title   TEXT,
  market_type       TEXT NOT NULL DEFAULT 'h2h',       -- 'h2h', 'spreads', 'totals'
  handicap_point    DECIMAL(5,2) DEFAULT NULL,          -- NULL for h2h; e.g. -0.5 for spreads, 2.5 for totals
  outcome_1_odds    DECIMAL(6,3),                       -- home (h2h/spreads) or over (totals)
  outcome_2_odds    DECIMAL(6,3),                       -- away (h2h/spreads) or under (totals)
  outcome_draw_odds DECIMAL(6,3),                       -- draw (h2h 3-way only), NULL otherwise
  updated_at        TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (match_id, bookmaker, market_type, COALESCE(handicap_point, 0))
);

CREATE INDEX IF NOT EXISTS idx_odds_match_id ON odds(match_id);
CREATE INDEX IF NOT EXISTS idx_odds_market ON odds(match_id, market_type);
CREATE INDEX IF NOT EXISTS idx_odds_bookmaker ON odds(bookmaker);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_odds_updated_at ON odds;
CREATE TRIGGER update_odds_updated_at
  BEFORE UPDATE ON odds
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- ARBITRAGE OPPORTUNITIES TABLE (v2)
-- ============================================================
DROP TABLE IF EXISTS arbitrage_opportunities CASCADE;

CREATE TABLE IF NOT EXISTS arbitrage_opportunities (
  id              UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  match_id        UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  market_type     TEXT NOT NULL DEFAULT 'h2h',
  handicap_point  DECIMAL(5,2) DEFAULT NULL,
  bookmaker_a     TEXT NOT NULL,          -- outcome_1 best bookmaker
  bookmaker_b     TEXT NOT NULL,          -- outcome_2 best bookmaker
  bookmaker_draw  TEXT,                   -- draw bookmaker (h2h 3-way only)
  odds_a          DECIMAL(6,3) NOT NULL,
  odds_b          DECIMAL(6,3) NOT NULL,
  odds_draw       DECIMAL(6,3),
  profit_percent  DECIMAL(8,4) NOT NULL,
  arb_factor      DECIMAL(8,6) NOT NULL,
  detected_at     TIMESTAMPTZ DEFAULT NOW(),
  is_active       BOOLEAN DEFAULT TRUE
);

CREATE INDEX IF NOT EXISTS idx_arb_match_id ON arbitrage_opportunities(match_id);
CREATE INDEX IF NOT EXISTS idx_arb_profit ON arbitrage_opportunities(profit_percent DESC);
CREATE INDEX IF NOT EXISTS idx_arb_detected ON arbitrage_opportunities(detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_arb_active ON arbitrage_opportunities(is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_arb_market ON arbitrage_opportunities(market_type);

-- ============================================================
-- API USAGE TRACKING TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS api_usage (
  id            UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  credits_used  INTEGER NOT NULL DEFAULT 0,
  request_time  TIMESTAMPTZ DEFAULT NOW(),
  sport         TEXT,
  markets       TEXT,
  note          TEXT
);

CREATE INDEX IF NOT EXISTS idx_api_usage_time ON api_usage(request_time DESC);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE odds ENABLE ROW LEVEL SECURITY;
ALTER TABLE arbitrage_opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_usage ENABLE ROW LEVEL SECURITY;

-- Public read
CREATE POLICY "Allow public read on matches"
  ON matches FOR SELECT USING (true);
CREATE POLICY "Allow public read on odds"
  ON odds FOR SELECT USING (true);
CREATE POLICY "Allow public read on arbitrage_opportunities"
  ON arbitrage_opportunities FOR SELECT USING (true);
CREATE POLICY "Allow public read on api_usage"
  ON api_usage FOR SELECT USING (true);

-- Service role write
CREATE POLICY "Allow service write on matches"
  ON matches FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Allow service write on odds"
  ON odds FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Allow service write on arbitrage_opportunities"
  ON arbitrage_opportunities FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Allow service write on api_usage"
  ON api_usage FOR ALL USING (auth.role() = 'service_role');

-- SureOdds Database Schema
-- Run this in your Supabase SQL editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- MATCHES TABLE
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
-- ODDS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS odds (
  id              UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  match_id        UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  bookmaker       TEXT NOT NULL,
  bookmaker_title TEXT,
  market_type     TEXT NOT NULL DEFAULT 'h2h',
  home_odds       DECIMAL(6,3),
  draw_odds       DECIMAL(6,3),
  away_odds       DECIMAL(6,3),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (match_id, bookmaker)
);

CREATE INDEX IF NOT EXISTS idx_odds_match_id ON odds(match_id);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_odds_updated_at
  BEFORE UPDATE ON odds
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- ARBITRAGE OPPORTUNITIES TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS arbitrage_opportunities (
  id              UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  match_id        UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  market_type     TEXT NOT NULL DEFAULT 'h2h',
  bookmaker_a     TEXT NOT NULL,
  bookmaker_b     TEXT NOT NULL,
  bookmaker_draw  TEXT,
  odds_a          DECIMAL(6,3) NOT NULL,
  odds_b          DECIMAL(6,3) NOT NULL,
  odds_draw       DECIMAL(6,3),
  profit_percent  DECIMAL(8,4) NOT NULL,
  arb_factor      DECIMAL(8,6) NOT NULL,
  detected_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_arb_match_id ON arbitrage_opportunities(match_id);
CREATE INDEX IF NOT EXISTS idx_arb_profit ON arbitrage_opportunities(profit_percent DESC);
CREATE INDEX IF NOT EXISTS idx_arb_detected ON arbitrage_opportunities(detected_at DESC);

-- ============================================================
-- ROW LEVEL SECURITY (for Supabase)
-- ============================================================

-- Allow public read access (adjust as needed for premium tiers)
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE odds ENABLE ROW LEVEL SECURITY;
ALTER TABLE arbitrage_opportunities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read on matches"
  ON matches FOR SELECT USING (true);

CREATE POLICY "Allow public read on odds"
  ON odds FOR SELECT USING (true);

CREATE POLICY "Allow public read on arbitrage_opportunities"
  ON arbitrage_opportunities FOR SELECT USING (true);

-- Only service role can write
CREATE POLICY "Allow service write on matches"
  ON matches FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Allow service write on odds"
  ON odds FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Allow service write on arbitrage_opportunities"
  ON arbitrage_opportunities FOR ALL USING (auth.role() = 'service_role');

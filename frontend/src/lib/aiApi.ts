import { api } from './api';
import type {
  MatchWithPrediction,
  MatchPredictionDetail,
  OddsHistoryPoint,
  OddsMovementItem,
  ValueBetMatch,
  AccuracyRecord,
  AccuracySummary,
} from '@/types/ai';

// ============================================================
// AI Predictions
// ============================================================
export async function getAiPredictions(params?: {
  sport?: string;
  date?: string;
  limit?: number;
}): Promise<MatchWithPrediction[]> {
  const { data } = await api.get('/api/ai/predictions', { params });
  return data.data;
}

export async function getAiPrediction(matchId: string): Promise<MatchPredictionDetail> {
  const { data } = await api.get(`/api/ai/predictions/${matchId}`);
  return data.data;
}

// ============================================================
// Odds History & Movement
// ============================================================
export async function getOddsHistory(
  matchId: string,
  params?: { bookmaker?: string; market_type?: string }
): Promise<OddsHistoryPoint[]> {
  const { data } = await api.get(`/api/ai/odds-history/${matchId}`, { params });
  return data.data;
}

export async function getOddsMovement(params?: {
  hours?: number;
  sport?: string;
  limit?: number;
}): Promise<OddsMovementItem[]> {
  const { data } = await api.get('/api/ai/odds-movement', { params });
  return data.data;
}

// ============================================================
// Value Bets
// ============================================================
export async function getValueBets(params?: {
  limit?: number;
}): Promise<ValueBetMatch[]> {
  const { data } = await api.get('/api/ai/value-bets', { params });
  return data.data;
}

// ============================================================
// Team Stats
// ============================================================
export interface TeamStats {
  id: string;
  team_name: string;
  sport: string;
  league: string;
  season: string;
  matches_played: number;
  goals_scored: number;
  goals_conceded: number;
  avg_goals_scored: number;
  avg_goals_conceded: number;
  attack_rating: number;
  defense_rating: number;
  elo_rating: number;
  form_last5: string;
  updated_at: string;
}

export interface LeagueInfo {
  league: string;
  sport: string;
  teamCount: number;
}

export async function getTeamStats(params?: {
  league?: string;
  sort?: string;
  order?: string;
  limit?: number;
}): Promise<TeamStats[]> {
  const { data } = await api.get('/api/ai/team-stats', { params });
  return data.data;
}

export async function getLeagues(): Promise<LeagueInfo[]> {
  const { data } = await api.get('/api/ai/leagues');
  return data.data;
}

// ============================================================
// 정확도
// ============================================================

export async function getAccuracyStats(params?: {
  model_type?: string;
  league?: string;
  limit?: number;
}): Promise<{ records: AccuracyRecord[]; summary: AccuracySummary | null }> {
  const { data } = await api.get('/api/ai/accuracy', { params });
  return { records: data.records, summary: data.summary };
}

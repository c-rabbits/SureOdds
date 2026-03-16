import { api } from './api';
import type {
  MatchWithPrediction,
  MatchPredictionDetail,
  OddsHistoryPoint,
  OddsMovementItem,
  ValueBetMatch,
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

import axios from 'axios';
import { Match, Odds, ArbitrageOpportunity, StakeCalculation } from '@/types';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000',
  timeout: 10000,
});

export async function getMatches(params?: {
  sport?: string;
  league?: string;
  limit?: number;
  offset?: number;
}): Promise<Match[]> {
  const { data } = await api.get('/api/matches', { params });
  return data.data;
}

export async function getMatch(id: string): Promise<Match> {
  const { data } = await api.get(`/api/matches/${id}`);
  return data.data;
}

export async function getOdds(matchId: string): Promise<Odds[]> {
  const { data } = await api.get(`/api/odds/${matchId}`);
  return data.data;
}

export async function getArbitrage(params?: {
  limit?: number;
  min_profit?: number;
}): Promise<ArbitrageOpportunity[]> {
  const { data } = await api.get('/api/arbitrage', { params });
  return data.data;
}

export async function calculateStakes(
  totalStake: number,
  odds: number[]
): Promise<StakeCalculation> {
  const { data } = await api.post('/api/arbitrage/calculate', { totalStake, odds });
  return data.data;
}

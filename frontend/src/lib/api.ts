import axios from 'axios';
import { Match, Odds, ArbitrageOpportunity, StakeCalculation, MatchWithOdds, CollectorStatus, QuotaInfo, MarketType, UserProfile } from '@/types';
import { supabase } from '@/lib/supabase';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000',
  timeout: 15000,
});

// ============================================================
// 인터셉터: 매 요청에 JWT 토큰 자동 주입
// ============================================================
api.interceptors.request.use(async (config) => {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) {
      config.headers.Authorization = `Bearer ${session.access_token}`;
    }
  } catch {
    // 세션 조회 실패 시 토큰 없이 진행
  }
  return config;
});

// 401 응답 시 로그인 페이지로 리다이렉트
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// ============================================================
// Matches
// ============================================================
export async function getMatches(params?: {
  sport?: string;
  league?: string;
  limit?: number;
  offset?: number;
}): Promise<Match[]> {
  const { data } = await api.get('/api/matches', { params });
  return data.data;
}

export async function getMatchesWithOdds(params?: {
  sport?: string;
  limit?: number;
}): Promise<MatchWithOdds[]> {
  const { data } = await api.get('/api/matches/with-odds', { params });
  return data.data;
}

export async function getMatch(id: string): Promise<Match> {
  const { data } = await api.get(`/api/matches/${id}`);
  return data.data;
}

// ============================================================
// Odds
// ============================================================
export async function getOdds(matchId: string, marketType?: MarketType): Promise<Odds[]> {
  const params: Record<string, string> = {};
  if (marketType) params.market_type = marketType;
  const { data } = await api.get(`/api/odds/${matchId}`, { params });
  return data.data;
}

// ============================================================
// Arbitrage
// ============================================================
export async function getArbitrage(params?: {
  limit?: number;
  min_profit?: number;
  market_type?: MarketType;
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

export async function calculateBatch(
  totalBankroll: number,
  opportunities: { odds: number[]; profit_percent?: number; matchId?: string; marketType?: string }[]
): Promise<{
  totalBankroll: number;
  results: (StakeCalculation & { allocatedStake: number })[];
  totalProfit: number;
  totalProfitPercent: number;
}> {
  const { data } = await api.post('/api/arbitrage/calculate-batch', { totalBankroll, opportunities });
  return data.data;
}

// ============================================================
// Collector
// ============================================================
export async function triggerCollection(
  sports?: string[],
  markets?: string[]
): Promise<{
  success: boolean;
  timestamp: string;
  matchesUpdated?: number;
  arbitrageFound?: number;
  creditsUsed?: number;
}> {
  const { data } = await api.post('/api/collector/trigger', { sports, markets });
  return data.data;
}

export async function getCollectorStatus(): Promise<CollectorStatus> {
  const { data } = await api.get('/api/collector/status');
  return data.data;
}

export async function getApiQuota(): Promise<QuotaInfo> {
  const { data } = await api.get('/api/collector/quota');
  return data.data;
}

// ============================================================
// Domestic (국내 배당)
// ============================================================
export async function scrapeBetman(): Promise<{ matches: number; oddsRows: number }> {
  const { data } = await api.post('/api/domestic/betman/scrape');
  return data.data;
}

export async function getBetmanStatus(): Promise<unknown> {
  const { data } = await api.get('/api/domestic/betman/status');
  return data.data;
}

export async function getBetmanRounds(): Promise<{ gmId: string; gmTs: string; name: string; status: string }[]> {
  const { data } = await api.get('/api/domestic/betman/rounds');
  return data.data;
}

export async function saveDomesticOdds(payload: {
  matchId: string;
  bookmaker: string;
  marketType: string;
  handicapPoint?: number;
  odds1: number | null;
  odds2: number | null;
  oddsDraw?: number | null;
}): Promise<{ success: boolean }> {
  const { data } = await api.post('/api/domestic/odds', payload);
  return data;
}

export async function linkMatches(
  domesticMatchId: string,
  internationalMatchId: string
): Promise<{ linkedOdds: number }> {
  const { data } = await api.post('/api/domestic/match-link', {
    domesticMatchId,
    internationalMatchId,
  });
  return data.data;
}

// ============================================================
// Auth API
// ============================================================
export async function getCurrentUser(): Promise<UserProfile> {
  const { data } = await api.get('/api/auth/me');
  return data.data;
}

// ============================================================
// Admin API
// ============================================================
export async function getUsers(): Promise<UserProfile[]> {
  const { data } = await api.get('/api/admin/users');
  return data.data;
}

export async function createUser(payload: {
  email: string;
  password: string;
  display_name?: string;
  role?: string;
}): Promise<{ id: string; email: string }> {
  const { data } = await api.post('/api/admin/users', payload);
  return data.data;
}

export async function updateUser(
  id: string,
  payload: { role?: string; is_active?: boolean; display_name?: string }
): Promise<UserProfile> {
  const { data } = await api.patch(`/api/admin/users/${id}`, payload);
  return data.data;
}

export async function deleteUser(id: string): Promise<void> {
  await api.delete(`/api/admin/users/${id}`);
}

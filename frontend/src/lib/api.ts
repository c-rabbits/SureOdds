import axios, { AxiosError } from 'axios';
import axiosRetry from 'axios-retry';
import { Match, Odds, ArbitrageOpportunity, StakeCalculation, MatchWithOdds, CollectorStatus, QuotaInfo, MarketType, UserProfile, SiteRegistration, SiteRequest, AvailableSite } from '@/types';
import { supabase } from '@/lib/supabase';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000',
  timeout: 15000,
});

// ============================================================
// 메모리 캐시 — 같은 요청 반복 방지 (TTL 기반)
// ============================================================
const cache = new Map<string, { data: unknown; expires: number }>();

function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (entry && entry.expires > Date.now()) return entry.data as T;
  cache.delete(key);
  return null;
}

function setCache(key: string, data: unknown, ttlMs: number) {
  cache.set(key, { data, expires: Date.now() + ttlMs });
}

/** 캐시 무효화 (수동 새로고침 시 호출) */
export function invalidateCache(prefix?: string) {
  if (!prefix) { cache.clear(); return; }
  Array.from(cache.keys()).forEach((key) => {
    if (key.startsWith(prefix)) cache.delete(key);
  });
}

/**
 * Stale-While-Revalidate 패턴.
 * - fresh (TTL 내): 캐시 즉시 반환
 * - stale (TTL 지남, staleMs 내): 캐시 즉시 반환 + 백그라운드 갱신
 * - expired: 새로 fetch
 */
export async function getWithSWR<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlMs: number,
  staleMs: number = ttlMs * 4,
): Promise<T> {
  const entry = cache.get(key);
  const now = Date.now();

  // Fresh: 즉시 반환
  if (entry && entry.expires > now) return entry.data as T;

  // Stale but usable: 즉시 반환 + 백그라운드 갱신
  if (entry && (entry.expires + staleMs) > now) {
    fetcher().then((data) => setCache(key, data, ttlMs)).catch(() => {});
    return entry.data as T;
  }

  // Expired 또는 없음: 새로 fetch
  const data = await fetcher();
  setCache(key, data, ttlMs);
  return data;
}

// ============================================================
// 네트워크 장애 시 자동 재시도 (최대 2회, 지수 백오프)
// ============================================================
axiosRetry(api, {
  retries: 2,
  retryDelay: axiosRetry.exponentialDelay,
  retryCondition: (error) => {
    // 네트워크 에러 or 타임아웃
    if (axiosRetry.isNetworkOrIdempotentRequestError(error)) return true;
    // 5xx 서버 에러
    if (error.response && error.response.status >= 500) return true;
    // 429 Rate Limit
    if (error.response && error.response.status === 429) return true;
    return false;
  },
  onRetry: (retryCount, error) => {
    console.warn(`[API] Retry #${retryCount}: ${error.message}`);
  },
});

// ============================================================
// 사용자 친화적 에러 메시지 매핑
// ============================================================
type ToastFn = (toast: { type: 'error' | 'warning'; title: string; message?: string; duration?: number }) => void;
let _addToast: ToastFn | null = null;

/** Toast 시스템 연결 (ToastProvider에서 호출) */
export function connectToast(fn: ToastFn) {
  _addToast = fn;
}

function getErrorMessage(error: AxiosError<{ error?: string }>): { title: string; message?: string } {
  // 네트워크 에러 (서버 미응답)
  if (!error.response) {
    if (error.code === 'ECONNABORTED') {
      return { title: '요청 시간 초과', message: '서버 응답이 너무 느립니다. 잠시 후 다시 시도해주세요.' };
    }
    return { title: '네트워크 오류', message: '서버에 연결할 수 없습니다. 인터넷 연결을 확인해주세요.' };
  }

  const status = error.response.status;
  const serverMsg = error.response.data?.error;

  switch (status) {
    case 400:
      return { title: '잘못된 요청', message: serverMsg || '입력 데이터를 확인해주세요.' };
    case 401:
      return { title: '인증 만료', message: '로그인이 필요합니다. 다시 로그인해주세요.' };
    case 403:
      return { title: '접근 권한 없음', message: serverMsg || '해당 기능에 대한 권한이 없습니다.' };
    case 404:
      return { title: '데이터 없음', message: serverMsg || '요청한 정보를 찾을 수 없습니다.' };
    case 429:
      return { title: 'API 호출 제한', message: 'API 요청 한도를 초과했습니다. 잠시 후 다시 시도해주세요.' };
    case 500:
      return { title: '서버 오류', message: serverMsg || '서버에서 오류가 발생했습니다. 잠시 후 다시 시도해주세요.' };
    case 502:
    case 503:
    case 504:
      return { title: '서버 점검 중', message: '서버가 일시적으로 응답하지 않습니다. 잠시 후 다시 시도해주세요.' };
    default:
      return { title: `오류 (${status})`, message: serverMsg || '알 수 없는 오류가 발생했습니다.' };
  }
}

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

// ============================================================
// 응답 인터셉터: 에러 Toast 표시 + 401 리다이렉트
// ============================================================
api.interceptors.response.use(
  (response) => response,
  (error: AxiosError<{ error?: string }>) => {
    const status = error.response?.status;

    // 401: 로그인 페이지로 리다이렉트
    if (status === 401) {
      const code = error.response?.data && (error.response.data as { code?: string }).code;
      if (code === 'SESSION_EXPIRED') {
        // 중복 로그인으로 세션 만료
        if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
          alert('다른 기기에서 로그인되어 현재 세션이 종료되었습니다.');
          window.location.href = '/login';
        }
        return Promise.reject(error);
      }
      if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
        window.location.href = '/login';
      }
    }

    // 503 유지보수 모드: 페이지 새로고침으로 LayoutContent가 차단 화면 표시
    if (status === 503 && error.response?.data && (error.response.data as { maintenance?: boolean }).maintenance) {
      if (typeof window !== 'undefined') {
        window.location.reload();
      }
      return Promise.reject(error);
    }

    // Toast로 에러 메시지 표시 (401 리다이렉트 시 제외, 무음 요청 제외)
    const silent = (error.config as { _silent?: boolean })?._silent;
    if (_addToast && !silent && status !== 401 && status !== 503) {
      const { title, message } = getErrorMessage(error);
      _addToast({ type: status && status >= 500 ? 'error' : 'warning', title, message });
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
  const cacheKey = `matches-with-odds:${JSON.stringify(params || {})}`;
  const cached = getCached<MatchWithOdds[]>(cacheKey);
  if (cached) return cached;
  const { data } = await api.get('/api/matches/with-odds', { params });
  setCache(cacheKey, data.data, 30000); // 30초 캐시
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
  const cacheKey = `arbitrage:${JSON.stringify(params || {})}`;
  const cached = getCached<ArbitrageOpportunity[]>(cacheKey);
  if (cached) return cached;
  const { data } = await api.get('/api/arbitrage', { params });
  setCache(cacheKey, data.data, 30000); // 30초 캐시
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
  // Backend-side scraping via Vercel Edge proxy (Korea ICN)
  // Backend calls Vercel Edge → betman.co.kr with bypass header
  const { data } = await api.post('/api/domestic/betman/scrape', {}, { timeout: 60000 });
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

export async function updateMyProfile(payload: { display_name: string }): Promise<UserProfile> {
  const { data } = await api.patch('/api/auth/me', payload);
  return data.data;
}

/** 로그인 후 세션 등록 (중복 로그인 제어용) */
export async function registerLoginSession(): Promise<UserProfile> {
  const { data } = await api.post('/api/auth/login');
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
  email?: string;
  username?: string;
  password: string;
  display_name?: string;
  role?: string;
}): Promise<{ id: string; email: string; username?: string }> {
  const { data } = await api.post('/api/admin/users', payload);
  return data.data;
}

export async function updateUser(
  id: string,
  payload: {
    role?: string; is_active?: boolean; display_name?: string;
    vip_expires_at?: string | null; admin_memo?: string | null;
    suspended_until?: string | null; suspended_reason?: string | null;
  }
): Promise<UserProfile> {
  const { data } = await api.patch(`/api/admin/users/${id}`, payload);
  return data.data;
}

export async function deleteUser(id: string): Promise<void> {
  await api.delete(`/api/admin/users/${id}`);
}

export async function changeUserPassword(id: string, password: string): Promise<void> {
  await api.patch(`/api/admin/users/${id}/password`, { password });
}

export async function getUserActivity(id: string, params?: { limit?: number; offset?: number; action?: string }) {
  const { data } = await api.get(`/api/admin/users/${id}/activity`, { params });
  return data.data;
}

export async function getUserStats(id: string) {
  const { data } = await api.get(`/api/admin/users/${id}/stats`);
  return data.data;
}

// ============================================================
// Unmatched Teams (미매칭 팀명)
// ============================================================
export async function getUnmatchedTeams(showResolved = false) {
  const { data } = await api.get('/api/admin/unmatched-teams', { params: { resolved: showResolved } });
  return data.data;
}

export async function updateUnmatchedTeam(id: string, payload: { english_name?: string | null; resolved?: boolean }) {
  const { data } = await api.patch(`/api/admin/unmatched-teams/${id}`, payload);
  return data.data;
}

export async function deleteUnmatchedTeam(id: string) {
  await api.delete(`/api/admin/unmatched-teams/${id}`);
}

// ============================================================
// Team Logos
// ============================================================
const logoCache: Record<string, string | null> = {};
const pendingLogos: Set<string> = new Set();
let logoFetchTimer: ReturnType<typeof setTimeout> | null = null;
const logoCallbacks: Array<() => void> = [];

export function getTeamLogoUrl(teamName: string): string | null {
  return logoCache[teamName] ?? null;
}

export function requestTeamLogos(teams: string[], onLoaded?: () => void) {
  const missing = teams.filter(t => t && logoCache[t] === undefined);
  if (missing.length === 0) {
    onLoaded?.();
    return;
  }
  for (const t of missing) pendingLogos.add(t);
  if (onLoaded) logoCallbacks.push(onLoaded);

  // Debounce: batch requests
  if (logoFetchTimer) clearTimeout(logoFetchTimer);
  logoFetchTimer = setTimeout(async () => {
    const batch = Array.from(pendingLogos).slice(0, 50);
    pendingLogos.clear();
    try {
      const { data } = await api.post('/api/logos/batch', { teams: batch });
      if (data.logos) {
        for (const [name, url] of Object.entries(data.logos)) {
          logoCache[name] = url as string | null;
        }
      }
    } catch { /* ignore */ }
    const cbs = logoCallbacks.splice(0);
    cbs.forEach(cb => cb());
  }, 200);
}

// ============================================================
// Available Sites (마스터 사이트 목록 - 드롭다운용)
// ============================================================
export async function getAvailableSites(): Promise<AvailableSite[]> {
  const cacheKey = 'available-sites';
  const cached = getCached<AvailableSite[]>(cacheKey);
  if (cached) return cached;
  const { data } = await api.get('/api/domestic/available-sites');
  setCache(cacheKey, data.data, 60000); // 60초 캐시
  return data.data;
}

// Admin: available sites CRUD
export async function getAdminAvailableSites(): Promise<AvailableSite[]> {
  const { data } = await api.get('/api/admin/available-sites');
  return data.data;
}

export async function createAvailableSite(payload: {
  siteUrl: string;
  siteName: string;
  description?: string;
}): Promise<AvailableSite> {
  const { data } = await api.post('/api/admin/available-sites', payload);
  return data.data;
}

export async function updateAvailableSite(
  id: string,
  payload: { siteName?: string; siteUrl?: string; description?: string; isActive?: boolean }
): Promise<AvailableSite> {
  const { data } = await api.patch(`/api/admin/available-sites/${id}`, payload);
  return data.data;
}

export async function deleteAvailableSite(id: string): Promise<void> {
  await api.delete(`/api/admin/available-sites/${id}`);
}

// ============================================================
// Site Registration (사이트 추가)
// ============================================================
export async function createSiteRegistration(payload: {
  availableSiteId: string;
  groupName?: string;
  loginId?: string;
  loginPw?: string;
  checkInterval?: number;
  enableCross?: boolean;
  enableHandicap?: boolean;
  enableOU?: boolean;
}): Promise<SiteRegistration> {
  const { data } = await api.post('/api/domestic/site-registrations', payload);
  return data.data;
}

export async function getSiteRegistrations(): Promise<SiteRegistration[]> {
  const { data } = await api.get('/api/domestic/site-registrations');
  return data.data;
}

export async function updateSiteRegistration(
  id: string,
  payload: Partial<{
    siteName: string;
    groupName: string;
    loginId: string;
    checkInterval: number;
    enableCross: boolean;
    enableHandicap: boolean;
    enableOU: boolean;
    isActive: boolean;
  }>
): Promise<SiteRegistration> {
  const { data } = await api.patch(`/api/domestic/site-registrations/${id}`, payload);
  return data.data;
}

export async function reloginSiteRegistration(
  id: string,
  payload: { loginId?: string; loginPw: string }
): Promise<SiteRegistration> {
  const { data } = await api.post(`/api/domestic/site-registrations/${id}/relogin`, payload);
  return data.data;
}

export async function deleteSiteRegistration(id: string): Promise<void> {
  await api.delete(`/api/domestic/site-registrations/${id}`);
}

// ============================================================
// Site Requests (사이트 작업요청)
// ============================================================
export async function createSiteRequest(payload: {
  siteUrl: string;
  siteName?: string;
  notes?: string;
}): Promise<SiteRequest> {
  const { data } = await api.post('/api/domestic/site-requests', payload);
  return data.data;
}

export async function getSiteRequests(): Promise<SiteRequest[]> {
  const { data } = await api.get('/api/domestic/site-requests');
  return data.data;
}

// Admin: update site request status
export async function updateSiteRequest(
  id: string,
  payload: { status?: string; adminNotes?: string }
): Promise<SiteRequest> {
  const { data } = await api.patch(`/api/domestic/site-requests/${id}`, payload);
  return data.data;
}

// Admin: get all site registrations
export async function getAdminSiteRegistrations(): Promise<(SiteRegistration & { profiles?: { email: string; display_name: string | null; username: string | null } })[]> {
  const { data } = await api.get('/api/admin/site-registrations');
  return data.data;
}

// Admin: update site registration status
export async function updateAdminSiteRegistration(
  id: string,
  payload: { status?: string; isActive?: boolean }
): Promise<SiteRegistration> {
  const { data } = await api.patch(`/api/admin/site-registrations/${id}`, payload);
  return data.data;
}

// Admin: get all site requests
export async function getAdminSiteRequests(): Promise<(SiteRequest & { profiles?: { email: string; display_name: string | null; username: string | null } })[]> {
  const { data } = await api.get('/api/admin/site-requests');
  return data.data;
}

// Admin: update site request status
export async function updateAdminSiteRequest(
  id: string,
  payload: { status?: string; adminNotes?: string }
): Promise<SiteRequest> {
  const { data } = await api.patch(`/api/domestic/site-requests/${id}`, payload);
  return data.data;
}

// ============================================================
// Telegram 연동
// ============================================================

export async function getTelegramStatus(): Promise<{ linked: boolean; linkedAt: string | null }> {
  const { data } = await api.get('/api/telegram/status');
  return data;
}

export async function generateTelegramLink(): Promise<{ link: string; expiresAt: string }> {
  const { data } = await api.post('/api/telegram/link');
  return data;
}

export async function unlinkTelegram(): Promise<void> {
  await api.delete('/api/telegram/link');
}

// ============================================================
// 관리자 설정
// ============================================================

export async function getAdminSettings(): Promise<Record<string, string>> {
  const { data } = await api.get('/api/admin/settings');
  return data.data;
}

export async function updateAdminSetting(key: string, value: unknown): Promise<void> {
  await api.patch('/api/admin/settings', { key, value });
}

// ============================================================
// AI 분석 (관리자용)
// ============================================================

export async function getAiAnalysisMatches() {
  const { data } = await api.get('/api/admin/ai-analysis/matches');
  return data.data;
}

export async function generateAiAnalysis(matchId: string, forceRefresh = false) {
  const { data } = await api.post(`/api/admin/ai-analysis/generate/${matchId}`, { forceRefresh }, { timeout: 120000 });
  return data.data;
}

export async function generateTopAiAnalyses(count = 3) {
  const { data } = await api.post('/api/admin/ai-analysis/generate-top', { count }, { timeout: 300000 });
  return data.data;
}

export async function getAiAnalysisReport(matchId: string) {
  const { data } = await api.get(`/api/admin/ai-analysis/report/${matchId}`);
  return data.data;
}

export async function getAiAnalysisReports() {
  const { data } = await api.get('/api/admin/ai-analysis/reports');
  return data.data;
}

// ============================================================
// 수집기 모니터링 (관리자용) — 추가 함수
// ============================================================

export async function getCollectorQuota() {
  const { data } = await api.get('/api/collector/quota');
  return data.data;
}

export async function getTeamStatsStatus() {
  const { data } = await api.get('/api/collector/team-stats-status');
  return data.data;
}

export async function triggerOddsApiIo() {
  const { data } = await api.post('/api/collector/trigger-oddsapiio', {}, { timeout: 60000 });
  return data.data;
}

export async function triggerTeamStats() {
  const { data } = await api.post('/api/collector/trigger-team-stats', {}, { timeout: 120000 });
  return data.data;
}

// axios 인스턴스 export (aiApi.ts에서 재사용)
export { api };

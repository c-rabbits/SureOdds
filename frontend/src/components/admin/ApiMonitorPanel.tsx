'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  getCollectorStatus,
  getCollectorQuota,
  getTeamStatsStatus,
  triggerCollection,
  triggerOddsApiIo,
  triggerTeamStats,
} from '@/lib/api';

// Note: getCollectorStatus, triggerCollection are pre-existing in api.ts
// getCollectorQuota, getTeamStatsStatus, triggerOddsApiIo, triggerTeamStats are new

// ─── 타입 ───

interface ApiCard {
  name: string;
  key: string;
  interval: string;
  quotaLabel: string;
  status: 'ok' | 'error' | 'unknown' | 'idle';
  lastRun: string | null;
  nextInfo: string;
  matchCount: number | null;
  quotaUsed: number | null;
  quotaRemaining: number | null;
  quotaTotal: number | null;
  error: string | null;
  canTrigger: boolean;
}

function timeAgo(iso: string | null): string {
  if (!iso) return '-';
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 0) return '방금';
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return '방금';
  if (mins < 60) return `${mins}분 전`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}시간 ${mins % 60}분 전`;
  const days = Math.floor(hours / 24);
  return `${days}일 전`;
}

// ─── 메인 컴포넌트 ───

export default function ApiMonitorPanel() {
  const [cards, setCards] = useState<ApiCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const loadStatus = useCallback(async () => {
    try {
      const [status, quota, teamStats] = await Promise.allSettled([
        getCollectorStatus(),
        getCollectorQuota(),
        getTeamStatsStatus(),
      ]);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const s: any = status.status === 'fulfilled' ? status.value : null;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const q: any = quota.status === 'fulfilled' ? quota.value : null;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ts: any = teamStats.status === 'fulfilled' ? teamStats.value : null;

      const lastResult = s?.lastResult;
      const pinnacle = s?.pinnacle;
      const stake = s?.stake;
      const oddsApiIo = s?.oddsApiIo;

      const apiCards: ApiCard[] = [
        // 1. The Odds API
        {
          name: 'The Odds API',
          key: 'theoddsapi',
          interval: '4시간',
          quotaLabel: '월 500 요청',
          status: lastResult?.theOddsApi?.success === false ? 'error' : lastResult?.timestamp ? 'ok' : 'unknown',
          lastRun: lastResult?.theOddsApi?.timestamp || lastResult?.timestamp || null,
          nextInfo: `${s?.config?.sports?.length || 0}개 종목`,
          matchCount: lastResult?.theOddsApi?.matchesUpdated ?? lastResult?.matchesUpdated ?? null,
          quotaUsed: q?.monthlyUsed ?? s?.quota?.used ?? null,
          quotaRemaining: q?.monthlyRemaining ?? s?.quota?.remaining ?? null,
          quotaTotal: q?.monthlyLimit ?? 500,
          error: lastResult?.theOddsApi?.error || null,
          canTrigger: true,
        },
        // 2. Odds-API.io
        {
          name: 'Odds-API.io',
          key: 'oddsapiio',
          interval: oddsApiIo?.schedulerInterval || '10분',
          quotaLabel: '시간당 100 요청',
          status: oddsApiIo?.lastResult?.success === false ? 'error' :
                  oddsApiIo?.configured === false ? 'idle' :
                  oddsApiIo?.lastResult ? 'ok' : 'unknown',
          lastRun: oddsApiIo?.lastResult?.timestamp || null,
          nextInfo: `${oddsApiIo?.lastResult?.sports?.length || 0}개 종목`,
          matchCount: oddsApiIo?.lastResult?.totalMatches ?? null,
          quotaUsed: oddsApiIo?.requestCount ?? null,
          quotaRemaining: oddsApiIo?.requestCount != null ? Math.max(0, 100 - oddsApiIo.requestCount) : null,
          quotaTotal: 100,
          error: oddsApiIo?.lastResult?.error || (oddsApiIo?.rateLimitHit ? 'Rate limit 도달' : null),
          canTrigger: true,
        },
        // 3. Pinnacle Direct
        {
          name: 'Pinnacle Direct',
          key: 'pinnacle',
          interval: '5분',
          quotaLabel: '2분/1요청/종목',
          status: pinnacle?.configured === false ? 'idle' :
                  pinnacle?.lastError ? 'error' :
                  pinnacle?.lastFetchAt ? 'ok' : 'unknown',
          lastRun: pinnacle?.lastFetchAt || null,
          nextInfo: `${pinnacle?.sportCount || 0}개 종목`,
          matchCount: pinnacle?.lastMatchCount ?? null,
          quotaUsed: null,
          quotaRemaining: null,
          quotaTotal: null,
          error: pinnacle?.lastError || (pinnacle?.configured === false ? '미설정 (계정 필요)' : null),
          canTrigger: false,
        },
        // 4. Betman Proto
        {
          name: 'Betman Proto',
          key: 'betman',
          interval: '5분',
          quotaLabel: '제한 없음',
          status: lastResult?.betman?.success === false ? 'error' :
                  lastResult?.betman?.rounds != null ? 'ok' : 'unknown',
          lastRun: lastResult?.timestamp || null,
          nextInfo: `${lastResult?.betman?.rounds || 0}개 라운드`,
          matchCount: lastResult?.betman?.matches ?? null,
          quotaUsed: null,
          quotaRemaining: null,
          quotaTotal: null,
          error: lastResult?.betman?.error || null,
          canTrigger: false,
        },
        // 5. Stake.com
        {
          name: 'Stake.com',
          key: 'stake',
          interval: '5분',
          quotaLabel: '제한 없음',
          status: stake?.success === false ? 'error' :
                  stake?.timestamp ? 'ok' : 'unknown',
          lastRun: stake?.timestamp || null,
          nextInfo: `${stake?.sports?.length || 0}개 종목`,
          matchCount: stake?.totalMatches ?? null,
          quotaUsed: null,
          quotaRemaining: null,
          quotaTotal: null,
          error: stake?.error || null,
          canTrigger: false,
        },
        // 6. API-Football
        {
          name: 'API-Football',
          key: 'apifootball',
          interval: '매일 06:00',
          quotaLabel: '일 100 요청',
          status: ts?.lastResult?.success === false ? 'error' :
                  ts?.lastResult ? 'ok' : 'unknown',
          lastRun: ts?.lastResult?.timestamp || null,
          nextInfo: `${ts?.lastResult?.leaguesUpdated || 0}개 리그`,
          matchCount: ts?.lastResult?.matchesProcessed ?? null,
          quotaUsed: ts?.quota?.used ?? null,
          quotaRemaining: ts?.quota?.remaining ?? null,
          quotaTotal: 100,
          error: ts?.lastResult?.error || null,
          canTrigger: true,
        },
      ];

      setCards(apiCards);
      setLastRefresh(new Date());
    } catch (err) {
      console.error('Failed to load collector status', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStatus();
    const interval = setInterval(loadStatus, 30000); // 30초 자동 갱신
    return () => clearInterval(interval);
  }, [loadStatus]);

  // 수동 트리거
  const handleTrigger = async (key: string) => {
    setTriggering(key);
    try {
      if (key === 'theoddsapi') await triggerCollection();
      else if (key === 'oddsapiio') await triggerOddsApiIo();
      else if (key === 'apifootball') await triggerTeamStats();
      await loadStatus();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : '트리거 실패');
    } finally {
      setTriggering(null);
    }
  };

  const statusIcon = (s: string) => {
    switch (s) {
      case 'ok': return <span className="text-green-400 text-lg">●</span>;
      case 'error': return <span className="text-red-400 text-lg">●</span>;
      case 'idle': return <span className="text-gray-500 text-lg">●</span>;
      default: return <span className="text-yellow-400 text-lg">●</span>;
    }
  };

  const statusLabel = (s: string) => {
    switch (s) {
      case 'ok': return '정상';
      case 'error': return '오류';
      case 'idle': return '비활성';
      default: return '대기';
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-gray-400">수집기 상태 로딩 중...</div>;
  }

  return (
    <div className="space-y-4">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-white font-medium">API 크롤링 모니터링</h4>
          <p className="text-xs text-gray-500 mt-0.5">
            {lastRefresh ? `마지막 갱신: ${lastRefresh.toLocaleTimeString('ko-KR')}` : ''} · 30초마다 자동 갱신
          </p>
        </div>
        <button
          onClick={loadStatus}
          className="bg-gray-700 hover:bg-gray-600 text-white p-2 rounded-lg transition-colors"
          title="새로고침"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
      </div>

      {/* API 카드 그리드 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {cards.map(card => (
          <div key={card.key} className={`rounded-xl border p-4 ${
            card.status === 'error' ? 'bg-red-900/10 border-red-700/30' :
            card.status === 'ok' ? 'bg-gray-800/50 border-gray-700' :
            card.status === 'idle' ? 'bg-gray-800/30 border-gray-700/50' :
            'bg-yellow-900/10 border-yellow-700/30'
          }`}>
            {/* 헤더 */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                {statusIcon(card.status)}
                <span className="text-white font-semibold text-sm">{card.name}</span>
              </div>
              <span className={`text-xs px-2 py-0.5 rounded ${
                card.status === 'ok' ? 'bg-green-900/30 text-green-400' :
                card.status === 'error' ? 'bg-red-900/30 text-red-400' :
                card.status === 'idle' ? 'bg-gray-700/50 text-gray-500' :
                'bg-yellow-900/30 text-yellow-400'
              }`}>
                {statusLabel(card.status)}
              </span>
            </div>

            {/* 정보 */}
            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-400">수집 주기</span>
                <span className="text-gray-200">{card.interval}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">마지막 수집</span>
                <span className="text-gray-200">{timeAgo(card.lastRun)}</span>
              </div>
              {card.matchCount != null && (
                <div className="flex justify-between">
                  <span className="text-gray-400">수집 경기</span>
                  <span className="text-gray-200">{card.matchCount}개 · {card.nextInfo}</span>
                </div>
              )}

              {/* 쿼터 바 */}
              {card.quotaTotal != null && card.quotaUsed != null && (
                <div className="mt-2">
                  <div className="flex justify-between mb-1">
                    <span className="text-gray-400">쿼터</span>
                    <span className="text-gray-200">{card.quotaUsed}/{card.quotaTotal} ({card.quotaLabel})</span>
                  </div>
                  <div className="w-full h-1.5 bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        (card.quotaUsed / card.quotaTotal) > 0.8 ? 'bg-red-500' :
                        (card.quotaUsed / card.quotaTotal) > 0.5 ? 'bg-yellow-500' : 'bg-green-500'
                      }`}
                      style={{ width: `${Math.min(100, (card.quotaUsed / card.quotaTotal) * 100)}%` }}
                    />
                  </div>
                </div>
              )}

              {/* 에러 */}
              {card.error && (
                <div className="mt-2 p-2 bg-red-900/20 border border-red-700/30 rounded text-red-300 text-xs">
                  {card.error}
                </div>
              )}
            </div>

            {/* 수동 트리거 */}
            {card.canTrigger && (
              <button
                onClick={() => handleTrigger(card.key)}
                disabled={triggering === card.key}
                className="mt-3 w-full text-xs px-3 py-1.5 rounded-lg bg-purple-600/20 text-purple-300 hover:bg-purple-600/40 disabled:bg-gray-700/30 disabled:text-gray-500 transition-colors"
              >
                {triggering === card.key ? '수집 중...' : '수동 수집'}
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

'use client';

import { FilterState, MarketType, QuotaInfo } from '@/types';
import { SPORT_CATEGORIES, getMarketLabel } from '@/lib/utils';

interface Props {
  filters: FilterState;
  onToggleSport: (sport: string) => void;
  onToggleMarketType: (mt: MarketType) => void;
  onSetMinProfit: (v: number) => void;
  onSetSort: (field: 'profit' | 'time') => void;
  matchCount: number;
  arbCount: number;
  topProfit: number;
  lastUpdated: Date | null;
  loading: boolean;
  onRefresh: () => void;
  quota: QuotaInfo | null;
  onOpenAlertSettings: () => void;
}

const SPORT_KR: Record<string, string> = {
  all: '전체',
  soccer: '축구',
  basketball: '농구',
  baseball: '야구',
  hockey: '하키',
};

export default function Toolbar({
  filters,
  onToggleSport,
  onToggleMarketType,
  onSetMinProfit,
  onSetSort,
  matchCount,
  arbCount,
  topProfit,
  lastUpdated,
  loading,
  onRefresh,
  quota,
  onOpenAlertSettings,
}: Props) {
  return (
    <div className="bg-gray-900 border-b border-gray-800 px-3 py-2 flex items-center gap-x-3 text-xs overflow-x-auto whitespace-nowrap shrink-0">
      {/* 통계 */}
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-gray-400">
          <span className="text-white font-bold">{matchCount}</span> 경기
        </span>
        <span className="text-gray-400">
          <span className="text-green-400 font-bold">{arbCount}</span> 양방
        </span>
        {topProfit > 0 && (
          <span className="text-green-400 font-bold">
            최고: +{topProfit.toFixed(2)}%
          </span>
        )}
      </div>

      <div className="h-4 w-px bg-gray-700 shrink-0" />

      {/* 종목 필터 */}
      <div className="flex items-center gap-1 shrink-0">
        {SPORT_CATEGORIES.map((cat) => {
          const isActive = cat.key === 'all'
            ? filters.sports.length === 0
            : filters.sports.includes(cat.key);
          return (
            <button
              key={cat.key}
              onClick={() => onToggleSport(cat.key)}
              className={`filter-pill ${isActive ? 'filter-pill-active' : 'filter-pill-inactive'}`}
            >
              {cat.emoji} {SPORT_KR[cat.key] || cat.label}
            </button>
          );
        })}
      </div>

      <div className="h-4 w-px bg-gray-700 shrink-0" />

      {/* 마켓 필터 */}
      <div className="flex items-center gap-1 shrink-0">
        {(['h2h', 'spreads', 'totals'] as MarketType[]).map((mt) => {
          const isActive = filters.marketTypes.includes(mt);
          return (
            <button
              key={mt}
              onClick={() => onToggleMarketType(mt)}
              className={`filter-pill ${isActive ? 'filter-pill-active' : 'filter-pill-inactive'}`}
            >
              {getMarketLabel(mt)}
            </button>
          );
        })}
      </div>

      <div className="h-4 w-px bg-gray-700 shrink-0" />

      {/* 최소 수익률 */}
      <div className="flex items-center gap-1 shrink-0">
        <span className="text-gray-500">최소:</span>
        {[0, 0.5, 1, 2].map((v) => (
          <button
            key={v}
            onClick={() => onSetMinProfit(v)}
            className={`filter-pill ${filters.minProfit === v ? 'filter-pill-active' : 'filter-pill-inactive'}`}
          >
            {v === 0 ? '전체' : `${v}%+`}
          </button>
        ))}
      </div>

      <div className="h-4 w-px bg-gray-700 shrink-0" />

      {/* 정렬 */}
      <div className="flex items-center gap-1 shrink-0">
        <span className="text-gray-500">정렬:</span>
        <button
          onClick={() => onSetSort('profit')}
          className={`filter-pill ${filters.sortBy === 'profit' ? 'filter-pill-active' : 'filter-pill-inactive'}`}
        >
          수익률 {filters.sortBy === 'profit' && (filters.sortDir === 'desc' ? '↓' : '↑')}
        </button>
        <button
          onClick={() => onSetSort('time')}
          className={`filter-pill ${filters.sortBy === 'time' ? 'filter-pill-active' : 'filter-pill-inactive'}`}
        >
          시간 {filters.sortBy === 'time' && (filters.sortDir === 'desc' ? '↓' : '↑')}
        </button>
      </div>

      {/* 스페이서 */}
      <div className="flex-1 min-w-[8px]" />

      {/* 우측: 액션 */}
      <div className="flex items-center gap-2 shrink-0">
        <button onClick={onOpenAlertSettings} className="btn-icon" title="알림 설정">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
        </button>

        {quota && quota.monthlyRemaining !== undefined && (
          <span className="text-gray-500" title="이번 달 잔여 API 크레딧">
            {quota.monthlyRemaining}/{quota.monthlyLimit}
          </span>
        )}

        <button
          onClick={onRefresh}
          disabled={loading}
          className="btn-sm bg-green-600 hover:bg-green-500 text-white disabled:opacity-50"
        >
          {loading ? '로딩중...' : '새로고침'}
        </button>

        <div className="flex items-center gap-1.5">
          {lastUpdated && (
            <span className="text-gray-500">
              {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          <div className={`w-2 h-2 rounded-full ${loading ? 'bg-yellow-400 animate-pulse' : 'bg-green-400'}`} />
        </div>
      </div>
    </div>
  );
}

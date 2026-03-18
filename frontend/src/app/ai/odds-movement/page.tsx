'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import type { OddsMovementItem } from '@/types/ai';
import { getOddsMovement } from '@/lib/aiApi';
import { getKoreanTeamName } from '@/lib/teamNames';
import { getKoreanLeagueName } from '@/lib/leagueNames';
import { getSportEmoji, getBookmakerShort, formatShortTime } from '@/lib/utils';

type SortField = 'change' | 'time';
type SortDir = 'asc' | 'desc';

export default function OddsMovementPage() {
  const [movements, setMovements] = useState<OddsMovementItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [hours, setHours] = useState(24);
  const [sortField, setSortField] = useState<SortField>('change');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const data = await getOddsMovement({ hours, limit: 50 });
        setMovements(data || []);
      } catch (err) {
        console.error('Failed to load odds movement:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [hours]);

  function handleSort(field: SortField) {
    if (sortField === field) {
      setSortDir((prev) => (prev === 'desc' ? 'asc' : 'desc'));
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  }

  const sorted = useMemo(() => {
    const list = [...movements];
    list.sort((a, b) => {
      let cmp = 0;
      if (sortField === 'change') {
        cmp = Math.abs(a.change_pct) - Math.abs(b.change_pct);
      } else {
        cmp = new Date(a.start_time).getTime() - new Date(b.start_time).getTime();
      }
      return sortDir === 'desc' ? -cmp : cmp;
    });
    return list;
  }, [movements, sortField, sortDir]);

  return (
    <div className="p-4 pb-8 max-w-4xl mx-auto">
      {/* 헤더 */}
      <div className="mb-4">
        <h1 className="text-lg font-bold text-white mb-1">📈 배당 변동</h1>
        <p className="text-sm text-gray-500">배당이 크게 변동한 경기를 추적합니다</p>
      </div>

      {/* 필터 바 */}
      <div className="flex items-center gap-1.5 mb-4 overflow-x-auto pb-0.5">
        {/* 기간 필터 */}
        {[6, 12, 24, 48].map((h) => (
          <button
            key={h}
            onClick={() => setHours(h)}
            className={`text-xs px-2 py-1 rounded-md transition-colors ${
              hours === h
                ? 'bg-purple-600/20 text-purple-400 border border-purple-500/30'
                : 'text-gray-500 hover:text-gray-300 bg-gray-800/60'
            }`}
          >
            {h}h
          </button>
        ))}

        <div className="h-4 w-px bg-gray-700 shrink-0" />

        {/* 정렬 */}
        <button
          onClick={() => handleSort('change')}
          className={`text-xs px-2 py-1 rounded-md transition-colors ${
            sortField === 'change'
              ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
              : 'text-gray-500 hover:text-gray-300 bg-gray-800/60'
          }`}
        >
          변동률{sortField === 'change' ? (sortDir === 'desc' ? '↓' : '↑') : ''}
        </button>
        <button
          onClick={() => handleSort('time')}
          className={`text-xs px-2 py-1 rounded-md transition-colors ${
            sortField === 'time'
              ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
              : 'text-gray-500 hover:text-gray-300 bg-gray-800/60'
          }`}
        >
          시간{sortField === 'time' ? (sortDir === 'desc' ? '↓' : '↑') : ''}
        </button>
      </div>

      {/* 결과 카운트 */}
      {!loading && movements.length > 0 && (
        <div className="text-xs text-gray-600 mb-3">
          총 <span className="text-gray-400 font-medium">{movements.length}</span>건
        </div>
      )}

      {/* 콘텐츠 */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-[88px] bg-gray-800/40 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : sorted.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <p className="text-3xl mb-3">📭</p>
          <p className="text-sm">최근 {hours}시간 내 배당 변동 데이터가 없습니다.</p>
          <p className="text-xs text-gray-600 mt-1">데이터가 축적되면 자동으로 표시됩니다.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-[12px]">
          {sorted.map((m, i) => (
            <Link key={`${m.match_id}-${m.bookmaker}-${m.outcome}-${i}`} href={`/ai/match/${m.match_id}`} className="block">
              <div className="rounded-xl border border-gray-800 bg-gray-900/60 hover:border-gray-600 hover:bg-gray-900 transition-all cursor-pointer">
                {/* 상단: 리그 + 시간 */}
                <div className="flex items-center justify-between px-4 pt-3 pb-1.5">
                  <div className="flex items-center gap-1.5 text-xs text-gray-500 min-w-0 flex-1">
                    <span className="shrink-0">{getSportEmoji(m.sport)}</span>
                    <span className="truncate">{getKoreanLeagueName(m.league)}</span>
                  </div>
                  <span className="text-xs text-gray-600 shrink-0 ml-2">
                    {formatShortTime(m.start_time)}
                  </span>
                </div>

                {/* 중단: 팀명 + 변동률 */}
                <div className="flex items-center justify-between gap-3 px-4 pb-1.5">
                  <div className="min-w-0 flex-1">
                    <span className="text-sm text-white font-medium block truncate">
                      {getKoreanTeamName(m.home_team)}
                    </span>
                    <span className="text-sm text-gray-400 block truncate">
                      {getKoreanTeamName(m.away_team)}
                    </span>
                  </div>
                  <div className="shrink-0 text-right">
                    <span className={`text-lg font-bold font-mono ${
                      m.direction === 'up' ? 'text-red-400' : 'text-green-400'
                    }`}>
                      {m.direction === 'up' ? '↑' : '↓'}{Math.abs(m.change_pct).toFixed(1)}%
                    </span>
                  </div>
                </div>

                {/* 하단: 배당 상세 */}
                <div className="flex items-center justify-between gap-2 px-4 pb-3 pt-1 border-t border-gray-800/40">
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                      m.outcome === 'home' ? 'bg-blue-500/15 text-blue-400' : 'bg-red-500/15 text-red-400'
                    }`}>
                      {m.outcome === 'home' ? '홈승' : m.outcome === 'away' ? '원정승' : '무승부'}
                    </span>
                    <span className="text-gray-600">{getBookmakerShort(m.bookmaker)}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-sm font-mono shrink-0">
                    <span className="text-gray-500">{m.old_odds.toFixed(2)}</span>
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-600">
                      <path d="M5 12h14" /><path d="m12 5 7 7-7 7" />
                    </svg>
                    <span className="text-white font-bold">{m.new_odds.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

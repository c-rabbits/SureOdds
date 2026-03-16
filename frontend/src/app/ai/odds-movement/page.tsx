'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { OddsMovementItem } from '@/types/ai';
import { getOddsMovement } from '@/lib/aiApi';
import { getKoreanTeamName } from '@/lib/teamNames';
import { getSportEmoji, getBookmakerShort, formatShortTime } from '@/lib/utils';

export default function OddsMovementPage() {
  const [movements, setMovements] = useState<OddsMovementItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [hours, setHours] = useState(24);

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

  return (
    <div className="p-4 pb-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-lg font-bold text-white">📈 배당 변동</h1>
          <p className="text-xs text-gray-500 mt-0.5">배당이 크게 변동한 경기를 추적합니다</p>
        </div>
        <div className="flex gap-1">
          {[6, 12, 24, 48].map((h) => (
            <button
              key={h}
              onClick={() => setHours(h)}
              className={`text-[10px] px-2.5 py-1.5 rounded ${
                hours === h
                  ? 'bg-purple-600/20 text-purple-400 border border-purple-500/30'
                  : 'text-gray-500 hover:text-gray-300 bg-gray-800/50'
              }`}
            >
              {h}시간
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-16 bg-gray-800/50 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : movements.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <p className="text-lg mb-2">📭</p>
          <p>최근 {hours}시간 내 배당 변동 데이터가 없습니다.</p>
          <p className="text-xs mt-1">데이터가 축적되면 자동으로 표시됩니다.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {movements.map((m, i) => (
            <Link key={i} href={`/ai/match/${m.match_id}`}>
              <div className="rounded-lg border border-gray-800 bg-gray-900/50 p-3 hover:border-gray-600 transition-colors cursor-pointer">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-sm">{getSportEmoji(m.sport)}</span>
                    <div className="min-w-0">
                      <span className="text-sm text-white truncate block">
                        {getKoreanTeamName(m.home_team)} vs {getKoreanTeamName(m.away_team)}
                      </span>
                      <span className="text-[10px] text-gray-500">
                        {m.league} · {formatShortTime(m.start_time)}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right">
                      <div className="flex items-center gap-1.5 text-xs">
                        <span className="text-gray-500">{m.outcome === 'home' ? '홈승' : '원정승'}</span>
                        <span className="text-gray-400 font-mono">{m.old_odds.toFixed(2)}</span>
                        <span className="text-gray-500">→</span>
                        <span className="text-white font-mono font-bold">{m.new_odds.toFixed(2)}</span>
                      </div>
                      <div className="text-[10px] text-gray-500">
                        {getBookmakerShort(m.bookmaker)}
                      </div>
                    </div>
                    <span className={`text-sm font-bold font-mono ${
                      m.direction === 'up' ? 'text-red-400' : 'text-green-400'
                    }`}>
                      {m.direction === 'up' ? '↑' : '↓'}{Math.abs(m.change_pct).toFixed(1)}%
                    </span>
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

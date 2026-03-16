'use client';

import { useMemo } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer,
} from 'recharts';
import type { OddsHistoryPoint } from '@/types/ai';
import { getBookmakerShort } from '@/lib/utils';

interface Props {
  data: OddsHistoryPoint[];
  outcome?: 'home' | 'away' | 'draw';
}

const COLORS = ['#3b82f6', '#ef4444', '#22c55e', '#f59e0b', '#a855f7', '#06b6d4', '#f97316', '#ec4899'];

export default function OddsChart({ data, outcome = 'home' }: Props) {
  const chartData = useMemo(() => {
    if (!data || data.length === 0) return { points: [], bookmakers: [] };

    // 북메이커별로 그룹핑
    const bookmakerSet = new Set<string>();
    data.forEach((d) => bookmakerSet.add(d.bookmaker));
    const bookmakers = Array.from(bookmakerSet);

    // 시간별 데이터 포인트 생성
    const timeMap: Record<string, Record<string, number>> = {};
    for (const d of data) {
      const time = new Date(d.recorded_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      if (!timeMap[time]) timeMap[time] = {};

      const oddsValue =
        outcome === 'home' ? d.outcome_1_odds :
        outcome === 'away' ? d.outcome_2_odds :
        d.outcome_draw_odds;

      if (oddsValue) timeMap[time][d.bookmaker] = oddsValue;
    }

    const points = Object.entries(timeMap)
      .map(([time, bms]) => ({ time, ...bms }))
      .sort((a, b) => a.time.localeCompare(b.time));

    return { points, bookmakers };
  }, [data, outcome]);

  if (chartData.points.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-gray-500 text-xs">
        배당 히스토리 데이터가 없습니다. 수집 시작 후 축적됩니다.
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={250}>
      <LineChart data={chartData.points} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
        <XAxis dataKey="time" tick={{ fill: '#9ca3af', fontSize: 10 }} />
        <YAxis tick={{ fill: '#9ca3af', fontSize: 10 }} domain={['auto', 'auto']} />
        <Tooltip
          contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8, fontSize: 11 }}
          labelStyle={{ color: '#9ca3af' }}
        />
        <Legend
          wrapperStyle={{ fontSize: 10 }}
          formatter={(value: string) => getBookmakerShort(value)}
        />
        {chartData.bookmakers.map((bm, i) => (
          <Line
            key={bm}
            type="monotone"
            dataKey={bm}
            stroke={COLORS[i % COLORS.length]}
            strokeWidth={2}
            dot={{ r: 2 }}
            activeDot={{ r: 4 }}
            name={bm}
            connectNulls
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

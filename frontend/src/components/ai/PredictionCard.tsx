'use client';

import Link from 'next/link';
import type { MatchWithPrediction } from '@/types/ai';
import { getKoreanTeamName } from '@/lib/teamNames';
import { getSportEmoji, formatShortTime } from '@/lib/utils';

interface Props {
  match: MatchWithPrediction;
}

export default function PredictionCard({ match }: Props) {
  const p = match.prediction;
  const hasGoals = p?.expected_home_goals != null && p?.expected_away_goals != null;
  const valueBetCount = p?.value_bets?.length ?? 0;

  return (
    <Link href={`/ai/match/${match.id}`} className="block min-w-0">
      <div className="rounded-lg border border-gray-800 bg-gray-900/80 p-3 hover:border-gray-600 hover:bg-gray-900 transition-all overflow-hidden">
        {/* 상단: 리그 + 시간 */}
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-1.5 text-[10px] text-gray-500 min-w-0 flex-1">
            <span className="shrink-0">{getSportEmoji(match.sport)}</span>
            <span className="truncate">{match.league}</span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {valueBetCount > 0 && (
              <span className="text-[10px] bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded font-bold">
                밸류 {valueBetCount}
              </span>
            )}
            <span className="text-[10px] text-gray-600 whitespace-nowrap">{formatShortTime(match.start_time)}</span>
          </div>
        </div>

        {/* 팀 이름 */}
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-white font-medium truncate max-w-[42%]" title={match.home_team}>
            {getKoreanTeamName(match.home_team)}
          </span>
          <span className="text-[10px] text-gray-600 mx-2">vs</span>
          <span className="text-xs text-white font-medium truncate max-w-[42%] text-right" title={match.away_team}>
            {getKoreanTeamName(match.away_team)}
          </span>
        </div>

        {/* 예측 확률 바 */}
        {p ? (
          <>
            <ProbBar
              homeProb={p.home_win_prob}
              drawProb={p.draw_prob}
              awayProb={p.away_win_prob}
            />

            {/* 예상 골 + 신뢰도 */}
            <div className="flex items-center justify-between text-[10px] gap-2 mt-1.5">
              <div className="flex items-center gap-2 min-w-0">
                {hasGoals && (
                  <span className="text-gray-500 whitespace-nowrap">
                    예상 <span className="text-white font-mono">{p.expected_home_goals}</span>
                    -
                    <span className="text-white font-mono">{p.expected_away_goals}</span>
                  </span>
                )}
                {p.over_2_5_prob != null && (
                  <span className="text-gray-600 whitespace-nowrap">
                    O2.5 <span className="font-mono">{(p.over_2_5_prob * 100).toFixed(0)}%</span>
                  </span>
                )}
              </div>
              <span className="text-gray-600 shrink-0 whitespace-nowrap">
                신뢰도 {(p.confidence * 100).toFixed(0)}%
              </span>
            </div>
          </>
        ) : (
          <div className="text-[10px] text-gray-600 text-center py-2 bg-gray-800/30 rounded">
            예측 데이터 준비 중...
          </div>
        )}
      </div>
    </Link>
  );
}

function ProbBar({
  homeProb,
  drawProb,
  awayProb,
}: {
  homeProb: number;
  drawProb: number;
  awayProb: number;
}) {
  const h = Math.round(homeProb * 100);
  const d = Math.round(drawProb * 100);
  const a = Math.round(awayProb * 100);

  return (
    <div>
      {/* 수치 */}
      <div className="flex justify-between text-[10px] mb-0.5">
        <span className="text-blue-400 font-bold">{h}%</span>
        {d > 0 && <span className="text-gray-500">{d}%</span>}
        <span className="text-red-400 font-bold">{a}%</span>
      </div>
      {/* 바 */}
      <div className="flex h-1.5 rounded-full overflow-hidden bg-gray-800">
        <div className="bg-blue-500" style={{ width: `${h}%` }} />
        {d > 0 && <div className="bg-gray-600" style={{ width: `${d}%` }} />}
        <div className="bg-red-500" style={{ width: `${a}%` }} />
      </div>
      {/* 라벨 */}
      <div className="flex justify-between text-[9px] mt-0.5">
        <span className="text-gray-600">홈승</span>
        {d > 0 && <span className="text-gray-600">무</span>}
        <span className="text-gray-600">원정승</span>
      </div>
    </div>
  );
}

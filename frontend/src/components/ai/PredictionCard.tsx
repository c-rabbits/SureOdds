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
    <Link href={`/ai/match/${match.id}`} className="block">
      <div className="rounded-lg border border-gray-800 bg-gray-900/50 p-4 hover:border-gray-600 transition-colors cursor-pointer">
        {/* 상단: 리그 + 시간 */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-1.5 text-[11px] text-gray-400">
            <span>{getSportEmoji(match.sport)}</span>
            <span className="truncate max-w-[200px]">{match.league}</span>
          </div>
          <div className="flex items-center gap-2">
            {valueBetCount > 0 && (
              <span className="text-[10px] bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded font-bold">
                밸류 {valueBetCount}
              </span>
            )}
            <span className="text-[10px] text-gray-500">{formatShortTime(match.start_time)}</span>
          </div>
        </div>

        {/* 팀 이름 */}
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm text-white font-medium truncate max-w-[42%]" title={match.home_team}>
            {getKoreanTeamName(match.home_team)}
          </span>
          <span className="text-xs text-gray-600 mx-2">vs</span>
          <span className="text-sm text-white font-medium truncate max-w-[42%] text-right" title={match.away_team}>
            {getKoreanTeamName(match.away_team)}
          </span>
        </div>

        {/* 예측 확률 바 */}
        {p ? (
          <>
            <div className="flex items-center gap-1 mb-1.5">
              <ProbBar
                homeProb={p.home_win_prob}
                drawProb={p.draw_prob}
                awayProb={p.away_win_prob}
              />
            </div>

            {/* 예상 골 + 신뢰도 */}
            <div className="flex items-center justify-between text-[11px]">
              <div className="flex items-center gap-3">
                {hasGoals && (
                  <span className="text-gray-400">
                    예상: <span className="text-white font-mono">{p.expected_home_goals}</span>
                    {' - '}
                    <span className="text-white font-mono">{p.expected_away_goals}</span>
                  </span>
                )}
                {p.over_2_5_prob != null && (
                  <span className="text-gray-500">
                    O2.5 <span className="font-mono">{(p.over_2_5_prob * 100).toFixed(0)}%</span>
                  </span>
                )}
              </div>
              <span className="text-gray-600">
                신뢰도 {(p.confidence * 100).toFixed(0)}%
              </span>
            </div>
          </>
        ) : (
          <div className="text-[11px] text-gray-600 text-center py-2">
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
    <div className="flex-1">
      {/* 수치 */}
      <div className="flex justify-between text-[11px] mb-0.5">
        <span className="text-blue-400 font-bold">{h}%</span>
        {d > 0 && <span className="text-gray-400">{d}%</span>}
        <span className="text-red-400 font-bold">{a}%</span>
      </div>
      {/* 바 */}
      <div className="flex h-2 rounded-full overflow-hidden bg-gray-800">
        <div className="bg-blue-500" style={{ width: `${h}%` }} />
        {d > 0 && <div className="bg-gray-600" style={{ width: `${d}%` }} />}
        <div className="bg-red-500" style={{ width: `${a}%` }} />
      </div>
      {/* 라벨 */}
      <div className="flex justify-between text-[9px] mt-0.5">
        <span className="text-gray-500">홈승</span>
        {d > 0 && <span className="text-gray-600">무</span>}
        <span className="text-gray-500">원정승</span>
      </div>
    </div>
  );
}

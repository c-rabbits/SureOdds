'use client';

import { useMemo } from 'react';
import { scoreMatrix, mostLikelyScore } from '@/lib/poissonUtils';

interface Props {
  homeLambda: number;
  awayLambda: number;
  homeTeam: string;
  awayTeam: string;
}

export default function ScoreMatrix({ homeLambda, awayLambda, homeTeam, awayTeam }: Props) {
  const maxGoals = 5;

  const matrix = useMemo(() => scoreMatrix(homeLambda, awayLambda, maxGoals), [homeLambda, awayLambda]);
  const best = useMemo(() => mostLikelyScore(homeLambda, awayLambda, maxGoals), [homeLambda, awayLambda]);

  // Find max probability for color scaling
  const maxProb = useMemo(() => {
    let max = 0;
    for (const row of matrix) for (const p of row) if (p > max) max = p;
    return max;
  }, [matrix]);

  function cellBg(prob: number, isHome: number, isAway: number): string {
    const intensity = maxProb > 0 ? prob / maxProb : 0;
    if (isHome === best.home && isAway === best.away) {
      return `rgba(34, 197, 94, ${0.3 + intensity * 0.5})`; // green highlight
    }
    return `rgba(59, 130, 246, ${intensity * 0.4})`; // blue scale
  }

  return (
    <div className="card p-4">
      <h3 className="text-sm font-semibold text-cyan-400 mb-3">예상 스코어 분포</h3>

      <div className="overflow-x-auto">
        <table className="w-full text-center">
          <thead>
            <tr>
              <th className="text-[10px] text-gray-500 pb-1 pr-1 text-right w-12">
                <span className="text-blue-400">{homeTeam}</span>
                <span className="text-gray-600"> \ </span>
                <span className="text-red-400">{awayTeam}</span>
              </th>
              {Array.from({ length: maxGoals }, (_, j) => (
                <th key={j} className="text-xs text-red-400/70 pb-1 w-12">{j}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {matrix.map((row, i) => (
              <tr key={i}>
                <td className="text-xs text-blue-400/70 pr-1 text-right font-mono">{i}</td>
                {row.map((prob, j) => {
                  const isBest = i === best.home && j === best.away;
                  return (
                    <td
                      key={j}
                      className={`text-[10px] font-mono py-1.5 px-0.5 rounded-sm ${
                        isBest ? 'ring-1 ring-green-400 font-bold text-white' : 'text-gray-300'
                      }`}
                      style={{ backgroundColor: cellBg(prob, i, j) }}
                      title={`${i}-${j}: ${(prob * 100).toFixed(1)}%`}
                    >
                      {(prob * 100).toFixed(1)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-2 text-center">
        <span className="text-xs text-gray-500">최다 예상: </span>
        <span className="text-sm font-bold text-green-400">{best.home} - {best.away}</span>
        <span className="text-xs text-gray-500 ml-1">({(best.prob * 100).toFixed(1)}%)</span>
      </div>
    </div>
  );
}

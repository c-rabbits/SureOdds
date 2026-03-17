'use client';

import type { ValueBet } from '@/types/ai';
import { getBookmakerShort } from '@/lib/utils';

interface Props {
  valueBets: ValueBet[] | null;
}

export default function ValueAnalysis({ valueBets }: Props) {
  if (!valueBets || valueBets.length === 0) {
    return (
      <div className="text-center py-4 text-gray-500 text-sm">
        현재 밸류 베팅 기회가 없습니다.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-gray-500 border-b border-gray-800">
            <th className="text-left py-2 px-2">결과</th>
            <th className="text-center py-2 px-2">AI 확률</th>
            <th className="text-center py-2 px-2">마켓 확률</th>
            <th className="text-center py-2 px-2">엣지</th>
            <th className="text-center py-2 px-2">배당</th>
            <th className="text-right py-2 px-2">북메이커</th>
          </tr>
        </thead>
        <tbody>
          {valueBets.map((vb, i) => (
            <tr key={i} className="border-t border-gray-800/50">
              <td className="py-2 px-2 text-white font-medium">{vb.outcome_label}</td>
              <td className="py-2 px-2 text-center font-mono text-blue-400">
                {(vb.ai_prob * 100).toFixed(1)}%
              </td>
              <td className="py-2 px-2 text-center font-mono text-gray-400">
                {(vb.market_prob * 100).toFixed(1)}%
              </td>
              <td className="py-2 px-2 text-center">
                <span className={`font-mono font-bold ${vb.edge > 0.05 ? 'text-green-400' : 'text-green-500/70'}`}>
                  +{(vb.edge * 100).toFixed(1)}%
                </span>
              </td>
              <td className="py-2 px-2 text-center font-mono text-white">{vb.odds.toFixed(2)}</td>
              <td className="py-2 px-2 text-right text-gray-400">{getBookmakerShort(vb.bookmaker)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

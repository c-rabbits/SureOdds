'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import type { MatchPredictionDetail, OddsHistoryPoint } from '@/types/ai';
import { getAiPrediction, getOddsHistory } from '@/lib/aiApi';
import { getKoreanTeamName } from '@/lib/teamNames';
import { getSportEmoji, formatMatchTime, getBookmakerName, formatOdds, isDomesticBookmaker } from '@/lib/utils';
import OddsChart from '@/components/ai/OddsChart';
import ValueAnalysis from '@/components/ai/ValueAnalysis';

export default function MatchDetailPage() {
  const params = useParams();
  const router = useRouter();
  const matchId = params.id as string;

  const [data, setData] = useState<MatchPredictionDetail | null>(null);
  const [history, setHistory] = useState<OddsHistoryPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [chartOutcome, setChartOutcome] = useState<'home' | 'away' | 'draw'>('home');

  useEffect(() => {
    async function load() {
      try {
        const [detail, hist] = await Promise.all([
          getAiPrediction(matchId),
          getOddsHistory(matchId, { market_type: 'h2h' }),
        ]);
        setData(detail);
        setHistory(hist || []);
      } catch (err) {
        console.error('Failed to load match detail:', err);
      } finally {
        setLoading(false);
      }
    }
    if (matchId) load();
  }, [matchId]);

  if (loading) {
    return (
      <div className="p-4 space-y-4">
        <div className="h-20 bg-gray-800/50 rounded-lg animate-pulse" />
        <div className="h-48 bg-gray-800/50 rounded-lg animate-pulse" />
        <div className="h-64 bg-gray-800/50 rounded-lg animate-pulse" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center py-12 text-gray-500">
        경기를 찾을 수 없습니다.
      </div>
    );
  }

  const { match, odds, prediction: p } = data;
  const h2hOdds = odds.filter((o) => o.market_type === 'h2h');

  return (
    <div className="p-4 pb-8 max-w-3xl mx-auto space-y-4">
      {/* 뒤로가기 */}
      <button onClick={() => router.back()} className="text-xs text-gray-500 hover:text-white transition-colors">
        ← 목록으로
      </button>

      {/* 경기 헤더 */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
        <div className="flex items-center gap-2 text-[11px] text-gray-400 mb-2">
          <span>{getSportEmoji(match.sport)}</span>
          <span>{match.league}</span>
          <span>·</span>
          <span>{formatMatchTime(match.start_time)}</span>
        </div>
        <div className="flex items-center justify-center gap-4">
          <span className="text-lg font-bold text-white" title={match.home_team}>
            {getKoreanTeamName(match.home_team)}
          </span>
          <span className="text-sm text-gray-500">vs</span>
          <span className="text-lg font-bold text-white" title={match.away_team}>
            {getKoreanTeamName(match.away_team)}
          </span>
        </div>
      </div>

      {/* AI 예측 */}
      {p ? (
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
          <h2 className="text-sm font-semibold text-purple-400 mb-3 flex items-center gap-1.5">
            🤖 AI 예측
            <span className="text-[10px] text-gray-500 font-normal">
              신뢰도 {(p.confidence * 100).toFixed(0)}%
            </span>
          </h2>

          {/* 승률 바 */}
          <div className="mb-4">
            <div className="flex justify-between text-sm mb-1">
              <span className="text-blue-400 font-bold">{(p.home_win_prob * 100).toFixed(1)}%</span>
              {p.draw_prob > 0 && (
                <span className="text-gray-400">{(p.draw_prob * 100).toFixed(1)}%</span>
              )}
              <span className="text-red-400 font-bold">{(p.away_win_prob * 100).toFixed(1)}%</span>
            </div>
            <div className="flex h-4 rounded-full overflow-hidden bg-gray-800">
              <div className="bg-blue-500 transition-all" style={{ width: `${p.home_win_prob * 100}%` }} />
              {p.draw_prob > 0 && (
                <div className="bg-gray-600 transition-all" style={{ width: `${p.draw_prob * 100}%` }} />
              )}
              <div className="bg-red-500 transition-all" style={{ width: `${p.away_win_prob * 100}%` }} />
            </div>
            <div className="flex justify-between text-[10px] text-gray-500 mt-1">
              <span>홈승</span>
              {p.draw_prob > 0 && <span>무승부</span>}
              <span>원정승</span>
            </div>
          </div>

          {/* 예상 골 + O/U */}
          {p.expected_home_goals != null && (
            <div className="grid grid-cols-2 gap-3 text-center">
              <div className="bg-gray-800/50 rounded-lg p-3">
                <p className="text-[10px] text-gray-500 mb-1">예상 스코어</p>
                <p className="text-xl font-bold text-white font-mono">
                  {p.expected_home_goals} - {p.expected_away_goals}
                </p>
              </div>
              {p.over_2_5_prob != null && (
                <div className="bg-gray-800/50 rounded-lg p-3">
                  <p className="text-[10px] text-gray-500 mb-1">오버/언더 2.5</p>
                  <div className="flex items-center justify-center gap-3">
                    <span className={`text-sm font-bold font-mono ${p.over_2_5_prob > 0.5 ? 'text-green-400' : 'text-gray-400'}`}>
                      O {(p.over_2_5_prob * 100).toFixed(0)}%
                    </span>
                    <span className={`text-sm font-bold font-mono ${p.under_2_5_prob! > 0.5 ? 'text-green-400' : 'text-gray-400'}`}>
                      U {(p.under_2_5_prob! * 100).toFixed(0)}%
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 text-center text-gray-500 text-xs">
          예측 데이터가 아직 생성되지 않았습니다.
        </div>
      )}

      {/* 밸류 분석 */}
      {p?.value_bets && p.value_bets.length > 0 && (
        <div className="bg-gray-900 border border-green-800/30 rounded-lg p-4">
          <h2 className="text-sm font-semibold text-green-400 mb-2">💰 밸류 분석</h2>
          <ValueAnalysis valueBets={p.value_bets} />
        </div>
      )}

      {/* 배당 비교 */}
      {h2hOdds.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
          <h2 className="text-sm font-semibold text-white mb-2">📊 배당 비교</h2>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-gray-500 border-b border-gray-800">
                <th className="text-left py-1.5">북메이커</th>
                <th className="text-center py-1.5">홈승</th>
                <th className="text-center py-1.5">무승부</th>
                <th className="text-center py-1.5">원정승</th>
              </tr>
            </thead>
            <tbody>
              {h2hOdds.map((o) => (
                <tr key={o.id} className="border-t border-gray-800/50">
                  <td className="py-1.5 text-gray-300">
                    <span className="flex items-center gap-1">
                      {isDomesticBookmaker(o.bookmaker) && <span className="text-[9px]">🇰🇷</span>}
                      {o.bookmaker_title || getBookmakerName(o.bookmaker)}
                    </span>
                  </td>
                  <td className="py-1.5 text-center font-mono text-gray-300">{formatOdds(o.outcome_1_odds)}</td>
                  <td className="py-1.5 text-center font-mono text-gray-400">
                    {o.outcome_draw_odds ? formatOdds(o.outcome_draw_odds) : '-'}
                  </td>
                  <td className="py-1.5 text-center font-mono text-gray-300">{formatOdds(o.outcome_2_odds)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 배당 변동 차트 */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-white">📈 배당 변동</h2>
          <div className="flex gap-1">
            {(['home', 'draw', 'away'] as const).map((oc) => (
              <button
                key={oc}
                onClick={() => setChartOutcome(oc)}
                className={`text-[10px] px-2 py-1 rounded ${
                  chartOutcome === oc
                    ? 'bg-purple-600/20 text-purple-400'
                    : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                {oc === 'home' ? '홈승' : oc === 'draw' ? '무' : '원정승'}
              </button>
            ))}
          </div>
        </div>
        <OddsChart data={history} outcome={chartOutcome} />
      </div>
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import type { MatchPredictionDetail, OddsHistoryPoint, TeamStatsInfo } from '@/types/ai';
import { getAiPrediction, getOddsHistory } from '@/lib/aiApi';
import { getKoreanTeamName } from '@/lib/teamNames';
import { getKoreanLeagueName } from '@/lib/leagueNames';
import { getSportEmoji, formatMatchTime, getBookmakerName, formatOdds, isDomesticBookmaker } from '@/lib/utils';
import OddsChart from '@/components/ai/OddsChart';
import ValueAnalysis from '@/components/ai/ValueAnalysis';
import TeamLogo from '@/components/TeamLogo';

// --- 팀 대결 비교 카드 ---

function FormBadges({ form }: { form: string | null }) {
  if (!form) return <span className="text-gray-600 text-xs">데이터 없음</span>;
  return (
    <div className="flex gap-0.5">
      {form.split('').map((c, i) => (
        <span
          key={i}
          className={`w-5 h-5 flex items-center justify-center rounded text-[10px] font-bold ${
            c === 'W' ? 'bg-green-500/20 text-green-400' :
            c === 'D' ? 'bg-yellow-500/20 text-yellow-400' :
            'bg-red-500/20 text-red-400'
          }`}
        >
          {c}
        </span>
      ))}
    </div>
  );
}

function StatCompareBar({ label, homeVal, awayVal, format, inverse = false }: {
  label: string;
  homeVal: number | null;
  awayVal: number | null;
  format?: (v: number) => string;
  inverse?: boolean;
}) {
  const hv = homeVal ?? 0;
  const av = awayVal ?? 0;
  const fmt = format || ((v: number) => v.toFixed(2));
  const max = Math.max(hv, av, 0.01);

  const homeWidth = inverse ? ((max - hv + 0.01) / max) * 100 : (hv / max) * 100;
  const awayWidth = inverse ? ((max - av + 0.01) / max) * 100 : (av / max) * 100;

  return (
    <div className="space-y-0.5">
      <div className="flex justify-between text-xs text-gray-500">
        <span className="font-mono font-bold text-blue-400">{fmt(hv)}</span>
        <span>{label}</span>
        <span className="font-mono font-bold text-red-400">{fmt(av)}</span>
      </div>
      <div className="flex gap-0.5 h-1.5">
        <div className="flex-1 flex justify-end">
          <div
            className="h-full rounded-l bg-blue-500/60 transition-all"
            style={{ width: `${Math.min(100, homeWidth)}%` }}
          />
        </div>
        <div className="flex-1">
          <div
            className="h-full rounded-r bg-red-500/60 transition-all"
            style={{ width: `${Math.min(100, awayWidth)}%` }}
          />
        </div>
      </div>
    </div>
  );
}

function TeamMatchupCard({ homeStats, awayStats, homeName, awayName, prediction }: {
  homeStats: TeamStatsInfo;
  awayStats: TeamStatsInfo;
  homeName: string;
  awayName: string;
  prediction: MatchPredictionDetail['prediction'];
}) {
  const eloDiff = (homeStats.elo_rating ?? 1500) - (awayStats.elo_rating ?? 1500);
  const eloFavor = eloDiff > 0 ? '홈 유리' : eloDiff < 0 ? '원정 유리' : '균형';

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg p-3">
      <h2 className="text-sm font-semibold text-cyan-400 mb-2.5">
        팀 대결 분석
      </h2>

      {/* 팀 이름 헤더 */}
      <div className="flex justify-between items-center mb-3 text-sm">
        <span className="text-blue-400 font-semibold flex items-center gap-1.5">
          <TeamLogo teamName={homeName} size={22} />
          {getKoreanTeamName(homeName)}
        </span>
        <span className="text-gray-600">vs</span>
        <span className="text-red-400 font-semibold flex items-center gap-1.5">
          {getKoreanTeamName(awayName)}
          <TeamLogo teamName={awayName} size={22} />
        </span>
      </div>

      {/* ELO 비교 */}
      <div className="bg-gray-800/50 rounded-lg p-2.5 mb-3">
        <div className="flex justify-between items-center mb-1">
          <span className="text-blue-400 font-mono font-bold text-sm">{homeStats.elo_rating?.toFixed(0) ?? '-'}</span>
          <div className="text-center">
            <p className="text-xs text-gray-500">ELO 레이팅</p>
            <p className={`text-xs font-semibold ${eloDiff > 50 ? 'text-blue-400' : eloDiff < -50 ? 'text-red-400' : 'text-gray-400'}`}>
              {eloDiff > 0 ? '+' : ''}{eloDiff.toFixed(0)} ({eloFavor})
            </p>
          </div>
          <span className="text-red-400 font-mono font-bold text-sm">{awayStats.elo_rating?.toFixed(0) ?? '-'}</span>
        </div>
        <div className="flex h-1.5 rounded-full overflow-hidden bg-gray-700">
          <div className="bg-blue-500 transition-all" style={{ width: `${((homeStats.elo_rating ?? 1500) / ((homeStats.elo_rating ?? 1500) + (awayStats.elo_rating ?? 1500))) * 100}%` }} />
          <div className="bg-red-500 transition-all" style={{ width: `${((awayStats.elo_rating ?? 1500) / ((homeStats.elo_rating ?? 1500) + (awayStats.elo_rating ?? 1500))) * 100}%` }} />
        </div>
      </div>

      {/* 공격/수비/득실점 비교 */}
      <div className="space-y-2.5 mb-3">
        <StatCompareBar label="공격력" homeVal={homeStats.attack_rating} awayVal={awayStats.attack_rating} />
        <StatCompareBar label="수비력" homeVal={homeStats.defense_rating} awayVal={awayStats.defense_rating} inverse={true} />
        <StatCompareBar label="평균 득점" homeVal={homeStats.avg_goals_scored} awayVal={awayStats.avg_goals_scored} />
        <StatCompareBar label="평균 실점" homeVal={homeStats.avg_goals_conceded} awayVal={awayStats.avg_goals_conceded} inverse={true} />
      </div>

      {/* 최근 폼 */}
      <div className="flex justify-between items-center pt-2 border-t border-gray-800">
        <div>
          <p className="text-xs text-gray-500 mb-1">최근 5경기</p>
          <FormBadges form={homeStats.form_last5} />
        </div>
        <div className="text-right">
          <p className="text-xs text-gray-500 mb-1">최근 5경기</p>
          <FormBadges form={awayStats.form_last5} />
        </div>
      </div>

      {/* 하이브리드 모델 일치도 */}
      {prediction?.model_agreement != null && (
        <div className="mt-2.5 pt-2 border-t border-gray-800">
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-500">모델 일치도</span>
            <span className={`font-semibold ${
              prediction.model_agreement > 0.7 ? 'text-green-400' :
              prediction.model_agreement > 0.4 ? 'text-yellow-400' :
              'text-red-400'
            }`}>
              {(prediction.model_agreement * 100).toFixed(0)}%
              {prediction.model_agreement > 0.7 ? ' (높음)' :
               prediction.model_agreement > 0.4 ? ' (보통)' : ' (낮음)'}
            </span>
          </div>
          {prediction.team_model_home_goals != null && prediction.market_model_home_goals != null && (
            <div className="flex justify-between mt-1 text-xs text-gray-500">
              <div>
                <span className="text-gray-600">시장: </span>
                <span className="text-white font-mono">{prediction.market_model_home_goals} - {prediction.market_model_away_goals}</span>
              </div>
              <div>
                <span className="text-gray-600">팀: </span>
                <span className="text-cyan-400 font-mono">{prediction.team_model_home_goals} - {prediction.team_model_away_goals}</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// --- 메인 페이지 ---

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
      <div className="p-3 space-y-3 max-w-3xl mx-auto">
        <div className="h-16 bg-gray-800/50 rounded-lg animate-pulse" />
        <div className="h-40 bg-gray-800/50 rounded-lg animate-pulse" />
        <div className="h-56 bg-gray-800/50 rounded-lg animate-pulse" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center py-12 text-gray-500 text-sm">
        경기를 찾을 수 없습니다.
      </div>
    );
  }

  const { match, odds, prediction: p, homeTeamStats, awayTeamStats } = data;
  const h2hOdds = odds.filter((o) => o.market_type === 'h2h');

  return (
    <div className="p-3 pb-8 max-w-3xl mx-auto space-y-3">
      {/* 뒤로가기 */}
      <button onClick={() => router.back()} className="text-sm text-gray-500 hover:text-white transition-colors">
        ← 목록으로
      </button>

      {/* 경기 헤더 */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-3">
        <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
          <span>{getSportEmoji(match.sport)}</span>
          <span>{getKoreanLeagueName(match.league)}</span>
          <span>·</span>
          <span>{formatMatchTime(match.start_time)}</span>
        </div>
        <div className="flex items-center justify-center gap-4">
          <span className="flex items-center gap-2 text-base font-bold text-white" title={match.home_team}>
            <TeamLogo teamName={match.home_team} size={28} />
            {getKoreanTeamName(match.home_team)}
          </span>
          <span className="text-sm text-gray-600">vs</span>
          <span className="flex items-center gap-2 text-base font-bold text-white" title={match.away_team}>
            {getKoreanTeamName(match.away_team)}
            <TeamLogo teamName={match.away_team} size={28} />
          </span>
        </div>
      </div>

      {/* AI 예측 */}
      {p ? (
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-3">
          <h2 className="text-sm font-semibold text-purple-400 mb-2.5 flex items-center gap-1.5">
            AI 예측
            <span className="text-xs text-gray-500 font-normal">
              {p.model_type === 'poisson_v2_hybrid' ? '하이브리드' : '시장분석'} · 신뢰도 {(p.confidence * 100).toFixed(0)}%
            </span>
          </h2>

          {/* 승률 바 */}
          <div className="mb-3">
            <div className="flex justify-between text-sm mb-1">
              <span className="text-blue-400 font-bold">{(p.home_win_prob * 100).toFixed(1)}%</span>
              {p.draw_prob > 0 && (
                <span className="text-gray-400">{(p.draw_prob * 100).toFixed(1)}%</span>
              )}
              <span className="text-red-400 font-bold">{(p.away_win_prob * 100).toFixed(1)}%</span>
            </div>
            <div className="flex h-3 rounded-full overflow-hidden bg-gray-800">
              <div className="bg-blue-500 transition-all" style={{ width: `${p.home_win_prob * 100}%` }} />
              {p.draw_prob > 0 && (
                <div className="bg-gray-600 transition-all" style={{ width: `${p.draw_prob * 100}%` }} />
              )}
              <div className="bg-red-500 transition-all" style={{ width: `${p.away_win_prob * 100}%` }} />
            </div>
            <div className="flex justify-between text-[10px] text-gray-600 mt-0.5">
              <span>홈승</span>
              {p.draw_prob > 0 && <span>무승부</span>}
              <span>원정승</span>
            </div>
          </div>

          {/* 예상 골 + O/U */}
          {p.expected_home_goals != null && (
            <div className="grid grid-cols-2 gap-2 text-center">
              <div className="bg-gray-800/50 rounded-lg p-2.5">
                <p className="text-xs text-gray-500 mb-0.5">예상 스코어</p>
                <p className="text-lg font-bold text-white font-mono">
                  {p.expected_home_goals} - {p.expected_away_goals}
                </p>
              </div>
              {p.over_2_5_prob != null && (
                <div className="bg-gray-800/50 rounded-lg p-2.5">
                  <p className="text-xs text-gray-500 mb-0.5">오버/언더 2.5</p>
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
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-3 text-center text-gray-500 text-sm">
          예측 데이터가 아직 생성되지 않았습니다.
        </div>
      )}

      {/* 팀 대결 분석 */}
      {homeTeamStats && awayTeamStats && (
        <TeamMatchupCard
          homeStats={homeTeamStats}
          awayStats={awayTeamStats}
          homeName={match.home_team}
          awayName={match.away_team}
          prediction={p}
        />
      )}

      {/* 밸류 분석 */}
      {p?.value_bets && p.value_bets.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-3">
          <h2 className="text-sm font-semibold text-green-400 mb-2">밸류 분석</h2>
          <ValueAnalysis valueBets={p.value_bets} />
        </div>
      )}

      {/* 배당 비교 */}
      {h2hOdds.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-3">
          <h2 className="text-sm font-semibold text-white mb-2">배당 비교</h2>
          <table className="w-full text-sm">
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
                      {isDomesticBookmaker(o.bookmaker) && <span className="text-[10px]">🇰🇷</span>}
                      {getBookmakerName(o.bookmaker) || o.bookmaker_title}
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
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-3">
        <div className="flex items-center justify-between mb-2.5">
          <h2 className="text-sm font-semibold text-white">배당 변동</h2>
          <div className="flex gap-0.5">
            {(['home', 'draw', 'away'] as const).map((oc) => (
              <button
                key={oc}
                onClick={() => setChartOutcome(oc)}
                className={`text-xs px-2 py-1 rounded ${
                  chartOutcome === oc
                    ? 'bg-gray-700 text-white'
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

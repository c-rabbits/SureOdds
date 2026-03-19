'use client';

import { useEffect, useState, useMemo } from 'react';
import type { MatchWithPrediction, ValueBetMatch } from '@/types/ai';
import { getAiPredictions, getValueBets } from '@/lib/aiApi';
import PredictionCard from '@/components/ai/PredictionCard';
import { getKoreanTeamName } from '@/lib/teamNames';
import { getSportEmoji, getBookmakerShort } from '@/lib/utils';
import TeamLogo from '@/components/TeamLogo';

const SPORT_FILTERS = [
  { key: 'all', label: '전체' },
  { key: 'soccer', label: '⚽ 축구' },
  { key: 'basketball', label: '🏀 농구' },
  { key: 'baseball', label: '⚾ 야구' },
  { key: 'hockey', label: '🏒 하키' },
];

export default function AiOverviewPage() {
  const [matches, setMatches] = useState<MatchWithPrediction[]>([]);
  const [valueBets, setValueBets] = useState<ValueBetMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [sportFilter, setSportFilter] = useState('all');

  useEffect(() => {
    async function load() {
      try {
        const [matchData, vbData] = await Promise.all([
          getAiPredictions({ limit: 100 }),
          getValueBets({ limit: 10 }),
        ]);
        setMatches(matchData || []);
        setValueBets(vbData || []);
      } catch (err) {
        console.error('Failed to load AI predictions:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const filteredMatches = useMemo(() => {
    if (sportFilter === 'all') return matches;
    return matches.filter((m) => m.sport.includes(sportFilter));
  }, [matches, sportFilter]);

  const withPrediction = filteredMatches.filter((m) => m.prediction);
  const withoutPrediction = filteredMatches.filter((m) => !m.prediction);

  // 통계 계산
  const avgConfidence = useMemo(() => {
    const preds = withPrediction.filter((m) => m.prediction);
    if (preds.length === 0) return 0;
    return preds.reduce((s, m) => s + (m.prediction?.confidence ?? 0), 0) / preds.length;
  }, [withPrediction]);

  const totalValueBetEdge = useMemo(() => {
    if (valueBets.length === 0) return 0;
    return Math.max(...valueBets.map((v) => v.top_edge));
  }, [valueBets]);

  if (loading) {
    return (
      <div className="p-3 space-y-3 max-w-4xl mx-auto">
        {/* 스켈레톤 위젯 */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-16 bg-gray-800/50 rounded-lg animate-pulse" />
          ))}
        </div>
        {/* 스켈레톤 카드 */}
        <div className="grid gap-2 md:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 bg-gray-800/50 rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-3 pb-8 max-w-4xl mx-auto">
      {/* 요약 위젯 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
        <WidgetCard
          label="오늘 경기"
          value={`${filteredMatches.length}`}
          sub={`${withPrediction.length}개 예측 완료`}
          accent="text-white"
        />
        <WidgetCard
          label="밸류 베팅"
          value={`${valueBets.length}`}
          sub={totalValueBetEdge > 0 ? `최대 +${(totalValueBetEdge * 100).toFixed(1)}%` : '발견 없음'}
          accent="text-green-400"
        />
        <WidgetCard
          label="평균 신뢰도"
          value={avgConfidence > 0 ? `${(avgConfidence * 100).toFixed(0)}%` : '-'}
          sub="Poisson + ELO"
          accent="text-blue-400"
        />
        <WidgetCard
          label="예측 미완료"
          value={`${withoutPrediction.length}`}
          sub="데이터 수집 중"
          accent="text-gray-400"
        />
      </div>

      {/* 종목 필터 */}
      <div className="flex items-center gap-1 mb-3 overflow-x-auto">
        {SPORT_FILTERS.map((sf) => (
          <button
            key={sf.key}
            onClick={() => setSportFilter(sf.key)}
            className={`filter-pill ${sportFilter === sf.key ? 'filter-pill-active' : 'filter-pill-inactive'}`}
          >
            {sf.label}
          </button>
        ))}
      </div>

      {/* 밸류 베팅 TOP */}
      {valueBets.length > 0 && sportFilter === 'all' && (
        <div className="mb-3">
          <div className="flex items-center gap-1.5 mb-1.5">
            <h2 className="text-sm font-semibold text-green-400">오늘의 밸류 베팅</h2>
            <span className="text-xs bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded font-bold">
              TOP {Math.min(5, valueBets.length)}
            </span>
          </div>
          <div className="bg-green-900/10 border border-green-800/30 rounded-lg divide-y divide-green-800/20">
            {valueBets.slice(0, 5).map((vb) => (
              <div key={vb.match_id} className="flex items-center justify-between gap-2 text-sm px-3 py-2">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <span className="shrink-0">{getSportEmoji(vb.sport)}</span>
                  <TeamLogo teamName={vb.home_team} size={18} />
                  <span className="text-white truncate">
                    {getKoreanTeamName(vb.home_team)} vs {getKoreanTeamName(vb.away_team)}
                  </span>
                  <TeamLogo teamName={vb.away_team} size={18} />
                </div>
                <div className="flex items-center gap-2 shrink-0 text-right">
                  {vb.value_bets.slice(0, 1).map((bet, i) => (
                    <span key={i} className="text-green-400 font-bold whitespace-nowrap">
                      {bet.outcome_label} +{(bet.edge * 100).toFixed(1)}%
                      <span className="text-gray-500 font-normal ml-1 hidden sm:inline">{getBookmakerShort(bet.bookmaker)}</span>
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 경기 목록 */}
      {filteredMatches.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <p className="text-lg mb-2">📭</p>
          <p className="text-sm">오늘 예정된 경기가 없습니다.</p>
        </div>
      ) : (
        <div className="grid gap-2 md:grid-cols-2">
          {withPrediction.map((m) => (
            <PredictionCard key={m.id} match={m} />
          ))}
          {withoutPrediction.map((m) => (
            <PredictionCard key={m.id} match={m} />
          ))}
        </div>
      )}
    </div>
  );
}

function WidgetCard({ label, value, sub, accent }: {
  label: string; value: string; sub: string; accent: string;
}) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg px-3 py-2">
      <div className="text-xs text-gray-500 mb-0.5">{label}</div>
      <div className={`text-base font-bold font-mono ${accent}`}>{value}</div>
      <div className="text-xs text-gray-600">{sub}</div>
    </div>
  );
}

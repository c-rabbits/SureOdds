'use client';

import { useEffect, useState, useMemo } from 'react';
import type { MatchWithPrediction, ValueBetMatch } from '@/types/ai';
import { getAiPredictions, getValueBets } from '@/lib/aiApi';
import PredictionCard from '@/components/ai/PredictionCard';
import { getKoreanTeamName } from '@/lib/teamNames';
import { getSportEmoji, getBookmakerShort } from '@/lib/utils';

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

  if (loading) {
    return (
      <div className="p-4 space-y-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-32 bg-gray-800/50 rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="p-4 pb-8 max-w-4xl mx-auto">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-lg font-bold text-white flex items-center gap-2">
            🤖 AI 예측
            <span className="text-xs bg-purple-500/20 text-purple-400 px-2 py-0.5 rounded">Beta</span>
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Poisson 모델 기반 승률 예측 · 배당 대비 밸류 분석
          </p>
        </div>
        <div className="text-xs text-gray-500">
          {withPrediction.length}개 예측 가능
        </div>
      </div>

      {/* 종목 필터 */}
      <div className="flex items-center gap-1 mb-4 overflow-x-auto">
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
        <div className="mb-6">
          <h2 className="text-sm font-semibold text-green-400 mb-2 flex items-center gap-1.5">
            💰 오늘의 밸류 베팅
          </h2>
          <div className="bg-green-900/10 border border-green-800/30 rounded-lg p-3">
            <div className="space-y-2">
              {valueBets.slice(0, 5).map((vb) => (
                <div key={vb.match_id} className="flex items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <span className="shrink-0">{getSportEmoji(vb.sport)}</span>
                    <span className="text-white truncate">
                      {getKoreanTeamName(vb.home_team)} vs {getKoreanTeamName(vb.away_team)}
                    </span>
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
        </div>
      )}

      {/* 경기 목록 */}
      {filteredMatches.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <p className="text-lg mb-2">📭</p>
          <p>오늘 예정된 경기가 없습니다.</p>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
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

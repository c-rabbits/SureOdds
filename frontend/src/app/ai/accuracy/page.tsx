'use client';

import { useEffect, useState } from 'react';
import type { AccuracyRecord, AccuracySummary } from '@/types/ai';
import { getAccuracyStats } from '@/lib/aiApi';
import { getKoreanTeamName } from '@/lib/teamNames';

export default function AccuracyPage() {
  const [records, setRecords] = useState<AccuracyRecord[]>([]);
  const [summary, setSummary] = useState<AccuracySummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const result = await getAccuracyStats({ limit: 100 });
        setRecords(result.records);
        setSummary(result.summary);
      } catch (err) {
        console.error('Failed to load accuracy data:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="p-4 space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 bg-gray-800/50 rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  const hasData = summary && summary.total > 0;

  return (
    <div className="p-4 pb-8 max-w-4xl mx-auto">
      {/* 헤더 */}
      <div className="mb-4">
        <h1 className="text-lg font-bold text-white">📊 예측 정확도</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          AI 모델의 예측 성과를 추적합니다
        </p>
      </div>

      {!hasData ? (
        <div className="text-center py-16">
          <p className="text-3xl mb-3">📭</p>
          <p className="text-gray-400 mb-1">아직 정확도 데이터가 없습니다</p>
          <p className="text-sm text-gray-600">
            경기가 완료되면 AI 예측과 실제 결과를 비교하여 자동으로 기록됩니다.
          </p>
        </div>
      ) : (
        <>
          {/* 요약 카드 */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
            <StatCard
              label="적중률"
              value={`${(summary.accuracy * 100).toFixed(1)}%`}
              sub={`${summary.correct}/${summary.total}`}
              color="text-green-400"
            />
            <StatCard
              label="Brier Score"
              value={summary.avgBrier.toFixed(4)}
              sub="낮을수록 좋음"
              color={summary.avgBrier < 0.2 ? 'text-green-400' : summary.avgBrier < 0.25 ? 'text-yellow-400' : 'text-red-400'}
            />
            <StatCard
              label="평균 신뢰도"
              value={`${(summary.avgConfidence * 100).toFixed(0)}%`}
              sub="모델 자체 평가"
              color="text-blue-400"
            />
            <StatCard
              label="밸류 베팅 ROI"
              value={summary.valueBets.roi !== null ? `${(summary.valueBets.roi * 100).toFixed(1)}%` : '-'}
              sub={summary.valueBets.total > 0 ? `${summary.valueBets.total}건 · ${summary.valueBets.profit > 0 ? '+' : ''}${summary.valueBets.profit.toFixed(2)}u` : '데이터 없음'}
              color={summary.valueBets.roi !== null && summary.valueBets.roi > 0 ? 'text-green-400' : 'text-red-400'}
            />
          </div>

          {/* 모델별 비교 */}
          {summary.byModel.length > 1 && (
            <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 mb-4">
              <h2 className="text-sm font-semibold text-white mb-3">🔬 모델별 비교</h2>
              <div className="space-y-2">
                {summary.byModel.map((m) => (
                  <div key={m.model} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                        m.model.includes('hybrid') ? 'bg-cyan-500/20 text-cyan-400' : 'bg-gray-700 text-gray-400'
                      }`}>
                        {m.model.includes('hybrid') ? '하이브리드' : '시장분석'}
                      </span>
                      <span className="text-gray-500">{m.total}경기</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-white font-mono">
                        적중 {(m.accuracy * 100).toFixed(1)}%
                      </span>
                      <span className="text-gray-500 font-mono">
                        Brier {m.avgBrier.toFixed(4)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 최근 예측 기록 */}
          <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-800">
              <h2 className="text-sm font-semibold text-white">📋 최근 예측 기록</h2>
            </div>
            <div className="divide-y divide-gray-800/50">
              {records.slice(0, 30).map((r) => (
                <div key={r.match_id + r.model_type} className="px-4 py-2.5">
                  {/* 1행: 팀명 + 적중 여부 */}
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-white truncate">
                      {getKoreanTeamName(r.matches.home_team)} vs {getKoreanTeamName(r.matches.away_team)}
                    </span>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                      r.correct ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                    }`}>
                      {r.correct ? '✓ 적중' : '✗ 미적중'}
                    </span>
                  </div>
                  {/* 2행: 예측 vs 실제 */}
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <div className="flex items-center gap-3">
                      <span>
                        예측: <span className="text-gray-300">{outcomeLabel(r.predicted_outcome)}</span>
                        <span className="text-gray-600 ml-1">({(r.predicted_prob * 100).toFixed(0)}%)</span>
                      </span>
                      <span>
                        실제: <span className="text-white font-mono">{r.actual_home_goals}-{r.actual_away_goals}</span>
                        <span className="text-gray-400 ml-1">({outcomeLabel(r.actual_outcome)})</span>
                      </span>
                    </div>
                    {r.had_value_bet && (
                      <span className={`font-mono ${r.value_bet_profit && r.value_bet_profit > 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {r.value_bet_profit && r.value_bet_profit > 0 ? '+' : ''}{r.value_bet_profit?.toFixed(2)}u
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
            {records.length === 0 && (
              <div className="text-center py-8 text-gray-500 text-sm">
                기록이 없습니다
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function StatCard({ label, value, sub, color }: {
  label: string; value: string; sub: string; color: string;
}) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg p-3 text-center">
      <div className="text-xs text-gray-500 mb-1">{label}</div>
      <div className={`text-lg font-bold font-mono ${color}`}>{value}</div>
      <div className="text-xs text-gray-600 mt-0.5">{sub}</div>
    </div>
  );
}

function outcomeLabel(outcome: string) {
  if (outcome === 'home_win') return '홈승';
  if (outcome === 'away_win') return '원정승';
  return '무승부';
}

'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { calculateStakes } from '@/lib/api';
import { StakeCalculation, MarketType } from '@/types';
import { getMarketLabel } from '@/lib/utils';

function CalculatorContent() {
  const searchParams = useSearchParams();
  const oddsParam = searchParams.get('odds');
  const marketParam = searchParams.get('market') as MarketType | null;

  const [marketType, setMarketType] = useState<MarketType>(marketParam || 'h2h');
  const [numOutcomes, setNumOutcomes] = useState(2);
  const [odds, setOdds] = useState<string[]>(['2.10', '2.05', '3.20']);
  const [handicap, setHandicap] = useState('');
  const [totalStake, setTotalStake] = useState('1000');
  const [result, setResult] = useState<StakeCalculation | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const outcomeLabels = marketType === 'totals'
    ? ['오버', '언더', '']
    : marketType === 'spreads'
    ? ['홈 스프레드', '원정 스프레드', '']
    : ['홈승', '원정승', '무승부'];

  useEffect(() => {
    if (oddsParam) {
      const parts = oddsParam.split(',').filter(Boolean);
      if (parts.length >= 2) {
        setNumOutcomes(parts.length);
        setOdds([...parts, ...odds.slice(parts.length)]);
      }
    }
    if (marketParam) {
      setMarketType(marketParam);
      if (marketParam !== 'h2h') setNumOutcomes(2);
    }
    const pointParam = searchParams.get('point');
    if (pointParam) setHandicap(pointParam);
    const stakeParam = searchParams.get('stake');
    if (stakeParam) setTotalStake(stakeParam);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [oddsParam, marketParam]);

  function handleMarketChange(mt: MarketType) {
    setMarketType(mt);
    setResult(null);
    if (mt !== 'h2h') setNumOutcomes(2);
  }

  const currentOdds = odds.slice(0, numOutcomes).map(Number).filter((n) => n > 1);
  const arbFactor = currentOdds.length === numOutcomes
    ? currentOdds.reduce((s, o) => s + 1 / o, 0)
    : null;
  const isArbitrage = arbFactor !== null && arbFactor < 1;
  const estimatedProfit = arbFactor !== null ? (1 - arbFactor) * 100 : null;

  async function handleCalculate() {
    setError('');
    const oddsArray = odds.slice(0, numOutcomes).map(Number);
    const stake = parseFloat(totalStake);

    if (oddsArray.some((o) => isNaN(o) || o <= 1)) {
      setError('모든 배당은 1.00보다 커야 합니다.');
      return;
    }
    if (isNaN(stake) || stake <= 0) {
      setError('총 투자금은 양수여야 합니다.');
      return;
    }

    setLoading(true);
    try {
      const data = await calculateStakes(stake, oddsArray);
      setResult(data);
    } catch {
      setError('계산 실패. 백엔드가 실행 중인지 확인하세요.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto p-6 overflow-auto h-full">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">배팅 계산기</h1>
          <p className="text-sm text-gray-400">
            보장 수익을 위한 최적 스테이크 배분을 계산합니다.
          </p>
        </div>
        <Link href="/" className="btn-sm bg-gray-800 text-gray-300 hover:bg-gray-700">
          대시보드로
        </Link>
      </div>

      <div className="card space-y-5">
        {/* 마켓 유형 */}
        <div>
          <label className="block text-sm text-gray-400 mb-2">마켓 유형</label>
          <div className="flex gap-2">
            {(['h2h', 'spreads', 'totals'] as MarketType[]).map((mt) => (
              <button
                key={mt}
                onClick={() => handleMarketChange(mt)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  marketType === mt ? 'bg-green-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'
                }`}
              >
                {getMarketLabel(mt)}
                <span className="text-xs ml-1 opacity-60">
                  {mt === 'h2h' ? '(1X2)' : mt === 'spreads' ? '(핸디캡)' : '(오버/언더)'}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* 결과 수 (h2h만) */}
        {marketType === 'h2h' && (
          <div>
            <label className="block text-sm text-gray-400 mb-2">결과 수</label>
            <div className="flex gap-2">
              {[2, 3].map((n) => (
                <button
                  key={n}
                  onClick={() => { setNumOutcomes(n); setResult(null); }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    numOutcomes === n ? 'bg-green-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'
                  }`}
                >
                  {n === 2 ? '2-way (무승부 없음)' : '3-way (1X2)'}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 핸디캡/라인 입력 */}
        {(marketType === 'spreads' || marketType === 'totals') && (
          <div>
            <label className="block text-sm text-gray-400 mb-2">
              {marketType === 'spreads' ? '핸디캡 포인트' : '토탈 라인'}
            </label>
            <input
              type="number"
              step="0.25"
              value={handicap}
              onChange={(e) => setHandicap(e.target.value)}
              placeholder={marketType === 'spreads' ? '예: -0.5' : '예: 2.5'}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white font-mono text-sm focus:outline-none focus:border-green-500"
            />
          </div>
        )}

        {/* 배당 입력 */}
        <div>
          <label className="block text-sm text-gray-400 mb-2">배당 (소수점)</label>
          <div className="space-y-2">
            {Array.from({ length: numOutcomes }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <span className="text-xs text-gray-500 w-24 shrink-0">{outcomeLabels[i] || `결과 ${i + 1}`}</span>
                <input
                  type="number"
                  step="0.01"
                  min="1.01"
                  value={odds[i] || ''}
                  onChange={(e) => {
                    const next = [...odds];
                    next[i] = e.target.value;
                    setOdds(next);
                    setResult(null);
                  }}
                  placeholder="예: 2.10"
                  className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white font-mono text-sm focus:outline-none focus:border-green-500"
                />
              </div>
            ))}
          </div>
        </div>

        {/* 실시간 양방 지표 */}
        {arbFactor !== null && (
          <div className={`rounded-lg p-3 text-sm ${isArbitrage ? 'bg-green-500/10 border border-green-500/30' : 'bg-gray-800 border border-gray-700'}`}>
            <div className="flex items-center justify-between">
              <span className="text-gray-400">양방 계수:</span>
              <span className={`font-mono font-bold ${isArbitrage ? 'text-green-400' : 'text-gray-300'}`}>
                {arbFactor.toFixed(4)}
              </span>
            </div>
            <div className="flex items-center justify-between mt-1">
              <span className="text-gray-400">예상 수익률:</span>
              <span className={`font-mono font-bold ${isArbitrage ? 'text-green-400' : 'text-red-400'}`}>
                {estimatedProfit !== null ? `${estimatedProfit > 0 ? '+' : ''}${estimatedProfit.toFixed(4)}%` : '-'}
              </span>
            </div>
            {isArbitrage && (
              <div className="mt-2 flex items-center gap-1.5 text-green-400 text-xs font-semibold">
                <span>⚡</span> 양방 기회 탐지!
              </div>
            )}
          </div>
        )}

        {/* 총 투자금 */}
        <div>
          <label className="block text-sm text-gray-400 mb-2">총 투자금 (₩)</label>
          <input
            type="number"
            min="1"
            step="1"
            value={totalStake}
            onChange={(e) => { setTotalStake(e.target.value); setResult(null); }}
            placeholder="예: 1000000"
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white font-mono text-sm focus:outline-none focus:border-green-500"
          />
        </div>

        {error && <p className="text-red-400 text-sm">{error}</p>}

        <button onClick={handleCalculate} disabled={loading} className="btn-primary w-full">
          {loading ? '계산 중...' : '배분 계산'}
        </button>
      </div>

      {/* 결과 */}
      {result && (
        <div className="card mt-6 space-y-4">
          <h2 className="text-lg font-semibold text-white">스테이크 배분</h2>

          <div className="space-y-2">
            {result.stakes.map((stake, i) => (
              <div key={i} className="flex items-center justify-between bg-gray-800 rounded-lg px-4 py-3">
                <div>
                  <div className="text-sm font-medium text-gray-300">
                    {outcomeLabels[i] || `결과 ${i + 1}`}
                  </div>
                  <div className="text-xs text-gray-500">
                    예상 회수: ₩{result.returns[i].toFixed(0)}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold font-mono text-white">₩{stake.toFixed(0)}</div>
                  <div className="text-xs text-gray-500">
                    {((stake / result.totalStake) * 100).toFixed(1)}%
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="border-t border-gray-800 pt-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">총 투자금:</span>
              <span className="font-mono text-white">₩{result.totalStake.toFixed(0)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">보장 회수금:</span>
              <span className="font-mono text-gray-300">₩{Math.min(...result.returns).toFixed(0)}</span>
            </div>
            <div className="flex justify-between font-bold">
              <span className={result.profit >= 0 ? 'text-green-400' : 'text-red-400'}>
                {result.profit >= 0 ? '보장 수익:' : '손실:'}
              </span>
              <span className={`font-mono text-lg ${result.profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {result.profit >= 0 ? '+' : ''}₩{result.profit.toFixed(0)} ({result.profitPercent.toFixed(4)}%)
              </span>
            </div>
          </div>

          {!result.isArbitrage && (
            <p className="text-yellow-400 text-xs">
              참고: 이 배당은 양방 기회를 구성하지 않습니다. 손실이 발생할 수 있습니다.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export default function CalculatorPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-full text-gray-500">로딩 중...</div>}>
      <CalculatorContent />
    </Suspense>
  );
}

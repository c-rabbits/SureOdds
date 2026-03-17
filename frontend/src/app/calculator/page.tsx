'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { calculateStakes } from '@/lib/api';
import { StakeCalculation, MarketType } from '@/types';
import { getMarketLabel } from '@/lib/utils';

// 환율 캐시 (세션 동안 유지)
let cachedRate: { rate: number; fetchedAt: number } | null = null;
const RATE_CACHE_TTL = 30 * 60 * 1000; // 30분

async function fetchExchangeRate(): Promise<number> {
  if (cachedRate && Date.now() - cachedRate.fetchedAt < RATE_CACHE_TTL) {
    return cachedRate.rate;
  }
  try {
    const res = await fetch('https://open.er-api.com/v6/latest/USD');
    const data = await res.json();
    const rate = data.rates?.KRW ?? 1450;
    cachedRate = { rate, fetchedAt: Date.now() };
    return rate;
  } catch {
    return cachedRate?.rate ?? 1450;
  }
}

function CalculatorContent() {
  const searchParams = useSearchParams();
  const oddsParam = searchParams.get('odds');
  const marketParam = searchParams.get('market') as MarketType | null;

  const [marketType, setMarketType] = useState<MarketType>(marketParam || 'h2h');
  const [numOutcomes, setNumOutcomes] = useState(2);
  const [odds, setOdds] = useState<string[]>(['2.10', '2.05', '3.20']);
  const [handicap, setHandicap] = useState('');

  // 투자금 (달러/원화)
  const [stakeUsd, setStakeUsd] = useState('100');
  const [stakeKrw, setStakeKrw] = useState('');
  const [exchangeRate, setExchangeRate] = useState(1450);
  const [rateLoading, setRateLoading] = useState(false);

  const [result, setResult] = useState<StakeCalculation | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const outcomeLabels = marketType === 'totals'
    ? ['오버', '언더', '']
    : marketType === 'spreads'
    ? ['홈 스프레드', '원정 스프레드', '']
    : ['홈승', '원정승', '무승부'];

  // 환율 로드
  useEffect(() => {
    setRateLoading(true);
    fetchExchangeRate().then((r) => {
      setExchangeRate(r);
      setRateLoading(false);
      const usd = parseFloat(stakeUsd);
      if (!isNaN(usd)) setStakeKrw(Math.round(usd * r).toLocaleString('en-US'));
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    if (stakeParam) setStakeUsd(stakeParam);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [oddsParam, marketParam]);

  // 달러 입력 시 원화 자동 계산
  const handleUsdChange = (val: string) => {
    setStakeUsd(val);
    setResult(null);
    const num = parseFloat(val);
    if (!isNaN(num) && num >= 0) {
      setStakeKrw(Math.round(num * exchangeRate).toLocaleString('en-US'));
    } else {
      setStakeKrw('');
    }
  };

  // 원화 입력 시 달러 자동 계산
  const handleKrwChange = (val: string) => {
    const clean = val.replace(/,/g, '');
    setStakeKrw(val);
    setResult(null);
    const num = parseFloat(clean);
    if (!isNaN(num) && num >= 0) {
      setStakeUsd((num / exchangeRate).toFixed(2));
    } else {
      setStakeUsd('');
    }
  };

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
    const stake = parseFloat(stakeUsd);

    if (oddsArray.some((o) => isNaN(o) || o <= 1)) {
      setError('모든 배당은 1.00보다 커야 합니다.');
      return;
    }
    if (isNaN(stake) || stake <= 0) {
      setError('투자금을 입력하세요.');
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
    <div className="max-w-2xl mx-auto p-4 overflow-hidden">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white mb-1">배팅 계산기</h1>
        <p className="text-sm text-gray-400">
          보장 수익을 위한 최적 스테이크 배분을 계산합니다.
        </p>
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
              <div key={i} className="flex items-center gap-2">
                <span className="text-xs text-gray-500 w-16 shrink-0">{outcomeLabels[i] || `결과 ${i + 1}`}</span>
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
                <span>&#x26A1;</span> 양방 기회 탐지!
              </div>
            )}
          </div>
        )}

        {/* ─── 투자금 (달러/원화) ─── */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm text-gray-400">투자금</label>
            <span className="text-xs text-gray-500">
              {rateLoading ? '환율 로딩...' : (
                <>USD/KRW: <span className="text-cyan-400 font-mono">&#36;1 = &#8361;{exchangeRate.toLocaleString('ko-KR', { maximumFractionDigits: 0 })}</span></>
              )}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] text-gray-500 mb-1">&#36; 달러 (USD)</label>
              <input
                type="number"
                value={stakeUsd}
                onChange={(e) => handleUsdChange(e.target.value)}
                placeholder="100"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white font-mono text-sm focus:outline-none focus:border-green-500"
              />
            </div>
            <div>
              <label className="block text-[11px] text-gray-500 mb-1">&#8361; 원화 (KRW)</label>
              <input
                type="text"
                value={stakeKrw}
                onChange={(e) => handleKrwChange(e.target.value)}
                placeholder="145,000"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white font-mono text-sm focus:outline-none focus:border-green-500"
              />
            </div>
          </div>
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
                    예상 회수: &#36;{result.returns[i].toFixed(2)} / &#8361;{Math.round(result.returns[i] * exchangeRate).toLocaleString()}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-base font-bold font-mono text-white">&#36;{stake.toFixed(2)}</div>
                  <div className="text-xs text-gray-400 font-mono">
                    &#8361;{Math.round(stake * exchangeRate).toLocaleString()}
                  </div>
                  <div className="text-[10px] text-gray-600">
                    {((stake / result.totalStake) * 100).toFixed(1)}%
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="border-t border-gray-800 pt-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">총 투자금:</span>
              <span className="font-mono text-white">
                &#36;{result.totalStake.toFixed(2)} / &#8361;{Math.round(result.totalStake * exchangeRate).toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">보장 회수금:</span>
              <span className="font-mono text-gray-300">
                &#36;{Math.min(...result.returns).toFixed(2)} / &#8361;{Math.round(Math.min(...result.returns) * exchangeRate).toLocaleString()}
              </span>
            </div>
            <div className={`rounded-lg p-3 mt-2 ${result.isArbitrage ? 'bg-green-900/20 border border-green-800/30' : 'bg-red-900/20 border border-red-800/30'}`}>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="text-xs text-gray-400">예상 수익률</span>
                  <p className={`text-lg font-bold font-mono ${result.isArbitrage ? 'text-green-400' : 'text-red-400'}`}>
                    {result.profitPercent > 0 ? '+' : ''}{result.profitPercent.toFixed(2)}%
                  </p>
                </div>
                <div>
                  <span className="text-xs text-gray-400">보장 수익</span>
                  <p className={`text-sm font-bold font-mono ${result.isArbitrage ? 'text-green-400' : 'text-red-400'}`}>
                    &#36;{result.profit.toFixed(2)}
                  </p>
                  <p className={`text-sm font-mono ${result.isArbitrage ? 'text-green-400/70' : 'text-red-400/70'}`}>
                    &#8361;{Math.round(result.profit * exchangeRate).toLocaleString()}
                  </p>
                </div>
              </div>
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

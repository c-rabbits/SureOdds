'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { calculateStakes } from '@/lib/api';
import { StakeCalculation } from '@/types';

const OUTCOMES = ['Home Win', 'Draw', 'Away Win'];

export default function CalculatorPage() {
  const searchParams = useSearchParams();
  const oddsParam = searchParams.get('odds');

  const [numOutcomes, setNumOutcomes] = useState(2);
  const [odds, setOdds] = useState<string[]>(['2.10', '2.05', '3.20']);
  const [totalStake, setTotalStake] = useState('1000');
  const [result, setResult] = useState<StakeCalculation | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Pre-fill from URL params
  useEffect(() => {
    if (oddsParam) {
      const parts = oddsParam.split(',').filter(Boolean);
      if (parts.length >= 2) {
        setNumOutcomes(parts.length);
        setOdds([...parts, ...odds.slice(parts.length)]);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [oddsParam]);

  // Calculate arb factor live
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
      setError('All odds must be greater than 1.00');
      return;
    }
    if (isNaN(stake) || stake <= 0) {
      setError('Total stake must be a positive number');
      return;
    }

    setLoading(true);
    try {
      const data = await calculateStakes(stake, oddsArray);
      setResult(data);
    } catch (err) {
      setError('Failed to calculate. Make sure the backend is running.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Betting Calculator</h1>
        <p className="text-gray-400">
          Enter odds and your total stake to calculate how to distribute bets for guaranteed profit.
        </p>
      </div>

      <div className="card space-y-6">
        {/* Outcome count */}
        <div>
          <label className="block text-sm text-gray-400 mb-2">Number of outcomes</label>
          <div className="flex gap-2">
            {[2, 3].map((n) => (
              <button
                key={n}
                onClick={() => { setNumOutcomes(n); setResult(null); }}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  numOutcomes === n ? 'bg-green-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'
                }`}
              >
                {n === 2 ? '2-way (no draw)' : '3-way (1X2)'}
              </button>
            ))}
          </div>
        </div>

        {/* Odds inputs */}
        <div>
          <label className="block text-sm text-gray-400 mb-2">Odds (decimal)</label>
          <div className="space-y-2">
            {Array.from({ length: numOutcomes }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <span className="text-sm text-gray-500 w-20 shrink-0">{OUTCOMES[i]}</span>
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
                  placeholder="e.g. 2.10"
                  className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white font-mono text-sm focus:outline-none focus:border-green-500"
                />
              </div>
            ))}
          </div>
        </div>

        {/* Live arb indicator */}
        {arbFactor !== null && (
          <div className={`rounded-lg p-3 text-sm ${isArbitrage ? 'bg-green-500/10 border border-green-500/30' : 'bg-gray-800 border border-gray-700'}`}>
            <div className="flex items-center justify-between">
              <span className="text-gray-400">Arb factor:</span>
              <span className={`font-mono font-bold ${isArbitrage ? 'text-green-400' : 'text-gray-300'}`}>
                {arbFactor.toFixed(4)}
              </span>
            </div>
            <div className="flex items-center justify-between mt-1">
              <span className="text-gray-400">Estimated profit:</span>
              <span className={`font-mono font-bold ${isArbitrage ? 'text-green-400' : 'text-red-400'}`}>
                {estimatedProfit !== null ? `${estimatedProfit > 0 ? '+' : ''}${estimatedProfit.toFixed(4)}%` : '-'}
              </span>
            </div>
            {isArbitrage && (
              <div className="mt-2 flex items-center gap-1.5 text-green-400 text-xs font-semibold">
                <span>⚡</span> Arbitrage opportunity detected!
              </div>
            )}
          </div>
        )}

        {/* Stake input */}
        <div>
          <label className="block text-sm text-gray-400 mb-2">Total Stake ($)</label>
          <input
            type="number"
            min="1"
            step="1"
            value={totalStake}
            onChange={(e) => { setTotalStake(e.target.value); setResult(null); }}
            placeholder="e.g. 1000"
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white font-mono text-sm focus:outline-none focus:border-green-500"
          />
        </div>

        {error && <p className="text-red-400 text-sm">{error}</p>}

        <button onClick={handleCalculate} disabled={loading} className="btn-primary w-full">
          {loading ? 'Calculating...' : 'Calculate Stakes'}
        </button>
      </div>

      {/* Result */}
      {result && (
        <div className="card mt-6 space-y-4">
          <h2 className="text-lg font-semibold text-white">Stake Distribution</h2>

          <div className="space-y-2">
            {result.stakes.map((stake, i) => (
              <div key={i} className="flex items-center justify-between bg-gray-800 rounded-lg px-4 py-3">
                <div>
                  <div className="text-sm font-medium text-gray-300">{OUTCOMES[i] || `Outcome ${i + 1}`}</div>
                  <div className="text-xs text-gray-500">
                    Return: ${result.returns[i].toFixed(2)}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold font-mono text-white">${stake.toFixed(2)}</div>
                  <div className="text-xs text-gray-500">
                    {((stake / result.totalStake) * 100).toFixed(1)}%
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="border-t border-gray-800 pt-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Total Staked:</span>
              <span className="font-mono text-white">${result.totalStake.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Guaranteed Return:</span>
              <span className="font-mono text-gray-300">${Math.min(...result.returns).toFixed(2)}</span>
            </div>
            <div className="flex justify-between font-bold">
              <span className={result.profit >= 0 ? 'text-green-400' : 'text-red-400'}>
                {result.profit >= 0 ? 'Guaranteed Profit:' : 'Loss:'}
              </span>
              <span className={`font-mono text-lg ${result.profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {result.profit >= 0 ? '+' : ''}${result.profit.toFixed(2)} ({result.profitPercent.toFixed(4)}%)
              </span>
            </div>
          </div>

          {!result.isArbitrage && (
            <p className="text-yellow-400 text-xs">
              Note: These odds do not form an arbitrage opportunity. A loss may occur.
            </p>
          )}
        </div>
      )}

      {/* Quick example */}
      <div className="mt-8 card bg-gray-900/50">
        <h3 className="text-sm font-semibold text-gray-300 mb-3">Example</h3>
        <div className="text-sm text-gray-400 space-y-1">
          <p>Bet365 Home Win: <span className="font-mono text-white">2.10</span></p>
          <p>Pinnacle Away Win: <span className="font-mono text-white">2.05</span></p>
          <p>Arb factor: 1/2.10 + 1/2.05 = <span className="font-mono text-green-400">0.9637</span> ({'< 1 ✓'})</p>
          <p>Profit on $1000: <span className="font-mono text-green-400">~$37</span></p>
        </div>
      </div>
    </div>
  );
}

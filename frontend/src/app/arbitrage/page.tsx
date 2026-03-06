'use client';

import { useEffect, useState, useCallback } from 'react';
import { ArbitrageOpportunity } from '@/types';
import { getArbitrage } from '@/lib/api';
import ArbitrageCard from '@/components/ArbitrageCard';
import LoadingSpinner from '@/components/LoadingSpinner';

export default function ArbitragePage() {
  const [opportunities, setOpportunities] = useState<ArbitrageOpportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [minProfit, setMinProfit] = useState(0);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await getArbitrage({ limit: 50, min_profit: minProfit });
      setOpportunities(data);
      setLastUpdated(new Date());
    } catch (err) {
      console.error('Failed to load arbitrage:', err);
    } finally {
      setLoading(false);
    }
  }, [minProfit]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  useEffect(() => {
    const timer = setInterval(load, 30000);
    return () => clearInterval(timer);
  }, [load]);

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
          <span>⚡</span> Sure Bets
        </h1>
        <p className="text-gray-400">
          Automatically detected arbitrage opportunities. Profit guaranteed regardless of outcome.
        </p>
        {lastUpdated && (
          <p className="text-xs text-gray-600 mt-1">
            Refreshes every 30s &bull; Last updated: {lastUpdated.toLocaleTimeString()}
          </p>
        )}
      </div>

      {/* How it works */}
      <div className="card mb-8 bg-gray-900/50">
        <h2 className="text-sm font-semibold text-gray-300 mb-3">How Arbitrage Works</h2>
        <div className="grid sm:grid-cols-3 gap-4 text-sm text-gray-400">
          <div className="flex gap-3">
            <span className="text-green-400 font-bold shrink-0">1.</span>
            <p>Different bookmakers offer different odds on the same event.</p>
          </div>
          <div className="flex gap-3">
            <span className="text-green-400 font-bold shrink-0">2.</span>
            <p>By combining the best odds, the sum of implied probabilities drops below 100%.</p>
          </div>
          <div className="flex gap-3">
            <span className="text-green-400 font-bold shrink-0">3.</span>
            <p>Bet proportionally on all outcomes to guarantee profit no matter the result.</p>
          </div>
        </div>
        <div className="mt-3 p-3 bg-gray-800 rounded-lg font-mono text-xs text-gray-400">
          arb = 1/oddsA + 1/oddsB {'< 1'} &nbsp;→&nbsp; profit = (1 - arb) × 100%
        </div>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-4 mb-6">
        <label className="text-sm text-gray-400">Min profit:</label>
        {[0, 0.5, 1, 2].map((v) => (
          <button
            key={v}
            onClick={() => setMinProfit(v)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              minProfit === v ? 'bg-green-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'
            }`}
          >
            {v === 0 ? 'All' : `≥ ${v}%`}
          </button>
        ))}
      </div>

      {loading ? (
        <LoadingSpinner message="Scanning for sure bets..." />
      ) : opportunities.length === 0 ? (
        <div className="text-center py-20 text-gray-500">
          <div className="text-4xl mb-4">🔍</div>
          <p className="font-medium text-gray-400">No sure bets found right now.</p>
          <p className="text-sm mt-2">Arbitrage opportunities are rare and short-lived. Check back soon.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {opportunities.map((opp) => (
            <ArbitrageCard key={opp.id} opportunity={opp} />
          ))}
        </div>
      )}
    </div>
  );
}

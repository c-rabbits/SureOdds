'use client';

import { useEffect, useState, useCallback } from 'react';
import { Match, Odds, ArbitrageOpportunity } from '@/types';
import { getMatches, getOdds, getArbitrage } from '@/lib/api';
import MatchCard from '@/components/MatchCard';
import StatsBar from '@/components/StatsBar';
import LoadingSpinner from '@/components/LoadingSpinner';

const SPORTS = [
  { key: '', label: 'All' },
  { key: 'soccer_epl', label: 'Premier League' },
  { key: 'soccer_spain_la_liga', label: 'La Liga' },
  { key: 'soccer_germany_bundesliga', label: 'Bundesliga' },
  { key: 'soccer_italy_serie_a', label: 'Serie A' },
  { key: 'soccer_france_ligue_one', label: 'Ligue 1' },
];

export default function HomePage() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [oddsMap, setOddsMap] = useState<Record<string, Odds[]>>({});
  const [arbitrage, setArbitrage] = useState<ArbitrageOpportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSport, setSelectedSport] = useState('');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const arbMatchIds = new Set(arbitrage.map((a) => a.match_id));
  const arbProfitMap = Object.fromEntries(arbitrage.map((a) => [a.match_id, a.profit_percent]));

  const load = useCallback(async () => {
    try {
      const [matchData, arbData] = await Promise.all([
        getMatches({ sport: selectedSport || undefined, limit: 30 }),
        getArbitrage({ limit: 50 }),
      ]);

      setMatches(matchData);
      setArbitrage(arbData);
      setLastUpdated(new Date());

      // Fetch odds for top 10 matches
      const oddsResults = await Promise.all(
        matchData.slice(0, 10).map(async (m) => ({ id: m.id, odds: await getOdds(m.id) }))
      );
      const newOddsMap: Record<string, Odds[]> = {};
      for (const r of oddsResults) newOddsMap[r.id] = r.odds;
      setOddsMap(newOddsMap);
    } catch (err) {
      console.error('Failed to load data:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedSport]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  // Auto-refresh every 60s
  useEffect(() => {
    const timer = setInterval(load, 60000);
    return () => clearInterval(timer);
  }, [load]);

  const sureBetMatches = matches.filter((m) => arbMatchIds.has(m.id));
  const regularMatches = matches.filter((m) => !arbMatchIds.has(m.id));
  const topProfit = arbitrage.length > 0 ? Math.max(...arbitrage.map((a) => Number(a.profit_percent))) : 0;

  return (
    <div>
      {/* Page header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">
          Sports Odds Comparison
        </h1>
        <p className="text-gray-400">
          Real-time odds from top bookmakers with automatic arbitrage detection.
        </p>
        {lastUpdated && (
          <p className="text-xs text-gray-600 mt-1">
            Last updated: {lastUpdated.toLocaleTimeString()}
          </p>
        )}
      </div>

      {/* Stats */}
      <StatsBar
        matchCount={matches.length}
        arbCount={arbitrage.length}
        topProfit={topProfit}
      />

      {/* Sport filter */}
      <div className="flex gap-2 flex-wrap mb-6">
        {SPORTS.map((s) => (
          <button
            key={s.key}
            onClick={() => setSelectedSport(s.key)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              selectedSport === s.key
                ? 'bg-green-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:text-white'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {loading ? (
        <LoadingSpinner message="Fetching live odds..." />
      ) : matches.length === 0 ? (
        <div className="text-center py-20 text-gray-500">
          <div className="text-4xl mb-4">⚽</div>
          <p>No matches found. Make sure the collector is running.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Sure Bet matches */}
          {sureBetMatches.length > 0 && (
            <section>
              <h2 className="text-lg font-semibold text-green-400 mb-4 flex items-center gap-2">
                <span>⚡</span> Sure Bets Available ({sureBetMatches.length})
              </h2>
              <div className="space-y-3">
                {sureBetMatches.map((match) => (
                  <MatchCard
                    key={match.id}
                    match={match}
                    odds={oddsMap[match.id] || []}
                    hasSureBet
                    profitPercent={Number(arbProfitMap[match.id])}
                  />
                ))}
              </div>
            </section>
          )}

          {/* All other matches */}
          <section>
            <h2 className="text-lg font-semibold text-gray-300 mb-4">
              All Matches ({regularMatches.length})
            </h2>
            <div className="space-y-3">
              {regularMatches.map((match) => (
                <MatchCard
                  key={match.id}
                  match={match}
                  odds={oddsMap[match.id] || []}
                />
              ))}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

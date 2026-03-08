'use client';

import Link from 'next/link';
import { ArbitrageOpportunity } from '@/types';
import { formatMatchTime, getSportEmoji, getBookmakerName, formatOdds, getProfitColorClass } from '@/lib/utils';

interface Props {
  opportunity: ArbitrageOpportunity;
}

export default function ArbitrageCard({ opportunity }: Props) {
  const match = opportunity.matches;
  const profit = Number(opportunity.profit_percent);
  const is3way = opportunity.market_type === 'h2h' && !!opportunity.odds_draw;

  return (
    <div className="card border-green-500/30 hover:border-green-400/50 transition-all">
      {/* Match info */}
      {match && (
        <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
          <span>{getSportEmoji(match.sport)}</span>
          <span>{match.league}</span>
          <span>&bull;</span>
          <span>{formatMatchTime(match.start_time)}</span>
        </div>
      )}

      <div className="flex items-start justify-between gap-4">
        <div>
          {match && (
            <h3 className="text-base font-semibold text-white">
              {match.home_team} <span className="text-gray-500 font-normal">vs</span> {match.away_team}
            </h3>
          )}
        </div>

        <div className="shrink-0 text-right">
          <div className={`text-2xl font-bold font-mono ${getProfitColorClass(profit)}`}>
            +{profit.toFixed(2)}%
          </div>
          <div className="text-xs text-gray-500">guaranteed profit</div>
        </div>
      </div>

      {/* Odds breakdown */}
      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div className="bg-gray-800/60 rounded-lg p-3">
          <div className="text-xs text-gray-500 mb-1">Home Win</div>
          <div className="flex items-center justify-between">
            <span className="text-gray-300 text-sm">{getBookmakerName(opportunity.bookmaker_a)}</span>
            <span className="odds-pill">{formatOdds(opportunity.odds_a)}</span>
          </div>
        </div>

        {is3way && opportunity.odds_draw && (
          <div className="bg-gray-800/60 rounded-lg p-3">
            <div className="text-xs text-gray-500 mb-1">Draw</div>
            <div className="flex items-center justify-between">
              <span className="text-gray-300 text-sm">
                {opportunity.bookmaker_draw ? getBookmakerName(opportunity.bookmaker_draw) : '-'}
              </span>
              <span className="odds-pill">{formatOdds(opportunity.odds_draw)}</span>
            </div>
          </div>
        )}

        <div className="bg-gray-800/60 rounded-lg p-3">
          <div className="text-xs text-gray-500 mb-1">Away Win</div>
          <div className="flex items-center justify-between">
            <span className="text-gray-300 text-sm">{getBookmakerName(opportunity.bookmaker_b)}</span>
            <span className="odds-pill">{formatOdds(opportunity.odds_b)}</span>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-4 flex items-center justify-between">
        <div className="text-xs text-gray-600">
          Detected {new Date(opportunity.detected_at).toLocaleTimeString()}
        </div>
        {match && (
          <Link
            href={`/calculator?odds=${opportunity.odds_a},${is3way && opportunity.odds_draw ? opportunity.odds_draw + ',' : ''}${opportunity.odds_b}`}
            className="btn-primary text-xs"
          >
            Calculate Stakes
          </Link>
        )}
      </div>
    </div>
  );
}

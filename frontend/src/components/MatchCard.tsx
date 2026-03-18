'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Match, Odds } from '@/types';
import { getKoreanLeagueName } from '@/lib/leagueNames';
import { formatMatchTime, getSportEmoji, getBookmakerName, formatOdds } from '@/lib/utils';

interface Props {
  match: Match;
  odds?: Odds[];
  hasSureBet?: boolean;
  profitPercent?: number;
}

export default function MatchCard({ match, odds = [], hasSureBet, profitPercent }: Props) {
  const [expanded, setExpanded] = useState(false);

  // Filter h2h odds only for this legacy card component
  const h2hOdds = odds.filter((o) => o.market_type === 'h2h');

  // Find best odds per outcome
  const bestHome = h2hOdds.reduce<{ odds: number; bookmaker: string } | null>((best, o) => {
    if (!o.outcome_1_odds) return best;
    if (!best || o.outcome_1_odds > best.odds) return { odds: o.outcome_1_odds, bookmaker: o.bookmaker };
    return best;
  }, null);

  const bestAway = h2hOdds.reduce<{ odds: number; bookmaker: string } | null>((best, o) => {
    if (!o.outcome_2_odds) return best;
    if (!best || o.outcome_2_odds > best.odds) return { odds: o.outcome_2_odds, bookmaker: o.bookmaker };
    return best;
  }, null);

  return (
    <div className={`card transition-all ${hasSureBet ? 'border-green-500/40 bg-gray-900/80' : ''}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
            <span>{getSportEmoji(match.sport)}</span>
            <span>{getKoreanLeagueName(match.league)}</span>
            <span>&bull;</span>
            <span>{formatMatchTime(match.start_time)}</span>
          </div>
          <h3 className="text-base font-semibold text-white truncate">
            {match.home_team} <span className="text-gray-500 font-normal">vs</span> {match.away_team}
          </h3>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {hasSureBet && (
            <span className="badge-sure-bet">+{profitPercent?.toFixed(2)}%</span>
          )}
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-gray-500 hover:text-gray-300 transition-colors text-xs px-2 py-1 rounded hover:bg-gray-800"
          >
            {expanded ? '▲' : '▼'}
          </button>
        </div>
      </div>

      {h2hOdds.length > 0 && (
        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
          <div>
            <div className="text-xs text-gray-500 mb-1">Home</div>
            <div className="odds-pill">{formatOdds(bestHome?.odds)}</div>
            {bestHome && <div className="text-xs text-gray-600 mt-0.5">{getBookmakerName(bestHome.bookmaker)}</div>}
          </div>
          <div>
            <div className="text-xs text-gray-500 mb-1">Draw</div>
            <div className="odds-pill">
              {formatOdds(h2hOdds.find((o) => o.outcome_draw_odds)?.outcome_draw_odds)}
            </div>
          </div>
          <div>
            <div className="text-xs text-gray-500 mb-1">Away</div>
            <div className="odds-pill">{formatOdds(bestAway?.odds)}</div>
            {bestAway && <div className="text-xs text-gray-600 mt-0.5">{getBookmakerName(bestAway.bookmaker)}</div>}
          </div>
        </div>
      )}

      {expanded && h2hOdds.length > 0 && (
        <div className="mt-4 border-t border-gray-800 pt-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-500 text-xs">
                <th className="text-left pb-2">Bookmaker</th>
                <th className="text-center pb-2">Home</th>
                <th className="text-center pb-2">Draw</th>
                <th className="text-center pb-2">Away</th>
              </tr>
            </thead>
            <tbody>
              {h2hOdds.map((o) => (
                <tr key={o.id} className="border-t border-gray-800/60">
                  <td className="py-2 text-gray-300 font-medium">{getBookmakerName(o.bookmaker) || o.bookmaker_title}</td>
                  <td className="py-2 text-center">
                    <span className={o.outcome_1_odds === bestHome?.odds ? 'text-green-400 font-bold' : 'text-gray-300'}>
                      {formatOdds(o.outcome_1_odds)}
                    </span>
                  </td>
                  <td className="py-2 text-center text-gray-300">{formatOdds(o.outcome_draw_odds)}</td>
                  <td className="py-2 text-center">
                    <span className={o.outcome_2_odds === bestAway?.odds ? 'text-green-400 font-bold' : 'text-gray-300'}>
                      {formatOdds(o.outcome_2_odds)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="mt-3 flex justify-end">
            <Link href={`/calculator?matchId=${match.id}`} className="btn-secondary text-xs">
              Open Calculator
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

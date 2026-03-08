'use client';

import { useMemo } from 'react';
import { TableRow, FilterState, MarketType } from '@/types';
import {
  getSportEmoji,
  formatShortTime,
  formatOdds,
  formatHandicap,
  getMarketLabel,
  getBookmakerShort,
  getProfitColorClass,
  getSportCategory,
} from '@/lib/utils';

interface Props {
  rows: TableRow[];
  filters: FilterState;
  selectedRowKey: string | null;
  onSelectRow: (row: TableRow) => void;
}

function getRowKey(row: TableRow): string {
  return `${row.matchId}|${row.marketType}|${row.handicapPoint ?? 'null'}`;
}

export default function MatchTable({ rows, filters, selectedRowKey, onSelectRow }: Props) {
  // Apply filters and sort
  const filteredRows = useMemo(() => {
    let result = rows;

    // Filter by sport category
    if (filters.sports.length > 0) {
      result = result.filter((r) => filters.sports.includes(getSportCategory(r.sport)));
    }

    // Filter by market type
    result = result.filter((r) => filters.marketTypes.includes(r.marketType));

    // Filter by min profit (only show rows with arb or all if minProfit is 0)
    if (filters.minProfit > 0) {
      result = result.filter((r) => r.isArbitrage && (r.profitPercent ?? 0) >= filters.minProfit);
    }

    // Sort
    result = [...result].sort((a, b) => {
      if (filters.sortBy === 'profit') {
        // Arb rows always come first
        if (a.isArbitrage !== b.isArbitrage) return a.isArbitrage ? -1 : 1;
        const pa = a.profitPercent ?? -999;
        const pb = b.profitPercent ?? -999;
        // Descending by default (higher profit first)
        const cmp = pb - pa;
        if (cmp !== 0) return filters.sortDir === 'asc' ? -cmp : cmp;
        return new Date(a.startTime).getTime() - new Date(b.startTime).getTime();
      }
      if (filters.sortBy === 'time') {
        const cmp = new Date(a.startTime).getTime() - new Date(b.startTime).getTime();
        return filters.sortDir === 'desc' ? -cmp : cmp;
      }
      return 0;
    });

    return result;
  }, [rows, filters]);

  return (
    <div className="overflow-auto flex-1">
      <table className="data-table">
        <thead>
          <tr>
            <th className="w-6"></th>
            <th>시간</th>
            <th>리그</th>
            <th>홈</th>
            <th>원정</th>
            <th>마켓</th>
            <th className="text-right w-[60px]">배당1</th>
            <th className="w-[48px]">북메이커</th>
            <th className="text-right w-[50px]">무승부</th>
            <th className="text-right w-[60px]">배당2</th>
            <th className="w-[48px]">북메이커</th>
            <th className="text-right w-[70px]">양방계수</th>
            <th className="text-right w-[70px]">수익률</th>
          </tr>
        </thead>
        <tbody>
          {filteredRows.length === 0 ? (
            <tr>
              <td colSpan={13} className="text-center py-12 text-gray-500">
                경기를 찾을 수 없습니다. 필터를 조정하거나 새로고침하세요.
              </td>
            </tr>
          ) : (
            filteredRows.map((row) => {
              const key = getRowKey(row);
              const isSelected = key === selectedRowKey;
              const rowClasses = [
                row.isArbitrage ? 'arb-row' : '',
                isSelected ? 'selected' : '',
                'cursor-pointer',
              ].filter(Boolean).join(' ');

              return (
                <tr
                  key={key}
                  className={rowClasses}
                  onClick={() => onSelectRow(row)}
                >
                  <td className="text-center">{getSportEmoji(row.sport)}</td>
                  <td className="text-gray-400">{formatShortTime(row.startTime)}</td>
                  <td className="text-gray-300 max-w-[120px] truncate" title={row.league}>{row.league}</td>
                  <td className="text-white font-medium max-w-[140px] truncate" title={row.homeTeam}>{row.homeTeam}</td>
                  <td className="text-white font-medium max-w-[140px] truncate" title={row.awayTeam}>{row.awayTeam}</td>
                  <td>
                    <span className="inline-flex items-center gap-1">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                        row.marketType === 'h2h' ? 'bg-blue-500/20 text-blue-400' :
                        row.marketType === 'spreads' ? 'bg-purple-500/20 text-purple-400' :
                        'bg-orange-500/20 text-orange-400'
                      }`}>
                        {getMarketLabel(row.marketType)}
                      </span>
                      {row.handicapPoint !== null && (
                        <span className="text-gray-500">{formatHandicap(row.handicapPoint, row.marketType)}</span>
                      )}
                    </span>
                  </td>
                  <td className="odds-cell">
                    {row.bestOutcome1 ? (
                      <span className={row.isArbitrage ? 'odds-best' : ''}>
                        {formatOdds(row.bestOutcome1.odds)}
                      </span>
                    ) : '-'}
                  </td>
                  <td className="text-gray-500">
                    {row.bestOutcome1 ? getBookmakerShort(row.bestOutcome1.bookmaker) : ''}
                  </td>
                  <td className="odds-cell text-gray-400">
                    {row.bestDraw ? formatOdds(row.bestDraw.odds) : row.marketType === 'h2h' ? '-' : ''}
                  </td>
                  <td className="odds-cell">
                    {row.bestOutcome2 ? (
                      <span className={row.isArbitrage ? 'odds-best' : ''}>
                        {formatOdds(row.bestOutcome2.odds)}
                      </span>
                    ) : '-'}
                  </td>
                  <td className="text-gray-500">
                    {row.bestOutcome2 ? getBookmakerShort(row.bestOutcome2.bookmaker) : ''}
                  </td>
                  <td className="odds-cell text-gray-400 font-mono">
                    {row.arbFactor !== null ? row.arbFactor.toFixed(4) : '-'}
                  </td>
                  <td className="profit-cell">
                    {row.isArbitrage && row.profitPercent !== null ? (
                      <span className={getProfitColorClass(row.profitPercent)}>
                        +{row.profitPercent.toFixed(2)}%
                      </span>
                    ) : row.profitPercent !== null ? (
                      <span className="text-gray-600">
                        {row.profitPercent.toFixed(2)}%
                      </span>
                    ) : '-'}
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}

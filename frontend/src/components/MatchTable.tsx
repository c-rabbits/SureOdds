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
  isDomesticBookmaker,
  timeAgo,
} from '@/lib/utils';
import { getKoreanLeagueName } from '@/lib/leagueNames';
import { getKoreanTeamName } from '@/lib/teamNames';
import TeamLogo from '@/components/TeamLogo';

function OddsChangeIndicator({ change }: { change?: number | null }) {
  if (!change) return null;
  const isUp = change > 0;
  return (
    <span className={`text-[9px] ml-0.5 ${isUp ? 'text-green-400' : 'text-red-400'}`}>
      {isUp ? '▲' : '▼'}
    </span>
  );
}

interface Props {
  rows: TableRow[];
  filters: FilterState;
  selectedRowKey: string | null;
  onSelectRow: (row: TableRow) => void;
  hiddenKeys?: Set<string>;
  onHideRow?: (key: string) => void;
}

function getRowKey(row: TableRow): string {
  return `${row.matchId}|${row.marketType}|${row.handicapPoint ?? 'null'}`;
}

function BookmakerBadge({ bookmaker }: { bookmaker: string }) {
  return (
    <span className="inline-flex items-center gap-0.5">
      {isDomesticBookmaker(bookmaker) && <span className="text-[9px]" title="국내">&#x1F1F0;&#x1F1F7;</span>}
      {getBookmakerShort(bookmaker)}
    </span>
  );
}

function MarketBadge({ marketType, handicapPoint }: { marketType: MarketType; handicapPoint: number | null }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
        marketType === 'h2h' ? 'bg-blue-500/20 text-blue-400' :
        marketType === 'spreads' ? 'bg-purple-500/20 text-purple-400' :
        'bg-orange-500/20 text-orange-400'
      }`}>
        {getMarketLabel(marketType)}
      </span>
      {handicapPoint !== null && (
        <span className="text-[10px] text-gray-500">{formatHandicap(handicapPoint, marketType)}</span>
      )}
    </span>
  );
}

export default function MatchTable({ rows, filters, selectedRowKey, onSelectRow, hiddenKeys, onHideRow }: Props) {
  const filteredRows = useMemo(() => {
    let result = rows;

    if (filters.sports.length > 0) {
      result = result.filter((r) => filters.sports.includes(getSportCategory(r.sport)));
    }

    result = result.filter((r) => filters.marketTypes.includes(r.marketType));

    if (filters.sourceFilter && filters.sourceFilter !== 'all') {
      if (filters.sourceFilter === 'cross') {
        // 혼합: 국내 vs 해외 조합
        result = result.filter((r) => r.isCrossSource);
      } else if (filters.sourceFilter === 'domestic') {
        // 국내: 양쪽 모두 국내 북메이커
        result = result.filter((r) => {
          const bookmakers = [r.bestOutcome1?.bookmaker, r.bestOutcome2?.bookmaker, r.bestDraw?.bookmaker].filter(Boolean);
          return bookmakers.length > 0 && bookmakers.every((b) => isDomesticBookmaker(b!));
        });
      } else if (filters.sourceFilter === 'international') {
        // 해외: 양쪽 모두 해외 북메이커
        result = result.filter((r) => {
          const bookmakers = [r.bestOutcome1?.bookmaker, r.bestOutcome2?.bookmaker, r.bestDraw?.bookmaker].filter(Boolean);
          return bookmakers.length > 0 && bookmakers.every((b) => !isDomesticBookmaker(b!));
        });
      }
    }

    if (filters.bookmakers.length > 0) {
      result = result.filter((r) => {
        const bookmakers = [
          r.bestOutcome1?.bookmaker,
          r.bestOutcome2?.bookmaker,
          r.bestDraw?.bookmaker,
        ].filter(Boolean) as string[];
        return bookmakers.some((b) => filters.bookmakers.includes(b));
      });
    }

    // 리그 필터
    if (filters.leagues && filters.leagues.length > 0) {
      result = result.filter((r) => filters.leagues.includes(r.league));
    }

    // 시간 필터
    if (filters.timeFilter && filters.timeFilter !== 'all') {
      const now = Date.now();
      const cutoffs: Record<string, number> = {
        '1h': now + 60 * 60 * 1000,
        '3h': now + 3 * 60 * 60 * 1000,
        'today': new Date().setHours(23, 59, 59, 999),
      };
      const cutoff = cutoffs[filters.timeFilter];
      if (cutoff) {
        result = result.filter((r) => new Date(r.startTime).getTime() <= cutoff);
      }
    }

    // 필수 북메이커
    if (filters.requiredBookmaker) {
      result = result.filter((r) => {
        const bookmakers = [r.bestOutcome1?.bookmaker, r.bestOutcome2?.bookmaker, r.bestDraw?.bookmaker].filter(Boolean);
        return bookmakers.includes(filters.requiredBookmaker);
      });
    }

    if (filters.minProfit > 0) {
      result = result.filter((r) => r.isArbitrage && (r.profitPercent ?? 0) >= filters.minProfit);
    }

    // 숨긴 양방 제외
    if (hiddenKeys && hiddenKeys.size > 0) {
      result = result.filter((r) => {
        const key = `${r.matchId}|${r.marketType}|${r.handicapPoint}`;
        return !hiddenKeys.has(key);
      });
    }

    result = [...result].sort((a, b) => {
      if (filters.sortBy === 'profit') {
        if (a.isArbitrage !== b.isArbitrage) return a.isArbitrage ? -1 : 1;
        const pa = a.profitPercent ?? -999;
        const pb = b.profitPercent ?? -999;
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

  if (filteredRows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-gray-500 text-center">
        <p>경기를 찾을 수 없습니다.</p>
        <p>필터를 조정하거나 새로고침하세요.</p>
      </div>
    );
  }

  return (
    <div className="md:overflow-auto md:h-full">
      {/* 모바일: 카드 레이아웃 */}
      <div className="md:hidden flex flex-col gap-2 p-2 pb-6">
        {filteredRows.map((row) => {
          const key = getRowKey(row);
          const isSelected = key === selectedRowKey;

          return (
            <div
              key={key}
              className={`rounded-lg border p-3 cursor-pointer transition-colors ${
                row.isArbitrage
                  ? 'border-green-500/30 bg-green-500/5'
                  : 'border-gray-800 bg-gray-900/50'
              } ${isSelected ? 'ring-1 ring-green-400' : ''}`}
              onClick={() => onSelectRow(row)}
            >
              {/* 상단: 리그 + 시간 + 마켓 */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5 text-[11px] text-gray-400">
                  <span>{getSportEmoji(row.sport)}</span>
                  <span className="truncate max-w-[140px]">{getKoreanLeagueName(row.league)}</span>
                </div>
                <span className="text-[10px] text-gray-500">{formatShortTime(row.startTime)}</span>
              </div>

              {/* 중간: 팀 이름 */}
              <div className="flex items-center justify-between mb-2">
                <span className="flex items-center gap-1 text-[13px] text-white font-medium truncate max-w-[45%]" title={row.homeTeam}>
                  <TeamLogo teamName={row.homeTeam} size={18} />
                  {getKoreanTeamName(row.homeTeam)}
                </span>
                <span className="text-xs text-gray-600 mx-1">vs</span>
                <span className="flex items-center gap-1 text-[13px] text-white font-medium truncate max-w-[45%] justify-end" title={row.awayTeam}>
                  {getKoreanTeamName(row.awayTeam)}
                  <TeamLogo teamName={row.awayTeam} size={18} />
                </span>
              </div>

              {/* 하단: 배당 정보 */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MarketBadge marketType={row.marketType} handicapPoint={row.handicapPoint} />
                </div>

                <div className="flex items-center gap-1.5">
                  {row.isArbitrage && row.profitPercent !== null ? (
                    <span className={`text-sm font-bold ${getProfitColorClass(row.profitPercent)} inline-flex items-center gap-0.5`}>
                      {row.isCrossSource && <span className="text-[9px]">&#x1F500;</span>}
                      +{row.profitPercent.toFixed(2)}%
                    </span>
                  ) : row.profitPercent !== null ? (
                    <span className="text-[11px] text-gray-600">{row.profitPercent.toFixed(2)}%</span>
                  ) : null}
                  {row.isArbitrage && row.detectedAt && (
                    <span className="text-[9px] text-gray-500" title={new Date(row.detectedAt).toLocaleString()}>
                      {timeAgo(row.detectedAt)}
                    </span>
                  )}
                  {row.isArbitrage && onHideRow && (
                    <button
                      onClick={(e) => { e.stopPropagation(); onHideRow(`${row.matchId}|${row.marketType}|${row.handicapPoint}`); }}
                      className="text-xs text-gray-400 hover:text-red-400 ml-1 transition-colors"
                      title="숨기기"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>

              {/* 배당 상세 */}
              <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-800">
                <div className="flex flex-col items-center">
                  <span className={`text-sm font-mono ${row.isArbitrage ? 'text-green-400' : 'text-gray-300'} inline-flex items-center`}>
                    {row.bestOutcome1 ? formatOdds(row.bestOutcome1.odds) : '-'}
                    <OddsChangeIndicator change={row.oddsChange1} />
                  </span>
                  <span className="text-[11px] text-gray-500">
                    {row.bestOutcome1 ? <BookmakerBadge bookmaker={row.bestOutcome1.bookmaker} /> : ''}
                  </span>
                </div>

                {(row.marketType === 'h2h' && row.bestDraw) && (
                  <div className="flex flex-col items-center">
                    <span className="text-sm font-mono text-gray-400 inline-flex items-center">
                      {formatOdds(row.bestDraw.odds)}
                      <OddsChangeIndicator change={row.oddsChangeDraw} />
                    </span>
                    <span className="text-[11px] text-gray-500">무</span>
                  </div>
                )}

                <div className="flex flex-col items-center">
                  <span className={`text-sm font-mono ${row.isArbitrage ? 'text-green-400' : 'text-gray-300'} inline-flex items-center`}>
                    {row.bestOutcome2 ? formatOdds(row.bestOutcome2.odds) : '-'}
                    <OddsChangeIndicator change={row.oddsChange2} />
                  </span>
                  <span className="text-[11px] text-gray-500">
                    {row.bestOutcome2 ? <BookmakerBadge bookmaker={row.bestOutcome2.bookmaker} /> : ''}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* PC: 테이블 레이아웃 */}
      <table className="data-table hidden md:table">
        <thead>
          <tr>
            <th className="w-6"></th>
            <th className="w-[140px]">시간</th>
            <th className="w-[180px]">리그</th>
            <th className="w-[140px]">홈</th>
            <th className="w-[140px]">원정</th>
            <th className="w-[100px]">마켓</th>
            <th className="text-center w-[60px]">배당1</th>
            <th className="w-[48px]">북메이커</th>
            <th className="text-center w-[50px]">무승부</th>
            <th className="text-center w-[60px]">배당2</th>
            <th className="w-[48px]">북메이커</th>
            <th className="text-center w-[70px]">양방계수</th>
            <th className="text-center w-[70px]">수익률</th>
            <th className="text-center w-[50px]">수명</th>
            <th className="w-6"></th>
          </tr>
        </thead>
        <tbody>
          {filteredRows.map((row) => {
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
                <td className="text-gray-300 max-w-[120px] truncate" title={getKoreanLeagueName(row.league)}>{getKoreanLeagueName(row.league)}</td>
                <td className="text-white font-medium max-w-[140px] truncate" title={row.homeTeam}>
                  <span className="inline-flex items-center gap-1"><TeamLogo teamName={row.homeTeam} size={16} />{getKoreanTeamName(row.homeTeam)}</span>
                </td>
                <td className="text-white font-medium max-w-[140px] truncate" title={row.awayTeam}>
                  <span className="inline-flex items-center gap-1"><TeamLogo teamName={row.awayTeam} size={16} />{getKoreanTeamName(row.awayTeam)}</span>
                </td>
                <td>
                  <MarketBadge marketType={row.marketType} handicapPoint={row.handicapPoint} />
                </td>
                <td className="odds-cell">
                  {row.bestOutcome1 ? (
                    <span className={`${row.isArbitrage ? 'odds-best' : ''} inline-flex items-center`}>
                      {formatOdds(row.bestOutcome1.odds)}
                      <OddsChangeIndicator change={row.oddsChange1} />
                    </span>
                  ) : '-'}
                </td>
                <td className="text-gray-500">
                  {row.bestOutcome1 ? <BookmakerBadge bookmaker={row.bestOutcome1.bookmaker} /> : ''}
                </td>
                <td className="odds-cell text-gray-400">
                  {row.bestDraw ? (
                    <span className="inline-flex items-center">
                      {formatOdds(row.bestDraw.odds)}
                      <OddsChangeIndicator change={row.oddsChangeDraw} />
                    </span>
                  ) : row.marketType === 'h2h' ? '-' : ''}
                </td>
                <td className="odds-cell">
                  {row.bestOutcome2 ? (
                    <span className={`${row.isArbitrage ? 'odds-best' : ''} inline-flex items-center`}>
                      {formatOdds(row.bestOutcome2.odds)}
                      <OddsChangeIndicator change={row.oddsChange2} />
                    </span>
                  ) : '-'}
                </td>
                <td className="text-gray-500">
                  {row.bestOutcome2 ? <BookmakerBadge bookmaker={row.bestOutcome2.bookmaker} /> : ''}
                </td>
                <td className="odds-cell text-gray-400 font-mono">
                  {row.arbFactor !== null ? row.arbFactor.toFixed(4) : '-'}
                </td>
                <td className="profit-cell">
                  {row.isArbitrage && row.profitPercent !== null ? (
                    <span className={`${getProfitColorClass(row.profitPercent)} inline-flex items-center gap-0.5`}>
                      {row.isCrossSource && <span className="text-[9px]" title="해외vs국내">&#x1F500;</span>}
                      +{row.profitPercent.toFixed(2)}%
                    </span>
                  ) : row.profitPercent !== null ? (
                    <span className="text-gray-600">
                      {row.profitPercent.toFixed(2)}%
                    </span>
                  ) : '-'}
                </td>
                <td className="text-center text-[10px] text-gray-500">
                  {row.isArbitrage && row.detectedAt ? timeAgo(row.detectedAt) : ''}
                </td>
                <td className="text-center">
                  {row.isArbitrage && onHideRow && (
                    <button
                      onClick={(e) => { e.stopPropagation(); onHideRow(getRowKey(row)); }}
                      className="text-xs text-gray-400 hover:text-red-400 transition-colors"
                      title="숨기기"
                    >
                      ✕
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

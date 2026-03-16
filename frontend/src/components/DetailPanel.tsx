'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import Link from 'next/link';
import { MatchWithOdds, Odds, MarketType } from '@/types';
import {
  formatMatchTime,
  getSportEmoji,
  getBookmakerName,
  getBookmakerUrl,
  formatOdds,
  formatHandicap,
  getMarketLabel,
  getOutcomeLabels,
  findBestOdds,
  isDomesticBookmaker,
} from '@/lib/utils';

interface Props {
  match: MatchWithOdds;
  initialMarketType?: MarketType;
  initialHandicapPoint?: number | null;
  onClose: () => void;
}

export default function DetailPanel({ match, initialMarketType, initialHandicapPoint, onClose }: Props) {
  const [activeMarket, setActiveMarket] = useState<MarketType>(initialMarketType || 'h2h');
  const [activePoint, setActivePoint] = useState<number | null>(initialHandicapPoint ?? null);
  const [visible, setVisible] = useState(false);
  const backdropRef = useRef<HTMLDivElement>(null);

  // Animate in on mount
  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
  }, []);

  // Close with animation
  const handleClose = () => {
    setVisible(false);
    setTimeout(onClose, 200);
  };

  // Close on backdrop click
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === backdropRef.current) handleClose();
  };

  // Close on Escape key
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') handleClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 선택한 경기/마켓 변경 시 탭 동기화
  useEffect(() => {
    if (initialMarketType) setActiveMarket(initialMarketType);
    setActivePoint(initialHandicapPoint ?? null);
  }, [match.id, initialMarketType, initialHandicapPoint]);

  // Group odds by market type
  const oddsGroups = useMemo(() => {
    const groups: Record<string, { marketType: MarketType; handicapPoint: number | null; odds: Odds[] }> = {};
    for (const odd of match.odds || []) {
      const key = `${odd.market_type}|${odd.handicap_point ?? 'null'}`;
      if (!groups[key]) {
        groups[key] = {
          marketType: odd.market_type,
          handicapPoint: odd.handicap_point,
          odds: [],
        };
      }
      groups[key].odds.push(odd);
    }
    return groups;
  }, [match.odds]);

  // Available market types
  const availableMarkets = useMemo(() => {
    const types = new Set<MarketType>();
    for (const group of Object.values(oddsGroups)) {
      types.add(group.marketType);
    }
    return Array.from(types);
  }, [oddsGroups]);

  // Available handicap points for active market
  const availablePoints = useMemo(() => {
    return Object.values(oddsGroups)
      .filter((g) => g.marketType === activeMarket)
      .map((g) => g.handicapPoint)
      .sort((a, b) => (a ?? 0) - (b ?? 0));
  }, [oddsGroups, activeMarket]);

  // Active odds
  const activeKey = `${activeMarket}|${activePoint ?? 'null'}`;
  const activeOdds = oddsGroups[activeKey]?.odds || [];
  const { best1, best2, bestDraw } = findBestOdds(activeOdds);
  const [label1, label2, labelDraw] = getOutcomeLabels(activeMarket);

  // Arb calculation
  const arbOdds = bestDraw
    ? [best1?.odds ?? 0, bestDraw.odds, best2?.odds ?? 0]
    : [best1?.odds ?? 0, best2?.odds ?? 0];
  const hasValidOdds = arbOdds.every((o) => o > 1);
  const arbFactor = hasValidOdds ? arbOdds.reduce((s, o) => s + 1 / o, 0) : null;
  const isArb = arbFactor !== null && arbFactor < 1;
  const profitPercent = arbFactor !== null ? (1 - arbFactor) * 100 : null;

  // Build calculator URL
  const calcOdds = bestDraw
    ? `${best1?.odds ?? ''},${bestDraw.odds},${best2?.odds ?? ''}`
    : `${best1?.odds ?? ''},${best2?.odds ?? ''}`;

  return (
    <div
      ref={backdropRef}
      onClick={handleBackdropClick}
      className={`fixed inset-0 z-50 transition-colors duration-200 ${visible ? 'bg-black/50' : 'bg-transparent pointer-events-none'}`}
    >
      <div
        className={`fixed bottom-0 left-0 right-0 bg-gray-900 border-t border-gray-700 rounded-t-2xl flex flex-col max-h-[75vh] md:max-h-[60vh] transition-transform duration-200 ease-out ${visible ? 'translate-y-0' : 'translate-y-full'}`}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-2 pb-1 cursor-pointer" onClick={handleClose}>
          <div className="w-10 h-1 bg-gray-600 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-gray-800">
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-lg shrink-0">{getSportEmoji(match.sport)}</span>
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-white truncate">
                {match.home_team} <span className="text-gray-500">vs</span> {match.away_team}
              </h3>
              <p className="text-xs text-gray-500 truncate">
                {match.league} &bull; {formatMatchTime(match.start_time)}
              </p>
            </div>
            {isArb && profitPercent !== null && (
              <span className="badge-sure-bet shrink-0">
                +{profitPercent.toFixed(2)}%
              </span>
            )}
          </div>
          <button onClick={handleClose} className="btn-icon text-gray-400 hover:text-white shrink-0 ml-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Market type tabs */}
        <div className="flex items-center gap-1 px-4 py-1.5 border-b border-gray-800 overflow-x-auto shrink-0">
          {availableMarkets.map((mt) => (
            <button
              key={mt}
              onClick={() => {
                setActiveMarket(mt);
                const pts = Object.values(oddsGroups)
                  .filter((g) => g.marketType === mt)
                  .map((g) => g.handicapPoint);
                setActivePoint(pts[0] ?? null);
              }}
              className={`tab ${activeMarket === mt ? 'tab-active' : 'tab-inactive'}`}
            >
              {getMarketLabel(mt)}
            </button>
          ))}

          {/* Handicap point selector for spreads/totals */}
          {(activeMarket === 'spreads' || activeMarket === 'totals') && availablePoints.length > 1 && (
            <>
              <div className="h-4 w-px bg-gray-700 mx-1" />
              {availablePoints.map((pt) => (
                <button
                  key={pt ?? 'null'}
                  onClick={() => setActivePoint(pt)}
                  className={`tab ${activePoint === pt ? 'tab-active' : 'tab-inactive'}`}
                >
                  {formatHandicap(pt, activeMarket) || 'Default'}
                </button>
              ))}
            </>
          )}
        </div>

        {/* Odds table */}
        <div className="flex-1 overflow-auto px-4 py-2">
          {activeOdds.length === 0 ? (
            <p className="text-gray-500 text-sm text-center py-8">이 마켓에 대한 배당 데이터가 없습니다.</p>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="text-gray-500">
                  <th className="text-left py-1 pb-2">북메이커</th>
                  <th className="text-center py-1 pb-2">{label1}</th>
                  {labelDraw && activeMarket === 'h2h' && (
                    <th className="text-center py-1 pb-2">{labelDraw}</th>
                  )}
                  <th className="text-center py-1 pb-2">{label2}</th>
                  <th className="text-right py-1 pb-2">갱신</th>
                </tr>
              </thead>
              <tbody>
                {activeOdds.map((o) => {
                  const bmUrl = o.event_url || getBookmakerUrl(o.bookmaker, match.sport);
                  return (
                  <tr key={o.id} className="border-t border-gray-800/50">
                    <td className="py-1.5 text-gray-300 font-medium">
                      <span className="flex items-center gap-1.5">
                        {isDomesticBookmaker(o.bookmaker) && <span className="text-[10px]">&#x1F1F0;&#x1F1F7;</span>}
                        {o.bookmaker_title || getBookmakerName(o.bookmaker)}
                      </span>
                    </td>
                    <td className="py-1.5 text-center font-mono">
                      <span className={best1 && o.outcome_1_odds === best1.odds ? 'text-green-400 font-bold' : 'text-gray-300'}>
                        {formatOdds(o.outcome_1_odds)}
                      </span>
                    </td>
                    {labelDraw && activeMarket === 'h2h' && (
                      <td className="py-1.5 text-center font-mono">
                        <span className={bestDraw && o.outcome_draw_odds === bestDraw.odds ? 'text-green-400 font-bold' : 'text-gray-400'}>
                          {formatOdds(o.outcome_draw_odds)}
                        </span>
                      </td>
                    )}
                    <td className="py-1.5 text-center font-mono">
                      <span className={best2 && o.outcome_2_odds === best2.odds ? 'text-green-400 font-bold' : 'text-gray-300'}>
                        {formatOdds(o.outcome_2_odds)}
                      </span>
                    </td>
                    <td className="py-1.5 text-right text-gray-600">
                      {new Date(o.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer: arb summary + calc button */}
        {hasValidOdds && (
          <div className="px-4 py-2.5 border-t border-gray-800 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3 text-xs overflow-x-auto min-w-0">
              <span className="text-gray-500 whitespace-nowrap">
                최적: {label1}@{best1 ? getBookmakerName(best1.bookmaker) : '-'} {formatOdds(best1?.odds)}
                {bestDraw && ` + ${labelDraw}@${getBookmakerName(bestDraw.bookmaker)} ${formatOdds(bestDraw.odds)}`}
                {' + '}{label2}@{best2 ? getBookmakerName(best2.bookmaker) : '-'} {formatOdds(best2?.odds)}
              </span>
              <span className={`font-mono font-bold shrink-0 ${isArb ? 'text-green-400' : 'text-red-400'}`}>
                {profitPercent !== null && (profitPercent > 0 ? '+' : '')}{profitPercent?.toFixed(2)}%
              </span>
            </div>
            <Link
              href={`/calculator?odds=${calcOdds}`}
              className="btn-sm bg-green-600 hover:bg-green-500 text-white shrink-0 ml-2"
            >
              배분 계산
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

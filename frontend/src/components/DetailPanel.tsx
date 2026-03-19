'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { MatchWithOdds, Odds, MarketType, StakeCalculation } from '@/types';
import { calculateStakes } from '@/lib/api';
import { getKoreanLeagueName } from '@/lib/leagueNames';
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
import { getKoreanTeamName } from '@/lib/teamNames';
import TeamLogo from '@/components/TeamLogo';

interface Props {
  match: MatchWithOdds;
  initialMarketType?: MarketType;
  initialHandicapPoint?: number | null;
  onClose: () => void;
}

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

export default function DetailPanel({ match, initialMarketType, initialHandicapPoint, onClose }: Props) {
  const [activeMarket, setActiveMarket] = useState<MarketType>(initialMarketType || 'h2h');
  const [activePoint, setActivePoint] = useState<number | null>(initialHandicapPoint ?? null);
  const [visible, setVisible] = useState(false);
  const [showCalc, setShowCalc] = useState(false);
  const backdropRef = useRef<HTMLDivElement>(null);

  // 배분 계산 상태
  const [exchangeRate, setExchangeRate] = useState<number>(1450);
  const [rateLoading, setRateLoading] = useState(false);
  const [stakeUsd, setStakeUsd] = useState<string>('100');
  const [stakeKrw, setStakeKrw] = useState<string>('');
  const [lastEdited, setLastEdited] = useState<'usd' | 'krw'>('usd');
  const [calcResult, setCalcResult] = useState<StakeCalculation | null>(null);
  const [calcLoading, setCalcLoading] = useState(false);

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
        groups[key] = { marketType: odd.market_type, handicapPoint: odd.handicap_point, odds: [] };
      }
      groups[key].odds.push(odd);
    }
    return groups;
  }, [match.odds]);

  const availableMarkets = useMemo(() => {
    const types = new Set<MarketType>();
    for (const group of Object.values(oddsGroups)) types.add(group.marketType);
    return Array.from(types);
  }, [oddsGroups]);

  const availablePoints = useMemo(() => {
    return Object.values(oddsGroups)
      .filter((g) => g.marketType === activeMarket)
      .map((g) => g.handicapPoint)
      .sort((a, b) => (a ?? 0) - (b ?? 0));
  }, [oddsGroups, activeMarket]);

  const activeKey = `${activeMarket}|${activePoint ?? 'null'}`;
  const activeOdds = oddsGroups[activeKey]?.odds || [];
  const { best1, best2, bestDraw } = findBestOdds(activeOdds);
  const [label1, label2, labelDraw] = getOutcomeLabels(activeMarket);

  // Arb calculation (memoized to avoid infinite re-render loop)
  const arbOdds = useMemo(() => bestDraw
    ? [best1?.odds ?? 0, bestDraw.odds, best2?.odds ?? 0]
    : [best1?.odds ?? 0, best2?.odds ?? 0],
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [best1?.odds, best2?.odds, bestDraw?.odds]);
  const arbOddsKey = arbOdds.join(',');
  const hasValidOdds = arbOdds.every((o) => o > 1);
  const arbFactor = hasValidOdds ? arbOdds.reduce((s, o) => s + 1 / o, 0) : null;
  const isArb = arbFactor !== null && arbFactor < 1;
  const profitPercent = arbFactor !== null ? (1 - arbFactor) * 100 : null;

  // 환율 로드
  useEffect(() => {
    if (showCalc) {
      setRateLoading(true);
      fetchExchangeRate().then((r) => {
        setExchangeRate(r);
        setRateLoading(false);
        // 초기 KRW 계산
        const usd = parseFloat(stakeUsd);
        if (!isNaN(usd)) setStakeKrw(Math.round(usd * r).toString());
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showCalc]);

  // 달러 입력 시 원화 자동 계산
  const handleUsdChange = (val: string) => {
    setStakeUsd(val);
    setLastEdited('usd');
    const num = parseFloat(val);
    if (!isNaN(num) && num >= 0) {
      setStakeKrw(Math.round(num * exchangeRate).toLocaleString('en-US'));
    } else {
      setStakeKrw('');
    }
  };

  // 원화 입력 시 달러 자동 계산
  const handleKrwChange = (val: string) => {
    // 콤마 제거
    const clean = val.replace(/,/g, '');
    setStakeKrw(val);
    setLastEdited('krw');
    const num = parseFloat(clean);
    if (!isNaN(num) && num >= 0) {
      setStakeUsd((num / exchangeRate).toFixed(2));
    } else {
      setStakeUsd('');
    }
  };

  // 배분 계산 자동 실행 (debounced, stable dependencies)
  useEffect(() => {
    if (!showCalc || !hasValidOdds) return;
    const totalUsd = parseFloat(stakeUsd);
    if (isNaN(totalUsd) || totalUsd <= 0) return;

    const timer = setTimeout(async () => {
      setCalcLoading(true);
      try {
        const result = await calculateStakes(totalUsd, arbOdds);
        setCalcResult(result);
      } catch {
        // keep previous result
      } finally {
        setCalcLoading(false);
      }
    }, 500);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showCalc, stakeUsd, arbOddsKey, hasValidOdds]);

  // 결과 라벨
  const outcomeLabels = bestDraw
    ? [label1, labelDraw || '무', label2]
    : [label1, label2];

  // 북메이커 라벨
  const outcomeBookmakers = bestDraw
    ? [best1 ? getBookmakerName(best1.bookmaker) : '-', getBookmakerName(bestDraw.bookmaker), best2 ? getBookmakerName(best2.bookmaker) : '-']
    : [best1 ? getBookmakerName(best1.bookmaker) : '-', best2 ? getBookmakerName(best2.bookmaker) : '-'];

  return (
    <div
      ref={backdropRef}
      onClick={handleBackdropClick}
      className={`fixed inset-0 z-50 transition-colors duration-200 ${visible ? 'bg-black/50' : 'bg-transparent pointer-events-none'}`}
    >
      <div
        className={`fixed bottom-0 left-0 right-0 bg-gray-900 border-t border-gray-700 rounded-t-2xl flex flex-col transition-transform duration-200 ease-out ${
          visible ? 'translate-y-0' : 'translate-y-full'
        } max-h-[92vh] md:max-h-[85vh]`}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-2 pb-1 cursor-pointer shrink-0" onClick={handleClose}>
          <div className="w-10 h-1 bg-gray-600 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-gray-800 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-lg shrink-0">{getSportEmoji(match.sport)}</span>
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-white truncate flex items-center gap-1" title={`${match.home_team} vs ${match.away_team}`}>
                <TeamLogo teamName={match.home_team} size={18} />
                {getKoreanTeamName(match.home_team)} <span className="text-gray-500">vs</span> {getKoreanTeamName(match.away_team)}
                <TeamLogo teamName={match.away_team} size={18} />
              </h3>
              <p className="text-xs text-gray-500 truncate">
                {getKoreanLeagueName(match.league)} &bull; {formatMatchTime(match.start_time)}
              </p>
            </div>
            {isArb && profitPercent !== null && (
              <span className="badge-sure-bet shrink-0">+{profitPercent.toFixed(2)}%</span>
            )}
          </div>
          <button onClick={handleClose} className="btn-icon text-gray-400 hover:text-white shrink-0 ml-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Market type tabs */}
        <div className="flex items-center gap-1 px-4 py-1.5 border-b border-gray-800 overflow-x-auto shrink-0 flex-nowrap">
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
              className={`tab whitespace-nowrap ${activeMarket === mt ? 'tab-active' : 'tab-inactive'}`}
            >
              {getMarketLabel(mt)}
            </button>
          ))}
          {(activeMarket === 'spreads' || activeMarket === 'totals') && availablePoints.length > 1 && (
            <>
              <div className="h-4 w-px bg-gray-700 mx-1" />
              {availablePoints.map((pt) => (
                <button
                  key={pt ?? 'null'}
                  onClick={() => setActivePoint(pt)}
                  className={`tab ${activePoint === pt ? 'tab-active' : 'tab-inactive'}`}
                >
                  {formatHandicap(pt, activeMarket) || '기본'}
                </button>
              ))}
            </>
          )}
        </div>

        {/* Scrollable content area */}
        <div className="flex-1 overflow-auto">
          {/* Odds table */}
          <div className="px-4 py-2">
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
                  {activeOdds.map((o) => (
                    <tr key={o.id} className="border-t border-gray-800/50">
                      <td className="py-1.5 text-gray-300 font-medium">
                        <span className="flex items-center gap-1.5">
                          {isDomesticBookmaker(o.bookmaker) && <span className="text-[10px]">&#x1F1F0;&#x1F1F7;</span>}
                          {getBookmakerName(o.bookmaker) || o.bookmaker_title}
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
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* ─── 배분 계산 인라인 섹션 ─── */}
          {showCalc && hasValidOdds && (
            <div className="px-4 pb-4 pt-2 border-t border-gray-700 bg-gray-950/50">
              <h4 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                <span>&#x1F4B0;</span> 배분 계산
              </h4>

              {/* 환율 정보 */}
              <div className="flex items-center gap-2 mb-3 text-xs">
                <span className="text-gray-500">USD/KRW 환율:</span>
                {rateLoading ? (
                  <span className="text-gray-500">로딩...</span>
                ) : (
                  <span className="text-cyan-400 font-mono font-bold">
                    &#36;1 = &#8361;{exchangeRate.toLocaleString('ko-KR', { maximumFractionDigits: 0 })}
                  </span>
                )}
              </div>

              {/* 투자금 입력 (달러/원화) */}
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <label className="block text-[11px] text-gray-400 mb-1">&#36; 투자금 (USD)</label>
                  <input
                    type="number"
                    value={stakeUsd}
                    onChange={(e) => handleUsdChange(e.target.value)}
                    placeholder="100"
                    className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white font-mono placeholder-gray-600 focus:border-green-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-gray-400 mb-1">&#8361; 투자금 (KRW)</label>
                  <input
                    type="text"
                    value={stakeKrw}
                    onChange={(e) => handleKrwChange(e.target.value)}
                    placeholder="145,000"
                    className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white font-mono placeholder-gray-600 focus:border-green-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* 계산 결과 */}
              {calcResult ? (
                <div className={`space-y-2 transition-opacity duration-150 ${calcLoading ? 'opacity-50' : 'opacity-100'}`}>
                  {/* 배분 결과 테이블 */}
                  <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-gray-500 border-b border-gray-800">
                          <th className="text-left py-1.5 px-3">결과</th>
                          <th className="text-left py-1.5 px-2">북메이커</th>
                          <th className="text-center py-1.5 px-2">배당</th>
                          <th className="text-right py-1.5 px-2">&#36; 배팅</th>
                          <th className="text-right py-1.5 px-3">&#8361; 배팅</th>
                        </tr>
                      </thead>
                      <tbody>
                        {calcResult.stakes.map((stake, i) => (
                          <tr key={i} className="border-t border-gray-800/50">
                            <td className="py-1.5 px-3 text-white font-medium">{outcomeLabels[i]}</td>
                            <td className="py-1.5 px-2 text-gray-400">{outcomeBookmakers[i]}</td>
                            <td className="py-1.5 px-2 text-center font-mono text-gray-300">{formatOdds(arbOdds[i])}</td>
                            <td className="py-1.5 px-2 text-right font-mono text-cyan-400">&#36;{stake.toFixed(2)}</td>
                            <td className="py-1.5 px-3 text-right font-mono text-cyan-400">&#8361;{Math.round(stake * exchangeRate).toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* 수익률 요약 */}
                  <div className={`rounded-lg p-3 ${calcResult.isArbitrage ? 'bg-green-900/20 border border-green-800/30' : 'bg-red-900/20 border border-red-800/30'}`}>
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <span className="text-gray-400">예상 수익률</span>
                        <p className={`text-lg font-bold font-mono ${calcResult.isArbitrage ? 'text-green-400' : 'text-red-400'}`}>
                          {calcResult.profitPercent > 0 ? '+' : ''}{calcResult.profitPercent.toFixed(2)}%
                        </p>
                      </div>
                      <div>
                        <span className="text-gray-400">보장 수익</span>
                        <p className={`text-sm font-bold font-mono ${calcResult.isArbitrage ? 'text-green-400' : 'text-red-400'}`}>
                          &#36;{calcResult.profit.toFixed(2)}
                        </p>
                        <p className={`text-sm font-mono ${calcResult.isArbitrage ? 'text-green-400/70' : 'text-red-400/70'}`}>
                          &#8361;{Math.round(calcResult.profit * exchangeRate).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </div>

        {/* Footer: arb summary + calc toggle button */}
        {hasValidOdds && (
          <div className="px-4 py-2.5 border-t border-gray-800 shrink-0">
            {/* 수익률 + 버튼 */}
            <div className="flex items-center justify-between mb-1.5">
              <span className={`font-mono font-bold text-sm ${isArb ? 'text-green-400' : 'text-red-400'}`}>
                수익률 {profitPercent !== null && (profitPercent > 0 ? '+' : '')}{profitPercent?.toFixed(2)}%
              </span>
              <button
                onClick={() => setShowCalc((v) => !v)}
                className={`btn-sm shrink-0 ${showCalc ? 'bg-gray-700 hover:bg-gray-600 text-gray-300' : 'bg-green-600 hover:bg-green-500 text-white'}`}
              >
                {showCalc ? '접기' : '배분 계산'}
              </button>
            </div>
            {/* 최적 조합 (줄 바꿈) */}
            <div className="text-[11px] text-gray-500 space-y-0.5">
              <div>{label1}: <span className="text-gray-400">{best1 ? getBookmakerName(best1.bookmaker) : '-'}</span> <span className="text-white font-mono">{formatOdds(best1?.odds)}</span></div>
              {bestDraw && (
                <div>{labelDraw}: <span className="text-gray-400">{getBookmakerName(bestDraw.bookmaker)}</span> <span className="text-white font-mono">{formatOdds(bestDraw.odds)}</span></div>
              )}
              <div>{label2}: <span className="text-gray-400">{best2 ? getBookmakerName(best2.bookmaker) : '-'}</span> <span className="text-white font-mono">{formatOdds(best2?.odds)}</span></div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

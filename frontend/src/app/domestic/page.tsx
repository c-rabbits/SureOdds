'use client';

import { useState, useEffect, useCallback } from 'react';
import { MatchWithOdds, MarketType } from '@/types';
import {
  getMatchesWithOdds,
  scrapeBetman,
  getBetmanRounds,
  saveDomesticOdds,
} from '@/lib/api';
import { getBookmakerName, formatShortTime, getMarketLabel } from '@/lib/utils';

interface BetmanRound {
  gmId: string;
  gmTs: string;
  name: string;
  status: string;
}

export default function DomesticPage() {
  const [matches, setMatches] = useState<MatchWithOdds[]>([]);
  const [rounds, setRounds] = useState<BetmanRound[]>([]);
  const [loading, setLoading] = useState(false);
  const [scraping, setScraping] = useState(false);
  const [scrapeResult, setScrapeResult] = useState<string | null>(null);

  // Manual input state
  const [selectedMatchId, setSelectedMatchId] = useState('');
  const [bookmaker, setBookmaker] = useState('betman_proto');
  const [marketType, setMarketType] = useState<MarketType>('h2h');
  const [handicapPoint, setHandicapPoint] = useState<number>(0);
  const [odds1, setOdds1] = useState<string>('');
  const [odds2, setOdds2] = useState<string>('');
  const [oddsDraw, setOddsDraw] = useState<string>('');
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  // Site credentials (session-only, not stored in DB)
  const [siteId, setSiteId] = useState('');
  const [sitePw, setSitePw] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [matchData, roundData] = await Promise.all([
        getMatchesWithOdds({ limit: 100 }),
        getBetmanRounds().catch(() => []),
      ]);
      setMatches(matchData || []);
      setRounds(roundData || []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleScrape = async () => {
    setScraping(true);
    setScrapeResult(null);
    try {
      const result = await scrapeBetman();
      setScrapeResult(`${result.matches}경기, ${result.oddsRows}개 배당 수집 완료`);
      await loadData();
    } catch (err: unknown) {
      setScrapeResult(`오류: ${err instanceof Error ? err.message : '크롤링 실패'}`);
    } finally {
      setScraping(false);
    }
  };

  const handleSaveOdds = async () => {
    if (!selectedMatchId) {
      setSaveMsg('경기를 선택해주세요');
      return;
    }
    if (!odds1 && !odds2) {
      setSaveMsg('배당률을 입력해주세요');
      return;
    }

    try {
      await saveDomesticOdds({
        matchId: selectedMatchId,
        bookmaker,
        marketType,
        handicapPoint: marketType === 'h2h' ? 0 : handicapPoint,
        odds1: odds1 ? parseFloat(odds1) : null,
        odds2: odds2 ? parseFloat(odds2) : null,
        oddsDraw: oddsDraw ? parseFloat(oddsDraw) : null,
      });
      setSaveMsg('저장 완료! 대시보드에서 양방을 확인하세요.');
      setOdds1('');
      setOdds2('');
      setOddsDraw('');
      await loadData();
    } catch (err: unknown) {
      setSaveMsg(`오류: ${err instanceof Error ? err.message : '저장 실패'}`);
    }
  };

  const domesticOddsCount = matches.reduce(
    (acc, m) => acc + (m.odds?.filter((o) => (o as { source_type?: string }).source_type === 'domestic').length || 0),
    0
  );

  return (
    <div className="h-full overflow-auto p-4 md:p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <span className="text-2xl">&#x1F1F0;&#x1F1F7;</span> 국내 배당 관리
          </h1>
          <p className="text-gray-400 mt-1">
            베트맨 프로토 배당을 크롤링하거나 수동으로 입력하여 해외 배당과 비교합니다.
          </p>
        </div>

        {/* Stats bar */}
        <div className="grid grid-cols-3 gap-4">
          <div className="card p-4 text-center">
            <div className="text-2xl font-bold text-white">{matches.length}</div>
            <div className="text-xs text-gray-400">전체 경기</div>
          </div>
          <div className="card p-4 text-center">
            <div className="text-2xl font-bold text-blue-400">{domesticOddsCount}</div>
            <div className="text-xs text-gray-400">국내 배당</div>
          </div>
          <div className="card p-4 text-center">
            <div className="text-2xl font-bold text-green-400">{rounds.length}</div>
            <div className="text-xs text-gray-400">프로토 회차</div>
          </div>
        </div>

        {/* ─── Section 1: Auto Scrape ─── */}
        <div className="card p-5">
          <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
            <span>&#x1F577;&#xFE0F;</span> 베트맨 자동 크롤링
          </h2>
          <p className="text-sm text-gray-400 mb-4">
            베트맨 프로토 승부식 배당률을 자동으로 수집합니다. 로그인 불필요.
          </p>

          {rounds.length > 0 && (
            <div className="mb-4">
              <div className="text-xs text-gray-500 mb-1">사용 가능한 프로토 회차:</div>
              <div className="flex flex-wrap gap-2">
                {rounds.map((r) => (
                  <span
                    key={`${r.gmId}_${r.gmTs}`}
                    className={`text-xs px-2 py-1 rounded ${
                      r.status === 'on_sale'
                        ? 'bg-green-900/30 text-green-400 border border-green-800'
                        : 'bg-gray-800 text-gray-400 border border-gray-700'
                    }`}
                  >
                    {r.name} {r.status === 'on_sale' ? '(발매중)' : '(마감)'}
                  </span>
                ))}
              </div>
            </div>
          )}

          <button
            onClick={handleScrape}
            disabled={scraping}
            className="btn-primary px-6 py-2 text-sm disabled:opacity-50"
          >
            {scraping ? '크롤링 중...' : '베트맨 크롤링 시작'}
          </button>

          {scrapeResult && (
            <div
              className={`mt-3 text-sm p-3 rounded ${
                scrapeResult.includes('오류')
                  ? 'bg-red-900/20 text-red-400'
                  : 'bg-green-900/20 text-green-400'
              }`}
            >
              {scrapeResult}
            </div>
          )}
        </div>

        {/* ─── Section 2: Manual Input ─── */}
        <div className="card p-5">
          <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
            <span>&#x270D;&#xFE0F;</span> 수동 배당 입력
          </h2>
          <p className="text-sm text-gray-400 mb-4">
            국내 사이트에서 확인한 배당률을 직접 입력합니다.
          </p>

          <div className="space-y-4">
            {/* Match select */}
            <div>
              <label className="block text-xs text-gray-400 mb-1">경기 선택</label>
              <select
                value={selectedMatchId}
                onChange={(e) => setSelectedMatchId(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white"
              >
                <option value="">-- 경기를 선택하세요 --</option>
                {matches.map((m) => (
                  <option key={m.id} value={m.id}>
                    {formatShortTime(m.start_time)} | {m.league} | {m.home_team} vs {m.away_team}
                  </option>
                ))}
              </select>
            </div>

            {/* Bookmaker + Market Type */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-gray-400 mb-1">국내 사이트</label>
                <select
                  value={bookmaker}
                  onChange={(e) => setBookmaker(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white"
                >
                  <option value="betman_proto">베트맨 프로토</option>
                  <option value="manual_domestic">기타 (수동)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">마켓 타입</label>
                <select
                  value={marketType}
                  onChange={(e) => setMarketType(e.target.value as MarketType)}
                  className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white"
                >
                  <option value="h2h">H2H (승무패)</option>
                  <option value="spreads">핸디캡</option>
                  <option value="totals">언더오버</option>
                </select>
              </div>
            </div>

            {/* Handicap point (only for spreads/totals) */}
            {marketType !== 'h2h' && (
              <div>
                <label className="block text-xs text-gray-400 mb-1">
                  {marketType === 'spreads' ? '핸디캡 포인트 (예: -1.5)' : 'O/U 라인 (예: 2.5)'}
                </label>
                <input
                  type="number"
                  step="0.5"
                  value={handicapPoint}
                  onChange={(e) => setHandicapPoint(parseFloat(e.target.value) || 0)}
                  className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white"
                />
              </div>
            )}

            {/* Odds input */}
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-xs text-gray-400 mb-1">
                  {marketType === 'h2h' ? '홈승' : marketType === 'totals' ? '오버' : '홈'}
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="1.01"
                  placeholder="1.55"
                  value={odds1}
                  onChange={(e) => setOdds1(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white"
                />
              </div>
              {marketType === 'h2h' && (
                <div>
                  <label className="block text-xs text-gray-400 mb-1">무승부</label>
                  <input
                    type="number"
                    step="0.01"
                    min="1.01"
                    placeholder="4.10"
                    value={oddsDraw}
                    onChange={(e) => setOddsDraw(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white"
                  />
                </div>
              )}
              <div>
                <label className="block text-xs text-gray-400 mb-1">
                  {marketType === 'h2h' ? '원정승' : marketType === 'totals' ? '언더' : '원정'}
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="1.01"
                  placeholder="3.65"
                  value={odds2}
                  onChange={(e) => setOdds2(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white"
                />
              </div>
            </div>

            <button onClick={handleSaveOdds} className="btn-primary px-6 py-2 text-sm">
              저장 후 양방 확인
            </button>

            {saveMsg && (
              <div
                className={`text-sm p-3 rounded ${
                  saveMsg.includes('오류') ? 'bg-red-900/20 text-red-400' : 'bg-green-900/20 text-green-400'
                }`}
              >
                {saveMsg}
              </div>
            )}
          </div>
        </div>

        {/* ─── Section 3: Site Credentials (for future login-required sites) ─── */}
        <div className="card p-5 opacity-60">
          <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
            <span>&#x1F512;</span> 사이트 로그인 (향후 지원)
          </h2>
          <p className="text-sm text-gray-400 mb-4">
            로그인이 필요한 국내 사이트를 위한 자격증명입니다.
            DB에 저장되지 않으며, 이 탭이 닫히면 자동 삭제됩니다.
          </p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-400 mb-1">사이트 아이디</label>
              <input
                type="text"
                placeholder="아이디 입력"
                value={siteId}
                onChange={(e) => setSiteId(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white"
                disabled
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">비밀번호</label>
              <input
                type="password"
                placeholder="비밀번호 입력"
                value={sitePw}
                onChange={(e) => setSitePw(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white"
                disabled
              />
            </div>
          </div>
          <p className="text-xs text-yellow-500 mt-2">
            * 현재 베트맨은 로그인 없이 배당 조회가 가능하여 비활성화 상태입니다.
          </p>
        </div>
      </div>
    </div>
  );
}

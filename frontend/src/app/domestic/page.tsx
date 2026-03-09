'use client';

import { useState, useEffect, useCallback } from 'react';
import { MatchWithOdds, MarketType } from '@/types';
import {
  getMatchesWithOdds,
  scrapeBetman,
  getBetmanRounds,
  saveDomesticOdds,
} from '@/lib/api';
import { formatShortTime } from '@/lib/utils';

interface BetmanRound {
  gmId: string;
  gmTs: string;
  name: string;
  status: string;
}

// 사설 사이트 등록 정보 (세션 전용, DB 미저장)
interface PrivateSite {
  id: string;
  siteUrl: string;
  siteName: string;
  loginId: string;
  loginPw: string;
  checkInterval: number; // seconds
  enableCross: boolean;
  enableHandicap: boolean;
  enableExtHandicap: boolean; // 연장(핸디)
  enableExtOU: boolean; // 연장(OU)
  isActive: boolean;
  group: string;
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

  // ─── 사설 사이트 등록 state (세션 전용) ───
  const [privateSites, setPrivateSites] = useState<PrivateSite[]>([]);
  const [siteUrl, setSiteUrl] = useState('');
  const [siteName, setSiteName] = useState('');
  const [siteGroup, setSiteGroup] = useState('기본');
  const [siteLoginId, setSiteLoginId] = useState('');
  const [siteLoginPw, setSiteLoginPw] = useState('');
  const [siteCheckInterval, setSiteCheckInterval] = useState(60);
  const [siteCross, setSiteCross] = useState(true);
  const [siteHandicap, setSiteHandicap] = useState(true);
  const [siteExtHandicap, setSiteExtHandicap] = useState(false);
  const [siteExtOU, setSiteExtOU] = useState(false);
  const [editingSiteId, setEditingSiteId] = useState<string | null>(null);

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

  // ─── 사설 사이트 관리 함수 ───
  const handleAddSite = () => {
    if (!siteName.trim()) return;
    const newSite: PrivateSite = {
      id: editingSiteId || `site_${Date.now()}`,
      siteUrl: siteUrl.trim(),
      siteName: siteName.trim(),
      loginId: siteLoginId,
      loginPw: siteLoginPw,
      checkInterval: siteCheckInterval,
      enableCross: siteCross,
      enableHandicap: siteHandicap,
      enableExtHandicap: siteExtHandicap,
      enableExtOU: siteExtOU,
      isActive: true,
      group: siteGroup,
    };

    if (editingSiteId) {
      setPrivateSites((prev) => prev.map((s) => (s.id === editingSiteId ? newSite : s)));
      setEditingSiteId(null);
    } else {
      setPrivateSites((prev) => [...prev, newSite]);
    }
    resetSiteForm();
  };

  const resetSiteForm = () => {
    setSiteUrl('');
    setSiteName('');
    setSiteGroup('기본');
    setSiteLoginId('');
    setSiteLoginPw('');
    setSiteCheckInterval(60);
    setSiteCross(true);
    setSiteHandicap(true);
    setSiteExtHandicap(false);
    setSiteExtOU(false);
    setEditingSiteId(null);
  };

  const handleEditSite = (site: PrivateSite) => {
    setEditingSiteId(site.id);
    setSiteUrl(site.siteUrl);
    setSiteName(site.siteName);
    setSiteGroup(site.group);
    setSiteLoginId(site.loginId);
    setSiteLoginPw(site.loginPw);
    setSiteCheckInterval(site.checkInterval);
    setSiteCross(site.enableCross);
    setSiteHandicap(site.enableHandicap);
    setSiteExtHandicap(site.enableExtHandicap);
    setSiteExtOU(site.enableExtOU);
  };

  const handleDeleteSite = (id: string) => {
    setPrivateSites((prev) => prev.filter((s) => s.id !== id));
    if (editingSiteId === id) resetSiteForm();
  };

  const handleToggleSiteActive = (id: string) => {
    setPrivateSites((prev) =>
      prev.map((s) => (s.id === id ? { ...s, isActive: !s.isActive } : s))
    );
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
        <div className="grid grid-cols-4 gap-4">
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
          <div className="card p-4 text-center">
            <div className="text-2xl font-bold text-yellow-400">{privateSites.filter(s => s.isActive).length}/{privateSites.length}</div>
            <div className="text-xs text-gray-400">사설 사이트</div>
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

        {/* ─── Section 3: 사설 사이트 등록 ─── */}
        <div className="card p-5">
          <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
            <span>&#x1F310;</span> 사설 사이트 등록
          </h2>
          <p className="text-sm text-gray-400 mb-4">
            사설 사이트를 등록하여 배당을 자동 수집합니다.
            <span className="text-yellow-500"> DB에 저장되지 않으며, 탭을 닫으면 자동 삭제됩니다.</span>
          </p>

          {/* 등록 폼 — 이미지 레이아웃 기반 */}
          <div className="bg-gray-900/60 border border-gray-700 rounded-lg p-4 space-y-4">
            {/* Row 1: 사이트 선택 + 그룹 + 사이트명 */}
            <div className="grid grid-cols-12 gap-3 items-end">
              <div className="col-span-5">
                <label className="block text-xs text-gray-400 mb-1">사이트 주소 (검색 가능)</label>
                <input
                  type="text"
                  placeholder="https://example.com"
                  value={siteUrl}
                  onChange={(e) => setSiteUrl(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white placeholder-gray-600"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-xs text-gray-400 mb-1">그룹</label>
                <select
                  value={siteGroup}
                  onChange={(e) => setSiteGroup(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white"
                >
                  <option value="기본">기본</option>
                  <option value="A그룹">A그룹</option>
                  <option value="B그룹">B그룹</option>
                  <option value="C그룹">C그룹</option>
                </select>
              </div>
              <div className="col-span-5">
                <label className="block text-xs text-gray-400 mb-1">사이트명</label>
                <input
                  type="text"
                  placeholder="사이트 이름 입력"
                  value={siteName}
                  onChange={(e) => setSiteName(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white placeholder-gray-600"
                />
              </div>
            </div>

            {/* Row 2: 아이디 + 비밀번호 + 체크간격 */}
            <div className="grid grid-cols-12 gap-3 items-end">
              <div className="col-span-4">
                <label className="block text-xs text-gray-400 mb-1">
                  <span className="mr-1">&#x1F464;</span>아이디
                </label>
                <input
                  type="text"
                  placeholder="아이디 입력"
                  value={siteLoginId}
                  onChange={(e) => setSiteLoginId(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white placeholder-gray-600"
                />
              </div>
              <div className="col-span-4">
                <label className="block text-xs text-gray-400 mb-1">
                  <span className="mr-1">&#x1F512;</span>비밀번호
                </label>
                <input
                  type="password"
                  placeholder="비밀번호 입력"
                  value={siteLoginPw}
                  onChange={(e) => setSiteLoginPw(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white placeholder-gray-600"
                />
              </div>
              <div className="col-span-4">
                <label className="block text-xs text-gray-400 mb-1">체크간격</label>
                <select
                  value={siteCheckInterval}
                  onChange={(e) => setSiteCheckInterval(Number(e.target.value))}
                  className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white"
                >
                  <option value={30}>30초</option>
                  <option value={60}>60초</option>
                  <option value={90}>90초</option>
                  <option value={120}>120초</option>
                </select>
              </div>
            </div>

            {/* Row 3: 마켓 필터 토글 + 사이트 추가 버튼 */}
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-4 flex-wrap">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={siteCross}
                    onChange={(e) => setSiteCross(e.target.checked)}
                    className="w-4 h-4 rounded bg-gray-700 border-gray-600 text-green-500 focus:ring-green-500"
                  />
                  <span className="text-sm text-white">크로스</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={siteHandicap}
                    onChange={(e) => setSiteHandicap(e.target.checked)}
                    className="w-4 h-4 rounded bg-gray-700 border-gray-600 text-purple-500 focus:ring-purple-500"
                  />
                  <span className="text-sm text-white">핸디</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={siteExtHandicap}
                    onChange={(e) => setSiteExtHandicap(e.target.checked)}
                    className="w-4 h-4 rounded bg-gray-700 border-gray-600 text-blue-500 focus:ring-blue-500"
                  />
                  <span className="text-sm text-white">연장(핸디)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={siteExtOU}
                    onChange={(e) => setSiteExtOU(e.target.checked)}
                    className="w-4 h-4 rounded bg-gray-700 border-gray-600 text-orange-500 focus:ring-orange-500"
                  />
                  <span className="text-sm text-white">연장(OU)</span>
                </label>
              </div>
              <div className="flex items-center gap-2">
                {editingSiteId && (
                  <button
                    onClick={resetSiteForm}
                    className="px-4 py-2 text-sm rounded bg-gray-700 text-gray-300 hover:bg-gray-600 transition-colors"
                  >
                    취소
                  </button>
                )}
                <button
                  onClick={handleAddSite}
                  disabled={!siteName.trim()}
                  className="btn-primary px-5 py-2 text-sm disabled:opacity-40"
                >
                  {editingSiteId ? '사이트 수정' : '+ 사이트추가'}
                </button>
              </div>
            </div>
          </div>

          {/* 등록된 사이트 목록 테이블 */}
          {privateSites.length > 0 && (
            <div className="mt-5 overflow-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-700 text-gray-400 text-xs">
                    <th className="text-left py-2 px-2">상태</th>
                    <th className="text-left py-2 px-2">그룹</th>
                    <th className="text-left py-2 px-2">사이트명</th>
                    <th className="text-left py-2 px-2">주소</th>
                    <th className="text-left py-2 px-2">아이디</th>
                    <th className="text-center py-2 px-2">체크간격</th>
                    <th className="text-center py-2 px-2">크로스</th>
                    <th className="text-center py-2 px-2">핸디</th>
                    <th className="text-center py-2 px-2">연장(H)</th>
                    <th className="text-center py-2 px-2">연장(OU)</th>
                    <th className="text-center py-2 px-2">기능</th>
                  </tr>
                </thead>
                <tbody>
                  {privateSites.map((site) => (
                    <tr
                      key={site.id}
                      className={`border-b border-gray-800 hover:bg-gray-800/50 transition-colors ${
                        !site.isActive ? 'opacity-40' : ''
                      }`}
                    >
                      <td className="py-2 px-2">
                        <button
                          onClick={() => handleToggleSiteActive(site.id)}
                          className={`w-3 h-3 rounded-full ${
                            site.isActive ? 'bg-green-500' : 'bg-red-500'
                          }`}
                          title={site.isActive ? '활성' : '비활성'}
                        />
                      </td>
                      <td className="py-2 px-2 text-gray-400">{site.group}</td>
                      <td className="py-2 px-2 text-white font-medium">{site.siteName}</td>
                      <td className="py-2 px-2 text-gray-500 max-w-[150px] truncate" title={site.siteUrl}>
                        {site.siteUrl || '-'}
                      </td>
                      <td className="py-2 px-2 text-gray-300">{site.loginId || '-'}</td>
                      <td className="py-2 px-2 text-center text-gray-300">{site.checkInterval}초</td>
                      <td className="py-2 px-2 text-center">
                        {site.enableCross ? <span className="text-green-400">&#x2714;</span> : <span className="text-gray-600">-</span>}
                      </td>
                      <td className="py-2 px-2 text-center">
                        {site.enableHandicap ? <span className="text-purple-400">&#x2714;</span> : <span className="text-gray-600">-</span>}
                      </td>
                      <td className="py-2 px-2 text-center">
                        {site.enableExtHandicap ? <span className="text-blue-400">&#x2714;</span> : <span className="text-gray-600">-</span>}
                      </td>
                      <td className="py-2 px-2 text-center">
                        {site.enableExtOU ? <span className="text-orange-400">&#x2714;</span> : <span className="text-gray-600">-</span>}
                      </td>
                      <td className="py-2 px-2 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => handleEditSite(site)}
                            className="text-xs px-2 py-1 rounded bg-gray-700 text-gray-300 hover:bg-gray-600"
                            title="수정"
                          >
                            &#x270F;
                          </button>
                          <button
                            onClick={() => handleDeleteSite(site.id)}
                            className="text-xs px-2 py-1 rounded bg-gray-700 text-red-400 hover:bg-red-900/40"
                            title="삭제"
                          >
                            &#x2716;
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="text-xs text-yellow-500/70 mt-3">
                * 등록 정보는 메모리에만 저장됩니다. 페이지를 새로고침하면 초기화됩니다.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

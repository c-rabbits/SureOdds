'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { MatchWithOdds, SiteRegistration, SiteRequest, AvailableSite } from '@/types';
import {
  getMatchesWithOdds,
  scrapeBetman,
  getBetmanRounds,
  getAvailableSites,
  createSiteRegistration,
  getSiteRegistrations,
  updateSiteRegistration,
  deleteSiteRegistration,
  createSiteRequest,
  getSiteRequests,
} from '@/lib/api';
import { formatShortTime } from '@/lib/utils';

interface BetmanRound {
  gmId: string;
  gmTs: string;
  name: string;
  status: string;
}

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  pending: { label: '대기중', color: 'bg-yellow-900/30 text-yellow-400 border-yellow-800' },
  approved: { label: '승인', color: 'bg-blue-900/30 text-blue-400 border-blue-800' },
  active: { label: '운영중', color: 'bg-green-900/30 text-green-400 border-green-800' },
  paused: { label: '일시정지', color: 'bg-gray-700/50 text-gray-400 border-gray-600' },
  rejected: { label: '반려', color: 'bg-red-900/30 text-red-400 border-red-800' },
  completed: { label: '완료', color: 'bg-green-900/30 text-green-400 border-green-800' },
};

export default function DomesticPage() {
  const { isAdmin } = useAuth();
  const [matches, setMatches] = useState<MatchWithOdds[]>([]);
  const [rounds, setRounds] = useState<BetmanRound[]>([]);
  const [loading, setLoading] = useState(false);
  const [scraping, setScraping] = useState(false);
  const [scrapeResult, setScrapeResult] = useState<string | null>(null);

  // ─── 사이트 추가 state ───
  const [availableSites, setAvailableSites] = useState<AvailableSite[]>([]);
  const [sites, setSites] = useState<SiteRegistration[]>([]);
  const [selectedSiteId, setSelectedSiteId] = useState('');
  const [siteLoginId, setSiteLoginId] = useState('');
  const [siteLoginPw, setSiteLoginPw] = useState('');
  const [siteCheckInterval, setSiteCheckInterval] = useState(60);
  const [siteCross, setSiteCross] = useState(true);
  const [siteHandicap, setSiteHandicap] = useState(true);
  const [siteOU, setSiteOU] = useState(true);
  const [editingSiteId, setEditingSiteId] = useState<string | null>(null);
  const [siteSubmitting, setSiteSubmitting] = useState(false);
  const [siteMsg, setSiteMsg] = useState<string | null>(null);

  // ─── 사이트 작업요청 state ───
  const [requests, setRequests] = useState<SiteRequest[]>([]);
  const [reqUrl, setReqUrl] = useState('');
  const [reqName, setReqName] = useState('');
  const [reqNotes, setReqNotes] = useState('');
  const [reqSubmitting, setReqSubmitting] = useState(false);
  const [reqMsg, setReqMsg] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [matchData, roundData, avSites, siteData, reqData] = await Promise.all([
        getMatchesWithOdds({ limit: 100 }),
        getBetmanRounds().catch(() => []),
        getAvailableSites().catch(() => []),
        getSiteRegistrations().catch(() => []),
        getSiteRequests().catch(() => []),
      ]);
      setMatches(matchData || []);
      setRounds(roundData || []);
      setAvailableSites(avSites || []);
      setSites(siteData || []);
      setRequests(reqData || []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ─── 베트맨 크롤링 ───
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

  // ─── 사이트 추가 ───
  const resetSiteForm = () => {
    setSelectedSiteId('');
    setSiteLoginId('');
    setSiteLoginPw('');
    setSiteCheckInterval(60);
    setSiteCross(true);
    setSiteHandicap(true);
    setSiteOU(false);
    setEditingSiteId(null);
  };

  const handleAddSite = async () => {
    if (!selectedSiteId && !editingSiteId) {
      setSiteMsg('사이트를 선택해주세요.');
      return;
    }

    setSiteSubmitting(true);
    setSiteMsg(null);
    try {
      if (editingSiteId) {
        await updateSiteRegistration(editingSiteId, {
          loginId: siteLoginId,
          loginPw: siteLoginPw || undefined,
          checkInterval: siteCheckInterval,
          enableCross: siteCross,
          enableHandicap: siteHandicap,
          enableOU: siteOU,
        });
        setSiteMsg('사이트 수정 완료');
      } else {
        await createSiteRegistration({
          availableSiteId: selectedSiteId,
          loginId: siteLoginId,
          loginPw: siteLoginPw,
          checkInterval: siteCheckInterval,
          enableCross: siteCross,
          enableHandicap: siteHandicap,
          enableOU: siteOU,
        });
        setSiteMsg('사이트 추가 완료! 크롤링이 시작됩니다.');
      }
      resetSiteForm();
      const updated = await getSiteRegistrations().catch(() => []);
      setSites(updated);
    } catch (err: unknown) {
      setSiteMsg(`오류: ${err instanceof Error ? err.message : '저장 실패'}`);
    } finally {
      setSiteSubmitting(false);
    }
  };

  const handleEditSite = (site: SiteRegistration) => {
    setEditingSiteId(site.id);
    setSelectedSiteId(site.available_site_id || '');
    setSiteLoginId(site.login_id || '');
    setSiteLoginPw('');
    setSiteCheckInterval(site.check_interval);
    setSiteCross(site.enable_cross);
    setSiteHandicap(site.enable_handicap);
    setSiteOU(site.enable_ou);
  };

  const handleDeleteSite = async (id: string) => {
    if (!confirm('이 사이트를 삭제하시겠습니까?')) return;
    try {
      await deleteSiteRegistration(id);
      setSites((prev) => prev.filter((s) => s.id !== id));
      if (editingSiteId === id) resetSiteForm();
    } catch {
      // handled by error interceptor
    }
  };

  const handleToggleSiteActive = async (site: SiteRegistration) => {
    try {
      await updateSiteRegistration(site.id, { isActive: !site.is_active });
      setSites((prev) => prev.map((s) => (s.id === site.id ? { ...s, is_active: !s.is_active } : s)));
    } catch {
      // handled by error interceptor
    }
  };

  // ─── 사이트 작업요청 ───
  const handleSubmitRequest = async () => {
    if (!reqUrl.trim()) {
      setReqMsg('사이트 URL은 필수입니다.');
      return;
    }
    setReqSubmitting(true);
    setReqMsg(null);
    try {
      await createSiteRequest({
        siteUrl: reqUrl.trim(),
        siteName: reqName.trim() || undefined,
        notes: reqNotes.trim() || undefined,
      });
      setReqMsg('요청이 제출되었습니다. 관리자 확인 후 처리됩니다.');
      setReqUrl('');
      setReqName('');
      setReqNotes('');
      const updated = await getSiteRequests().catch(() => []);
      setRequests(updated);
    } catch (err: unknown) {
      setReqMsg(`오류: ${err instanceof Error ? err.message : '요청 실패'}`);
    } finally {
      setReqSubmitting(false);
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
            베트맨 프로토 배당 크롤링, 사설 사이트 등록, 사이트 작업 요청을 관리합니다.
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
            <div className="text-2xl font-bold text-yellow-400">{sites.filter((s) => s.is_active).length}/{sites.length}</div>
            <div className="text-xs text-gray-400">등록 사이트</div>
          </div>
        </div>

        {/* ─── Section 1: Auto Scrape (관리자 전용) ─── */}
        {isAdmin && (
          <div className="card p-5">
            <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
              <span>&#x1F577;&#xFE0F;</span> 베트맨 자동 크롤링
              <span className="text-[10px] bg-purple-500/20 text-purple-400 border border-purple-500/30 px-1.5 py-0.5 rounded">관리자</span>
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
        )}

        {/* ─── Section 2: 사이트 추가 ─── */}
        <div className="card p-5">
          <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
            <span>&#x1F310;</span> 사이트 추가
          </h2>
          <p className="text-sm text-gray-400 mb-4">
            배당을 수집할 사설 사이트를 등록합니다. 등록 즉시 크롤링이 시작됩니다.
          </p>

          {/* 등록 폼 */}
          <div className="bg-gray-900/60 border border-gray-700 rounded-lg p-4 space-y-4">
            {/* Row 1: 사이트 선택 */}
            <div>
              <label className="block text-xs text-gray-400 mb-1">사이트 선택</label>
              <select
                value={selectedSiteId}
                onChange={(e) => setSelectedSiteId(e.target.value)}
                disabled={!!editingSiteId}
                className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white disabled:opacity-50"
              >
                <option value="">-- 사이트를 선택하세요 --</option>
                {availableSites.map((as) => (
                  <option key={as.id} value={as.id}>
                    {as.site_name} ({as.site_url})
                  </option>
                ))}
              </select>
            </div>

            {/* Row 2: 아이디 + 비밀번호 */}
            <div className="grid grid-cols-12 gap-3 items-end">
              <div className="col-span-6">
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
              <div className="col-span-6">
                <label className="block text-xs text-gray-400 mb-1">
                  <span className="mr-1">&#x1F512;</span>비밀번호
                </label>
                <input
                  type="password"
                  placeholder={editingSiteId ? '변경 시에만 입력' : '비밀번호 입력'}
                  value={siteLoginPw}
                  onChange={(e) => setSiteLoginPw(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white placeholder-gray-600"
                />
              </div>
            </div>

            {/* Row 3: 마켓 토글 + 버튼 */}
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-4 flex-wrap">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input type="checkbox" checked={siteCross} onChange={(e) => setSiteCross(e.target.checked)} className="w-4 h-4 rounded bg-gray-700 border-gray-600 text-green-500 focus:ring-green-500" />
                  <span className="text-sm text-white">크로스</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input type="checkbox" checked={siteHandicap} onChange={(e) => setSiteHandicap(e.target.checked)} className="w-4 h-4 rounded bg-gray-700 border-gray-600 text-purple-500 focus:ring-purple-500" />
                  <span className="text-sm text-white">핸디</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input type="checkbox" checked={siteOU} onChange={(e) => setSiteOU(e.target.checked)} className="w-4 h-4 rounded bg-gray-700 border-gray-600 text-orange-500 focus:ring-orange-500" />
                  <span className="text-sm text-white">O/U</span>
                </label>
              </div>
              <div className="flex items-center gap-2">
                {editingSiteId && (
                  <button onClick={resetSiteForm} className="px-4 py-2 text-sm rounded bg-gray-700 text-gray-300 hover:bg-gray-600 transition-colors">
                    취소
                  </button>
                )}
                <button
                  onClick={handleAddSite}
                  disabled={siteSubmitting || (!editingSiteId && !selectedSiteId)}
                  className="btn-primary px-5 py-2 text-sm disabled:opacity-40"
                >
                  {siteSubmitting ? '저장 중...' : editingSiteId ? '사이트 수정' : '+ 사이트추가'}
                </button>
              </div>
            </div>
          </div>

          {siteMsg && (
            <div className={`mt-3 text-sm p-3 rounded ${siteMsg.includes('오류') ? 'bg-red-900/20 text-red-400' : 'bg-green-900/20 text-green-400'}`}>
              {siteMsg}
            </div>
          )}

          {/* 등록된 사이트 목록 */}
          {sites.length > 0 && (
            <div className="mt-5 overflow-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-700 text-gray-400 text-xs">
                    <th className="text-left py-2 px-2">상태</th>
                    <th className="text-left py-2 px-2">사이트명</th>
                    <th className="text-left py-2 px-2">주소</th>
                    <th className="text-left py-2 px-2">아이디</th>
                    <th className="text-center py-2 px-2">1X2</th>
                    <th className="text-center py-2 px-2">핸디</th>
                    <th className="text-center py-2 px-2">O/U</th>
                    <th className="text-center py-2 px-2">승인</th>
                    <th className="text-center py-2 px-2">기능</th>
                  </tr>
                </thead>
                <tbody>
                  {sites.map((site) => {
                    const st = STATUS_MAP[site.status] || STATUS_MAP.pending;
                    return (
                      <tr
                        key={site.id}
                        className={`border-b border-gray-800 hover:bg-gray-800/50 transition-colors ${!site.is_active ? 'opacity-40' : ''}`}
                      >
                        <td className="py-2 px-2">
                          <button
                            onClick={() => handleToggleSiteActive(site)}
                            className={`w-3 h-3 rounded-full ${site.is_active ? 'bg-green-500' : 'bg-red-500'}`}
                            title={site.is_active ? '활성' : '비활성'}
                          />
                        </td>
                        <td className="py-2 px-2 text-white font-medium">{site.site_name}</td>
                        <td className="py-2 px-2 text-gray-500 max-w-[150px] truncate" title={site.site_url}>{site.site_url || '-'}</td>
                        <td className="py-2 px-2 text-gray-300">{site.login_id || '-'}</td>
                        <td className="py-2 px-2 text-center">{site.enable_cross ? <span className="text-green-400">&#x2714;</span> : <span className="text-gray-600">-</span>}</td>
                        <td className="py-2 px-2 text-center">{site.enable_handicap ? <span className="text-purple-400">&#x2714;</span> : <span className="text-gray-600">-</span>}</td>
                        <td className="py-2 px-2 text-center">{site.enable_ou ? <span className="text-orange-400">&#x2714;</span> : <span className="text-gray-600">-</span>}</td>
                        <td className="py-2 px-2 text-center">
                          <span className={`text-[10px] px-1.5 py-0.5 rounded border ${st.color}`}>{st.label}</span>
                        </td>
                        <td className="py-2 px-2 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button onClick={() => handleEditSite(site)} className="text-xs px-2 py-1 rounded bg-gray-700 text-gray-300 hover:bg-gray-600" title="수정">&#x270F;</button>
                            <button onClick={() => handleDeleteSite(site.id)} className="text-xs px-2 py-1 rounded bg-gray-700 text-red-400 hover:bg-red-900/40" title="삭제">&#x2716;</button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <p className="text-xs text-gray-500 mt-3">
                * 비밀번호는 AES-256 암호화되어 저장됩니다.
              </p>
            </div>
          )}
        </div>

        {/* ─── Section 3: 사이트 작업요청 ─── */}
        <div className="card p-5">
          <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
            <span>&#x1F4CB;</span> 사이트 작업요청
          </h2>
          <p className="text-sm text-gray-400 mb-4">
            새로운 사이트 추가를 요청합니다. 관리자 확인 후 크롤러가 세팅됩니다.
          </p>

          <div className="bg-gray-900/60 border border-gray-700 rounded-lg p-4 space-y-4">
            <div className="grid grid-cols-12 gap-3 items-end">
              <div className="col-span-6">
                <label className="block text-xs text-gray-400 mb-1">사이트 URL *</label>
                <input
                  type="text"
                  placeholder="https://example.com"
                  value={reqUrl}
                  onChange={(e) => setReqUrl(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white placeholder-gray-600"
                />
              </div>
              <div className="col-span-6">
                <label className="block text-xs text-gray-400 mb-1">사이트명 (선택)</label>
                <input
                  type="text"
                  placeholder="사이트 이름"
                  value={reqName}
                  onChange={(e) => setReqName(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white placeholder-gray-600"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">기타사항 (선택)</label>
              <textarea
                placeholder="로그인 추가 정보, 특이사항 등"
                value={reqNotes}
                onChange={(e) => setReqNotes(e.target.value)}
                rows={2}
                className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white placeholder-gray-600 resize-none"
              />
            </div>
            <div className="flex justify-end">
              <button
                onClick={handleSubmitRequest}
                disabled={reqSubmitting || !reqUrl.trim()}
                className="btn-primary px-5 py-2 text-sm disabled:opacity-40"
              >
                {reqSubmitting ? '제출 중...' : '작업요청하기'}
              </button>
            </div>
          </div>

          {reqMsg && (
            <div className={`mt-3 text-sm p-3 rounded ${reqMsg.includes('오류') ? 'bg-red-900/20 text-red-400' : 'bg-green-900/20 text-green-400'}`}>
              {reqMsg}
            </div>
          )}

          {/* 나의 요청 내역 */}
          {requests.length > 0 && (
            <div className="mt-5 overflow-auto">
              <h3 className="text-sm font-medium text-gray-300 mb-2">나의 요청 내역</h3>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-700 text-gray-400 text-xs">
                    <th className="text-left py-2 px-2">상태</th>
                    <th className="text-left py-2 px-2">사이트명</th>
                    <th className="text-left py-2 px-2">URL</th>
                    <th className="text-left py-2 px-2">기타사항</th>
                    <th className="text-left py-2 px-2">관리자 메모</th>
                    <th className="text-left py-2 px-2">요청일</th>
                  </tr>
                </thead>
                <tbody>
                  {requests.map((req) => {
                    const st = STATUS_MAP[req.status] || STATUS_MAP.pending;
                    return (
                      <tr key={req.id} className="border-b border-gray-800 hover:bg-gray-800/50">
                        <td className="py-2 px-2">
                          <span className={`text-[10px] px-1.5 py-0.5 rounded border ${st.color}`}>{st.label}</span>
                        </td>
                        <td className="py-2 px-2 text-white">{req.site_name || '-'}</td>
                        <td className="py-2 px-2 text-gray-400 max-w-[200px] truncate" title={req.site_url}>{req.site_url}</td>
                        <td className="py-2 px-2 text-gray-500 max-w-[150px] truncate" title={req.notes || ''}>{req.notes || '-'}</td>
                        <td className="py-2 px-2 text-gray-500 max-w-[150px] truncate" title={req.admin_notes || ''}>{req.admin_notes || '-'}</td>
                        <td className="py-2 px-2 text-gray-500">{formatShortTime(req.created_at)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

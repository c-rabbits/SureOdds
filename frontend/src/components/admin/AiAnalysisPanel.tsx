'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  getAiAnalysisMatches,
  generateAiAnalysis,
  generateTopAiAnalyses,
  getAiAnalysisReport,
  getAiAnalysisReports,
} from '@/lib/api';
import { getKoreanTeamName } from '@/lib/teamNames';
import { getKoreanLeagueName } from '@/lib/leagueNames';

// ─── 타입 ───

interface AnalyzableMatch {
  id: string;
  sport: string;
  league: string;
  home_team: string;
  away_team: string;
  start_time: string;
  has_prediction: boolean;
  prediction: {
    home_win_prob: number;
    draw_prob: number;
    away_win_prob: number;
    confidence: number;
    value_bets: { outcome_label: string; edge: number; odds: number; bookmaker: string }[] | null;
  } | null;
  has_analysis: boolean;
  analysis_at: string | null;
  analysis_score: number;
}

interface BettingPick {
  label: string;
  odds: number;
  confidence: string;
  reasoning: string;
}

interface MarketPick {
  pick: string;
  confidence_stars: number;
  reasoning: string;
}

interface AnalysisReport {
  match_summary: string;
  home_team_analysis: {
    form_summary: string;
    strengths: string[];
    weaknesses: string[];
    key_factors: string;
  };
  away_team_analysis: {
    form_summary: string;
    strengths: string[];
    weaknesses: string[];
    key_factors: string;
  };
  h2h_analysis: string;
  key_metrics: {
    home_form_label: string;
    away_form_label: string;
    h2h_trend: string;
    avg_goals: string;
  };
  probability_analysis: {
    model_confidence: string;
    market_vs_model: string;
    value_assessment: string;
  };
  market_analysis: {
    handicap_pick: MarketPick;
    over_under_pick: MarketPick;
    btts_pick: MarketPick;
  };
  betting_picks: {
    main_pick: BettingPick;
    secondary_pick: BettingPick;
    alternative_pick: BettingPick;
  };
  predicted_score: {
    home: number;
    away: number;
    reasoning: string;
  };
  risk_warning: string;
  overall_confidence: string;
  _raw?: {
    prediction: Record<string, unknown>;
    scoreMatrix: { home: number; away: number; prob: number }[];
    overUnder: Record<string, number>;
    btts: { yes: number; no: number };
    handicaps: Record<string, number>;
    homeStats: Record<string, unknown>;
    awayStats: Record<string, unknown>;
    h2hMatches: Record<string, unknown>[];
    odds: Record<string, unknown>[];
    match: { id: string; sport: string; league: string; home_team: string; away_team: string; start_time: string };
  };
}

// ─── 한글 매핑 ───

const SPORT_KEY_KO: Record<string, string> = {
  'soccer_epl': '프리미어리그', 'soccer_spain_la_liga': '라리가',
  'soccer_germany_bundesliga': '분데스리가', 'soccer_italy_serie_a': '세리에A',
  'soccer_france_ligue_one': '리그1', 'soccer_japan_j_league': 'J리그',
  'soccer_korea_kleague1': 'K리그1', 'soccer_uefa_champs_league': 'UCL',
  'soccer_uefa_europa_league': '유로파', 'soccer_usa_mls': 'MLS',
  'soccer_int_friendly_games': '국제친선',
};

function leagueKo(sportOrLeague: string) {
  return SPORT_KEY_KO[sportOrLeague] || getKoreanLeagueName(sportOrLeague);
}

function teamKo(name: string) {
  return getKoreanTeamName(name);
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleString('ko-KR', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    timeZone: 'Asia/Seoul',
  });
}

function Stars({ count }: { count: number }) {
  return (
    <span className="text-yellow-400">
      {'★'.repeat(Math.min(count, 5))}
      {'☆'.repeat(Math.max(0, 5 - count))}
    </span>
  );
}

// ─── 메인 컴포넌트 ───

interface HistoryItem {
  id: string;
  match_id: string;
  model_used: string;
  created_at: string;
  matches: { id: string; sport: string; league: string; home_team: string; away_team: string; start_time: string };
}

export default function AiAnalysisPanel() {
  const [subTab, setSubTab] = useState<'analyze' | 'history'>('analyze');
  const [matches, setMatches] = useState<AnalyzableMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState<string | null>(null);
  const [selectedReport, setSelectedReport] = useState<AnalysisReport | null>(null);
  const [selectedMatch, setSelectedMatch] = useState<AnalyzableMatch | null>(null);
  const [topCount, setTopCount] = useState(3);
  const [sortBy, setSortBy] = useState<'score' | 'date'>('score');
  // 이력
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const loadMatches = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getAiAnalysisMatches();
      setMatches(data || []);
    } catch (err) {
      console.error('Failed to load matches', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadMatches(); }, [loadMatches]);

  const loadHistory = useCallback(async () => {
    try {
      setHistoryLoading(true);
      const data = await getAiAnalysisReports();
      setHistory(data || []);
    } catch (err) {
      console.error('Failed to load history', err);
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    if (subTab === 'history') loadHistory();
  }, [subTab, loadHistory]);

  const handleGenerate = async (match: AnalyzableMatch, forceRefresh = false) => {
    setGenerating(match.id);
    try {
      const report = await generateAiAnalysis(match.id, forceRefresh);
      setSelectedReport(report);
      setSelectedMatch(match);
      await loadMatches();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '분석 생성 실패';
      alert(msg);
    } finally {
      setGenerating(null);
    }
  };

  const handleGenerateTop = async () => {
    setGenerating('top');
    try {
      const results = await generateTopAiAnalyses(topCount);
      const successResults = (results || []).filter((r: { success: boolean }) => r.success);
      const failResults = (results || []).filter((r: { success: boolean }) => !r.success);
      await loadMatches();
      if (successResults.length > 0) {
        const first = successResults[0];
        setSelectedReport(first.report);
        setSelectedMatch({ id: first.matchId, home_team: first.home_team, away_team: first.away_team } as AnalyzableMatch);
      }
      const msg = failResults.length > 0
        ? `${successResults.length}개 성공, ${failResults.length}개 실패`
        : `${successResults.length}개 경기 분석 완료`;
      alert(msg);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '분석 생성 실패';
      alert(msg);
    } finally {
      setGenerating(null);
    }
  };

  const handleViewHistoryReport = async (item: HistoryItem) => {
    try {
      const report = await getAiAnalysisReport(item.match_id);
      if (report) {
        setSelectedReport(report);
        setSelectedMatch({
          id: item.match_id,
          sport: item.matches.sport,
          league: item.matches.league,
          home_team: item.matches.home_team,
          away_team: item.matches.away_team,
          start_time: item.matches.start_time,
        } as AnalyzableMatch);
      }
    } catch {
      alert('보고서 조회 실패');
    }
  };

  const handleViewReport = async (match: AnalyzableMatch) => {
    try {
      const report = await getAiAnalysisReport(match.id);
      if (report) {
        setSelectedReport(report);
        setSelectedMatch(match);
      } else {
        alert('저장된 분석이 없습니다. 새로 생성하세요.');
      }
    } catch {
      alert('보고서 조회 실패');
    }
  };

  return (
    <div className="space-y-6">
      {/* ─── 서브 탭 ─── */}
      <div className="flex gap-2">
        <button
          onClick={() => setSubTab('analyze')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${subTab === 'analyze' ? 'bg-purple-600 text-white' : 'bg-gray-700 text-gray-400 hover:text-white'}`}
        >
          경기 분석
        </button>
        <button
          onClick={() => setSubTab('history')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${subTab === 'history' ? 'bg-purple-600 text-white' : 'bg-gray-700 text-gray-400 hover:text-white'}`}
        >
          분석 이력 {history.length > 0 && <span className="ml-1 text-xs opacity-70">({history.length})</span>}
        </button>
      </div>

      {/* ─── 경기 분석 탭 ─── */}
      {subTab === 'analyze' && (<>
      {/* ─── 상단: TOP N 자동 분석 ─── */}
      <div className="bg-gradient-to-r from-purple-900/40 to-blue-900/40 rounded-xl p-5 border border-purple-500/30">
        <h3 className="text-lg font-bold text-white mb-3">AI 심층 분석 (Claude API)</h3>
        <p className="text-sm text-gray-300 mb-3">
          확률 높은 픽을 자동 선별하여 Claude AI가 전문 분석 보고서를 생성합니다.
        </p>
        {/* 선별 기준 표 */}
        <div className="bg-black/20 rounded-lg p-3 mb-4 text-xs space-y-1">
          <div className="text-gray-400 font-semibold">선별 점수 = confidence × 0.4 + maxProb × 0.3 + valueBetEdge × 0.3</div>
          <div className="text-gray-300"><span className="text-purple-300 font-semibold">신뢰도</span> 40% — 모델 일치도 + 북메이커 수</div>
          <div className="text-gray-300"><span className="text-blue-300 font-semibold">편중도</span> 30% — 승/패 중 높은 확률</div>
          <div className="text-gray-300"><span className="text-yellow-300 font-semibold">밸류엣지</span> 30% — AI확률 - 시장확률 차이</div>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={topCount}
            onChange={(e) => setTopCount(Number(e.target.value))}
            className="bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm"
          >
            {[1, 2, 3, 5, 10].map(n => (
              <option key={n} value={n}>TOP {n}</option>
            ))}
          </select>
          <button
            onClick={handleGenerateTop}
            disabled={generating === 'top'}
            className="bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 text-white px-5 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap"
          >
            {generating === 'top' ? '분석 중...' : `TOP ${topCount} 자동 분석`}
          </button>
          <button
            onClick={loadMatches}
            className="bg-gray-700 hover:bg-gray-600 text-white p-2 rounded-lg transition-colors shrink-0"
            title="목록 새로고침"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>
      </div>

      {/* ─── 경기 목록 ─── */}
      <div className="bg-gray-800/50 rounded-xl border border-gray-700">
        <div className="p-4 border-b border-gray-700 flex items-center justify-between">
          <h4 className="text-white font-medium">분석 가능 경기 ({matches.length})</h4>
          <div className="flex gap-1">
            <button
              onClick={() => setSortBy('score')}
              className={`text-xs px-3 py-1 rounded-lg transition-colors ${sortBy === 'score' ? 'bg-purple-600 text-white' : 'bg-gray-700 text-gray-400 hover:text-white'}`}
            >
              점수순
            </button>
            <button
              onClick={() => setSortBy('date')}
              className={`text-xs px-3 py-1 rounded-lg transition-colors ${sortBy === 'date' ? 'bg-purple-600 text-white' : 'bg-gray-700 text-gray-400 hover:text-white'}`}
            >
              날짜순
            </button>
          </div>
        </div>
        {loading ? (
          <div className="p-8 text-center text-gray-400">로딩 중...</div>
        ) : matches.length === 0 ? (
          <div className="p-8 text-center text-gray-400">예측 가능한 경기가 없습니다</div>
        ) : (
          <div className="divide-y divide-gray-700/50">
            {[...matches].sort((a, b) =>
              sortBy === 'score' ? b.analysis_score - a.analysis_score
                : new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
            ).map(m => (
              <div key={m.id} className="p-4 hover:bg-gray-700/30 transition-colors">
                {/* 상단: 점수 + 리그 + 시간 + 분석 완료 뱃지 */}
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <span className={`text-xs px-2 py-0.5 rounded font-bold whitespace-nowrap ${
                    m.analysis_score >= 40 ? 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30' :
                    m.analysis_score >= 25 ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30' :
                    'bg-gray-700/50 text-gray-400 border border-gray-600'
                  }`}>
                    {m.analysis_score}점
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded bg-blue-900/50 text-blue-300 border border-blue-700/50 whitespace-nowrap">
                    {leagueKo(m.league || m.sport)}
                  </span>
                  <span className="text-xs text-gray-400 whitespace-nowrap">{formatTime(m.start_time)}</span>
                  {m.has_analysis && (
                    <span className="text-xs px-2 py-0.5 rounded bg-green-900/50 text-green-300 border border-green-700/50 whitespace-nowrap">
                      분석완료
                    </span>
                  )}
                </div>
                {/* 팀명 */}
                <div className="text-white font-medium mb-2">
                  {teamKo(m.home_team)} vs {teamKo(m.away_team)}
                </div>
                {/* 확률 + 버튼 한 줄 */}
                <div className="flex items-center justify-between">
                  {m.prediction ? (
                    <div className="text-xs text-gray-400 flex gap-2 flex-wrap">
                      <span>홈 {(m.prediction.home_win_prob * 100).toFixed(0)}%</span>
                      <span>무 {(m.prediction.draw_prob * 100).toFixed(0)}%</span>
                      <span>원정 {(m.prediction.away_win_prob * 100).toFixed(0)}%</span>
                      <span className="text-yellow-400">신뢰도 {(m.prediction.confidence * 100).toFixed(0)}%</span>
                    </div>
                  ) : <div />}
                  <div className="flex gap-2 shrink-0 ml-3">
                    {m.has_analysis && (
                      <button
                        onClick={() => handleViewReport(m)}
                        className="text-sm px-4 py-1.5 rounded-lg bg-blue-600/30 text-blue-300 hover:bg-blue-600/50 transition-colors whitespace-nowrap"
                      >
                        보기
                      </button>
                    )}
                    <button
                      onClick={() => handleGenerate(m, m.has_analysis)}
                      disabled={generating === m.id}
                      className="text-sm px-4 py-1.5 rounded-lg bg-purple-600/30 text-purple-300 hover:bg-purple-600/50 disabled:bg-gray-600/30 disabled:text-gray-500 transition-colors whitespace-nowrap"
                    >
                      {generating === m.id ? '분석 중...' : m.has_analysis ? '재분석' : '분석'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      </>)}

      {/* ─── 분석 이력 탭 ─── */}
      {subTab === 'history' && (
        <div className="bg-gray-800/50 rounded-xl border border-gray-700">
          <div className="p-4 border-b border-gray-700 flex items-center justify-between">
            <h4 className="text-white font-medium">분석 이력</h4>
            <button
              onClick={loadHistory}
              className="bg-gray-700 hover:bg-gray-600 text-white p-2 rounded-lg transition-colors shrink-0"
              title="새로고침"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          </div>
          {historyLoading ? (
            <div className="p-8 text-center text-gray-400">로딩 중...</div>
          ) : history.length === 0 ? (
            <div className="p-8 text-center text-gray-400">분석 이력이 없습니다</div>
          ) : (
            <div className="divide-y divide-gray-700/50">
              {history.map(item => (
                <div key={item.id} className="p-4 hover:bg-gray-700/30 transition-colors">
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <span className="text-xs px-2 py-0.5 rounded bg-blue-900/50 text-blue-300 border border-blue-700/50 whitespace-nowrap">
                      {leagueKo(item.matches?.league || item.matches?.sport || '')}
                    </span>
                    <span className="text-xs text-gray-400 whitespace-nowrap">
                      경기 {item.matches?.start_time ? formatTime(item.matches.start_time) : '-'}
                    </span>
                    <span className="text-xs text-gray-500 whitespace-nowrap">
                      분석일 {new Date(item.created_at).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="text-white font-medium">
                      {item.matches ? `${teamKo(item.matches.home_team)} vs ${teamKo(item.matches.away_team)}` : '경기 정보 없음'}
                    </div>
                    <button
                      onClick={() => handleViewHistoryReport(item)}
                      className="text-sm px-4 py-1.5 rounded-lg bg-blue-600/30 text-blue-300 hover:bg-blue-600/50 transition-colors whitespace-nowrap shrink-0 ml-3"
                    >
                      보기
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ─── 분석 보고서 팝업 (풀스크린 모달) ─── */}
      {selectedReport && selectedMatch && (
        <ReportModal
          report={selectedReport}
          match={selectedMatch}
          onClose={() => { setSelectedReport(null); setSelectedMatch(null); }}
        />
      )}
    </div>
  );
}

// ─── 풀스크린 모달 ───

function ReportModal({ report, match, onClose }: {
  report: AnalysisReport;
  match: AnalyzableMatch;
  onClose: () => void;
}) {
  const contentRef = useRef<HTMLDivElement>(null);

  // ESC로 닫기
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handler);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  // PDF 다운로드
  const handleDownloadPdf = async () => {
    if (!contentRef.current) return;
    try {
      // 동적 import html2canvas + jspdf
      const html2canvas = (await import('html2canvas')).default;
      const { jsPDF } = await import('jspdf');

      const element = contentRef.current;
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#111827',
        logging: false,
        windowWidth: 800,
      });

      const imgData = canvas.toDataURL('image/jpeg', 0.95);
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = pdfWidth - 20; // 10mm margin each side
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      let heightLeft = imgHeight;
      let position = 10;

      // 첫 페이지
      pdf.addImage(imgData, 'JPEG', 10, position, imgWidth, imgHeight);
      heightLeft -= (pdfHeight - 20);

      // 추가 페이지
      while (heightLeft > 0) {
        position = -(pdfHeight - 20) * (Math.ceil((imgHeight - heightLeft) / (pdfHeight - 20))) + 10;
        pdf.addPage();
        pdf.addImage(imgData, 'JPEG', 10, position, imgWidth, imgHeight);
        heightLeft -= (pdfHeight - 20);
      }

      const fileName = `분석_${teamKo(match.home_team)}_vs_${teamKo(match.away_team)}_${new Date().toISOString().slice(0, 10)}.pdf`;
      pdf.save(fileName);
    } catch (err) {
      console.error('PDF generation failed', err);
      alert('PDF 생성에 필요한 라이브러리를 설치해주세요: npm install html2canvas jspdf');
    }
  };

  const raw = report._raw;
  const pred = raw?.prediction as Record<string, number> | undefined;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-start justify-center overflow-y-auto">
      <div className="w-full max-w-3xl my-4 mx-4">
        {/* 헤더 (고정) */}
        <div className="bg-gradient-to-r from-purple-900 to-blue-900 rounded-t-xl p-4 flex items-center justify-between sticky top-0 z-10">
          <div className="min-w-0">
            <div className="text-xs text-gray-300 mb-1">{leagueKo(match.league || match.sport)} · {formatTime(match.start_time)}</div>
            <h2 className="text-lg font-bold text-white truncate">{teamKo(match.home_team)} vs {teamKo(match.away_team)}</h2>
          </div>
          <div className="flex items-center gap-2 shrink-0 ml-3">
            <button
              onClick={handleDownloadPdf}
              className="text-sm px-3 py-1.5 rounded-lg bg-white/10 text-white hover:bg-white/20 transition-colors whitespace-nowrap"
              title="PDF 다운로드"
            >
              PDF
            </button>
            <button onClick={onClose} className="text-gray-300 hover:text-white text-2xl leading-none px-1">×</button>
          </div>
        </div>

        {/* 본문 (PDF 캡쳐 대상) */}
        <div ref={contentRef} className="bg-gray-900 rounded-b-xl p-5 space-y-6">
          {/* 경기 요약 */}
          <section>
            <h3 className="text-sm font-semibold text-purple-400 mb-2 uppercase tracking-wider">경기 개요</h3>
            <p className="text-gray-300 leading-relaxed text-sm">{report.match_summary}</p>
          </section>

          {/* 핵심 지표 카드 */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: `${teamKo(match.home_team)} 폼`, value: report.key_metrics?.home_form_label, bg: 'bg-blue-900/20', border: 'border-blue-700/30' },
              { label: `${teamKo(match.away_team)} 폼`, value: report.key_metrics?.away_form_label, bg: 'bg-red-900/20', border: 'border-red-700/30' },
              { label: 'H2H 트렌드', value: report.key_metrics?.h2h_trend, bg: 'bg-yellow-900/20', border: 'border-yellow-700/30' },
              { label: 'H2H 평균 골', value: report.key_metrics?.avg_goals, bg: 'bg-green-900/20', border: 'border-green-700/30' },
            ].map((item, i) => (
              <div key={i} className={`${item.bg} border ${item.border} rounded-lg p-3 text-center`}>
                <div className="text-xs text-gray-400 mb-1">{item.label}</div>
                <div className="text-white font-bold text-sm">{item.value || '-'}</div>
              </div>
            ))}
          </div>

          {/* 승무패 확률 바 */}
          {pred && (
            <section>
              <h3 className="text-sm font-semibold text-purple-400 mb-3 uppercase tracking-wider">종합 승리 확률</h3>
              <div className="flex h-10 rounded-lg overflow-hidden text-sm font-bold">
                <div className="bg-blue-600 flex items-center justify-center text-white"
                  style={{ width: `${(pred.home_win_prob || 0) * 100}%` }}>
                  {((pred.home_win_prob || 0) * 100).toFixed(0)}%
                </div>
                <div className="bg-gray-500 flex items-center justify-center text-white"
                  style={{ width: `${(pred.draw_prob || 0) * 100}%` }}>
                  {((pred.draw_prob || 0) * 100).toFixed(0)}%
                </div>
                <div className="bg-red-600 flex items-center justify-center text-white"
                  style={{ width: `${(pred.away_win_prob || 0) * 100}%` }}>
                  {((pred.away_win_prob || 0) * 100).toFixed(0)}%
                </div>
              </div>
              <div className="flex justify-between text-xs text-gray-400 mt-1">
                <span>{teamKo(match.home_team)} 승</span>
                <span>무승부</span>
                <span>{teamKo(match.away_team)} 승</span>
              </div>
            </section>
          )}

          {/* 팀 분석 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <TeamAnalysisCard team={teamKo(match.home_team)} analysis={report.home_team_analysis} color="blue" side="홈" />
            <TeamAnalysisCard team={teamKo(match.away_team)} analysis={report.away_team_analysis} color="red" side="원정" />
          </div>

          {/* H2H 분석 */}
          {report.h2h_analysis && report.h2h_analysis !== '직접 대결 기록 없음' && (
            <section>
              <h3 className="text-sm font-semibold text-purple-400 mb-2 uppercase tracking-wider">H2H 직접 대결 분석</h3>
              <p className="text-gray-300 leading-relaxed bg-gray-800/50 rounded-lg p-4 text-sm">{report.h2h_analysis}</p>
            </section>
          )}

          {/* 확률 분석 */}
          <section>
            <h3 className="text-sm font-semibold text-purple-400 mb-3 uppercase tracking-wider">확률 분석</h3>
            <div className="space-y-3">
              <div className="bg-gray-800/50 rounded-lg p-4">
                <div className="text-xs text-gray-400 mb-1">모델 신뢰도</div>
                <p className="text-gray-200 text-sm">{report.probability_analysis?.model_confidence}</p>
              </div>
              <div className="bg-gray-800/50 rounded-lg p-4">
                <div className="text-xs text-gray-400 mb-1">시장 vs AI 모델</div>
                <p className="text-gray-200 text-sm">{report.probability_analysis?.market_vs_model}</p>
              </div>
              {report.probability_analysis?.value_assessment && (
                <div className="bg-yellow-900/20 border border-yellow-700/30 rounded-lg p-4">
                  <div className="text-xs text-yellow-400 mb-1">밸류 평가</div>
                  <p className="text-gray-200 text-sm">{report.probability_analysis?.value_assessment}</p>
                </div>
              )}
            </div>
          </section>

          {/* O/U, BTTS, 핸디캡 데이터 */}
          {raw && (
            <section>
              <h3 className="text-sm font-semibold text-purple-400 mb-3 uppercase tracking-wider">상세 마켓 데이터</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {raw.overUnder && (
                  <div className="bg-gray-800/50 rounded-lg p-4">
                    <div className="text-xs text-gray-400 mb-2 font-semibold">오버/언더</div>
                    {Object.entries(raw.overUnder).filter(([k]) => k.startsWith('over')).map(([k, v]) => {
                      const line = k.replace('over_', '');
                      const under = raw.overUnder![`under_${line}`];
                      return (
                        <div key={k} className="flex justify-between text-sm mb-1">
                          <span className="text-gray-300">O/U {line}</span>
                          <span className="text-green-400">{((v as number) * 100).toFixed(0)}%</span>
                          <span className="text-red-400">{((under as number) * 100).toFixed(0)}%</span>
                        </div>
                      );
                    })}
                  </div>
                )}
                {raw.btts && (
                  <div className="bg-gray-800/50 rounded-lg p-4">
                    <div className="text-xs text-gray-400 mb-2 font-semibold">양팀득점 (BTTS)</div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-300">YES</span>
                      <span className="text-green-400 font-bold">{(raw.btts.yes * 100).toFixed(0)}%</span>
                    </div>
                    <div className="flex justify-between text-sm mt-1">
                      <span className="text-gray-300">NO</span>
                      <span className="text-red-400 font-bold">{(raw.btts.no * 100).toFixed(0)}%</span>
                    </div>
                  </div>
                )}
                {raw.handicaps && (
                  <div className="bg-gray-800/50 rounded-lg p-4">
                    <div className="text-xs text-gray-400 mb-2 font-semibold">핸디캡</div>
                    {Object.entries(raw.handicaps).filter(([k]) => k.startsWith('home')).map(([k, v]) => {
                      const line = k.replace('home_', '');
                      return (
                        <div key={k} className="flex justify-between text-sm mb-1">
                          <span className="text-gray-300">홈 {line}</span>
                          <span className="text-blue-400">{((v as number) * 100).toFixed(0)}%</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </section>
          )}

          {/* 마켓 분석 추천 */}
          <section>
            <h3 className="text-sm font-semibold text-purple-400 mb-3 uppercase tracking-wider">핸디캡 & 마켓 분석</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {report.market_analysis && Object.entries(report.market_analysis).map(([key, pick]) => (
                <div key={key} className="bg-gray-800/50 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-gray-400 font-semibold">
                      {key === 'handicap_pick' ? '핸디캡' : key === 'over_under_pick' ? '오버/언더' : 'BTTS'}
                    </span>
                    <Stars count={(pick as MarketPick).confidence_stars} />
                  </div>
                  <div className="text-white font-bold mb-1">{(pick as MarketPick).pick}</div>
                  <p className="text-xs text-gray-300">{(pick as MarketPick).reasoning}</p>
                </div>
              ))}
            </div>
          </section>

          {/* 베팅 픽 요약 */}
          <section>
            <h3 className="text-sm font-semibold text-purple-400 mb-3 uppercase tracking-wider">베팅 픽 최종 요약</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {report.betting_picks && (
                <>
                  <PickCard pick={report.betting_picks.main_pick} type="main" />
                  <PickCard pick={report.betting_picks.secondary_pick} type="secondary" />
                  <PickCard pick={report.betting_picks.alternative_pick} type="alternative" />
                </>
              )}
            </div>
          </section>

          {/* 예상 스코어 */}
          <section>
            <h3 className="text-sm font-semibold text-purple-400 mb-3 uppercase tracking-wider">예상 스코어</h3>
            <div className="bg-gray-800/50 rounded-lg p-5 text-center">
              <div className="flex items-center justify-center gap-6 mb-3">
                <div>
                  <div className="text-sm text-gray-400 mb-1">{teamKo(match.home_team)}</div>
                  <div className="text-4xl font-bold text-white">{report.predicted_score?.home ?? '-'}</div>
                </div>
                <div className="text-2xl text-gray-500">-</div>
                <div>
                  <div className="text-sm text-gray-400 mb-1">{teamKo(match.away_team)}</div>
                  <div className="text-4xl font-bold text-white">{report.predicted_score?.away ?? '-'}</div>
                </div>
              </div>
              <p className="text-xs text-gray-400">{report.predicted_score?.reasoning}</p>
            </div>
          </section>

          {/* 스코어 확률 TOP 5 */}
          {raw?.scoreMatrix && raw.scoreMatrix.length > 0 && (
            <section>
              <h3 className="text-sm font-semibold text-purple-400 mb-3 uppercase tracking-wider">스코어 확률 TOP 5</h3>
              <div className="flex gap-2 flex-wrap">
                {raw.scoreMatrix.slice(0, 5).map((s, i) => (
                  <div key={i} className={`px-4 py-2 rounded-lg text-center ${i === 0 ? 'bg-purple-600/30 border border-purple-500/50' : 'bg-gray-800/50 border border-gray-700'}`}>
                    <div className="text-white font-bold">{s.home}-{s.away}</div>
                    <div className="text-xs text-gray-400">{(s.prob * 100).toFixed(1)}%</div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* 주의사항 */}
          {report.risk_warning && (
            <div className="bg-red-900/20 border border-red-700/30 rounded-lg p-4">
              <div className="text-xs text-red-400 font-semibold mb-1">주의사항 & 변수</div>
              <p className="text-sm text-gray-300">{report.risk_warning}</p>
            </div>
          )}

          {/* 전체 신뢰도 */}
          <div className="bg-gray-800/50 rounded-lg p-4 text-center">
            <div className="text-xs text-gray-400 mb-1">전체 분석 신뢰도</div>
            <p className="text-white font-medium">{report.overall_confidence}</p>
          </div>

          {/* 면책 */}
          <p className="text-xs text-gray-500 text-center">
            AI 분석은 통계 기반 참고 서비스이며, 결과를 보장하지 않습니다.
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── 서브 컴포넌트 ───

function TeamAnalysisCard({ team, analysis, color, side }: {
  team: string;
  analysis: { form_summary: string; strengths: string[]; weaknesses: string[]; key_factors: string } | undefined;
  color: string;
  side: string;
}) {
  if (!analysis) return null;
  return (
    <div className={`bg-${color}-900/10 border border-${color}-700/30 rounded-lg p-4`}>
      <h4 className={`text-sm font-bold text-${color}-400 mb-2`}>{side} · {team}</h4>
      <p className="text-sm text-gray-300 mb-3">{analysis.form_summary}</p>
      <div className="space-y-2">
        <div>
          <span className="text-xs text-green-400 font-semibold">강점</span>
          <ul className="text-xs text-gray-300 mt-1 space-y-0.5">
            {analysis.strengths?.map((s, i) => <li key={i}>+ {s}</li>)}
          </ul>
        </div>
        <div>
          <span className="text-xs text-red-400 font-semibold">약점</span>
          <ul className="text-xs text-gray-300 mt-1 space-y-0.5">
            {analysis.weaknesses?.map((w, i) => <li key={i}>- {w}</li>)}
          </ul>
        </div>
        <div className="mt-2 pt-2 border-t border-gray-700/50">
          <span className="text-xs text-yellow-400 font-semibold">핵심 포인트</span>
          <p className="text-xs text-gray-300 mt-1">{analysis.key_factors}</p>
        </div>
      </div>
    </div>
  );
}

function PickCard({ pick, type }: { pick: BettingPick | undefined; type: string }) {
  if (!pick) return null;
  const colors: Record<string, { border: string; bg: string; badge: string; badgeText: string }> = {
    main: { border: 'border-purple-500/50', bg: 'bg-purple-900/20', badge: 'bg-purple-600', badgeText: '메인 픽' },
    secondary: { border: 'border-orange-500/50', bg: 'bg-orange-900/20', badge: 'bg-orange-600', badgeText: '보조 픽' },
    alternative: { border: 'border-cyan-500/50', bg: 'bg-cyan-900/20', badge: 'bg-cyan-600', badgeText: '대안 픽' },
  };
  const c = colors[type] || colors.main;

  return (
    <div className={`${c.bg} border ${c.border} rounded-lg p-4`}>
      <div className={`text-xs ${c.badge} text-white px-2 py-0.5 rounded inline-block mb-2`}>
        {c.badgeText}
      </div>
      <div className="text-white font-bold text-sm mb-1">{pick.label}</div>
      <div className="flex items-center gap-3 text-xs text-gray-400 mb-2">
        <span>배당 {pick.odds}</span>
        <span className="text-yellow-400">신뢰도 {pick.confidence}</span>
      </div>
      <p className="text-xs text-gray-300">{pick.reasoning}</p>
    </div>
  );
}

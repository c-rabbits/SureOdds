'use client';

import { useState, useEffect, useCallback } from 'react';
import { getUnmatchedTeams, updateUnmatchedTeam, deleteUnmatchedTeam } from '@/lib/api';

interface UnmatchedTeam {
  id: string;
  korean_name: string;
  english_name: string | null;
  resolved: boolean;
  last_seen_at: string;
  created_at: string;
}

export default function UnmatchedTeamsPanel() {
  const [teams, setTeams] = useState<UnmatchedTeam[]>([]);
  const [loading, setLoading] = useState(true);
  const [showResolved, setShowResolved] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  const loadTeams = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getUnmatchedTeams(showResolved);
      setTeams(data || []);
    } catch { /* ignore */ }
    setLoading(false);
  }, [showResolved]);

  useEffect(() => { loadTeams(); }, [loadTeams]);

  async function handleResolve(team: UnmatchedTeam) {
    if (!editValue.trim()) return;
    try {
      await updateUnmatchedTeam(team.id, { english_name: editValue.trim(), resolved: true });
      setEditingId(null);
      setEditValue('');
      loadTeams();
    } catch { /* ignore */ }
  }

  async function handleDelete(id: string) {
    if (!confirm('삭제하시겠습니까?')) return;
    try {
      await deleteUnmatchedTeam(id);
      setTeams((prev) => prev.filter((t) => t.id !== id));
    } catch { /* ignore */ }
  }

  async function handleUnresolve(id: string) {
    try {
      await updateUnmatchedTeam(id, { resolved: false, english_name: null });
      loadTeams();
    } catch { /* ignore */ }
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  return (
    <div className="space-y-4">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-bold text-white">미매칭 팀명</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            베트맨 한글 팀명 중 영어 매핑이 없는 항목. 영어명을 입력하면 자동 매핑됩니다.
          </p>
        </div>
        <button
          onClick={() => setShowResolved(!showResolved)}
          className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
            showResolved
              ? 'border-green-500/30 text-green-400 bg-green-500/10'
              : 'border-gray-700 text-gray-400 hover:text-white'
          }`}
        >
          {showResolved ? '해결 포함' : '미해결만'}
        </button>
      </div>

      {/* 목록 */}
      <div className="card p-0 overflow-hidden">
        {loading ? (
          <div className="text-center py-8 text-gray-500 text-sm">로딩 중...</div>
        ) : teams.length === 0 ? (
          <div className="text-center py-8 text-gray-500 text-sm">
            {showResolved ? '기록이 없습니다.' : '미매칭 팀이 없습니다.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th className="pl-4">한글명</th>
                  <th>영어명</th>
                  <th>상태</th>
                  <th>마지막 감지</th>
                  <th className="text-center pr-4">작업</th>
                </tr>
              </thead>
              <tbody>
                {teams.map((t) => (
                  <tr key={t.id} className={t.resolved ? 'opacity-50' : ''}>
                    <td className="pl-4">
                      <span className="text-white font-medium">{t.korean_name}</span>
                    </td>
                    <td>
                      {editingId === t.id ? (
                        <div className="flex items-center gap-1">
                          <input
                            type="text"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleResolve(t)}
                            placeholder="English team name"
                            className="bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs text-white w-48 focus:outline-none focus:border-green-500"
                            autoFocus
                          />
                          <button
                            onClick={() => handleResolve(t)}
                            className="text-green-400 hover:text-green-300 text-xs px-2 py-1"
                          >
                            저장
                          </button>
                          <button
                            onClick={() => { setEditingId(null); setEditValue(''); }}
                            className="text-gray-500 hover:text-gray-300 text-xs px-1 py-1"
                          >
                            취소
                          </button>
                        </div>
                      ) : (
                        <span className={t.english_name ? 'text-green-400' : 'text-gray-600'}>
                          {t.english_name || '-'}
                        </span>
                      )}
                    </td>
                    <td>
                      <span className={`inline-flex items-center gap-1 text-[10px] font-medium ${
                        t.resolved ? 'text-green-400' : 'text-yellow-400'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${
                          t.resolved ? 'bg-green-400' : 'bg-yellow-400'
                        }`} />
                        {t.resolved ? '해결' : '미해결'}
                      </span>
                    </td>
                    <td className="text-gray-500">{formatDate(t.last_seen_at)}</td>
                    <td className="pr-4">
                      <div className="flex items-center justify-center gap-1">
                        {!t.resolved ? (
                          <button
                            onClick={() => { setEditingId(t.id); setEditValue(t.english_name || ''); }}
                            className="btn-sm text-blue-400 hover:bg-blue-500/10"
                          >
                            매핑
                          </button>
                        ) : (
                          <button
                            onClick={() => handleUnresolve(t.id)}
                            className="btn-sm text-yellow-400 hover:bg-yellow-500/10"
                          >
                            해제
                          </button>
                        )}
                        <button
                          onClick={() => handleDelete(t.id)}
                          className="btn-sm text-red-400 hover:bg-red-500/10"
                        >
                          삭제
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

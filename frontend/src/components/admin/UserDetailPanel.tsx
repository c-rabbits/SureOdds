'use client';

import { useState, useEffect, useCallback } from 'react';
import { getUserActivity, getUserStats, updateUser } from '@/lib/api';
import type { UserProfile, UserActivityLog, UserStats } from '@/types';

const ACTION_LABELS: Record<string, { label: string; icon: string }> = {
  login: { label: '로그인', icon: '🔑' },
  logout: { label: '로그아웃', icon: '🚪' },
  page_view: { label: '페이지', icon: '📄' },
  match_click: { label: '경기 조회', icon: '⚽' },
  setting_change: { label: '설정 변경', icon: '⚙️' },
  telegram_link: { label: 'TG 연동', icon: '📱' },
  telegram_unlink: { label: 'TG 해제', icon: '📵' },
};

function parseDevice(ua: string | null): string {
  if (!ua) return '-';
  if (/mobile|android|iphone|ipad/i.test(ua)) return '모바일';
  return 'PC';
}

function parseBrowser(ua: string | null): string {
  if (!ua) return '-';
  if (/chrome/i.test(ua) && !/edg/i.test(ua)) return 'Chrome';
  if (/safari/i.test(ua) && !/chrome/i.test(ua)) return 'Safari';
  if (/firefox/i.test(ua)) return 'Firefox';
  if (/edg/i.test(ua)) return 'Edge';
  return 'Other';
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleString('ko-KR', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

interface Props {
  targetUser: UserProfile;
  onClose: () => void;
  onUserUpdated: (updated: UserProfile) => void;
}

export default function UserDetailPanel({ targetUser, onClose, onUserUpdated }: Props) {
  const [activities, setActivities] = useState<UserActivityLog[]>([]);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(true);

  // Editable fields
  const [memo, setMemo] = useState(targetUser.admin_memo || '');
  const [vipExpiry, setVipExpiry] = useState(targetUser.vip_expires_at?.split('T')[0] || '');
  const [suspendedUntil, setSuspendedUntil] = useState(targetUser.suspended_until?.split('T')[0] || '');
  const [suspendedReason, setSuspendedReason] = useState(targetUser.suspended_reason || '');
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [activityData, statsData] = await Promise.all([
        getUserActivity(targetUser.id, { limit: 20 }),
        getUserStats(targetUser.id),
      ]);
      setActivities(activityData || []);
      setStats(statsData || null);
    } catch { /* ignore */ }
    setLoading(false);
  }, [targetUser.id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function handleSave() {
    setSaving(true);
    try {
      const updated = await updateUser(targetUser.id, {
        admin_memo: memo || null,
        vip_expires_at: vipExpiry ? new Date(vipExpiry).toISOString() : null,
        suspended_until: suspendedUntil ? new Date(suspendedUntil).toISOString() : null,
        suspended_reason: suspendedReason || null,
      });
      onUserUpdated(updated);
    } catch { /* ignore */ }
    setSaving(false);
  }

  // 일별 로그인 차트 (최근 7일)
  const maxLogin = stats ? Math.max(...Object.values(stats.dailyLogins7d), 1) : 1;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-lg max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="sticky top-0 bg-gray-900 border-b border-gray-800 px-4 py-3 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-white">
              {targetUser.display_name || targetUser.username || targetUser.email}
            </h2>
            <span className="text-xs text-gray-500">{targetUser.username || targetUser.email}</span>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white p-1">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
          </button>
        </div>

        <div className="p-4 space-y-4">
          {loading ? (
            <div className="text-center py-8 text-gray-500 text-sm">로딩 중...</div>
          ) : (
            <>
              {/* 접속 통계 */}
              {stats && (
                <section>
                  <h3 className="text-xs font-semibold text-gray-400 mb-2">접속 통계 (최근 7일)</h3>
                  <div className="bg-gray-800/50 rounded-lg p-3">
                    <div className="flex items-end gap-1 h-16 mb-1">
                      {Object.entries(stats.dailyLogins7d)
                        .sort(([a], [b]) => a.localeCompare(b))
                        .map(([date, count]) => (
                          <div key={date} className="flex-1 flex flex-col items-center gap-0.5">
                            <div
                              className="w-full bg-green-500/60 rounded-t min-h-[2px]"
                              style={{ height: `${(count / maxLogin) * 100}%` }}
                              title={`${date}: ${count}회`}
                            />
                          </div>
                        ))}
                    </div>
                    <div className="flex gap-1">
                      {Object.keys(stats.dailyLogins7d)
                        .sort()
                        .map((date) => (
                          <div key={date} className="flex-1 text-center text-[9px] text-gray-600">
                            {date.slice(5)}
                          </div>
                        ))}
                    </div>
                    <div className="flex items-center justify-between mt-2 text-xs">
                      <span className="text-gray-500">30일 로그인: <span className="text-white font-medium">{stats.totalLogins30d}회</span></span>
                      {stats.lastActivity && (
                        <span className="text-gray-500">최근: <span className="text-gray-300">{formatTime(stats.lastActivity.created_at)}</span></span>
                      )}
                    </div>
                  </div>
                </section>
              )}

              {/* 디바이스 정보 */}
              {activities.length > 0 && (
                <section>
                  <h3 className="text-xs font-semibold text-gray-400 mb-2">디바이스 정보</h3>
                  <div className="bg-gray-800/50 rounded-lg p-3">
                    {(() => {
                      const lastLogin = activities.find(a => a.action === 'login');
                      if (!lastLogin) return <span className="text-xs text-gray-500">로그인 기록 없음</span>;
                      return (
                        <div className="flex items-center gap-4 text-xs">
                          <span className="text-gray-400">기기: <span className="text-white">{parseDevice(lastLogin.user_agent)}</span></span>
                          <span className="text-gray-400">브라우저: <span className="text-white">{parseBrowser(lastLogin.user_agent)}</span></span>
                          <span className="text-gray-400">IP: <span className="text-white font-mono">{lastLogin.ip_address || '-'}</span></span>
                        </div>
                      );
                    })()}
                  </div>
                </section>
              )}

              {/* 활동 타임라인 */}
              <section>
                <h3 className="text-xs font-semibold text-gray-400 mb-2">최근 활동</h3>
                <div className="bg-gray-800/50 rounded-lg p-3 max-h-48 overflow-y-auto space-y-1.5">
                  {activities.length === 0 ? (
                    <span className="text-xs text-gray-500">활동 기록 없음</span>
                  ) : (
                    activities.map((a) => {
                      const info = ACTION_LABELS[a.action] || { label: a.action, icon: '📌' };
                      const detail = a.detail as Record<string, string>;
                      return (
                        <div key={a.id} className="flex items-center gap-2 text-xs">
                          <span>{info.icon}</span>
                          <span className="text-gray-300 font-medium w-16 shrink-0">{info.label}</span>
                          <span className="text-gray-500 truncate flex-1">
                            {detail?.path || detail?.setting || detail?.via || ''}
                          </span>
                          <span className="text-gray-600 shrink-0">{formatTime(a.created_at)}</span>
                        </div>
                      );
                    })
                  )}
                </div>
              </section>

              {/* 관리자 설정 */}
              <section>
                <h3 className="text-xs font-semibold text-gray-400 mb-2">관리자 설정</h3>
                <div className="bg-gray-800/50 rounded-lg p-3 space-y-3">
                  {/* VIP 만료일 */}
                  <div className="flex items-center justify-between">
                    <label className="text-xs text-gray-400">VIP 만료일</label>
                    <input
                      type="date"
                      value={vipExpiry}
                      onChange={(e) => setVipExpiry(e.target.value)}
                      className="bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-green-500"
                    />
                  </div>

                  {/* 차단 설정 */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs text-gray-400">차단 기한</label>
                      <input
                        type="date"
                        value={suspendedUntil}
                        onChange={(e) => setSuspendedUntil(e.target.value)}
                        className="bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-green-500"
                      />
                    </div>
                    {suspendedUntil && (
                      <input
                        type="text"
                        value={suspendedReason}
                        onChange={(e) => setSuspendedReason(e.target.value)}
                        placeholder="차단 사유"
                        className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-green-500"
                      />
                    )}
                  </div>

                  {/* 관리자 메모 */}
                  <div>
                    <label className="text-xs text-gray-400 block mb-1">관리자 메모</label>
                    <textarea
                      value={memo}
                      onChange={(e) => setMemo(e.target.value)}
                      rows={2}
                      placeholder="이 회원에 대한 메모..."
                      className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-xs text-white resize-none focus:outline-none focus:border-green-500"
                    />
                  </div>

                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="w-full py-2 rounded-lg bg-green-600 hover:bg-green-500 text-white text-xs font-medium transition-colors disabled:opacity-50"
                  >
                    {saving ? '저장 중...' : '저장'}
                  </button>
                </div>
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

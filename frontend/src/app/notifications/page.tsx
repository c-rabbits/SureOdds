'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { AppNotification, NotificationType } from '@/types/notification';
import { getNotifications, markAsRead, markAllAsRead, deleteNotification, deleteAllNotifications } from '@/lib/notificationApi';
import { getKoreanTeamName } from '@/lib/teamNames';

/** 알림 body의 영어 팀명을 한글로 변환 */
function localizeBody(body: string): string {
  // "TeamA vs TeamB" 패턴 매칭
  return body.replace(/^(.+?)\s+vs\s+(.+)$/i, (_m, a, b) => {
    return `${getKoreanTeamName(a.trim())} vs ${getKoreanTeamName(b.trim())}`;
  });
}

const TYPE_FILTERS: { label: string; value: NotificationType | 'all' }[] = [
  { label: '전체', value: 'all' },
  { label: '⚡ 양방', value: 'arbitrage' },
  { label: '🎯 밸류', value: 'value_bet' },
  { label: '📋 요약', value: 'daily_digest' },
  { label: '⚠️ 시스템', value: 'session_expiry' },
];

export default function NotificationsPage() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<NotificationType | 'all'>('all');

  useEffect(() => {
    loadNotifications();
  }, [filter]);

  async function loadNotifications() {
    setLoading(true);
    try {
      const data = await getNotifications({
        limit: 100,
        type: filter === 'all' ? undefined : filter,
      });
      setNotifications(data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  async function handleClick(notif: AppNotification) {
    if (!notif.read) {
      await markAsRead(notif.id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === notif.id ? { ...n, read: true } : n))
      );
    }
    if (notif.data?.url) {
      router.push(notif.data.url as string);
    }
  }

  async function handleMarkAllRead() {
    await markAllAsRead();
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }

  async function handleDeleteOne(id: string) {
    await deleteNotification(id);
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }

  async function handleDeleteAll() {
    if (!confirm('모든 알림을 삭제하시겠습니까?')) return;
    await deleteAllNotifications();
    setNotifications([]);
  }

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div className="p-4 pb-8 max-w-2xl mx-auto">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-lg font-bold text-white">🔔 알림</h1>
          <p className="text-xs text-gray-500 mt-0.5">
            {unreadCount > 0 ? `${unreadCount}개 미읽음` : '모든 알림을 확인했습니다'}
          </p>
        </div>
        <div className="flex items-center gap-1">
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllRead}
              className="text-xs text-blue-400 hover:text-blue-300 px-2 py-1"
            >
              모두 읽음
            </button>
          )}
          {notifications.length > 0 && (
            <button
              onClick={handleDeleteAll}
              className="text-xs text-red-400 hover:text-red-300 px-2 py-1"
            >
              전체 삭제
            </button>
          )}
        </div>
      </div>

      {/* 필터 탭 */}
      <div className="flex gap-1 mb-4 overflow-x-auto pb-1">
        {TYPE_FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={`text-xs px-3 py-1.5 rounded-full whitespace-nowrap transition-colors ${
              filter === f.value
                ? 'bg-blue-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:text-white'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* 알림 목록 */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-gray-800/50 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : notifications.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-3xl mb-3">📭</p>
          <p className="text-gray-400">알림이 없습니다</p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {notifications.map((notif) => (
            <button
              key={notif.id}
              onClick={() => handleClick(notif)}
              className={`w-full text-left rounded-lg border p-3 transition-colors ${
                notif.read
                  ? 'bg-gray-900/30 border-gray-800/50 hover:bg-gray-800/50'
                  : 'bg-gray-900 border-gray-700 hover:border-gray-600'
              }`}
            >
              <div className="flex items-start gap-2.5">
                {/* 미읽음 표시 */}
                <div className="mt-1.5 shrink-0">
                  {!notif.read && (
                    <div className="w-2 h-2 rounded-full bg-blue-500" />
                  )}
                  {notif.read && <div className="w-2 h-2" />}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className={`text-sm font-medium truncate ${notif.read ? 'text-gray-400' : 'text-white'}`}>
                      {notif.title}
                    </span>
                    <span className="text-[10px] text-gray-600 shrink-0">
                      {timeAgo(notif.created_at)}
                    </span>
                  </div>
                  <p className={`text-xs mt-0.5 truncate ${notif.read ? 'text-gray-600' : 'text-gray-400'}`}>
                    {localizeBody(notif.body)}
                  </p>
                </div>

                {/* 개별 삭제 */}
                <button
                  onClick={(e) => { e.stopPropagation(); handleDeleteOne(notif.id); }}
                  className="shrink-0 p-1 text-gray-600 hover:text-red-400 transition-colors"
                  title="삭제"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                </button>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return '방금';
  if (mins < 60) return `${mins}분 전`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}시간 전`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}일 전`;
  return new Date(dateStr).toLocaleDateString('ko-KR');
}

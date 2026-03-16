'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getUnreadCount } from '@/lib/notificationApi';

export default function NotificationBadge() {
  const router = useRouter();
  const [count, setCount] = useState(0);

  useEffect(() => {
    // 초기 로드
    fetchCount();

    // 60초마다 폴링
    const interval = setInterval(fetchCount, 60_000);
    return () => clearInterval(interval);
  }, []);

  async function fetchCount() {
    try {
      const n = await getUnreadCount();
      setCount(n);
    } catch {
      // ignore
    }
  }

  return (
    <button
      onClick={() => router.push('/notifications')}
      className="relative p-1.5 rounded-md text-gray-400 hover:text-white hover:bg-gray-800/60 transition-colors"
      aria-label="알림"
    >
      <svg className="w-4.5 h-4.5" width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
        />
      </svg>

      {count > 0 && (
        <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold px-1 leading-none">
          {count > 99 ? '99+' : count}
        </span>
      )}
    </button>
  );
}

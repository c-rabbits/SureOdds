'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import NotificationBadge from './NotificationBadge';

const baseLinks = [
  { href: '/', label: '대시보드' },
  { href: '/domestic', label: '사이트' },
];

const adminLinks = [
  { href: '/admin', label: '관리자' },
];

const aiLink = { href: '/ai', label: 'AI 예측' };

// VIP2 이상 또는 admin만 AI 예측 접근 가능 (test_vip도 동일 권한)
const AI_ROLES = ['admin', 'vip2', 'vip3', 'vip4', 'vip5', 'test_vip2', 'test_vip3', 'test_vip4', 'test_vip5'];

export default function Navbar() {
  const pathname = usePathname();
  const { user, isAdmin } = useAuth();

  const canAccessAI = user && AI_ROLES.includes(user.role);

  const navLinks = [
    ...baseLinks,
    ...(canAccessAI ? [aiLink] : []),
    ...(isAdmin ? adminLinks : []),
  ];

  return (
    <nav className="border-b border-gray-800 bg-gray-950 shrink-0 sticky top-0 z-50">
      <div className="px-2 sm:px-4 flex items-center justify-between h-10">
        {/* 좌측: 로고 + 네비게이션 */}
        <div className="flex items-center gap-2 sm:gap-4">
          <Link href="/" className="flex items-center gap-1.5 shrink-0">
            <span className="text-lg">⚡</span>
            <span className="text-sm font-bold text-white hidden sm:inline">
              Sure<span className="text-green-400">Odds</span>
            </span>
          </Link>

          <div className="flex items-center gap-0.5">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`px-2 sm:px-3 py-1.5 rounded-md text-xs sm:text-xs font-semibold transition-colors whitespace-nowrap ${
                  (link.href === '/' ? pathname === '/' : pathname.startsWith(link.href))
                    ? 'bg-gray-700 text-white'
                    : 'text-gray-300 hover:text-white hover:bg-gray-800/60'
                }`}
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>

        {/* 우측: 사용자 정보 + 로그아웃 */}
        <div className="flex items-center gap-1.5 sm:gap-3">

          {user && (
            <>
              <Link
                href="/calculator"
                className={`p-1.5 rounded-md transition-colors ${
                  pathname === '/calculator'
                    ? 'text-white bg-gray-700'
                    : 'text-gray-500 hover:text-white hover:bg-gray-800'
                }`}
                title="양방 계산기"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="4" y="2" width="16" height="20" rx="2" />
                  <line x1="8" y1="6" x2="16" y2="6" />
                  <line x1="8" y1="10" x2="10" y2="10" />
                  <line x1="14" y1="10" x2="16" y2="10" />
                  <line x1="8" y1="14" x2="10" y2="14" />
                  <line x1="14" y1="14" x2="16" y2="14" />
                  <line x1="8" y1="18" x2="10" y2="18" />
                  <line x1="14" y1="18" x2="16" y2="18" />
                </svg>
              </Link>
              <NotificationBadge />
              <Link
                href="/profile"
                className={`p-1.5 rounded-md transition-colors ${
                  pathname === '/profile'
                    ? 'text-white bg-gray-700'
                    : 'text-gray-500 hover:text-white hover:bg-gray-800'
                }`}
                title="프로필"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}

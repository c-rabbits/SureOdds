'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import NotificationBadge from './NotificationBadge';

const baseLinks = [
  { href: '/', label: '대시보드' },
  { href: '/domestic', label: '국내 사이트' },
  { href: '/calculator', label: '계산기' },
];

const adminLinks = [
  { href: '/admin', label: '관리자' },
];

const AI_ALLOWED_EMAIL = 'qmirrorp@gmail.com';
const aiLink = { href: '/ai', label: 'AI 예측' };

export default function Navbar() {
  const pathname = usePathname();
  const { user, isAdmin, signOut } = useAuth();

  const navLinks = [
    ...baseLinks,
    ...(user?.email === AI_ALLOWED_EMAIL ? [aiLink] : []),
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
                className={`px-2 sm:px-3 py-1.5 rounded-md text-sm sm:text-sm font-semibold transition-colors whitespace-nowrap ${
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
          <span className="text-[10px] text-gray-600 hidden md:inline">
            v2.0 &bull; 멀티마켓 양방탐지
          </span>

          {user && (
            <>
              <NotificationBadge />
              <span className="text-[11px] text-gray-400 hidden sm:inline">
                {user.display_name || user.email}
              </span>
              <button
                onClick={() => signOut()}
                className="p-1.5 rounded-md text-gray-500 hover:text-white hover:bg-gray-800 transition-colors"
                title="로그아웃"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
              </button>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

const baseLinks = [
  { href: '/', label: '대시보드', icon: '📊', short: '대시' },
  { href: '/domestic', label: '🇰🇷 국내 사이트 관리', icon: '🇰🇷', short: '국내' },
  { href: '/calculator', label: '계산기', icon: '🧮', short: '계산' },
];

const adminLinks = [
  { href: '/ai', label: 'AI 예측', icon: '🤖', short: 'AI' },
  { href: '/admin', label: '관리자', icon: '⚙️', short: '관리' },
];

export default function Navbar() {
  const pathname = usePathname();
  const { user, isAdmin, signOut } = useAuth();

  const navLinks = isAdmin ? [...baseLinks, ...adminLinks] : baseLinks;

  return (
    <nav className="border-b border-gray-800 bg-gray-950 shrink-0 sticky top-0 z-50">
      <div className="px-4 flex items-center justify-between h-10">
        {/* 좌측: 로고 + 네비게이션 */}
        <div className="flex items-center gap-4">
          <Link href="/" className="flex items-center gap-1.5">
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
                className={`px-2.5 sm:px-3 py-1.5 rounded-md text-[13px] sm:text-xs font-semibold transition-colors ${
                  (link.href === '/' ? pathname === '/' : pathname.startsWith(link.href))
                    ? 'bg-gray-700 text-white'
                    : 'text-gray-300 hover:text-white hover:bg-gray-800/60'
                }`}
              >
                {/* 모바일: 아이콘 + 축약, PC: 풀 라벨 */}
                <span className="sm:hidden">{link.icon} {link.short}</span>
                <span className="hidden sm:inline">{link.label}</span>
              </Link>
            ))}
          </div>
        </div>

        {/* 우측: 사용자 정보 + 로그아웃 */}
        <div className="flex items-center gap-2 sm:gap-3">
          <span className="text-[10px] text-gray-600 hidden md:inline">
            v2.0 &bull; 멀티마켓 양방탐지
          </span>

          {user && (
            <>
              <span className="text-[11px] text-gray-400 hidden sm:inline">
                {user.display_name || user.email}
              </span>
              <button
                onClick={() => signOut()}
                className="btn-sm text-gray-500 hover:text-white hover:bg-gray-800 text-[10px] sm:text-xs"
              >
                로그아웃
              </button>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}

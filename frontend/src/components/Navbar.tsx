'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

const baseLinks = [
  { href: '/', label: '대시보드' },
  { href: '/domestic', label: '🇰🇷 국내 배당' },
  { href: '/calculator', label: '계산기' },
];

export default function Navbar() {
  const pathname = usePathname();
  const { user, isAdmin, signOut } = useAuth();

  // 관리자일 경우 관리자 링크 추가
  const navLinks = isAdmin
    ? [...baseLinks, { href: '/admin', label: '관리자' }]
    : baseLinks;

  return (
    <nav className="border-b border-gray-800 bg-gray-950 shrink-0">
      <div className="px-4 flex items-center justify-between h-10">
        {/* 좌측: 로고 + 네비게이션 */}
        <div className="flex items-center gap-4">
          <Link href="/" className="flex items-center gap-1.5">
            <span className="text-lg">⚡</span>
            <span className="text-sm font-bold text-white">
              Sure<span className="text-green-400">Odds</span>
            </span>
          </Link>

          <div className="flex items-center gap-0.5">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                  pathname === link.href
                    ? 'bg-gray-800 text-white'
                    : 'text-gray-400 hover:text-white hover:bg-gray-800/60'
                }`}
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>

        {/* 우측: 사용자 정보 + 로그아웃 */}
        <div className="flex items-center gap-3">
          <span className="text-[10px] text-gray-600">
            v2.0 &bull; 멀티마켓 양방탐지
          </span>

          {user && (
            <>
              <span className="text-[11px] text-gray-400">
                {user.display_name || user.email}
              </span>
              <button
                onClick={() => signOut()}
                className="btn-sm text-gray-500 hover:text-white hover:bg-gray-800"
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

'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import Navbar from '@/components/Navbar';
import { useAuth } from '@/contexts/AuthContext';

// 인증 불필요 경로
const publicPaths = ['/login'];

export default function LayoutContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading, maintenance, signOut } = useAuth();
  const isPublicPage = publicPaths.some((path) => pathname.startsWith(path));

  // 비공개 페이지에서 미인증 시 로그인 리다이렉트
  useEffect(() => {
    if (!loading && !user && !isPublicPage && !maintenance) {
      const redirectTo = pathname !== '/' ? `?redirectTo=${pathname}` : '';
      router.replace(`/login${redirectTo}`);
    }
  }, [user, loading, isPublicPage, pathname, router, maintenance]);

  // 로딩 중
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="flex items-center gap-2 text-gray-500 text-sm">
          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          로딩 중...
        </div>
      </div>
    );
  }

  // 유지보수 모드 차단 화면
  if (maintenance) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center px-6">
        <div className="text-center max-w-sm">
          <div className="text-4xl mb-4">
            <svg className="w-16 h-16 mx-auto text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M11.42 15.17l-1.42-.77a1 1 0 00-.26-.09 1 1 0 00-.95.42l-.03.04a1 1 0 01-.86.49H6a1 1 0 01-1-1v-1.9a1 1 0 00-.11-.45L3.38 8.57a1 1 0 01.09-1.02l1.1-1.47a1 1 0 011.23-.35l.12.06a1 1 0 001.07-.1l.94-.76a1 1 0 00.36-.83V3a1 1 0 011-1h1.42a1 1 0 01.98.8l.12.62a1 1 0 00.68.71l.22.07a1 1 0 001-.22l.44-.44a1 1 0 011.41 0l1.01 1.01a1 1 0 010 1.41l-.44.44a1 1 0 00-.22 1l.07.22a1 1 0 00.71.68l.62.12a1 1 0 01.8.98V9a1 1 0 01-1 1h-1.1a1 1 0 00-.83.36l-.76.94a1 1 0 00-.1 1.07l.06.12a1 1 0 01-.35 1.23l-1.47 1.1a1 1 0 01-1.02.09z" />
              <circle cx="12" cy="12" r="3" strokeWidth={1.5} />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-white mb-2">유지보수 중</h1>
          <p className="text-sm text-gray-400 mb-6">
            현재 시스템 점검 중입니다.<br />
            잠시 후 다시 접속해 주세요.
          </p>
          <button
            onClick={signOut}
            className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
          >
            로그아웃
          </button>
        </div>
      </div>
    );
  }

  // 미인증 + 비공개 페이지 → 리다이렉트 대기
  if (!user && !isPublicPage) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-gray-500 text-sm">로그인 페이지로 이동 중...</div>
      </div>
    );
  }

  // 공개 페이지: Navbar 없이
  if (isPublicPage) {
    return <>{children}</>;
  }

  // 인증된 비공개 페이지: Navbar + 콘텐츠
  return (
    <>
      <Navbar />
      <main className="flex-1 overflow-auto pb-14 md:pb-0">{children}</main>
    </>
  );
}

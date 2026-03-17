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
          <div className="mb-6">
            <svg className="w-14 h-14 mx-auto text-yellow-500 animate-[spin_8s_linear_infinite]" viewBox="0 0 24 24" fill="none">
              <path
                d="M12 15a3 3 0 100-6 3 3 0 000 6z"
                stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"
              />
              <path
                d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 11-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 110-4h.09A1.65 1.65 0 004.6 8.6a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 114 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 110 4h-.09a1.65 1.65 0 00-1.51 1z"
                stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"
              />
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

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
  const { user, loading } = useAuth();
  const isPublicPage = publicPaths.some((path) => pathname.startsWith(path));

  // 비공개 페이지에서 미인증 시 로그인 리다이렉트
  useEffect(() => {
    if (!loading && !user && !isPublicPage) {
      const redirectTo = pathname !== '/' ? `?redirectTo=${pathname}` : '';
      router.replace(`/login${redirectTo}`);
    }
  }, [user, loading, isPublicPage, pathname, router]);

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
      <main className="flex-1 overflow-hidden">{children}</main>
    </>
  );
}

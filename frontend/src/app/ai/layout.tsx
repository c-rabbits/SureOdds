'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import AiSubNav from '@/components/ai/AiSubNav';

const AI_ALLOWED_EMAIL = 'qmirrorp@gmail.com';

export default function AiLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const hasAccess = user?.email === AI_ALLOWED_EMAIL;

  useEffect(() => {
    if (!loading && !hasAccess) {
      router.replace('/');
    }
  }, [hasAccess, loading, router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-gray-500 text-sm">로딩 중...</div>
      </div>
    );
  }

  if (!hasAccess) {
    return null;
  }

  return (
    <div className="flex flex-col h-full">
      <AiSubNav />
      <div className="flex-1 overflow-auto">
        {children}
      </div>
    </div>
  );
}

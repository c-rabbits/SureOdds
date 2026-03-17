'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import AiSubNav from '@/components/ai/AiSubNav';

const AI_ROLES = ['admin', 'vip2', 'vip3', 'vip4', 'vip5', 'test_vip2', 'test_vip3', 'test_vip4', 'test_vip5'];

export default function AiLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const hasAccess = !!user && AI_ROLES.includes(user.role);

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
      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        {children}
      </div>
    </div>
  );
}

'use client';

import { useEffect } from 'react';
import { useToast } from '@/components/Toast';
import { connectToast } from '@/lib/api';

/**
 * API 인터셉터와 Toast 시스템을 연결하는 브릿지 컴포넌트.
 * layout.tsx에서 ToastProvider 내부에 렌더링됩니다.
 */
export default function ToastConnector() {
  const { addToast } = useToast();

  useEffect(() => {
    connectToast(addToast);
  }, [addToast]);

  return null;
}

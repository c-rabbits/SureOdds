'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// Arbitrage is now integrated into the main dashboard
export default function ArbitragePage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/');
  }, [router]);

  return null;
}

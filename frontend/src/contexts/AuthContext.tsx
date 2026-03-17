'use client';

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  ReactNode,
} from 'react';
import { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { UserProfile } from '@/types';
import { registerLoginSession } from '@/lib/api';

interface AuthContextType {
  user: UserProfile | null;
  session: Session | null;
  loading: boolean;
  isAdmin: boolean;
  maintenance: boolean;
  signIn: (identifier: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [maintenance, setMaintenance] = useState(false);

  // 백엔드에서 프로필 조회
  const fetchProfile = useCallback(async (accessToken: string) => {
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/api/auth/me`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );
      if (res.ok) {
        const json = await res.json();
        if (json.success) {
          setUser(json.data);
          setMaintenance(false);
          return;
        }
      }
      // 401 + SESSION_EXPIRED → 다른 기기에서 로그인됨
      if (res.status === 401) {
        const json = await res.json().catch(() => ({}));
        if (json.code === 'SESSION_EXPIRED') {
          await supabase.auth.signOut();
          setUser(null);
          setSession(null);
          if (typeof window !== 'undefined') {
            alert('다른 기기에서 로그인되어 현재 세션이 종료되었습니다.');
            window.location.href = '/login';
          }
          return;
        }
      }
      // 503 유지보수 모드 감지
      if (res.status === 503) {
        const json = await res.json().catch(() => ({}));
        if (json.maintenance) {
          setMaintenance(true);
          setUser(null);
          return;
        }
      }
      // 인증 실패 시 세션 클리어
      setUser(null);
    } catch {
      setUser(null);
    }
  }, []);

  useEffect(() => {
    // 초기 세션 확인
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      if (s?.access_token) {
        fetchProfile(s.access_token).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    // 인증 상태 변경 리스너
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, s) => {
      setSession(s);
      if (s?.access_token) {
        await fetchProfile(s.access_token);
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [fetchProfile]);

  const signIn = useCallback(async (identifier: string, password: string) => {
    // 아이디(@없음) → 내부 이메일로 변환, 이메일(@포함) → 그대로 사용
    const email = identifier.includes('@') ? identifier : `${identifier}@sureodds.local`;
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };

    // 세션 등록 (중복 로그인 제어) — onAuthStateChange보다 먼저 등록
    if (data.session?.access_token) {
      try {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/api/auth/login`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${data.session.access_token}`,
              'Content-Type': 'application/json',
            },
          }
        );
        const json = await res.json();
        if (json.success && json.data) {
          setUser(json.data);
        }
      } catch {
        // 세션 등록 실패해도 로그인은 성공 처리
      }
    }

    return { error: null };
  }, []);

  const signOut = useCallback(async () => {
    // 백엔드 세션 무효화
    const currentSession = await supabase.auth.getSession();
    const token = currentSession.data.session?.access_token;
    if (token) {
      try {
        await fetch(
          `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/api/auth/logout`,
          {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
          }
        );
      } catch { /* ignore */ }
    }
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        loading,
        isAdmin: user?.role === 'admin',
        maintenance,
        signIn,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

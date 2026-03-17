'use client';

import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { updateMyProfile } from '@/lib/api';

export default function ProfilePage() {
  const { user, isAdmin, signOut } = useAuth();
  const [editing, setEditing] = useState(false);
  const [nickname, setNickname] = useState(user?.display_name || '');
  const [saving, setSaving] = useState(false);
  const [savedName, setSavedName] = useState(user?.display_name || '');

  if (!user) return null;

  const handleSave = async () => {
    if (!nickname.trim() || nickname.trim() === savedName) {
      setEditing(false);
      setNickname(savedName);
      return;
    }
    setSaving(true);
    try {
      const updated = await updateMyProfile({ display_name: nickname.trim() });
      setSavedName(updated.display_name || nickname.trim());
      setEditing(false);
      // Reload to update AuthContext
      window.location.reload();
    } catch {
      // error handled by interceptor
    } finally {
      setSaving(false);
    }
  };

  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const formatDateTime = (dateStr: string | null | undefined) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleString('ko-KR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="p-4 pb-8 max-w-lg mx-auto">
      {/* 프로필 헤더 */}
      <div className="flex flex-col items-center mb-6 pt-4">
        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-green-500 to-emerald-700 flex items-center justify-center mb-3 shadow-lg shadow-green-900/30">
          <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
        </div>
        <h1 className="text-lg font-bold text-white">{savedName || user.username || '사용자'}</h1>
        <span className={`mt-1 text-[10px] px-2 py-0.5 rounded-full font-medium ${
          isAdmin ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
        }`}>
          {isAdmin ? '관리자' : '일반 회원'}
        </span>
      </div>

      {/* 기본 정보 */}
      <Section title="기본 정보" icon={<UserIcon />}>
        <InfoRow label="아이디" value={user.username || '-'} />
        <div className="flex items-center justify-between py-2.5 border-b border-gray-800/50 last:border-0">
          <span className="text-xs text-gray-500">닉네임</span>
          {editing ? (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                maxLength={20}
                className="bg-gray-800 border border-gray-700 rounded-md px-2 py-1 text-xs text-white w-32 focus:outline-none focus:border-green-500"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSave();
                  if (e.key === 'Escape') { setEditing(false); setNickname(savedName); }
                }}
              />
              <button
                onClick={handleSave}
                disabled={saving}
                className="text-[10px] px-2 py-1 bg-green-600 hover:bg-green-500 text-white rounded-md transition-colors disabled:opacity-50"
              >
                {saving ? '...' : '저장'}
              </button>
              <button
                onClick={() => { setEditing(false); setNickname(savedName); }}
                className="text-[10px] px-2 py-1 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-md transition-colors"
              >
                취소
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-xs text-white">{savedName || '-'}</span>
              <button
                onClick={() => { setNickname(savedName); setEditing(true); }}
                className="p-1 rounded hover:bg-gray-800 transition-colors text-gray-500 hover:text-gray-300"
                title="닉네임 변경"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                  <path d="m15 5 4 4" />
                </svg>
              </button>
            </div>
          )}
        </div>
        {isAdmin && <InfoRow label="이메일" value={user.email || '-'} />}
      </Section>

      {/* 계정 정보 */}
      <Section title="계정 정보" icon={<ShieldIcon />}>
        <div className="flex items-center justify-between py-2.5 border-b border-gray-800/50">
          <span className="text-xs text-gray-500">권한 등급</span>
          <span className={`text-xs font-medium px-2 py-0.5 rounded ${
            isAdmin ? 'bg-red-500/15 text-red-400' : 'bg-blue-500/15 text-blue-400'
          }`}>
            {isAdmin ? 'Admin' : 'User'}
          </span>
        </div>
        <div className="flex items-center justify-between py-2.5 border-b border-gray-800/50">
          <span className="text-xs text-gray-500">계정 상태</span>
          <span className={`text-xs font-medium flex items-center gap-1.5 ${
            user.is_active ? 'text-green-400' : 'text-red-400'
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${user.is_active ? 'bg-green-400' : 'bg-red-400'}`} />
            {user.is_active ? '활성' : '비활성'}
          </span>
        </div>
        <InfoRow label="가입일" value={formatDate(user.created_at)} />
        <InfoRow label="최근 로그인" value={formatDateTime(user.last_sign_in_at)} />
      </Section>

      {/* 연동 서비스 */}
      <Section title="연동 서비스" icon={<LinkIcon />}>
        <div className="flex items-center justify-between py-2.5">
          <div className="flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-blue-400">
              <path d="m22 2-7 20-4-9-9-4z" />
              <path d="M22 2 11 13" />
            </svg>
            <span className="text-xs text-gray-300">Telegram</span>
          </div>
          {user.telegram_chat_id ? (
            <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-green-500/15 text-green-400 flex items-center gap-1">
              <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6 9 17l-5-5" />
              </svg>
              연동됨
            </span>
          ) : (
            <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-gray-700/50 text-gray-500">
              미연동
            </span>
          )}
        </div>
      </Section>

      {/* 로그아웃 */}
      <button
        onClick={() => signOut()}
        className="w-full mt-6 py-3 rounded-xl bg-gray-800/80 border border-gray-700/50 text-sm text-gray-400 hover:text-white hover:bg-gray-700/80 transition-colors flex items-center justify-center gap-2"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
          <polyline points="16 17 21 12 16 7" />
          <line x1="21" y1="12" x2="9" y2="12" />
        </svg>
        로그아웃
      </button>

      <p className="text-center text-[10px] text-gray-700 mt-4">
        SureOdds v2.0
      </p>
    </div>
  );
}

// ============================================================
// Sub-components
// ============================================================

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <div className="flex items-center gap-2 mb-2 px-1">
        <span className="text-gray-500">{icon}</span>
        <h2 className="text-xs font-semibold text-gray-400">{title}</h2>
      </div>
      <div className="bg-gray-900/60 border border-gray-800/60 rounded-xl px-4">
        {children}
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-gray-800/50 last:border-0">
      <span className="text-xs text-gray-500">{label}</span>
      <span className="text-xs text-white">{value}</span>
    </div>
  );
}

// ============================================================
// SVG Icons
// ============================================================

function UserIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
    </svg>
  );
}

function LinkIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  );
}

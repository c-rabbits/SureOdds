'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { updateMyProfile, generateTelegramLink, getTelegramStatus, unlinkTelegram } from '@/lib/api';
import { getAlertService, AlertConfig } from '@/lib/alertService';
import { isPushSupported, isPushSubscribed, subscribeToPush, unsubscribeFromPush } from '@/lib/pushService';
import { getAlertPreferences, updateAlertPreferences } from '@/lib/notificationApi';
import type { AlertPreference, NotificationType } from '@/types/notification';

const ROLE_LABELS: Record<string, string> = {
  admin: '관리자',
  vip5: 'VIP 5', vip4: 'VIP 4', vip3: 'VIP 3', vip2: 'VIP 2', vip1: 'VIP 1',
  test_vip5: 'T-VIP5', test_vip4: 'T-VIP4', test_vip3: 'T-VIP3', test_vip2: 'T-VIP2', test_vip1: 'T-VIP1',
};

const ALERT_TYPES: { type: NotificationType; label: string; desc: string; hasThreshold: boolean; thresholdLabel?: string; thresholdUnit?: string }[] = [
  { type: 'arbitrage', label: '양방 기회', desc: '양방 배팅 기회 감지 시 알림', hasThreshold: true, thresholdLabel: '최소 수익률', thresholdUnit: '%' },
  { type: 'value_bet', label: '밸류 베팅', desc: '고가치 밸류베팅 감지 시 알림', hasThreshold: true, thresholdLabel: '최소 엣지', thresholdUnit: '%' },
  { type: 'daily_digest', label: '일일 요약', desc: '매일 아침 예측/결과 요약', hasThreshold: false },
  { type: 'session_expiry', label: '세션 만료', desc: '사이트 세션 만료 임박 알림', hasThreshold: false },
];

const DEFAULT_PREF: AlertPreference = {
  alert_type: 'arbitrage',
  telegram_enabled: true,
  push_enabled: true,
  min_threshold: 0,
};

export default function ProfilePage() {
  const { user, isAdmin, signOut } = useAuth();
  const [editing, setEditing] = useState(false);
  const [nickname, setNickname] = useState(user?.display_name || '');
  const [saving, setSaving] = useState(false);
  const [savedName, setSavedName] = useState(user?.display_name || '');

  // 텔레그램 연동
  const [tgLinked, setTgLinked] = useState(!!user?.telegram_chat_id);
  const [tgLinking, setTgLinking] = useState(false);
  const [tgBotUrl, setTgBotUrl] = useState('');
  const [tgUnlinking, setTgUnlinking] = useState(false);
  const tgPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // 알림 설정 (로컬)
  const [alertConfig, setAlertConfig] = useState<AlertConfig | null>(null);
  const [notifPermission, setNotifPermission] = useState<string>('default');

  // Web Push
  const [pushSupported, setPushSupported] = useState(false);
  const [pushSubscribed, setPushSubscribed] = useState(false);
  const [pushLoading, setPushLoading] = useState(false);

  // 유형별 알림 설정
  const [preferences, setPreferences] = useState<AlertPreference[]>([]);
  const [prefSaving, setPrefSaving] = useState(false);

  useEffect(() => {
    setTgLinked(!!user?.telegram_chat_id);
  }, [user?.telegram_chat_id]);

  useEffect(() => {
    return () => {
      if (tgPollRef.current) clearInterval(tgPollRef.current);
    };
  }, []);

  // 알림 설정 로드
  useEffect(() => {
    const svc = getAlertService();
    setAlertConfig(svc.getConfig());
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setNotifPermission(Notification.permission);
    }
    setPushSupported(isPushSupported());
    isPushSubscribed().then(setPushSubscribed);
    loadPreferences();
  }, []);

  const loadPreferences = useCallback(async () => {
    try {
      const prefs = await getAlertPreferences();
      setPreferences(prefs);
    } catch { /* ignore */ }
  }, []);

  function getPref(type: NotificationType): AlertPreference {
    return preferences.find((p) => p.alert_type === type) || { ...DEFAULT_PREF, alert_type: type };
  }

  function updatePref(type: NotificationType, updates: Partial<AlertPreference>) {
    setPreferences((prev) => {
      const exists = prev.find((p) => p.alert_type === type);
      if (exists) return prev.map((p) => (p.alert_type === type ? { ...p, ...updates } : p));
      return [...prev, { ...DEFAULT_PREF, alert_type: type, ...updates }];
    });
  }

  async function savePreferences() {
    setPrefSaving(true);
    try {
      const allPrefs = ALERT_TYPES.map((at) => getPref(at.type));
      const merged = allPrefs.map((p) => {
        const updated = preferences.find((u) => u.alert_type === p.alert_type);
        return updated || p;
      });
      await updateAlertPreferences(merged);
    } catch { /* ignore */ }
    setPrefSaving(false);
  }

  function saveAlertConfig(updates: Partial<AlertConfig>) {
    const svc = getAlertService();
    svc.saveConfig(updates);
    setAlertConfig(svc.getConfig());
  }

  async function requestPermission() {
    const svc = getAlertService();
    const granted = await svc.requestNotificationPermission();
    setNotifPermission(granted ? 'granted' : 'denied');
    if (granted) saveAlertConfig({ browserNotifications: true });
  }

  async function handlePushToggle() {
    setPushLoading(true);
    try {
      const { createBrowserClient } = await import('@supabase/ssr');
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) return;
      if (pushSubscribed) {
        const ok = await unsubscribeFromPush(token);
        if (ok) setPushSubscribed(false);
      } else {
        const ok = await subscribeToPush(token);
        if (ok) setPushSubscribed(true);
      }
    } catch { /* ignore */ }
    setPushLoading(false);
  }

  const handleTelegramLink = async () => {
    try {
      const res = await generateTelegramLink();
      if (res.link) {
        setTgBotUrl(res.link);
        setTgLinking(true);
        window.open(res.link, '_blank');
        let elapsed = 0;
        tgPollRef.current = setInterval(async () => {
          elapsed += 5000;
          if (elapsed > 120000) {
            if (tgPollRef.current) clearInterval(tgPollRef.current);
            setTgLinking(false);
            return;
          }
          try {
            const status = await getTelegramStatus();
            if (status.linked) {
              if (tgPollRef.current) clearInterval(tgPollRef.current);
              setTgLinked(true);
              setTgLinking(false);
            }
          } catch { /* ignore */ }
        }, 5000);
      }
    } catch { /* error */ }
  };

  const handleTelegramUnlink = async () => {
    if (!confirm('텔레그램 연동을 해제하시겠습니까?')) return;
    setTgUnlinking(true);
    try {
      await unlinkTelegram();
      setTgLinked(false);
    } catch { /* error */ }
    setTgUnlinking(false);
  };

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
      window.location.reload();
    } catch { /* error */ }
    setSaving(false);
  };

  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });
  };

  const formatDateTime = (dateStr: string | null | undefined) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleString('ko-KR', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const roleLabel = ROLE_LABELS[user.role] || user.role;

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
          isAdmin ? 'bg-red-500/20 text-red-400 border border-red-500/30'
            : user.role.startsWith('test_') ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
            : user.role.startsWith('vip') ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
            : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
        }`}>
          {roleLabel}
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
                type="text" value={nickname} onChange={(e) => setNickname(e.target.value)} maxLength={20}
                className="bg-gray-800 border border-gray-700 rounded-md px-2 py-1 text-xs text-white w-32 focus:outline-none focus:border-green-500"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSave();
                  if (e.key === 'Escape') { setEditing(false); setNickname(savedName); }
                }}
              />
              <button onClick={handleSave} disabled={saving}
                className="text-[10px] px-2 py-1 bg-green-600 hover:bg-green-500 text-white rounded-md transition-colors disabled:opacity-50">
                {saving ? '...' : '저장'}
              </button>
              <button onClick={() => { setEditing(false); setNickname(savedName); }}
                className="text-[10px] px-2 py-1 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-md transition-colors">
                취소
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-xs text-white">{savedName || '-'}</span>
              <button onClick={() => { setNickname(savedName); setEditing(true); }}
                className="p-1 rounded hover:bg-gray-800 transition-colors text-gray-500 hover:text-gray-300" title="닉네임 변경">
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
            isAdmin ? 'bg-red-500/15 text-red-400'
              : user.role.startsWith('test_') ? 'bg-cyan-500/15 text-cyan-400'
              : user.role.startsWith('vip') ? 'bg-amber-500/15 text-amber-400'
              : 'bg-blue-500/15 text-blue-400'
          }`}>
            {roleLabel}
          </span>
        </div>
        <div className="flex items-center justify-between py-2.5 border-b border-gray-800/50">
          <span className="text-xs text-gray-500">계정 상태</span>
          <span className={`text-xs font-medium flex items-center gap-1.5 ${user.is_active ? 'text-green-400' : 'text-red-400'}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${user.is_active ? 'bg-green-400' : 'bg-red-400'}`} />
            {user.is_active ? '활성' : '비활성'}
          </span>
        </div>
        <InfoRow label="가입일" value={formatDate(user.created_at)} />
        <InfoRow label="최근 로그인" value={formatDateTime(user.last_sign_in_at)} />
      </Section>

      {/* 연동 서비스 */}
      <Section title="연동 서비스" icon={<LinkIcon />}>
        {/* 텔레그램 */}
        <div className="py-2.5 border-b border-gray-800/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-blue-400">
                <path d="m22 2-7 20-4-9-9-4z" /><path d="M22 2 11 13" />
              </svg>
              <span className="text-xs text-gray-300">Telegram</span>
            </div>
            {tgLinked ? (
              <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-green-500/15 text-green-400 flex items-center gap-1">
                <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
                연동됨
              </span>
            ) : (
              <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-gray-700/50 text-gray-500">미연동</span>
            )}
          </div>
          <div className="mt-2.5">
            {tgLinked ? (
              <button onClick={handleTelegramUnlink} disabled={tgUnlinking}
                className="w-full py-2 rounded-lg bg-gray-800 border border-gray-700/50 text-[11px] text-gray-400 hover:text-red-400 hover:border-red-500/30 transition-colors disabled:opacity-50">
                {tgUnlinking ? '해제 중...' : '연동 해제'}
              </button>
            ) : tgLinking ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-500/10 border border-blue-500/20">
                  <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
                  <span className="text-[11px] text-blue-400">텔레그램 봇에서 시작 버튼을 눌러주세요</span>
                </div>
                <button onClick={() => window.open(tgBotUrl, '_blank')}
                  className="w-full py-2 rounded-lg bg-blue-600/20 border border-blue-500/30 text-[11px] text-blue-400 hover:bg-blue-600/30 transition-colors">
                  텔레그램 봇 열기
                </button>
              </div>
            ) : (
              <button onClick={handleTelegramLink}
                className="w-full py-2 rounded-lg bg-blue-600/20 border border-blue-500/30 text-[11px] text-blue-400 hover:bg-blue-600/30 transition-colors">
                텔레그램 연동하기
              </button>
            )}
          </div>
        </div>

        {/* Web Push */}
        {pushSupported && (
          <div className="py-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BellIcon />
                <span className="text-xs text-gray-300">Web Push</span>
              </div>
              {pushSubscribed ? (
                <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-green-500/15 text-green-400 flex items-center gap-1">
                  <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
                  활성
                </span>
              ) : (
                <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-gray-700/50 text-gray-500">비활성</span>
              )}
            </div>
            <div className="mt-2.5">
              <button onClick={handlePushToggle} disabled={pushLoading}
                className={`w-full py-2 rounded-lg border text-[11px] transition-colors disabled:opacity-50 ${
                  pushSubscribed
                    ? 'bg-gray-800 border-gray-700/50 text-gray-400 hover:text-red-400 hover:border-red-500/30'
                    : 'bg-purple-600/20 border-purple-500/30 text-purple-400 hover:bg-purple-600/30'
                }`}>
                {pushLoading ? '처리 중...' : pushSubscribed ? '비활성화' : 'Web Push 활성화'}
              </button>
            </div>
          </div>
        )}
      </Section>

      {/* 알림 설정 */}
      {alertConfig && (
        <Section title="알림 설정" icon={<BellIcon />}>
          <div className="flex items-center justify-between py-2.5 border-b border-gray-800/50">
            <span className="text-xs text-gray-300">알림 활성화</span>
            <input type="checkbox" checked={alertConfig.enabled}
              onChange={(e) => saveAlertConfig({ enabled: e.target.checked })}
              className="w-4 h-4 rounded bg-gray-800 border-gray-600 text-green-500 focus:ring-green-500" />
          </div>
          <div className="flex items-center justify-between py-2.5 border-b border-gray-800/50">
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-300">소리</span>
              <button onClick={() => getAlertService().playSound('high')} className="text-[10px] text-green-400 hover:text-green-300">테스트</button>
            </div>
            <input type="checkbox" checked={alertConfig.soundEnabled}
              onChange={(e) => saveAlertConfig({ soundEnabled: e.target.checked })}
              className="w-4 h-4 rounded bg-gray-800 border-gray-600 text-green-500 focus:ring-green-500" />
          </div>
          <div className="flex items-center justify-between py-2.5">
            <span className="text-xs text-gray-300">브라우저 알림</span>
            {notifPermission === 'granted' ? (
              <input type="checkbox" checked={alertConfig.browserNotifications}
                onChange={(e) => saveAlertConfig({ browserNotifications: e.target.checked })}
                className="w-4 h-4 rounded bg-gray-800 border-gray-600 text-green-500 focus:ring-green-500" />
            ) : notifPermission === 'denied' ? (
              <span className="text-[10px] text-red-400">차단됨</span>
            ) : (
              <button onClick={requestPermission} className="text-[10px] px-2 py-1 rounded bg-gray-800 text-gray-300 hover:bg-gray-700">허용</button>
            )}
          </div>
        </Section>
      )}

      {/* 유형별 알림 설정 */}
      <Section title="유형별 알림" icon={<SettingsIcon />}>
        <div className="py-2.5 space-y-2">
          {ALERT_TYPES.map((at) => {
            const pref = getPref(at.type);
            return (
              <div key={at.type} className="bg-gray-800/40 border border-gray-700/40 rounded-lg p-2.5">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-medium text-white">{at.label}</span>
                  <span className="text-[10px] text-gray-600">{at.desc}</span>
                </div>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input type="checkbox" checked={pref.telegram_enabled}
                      onChange={(e) => updatePref(at.type, { telegram_enabled: e.target.checked })}
                      className="w-3.5 h-3.5 rounded bg-gray-700 border-gray-600 text-blue-500 focus:ring-blue-500" />
                    <span className="text-[10px] text-gray-400">TG</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input type="checkbox" checked={pref.push_enabled}
                      onChange={(e) => updatePref(at.type, { push_enabled: e.target.checked })}
                      className="w-3.5 h-3.5 rounded bg-gray-700 border-gray-600 text-purple-500 focus:ring-purple-500" />
                    <span className="text-[10px] text-gray-400">Push</span>
                  </label>
                  {at.hasThreshold && (
                    <div className="flex items-center gap-1 ml-auto">
                      <span className="text-[10px] text-gray-500">{at.thresholdLabel}</span>
                      <input type="number" step="0.5" min="0" value={pref.min_threshold}
                        onChange={(e) => updatePref(at.type, { min_threshold: parseFloat(e.target.value) || 0 })}
                        className="w-14 bg-gray-700 border border-gray-600 rounded px-1.5 py-0.5 text-white text-[10px] font-mono text-right focus:outline-none focus:border-blue-500" />
                      <span className="text-[10px] text-gray-500">{at.thresholdUnit}</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          <button onClick={savePreferences} disabled={prefSaving}
            className="w-full mt-1 py-2 rounded-lg bg-green-600 hover:bg-green-500 text-white text-[11px] font-medium transition-colors disabled:opacity-50">
            {prefSaving ? '저장 중...' : '유형별 설정 저장'}
          </button>
        </div>
      </Section>

      {/* 알림 기준 수익률 */}
      {alertConfig && (
        <Section title="알림 기준 수익률" icon={<ChartIcon />}>
          <div className="py-2.5 space-y-2">
            {(['medium', 'high', 'critical'] as const).map((level) => (
              <div key={level} className="flex items-center justify-between">
                <span className="text-xs text-gray-500">
                  {level === 'medium' ? '보통' : level === 'high' ? '높음' : '매우높음'}
                </span>
                <div className="flex items-center gap-1">
                  <input type="number" step="0.5" min="0" value={alertConfig.thresholds[level]}
                    onChange={(e) => saveAlertConfig({ thresholds: { ...alertConfig.thresholds, [level]: parseFloat(e.target.value) || 0 } })}
                    className="w-16 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-white text-xs font-mono text-right focus:outline-none focus:border-green-500" />
                  <span className="text-[10px] text-gray-500">%</span>
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* 로그아웃 */}
      <button onClick={() => signOut()}
        className="w-full mt-6 py-3 rounded-xl bg-gray-800/80 border border-gray-700/50 text-sm text-gray-400 hover:text-white hover:bg-gray-700/80 transition-colors flex items-center justify-center gap-2">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
          <polyline points="16 17 21 12 16 7" />
          <line x1="21" y1="12" x2="9" y2="12" />
        </svg>
        로그아웃
      </button>

      <p className="text-center text-[10px] text-gray-700 mt-4">SureOdds v2.0</p>
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
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
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

function BellIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function ChartIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  );
}

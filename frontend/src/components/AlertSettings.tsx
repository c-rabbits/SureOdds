'use client';

import { useState, useEffect, useCallback } from 'react';
import { getAlertService, AlertConfig } from '@/lib/alertService';
import { getTelegramStatus, generateTelegramLink, unlinkTelegram } from '@/lib/api';
import { isPushSupported, isPushSubscribed, subscribeToPush, unsubscribeFromPush } from '@/lib/pushService';
import { getAlertPreferences, updateAlertPreferences } from '@/lib/notificationApi';
import type { AlertPreference, NotificationType } from '@/types/notification';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

const ALERT_TYPES: { type: NotificationType; label: string; icon: string; desc: string; hasThreshold: boolean; thresholdLabel?: string; thresholdUnit?: string }[] = [
  { type: 'arbitrage', label: '양방 기회', icon: '⚡', desc: '양방 배팅 기회 감지 시 알림', hasThreshold: true, thresholdLabel: '최소 수익률', thresholdUnit: '%' },
  { type: 'value_bet', label: '밸류 베팅', icon: '🎯', desc: '고가치 밸류베팅 감지 시 알림', hasThreshold: true, thresholdLabel: '최소 엣지', thresholdUnit: '%' },
  { type: 'daily_digest', label: '일일 요약', icon: '📋', desc: '매일 아침 예측/결과 요약', hasThreshold: false },
  { type: 'session_expiry', label: '세션 만료', icon: '⚠️', desc: '사이트 세션 만료 임박 알림', hasThreshold: false },
];

const DEFAULT_PREF: AlertPreference = {
  alert_type: 'arbitrage',
  telegram_enabled: true,
  push_enabled: true,
  min_threshold: 0,
};

export default function AlertSettings({ isOpen, onClose }: Props) {
  const [config, setConfig] = useState<AlertConfig | null>(null);
  const [notifPermission, setNotifPermission] = useState<string>('default');

  // Telegram state
  const [tgLinked, setTgLinked] = useState(false);
  const [tgLinkedAt, setTgLinkedAt] = useState<string | null>(null);
  const [tgLink, setTgLink] = useState<string | null>(null);
  const [tgLoading, setTgLoading] = useState(false);
  const [tgPolling, setTgPolling] = useState(false);

  // Web Push state
  const [pushSupportedState, setPushSupportedState] = useState(false);
  const [pushSubscribedState, setPushSubscribedState] = useState(false);
  const [pushLoading, setPushLoading] = useState(false);

  // 유형별 알림 설정
  const [preferences, setPreferences] = useState<AlertPreference[]>([]);
  const [prefSaving, setPrefSaving] = useState(false);

  const loadTelegramStatus = useCallback(async () => {
    try {
      const status = await getTelegramStatus();
      setTgLinked(status.linked);
      setTgLinkedAt(status.linkedAt);
      if (status.linked) {
        setTgLink(null);
        setTgPolling(false);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      const svc = getAlertService();
      setConfig(svc.getConfig());
      if ('Notification' in window) {
        setNotifPermission(Notification.permission);
      }
      loadTelegramStatus();
      setPushSupportedState(isPushSupported());
      isPushSubscribed().then(setPushSubscribedState);
      loadPreferences();
    } else {
      setTgPolling(false);
      setTgLink(null);
    }
  }, [isOpen, loadTelegramStatus]);

  // 연동 대기 중 폴링
  useEffect(() => {
    if (!tgPolling) return;
    const interval = setInterval(loadTelegramStatus, 5000);
    const timeout = setTimeout(() => setTgPolling(false), 120000);
    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [tgPolling, loadTelegramStatus]);

  async function loadPreferences() {
    try {
      const prefs = await getAlertPreferences();
      setPreferences(prefs);
    } catch {
      // ignore
    }
  }

  function getPref(type: NotificationType): AlertPreference {
    return preferences.find((p) => p.alert_type === type) || { ...DEFAULT_PREF, alert_type: type };
  }

  function updatePref(type: NotificationType, updates: Partial<AlertPreference>) {
    setPreferences((prev) => {
      const exists = prev.find((p) => p.alert_type === type);
      if (exists) {
        return prev.map((p) => (p.alert_type === type ? { ...p, ...updates } : p));
      }
      return [...prev, { ...DEFAULT_PREF, alert_type: type, ...updates }];
    });
  }

  async function savePreferences() {
    setPrefSaving(true);
    try {
      // 모든 유형에 대해 설정 생성
      const allPrefs = ALERT_TYPES.map((at) => getPref(at.type));
      // 업데이트된 preferences에서 값 가져오기
      const merged = allPrefs.map((p) => {
        const updated = preferences.find((u) => u.alert_type === p.alert_type);
        return updated || p;
      });
      await updateAlertPreferences(merged);
    } catch {
      // ignore
    } finally {
      setPrefSaving(false);
    }
  }

  if (!isOpen || !config) return null;

  function save(updates: Partial<AlertConfig>) {
    const svc = getAlertService();
    svc.saveConfig(updates);
    setConfig(svc.getConfig());
  }

  async function requestPermission() {
    const svc = getAlertService();
    const granted = await svc.requestNotificationPermission();
    setNotifPermission(granted ? 'granted' : 'denied');
    if (granted) save({ browserNotifications: true });
  }

  function testSound() {
    const svc = getAlertService();
    svc.playSound('high');
  }

  async function handleGenerateLink() {
    setTgLoading(true);
    try {
      const result = await generateTelegramLink();
      setTgLink(result.link);
      setTgPolling(true);
    } catch {
      // error handled by interceptor
    } finally {
      setTgLoading(false);
    }
  }

  async function handleUnlink() {
    setTgLoading(true);
    try {
      await unlinkTelegram();
      setTgLinked(false);
      setTgLinkedAt(null);
    } catch {
      // error handled by interceptor
    } finally {
      setTgLoading(false);
    }
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

      if (pushSubscribedState) {
        const ok = await unsubscribeFromPush(token);
        if (ok) setPushSubscribedState(false);
      } else {
        const ok = await subscribeToPush(token);
        if (ok) setPushSubscribedState(true);
      }
    } catch {
      // ignore
    } finally {
      setPushLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-md p-5 max-h-[90vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">알림 설정</h2>
          <button onClick={onClose} className="btn-icon">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-4">
          {/* 기본 알림 설정 */}
          <label className="flex items-center justify-between">
            <span className="text-sm text-gray-300">알림 활성화</span>
            <input
              type="checkbox"
              checked={config.enabled}
              onChange={(e) => save({ enabled: e.target.checked })}
              className="w-4 h-4 rounded bg-gray-800 border-gray-600 text-green-500 focus:ring-green-500"
            />
          </label>

          <label className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-300">소리</span>
              <button onClick={testSound} className="text-xs text-green-400 hover:text-green-300">
                테스트
              </button>
            </div>
            <input
              type="checkbox"
              checked={config.soundEnabled}
              onChange={(e) => save({ soundEnabled: e.target.checked })}
              className="w-4 h-4 rounded bg-gray-800 border-gray-600 text-green-500 focus:ring-green-500"
            />
          </label>

          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-300">브라우저 알림</span>
            {notifPermission === 'granted' ? (
              <input
                type="checkbox"
                checked={config.browserNotifications}
                onChange={(e) => save({ browserNotifications: e.target.checked })}
                className="w-4 h-4 rounded bg-gray-800 border-gray-600 text-green-500 focus:ring-green-500"
              />
            ) : notifPermission === 'denied' ? (
              <span className="text-xs text-red-400">차단됨</span>
            ) : (
              <button onClick={requestPermission} className="btn-sm bg-gray-800 text-gray-300 hover:bg-gray-700">
                허용
              </button>
            )}
          </div>

          {/* ─── 텔레그램 연동 ─── */}
          <div className="border-t border-gray-800 pt-3">
            <h3 className="text-sm font-medium text-gray-400 mb-3 flex items-center gap-2">
              <span>📱</span> 텔레그램 알림
            </h3>

            {tgLinked ? (
              <div className="bg-green-900/20 border border-green-800/50 rounded-lg p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-green-400 text-sm">✅ 연동됨</span>
                    {tgLinkedAt && (
                      <span className="text-xs text-gray-500">
                        {new Date(tgLinkedAt).toLocaleDateString('ko-KR')}
                      </span>
                    )}
                  </div>
                  <button
                    onClick={handleUnlink}
                    disabled={tgLoading}
                    className="text-xs px-2 py-1 rounded bg-gray-700 text-red-400 hover:bg-red-900/40 disabled:opacity-50"
                  >
                    연동 해제
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-1.5">
                  양방 기회 감지 시 텔레그램으로 알림을 받습니다.
                </p>
              </div>
            ) : tgLink ? (
              <div className="bg-blue-900/20 border border-blue-800/50 rounded-lg p-3 space-y-2">
                <p className="text-xs text-gray-300">
                  아래 링크를 클릭해 봇에서 <strong>시작</strong> 버튼을 누르세요:
                </p>
                <a
                  href={tgLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block text-center text-sm font-medium text-blue-400 bg-blue-900/30 rounded px-3 py-2 hover:bg-blue-900/50 transition-colors"
                >
                  🤖 텔레그램 봇 열기
                </a>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">
                    {tgPolling ? '연동 확인 중...' : ''}
                  </span>
                  <button
                    onClick={loadTelegramStatus}
                    className="text-xs text-gray-400 hover:text-white"
                  >
                    상태 확인
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <button
                  onClick={handleGenerateLink}
                  disabled={tgLoading}
                  className="w-full btn-sm bg-blue-600 hover:bg-blue-500 text-white text-sm py-2 disabled:opacity-50"
                >
                  {tgLoading ? '생성 중...' : '텔레그램 연동하기'}
                </button>
                <p className="text-xs text-gray-500 mt-1.5">
                  텔레그램 봇과 연동하면 양방 기회를 실시간으로 받을 수 있습니다.
                </p>
              </div>
            )}
          </div>

          {/* ─── Web Push 알림 ─── */}
          {pushSupportedState && (
            <div className="border-t border-gray-800 pt-3">
              <h3 className="text-sm font-medium text-gray-400 mb-3 flex items-center gap-2">
                <span>🔔</span> Web Push 알림
              </h3>

              {pushSubscribedState ? (
                <div className="bg-green-900/20 border border-green-800/50 rounded-lg p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-green-400 text-sm">✅ 활성화됨</span>
                    <button
                      onClick={handlePushToggle}
                      disabled={pushLoading}
                      className="text-xs px-2 py-1 rounded bg-gray-700 text-red-400 hover:bg-red-900/40 disabled:opacity-50"
                    >
                      {pushLoading ? '처리 중...' : '비활성화'}
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 mt-1.5">
                    앱이 닫혀있어도 브라우저 푸시 알림을 받습니다.
                  </p>
                </div>
              ) : (
                <div>
                  <button
                    onClick={handlePushToggle}
                    disabled={pushLoading}
                    className="w-full btn-sm bg-purple-600 hover:bg-purple-500 text-white text-sm py-2 disabled:opacity-50"
                  >
                    {pushLoading ? '처리 중...' : 'Web Push 활성화'}
                  </button>
                  <p className="text-xs text-gray-500 mt-1.5">
                    앱을 닫아도 양방/밸류베팅 알림을 브라우저 푸시로 받을 수 있습니다.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* ─── 유형별 알림 설정 ─── */}
          <div className="border-t border-gray-800 pt-3">
            <h3 className="text-sm font-medium text-gray-400 mb-3 flex items-center gap-2">
              <span>📊</span> 유형별 알림 설정
            </h3>
            <div className="space-y-2">
              {ALERT_TYPES.map((at) => {
                const pref = getPref(at.type);
                return (
                  <div key={at.type} className="bg-gray-800/50 border border-gray-700/50 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-sm">{at.icon}</span>
                      <span className="text-sm font-medium text-white">{at.label}</span>
                      <span className="text-[10px] text-gray-600 ml-auto">{at.desc}</span>
                    </div>
                    <div className="flex items-center gap-4">
                      {/* 텔레그램 토글 */}
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={pref.telegram_enabled}
                          onChange={(e) => updatePref(at.type, { telegram_enabled: e.target.checked })}
                          className="w-3.5 h-3.5 rounded bg-gray-700 border-gray-600 text-blue-500 focus:ring-blue-500"
                        />
                        <span className="text-xs text-gray-400">📱 TG</span>
                      </label>

                      {/* Push 토글 */}
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={pref.push_enabled}
                          onChange={(e) => updatePref(at.type, { push_enabled: e.target.checked })}
                          className="w-3.5 h-3.5 rounded bg-gray-700 border-gray-600 text-purple-500 focus:ring-purple-500"
                        />
                        <span className="text-xs text-gray-400">🔔 Push</span>
                      </label>

                      {/* 최소 기준값 */}
                      {at.hasThreshold && (
                        <div className="flex items-center gap-1 ml-auto">
                          <span className="text-[10px] text-gray-500">{at.thresholdLabel}</span>
                          <input
                            type="number"
                            step="0.5"
                            min="0"
                            value={pref.min_threshold}
                            onChange={(e) => updatePref(at.type, { min_threshold: parseFloat(e.target.value) || 0 })}
                            className="w-16 bg-gray-700 border border-gray-600 rounded px-1.5 py-0.5 text-white text-xs font-mono text-right focus:outline-none focus:border-blue-500"
                          />
                          <span className="text-[10px] text-gray-500">{at.thresholdUnit}</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            <button
              onClick={savePreferences}
              disabled={prefSaving}
              className="mt-3 w-full btn-sm bg-green-600 hover:bg-green-500 text-white text-xs py-1.5 disabled:opacity-50"
            >
              {prefSaving ? '저장 중...' : '유형별 설정 저장'}
            </button>
          </div>

          {/* 알림 기준 수익률 (로컬) */}
          <div className="border-t border-gray-800 pt-3">
            <h3 className="text-sm font-medium text-gray-400 mb-2">알림 기준 수익률 (%)</h3>
            <div className="grid grid-cols-2 gap-2">
              {(['medium', 'high', 'critical'] as const).map((level) => (
                <div key={level} className="flex items-center gap-2">
                  <label className="text-xs text-gray-500 w-16">
                    {level === 'medium' ? '보통' : level === 'high' ? '높음' : '매우높음'}
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    value={config.thresholds[level]}
                    onChange={(e) => {
                      save({
                        thresholds: { ...config.thresholds, [level]: parseFloat(e.target.value) || 0 },
                      });
                    }}
                    className="flex-1 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-white text-xs font-mono focus:outline-none focus:border-green-500"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>

        <button onClick={onClose} className="mt-4 w-full btn-primary text-sm">
          확인
        </button>
      </div>
    </div>
  );
}

'use client';

import { useState, useEffect, useCallback } from 'react';
import { getAlertService, AlertConfig } from '@/lib/alertService';
import { getTelegramStatus, generateTelegramLink, unlinkTelegram } from '@/lib/api';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export default function AlertSettings({ isOpen, onClose }: Props) {
  const [config, setConfig] = useState<AlertConfig | null>(null);
  const [notifPermission, setNotifPermission] = useState<string>('default');

  // Telegram state
  const [tgLinked, setTgLinked] = useState(false);
  const [tgLinkedAt, setTgLinkedAt] = useState<string | null>(null);
  const [tgLink, setTgLink] = useState<string | null>(null);
  const [tgLoading, setTgLoading] = useState(false);
  const [tgPolling, setTgPolling] = useState(false);

  const loadTelegramStatus = useCallback(async () => {
    try {
      const status = await getTelegramStatus();
      setTgLinked(status.linked);
      setTgLinkedAt(status.linkedAt);
      if (status.linked) {
        setTgLink(null); // 연동 완료면 링크 숨김
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
    } else {
      // 닫힐 때 폴링 중지
      setTgPolling(false);
      setTgLink(null);
    }
  }, [isOpen, loadTelegramStatus]);

  // 연동 대기 중 폴링
  useEffect(() => {
    if (!tgPolling) return;
    const interval = setInterval(loadTelegramStatus, 5000);
    const timeout = setTimeout(() => setTgPolling(false), 120000); // 2분 후 중지
    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [tgPolling, loadTelegramStatus]);

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
      setTgPolling(true); // 자동 폴링 시작
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
          {/* Enable alerts */}
          <label className="flex items-center justify-between">
            <span className="text-sm text-gray-300">알림 활성화</span>
            <input
              type="checkbox"
              checked={config.enabled}
              onChange={(e) => save({ enabled: e.target.checked })}
              className="w-4 h-4 rounded bg-gray-800 border-gray-600 text-green-500 focus:ring-green-500"
            />
          </label>

          {/* Sound */}
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

          {/* Browser notifications */}
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
              // 연동 완료
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
              // 연동 대기 중 (딥링크 표시)
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
              // 미연동
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

          {/* Thresholds */}
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

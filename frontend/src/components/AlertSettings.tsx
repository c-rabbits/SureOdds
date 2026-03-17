'use client';

import { useState, useEffect } from 'react';
import { getAlertService, AlertConfig } from '@/lib/alertService';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export default function AlertSettings({ isOpen, onClose }: Props) {
  const [config, setConfig] = useState<AlertConfig | null>(null);
  const [notifPermission, setNotifPermission] = useState<string>('default');

  useEffect(() => {
    if (isOpen) {
      const svc = getAlertService();
      setConfig(svc.getConfig());
      if ('Notification' in window) {
        setNotifPermission(Notification.permission);
      }
    }
  }, [isOpen]);

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
          <label className="flex items-center justify-between">
            <span className="text-sm text-gray-300">알림 활성화</span>
            <input type="checkbox" checked={config.enabled}
              onChange={(e) => save({ enabled: e.target.checked })}
              className="w-4 h-4 rounded bg-gray-800 border-gray-600 text-green-500 focus:ring-green-500" />
          </label>

          <label className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-300">소리</span>
              <button onClick={testSound} className="text-xs text-green-400 hover:text-green-300">테스트</button>
            </div>
            <input type="checkbox" checked={config.soundEnabled}
              onChange={(e) => save({ soundEnabled: e.target.checked })}
              className="w-4 h-4 rounded bg-gray-800 border-gray-600 text-green-500 focus:ring-green-500" />
          </label>

          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-300">브라우저 알림</span>
            {notifPermission === 'granted' ? (
              <input type="checkbox" checked={config.browserNotifications}
                onChange={(e) => save({ browserNotifications: e.target.checked })}
                className="w-4 h-4 rounded bg-gray-800 border-gray-600 text-green-500 focus:ring-green-500" />
            ) : notifPermission === 'denied' ? (
              <span className="text-xs text-red-400">차단됨</span>
            ) : (
              <button onClick={requestPermission} className="btn-sm bg-gray-800 text-gray-300 hover:bg-gray-700">허용</button>
            )}
          </div>

          <div className="border-t border-gray-800 pt-3 text-center">
            <p className="text-xs text-gray-500">
              텔레그램 연동, Web Push, 유형별 알림 설정은
              <a href="/profile" className="text-green-400 hover:text-green-300 ml-1">프로필 페이지</a>에서 관리합니다.
            </p>
          </div>
        </div>

        <button onClick={onClose} className="mt-4 w-full btn-primary text-sm">확인</button>
      </div>
    </div>
  );
}

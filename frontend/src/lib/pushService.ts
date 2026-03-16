/**
 * Web Push 구독 관리 (Phase 3 Step 2)
 *
 * 서비스 워커 등록 + Push 구독/해제.
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

/**
 * Web Push가 지원되는 환경인지 확인.
 */
export function isPushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

/**
 * 서비스 워커 등록.
 */
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!isPushSupported()) return null;

  try {
    const registration = await navigator.serviceWorker.register('/sw.js');
    return registration;
  } catch (err) {
    console.error('Service Worker registration failed:', err);
    return null;
  }
}

/**
 * VAPID 공개키를 서버에서 가져옴.
 */
async function getVapidKey(): Promise<string | null> {
  try {
    const res = await fetch(`${API_URL}/api/push/vapid-key`);
    const data = await res.json();
    return data.success ? data.key : null;
  } catch {
    return null;
  }
}

/**
 * URL-safe base64를 Uint8Array로 변환 (VAPID 키용).
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Push 구독 + 서버에 저장.
 * @param token - 인증 토큰
 */
export async function subscribeToPush(token: string): Promise<boolean> {
  try {
    const registration = await registerServiceWorker();
    if (!registration) return false;

    // Notification 권한 요청
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return false;

    // VAPID 키 가져오기
    const vapidKey = await getVapidKey();
    if (!vapidKey) {
      console.error('VAPID key not available');
      return false;
    }

    // Push Manager 구독
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidKey).buffer as ArrayBuffer,
    });

    // 서버에 저장
    const res = await fetch(`${API_URL}/api/push/subscribe`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ subscription: subscription.toJSON() }),
    });

    const data = await res.json();
    return data.success === true;
  } catch (err) {
    console.error('Push subscription failed:', err);
    return false;
  }
}

/**
 * Push 구독 해제.
 * @param token - 인증 토큰
 */
export async function unsubscribeFromPush(token: string): Promise<boolean> {
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();

    if (subscription) {
      // 서버에서 삭제
      await fetch(`${API_URL}/api/push/subscribe`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ endpoint: subscription.endpoint }),
      });

      // 브라우저 구독 해제
      await subscription.unsubscribe();
    }

    return true;
  } catch (err) {
    console.error('Push unsubscription failed:', err);
    return false;
  }
}

/**
 * 현재 Push 구독 상태 확인.
 */
export async function isPushSubscribed(): Promise<boolean> {
  if (!isPushSupported()) return false;

  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    return subscription !== null;
  } catch {
    return false;
  }
}

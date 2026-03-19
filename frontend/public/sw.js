/**
 * SureOdds Service Worker
 * Web Push 알림 수신 + 클릭 처리만 담당.
 * Next.js의 캐싱/라우팅을 방해하지 않기 위해 fetch 핸들러 없음.
 */

self.addEventListener('push', (event) => {
  if (!event.data) return;

  let data;
  try {
    data = event.data.json();
  } catch (e) {
    data = { title: 'SureOdds', body: event.data.text() };
  }

  const options = {
    body: data.body || '',
    icon: data.icon || '/icons/icon-192.svg',
    badge: '/icons/icon-72.svg',
    tag: data.tag || 'sureodds',
    data: {
      url: data.url || '/',
    },
    vibrate: [200, 100, 200],
    requireInteraction: false,
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'SureOdds', options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const url = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // 이미 열린 탭이 있으면 포커스
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      // 없으면 새 탭
      return clients.openWindow(url);
    })
  );
});

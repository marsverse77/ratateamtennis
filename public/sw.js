// Service worker: shows push notifications (new sessions, schedules) and opens the app when one is tapped.
// Pushes arrive empty; the notification text comes from the API.

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('push', (e) => {
  e.waitUntil((async () => {
    let n = null;
    try {
      const sub = await self.registration.pushManager.getSubscription();
      const res = await fetch('api/index.php?r=push/pending', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'bcs' },
        body: JSON.stringify({ endpoint: sub ? sub.endpoint : '' }),
      });
      n = (await res.json()).notification;
    } catch (err) { /* offline: fall back to a generic notice */ }
    n = n || { title: 'RATA Team', body: 'There is something new for you.', url: '' };
    await self.registration.showNotification(n.title, {
      body: n.body,
      icon: 'assets/img/icon-192.png',
      badge: 'assets/img/icon-192.png',
      tag: n.id ? 'bcs-' + n.id : 'bcs',
      data: { url: n.url || '' },
    });
  })());
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = new URL('./' + (e.notification.data && e.notification.data.url || ''), self.registration.scope).href;
  e.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const w of wins) {
      if (w.url.startsWith(self.registration.scope)) {
        await w.focus();
        return w.navigate ? w.navigate(url) : null;
      }
    }
    return self.clients.openWindow(url);
  })());
});

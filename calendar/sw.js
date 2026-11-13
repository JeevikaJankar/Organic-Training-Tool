/* PAPL OLC service worker — opens instantly from the phone's saved copy.
   On every new release, change VERSION below (e.g. v33 -> v34) and upload together with index.html.
   Phones get the new version automatically next time they open the app with internet. */
const VERSION = 'olc-v34';
const CORE = ['./', './index.html'];

self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(caches.open(VERSION).then(c =>
    Promise.all(CORE.map(u => fetch(u, { cache: 'reload' }).then(r => r.ok && c.put(u, r)).catch(() => {})))
  ));
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    const old = keys.filter(k => k !== VERSION);
    await Promise.all(old.map(k => caches.delete(k)));
    await self.clients.claim();
    if (old.length) {                                   // a real update: reload open pages once
      const tabs = await self.clients.matchAll({ type: 'window' });
      tabs.forEach(t => t.navigate(t.url).catch(() => {}));
    }
  })());
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;           // Sheet sync, YouTube, Drive: never cached here

  // App page: saved copy first (instant, works offline); fetch from internet only if nothing saved yet
  if (req.mode === 'navigate' || url.pathname.endsWith('.html') || url.pathname.endsWith('/')) {
    e.respondWith(
      caches.match('./index.html').then(hit => hit || fetch(req).then(res => {
        const copy = res.clone(); caches.open(VERSION).then(c => c.put('./index.html', copy)); return res;
      }))
    );
    return;
  }

  // Other files (icons, manifest, images): saved copy first, refresh in background
  e.respondWith(
    caches.match(req).then(hit => {
      const net = fetch(req).then(res => {
        if (res.ok) { const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)); }
        return res;
      }).catch(() => hit);
      return hit || net;
    })
  );
});

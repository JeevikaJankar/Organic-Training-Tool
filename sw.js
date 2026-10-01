/* PAPL Organic Learning Calendar — offline + fast-open service worker
   Opens instantly from the phone's saved copy, then quietly downloads the latest
   version in the background (shown on the next opening). */
var CACHE = 'papl-olc-trial-v1';  // change to v2, v3… only if you ever need to force-clear old copies
var CORE = ['./manifest.json', './icons/icon-192.png', './icons/icon-512.png',
            './icons/icon-maskable-192.png', './icons/icon-maskable-512.png', './icons/apple-touch-icon.png'];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) {
    return c.addAll(CORE).then(function () {
      // Usually served from the browser's HTTP cache right after the first visit (no extra data).
      return c.add(new Request('./', { cache: 'force-cache' })).catch(function () {});
    });
  }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

var ROOT = new URL('./', self.location).pathname;           // e.g. /Organic-Training-Tool/
function isCalendarPage(req, url) {
  // Only the calendar itself (folder link or index.html) — other pages in the repo are left untouched.
  var isHtml = req.mode === 'navigate' || (req.headers.get('accept') || '').indexOf('text/html') > -1;
  return isHtml && (url.pathname === ROOT || url.pathname === ROOT + 'index.html');
}

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);

  // The calendar page: stale-while-revalidate (instant open, background update).
  if (url.origin === location.origin && isCalendarPage(req, url)) {
    e.respondWith(caches.open(CACHE).then(function (c) {
      return c.match('./').then(function (cached) {
        var net = fetch(req).then(function (res) {
          if (res && res.ok && res.type === 'basic') c.put('./', res.clone());
          return res;
        }).catch(function () { return cached; });
        if (cached) { e.waitUntil(net); return cached; }
        return net;
      });
    }));
    return;
  }

  // Fonts and video thumbnails: cache-first.
  if (/fonts\.(googleapis|gstatic)\.com$/.test(url.hostname) || url.hostname === 'img.youtube.com') {
    e.respondWith(caches.open(CACHE).then(function (c) {
      return c.match(req).then(function (hit) {
        return hit || fetch(req).then(function (res) {
          if (res && (res.ok || res.type === 'opaque')) c.put(req, res.clone());
          return res;
        });
      });
    }));
    return;
  }

  // Our own small files (manifest, icons): cache, then network.
  if (url.origin === location.origin) {
    e.respondWith(caches.match(req).then(function (hit) { return hit || fetch(req); }));
  }
});

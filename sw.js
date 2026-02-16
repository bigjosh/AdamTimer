const CACHE_NAME = 'meditation-v2';
const PRECACHE_URLS = [
  './',
  './index.html',
  './manifest.json',
  './sand.jpg',
  './sea.jpg',
  './knock.mp3',
  './gong.mp3',
  './icon-192.png',
  './icon-512.png',
  'https://cdn.jsdelivr.net/npm/nosleep.js@0.12.0/dist/NoSleep.min.js'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Network-first for same-origin navigation and index.html
  // so the app always picks up new versions
  if (e.request.mode === 'navigate' || url.pathname.endsWith('/index.html')) {
    e.respondWith(
      fetch(e.request)
        .then(response => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
          return response;
        })
        .catch(() => caches.match(e.request))
    );
    return;
  }

  // Cache-first for everything else (images, audio, scripts)
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request))
  );
});

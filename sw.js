const CACHE_NAME = 'meditation-v1';
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
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request))
  );
});

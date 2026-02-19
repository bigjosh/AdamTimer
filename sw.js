const CACHE_NAME = 'meditation-v3';
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
  './favicon.svg',
  './NoSleep.min.js'
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
    caches.open(CACHE_NAME).then(cache =>
      cache.match(e.request).then(cached => {
        var fetchPromise = fetch(e.request).then(response => {
          if (response.ok) cache.put(e.request, response.clone());
          return response;
        }).catch(() => cached);

        return cached || fetchPromise;
      })
    )
  );
});

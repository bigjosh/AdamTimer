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
  if (e.request.mode === 'navigate') {
    // Serve cached page instantly
    e.respondWith(
      caches.open(CACHE_NAME).then(cache =>
        cache.match(e.request).then(cached => {
          if (cached) return cached;
          // First visit with no cache - fetch and cache
          return fetch(e.request).then(resp => {
            cache.put(e.request, resp.clone());
            return resp;
          });
        })
      )
    );
    // Check for updates in the background
    e.waitUntil(checkForUpdate());
    return;
  }

  // Cache-first for all other assets
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request))
  );
});

async function checkForUpdate() {
  try {
    var cache = await caches.open(CACHE_NAME);
    var cached = await cache.match('./index.html');
    if (!cached) return;

    var fresh = await fetch('./index.html', { cache: 'no-cache' });
    if (!fresh.ok) return;

    var freshText = await fresh.clone().text();
    var cachedText = await cached.text();

    if (freshText === cachedText) return;

    // index.html changed — refresh all cached assets
    await Promise.all(
      PRECACHE_URLS.map(url =>
        fetch(url, { cache: 'no-cache' })
          .then(r => { if (r.ok) return cache.put(url, r); })
          .catch(() => {})
      )
    );
  } catch (e) {
    // Offline or fetch error — skip update
  }
}

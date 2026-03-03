const CACHE_NAME = 'meditation-cache';

self.addEventListener('install', e => {
  e.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  var url = new URL(e.request.url);
  if (url.origin !== location.origin) return;

  e.respondWith(
    caches.open(CACHE_NAME).then(cache =>
      cache.match(e.request).then(cached => {
        var refresh = fetch(e.request, { cache: 'no-cache' })
          .then(async response => {
            if (response.status !== 200) return;

            if (url.pathname === '/' || url.pathname.endsWith('/index.html')) {
              var existing = await cache.match(e.request);
              if (existing) {
                var newBody = await response.clone().text();
                var oldBody = await existing.text();
                if (newBody !== oldBody) {
                  await cache.put(
                    new Request('/__update_available__'),
                    new Response('1')
                  );
                }
              }
            }

            await cache.put(e.request, response.clone());
          })
          .catch(() => {});

        if (cached) {
          e.waitUntil(refresh);
          return cached;
        }

        // Nothing cached yet — wait for network
        return fetch(e.request).then(response => {
          if (response.status === 200) cache.put(e.request, response.clone());
          return response;
        });
      })
    )
  );
});

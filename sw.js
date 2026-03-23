const META_CACHE_NAME = 'meditation-meta';
const META_REQUEST = new Request(new URL('__sw_meta__', self.registration.scope).toString());
const DEFAULT_ACTIVE_CACHE = 'meditation-cache-active';
const APP_SHELL_CACHE_REQUEST = new Request(new URL('__app_shell__', self.registration.scope).toString());
const INDEX_URL = new URL('index.html', self.registration.scope).toString();
const INDEX_PATH = new URL('index.html', self.registration.scope).pathname;
const SCOPE_PATH = new URL(self.registration.scope).pathname;
const STATIC_ASSET_URLS = [
  'manifest.json',
  'sand.jpg',
  'sea.jpg',
  'icon-192.png',
  'icon-512.png',
  'favicon.svg',
  'NoSleep.min.js',
  'sounds/Gong 1.m4a',
  'sounds/Gong 2.wav',
  'sounds/Gong 3.wav',
  'sounds/Gong 4.wav',
  'sounds/Gong 5.wav',
  'sounds/Wood Block.m4a'
].map(function (path) {
  return new URL(path, self.registration.scope).toString();
});

let updateCheckInFlight = null;

function defaultMeta() {
  return {
    activeCache: DEFAULT_ACTIVE_CACHE,
    pendingCache: '',
    updateAvailable: false
  };
}

async function readMeta() {
  var cache = await caches.open(META_CACHE_NAME);
  var response = await cache.match(META_REQUEST);
  if (!response) return defaultMeta();

  try {
    var meta = await response.json();
    return {
      activeCache: meta.activeCache || DEFAULT_ACTIVE_CACHE,
      pendingCache: meta.pendingCache || '',
      updateAvailable: !!meta.updateAvailable
    };
  } catch (e) {
    return defaultMeta();
  }
}

async function writeMeta(meta) {
  var cache = await caches.open(META_CACHE_NAME);
  await cache.put(
    META_REQUEST,
    new Response(JSON.stringify({
      activeCache: meta.activeCache || DEFAULT_ACTIVE_CACHE,
      pendingCache: meta.pendingCache || '',
      updateAvailable: !!meta.updateAvailable
    }), {
      headers: { 'Content-Type': 'application/json' }
    })
  );
}

async function ensureMeta() {
  var meta = await readMeta();
  await writeMeta(meta);
  return meta;
}

function isAppShellRequest(request, url) {
  return request.mode === 'navigate' ||
    url.pathname === SCOPE_PATH ||
    url.pathname === INDEX_PATH;
}

function getCacheKey(request, url) {
  return isAppShellRequest(request, url) ? APP_SHELL_CACHE_REQUEST : request;
}

async function cleanupCaches(meta) {
  var keep = {};
  keep[META_CACHE_NAME] = true;
  keep[meta.activeCache || DEFAULT_ACTIVE_CACHE] = true;
  if (meta.pendingCache) keep[meta.pendingCache] = true;

  var keys = await caches.keys();
  await Promise.all(keys.map(function (key) {
    if (keep[key]) return Promise.resolve(false);
    return caches.delete(key);
  }));
}

async function cacheNetworkResponse(cache, key, request) {
  var response = await fetch(request);
  if (!response || response.status !== 200) {
    throw new Error('Failed to fetch ' + request);
  }
  await cache.put(key, response.clone());
  return response;
}

async function stagePendingCache(cacheName, latestIndexResponse) {
  var cache = await caches.open(cacheName);

  try {
    await cache.put(APP_SHELL_CACHE_REQUEST, latestIndexResponse.clone());

    for (var i = 0; i < STATIC_ASSET_URLS.length; i++) {
      var assetUrl = STATIC_ASSET_URLS[i];
      await cacheNetworkResponse(
        cache,
        new Request(assetUrl),
        new Request(assetUrl, { cache: 'no-store' })
      );
    }
  } catch (err) {
    await caches.delete(cacheName);
    throw err;
  }
}

async function hasValidPendingCache(meta) {
  if (!meta.pendingCache) return false;

  var cache = await caches.open(meta.pendingCache);
  var shell = await cache.match(APP_SHELL_CACHE_REQUEST);
  return !!shell;
}

async function checkForUpdate() {
  if (updateCheckInFlight) return updateCheckInFlight;

  updateCheckInFlight = (async function () {
    var meta = await readMeta();
    var hasPendingUpdate = await hasValidPendingCache(meta);

    if (meta.updateAvailable && hasPendingUpdate) return true;
    if (meta.updateAvailable && !hasPendingUpdate) {
      meta.pendingCache = '';
      meta.updateAvailable = false;
      await writeMeta(meta);
    }

    var activeCache = await caches.open(meta.activeCache);
    var currentIndexResponse = await activeCache.match(APP_SHELL_CACHE_REQUEST);
    var latestIndexResponse = await fetch(new Request(INDEX_URL, { cache: 'no-store' }));

    if (!latestIndexResponse || latestIndexResponse.status !== 200) {
      throw new Error('Failed to fetch latest index.html');
    }

    if (!currentIndexResponse) {
      await activeCache.put(APP_SHELL_CACHE_REQUEST, latestIndexResponse.clone());
      return false;
    }

    var currentHtml = await currentIndexResponse.text();
    var latestHtml = await latestIndexResponse.clone().text();

    if (currentHtml === latestHtml) return false;

    var pendingCache = 'meditation-cache-pending-' + Date.now();
    await stagePendingCache(pendingCache, latestIndexResponse);

    meta.pendingCache = pendingCache;
    meta.updateAvailable = true;
    await writeMeta(meta);
    await cleanupCaches(meta);
    return true;
  })().catch(function () {
    return false;
  }).finally(function () {
    updateCheckInFlight = null;
  });

  return updateCheckInFlight;
}

async function applyPendingUpdate() {
  var meta = await readMeta();
  if (!meta.updateAvailable || !(await hasValidPendingCache(meta))) {
    meta.pendingCache = '';
    meta.updateAvailable = false;
    await writeMeta(meta);
    return { applied: false };
  }

  meta.activeCache = meta.pendingCache;
  meta.pendingCache = '';
  meta.updateAvailable = false;
  await writeMeta(meta);
  await cleanupCaches(meta);

  return { applied: true };
}

self.addEventListener('install', function (event) {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    ensureMeta().then(function (meta) {
      return cleanupCaches(meta);
    }).then(function () {
      return self.clients.claim();
    })
  );
});

self.addEventListener('message', function (event) {
  var port = event.ports && event.ports[0];
  var data = event.data || {};
  if (!port || !data.type) return;

  if (data.type === 'CHECK_FOR_UPDATE') {
    event.waitUntil(
      readMeta().then(function (meta) {
        if (!meta.updateAvailable) {
          checkForUpdate();
        }
        port.postMessage({ available: !!meta.updateAvailable });
      }).catch(function () {
        port.postMessage({ available: false });
      })
    );
    return;
  }

  if (data.type === 'APPLY_UPDATE') {
    event.waitUntil(
      applyPendingUpdate().then(function (result) {
        port.postMessage(result);
      }).catch(function (err) {
        port.postMessage({ applied: false, error: err && err.message ? err.message : 'Unknown error' });
      })
    );
  }
});

self.addEventListener('fetch', function (event) {
  var request = event.request;
  if (request.method !== 'GET') return;

  var url = new URL(request.url);
  if (url.origin !== location.origin) return;

  event.respondWith((async function () {
    var meta = await readMeta();
    var cache = await caches.open(meta.activeCache);
    var cacheKey = getCacheKey(request, url);
    var cached = await cache.match(cacheKey);

    if (cached) return cached;

    var response = await fetch(request);
    if (response && response.status === 200) {
      await cache.put(cacheKey, response.clone());
    }
    return response;
  })());
});

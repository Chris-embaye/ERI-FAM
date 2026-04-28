/* ============================================
   ERITREAN INFO — Service Worker
   Caches all app assets for offline use
   ============================================ */

const CACHE_NAME    = 'eritrean-info-v7';
const OFFLINE_URL   = './index.html';

const PRECACHE_ASSETS = [
  './index.html',
  './styles.css',
  './script.js',
  './firebase-config.js',
  './manifest.json',
  './icons/icon.svg',
  // Leaflet for offline map rendering
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
  // Map tiles: can't precache all, but cache a few Asmara-area tiles on fetch
];

// ── INSTALL: cache core assets ────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// ── ACTIVATE: clean up old caches ────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    }).then(() => self.clients.claim())
  );
});

// ── FETCH: network-first, fall back to cache ─
self.addEventListener('fetch', (event) => {
  // Skip non-GET and chrome-extension requests
  if (event.request.method !== 'GET') return;
  if (event.request.url.startsWith('chrome-extension://')) return;

  // For translation API calls: network only (no caching)
  if (event.request.url.includes('mymemory.translated.net') ||
      event.request.url.includes('api.mymemory')) {
    return;
  }

  // Leaflet + map tiles: cache-first so map works offline
  if (event.request.url.includes('unpkg.com/leaflet') ||
      event.request.url.includes('tile.openstreetmap.org')) {
    event.respondWith(
      caches.match(event.request).then(cached => cached || fetch(event.request).then(res => {
        if (res && res.status === 200) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
        }
        return res;
      }).catch(() => new Response('', { status: 404 })))
    );
    return;
  }

  // For external images (Wikimedia, picsum): network first, no offline fallback
  if (event.request.url.includes('wikimedia.org') ||
      event.request.url.includes('picsum.photos') ||
      event.request.url.includes('googleapis.com') ||
      event.request.url.includes('gstatic.com')) {
    event.respondWith(
      fetch(event.request).catch(() => new Response('', { status: 404 }))
    );
    return;
  }

  // For local assets: cache first, then network
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;

      return fetch(event.request).then((networkResponse) => {
        // Cache successful responses
        if (networkResponse && networkResponse.status === 200) {
          const clone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, clone);
          });
        }
        return networkResponse;
      }).catch(() => {
        // Offline fallback
        if (event.request.headers.get('Accept')?.includes('text/html')) {
          return caches.match(OFFLINE_URL);
        }
        return new Response('Offline', { status: 503 });
      });
    })
  );
});

// ── BACKGROUND SYNC: retry failed translations ─
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-translations') {
    // handled in main script
  }
});

// ── PUSH NOTIFICATIONS (future use) ──────────
self.addEventListener('push', (event) => {
  if (!event.data) return;
  const data = event.data.json();
  self.registration.showNotification(data.title || 'Eritrean Info', {
    body: data.body || '',
    icon: './icons/icon.svg',
    badge: './icons/icon.svg',
    tag: 'eritrean-info-notification',
  });
});

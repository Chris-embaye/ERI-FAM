/* ============================================
   FIDEL — Service Worker
============================================ */

const CACHE_NAME  = 'fidel-v140';
const OFFLINE_URL = './index.html';

const PRECACHE = [
  './index.html',
  './firebase-config.js',
  './manifest.json',
  './icons/icon-512.png',
  './icons/fidel-logo.svg',
  './api/data/greetings.json',
  './api/data/numbers.json',
  './api/data/family.json',
  './api/data/food.json',
  './api/data/phrases.json',
  './api/data/colors.json',
  './api/data/days.json',
  './api/data/months.json',
  './api/data/body.json',
  './api/data/verbs.json',
  './api/data/places.json',
  './api/data/animals.json',
  './api/data/jobs.json',
  './api/data/emotions.json',
  './api/data/transport.json',
  'https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js',
  'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth-compat.js',
  'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore-compat.js',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(c => Promise.allSettled(PRECACHE.map(url => c.add(url).catch(() => {}))))
    // No skipWaiting here — we wait for the user to tap "Refresh"
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  if (e.request.url.startsWith('chrome-extension://')) return;

  const url = new URL(e.request.url);

  // Never intercept Firebase / Google APIs
  if (['gstatic.com','googleapis.com','firebaseapp.com','accounts.google.com']
      .some(h => url.hostname.endsWith(h))) {
    e.respondWith(
      caches.match(e.request).then(cached => {
        if (cached) return cached;
        return fetch(e.request).then(res => {
          if (res && res.ok) caches.open(CACHE_NAME).then(c => c.put(e.request, res.clone()));
          return res;
        }).catch(() => new Response('', { status: 503 }));
      })
    );
    return;
  }

  // Translation API — network only
  if (url.hostname.includes('mymemory.translated.net')) return;

  // Map tiles — cache first
  if (url.hostname.includes('tile.openstreetmap.org')) {
    e.respondWith(
      caches.match(e.request).then(cached => cached || fetch(e.request).then(res => {
        if (res && res.status === 200) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
        }
        return res;
      }).catch(() => new Response('', { status: 404 })))
    );
    return;
  }

  // Own-origin — network first, fall back to cache
  if (url.origin === self.location.origin) {
    e.respondWith(
      fetch(e.request)
        .then(res => {
          if (res.ok) caches.open(CACHE_NAME).then(c => c.put(e.request, res.clone()));
          return res;
        })
        .catch(() => caches.match(e.request).then(r => r || caches.match(OFFLINE_URL)))
    );
    return;
  }

  // External CDN — cache first
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(res => {
        if (res && res.ok && res.type !== 'opaque')
          caches.open(CACHE_NAME).then(c => c.put(e.request, res.clone()));
        return res;
      }).catch(() => new Response('', { status: 503 }));
    })
  );
});

self.addEventListener('message', e => {
  if (e.data === 'SKIP_WAITING') self.skipWaiting();
});

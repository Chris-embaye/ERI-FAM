'use strict';

const CACHE = 'erifam-v32';
const STATIC = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './manifest.json',
  './firebase-config.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

// These hosts must always bypass the SW — never intercept Firebase SDK or APIs
const BYPASS_HOSTS = [
  'gstatic.com',                      // Firebase SDK JS files live here
  'googleapis.com',                   // Firebase APIs (Firestore, Storage, Auth, etc.)
  'firebaseapp.com',
  'accounts.google.com',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c =>
        // allSettled so one slow/failed file doesn't abort the whole install
        Promise.allSettled(STATIC.map(url =>
          c.add(url).catch(err => console.warn('[SW] cache miss:', url, err))
        ))
      )
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;

  const url = new URL(e.request.url);

  // Let Firebase/Google traffic go straight to the network — no SW interception
  // (intercepting Firebase SDK JS files breaks them when they're not in cache)
  if (BYPASS_HOSTS.some(h => url.hostname.endsWith(h))) return;

  // Network-first for own-origin files so updates land immediately
  if (url.origin === self.location.origin) {
    e.respondWith(
      fetch(e.request)
        .then(res => {
          if (res.ok) {
            caches.open(CACHE).then(c => c.put(e.request, res.clone()));
          }
          return res;
        })
        .catch(() =>
          caches.match(e.request)
            .then(r => r || caches.match('./index.html'))
        )
    );
    return;
  }

  // Cache-first for other external CDN resources (HLS.js, fonts, etc.)
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(res => {
        if (res && res.ok && res.type !== 'opaque') {
          caches.open(CACHE).then(c => c.put(e.request, res.clone()));
        }
        return res;
      }).catch(() => caches.match('./index.html'));
    })
  );
});

self.addEventListener('message', e => {
  if (e.data === 'SKIP_WAITING') self.skipWaiting();
});

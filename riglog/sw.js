const CACHE = 'truck-log-v3';
const ASSETS = [
  './', './index.html', './styles.css', './manifest.json',
  './js/app.js', './js/store.js', './js/modal.js',
  './js/screens/dashboard.js', './js/screens/expenses.js',
  './js/screens/trips.js', './js/screens/fuel.js',
  './js/screens/more.js', './js/screens/dvir.js',
  './js/screens/detention.js', './js/screens/settings.js',
  './js/screens/signin.js', './js/auth.js', './js/screens/tax.js',
];

self.addEventListener('install', e => {
  // Cache assets THEN skip waiting so new SW activates immediately
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(res => {
        if (res.ok && e.request.method === 'GET' && !e.request.url.includes('firebaseapp') && !e.request.url.includes('googleapis')) {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return res;
      }).catch(() => cached || caches.match('./index.html'));
    })
  );
});

// Let app trigger skip-waiting on demand (used by update banner)
self.addEventListener('message', e => {
  if (e.data === 'SKIP_WAITING') self.skipWaiting();
});

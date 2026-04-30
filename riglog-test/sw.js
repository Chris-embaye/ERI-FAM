const CACHE = 'truck-log-test-v7';
const ASSETS = [
  './', './index.html', './styles.css', './manifest.json',
  './js/app.js', './js/store.js', './js/modal.js', './js/auth.js', './js/theme.js',
  './js/screens/role-select.js',
  './js/screens/dashboard.js', './js/screens/expenses.js',
  './js/screens/trips.js', './js/screens/fuel.js',
  './js/screens/more.js', './js/screens/dvir.js',
  './js/screens/detention.js', './js/screens/settings.js',
  './js/screens/signin.js', './js/screens/tax.js',
  './js/screens/maintenance.js', './js/screens/ifta.js',
  './js/screens/personal-dashboard.js', './js/screens/personal-trips.js',
  './js/screens/personal-fuel.js', './js/screens/personal-expenses.js',
  './js/screens/personal-more.js',
];

self.addEventListener('install', e => {
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
  if (e.request.method !== 'GET') return;

  const url = new URL(e.request.url);

  // Let Firebase / Google traffic go straight to network — no SW interference
  if (
    url.hostname.includes('googleapis.com') ||
    url.hostname.includes('firebaseapp.com') ||
    url.hostname.includes('firebase.com') ||
    url.hostname.includes('gstatic.com')
  ) return;

  // Network-first for app's own files so updates land immediately
  if (url.origin === self.location.origin) {
    e.respondWith(
      fetch(e.request)
        .then(res => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE).then(c => c.put(e.request, clone));
          }
          return res;
        })
        .catch(() => caches.match(e.request))
    );
    return;
  }

  // Cache-first for CDN resources (fonts, Tesseract, etc.)
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(res => {
        if (res.ok) caches.open(CACHE).then(c => c.put(e.request, res.clone()));
        return res;
      }).catch(() => caches.match('./index.html'));
    })
  );
});

self.addEventListener('message', e => {
  if (e.data === 'SKIP_WAITING') self.skipWaiting();
});

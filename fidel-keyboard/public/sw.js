const CACHE = 'fidel-v1';
const STATIC = [
  '/',
  '/index.html',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(STATIC)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Cache-first for static assets, network-first for everything else
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  const isStatic = url.pathname.match(/\.(js|css|woff2?|png|svg|ico)$/);

  if (isStatic) {
    e.respondWith(
      caches.match(e.request).then(cached => cached ?? fetch(e.request).then(res => {
        const clone = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, clone));
        return res;
      }))
    );
  } else {
    e.respondWith(
      fetch(e.request).catch(() => caches.match(e.request))
    );
  }
});

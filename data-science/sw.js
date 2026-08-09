const CACHE = 'dsqbanks-v7';
const URLS = [
  '/data-science/',
  '/data-science/index.html',
  '/data-science/manifest.json',
  '/data-science/css/style.css',
  '/data-science/css/test-style.css',
  '/data-science/questions-data.js',
  '/data-science/favicon.svg',
  '/data-science/images/icon-192.png',
  '/data-science/images/icon-512.png',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(URLS)));
});

self.addEventListener('message', e => {
  if (e.data?.action === 'skipWaiting') self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(ks =>
      Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const { request } = e;
  if (request.method !== 'GET') return;

  // HTML: network-first (always fresh), fallback to cache on offline
  if (request.mode === 'navigate' || request.headers.get('Accept')?.includes('text/html')) {
    e.respondWith(
      fetch(request)
        .then(res => {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(request, clone));
          return res;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // Static assets: cache-first, update cache in background
  e.respondWith(
    caches.match(request).then(cached => {
      const fetchAndCache = fetch(request)
        .then(res => {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(request, clone));
          return res;
        })
        .catch(() => null);
      return cached || fetchAndCache;
    })
  );
});

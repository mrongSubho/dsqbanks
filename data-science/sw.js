const CACHE = 'dsqbanks-v2';
const URLS = [
  '/data-science/',
  '/data-science/index.html',
  '/data-science/manifest.json',
  '/data-science/css/style.css',
  '/data-science/css/test-style.css',
  '/data-science/questions-data.js',
  '/data-science/questions.json',
  '/data-science/favicon.svg',
  '/data-science/images/icon-192.png',
  '/data-science/images/icon-512.png',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(URLS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(r => r || fetch(e.request))
  );
});

const CACHE_NAME = 'readium-v5';
const STATIC_ASSETS = [
  './', './index.html', './index.css', './manifest.json',
  './js/app.js', './js/db.js', './js/library.js', './js/reader.js',
  './js/transitions.js', './js/toc.js', './js/analytics.js', './js/settings.js',
  './icons/icon-192.png', './icons/icon-512.png',
];

const CDN_ASSETS = [
  'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.9.155/build/pdf.min.mjs',
  'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.9.155/build/pdf.worker.min.mjs',
  'https://cdn.jsdelivr.net/npm/localforage@1.10.0/dist/localforage.min.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return Promise.all([
        cache.addAll(STATIC_ASSETS),
        ...CDN_ASSETS.map((url) =>
          fetch(url, { mode: 'cors' }).then((r) => { if (r.ok) cache.put(url, r); }).catch(() => {})
        ),
      ]);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((c) => c.put(event.request, clone));
        }
        return response;
      }).catch(() => {
        if (event.request.mode === 'navigate') return caches.match('./index.html');
      });
    })
  );
});

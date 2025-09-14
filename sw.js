// sw.js - simple cache-first service worker
const CACHE_NAME = 'edgemetrics-cache-v1';
const CORE_ASSETS = [
  '/',
  '/index.html',
  '/dashboard.html',
  '/trades.html',
  '/pricing.html'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS).catch(()=>{}))
  );
});
self.addEventListener('activate', (e) => {
  e.waitUntil(self.clients.claim());
});
self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request).then((cached) => cached || fetch(e.request).then((resp) => {
      if(!resp || resp.status !== 200 || resp.type !== 'basic') return resp;
      const copy = resp.clone();
      caches.open(CACHE_NAME).then((cache)=> cache.put(e.request, copy));
      return resp;
    }).catch(()=> caches.match('/index.html')))
  );
});

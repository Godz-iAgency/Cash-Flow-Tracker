// Generated at build time. Only public installation assets enter this cache.
const CACHE = 'cash-flow-install-__VERSION__';
const PUBLIC_FILES = ['/offline.html', '/manifest.webmanifest', '/icons/icon-192.png', '/icons/icon-512.png', '/icons/apple-touch-icon.png', '/icons/favicon.png'];
const PUBLIC_PATHS = new Set(PUBLIC_FILES);

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(PUBLIC_FILES.map(url => new Request(url, { cache: 'reload' })))));
  // A new version waits. The app requests activation only after the user chooses Update.
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const name of await caches.keys()) if (name.startsWith('cash-flow-install-') && name !== CACHE) await caches.delete(name);
    await self.clients.claim();
  })());
});
self.addEventListener('message', event => {
  if (event.data?.type === 'ACTIVATE_UPDATE') self.skipWaiting();
});
self.addEventListener('fetch', event => {
  const request = event.request, url = new URL(request.url);
  // Never intercept authentication, financial reads, financial writes or another origin.
  if (request.method !== 'GET' || url.origin !== self.location.origin || url.pathname === '/api' || url.pathname.startsWith('/api/') || request.headers.has('Authorization')) return;
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(() => caches.open(CACHE).then(cache => cache.match('/offline.html'))));
    return;
  }
  if (!url.search && PUBLIC_PATHS.has(url.pathname)) event.respondWith(caches.open(CACHE).then(async cache => (await cache.match(request)) || fetch(request)));
});

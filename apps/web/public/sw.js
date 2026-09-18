const CACHE_VERSION = 'survey-guru-static-v2';
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => { event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('survey-guru-') && k !== CACHE_VERSION).map(k => caches.delete(k))))); self.clients.claim(); });
// Business requests and authenticated pages must never fall back to cached HTML.
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin || !(url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/brand/'))) return;
  event.respondWith(caches.open(CACHE_VERSION).then(async cache => {
    const cached = await cache.match(event.request); if (cached) return cached;
    const response = await fetch(event.request); if(response.ok) await cache.put(event.request,response.clone()); return response;
  }));
});

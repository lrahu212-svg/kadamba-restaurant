const CACHE_NAME = 'kadamba-cache-v2'; // Incremented to force mobile update
const ASSETS = [
  '/',
  '/static/style.css?v=2',
  '/static/script.js?v=2',
  '/static/logo1.png'
];

self.addEventListener('install', event => {
  self.skipWaiting(); // Force the new service worker to kick out the old one immediately
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(ASSETS);
    })
  );
});

self.addEventListener('activate', event => {
  // Clear out old caches completely
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.map(key => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
});

self.addEventListener('fetch', event => {
  if (event.request.url.includes('/place_order') || 
      event.request.url.includes('/get_orders') || 
      event.request.url.includes('/history') || 
      event.request.url.includes('/update_status') ||
      event.request.url.includes('/invoice')) {
    return event.respondWith(fetch(event.request));
  }
  event.respondWith(
    caches.match(event.request).then(response => {
      return response || fetch(event.request);
    })
  );
});
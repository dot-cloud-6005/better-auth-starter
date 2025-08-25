// Enhanced Service Worker with navigation offline caching
const CACHE_NAME = 'nav-map-cache-v1';
const NAVIGATION_CACHE = 'navigation-assets-v1';

// Resources to cache for offline nav-map functionality
const NAV_MAP_RESOURCES = [
  '/nav-map',
  '/api/navigation/assets',
  '/api/navigation/inspections'
];

// Install event - cache nav-map resources
self.addEventListener('install', event => {
  console.log('Service Worker: Installing and caching nav-map resources');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        return cache.addAll(['/nav-map']);
      })
      .then(() => self.skipWaiting())
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
  console.log('Service Worker: Activating');
  event.waitUntil(
    caches.keys()
      .then(cacheNames => {
        return Promise.all(
          cacheNames.map(cacheName => {
            if (cacheName !== CACHE_NAME && cacheName !== NAVIGATION_CACHE) {
              console.log('Service Worker: Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => self.clients.claim())
  );
});

// Fetch event - implement offline-first for navigation APIs
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Handle navigation API requests with cache-first strategy
  if (url.pathname.startsWith('/api/navigation/')) {
    event.respondWith(
      caches.match(request)
        .then(cachedResponse => {
          if (cachedResponse) {
            // Return cached response and update in background
            fetch(request)
              .then(networkResponse => {
                if (networkResponse.ok) {
                  const responseClone = networkResponse.clone();
                  caches.open(NAVIGATION_CACHE)
                    .then(cache => cache.put(request, responseClone));
                }
              })
              .catch(() => {
                // Network failed, cached response is still valid
                console.log('Service Worker: Network failed for', url.pathname, '- using cache');
              });
            return cachedResponse;
          }
          
          // No cache, try network
          return fetch(request)
            .then(networkResponse => {
              if (networkResponse.ok) {
                const responseClone = networkResponse.clone();
                caches.open(NAVIGATION_CACHE)
                  .then(cache => cache.put(request, responseClone));
              }
              return networkResponse;
            });
        })
    );
    return;
  }
  
  // Handle nav-map page with cache-first strategy  
  if (url.pathname === '/nav-map' || url.pathname.includes('/nav-map')) {
    event.respondWith(
      caches.match(request)
        .then(cachedResponse => {
          return cachedResponse || fetch(request)
            .then(networkResponse => {
              if (networkResponse.ok) {
                const responseClone = networkResponse.clone();
                caches.open(CACHE_NAME)
                  .then(cache => cache.put(request, responseClone));
              }
              return networkResponse;
            });
        })
    );
    return;
  }
  
  // Default: pass through all other requests
  event.respondWith(fetch(request));
});

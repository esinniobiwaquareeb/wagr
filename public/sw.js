// Service Worker for wagr PWA with enhanced caching and push notifications
const CACHE_NAME = 'wagr-v3';
const RUNTIME_CACHE = 'wagr-runtime-v3';
const IMAGE_CACHE = 'wagr-images-v3';
const API_CACHE = 'wagr-api-v3';

// Assets to cache on install
const PRECACHE_ASSETS = [
  '/',
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
];

// Cache duration constants (in milliseconds)
const CACHE_DURATIONS = {
  STATIC: 7 * 24 * 60 * 60 * 1000, // 7 days
  IMAGES: 30 * 24 * 60 * 60 * 1000, // 30 days
  API: 5 * 60 * 1000, // 5 minutes
  HTML: 60 * 60 * 1000, // 1 hour
};

// Install event - cache assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((cacheName) => {
            return ![CACHE_NAME, RUNTIME_CACHE, IMAGE_CACHE, API_CACHE].includes(cacheName);
          })
          .map((cacheName) => caches.delete(cacheName))
      );
    }).then(() => self.clients.claim())
  );
});

// Helper to check if response is stale
function isStale(response, maxAge) {
  const dateHeader = response.headers.get('date');
  if (!dateHeader) return true;
  const age = Date.now() - new Date(dateHeader).getTime();
  return age > maxAge;
}

// Fetch event - serve from cache with stale-while-revalidate
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Skip cross-origin requests
  if (!url.origin.startsWith(self.location.origin)) {
    return;
  }

  // Skip Supabase realtime connections
  if (url.pathname.includes('/realtime') || url.pathname.includes('/rest/v1/')) {
    return;
  }

  event.respondWith(
    (async () => {
      // Determine cache strategy based on request type
      const isImage = request.destination === 'image' || url.pathname.match(/\.(jpg|jpeg|png|gif|webp|svg|ico)$/i);
      const isAPI = url.pathname.startsWith('/api/');
      const isHTML = request.destination === 'document' || request.headers.get('accept')?.includes('text/html');

      let cacheToUse = RUNTIME_CACHE;
      let maxAge = CACHE_DURATIONS.API;

      if (isImage) {
        cacheToUse = IMAGE_CACHE;
        maxAge = CACHE_DURATIONS.IMAGES;
      } else if (isAPI) {
        cacheToUse = API_CACHE;
        maxAge = CACHE_DURATIONS.API;
      } else if (isHTML) {
        maxAge = CACHE_DURATIONS.HTML;
      }

      // Try to get from cache
      const cache = await caches.open(cacheToUse);
      const cachedResponse = await cache.match(request);

      if (cachedResponse) {
        // Check if cached response is stale
        if (!isStale(cachedResponse, maxAge)) {
          // Fresh cache, return immediately
          return cachedResponse;
        } else {
          // Stale cache, use stale-while-revalidate
          // Return cached response immediately
          // Fetch fresh data in background
          fetch(request)
            .then((response) => {
              if (response.status === 200) {
                cache.put(request, response.clone());
              }
            })
            .catch(() => {
              // Network failed, keep using stale cache
            });
          return cachedResponse;
        }
      }

      // No cache, fetch from network
      try {
        const response = await fetch(request);
        
        // Cache successful responses
        if (response.status === 200) {
          // Clone response before caching (responses can only be read once)
          const responseToCache = response.clone();
          cache.put(request, responseToCache);
        }
        
        return response;
      } catch (error) {
        // Network failed
        // For HTML requests, try to return offline page
        if (isHTML) {
          const offlinePage = await cache.match('/');
          if (offlinePage) {
            return offlinePage;
          }
        }
        throw error;
      }
    })()
  );
});

// Push notification event handler
self.addEventListener('push', (event) => {
  let notificationData = {
    title: 'wagr',
    body: 'You have a new notification',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-96x96.png',
    data: {},
  };

  if (event.data) {
    try {
      const data = event.data.json();
      notificationData = {
        title: data.title || notificationData.title,
        body: data.body || notificationData.body,
        icon: data.icon || notificationData.icon,
        badge: data.badge || notificationData.badge,
        image: data.image,
        data: data.data || {},
        tag: data.tag,
        requireInteraction: data.requireInteraction || false,
        actions: data.actions,
      };
    } catch (e) {
      notificationData.body = event.data.text();
    }
  }

  event.waitUntil(
    self.registration.showNotification(notificationData.title, {
      body: notificationData.body,
      icon: notificationData.icon,
      badge: notificationData.badge,
      image: notificationData.image,
      data: notificationData.data,
      tag: notificationData.tag,
      requireInteraction: notificationData.requireInteraction,
      actions: notificationData.actions,
      vibrate: [200, 100, 200],
      timestamp: Date.now(),
    })
  );
});

// Notification click event handler
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const data = event.notification.data;
  const urlToOpen = data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Check if there's already a window/tab open with the target URL
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i];
        if (client.url === urlToOpen && 'focus' in client) {
          return client.focus();
        }
      }
      // If not, open a new window/tab
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});

// Handle notification action clicks
self.addEventListener('notificationclose', (event) => {
  // Track notification dismissal if needed
  console.log('Notification closed:', event.notification.tag);
});

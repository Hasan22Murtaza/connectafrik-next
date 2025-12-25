// Enhanced Service Worker for ConnectAfrik PWA
// Version 3.0 - Optimized for social network features

const CACHE_VERSION = 'connectafrik-v3';
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const DYNAMIC_CACHE = `${CACHE_VERSION}-dynamic`;
const IMAGE_CACHE = `${CACHE_VERSION}-images`;

// Static assets to cache immediately
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/assets/images/logo_2.png',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png'
];

// Cache size limits
const MAX_DYNAMIC_CACHE_SIZE = 50;
const MAX_IMAGE_CACHE_SIZE = 100;

// Helper: Limit cache size
const limitCacheSize = (cacheName, maxItems) => {
  caches.open(cacheName).then(cache => {
    cache.keys().then(keys => {
      if (keys.length > maxItems) {
        cache.delete(keys[0]).then(() => limitCacheSize(cacheName, maxItems));
      }
    });
  });
};

// Install event - cache static assets
self.addEventListener('install', event => {
  console.log('[SW] Installing service worker...');
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => {
        console.log('[SW] Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .catch(err => console.error('[SW] Failed to cache static assets:', err))
  );
  self.skipWaiting(); // Activate immediately
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
  console.log('[SW] Activating service worker...');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames
          .filter(cacheName => cacheName.startsWith('connectafrik-') && cacheName !== STATIC_CACHE && cacheName !== DYNAMIC_CACHE && cacheName !== IMAGE_CACHE)
          .map(cacheName => {
            console.log('[SW] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          })
      );
    })
  );
  self.clients.claim(); // Take control immediately
});

// Fetch event - smart caching strategies
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle GET requests over http/https (avoids chrome-extension and POST/PUT caching errors)
  if (request.method !== 'GET') {
    return;
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return;
  }

  // 1. Skip caching for Supabase API (always fetch fresh)
  if (url.hostname.includes('supabase.co')) {
    return; // Let it pass through to network
  }

  // 2. Skip caching for Stripe (payment security)
  if (url.hostname.includes('stripe.com') || url.hostname.includes('stripe.network')) {
    return;
  }

  // 3. Skip caching for Paystack (payment security)
  if (url.hostname.includes('paystack.co')) {
    return;
  }

  // 4. Skip caching for VideoSDK (real-time media)
  if (url.hostname.includes('videosdk.live')) {
    return;
  }

  // 5. Skip caching for WebSocket connections
  if (url.protocol === 'ws:' || url.protocol === 'wss:') {
    return;
  }

  // 6. Images - Cache-first strategy
  if (request.destination === 'image') {
    event.respondWith(
      caches.match(request).then(cachedResponse => {
        return cachedResponse || fetch(request).then(fetchResponse => {
          return caches.open(IMAGE_CACHE).then(cache => {
            cache.put(request, fetchResponse.clone());
            limitCacheSize(IMAGE_CACHE, MAX_IMAGE_CACHE_SIZE);
            return fetchResponse;
          });
        });
      }).catch(() => {
        // Return placeholder image if offline
        return new Response('<svg width="200" height="200"><rect fill="#ddd" width="200" height="200"/><text x="50%" y="50%" text-anchor="middle" fill="#999">Offline</text></svg>', {
          headers: { 'Content-Type': 'image/svg+xml' }
        });
      })
    );
    return;
  }

  // 7. Static assets (JS, CSS, fonts) - Cache-first
  if (request.destination === 'script' || request.destination === 'style' || request.destination === 'font') {
    event.respondWith(
      caches.match(request).then(cachedResponse => {
        return cachedResponse || fetch(request).then(fetchResponse => {
          return caches.open(STATIC_CACHE).then(cache => {
            cache.put(request, fetchResponse.clone());
            return fetchResponse;
          });
        });
      })
    );
    return;
  }

  // 8. HTML pages - Network-first, fallback to cache
  if (request.destination === 'document' || request.headers.get('accept').includes('text/html')) {
    event.respondWith(
      fetch(request)
        .then(fetchResponse => {
          // Clone and cache the response
          const responseClone = fetchResponse.clone();
          caches.open(DYNAMIC_CACHE).then(cache => {
            cache.put(request, responseClone);
            limitCacheSize(DYNAMIC_CACHE, MAX_DYNAMIC_CACHE_SIZE);
          });
          return fetchResponse;
        })
        .catch(() => {
          // If network fails, try cache
          return caches.match(request).then(cachedResponse => {
            return cachedResponse || caches.match('/').then(offlinePage => {
              return offlinePage || new Response(
                '<html><body><h1>Offline</h1><p>You are offline. Please check your internet connection.</p></body></html>',
                { headers: { 'Content-Type': 'text/html' } }
              );
            });
          });
        })
    );
    return;
  }

  // 9. All other requests - Network-first
  event.respondWith(
    fetch(request)
      .then(fetchResponse => {
        return caches.open(DYNAMIC_CACHE).then(cache => {
          cache.put(request, fetchResponse.clone());
          limitCacheSize(DYNAMIC_CACHE, MAX_DYNAMIC_CACHE_SIZE);
          return fetchResponse;
        });
      })
      .catch(() => caches.match(request))
  );
});

// Background sync for offline actions
self.addEventListener('sync', event => {
  console.log('[SW] Background sync:', event.tag);

  if (event.tag === 'sync-posts') {
    event.waitUntil(syncPosts());
  }

  if (event.tag === 'sync-messages') {
    event.waitUntil(syncMessages());
  }
});

// Push notifications
self.addEventListener('push', event => {
  console.log('[SW] Push notification received');

  const data = event.data ? event.data.json() : {};
  const title = data.title || 'ConnectAfrik';
  const options = {
    body: data.body || 'You have a new notification',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-96x96.png',
    data: data.url || '/',
    actions: [
      {
        action: 'open',
        title: 'Open'
      },
      {
        action: 'close',
        title: 'Close'
      }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// Notification click
self.addEventListener('notificationclick', event => {
  console.log('[SW] Notification clicked:', event.action);

  event.notification.close();

  if (event.action === 'open' || !event.action) {
    const urlToOpen = event.notification.data || '/';
    event.waitUntil(
      clients.matchAll({ type: 'window', includeUncontrolled: true })
        .then(windowClients => {
          // Check if there's already a window open
          for (let client of windowClients) {
            if (client.url === urlToOpen && 'focus' in client) {
              return client.focus();
            }
          }
          // Open new window if none exists
          if (clients.openWindow) {
            return clients.openWindow(urlToOpen);
          }
        })
    );
  }
});

// Message handler (for communication with main app)
self.addEventListener('message', event => {
  console.log('[SW] Message received:', event.data);

  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (event.data && event.data.type === 'CLEAR_CACHE') {
    event.waitUntil(
      caches.keys().then(cacheNames => {
        return Promise.all(
          cacheNames.map(cacheName => caches.delete(cacheName))
        );
      })
    );
  }
});

// Helper functions for background sync
async function syncPosts() {
  // Implement post synchronization logic
  console.log('[SW] Syncing posts...');
}

async function syncMessages() {
  // Implement message synchronization logic
  console.log('[SW] Syncing messages...');
}

console.log('[SW] Service worker loaded successfully');

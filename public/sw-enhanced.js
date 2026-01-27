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

// Push notifications - FCM format
self.addEventListener('push', event => {
  console.log('[SW] FCM Push notification received');

  let notificationTitle = 'ConnectAfrik';
  let notificationBody = 'You have a new notification';
  let notificationIcon = '/icons/icon-192x192.png';
  let notificationBadge = '/icons/icon-96x96.png';
  let notificationImage = null;
  let notificationTag = 'connectafrik-notification';
  let notificationData = {};
  let notificationActions = [];
  let requireInteraction = false;
  let silent = false;
  let vibrate = [200, 100, 200];

  if (event.data) {
    try {
      const payload = event.data.json();
      console.log('[SW] FCM Push payload:', payload);
      
      // FCM sends data in notification and data fields
      if (payload.notification) {
        notificationTitle = payload.notification.title || notificationTitle;
        notificationBody = payload.notification.body || notificationBody;
        notificationImage = payload.notification.image || notificationImage;
      }
      
      // Extract custom data from FCM data field
      if (payload.data) {
        notificationData = payload.data;
        
        // Parse stringified data fields
        if (payload.data.icon) notificationIcon = payload.data.icon;
        if (payload.data.badge) notificationBadge = payload.data.badge;
        if (payload.data.tag) notificationTag = payload.data.tag;
        if (payload.data.requireInteraction) requireInteraction = payload.data.requireInteraction === 'true';
        if (payload.data.silent) silent = payload.data.silent === 'true';
        if (payload.data.vibrate) {
          try {
            vibrate = JSON.parse(payload.data.vibrate);
          } catch (e) {
            vibrate = [200, 100, 200];
          }
        }
        if (payload.data.actions) {
          try {
            notificationActions = JSON.parse(payload.data.actions);
          } catch (e) {
            notificationActions = [];
          }
        }
        
        // Merge any additional data fields
        Object.keys(payload.data).forEach(key => {
          if (!['icon', 'badge', 'tag', 'requireInteraction', 'silent', 'vibrate', 'actions'].includes(key)) {
            notificationData[key] = payload.data[key];
          }
        });
      }
      
      // Check if this is a call notification by looking for call-related data
      // Call notifications will have room_id, thread_id, or call_type in the data
      const isCallNotification = notificationData.room_id || 
                                 notificationData.thread_id || 
                                 notificationData.call_type ||
                                 notificationTag?.includes('call') ||
                                 notificationTitle?.includes('Call') ||
                                 notificationTitle?.includes('📞');

      if (isCallNotification) {
        // Handle incoming call notification
        const callType = notificationData.call_type || 'audio';
        const roomId = notificationData.room_id;
        const threadId = notificationData.thread_id;
        const callerName = notificationData.caller_name || notificationBody?.split(' ')[0] || 'Someone';
        const recipientName = notificationData.recipient_name || notificationData.recipientName || '';
        const callerId = notificationData.caller_id || notificationData.callerId || '';
        const isIncoming = notificationData.is_incoming !== undefined 
          ? String(notificationData.is_incoming) 
          : (notificationData.isIncoming !== undefined ? String(notificationData.isIncoming) : 'true');
        
        // Build call URL with query parameters
        const buildCallUrl = (roomId) => {
          if (!roomId) return '/chat';
          const params = new URLSearchParams({
            call: 'true',
            type: callType,
            threadId: threadId || '',
            callerName: callerName || '',
            recipientName: recipientName || '',
            isIncoming: isIncoming,
            callerId: callerId || ''
          });
          return `/call/${roomId}?${params.toString()}`;
        };
        
        const callUrl = buildCallUrl(roomId);
        
        const title = notificationTitle || `📞 Incoming ${callType === 'video' ? 'Video' : 'Audio'} Call`;
        const options = {
          body: notificationBody || `${callerName} is calling you...`,
          icon: notificationIcon,
          badge: notificationBadge,
          image: notificationImage,
          tag: `incoming-call-${threadId || roomId || Date.now()}`, // Unique tag to replace previous notifications
          data: {
            type: 'incoming_call',
            room_id: roomId,
            thread_id: threadId,
            token: notificationData.token,
            caller_id: callerId,
            call_type: callType,
            caller_name: callerName,
            recipient_name: recipientName,
            is_incoming: isIncoming,
            url: callUrl
          },
          actions: [
            {
              action: 'answer',
              title: 'Answer',
              icon: '/icons/phone.png'
            },
            {
              action: 'decline',
              title: 'Decline',
              icon: '/icons/dismiss.png'
            }
          ],
          requireInteraction: true, // Keep notification visible until user interacts
          silent: false, // Make sure it makes sound
          vibrate: [200, 100, 200, 100, 200, 100, 200], // Longer vibration pattern for calls
          timestamp: Date.now()
        };

        event.waitUntil(
          self.registration.showNotification(title, options)
        );

    // Try to wake up the app by sending a message to all clients
    event.waitUntil(
      clients.matchAll({ type: 'window', includeUncontrolled: true })
        .then(clientList => {
          for (const client of clientList) {
            client.postMessage({
              type: 'INCOMING_CALL',
              data: {
                roomId: roomId,
                threadId: threadId,
                token: notificationData.token,
                callerId: notificationData.caller_id,
                callType: callType,
                callerName: callerName
              }
            });
          }
        })
    );
      } else {
        // Regular notification handling
        const options = {
          body: notificationBody,
          icon: notificationIcon,
          badge: notificationBadge,
          image: notificationImage,
          tag: notificationTag,
          data: notificationData.url || notificationData.url || '/',
          actions: notificationActions.length > 0 ? notificationActions : [
            {
              action: 'open',
              title: 'Open'
            },
            {
              action: 'close',
              title: 'Close'
            }
          ],
          requireInteraction: requireInteraction,
          silent: silent,
          vibrate: vibrate,
          timestamp: Date.now()
        };

        event.waitUntil(
          self.registration.showNotification(notificationTitle, options)
        );
      }
    } catch (error) {
      console.error('[SW] Error parsing FCM push notification:', error);
      // Fallback notification
      event.waitUntil(
        self.registration.showNotification('ConnectAfrik', {
          body: 'You have a new notification',
          icon: '/icons/icon-192x192.png',
          badge: '/icons/icon-96x96.png',
          tag: 'connectafrik-notification'
        })
      );
    }
  } else {
    // No data, show default notification
    event.waitUntil(
      self.registration.showNotification('ConnectAfrik', {
        body: 'You have a new notification',
        icon: '/icons/icon-192x192.png',
        badge: '/icons/icon-96x96.png',
        tag: 'connectafrik-notification'
      })
    );
  }
});

// Notification click
self.addEventListener('notificationclick', event => {
  console.log('[SW] Notification clicked:', event.action);

  const notificationData = event.notification.data || {};
  const isIncomingCall = notificationData.type === 'incoming_call' || 
                         notificationData.room_id ||
                         notificationData.call_type;

  event.notification.close();

  // Handle incoming call notification actions
  if (isIncomingCall) {
    if (event.action === 'answer' || !event.action) {
      // Build call URL with query parameters
      const buildCallUrl = () => {
        if (!notificationData.room_id) return '/chat';
        const params = new URLSearchParams({
          call: 'true',
          type: notificationData.call_type || 'audio',
          threadId: notificationData.thread_id || '',
          callerName: notificationData.caller_name || '',
          recipientName: notificationData.recipient_name || '',
          isIncoming: notificationData.is_incoming !== undefined 
            ? String(notificationData.is_incoming) 
            : (notificationData.isIncoming !== undefined ? String(notificationData.isIncoming) : 'true'),
          callerId: notificationData.caller_id || ''
        });
        return `/call/${notificationData.room_id}?${params.toString()}`;
      };
      
      const callUrl = notificationData.url || buildCallUrl();
      
      event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true })
          .then(windowClients => {
            // Check if there's already a window open
            for (let client of windowClients) {
              if (client.url.includes(self.location.origin) && 'focus' in client) {
                // Send message to client to handle the call
                client.postMessage({
                  type: 'ANSWER_CALL',
                  data: {
                    roomId: notificationData.room_id,
                    threadId: notificationData.thread_id,
                    token: notificationData.token,
                    callerId: notificationData.caller_id,
                    callType: notificationData.call_type,
                    callerName: notificationData.caller_name
                  }
                });
                return client.focus().then(() => {
                  // Navigate to call page if possible
                  if ('navigate' in client && notificationData.room_id) {
                    return client.navigate(callUrl);
                  }
                  return Promise.resolve();
                });
              }
            }
            // Open new window if none exists
            if (clients.openWindow && notificationData.room_id) {
              return clients.openWindow(callUrl);
            }
          })
      );
    } else if (event.action === 'decline') {
      // Send decline message to any open clients
      event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true })
          .then(windowClients => {
            for (let client of windowClients) {
              client.postMessage({
                type: 'DECLINE_CALL',
                data: {
                  roomId: notificationData.room_id,
                  threadId: notificationData.thread_id,
                  callerId: notificationData.caller_id
                }
              });
            }
          })
      );
    }
  } else {
    // Regular notification handling
    if (event.action === 'open' || !event.action) {
      const urlToOpen = typeof notificationData === 'string' 
        ? notificationData 
        : (notificationData.url || event.notification.data || '/');
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

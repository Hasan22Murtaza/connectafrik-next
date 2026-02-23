// ConnectAfrik Service Worker
// Handles push notifications from Firebase Cloud Messaging (FCM)
//
// NOTE: Firebase SDK is NOT needed in the service worker because the app sends
// data-only FCM messages. The browser's Push API delivers them directly to
// the 'push' event handler below. Firebase config lives in .env and is used
// only by the client-side code (fcmClient.ts).

// Handle push events directly for full control over notification display
self.addEventListener('push', (event) => {
  if (!event.data) return;

  let data;
  try {
    data = event.data.json();
  } catch (e) {
    console.error('[SW] Failed to parse push data:', e);
    return;
  }

  // FCM wraps payload in data field
  const notificationData = data.data || data.notification || data;

  const title = notificationData.title || 'ConnectAfrik';
  const body = notificationData.body || '';
  const type = notificationData.type || '';
  const tag = notificationData.tag || 'connectafrik-notification';
  const image = notificationData.image || '';
  const icon = notificationData.icon || '/assets/images/logo.png';
  const badge = notificationData.badge || '/assets/images/logo.png';
  const requireInteraction = notificationData.requireInteraction === 'true' || notificationData.requireInteraction === true;
  const silent = notificationData.silent === 'true' || notificationData.silent === true;

  // Parse vibrate pattern
  let vibrate = [200, 100, 200];
  try {
    if (typeof notificationData.vibrate === 'string') {
      vibrate = JSON.parse(notificationData.vibrate);
    } else if (Array.isArray(notificationData.vibrate)) {
      vibrate = notificationData.vibrate;
    }
  } catch (e) {
    // Use default
  }

  // Parse actions from data
  let actions = [];
  try {
    if (typeof notificationData.actions === 'string') {
      actions = JSON.parse(notificationData.actions);
    } else if (Array.isArray(notificationData.actions)) {
      actions = notificationData.actions;
    }
  } catch (e) {
    // Use defaults based on type
  }

  // Customize notification based on type
  if (type === 'incoming_call') {
    // Incoming call: show Accept and Decline actions (no large image)
    actions = [
      { action: 'answer', title: 'Accept' },
      { action: 'decline', title: 'Decline' }
    ];
  } else if (type === 'missed_call') {
    // Missed call: NO action buttons — just a clean static notification
    actions = [];
  }

  const options = {
    body,
    icon,
    badge,
    tag, // Same tag replaces existing notification
    data: notificationData, // Pass all data for click handling
    actions,
    requireInteraction: type === 'incoming_call' ? true : (requireInteraction && type !== 'missed_call'),
    silent: type === 'missed_call' ? true : silent,
    vibrate: type === 'missed_call' ? undefined : vibrate,
    renotify: true, // Vibrate/sound even when replacing same-tag notification
  };

  // No large image on any notification — keep it clean
  // (icon and badge are enough for branding)

  // Remove undefined values
  if (!options.vibrate) delete options.vibrate;

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// Handle notification click events
self.addEventListener('notificationclick', (event) => {
  const notification = event.notification;
  const data = notification.data || {};
  const action = event.action;

  notification.close();

  if (action === 'answer' && data.type === 'incoming_call') {
    // Open call window
    const roomId = data.room_id;
    const callType = data.call_type || 'audio';
    const threadId = data.thread_id || '';
    const callerName = data.caller_name || 'Unknown';
    const url = data.url || `/call/${roomId}`;
    
    const callUrl = `${self.location.origin}${url}?call=true&type=${callType}&threadId=${threadId}&callerName=${encodeURIComponent(callerName)}&isIncoming=true&callerId=${data.caller_id || ''}`;
    
    event.waitUntil(
      clients.openWindow(callUrl)
    );
  } else if (action === 'decline' && data.type === 'incoming_call') {
    // Just close the notification — the call timeout will handle cleanup
    // Nothing else needed
  } else if (data.type === 'missed_call') {
    // Open chat thread for missed call
    const threadId = data.thread_id;
    const url = threadId ? `/chat?thread=${threadId}` : '/feed';
    event.waitUntil(
      clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async (clientList) => {
        // Try to focus an existing app window and navigate it
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            await client.focus();
            client.navigate(`${self.location.origin}${url}`);
            return;
          }
        }
        // No existing window — open a new one
        return clients.openWindow(`${self.location.origin}${url}`);
      })
    );
  } else {
    // Default: open the URL from data or go to feed
    const url = data.url || '/feed';
    event.waitUntil(
      clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async (clientList) => {
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            await client.focus();
            client.navigate(`${self.location.origin}${url}`);
            return;
          }
        }
        return clients.openWindow(`${self.location.origin}${url}`);
      })
    );
  }
});

// Handle notification close (user dismissed)
self.addEventListener('notificationclose', (event) => {
  console.log('[SW] Notification closed:', event.notification.tag);
});

// Service worker install
self.addEventListener('install', (event) => {
  console.log('[SW] Service worker installed');
  self.skipWaiting();
});

// Service worker activate
self.addEventListener('activate', (event) => {
  console.log('[SW] Service worker activated');
  event.waitUntil(clients.claim());
});

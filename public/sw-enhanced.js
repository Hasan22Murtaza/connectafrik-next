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
  const parseOptionalNumber = (value) => {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim() !== '') {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
    return null;
  };

  const nowMs = Date.now();
  const sentAtRaw = notificationData.sent_at;
  const sentAtMs =
    typeof sentAtRaw === 'string' && sentAtRaw
      ? Date.parse(sentAtRaw)
      : parseOptionalNumber(sentAtRaw);
  const staleAfterMs = parseOptionalNumber(notificationData.stale_after_ms) ?? 120000;

  const isRingingType = (t) => t === 'ringing';
  const isMissedType = (t) => t === 'missed';
  const isEndedType = (t) => t === 'ended';

  // Prevent delayed call-ended pushes from showing long after the call is over.
  if (isEndedType(type) && Number.isFinite(sentAtMs) && nowMs - sentAtMs > staleAfterMs) {
    console.log('[SW] Skipping stale call-ended notification');
    return;
  }

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

  // Customize notification based on type (call_sessions.status + legacy payloads)
  if (isRingingType(type)) {
    // Incoming call: show Accept and Decline actions (no large image)
    actions = [
      { action: 'answer', title: 'Accept' },
      { action: 'decline', title: 'Decline' }
    ];
  } else if (isMissedType(type)) {
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
    requireInteraction: isRingingType(type) ? true : (requireInteraction && !isMissedType(type)),
    silent: isMissedType(type) ? true : silent,
    vibrate: isMissedType(type) ? undefined : vibrate,
    renotify: true, // Vibrate/sound even when replacing same-tag notification
  };

  // No large image on any notification — keep it clean
  // (icon and badge are enough for branding)

  // Remove undefined values
  if (!options.vibrate) delete options.vibrate;
  const autoCloseMs = parseOptionalNumber(notificationData.auto_close_ms);

  event.waitUntil(
    (async () => {
      await self.registration.showNotification(title, options);

      // Auto-dismiss short-lived call-ended notifications to reduce stale stacks.
      if (isEndedType(type) && autoCloseMs && autoCloseMs > 0) {
        setTimeout(async () => {
          try {
            const notifications = await self.registration.getNotifications({ tag });
            notifications.forEach((n) => {
              const notificationType = n?.data?.type;
              if (isEndedType(notificationType)) n.close();
            });
          } catch (error) {
            console.error('[SW] Failed to auto-close call-ended notification:', error);
          }
        }, autoCloseMs);
      }
    })()
  );
});

// Handle notification click events
self.addEventListener('notificationclick', (event) => {
  const notification = event.notification;
  const data = notification.data || {};
  const action = event.action;

  notification.close();

  if (action === 'answer' && data.type === 'ringing') {
    // Open call window
    const roomId = data.room_id;
    const callType = data.call_type || 'audio';
    const threadId = data.thread_id || '';
    const callerName = data.caller_name || 'Unknown';
    const callerAvatarUrl = data.caller_avatar_url || '';
    const url = data.url || `/call/${roomId}`;
    
    const callId = data.call_id || data.callId || '';
    const groupParam = data.is_group_call === true || data.isGroupCall === true ? '&isGroupCall=true' : '';
    const callUrl = `${self.location.origin}${url}?call=true&type=${callType}&threadId=${threadId}&callerName=${encodeURIComponent(callerName)}&recipientName=${encodeURIComponent('You')}&isIncoming=true&callerId=${data.caller_id || ''}${callerAvatarUrl ? `&callerAvatarUrl=${encodeURIComponent(callerAvatarUrl)}` : ''}${callId ? `&callId=${encodeURIComponent(callId)}` : ''}${groupParam}`;
    
    event.waitUntil(
      clients.openWindow(callUrl)
    );
  } else if (action === 'decline' && data.type === 'ringing') {
    // Just close the notification — the call timeout will handle cleanup
    // Nothing else needed
  } else if (data.type === 'missed') {
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

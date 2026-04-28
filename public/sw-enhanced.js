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
  const typeNorm = String(
    notificationData.type || notificationData.status || notificationData.call_status || ''
  )
    .trim()
    .toLowerCase();
  const lastSignal = String(notificationData.last_signal || '')
    .trim()
    .toLowerCase();
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
  const isActiveType = (t) => t === 'active' || lastSignal === 'active';
  const isDeclinedType = (t) => t === 'declined' || lastSignal === 'declined';

  // Prevent delayed call-ended pushes from showing long after the call is over.
  if (isEndedType(typeNorm) && Number.isFinite(sentAtMs) && nowMs - sentAtMs > staleAfterMs) {
    console.log('[SW] Skipping stale call-ended notification');
    return;
  }

  // Cross-device call accepted signal: close ringing UI/notifications, don't show a new toast.
  if (isActiveType(typeNorm)) {
    const threadId = String(notificationData.thread_id || notificationData.threadId || notificationData.chat_thread_id || '').trim();
    const callId = String(notificationData.call_id || notificationData.callId || '').trim();
    event.waitUntil(
      (async () => {
        try {
          const ringingTag = threadId ? `incoming-call-${threadId}` : null;
          const notifications = await self.registration.getNotifications();
          notifications.forEach((n) => {
            const d = n.data || {};
            const nType = String(d.type || '').trim().toLowerCase();
            if (nType !== 'ringing') return;
            const nThread = String(d.thread_id || d.threadId || d.chat_thread_id || '').trim();
            const nCall = String(d.call_id || d.callId || '').trim();
            const sameThread = threadId && nThread === threadId;
            const sameCall = callId && nCall === callId;
            const sameTag = ringingTag && n.tag === ringingTag;
            if (sameThread || sameCall || sameTag) {
              n.close();
            }
          });
        } catch (error) {
          console.error('[SW] Failed to close ringing notifications on active:', error);
        }

        try {
          const clientList = await clients.matchAll({ type: 'window', includeUncontrolled: true });
          clientList.forEach((client) => {
            client.postMessage({
              type: 'CALL_STATUS',
              status: 'active',
              ...(threadId ? { threadId } : {}),
              ...(callId ? { callId } : {}),
            });
          });
        } catch (error) {
          console.error('[SW] Failed to broadcast active call status:', error);
        }
      })()
    );
    return;
  }

  // Callee declined: notify caller, dismiss ringing (edge cases), sync open tabs.
  if (isDeclinedType(typeNorm)) {
    const threadId = String(notificationData.thread_id || notificationData.threadId || notificationData.chat_thread_id || '').trim();
    const callId = String(notificationData.call_id || notificationData.callId || '').trim();
    event.waitUntil(
      (async () => {
        try {
          const ringingTag = threadId ? `incoming-call-${threadId}` : null;
          const notifications = await self.registration.getNotifications();
          notifications.forEach((n) => {
            const d = n.data || {};
            const nType = String(d.type || '').trim().toLowerCase();
            if (nType !== 'ringing') return;
            const nThread = String(d.thread_id || d.threadId || d.chat_thread_id || '').trim();
            const nCall = String(d.call_id || d.callId || '').trim();
            const sameThread = threadId && nThread === threadId;
            const sameCall = callId && nCall === callId;
            const sameTag = ringingTag && n.tag === ringingTag;
            if (sameThread || sameCall || sameTag) {
              n.close();
            }
          });
        } catch (error) {
          console.error('[SW] Failed to close ringing notifications on declined:', error);
        }

        try {
          const clientList = await clients.matchAll({ type: 'window', includeUncontrolled: true });
          clientList.forEach((client) => {
            client.postMessage({
              type: 'CALL_STATUS',
              status: 'ended',
              ...(threadId ? { threadId } : {}),
              ...(callId ? { callId } : {}),
            });
          });
        } catch (error) {
          console.error('[SW] Failed to broadcast declined call status:', error);
        }

        try {
          const declineTag =
            tag && String(tag).startsWith('call-status-')
              ? tag
              : threadId
                ? `call-status-declined-${threadId}`
                : 'connectafrik-notification';
          await self.registration.showNotification(title, {
            body,
            icon,
            badge,
            tag: declineTag,
            data: notificationData,
            actions: [],
            requireInteraction: false,
            silent,
          });
        } catch (error) {
          console.error('[SW] Failed to show declined notification:', error);
        }
      })()
    );
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
  if (isRingingType(typeNorm)) {
    // Incoming call: show Accept and Decline actions (no large image)
    actions = [
      { action: 'answer', title: 'Accept' },
      { action: 'decline', title: 'Decline' }
    ];
  } else if (isMissedType(typeNorm)) {
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
    requireInteraction: isRingingType(typeNorm) ? true : (requireInteraction && !isMissedType(typeNorm)),
    silent: isMissedType(typeNorm) ? true : silent,
    vibrate: isMissedType(typeNorm) ? undefined : vibrate,
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
      if (isEndedType(typeNorm) && autoCloseMs && autoCloseMs > 0) {
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
    // Open call window (names/avatars load from call-sessions API)
    const roomId = data.room_id;
    const callType = data.call_type || 'audio';
    const threadId = data.thread_id || '';
    const url = data.url || `/call/${roomId}`;

    const callId = data.call_id || data.callId || '';
    const groupParam = data.is_group_call === true || data.isGroupCall === true ? '&isGroupCall=true' : '';
    const callUrl = `${self.location.origin}${url}?call=true&type=${callType}&threadId=${encodeURIComponent(threadId)}&isIncoming=true&callerId=${encodeURIComponent(data.caller_id || '')}${callId ? `&callId=${encodeURIComponent(callId)}` : ''}${groupParam}`;

    event.waitUntil(
      clients.openWindow(callUrl)
    );
  } else if (action === 'decline' && data.type === 'ringing') {
    // Just close the notification — the call timeout will handle cleanup
    // Nothing else needed
  } else if (
    data.type === 'missed' ||
    String(data.type || '').trim().toLowerCase() === 'declined'
  ) {
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

// Service Worker for ConnectAfrik Push Notifications
const CACHE_NAME = 'connectafrik-v1';
const NOTIFICATION_ICON = '/assets/images/logo_2.png'; // Your app logo
const NOTIFICATION_BADGE = '/assets/icons/icon-96x96.png'; // Your app logo

// Install event
self.addEventListener('install', (event) => {
  console.log('Service Worker installing...');
  self.skipWaiting();
});

// Activate event
self.addEventListener('activate', (event) => {
  console.log('Service Worker activating...');
  event.waitUntil(self.clients.claim());
});

// Push event - handle incoming FCM push notifications
self.addEventListener('push', (event) => {
  console.log('FCM Push notification received:', event);
  
  let notificationTitle = 'ConnectAfrik';
  let notificationBody = 'You have a new notification';
  let notificationIcon = NOTIFICATION_ICON;
  let notificationBadge = NOTIFICATION_BADGE;
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
      console.log('FCM Push payload:', payload);
      
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
      
      // Check if this is a call notification
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
        
        const options = {
          body: notificationBody || `${callerName} is calling you...`,
          icon: notificationIcon,
          badge: notificationBadge,
          image: notificationImage,
          tag: `incoming-call-${threadId || roomId || Date.now()}`,
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
          requireInteraction: true,
          silent: false,
          vibrate: [200, 100, 200, 100, 200, 100, 200],
          timestamp: Date.now()
        };

        event.waitUntil(
          self.registration.showNotification(notificationTitle || `📞 Incoming ${callType === 'video' ? 'Video' : 'Audio'} Call`, options)
        );

      // Try to wake up the app
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
        // Regular notification
        const options = {
          body: notificationBody,
          icon: notificationIcon,
          badge: notificationBadge,
          image: notificationImage,
          tag: notificationTag,
          data: notificationData,
          actions: notificationActions.length > 0 ? notificationActions : [
            {
              action: 'view',
              title: 'View',
              icon: '/icons/view.png'
            },
            {
              action: 'dismiss',
              title: 'Dismiss',
              icon: '/icons/dismiss.png'
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
      console.error('Error parsing FCM push notification:', error);
      // Fallback notification
      event.waitUntil(
        self.registration.showNotification('ConnectAfrik', {
          body: 'You have a new notification',
          icon: NOTIFICATION_ICON,
          badge: NOTIFICATION_BADGE,
          tag: 'connectafrik-notification'
        })
      );
    }
  } else {
    // No data, show default notification
    event.waitUntil(
      self.registration.showNotification('ConnectAfrik', {
        body: 'You have a new notification',
        icon: NOTIFICATION_ICON,
        badge: NOTIFICATION_BADGE,
        tag: 'connectafrik-notification'
      })
    );
  }
});

// Notification click event
self.addEventListener('notificationclick', (event) => {
  console.log('Notification clicked:', event);
  
  event.notification.close();
  
  const action = event.action;
  const notificationData = event.notification.data || {};
  const isIncomingCall = notificationData.type === 'incoming_call' || 
                         notificationData.room_id ||
                         notificationData.call_type;
  
  // Handle incoming call notification actions
  if (isIncomingCall) {
    if (action === 'answer' || !action) {
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
          .then((clientList) => {
            // Check if there's already a window open
            for (let i = 0; i < clientList.length; i++) {
              const client = clientList[i];
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
    } else if (action === 'decline') {
      // Send decline message to any open clients
      event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true })
          .then((clientList) => {
            for (let i = 0; i < clientList.length; i++) {
              const client = clientList[i];
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
    if (action === 'dismiss') {
      return;
    }
    
    // Default action or 'view' action
    const urlToOpen = typeof notificationData === 'string' 
      ? notificationData 
      : (notificationData.url || '/feed');
    
    event.waitUntil(
      clients.matchAll({ type: 'window', includeUncontrolled: true })
        .then((clientList) => {
          // Check if there's already a window/tab open with the app
          for (let i = 0; i < clientList.length; i++) {
            const client = clientList[i];
            if (client.url.includes(self.location.origin) && 'focus' in client) {
              return client.focus();
            }
          }
          
          // If no existing window, open a new one
          if (clients.openWindow) {
            return clients.openWindow(urlToOpen);
          }
        })
    );
  }
});

// Background sync for offline notifications
self.addEventListener('sync', (event) => {
  console.log('Background sync:', event.tag);
  
  if (event.tag === 'notification-sync') {
    event.waitUntil(syncNotifications());
  }
});

// Function to sync notifications when back online
async function syncNotifications() {
  try {
    // This would sync any pending notifications
    console.log('Syncing notifications...');
  } catch (error) {
    console.error('Error syncing notifications:', error);
  }
}

// Handle messages from the main thread
self.addEventListener('message', (event) => {
  console.log('Service Worker received message:', event.data);
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
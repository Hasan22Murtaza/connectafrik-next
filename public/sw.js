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

// Push event - handle incoming push notifications
self.addEventListener('push', (event) => {
  console.log('Push notification received:', event);
  
  if (event.data) {
    const data = event.data.json();
    console.log('Push data:', data);
    
    const notificationData = data.data || {};
    
    // Check if this is a call notification
    const isCallNotification = notificationData.room_id || 
                               notificationData.thread_id || 
                               notificationData.call_type ||
                               data.tag?.includes('call') ||
                               data.title?.includes('Call') ||
                               data.title?.includes('📞');

    if (isCallNotification) {
      // Handle incoming call notification
      const callType = notificationData.call_type || 'audio';
      const roomId = notificationData.room_id;
      const threadId = notificationData.thread_id;
      const callerName = notificationData.caller_name || data.body?.split(' ')[0] || 'Someone';
      
      const options = {
        body: data.body || `${callerName} is calling you...`,
        icon: data.icon || NOTIFICATION_ICON,
        badge: data.badge || NOTIFICATION_ICON,
        image: data.image,
        tag: `incoming-call-${threadId || roomId || Date.now()}`,
        data: {
          type: 'incoming_call',
          room_id: roomId,
          thread_id: threadId,
          token: notificationData.token,
          caller_id: notificationData.caller_id,
          call_type: callType,
          caller_name: callerName,
          url: roomId ? `/call/${roomId}` : '/chat'
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
        self.registration.showNotification(data.title || `📞 Incoming ${callType === 'video' ? 'Video' : 'Audio'} Call`, options)
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
        body: data.body || 'You have a new notification from ConnectAfrik',
        icon: data.icon || NOTIFICATION_ICON,
        badge: data.badge || NOTIFICATION_ICON,
        image: data.image,
        tag: data.tag || 'connectafrik-notification',
        data: data.data || {},
        actions: data.actions || [
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
        requireInteraction: data.requireInteraction || false,
        silent: data.silent || false,
        vibrate: data.vibrate || [200, 100, 200],
        timestamp: Date.now()
      };

      event.waitUntil(
        self.registration.showNotification(data.title || 'ConnectAfrik', options)
      );
    }
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
      const callUrl = notificationData.url || `/call/${notificationData.room_id}` || '/chat';
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
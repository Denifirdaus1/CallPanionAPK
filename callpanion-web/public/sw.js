// Service Worker for Web Push Notifications

self.addEventListener('push', function(event) {
  if (!event.data) {
    return;
  }

  try {
    const data = event.data.json();
    const { title, body, icon, badge, data: notificationData } = data;

    const options = {
      body: body,
      icon: icon || '/favicon.ico',
      badge: badge || '/favicon.ico',
      data: notificationData,
      requireInteraction: notificationData?.type === 'incoming_call', // Keep call notifications visible
      actions: []
    };

    // Add action buttons for incoming calls
    if (notificationData?.type === 'incoming_call') {
      options.actions = [
        {
          action: 'accept',
          title: 'Accept Call',
          icon: '/icons/phone-accept.png'
        },
        {
          action: 'decline',
          title: 'Decline',
          icon: '/icons/phone-decline.png'
        }
      ];
    }

    event.waitUntil(
      self.registration.showNotification(title || 'CallPanion', options)
    );
  } catch (error) {
    console.error('Error processing push notification:', error);
  }
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();

  const { action, data } = event;
  
  // Handle notification action buttons
  if (action === 'accept' && data?.type === 'incoming_call') {
    // Send message to client to accept call
    event.waitUntil(
      self.clients.matchAll().then(function(clients) {
        clients.forEach(function(client) {
          client.postMessage({
            type: 'accept-call',
            sessionId: data.sessionId,
            relativeName: data.relativeName,
            callType: data.callType,
            householdId: data.householdId,
            relativeId: data.relativeId
          });
        });
      })
    );
  } else if (action === 'decline' && data?.type === 'incoming_call') {
    // Send message to client to decline call
    event.waitUntil(
      self.clients.matchAll().then(function(clients) {
        clients.forEach(function(client) {
          client.postMessage({
            type: 'decline-call',
            sessionId: data.sessionId
          });
        });
      })
    );
  } else {
    // Default action - open the app
    event.waitUntil(
      self.clients.matchAll().then(function(clients) {
        if (clients.length > 0) {
          // Focus existing client
          return clients[0].focus();
        } else {
          // Open new client
          return self.clients.openWindow('/');
        }
      })
    );
  }
});

self.addEventListener('message', function(event) {
  // Handle messages from the main app
  if (event.data?.type === 'push-notification-received') {
    // Forward to all clients
    self.clients.matchAll().then(function(clients) {
      clients.forEach(function(client) {
        client.postMessage({
          type: 'push-notification',
          notification: event.data.notification
        });
      });
    });
  }
});
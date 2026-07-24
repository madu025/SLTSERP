self.addEventListener('push', function (event) {
    if (event.data) {
        try {
            const data = event.data.json();
            const options = {
                body: data.body,
                icon: data.icon || '/logo-icon.png',
                badge: data.badge || '/logo-icon.png',
                vibrate: data.vibrate || [200, 100, 200],
                data: data.data || {},
                requireInteraction: data.requireInteraction || false,
                actions: data.actions || []
            };

            event.waitUntil(
                self.registration.showNotification(data.title, options)
            );
        } catch (e) {
            console.error('Push event data was not JSON:', e);
            event.waitUntil(
                self.registration.showNotification('SLTSERP Notification', {
                    body: event.data.text(),
                    icon: '/logo-icon.png'
                })
            );
        }
    }
});

self.addEventListener('notificationclick', function (event) {
    event.notification.close();
    const urlToOpen = event.notification.data?.url || '/notifications';

    event.waitUntil(
        clients.matchAll({
            type: 'window',
            includeUncontrolled: true
        }).then(function (windowClients) {
            let matchingClient = null;
            for (let i = 0; i < windowClients.length; i++) {
                const windowClient = windowClients[i];
                if (windowClient.url.includes(urlToOpen)) {
                    matchingClient = windowClient;
                    break;
                }
            }
            if (matchingClient) {
                return matchingClient.focus();
            } else {
                return clients.openWindow(urlToOpen);
            }
        })
    );
});

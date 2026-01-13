self.addEventListener('push', function (event) {
    if (event.data) {
        const data = event.data.json();
        const options = {
            body: data.message,
            icon: '/logo.png',
            badge: '/logo.png',
            vibrate: [100, 50, 100],
            data: {
                url: data.link || '/'
            },
            actions: [
                { action: 'view', title: 'View Details' }
            ]
        };

        event.waitUntil(
            self.registration.showNotification(data.title || 'SLTSERP Notification', options)
        );
    }
});

self.addEventListener('notificationclick', function (event) {
    event.notification.close();
    event.waitUntil(
        clients.openWindow(event.notification.data.url)
    );
});

self.addEventListener('push', function (event) {
    if (event.data) {
        try {
            const data = event.data.json();

            event.waitUntil((async () => {
                // Check if user is logged out (no token cookie exists)
                if (typeof self.cookieStore !== 'undefined') {
                    try {
                        const tokenCookie = await self.cookieStore.get('token');
                        if (!tokenCookie || !tokenCookie.value) {
                            console.log('[SW] Push suppressed: User is logged out (no token cookie)');
                            return;
                        }
                    } catch {
                        // ignore cookieStore read errors
                    }
                }

                // Check active windows: if only login screens are open and user has no session
                const windowClients = await clients.matchAll({
                    type: 'window',
                    includeUncontrolled: true
                });

                if (windowClients.length > 0) {
                    const allOnLogin = windowClients.every(client => 
                        client.url.includes('/login') || client.url.includes('/contractor/login')
                    );
                    if (allOnLogin) {
                        console.log('[SW] Push suppressed: Active window is on login screen');
                        return;
                    }
                }

                const options = {
                    body: data.body,
                    icon: data.icon || '/logo-icon.png',
                    badge: data.badge || '/logo-icon.png',
                    vibrate: data.vibrate || [200, 100, 200],
                    data: data.data || {},
                    requireInteraction: data.requireInteraction || false,
                    actions: data.actions || []
                };

                return self.registration.showNotification(data.title, options);
            })());
        } catch (e) {
            console.error('Push event data was not JSON:', e);
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

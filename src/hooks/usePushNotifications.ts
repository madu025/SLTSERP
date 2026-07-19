import { useState, useEffect } from 'react';

// Utility to convert Base64 string to Uint8Array
function urlBase64ToUint8Array(base64String: string) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
        .replace(/\-/g, '+')
        .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}

export function usePushNotifications() {
    const [isSubscribed, setIsSubscribed] = useState(false);
    const [isSupported, setIsSupported] = useState(false);
    const [permission, setPermission] = useState<NotificationPermission>('default');

    useEffect(() => {
        if (typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window) {
            setIsSupported(true);
            setPermission(Notification.permission);
            
            // Check if already subscribed
            navigator.serviceWorker.register('/sw.js').then(swRegistration => {
                swRegistration.pushManager.getSubscription().then(subscription => {
                    setIsSubscribed(subscription !== null);
                });
            });
        }
    }, []);

    const subscribe = async () => {
        if (!isSupported) return false;
        
        try {
            const swRegistration = await navigator.serviceWorker.register('/sw.js');
            const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
            
            if (!vapidPublicKey) {
                console.error("VAPID public key not found in environment variables.");
                return false;
            }

            const subscription = await swRegistration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(vapidPublicKey)
            });

            // Send subscription to backend
            const res = await fetch('/api/notifications/push', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(subscription)
            });

            if (res.ok) {
                setIsSubscribed(true);
                setPermission('granted');
                return true;
            } else {
                throw new Error("Failed to save subscription on server");
            }
        } catch (error) {
            console.error('Failed to subscribe to push notifications:', error);
            if (Notification.permission === 'denied') {
                setPermission('denied');
            }
            return false;
        }
    };

    const unsubscribe = async () => {
        if (!isSupported) return false;
        try {
            const swRegistration = await navigator.serviceWorker.ready;
            const subscription = await swRegistration.pushManager.getSubscription();
            
            if (subscription) {
                await subscription.unsubscribe();
                await fetch('/api/notifications/push', {
                    method: 'DELETE',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ endpoint: subscription.endpoint })
                });
            }
            setIsSubscribed(false);
            return true;
        } catch (error) {
            console.error('Failed to unsubscribe:', error);
            return false;
        }
    };

    return { isSupported, isSubscribed, permission, subscribe, unsubscribe };
}

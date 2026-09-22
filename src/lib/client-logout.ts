import { toast } from 'sonner';

/**
 * Enterprise client-side logout utility.
 * Cleans up:
 * 1. Web push subscriptions (browser & backend DB)
 * 2. Active OS / Service Worker notifications
 * 3. Sonner toast notifications
 * 4. LocalStorage & SessionStorage
 * 5. Performs a hard window navigation to wipe React Query cache and SSE listeners
 */
export async function performClientLogout(targetLogin?: string): Promise<void> {
    try {
        // 1. Unsubscribe from Web Push & notify server to remove DB subscription
        if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
            try {
                const reg = await navigator.serviceWorker.ready;
                const sub = await reg.pushManager.getSubscription();
                if (sub) {
                    const endpoint = sub.endpoint;
                    await sub.unsubscribe().catch(() => {});
                    await fetch('/api/notifications/push', {
                        method: 'DELETE',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ endpoint }),
                    }).catch(() => {});
                }
                // Close any visible OS notifications from this app
                const activeNotifications = await reg.getNotifications();
                activeNotifications.forEach((n) => n.close());
            } catch (swErr) {
                console.warn('[LOGOUT] Service worker push cleanup failed:', swErr);
            }
        }

        // 2. Call backend logout to clear cookies and DB push subscriptions
        await fetch('/api/logout', { method: 'POST' }).catch(() => {});
    } catch (err) {
        console.warn('[LOGOUT] Network logout error:', err);
    }

    // 3. Dismiss all on-screen toast notifications
    try {
        toast.dismiss();
    } catch {
        // ignore toast dismiss errors
    }

    // 4. Clear storage
    if (typeof window !== 'undefined') {
        const isContractor =
            window.location.pathname.startsWith('/contractor') ||
            !!localStorage.getItem('contractor_user') ||
            !!localStorage.getItem('contractor_token');

        localStorage.removeItem('user');
        localStorage.removeItem('token');
        localStorage.removeItem('contractor_user');
        localStorage.removeItem('contractor_token');
        sessionStorage.clear();

        const defaultTarget = isContractor ? '/contractor/login' : '/login';
        const finalTarget = targetLogin || defaultTarget;

        // 5. Full window reload/redirect to eliminate in-flight SSE streams and React state
        window.location.href = finalTarget;
    }
}

import { useState, useCallback, useEffect } from 'react';
import { toast } from 'sonner';
import { playNotificationSound } from '@/lib/audio';

export interface SidebarNotification {
    id: string;
    type: string;
    title: string;
    message: string;
    priority: string;
    link?: string;
    isRead: boolean;
    createdAt: string;
}

export function useSidebarNotifications(
    userId: string | undefined,
    mounted: boolean,
    pathname: string,
    currentRtom: string | null
) {
    const [unreadCount, setUnreadCount] = useState(0);
    const [notifications, setNotifications] = useState<SidebarNotification[]>([]);
    const [loadingNotifications, setLoadingNotifications] = useState(false);

    const [menuCounts, setMenuCounts] = useState<Record<string, number>>({
        approvals: 0,
        serviceOrders: 0,
        helpdesk: 0,
        procurementApprovals: 0,
        contractorApprovals: 0,
        materialRequests: 0,
        materialApprovals: 0
    });

    const fetchMenuCounts = useCallback(async () => {
        if (!userId) return;
        try {
            const res = await fetch(`/api/notifications/sidebar-counts?_t=${Date.now()}`);
            if (res.ok) {
                const data = await res.json();
                if (data.success && data.data) {
                    setMenuCounts(data.data);
                }
            }
        } catch (err) {
            console.error("Failed to fetch sidebar menu counts:", err);
        }
    }, [userId]);

    const fetchNotifications = useCallback(async () => {
        if (!userId) return;
        setLoadingNotifications(true);
        try {
            const res = await fetch(`/api/notifications?_t=${Date.now()}`);
            if (res.ok) {
                const json = await res.json();
                const list = Array.isArray(json.data) ? json.data : [];
                setNotifications(list.slice(0, 8)); // latest 8 notifications in sidebar drawer
                setUnreadCount(list.filter((n: SidebarNotification) => !n.isRead).length);
            }
        } catch (err) {
            console.error("Failed to fetch notifications in sidebar:", err);
        } finally {
            setLoadingNotifications(false);
        }
    }, [userId]);

    const handleMarkAllRead = async (silent = false) => {
        try {
            const res = await fetch('/api/notifications', { method: 'PATCH' });
            if (res.ok) {
                setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
                setUnreadCount(0);
                if (!silent) toast.success("All notifications marked as read");
            }
        } catch (err) {
            console.error("Failed to mark all notifications read:", err);
        }
    };

    const handleNotificationClick = async (n: SidebarNotification, closeDrawer: () => void) => {
        if (!n.isRead) {
            try {
                await fetch(`/api/notifications/${n.id}`, { method: 'PATCH' });
                setNotifications(prev => prev.map(item => item.id === n.id ? { ...item, isRead: true } : item));
                setUnreadCount(prev => Math.max(0, prev - 1));
            } catch (err) {
                console.error("Failed to mark notification as read:", err);
            }
        }
        closeDrawer();
        if (n.link) {
            window.location.href = n.link;
        }
    };

    // Auto-clear notifications when navigating to their respective pages
    useEffect(() => {
        if (!mounted || !userId) return;

        const currentLink = pathname;
        if (currentLink && currentLink !== '/') {
            const getClearablePrefix = (path: string) => {
                if (path.startsWith('/helpdesk')) return '/helpdesk';
                if (path.startsWith('/projects')) return '/projects';
                if (path.startsWith('/service-orders')) return '/service-orders';
                if (path.startsWith('/admin/inventory')) return '/admin/inventory';
                if (path.startsWith('/admin/contractors')) return '/admin/contractors';
                if (path.startsWith('/inventory/requests')) return '/inventory/requests';
                if (path.startsWith('/inventory/approvals')) return '/inventory/approvals';
                return path;
            };

            const prefix = getClearablePrefix(currentLink);

            fetch(`/api/notifications?linkPrefix=${encodeURIComponent(prefix)}`, {
                method: 'PATCH',
            })
                .then(res => {
                    if (res.ok) {
                        fetchNotifications();
                        fetchMenuCounts();
                    }
                })
                .catch(err => console.error("Failed to auto-clear notifications for link:", err));
        }
    }, [pathname, currentRtom, userId, mounted, fetchNotifications, fetchMenuCounts]);

    // SSE Connection for real-time sidebar notifications & counts
    useEffect(() => {
        if (!mounted || !userId) return;
        
        fetchNotifications();
        fetchMenuCounts();

        let eventSource: EventSource | null = null;
        let reconnectTimeout: NodeJS.Timeout;
        let sseDebounceTimeout: NodeJS.Timeout;

        const connectSSE = () => {
            eventSource = new EventSource(`/api/notifications/stream?userId=${userId}`);

            eventSource.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    
                    clearTimeout(sseDebounceTimeout);
                    const jitterMs = Math.floor(Math.random() * 2000) + 500; // 500ms to 2500ms

                    sseDebounceTimeout = setTimeout(() => {
                        if (data._isSystem) {
                            fetchMenuCounts();
                        } else {
                            fetchNotifications();
                            fetchMenuCounts();
                            
                            if (data.priority === 'CRITICAL' || data.priority === 'HIGH') {
                                playNotificationSound();
                            }
                        }
                    }, jitterMs);
                        
                    if (document.hidden) {    
                        window.dispatchEvent(new CustomEvent('slts-notification', { detail: data }));
                    }
                } catch (e) {
                    console.warn("Failed to parse SSE notification:", e);
                }
            };

            eventSource.onerror = () => {
                if (eventSource) eventSource.close();
                reconnectTimeout = setTimeout(connectSSE, 5000);
            };
        };

        connectSSE();

        const handleNewNotification = () => {
            fetchNotifications();
            fetchMenuCounts();
        };
        window.addEventListener('slts-notification', handleNewNotification);

        return () => {
            window.removeEventListener('slts-notification', handleNewNotification);
            if (eventSource) eventSource.close();
            clearTimeout(reconnectTimeout);
            clearTimeout(sseDebounceTimeout);
        };
    }, [mounted, userId, fetchMenuCounts, fetchNotifications]);

    // Re-fetch when route changes
    useEffect(() => {
        if (mounted && userId) {
            fetchNotifications();
            fetchMenuCounts();
        }
    }, [pathname, mounted, userId, fetchMenuCounts, fetchNotifications]);

    return {
        unreadCount,
        notifications,
        loadingNotifications,
        menuCounts,
        handleMarkAllRead,
        handleNotificationClick
    };
}

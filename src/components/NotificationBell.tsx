"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Bell } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useRouter } from "next/navigation";

interface Notification {
    id: string;
    type: string;
    title: string;
    message: string;
    priority: string;
    link?: string;
    isRead: boolean;
    createdAt: string;
}

export default function NotificationBell() {
    const router = useRouter();
    const queryClient = useQueryClient();
    const [userId, setUserId] = useState<string | null>(null);

    // Get current user from localStorage (client-side only)
    useEffect(() => {
        const storedUser = localStorage.getItem('user');
        if (storedUser) {
            const user = JSON.parse(storedUser);
            setUserId(user.id);
        }
    }, []);

    // SSE Connection for real-time notifications
    useEffect(() => {
        if (!userId) return;

        console.log("Establishing SSE connection for notifications...");
        const eventSource = new EventSource(`/api/notifications/stream?userId=${userId}`);

        eventSource.onmessage = (event) => {
            try {
                const newNotification = JSON.parse(event.data);
                console.log("New real-time notification received:", newNotification);

                // Update local query cache immediately
                queryClient.setQueryData(["notifications", userId], (oldData: any) => {
                    const currentData = Array.isArray(oldData) ? oldData : [];

                    // Avoid duplicates
                    if (newNotification.id && currentData.some((n: any) => n.id === newNotification.id)) {
                        return currentData;
                    }

                    // Add standard fields if missing (for broadcast/non-persisted events)
                    const sanitized = {
                        id: newNotification.id || `temp-${Date.now()}`,
                        isRead: false,
                        createdAt: new Date().toISOString(),
                        ...newNotification
                    };

                    return [sanitized, ...currentData].slice(0, 50); // Keep limit
                });

                // Dispatch a custom event for other components (like Sidebar) to react
                window.dispatchEvent(new CustomEvent('slts-notification', { detail: newNotification }));

                // Play a subtle notification sound or show a toast if needed
            } catch (error) {
                console.error("Failed to parse SSE notification:", error);
            }
        };

        eventSource.onerror = (error) => {
            console.error("SSE Connection Error:", error);
            eventSource.close();
            // Optional: Implement reconnection logic after delay
        };

        return () => {
            console.log("Closing SSE connection...");
            eventSource.close();
        };
    }, [userId, queryClient]);

    // Fetch initial notifications (and fallback polling)
    const { data: notifications = [] } = useQuery<Notification[]>({
        queryKey: ["notifications", userId],
        queryFn: async () => {
            if (!userId) return [];
            try {
                const res = await fetch(`/api/notifications`);
                if (!res.ok) return [];
                const data = await res.json();
                return Array.isArray(data) ? data : [];
            } catch (err) {
                console.error("Fetch notifications error:", err);
                return [];
            }
        },
        enabled: !!userId,
        refetchInterval: 20000 // Reduced to 20s for faster updates
    });

    const safeNotifications = Array.isArray(notifications) ? notifications : [];
    const unreadCount = safeNotifications.filter(n => !n.isRead).length;

    // Mark as read mutation
    const markAsReadMutation = useMutation({
        mutationFn: async (notificationId: string) => {
            await fetch(`/api/notifications/${notificationId}`, {
                method: "PATCH"
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["notifications"] });
        }
    });

    // Mark all as read mutation
    const markAllReadMutation = useMutation({
        mutationFn: async () => {
            await fetch("/api/notifications", {
                method: "PATCH"
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["notifications"] });
        }
    });


    const handleNotificationClick = (notification: Notification) => {
        // Mark as read
        if (!notification.isRead) {
            markAsReadMutation.mutate(notification.id);
        }
        // Navigate to link if exists
        if (notification.link) {
            router.push(notification.link);
        }
    };

    const getNotificationColor = (type: string) => {
        switch (type) {
            case 'INVENTORY': return 'text-orange-600 bg-orange-50';
            case 'CONTRACTOR': return 'text-blue-600 bg-blue-50';
            case 'PROJECT': return 'text-purple-600 bg-purple-50';
            case 'FINANCE': return 'text-emerald-600 bg-emerald-50';
            default: return 'text-slate-600 bg-slate-50';
        }
    };

    const getNotificationIcon = (type: string) => {
        switch (type) {
            case 'INVENTORY': return '📦';
            case 'CONTRACTOR': return '🛡️';
            case 'PROJECT': return '🏗️';
            case 'FINANCE': return '💰';
            case 'SYSTEM': return '⚙️';
            case 'SUCCESS': return '✅';
            case 'REQUEST_CREATED': return '📝';
            default: return '🔔';
        }
    };

    const formatTime = (dateString: string) => {
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMins / 60);
        const diffDays = Math.floor(diffHours / 24);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;
        return date.toLocaleDateString();
    };

    if (!userId) return null;

    return (
        <Popover>
            <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="relative">
                    <Bell className="h-5 w-5" />
                    {unreadCount > 0 && (
                        <Badge
                            className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 bg-red-500 text-white text-xs"
                        >
                            {unreadCount > 9 ? '9+' : unreadCount}
                        </Badge>
                    )}
                </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-80 p-0">
                <div className="flex items-center justify-between p-3 border-b">
                    <h3 className="font-semibold text-sm">Notifications</h3>
                    {unreadCount > 0 && (
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-auto p-1 text-xs text-blue-600 hover:text-blue-700"
                            onClick={() => markAllReadMutation.mutate()}
                        >
                            Mark all read
                        </Button>
                    )}
                </div>
                <ScrollArea className="h-[400px]">
                    {safeNotifications.length === 0 ? (
                        <div className="p-8 text-center text-slate-500 text-sm">
                            No notifications
                        </div>
                    ) : (
                        <div className="divide-y">
                            {safeNotifications.map((notification) => (
                                <div
                                    key={notification.id}
                                    onClick={() => handleNotificationClick(notification)}
                                    className={`p-3 cursor-pointer transition-colors border-l-4 ${notification.isRead
                                        ? 'bg-white hover:bg-slate-50 border-l-transparent'
                                        : `bg-blue-50 hover:bg-blue-100 border-l-blue-600`
                                        }`}
                                >
                                    <div className="flex gap-3">
                                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-xl flex-shrink-0 ${getNotificationColor(notification.type)}`}>
                                            {getNotificationIcon(notification.type)}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-start justify-between gap-2">
                                                <h4 className={`text-sm font-semibold truncate ${notification.isRead ? 'text-slate-700' : 'text-slate-900'}`}>
                                                    {notification.title}
                                                </h4>
                                                {notification.priority === 'CRITICAL' && (
                                                    <span className="flex h-2 w-2 rounded-full bg-red-600 animate-pulse"></span>
                                                )}
                                            </div>
                                            <p className="text-xs text-slate-600 mt-0.5 line-clamp-2 leading-relaxed">
                                                {notification.message}
                                            </p>
                                            <div className="flex items-center gap-2 mt-1.5">
                                                <span className="text-[10px] font-medium text-slate-400 capitalize">{notification.type.toLowerCase()}</span>
                                                <span className="text-[10px] text-slate-300">•</span>
                                                <span className="text-[10px] text-slate-400">
                                                    {formatTime(notification.createdAt)}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </ScrollArea>
            </PopoverContent>
        </Popover>
    );
}

"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Bell } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
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
    const [userId] = useState<string | null>(() => {
        if (typeof window !== 'undefined') {
            const storedUser = localStorage.getItem('user');
            if (storedUser) {
                try {
                    return JSON.parse(storedUser).id;
                } catch (e) {
                    console.error("Failed to parse user from localStorage", e);
                }
            }
        }
        return null;
    });

    // SSE Connection for real-time notifications
    useEffect(() => {
        if (!userId) return;

        let eventSource: EventSource | null = null;
        let reconnectTimeout: NodeJS.Timeout;

        const connect = () => {
            console.log("Establishing SSE connection for notifications...");
            eventSource = new EventSource(`/api/notifications/stream?userId=${userId}`);

            eventSource.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);

                    // 1. Handle Global System Events (for Dashboard Live Updates)
                    if (data._isSystem) {
                        console.log("Global system event received:", data.type);
                        // Invalidate relevant queries based on event type
                        if (data.type === 'INVENTORY_UPDATE') queryClient.invalidateQueries({ queryKey: ['dashboard-alerts'] });
                        if (data.type === 'CONTRACTOR_UPDATE') queryClient.invalidateQueries({ queryKey: ['contractors'] });
                        if (data.type === 'SOD_UPDATE') queryClient.invalidateQueries({ queryKey: ['service-orders'] });

                        // Dispatch global event for other components
                        window.dispatchEvent(new CustomEvent('slts-system-event', { detail: data }));
                        return;
                    }

                    // 2. Handle User Notifications
                    const newNotification = data;
                    console.log("New real-time notification received:", newNotification);

                    // Play Notification Sound
                    try {
                        const audio = new Audio("https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3");
                        audio.play().catch(() => console.log("Audio play blocked by browser policy"));
                    } catch {
                        console.error("Audio error");
                    }

                    // Show a real-time Toast for instant feedback
                    toast.info(newNotification.title || "New Notification", {
                        description: newNotification.message,
                        action: newNotification.link ? {
                            label: "View",
                            onClick: () => router.push(newNotification.link)
                        } : undefined,
                        duration: 8000,
                    });

                    // Update local query cache immediately
                    queryClient.setQueryData(["notifications", userId], (oldData: Notification[] | undefined) => {
                        const currentData = Array.isArray(oldData) ? oldData : [];
                        if (newNotification.id && currentData.some((n: Notification) => n.id === newNotification.id)) {
                            return currentData;
                        }
                        const sanitized = {
                            id: newNotification.id || `temp-${Date.now()}`,
                            isRead: false,
                            createdAt: new Date().toISOString(),
                            ...newNotification
                        };
                        return [sanitized, ...currentData].slice(0, 50);
                    });

                    window.dispatchEvent(new CustomEvent('slts-notification', { detail: newNotification }));
                } catch (error) {
                    console.error("Failed to parse SSE notification:", error);
                }
            };

            eventSource.onerror = () => {
                console.error("SSE Connection Error, attempting to reconnect...");
                if (eventSource) eventSource.close();
                // Attempt to reconnect after 5 seconds
                reconnectTimeout = setTimeout(connect, 5000);
            };
        };

        connect();

        return () => {
            console.log("Closing SSE connection...");
            if (eventSource) eventSource.close();
            clearTimeout(reconnectTimeout);
        };
    }, [userId, queryClient, router]);

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
        staleTime: 300000, // 👈 Optimized: Keep cached notifications fresh for 5 minutes
        refetchOnWindowFocus: false // 👈 Optimized: SSE handles real-time updates, no need to refetch on focus
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
            <PopoverContent align="end" className="w-[380px] p-0 overflow-hidden border-none shadow-2xl rounded-2xl bg-white/95 backdrop-blur-sm">
                <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50/50 sticky top-0 z-10">
                    <div>
                        <h3 className="font-black text-slate-800 text-sm">Notifications</h3>
                        <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">{unreadCount} Unread Activities</p>
                    </div>
                    {unreadCount > 0 && (
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 px-3 text-[11px] font-bold text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-all"
                            onClick={() => markAllReadMutation.mutate()}
                        >
                            Mark all read
                        </Button>
                    )}
                </div>
                <ScrollArea className="h-[450px] overflow-y-auto custom-scrollbar">
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

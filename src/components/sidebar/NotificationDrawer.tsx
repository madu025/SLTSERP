import React from 'react';
import Link from 'next/link';
import { BellRing, BellOff, CheckCheck, X } from 'lucide-react';
import type { SidebarNotification } from '@/hooks/useSidebarNotifications';

interface NotificationDrawerProps {
    show: boolean;
    notifications: SidebarNotification[];
    loading: boolean;
    unreadCount: number;
    isSubscribed: boolean;
    isSupported: boolean;
    permission: string;
    onClose: () => void;
    onMarkAllRead: (silent?: boolean) => void;
    onNotificationClick: (n: SidebarNotification, closeDrawer: () => void) => void;
    onSubscribe: () => Promise<boolean>;
    onUnsubscribe: () => Promise<boolean | void>;
    toast: typeof import('sonner').toast;
}

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

export function NotificationDrawer({
    show,
    notifications,
    loading,
    unreadCount,
    isSubscribed,
    isSupported,
    permission,
    onClose,
    onMarkAllRead,
    onNotificationClick,
    onSubscribe,
    onUnsubscribe,
    toast
}: NotificationDrawerProps) {
    if (!show) return null;

    return (
        <div
            className="w-full h-full flex flex-col shadow-2xl"
            style={{
                background: '#0D1B2A',
                borderRight: '1px solid rgba(0, 114, 187, 0.15)',
            }}
        >
            <div
                className="p-3 flex items-center justify-between flex-shrink-0"
                style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}
            >
                <div className="flex items-center gap-2">
                    <span className="text-[11px] font-black tracking-wide text-white">Notifications</span>
                    {unreadCount > 0 && (
                        <span className="px-1.5 py-0.5 rounded text-[8px] font-black bg-[#00AEEF]/20 text-[#00AEEF]">
                            {unreadCount} NEW
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-1">
                    {/* Desktop Push Toggle */}
                    {isSupported && isSubscribed !== undefined && (
                        <button
                            onClick={async () => {
                                if (isSubscribed) {
                                    await onUnsubscribe();
                                    toast.success("Desktop alerts disabled");
                                } else {
                                    if (permission === 'denied') {
                                        toast.error("Please enable notifications in browser settings");
                                    } else {
                                        const success = await onSubscribe();
                                        if (success) toast.success("Desktop alerts enabled!");
                                    }
                                }
                            }}
                            className="p-1 rounded hover:bg-white/5 text-primary transition-colors cursor-pointer mr-1"
                            title={isSubscribed ? "Disable Desktop Alerts" : "Enable Desktop Alerts"}
                        >
                            {isSubscribed ? <BellRing className="w-3.5 h-3.5" /> : <BellOff className="w-3.5 h-3.5 text-white/40" />}
                        </button>
                    )}
                    {unreadCount > 0 && (
                        <button
                            onClick={() => onMarkAllRead(false)}
                            className="p-1 rounded hover:bg-white/5 text-primary transition-colors cursor-pointer"
                            title="Mark all read"
                        >
                            <CheckCheck className="w-3.5 h-3.5" />
                        </button>
                    )}
                    <button
                        onClick={onClose}
                        className="p-1 rounded hover:bg-white/5 text-white/40 hover:text-white transition-colors cursor-pointer"
                    >
                        <X className="w-3.5 h-3.5" />
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-2 custom-scrollbar">
                {loading ? (
                    <div className="flex items-center justify-center py-10 text-[10px] text-white/40">
                        Loading notifications...
                    </div>
                ) : notifications.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center text-[10px] text-white/40 space-y-2">
                        <span>🔔</span>
                        <span>No notifications found</span>
                    </div>
                ) : (
                    notifications.map((n) => (
                        <div
                            key={n.id}
                            onClick={() => onNotificationClick(n, onClose)}
                            className="p-2.5 rounded-lg border cursor-pointer transition-all duration-200 text-left relative overflow-hidden flex gap-2.5"
                            style={{
                                background: n.isRead ? 'rgba(255, 255, 255, 0.01)' : 'rgba(0, 114, 187, 0.06)',
                                borderColor: n.isRead ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 114, 187, 0.15)',
                            }}
                            onMouseEnter={e => {
                                (e.currentTarget as HTMLDivElement).style.background = n.isRead ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 114, 187, 0.1)';
                                (e.currentTarget as HTMLDivElement).style.borderColor = n.isRead ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 114, 187, 0.25)';
                            }}
                            onMouseLeave={e => {
                                (e.currentTarget as HTMLDivElement).style.background = n.isRead ? 'rgba(255, 255, 255, 0.01)' : 'rgba(0, 114, 187, 0.06)';
                                (e.currentTarget as HTMLDivElement).style.borderColor = n.isRead ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 114, 187, 0.15)';
                            }}
                        >
                            <div
                                className="w-7 h-7 rounded-lg flex items-center justify-center text-xs flex-shrink-0"
                                style={{
                                    background: 'rgba(255, 255, 255, 0.03)',
                                    border: '1px solid rgba(255, 255, 255, 0.05)',
                                }}
                            >
                                {n.type === 'INVENTORY' ? '📦' : n.type === 'CONTRACTOR' ? '🛡️' : n.type === 'PROJECT' ? '🏗️' : n.type === 'FINANCE' ? '💰' : n.type === 'HELPDESK' ? '🎫' : '⚙️'}
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex justify-between items-start gap-1">
                                    <p className="text-[10px] font-black text-white truncate leading-tight">{n.title}</p>
                                    {n.priority === 'CRITICAL' && (
                                        <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse flex-shrink-0 mt-0.5" />
                                    )}
                                </div>
                                <p className="text-[9px] text-white/60 mt-0.5 line-clamp-2 leading-relaxed">{n.message}</p>
                                <span className="text-[8px] text-white/30 block mt-1">{formatTime(n.createdAt)}</span>
                            </div>
                        </div>
                    ))
                )}
            </div>

            <div
                className="p-2 bg-muted/5 flex-shrink-0 text-center"
                style={{ borderTop: '1px solid rgba(255, 255, 255, 0.05)' }}
            >
                <Link
                    href="/notifications"
                    onClick={onClose}
                    className="block py-1.5 text-[10px] font-black text-[#00AEEF] hover:text-[#00AEEF]/80 hover:bg-white/5 rounded-lg transition-all"
                >
                    Open Notification Manager
                </Link>
            </div>
        </div>
    );
}

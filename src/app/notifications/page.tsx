"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import {
    Bell, CheckCheck, Trash2, Filter, Search, X,
    AlertTriangle, Package, Shield, Building2, Briefcase,
    Clock, ArrowUpDown, Settings, RefreshCw, MessageSquare,
    Wrench, DollarSign, Calendar, Router, User,
    ChevronDown, ChevronUp, SlidersHorizontal, Eye, EyeOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

// Types
interface Notification {
    id: string;
    type: string;
    title: string;
    message: string;
    priority: string;
    link?: string;
    isRead: boolean;
    createdAt: string;
    metadata?: Record<string, unknown>;
}

interface NotificationPreference {
    id: string;
    userId: string;
    type: string;
    enabled: boolean;
}

// Type definitions with colors
const TYPE_CONFIG: Record<string, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
    SYSTEM: { label: "System", color: "text-slate-600", bg: "bg-slate-100", icon: <Settings className="w-3.5 h-3.5" /> },
    INVENTORY: { label: "Inventory", color: "text-orange-600", bg: "bg-orange-100", icon: <Package className="w-3.5 h-3.5" /> },
    CONTRACTOR: { label: "Contractors", color: "text-blue-600", bg: "bg-blue-100", icon: <Shield className="w-3.5 h-3.5" /> },
    PROJECT: { label: "Projects", color: "text-purple-600", bg: "bg-purple-100", icon: <Building2 className="w-3.5 h-3.5" /> },
    FINANCE: { label: "Finance", color: "text-emerald-600", bg: "bg-emerald-100", icon: <DollarSign className="w-3.5 h-3.5" /> },
    HELPDESK: { label: "Helpdesk", color: "text-rose-600", bg: "bg-rose-100", icon: <Wrench className="w-3.5 h-3.5" /> },
};

const PRIORITY_CONFIG: Record<string, { label: string; color: string; dot: string }> = {
    CRITICAL: { label: "Critical", color: "text-red-600", dot: "bg-red-600 animate-pulse" },
    HIGH: { label: "High", color: "text-orange-600", dot: "bg-orange-500" },
    MEDIUM: { label: "Medium", color: "text-yellow-600", dot: "bg-yellow-400" },
    LOW: { label: "Low", color: "text-slate-400", dot: "bg-slate-300" },
};

// Group notifications by type
function groupNotifications(notifications: Notification[]): Map<string, Notification[]> {
    const grouped = new Map<string, Notification[]>();
    for (const n of notifications) {
        const key = n.type;
        if (!grouped.has(key)) grouped.set(key, []);
        grouped.get(key)!.push(n);
    }
    return grouped;
}

function formatTime(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "2-digit" });
}

export default function NotificationCenterPage() {
    const router = useRouter();
    const queryClient = useQueryClient();
    const [userId, setUserId] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState("");
    const [filterType, setFilterType] = useState<string>("ALL");
    const [filterPriority, setFilterPriority] = useState<string>("ALL");
    const [filterStatus, setFilterStatus] = useState<string>("ALL");
    const [sortOrder, setSortOrder] = useState<"newest" | "oldest" | "priority">("newest");
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [groupByType, setGroupByType] = useState(true);
    const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

    useEffect(() => {
        const storedUser = localStorage.getItem("user");
        if (storedUser) {
            try {
                setUserId(JSON.parse(storedUser).id);
            } catch {
                // ignore
            }
        }
    }, []);

    // Fetch notifications
    const { data: notifications = [], isLoading } = useQuery<Notification[]>({
        queryKey: ["notifications", userId],
        queryFn: async () => {
            if (!userId) return [];
            const res = await fetch("/api/notifications?limit=200");
            if (!res.ok) return [];
            const json = await res.json();
            return Array.isArray(json.data) ? json.data : [];
        },
        enabled: !!userId,
        staleTime: 10000,
    });

    // Fetch preferences
    const { data: preferences = [] } = useQuery<NotificationPreference[]>({
        queryKey: ["notification-preferences", userId],
        queryFn: async () => {
            if (!userId) return [];
            const res = await fetch("/api/notifications/preferences");
            if (!res.ok) return [];
            const json = await res.json();
            return Array.isArray(json.data) ? json.data : [];
        },
        enabled: !!userId,
    });

    // Mark as read mutation
    const markAsReadMutation = useMutation({
        mutationFn: async (notificationId: string) => {
            await fetch(`/api/notifications/${notificationId}`, { method: "PATCH" });
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
    });

    // Mark all as read
    const markAllReadMutation = useMutation({
        mutationFn: async () => {
            await fetch("/api/notifications", { method: "PATCH" });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["notifications"] });
            toast.success("All notifications marked as read");
        },
    });

    // Delete single
    const deleteMutation = useMutation({
        mutationFn: async (id: string) => {
            await fetch(`/api/notifications/${id}`, { method: "DELETE" });
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
    });

    // Delete selected
    const deleteSelectedMutation = useMutation({
        mutationFn: async (ids: string[]) => {
            await Promise.all(ids.map(id => fetch(`/api/notifications/${id}`, { method: "DELETE" })));
        },
        onSuccess: () => {
            setSelectedIds(new Set());
            queryClient.invalidateQueries({ queryKey: ["notifications"] });
            toast.success("Selected notifications deleted");
        },
    });

    // Delete all
    const deleteAllMutation = useMutation({
        mutationFn: async () => {
            await fetch("/api/notifications", { method: "DELETE" });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["notifications"] });
            toast.success("All notifications deleted");
        },
    });

    // Toggle preference
    const togglePreferenceMutation = useMutation({
        mutationFn: async ({ type, enabled }: { type: string; enabled: boolean }) => {
            await fetch("/api/notifications/preferences", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ type, enabled }),
            });
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notification-preferences"] }),
    });

    // Filtered & sorted notifications
    const filteredNotifications = useMemo(() => {
        let filtered = [...notifications];

        // Search
        if (searchTerm.trim()) {
            const term = searchTerm.toLowerCase();
            filtered = filtered.filter(
                n =>
                    n.title.toLowerCase().includes(term) ||
                    n.message.toLowerCase().includes(term),
            );
        }

        // Type filter
        if (filterType !== "ALL") {
            filtered = filtered.filter(n => n.type === filterType);
        }

        // Priority filter
        if (filterPriority !== "ALL") {
            filtered = filtered.filter(n => n.priority === filterPriority);
        }

        // Status filter
        if (filterStatus === "UNREAD") {
            filtered = filtered.filter(n => !n.isRead);
        } else if (filterStatus === "READ") {
            filtered = filtered.filter(n => n.isRead);
        }

        // Sort
        if (sortOrder === "newest") {
            filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        } else if (sortOrder === "oldest") {
            filtered.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        } else if (sortOrder === "priority") {
            const priorityOrder = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
            filtered.sort((a, b) => (priorityOrder[a.priority as keyof typeof priorityOrder] || 99) - (priorityOrder[b.priority as keyof typeof priorityOrder] || 99));
        }

        return filtered;
    }, [notifications, searchTerm, filterType, filterPriority, filterStatus, sortOrder]);

    // Grouped notifications
    const groupedNotifications = useMemo(() => {
        if (!groupByType) return null;
        return groupNotifications(filteredNotifications);
    }, [filteredNotifications, groupByType]);

    const toggleSelect = (id: string) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const toggleExpandGroup = (groupKey: string) => {
        setExpandedGroups(prev => {
            const next = new Set(prev);
            if (next.has(groupKey)) next.delete(groupKey);
            else next.add(groupKey);
            return next;
        });
    };

    const handleNotificationClick = useCallback((notification: Notification) => {
        if (!notification.isRead) {
            markAsReadMutation.mutate(notification.id);
        }
        if (notification.link) {
            router.push(notification.link);
        }
    }, [markAsReadMutation, router]);

    const unreadCount = notifications.filter(n => !n.isRead).length;
    const typeList = Object.keys(TYPE_CONFIG);

    const getTypeIcon = (type: string) => {
        return TYPE_CONFIG[type]?.icon || <Bell className="w-3.5 h-3.5" />;
    };

    if (!userId) {
        return (
            <div className="h-screen flex bg-[#f8fafc] overflow-hidden text-xs">
                <Sidebar />
                <div className="flex-1 flex flex-col min-w-0">
                    <Header />
                    <div className="flex items-center justify-center flex-1">
                        <p className="text-slate-500">Loading user session...</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="h-screen flex bg-[#f8fafc] overflow-hidden text-xs">
            <Sidebar />
            <div className="flex-1 flex flex-col min-w-0">
                <Header />
                <main className="flex-1 overflow-y-auto p-6 md:p-8">
                    <div className="max-w-5xl mx-auto">
                        {/* Header */}
                        <div className="mb-8">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                                        Notification Center
                                    </h1>
                                    <p className="text-sm text-slate-500 mt-1">
                                        {unreadCount} unread · {notifications.length} total
                                    </p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => markAllReadMutation.mutate()}
                                        disabled={unreadCount === 0}
                                        className="gap-1.5"
                                    >
                                        <CheckCheck className="w-4 h-4" />
                                        Mark All Read
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => deleteAllMutation.mutate()}
                                        className="gap-1.5 text-red-600 hover:text-red-700 border-red-200 hover:border-red-300"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                        Clear All
                                    </Button>
                                </div>
                            </div>
                        </div>

                        {/* Toolbar */}
                        <div className="flex flex-wrap items-center gap-3 mb-6 bg-white dark:bg-slate-950 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                            <div className="relative flex-1 min-w-[200px]">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <Input
                                    placeholder="Search notifications..."
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                    className="pl-9 h-9 text-sm rounded-xl"
                                />
                                {searchTerm && (
                                    <button
                                        onClick={() => setSearchTerm("")}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                )}
                            </div>

                            <Select value={filterType} onValueChange={setFilterType}>
                                <SelectTrigger className="w-[140px] h-9 text-xs rounded-xl">
                                    <Filter className="w-3 h-3 mr-1" />
                                    <SelectValue placeholder="Type" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="ALL">All Types</SelectItem>
                                    {typeList.map(type => (
                                        <SelectItem key={type} value={type}>
                                            {TYPE_CONFIG[type]?.label || type}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>

                            <Select value={filterPriority} onValueChange={setFilterPriority}>
                                <SelectTrigger className="w-[130px] h-9 text-xs rounded-xl">
                                    <AlertTriangle className="w-3 h-3 mr-1" />
                                    <SelectValue placeholder="Priority" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="ALL">All Priorities</SelectItem>
                                    <SelectItem value="CRITICAL">Critical</SelectItem>
                                    <SelectItem value="HIGH">High</SelectItem>
                                    <SelectItem value="MEDIUM">Medium</SelectItem>
                                    <SelectItem value="LOW">Low</SelectItem>
                                </SelectContent>
                            </Select>

                            <Select value={filterStatus} onValueChange={setFilterStatus}>
                                <SelectTrigger className="w-[130px] h-9 text-xs rounded-xl">
                                    <Eye className="w-3 h-3 mr-1" />
                                    <SelectValue placeholder="Status" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="ALL">All</SelectItem>
                                    <SelectItem value="UNREAD">Unread</SelectItem>
                                    <SelectItem value="READ">Read</SelectItem>
                                </SelectContent>
                            </Select>

                            <Select value={sortOrder} onValueChange={(v: string) => setSortOrder(v as typeof sortOrder)}>
                                <SelectTrigger className="w-[130px] h-9 text-xs rounded-xl">
                                    <ArrowUpDown className="w-3 h-3 mr-1" />
                                    <SelectValue placeholder="Sort" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="newest">Newest First</SelectItem>
                                    <SelectItem value="oldest">Oldest First</SelectItem>
                                    <SelectItem value="priority">By Priority</SelectItem>
                                </SelectContent>
                            </Select>

                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-9 w-9 rounded-xl"
                                onClick={() => setGroupByType(!groupByType)}
                                title={groupByType ? "Ungroup" : "Group by type"}
                            >
                                <SlidersHorizontal className={cn("w-4 h-4", groupByType && "text-blue-600")} />
                            </Button>

                            {selectedIds.size > 0 && (
                                <Button
                                    variant="destructive"
                                    size="sm"
                                    onClick={() => deleteSelectedMutation.mutate(Array.from(selectedIds))}
                                    className="gap-1.5 h-9 rounded-xl"
                                >
                                    <Trash2 className="w-3.5 h-3.5" />
                                    Delete ({selectedIds.size})
                                </Button>
                            )}
                        </div>

                        {/* Preferences Quick Setting */}
                        <div className="mb-6 p-4 bg-blue-50/50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/30 rounded-2xl">
                            <div className="flex items-center gap-2 mb-3">
                                <Settings className="w-4 h-4 text-blue-600" />
                                <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300">Channel Preferences</h3>
                            </div>
                            <div className="flex flex-wrap gap-4">
                                {typeList.map(type => {
                                    const pref = preferences.find(p => p.type === type);
                                    const isEnabled = pref?.enabled ?? true;
                                    return (
                                        <label key={type} className="flex items-center gap-2 cursor-pointer text-xs">
                                            <Checkbox
                                                checked={isEnabled}
                                                onCheckedChange={() =>
                                                    togglePreferenceMutation.mutate({ type, enabled: !isEnabled })
                                                }
                                                className="w-3.5 h-3.5"
                                            />
                                            {getTypeIcon(type)}
                                            <span className="font-medium text-slate-600 dark:text-slate-400">
                                                {TYPE_CONFIG[type]?.label || type}
                                            </span>
                                        </label>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Stats */}
                        <div className="grid grid-cols-3 md:grid-cols-6 gap-3 mb-6">
                            {typeList.map(type => {
                                const count = notifications.filter(n => n.type === type && !n.isRead).length;
                                const config = TYPE_CONFIG[type] || { label: type, color: "text-slate-600", bg: "bg-slate-100" };
                                return (
                                    <button
                                        key={type}
                                        onClick={() => { setFilterType(type); setFilterStatus("UNREAD"); }}
                                        className={cn(
                                            "p-3 rounded-xl text-center transition-all border",
                                            filterType === type
                                                ? "border-blue-400 bg-blue-50 dark:bg-blue-900/20 shadow-sm"
                                                : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 hover:border-slate-300"
                                        )}
                                    >
                                        <div className={cn("text-xs font-bold", config.color)}>{count}</div>
                                        <div className="text-[10px] text-slate-500 font-medium mt-0.5">{config.label}</div>
                                    </button>
                                );
                            })}
                        </div>

                        {/* Notification List */}
                        {isLoading ? (
                            <div className="flex items-center justify-center py-20">
                                <RefreshCw className="w-6 h-6 animate-spin text-slate-400" />
                            </div>
                        ) : filteredNotifications.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                                <Bell className="w-16 h-16 mb-4 opacity-20" />
                                <p className="text-lg font-bold text-slate-500">No notifications found</p>
                                <p className="text-sm mt-1">
                                    {searchTerm || filterType !== "ALL" || filterPriority !== "ALL" || filterStatus !== "ALL"
                                        ? "Try adjusting your filters"
                                        : "You're all caught up! 🎉"}
                                </p>
                            </div>
                        ) : groupByType && groupedNotifications ? (
                            /* Grouped View */
                            <div className="space-y-4">
                                {Array.from(groupedNotifications.entries()).map(([type, items]) => {
                                    const config = TYPE_CONFIG[type] || { label: type, color: "text-slate-600", bg: "bg-slate-100" };
                                    const isExpanded = expandedGroups.has(type) || expandedGroups.size === 0;
                                    const unreadInGroup = items.filter(n => !n.isRead).length;

                                    return (
                                        <div key={type} className="rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden bg-white dark:bg-slate-950">
                                            <button
                                                onClick={() => toggleExpandGroup(type)}
                                                className={cn(
                                                    "w-full flex items-center justify-between p-4 transition-colors",
                                                    "hover:bg-slate-50 dark:hover:bg-slate-900/50",
                                                    config.bg, "bg-opacity-50 dark:bg-opacity-10"
                                                )}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", config.bg)}>
                                                        {getTypeIcon(type)}
                                                    </div>
                                                    <div className="text-left">
                                                        <h3 className="text-sm font-bold text-slate-800 dark:text-white">
                                                            {config.label} Notifications
                                                        </h3>
                                                        <p className="text-[11px] text-slate-500">
                                                            {items.length} total · {unreadInGroup} unread
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    {unreadInGroup > 0 && (
                                                        <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100 text-[10px] h-5">
                                                            {unreadInGroup}
                                                        </Badge>
                                                    )}
                                                    {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                                                </div>
                                            </button>
                                            {isExpanded && (
                                                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                                                    {items.map(notification => (
                                                        <NotificationRow
                                                            key={notification.id}
                                                            notification={notification}
                                                            isSelected={selectedIds.has(notification.id)}
                                                            onToggleSelect={toggleSelect}
                                                            onClick={handleNotificationClick}
                                                            onMarkRead={id => markAsReadMutation.mutate(id)}
                                                            onDelete={id => deleteMutation.mutate(id)}
                                                        />
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            /* Flat View */
                            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-950">
                                {filteredNotifications.map(notification => (
                                    <NotificationRow
                                        key={notification.id}
                                        notification={notification}
                                        isSelected={selectedIds.has(notification.id)}
                                        onToggleSelect={toggleSelect}
                                        onClick={handleNotificationClick}
                                        onMarkRead={id => markAsReadMutation.mutate(id)}
                                        onDelete={id => deleteMutation.mutate(id)}
                                    />
                                ))}
                            </div>
                        )}

                        {/* Footer */}
                        <div className="mt-6 text-center">
                            <p className="text-[11px] text-slate-400">
                                Notifications older than 30 days are automatically cleaned up.
                            </p>
                        </div>
                    </div>
                </main>
            </div>
        </div>
    );
}

// Notification Row Component
function NotificationRow({
    notification,
    isSelected,
    onToggleSelect,
    onClick,
    onMarkRead,
    onDelete,
}: {
    notification: Notification;
    isSelected: boolean;
    onToggleSelect: (id: string) => void;
    onClick: (n: Notification) => void;
    onMarkRead: (id: string) => void;
    onDelete: (id: string) => void;
}) {
    const config = TYPE_CONFIG[notification.type] || { label: notification.type, color: "text-slate-600", bg: "bg-slate-100" };
    const priorityConfig = PRIORITY_CONFIG[notification.priority] || { label: notification.priority, color: "text-slate-400", dot: "bg-slate-300" };

    return (
        <div
            className={cn(
                "group flex items-start gap-3 p-4 transition-all cursor-pointer",
                "hover:bg-slate-50 dark:hover:bg-slate-900/30",
                notification.isRead
                    ? "bg-white dark:bg-slate-950"
                    : "bg-blue-50/30 dark:bg-blue-900/10 border-l-[3px] border-l-blue-500",
                isSelected && "ring-2 ring-blue-400 bg-blue-50/50"
            )}
        >
            {/* Checkbox */}
            <div className="pt-0.5" onClick={e => e.stopPropagation()}>
                <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => onToggleSelect(notification.id)}
                    className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity data-[state=checked]:opacity-100"
                />
            </div>

            {/* Icon */}
            <div
                className="flex-shrink-0"
                onClick={() => onClick(notification)}
            >
                <div className={cn(
                    "w-10 h-10 rounded-xl flex items-center justify-center",
                    config.bg, "bg-opacity-60"
                )}>
                    {TYPE_CONFIG[notification.type]?.icon || <Bell className="w-4 h-4" />}
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0" onClick={() => onClick(notification)}>
                <div className="flex items-start justify-between gap-2">
                    <h4 className={cn(
                        "text-sm font-semibold truncate",
                        notification.isRead ? "text-slate-600 dark:text-slate-400" : "text-slate-900 dark:text-white"
                    )}>
                        {notification.title}
                    </h4>
                    <div className="flex items-center gap-2 flex-shrink-0">
                        {!notification.isRead && (
                            <span className="flex h-2 w-2 rounded-full bg-blue-600"></span>
                        )}
                        {notification.priority === "CRITICAL" && (
                            <span className="flex h-2 w-2 rounded-full bg-red-600 animate-pulse"></span>
                        )}
                    </div>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2 leading-relaxed">
                    {notification.message}
                </p>
                <div className="flex items-center gap-2 mt-1.5">
                    <Badge
                        variant="outline"
                        className="text-[9px] px-1.5 py-0 h-4 font-medium rounded-md"
                    >
                        {config.label}
                    </Badge>
                    <Badge
                        variant="outline"
                        className={cn(
                            "text-[9px] px-1.5 py-0 h-4 font-bold rounded-md",
                            priorityConfig.color
                        )}
                    >
                        {priorityConfig.label}
                    </Badge>
                    <span className="text-[10px] text-slate-400 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatTime(notification.createdAt)}
                    </span>
                </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                {!notification.isRead && (
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 rounded-lg"
                        onClick={e => { e.stopPropagation(); onMarkRead(notification.id); }}
                        title="Mark as read"
                    >
                        <EyeOff className="w-3.5 h-3.5 text-blue-500" />
                    </Button>
                )}
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 rounded-lg hover:text-red-500"
                    onClick={e => { e.stopPropagation(); onDelete(notification.id); }}
                    title="Delete"
                >
                    <Trash2 className="w-3.5 h-3.5" />
                </Button>
            </div>
        </div>
    );
}

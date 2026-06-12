"use client";

import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { 
    Bell, 
    Settings, 
    Trash2, 
    CheckCheck, 
    Search, 
    ChevronRight, 
    Warehouse, 
    HardHat, 
    FolderKanban, 
    Receipt, 
    AlertCircle, 
    Calendar,
    BellOff
} from "lucide-react";
import { format } from 'date-fns';

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

interface Preference {
    id: string;
    type: string;
    enabled: boolean;
}

export default function NotificationManagerPage() {
    const queryClient = useQueryClient();
    const [userId, setUserId] = useState<string | null>(null);
    const [mounted, setMounted] = useState(false);
    const [activeTab, setActiveTab] = useState<string>('ALL');
    const [statusFilter, setStatusFilter] = useState<'ALL' | 'UNREAD'>('ALL');
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        const timer = setTimeout(() => {
            setMounted(true);
            const storedUser = localStorage.getItem('user');
            if (storedUser) {
                try {
                    setUserId(JSON.parse(storedUser).id);
                } catch (e) {
                    console.error("Failed to parse user", e);
                }
            }
        }, 0);
        return () => clearTimeout(timer);
    }, []);

    // 1. Fetch user notifications
    const { data: notifications = [] } = useQuery<Notification[]>({
        queryKey: ["notifications", userId],
        queryFn: async () => {
            if (!userId) return [];
            const res = await fetch(`/api/notifications`);
            if (!res.ok) return [];
            return res.json();
        },
        enabled: !!userId,
    });

    // 2. Fetch notification preferences
    const { data: preferences = [], refetch: refetchPreferences } = useQuery<Preference[]>({
        queryKey: ["notification-preferences"],
        queryFn: async () => {
            const res = await fetch("/api/notifications/preferences");
            if (!res.ok) return [];
            return res.json();
        },
        enabled: !!userId,
    });

    // --- MUTATIONS ---
    
    // Toggle preferences
    const toggleMutation = useMutation({
        mutationFn: async ({ type, enabled }: { type: string; enabled: boolean }) => {
            const res = await fetch("/api/notifications/preferences", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ type, enabled }),
            });
            if (!res.ok) throw new Error("Failed to update preference");
            return res.json();
        },
        onSuccess: () => {
            refetchPreferences();
            toast.success("Preferences updated successfully");
        },
        onError: () => {
            toast.error("Failed to update preferences");
        }
    });

    // Mark as read
    const markAsReadMutation = useMutation({
        mutationFn: async (id: string) => {
            const res = await fetch(`/api/notifications/${id}`, {
                method: "PATCH"
            });
            if (!res.ok) throw new Error("Failed to mark as read");
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["notifications"] });
        }
    });

    // Mark all as read
    const markAllReadMutation = useMutation({
        mutationFn: async () => {
            const res = await fetch("/api/notifications", {
                method: "PATCH"
            });
            if (!res.ok) throw new Error("Failed to mark all as read");
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["notifications"] });
            toast.success("All notifications marked as read");
        }
    });

    // Delete single notification
    const deleteMutation = useMutation({
        mutationFn: async (id: string) => {
            const res = await fetch(`/api/notifications/${id}`, {
                method: "DELETE"
            });
            if (!res.ok) throw new Error("Failed to delete notification");
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["notifications"] });
            toast.success("Notification deleted");
        }
    });

    // Clear all notifications
    const clearAllMutation = useMutation({
        mutationFn: async () => {
            const res = await fetch("/api/notifications", {
                method: "DELETE"
            });
            if (!res.ok) throw new Error("Failed to clear notifications");
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["notifications"] });
            toast.success("All notifications cleared");
        }
    });

    // --- LOGIC / FILTERING ---

    const getPrefLabel = (type: string) => {
        const labels: Record<string, string> = {
            'INVENTORY': 'Inventory & Stock Alerts',
            'PROJECT': 'SOD & Project Updates',
            'CONTRACTOR': 'Contractor Registrations',
            'SYSTEM': 'System Notifications',
            'FINANCE': 'Finance & Invoices'
        };
        return labels[type] || type;
    };

    const isPrefEnabled = (type: string) => {
        const pref = preferences.find(p => p.type === type);
        return pref ? pref.enabled : true;
    };

    const getNotificationIcon = (type: string) => {
        switch (type) {
            case 'INVENTORY': return <Warehouse className="w-4 h-4 text-orange-500" />;
            case 'CONTRACTOR': return <HardHat className="w-4 h-4 text-blue-500" />;
            case 'PROJECT': return <FolderKanban className="w-4 h-4 text-purple-500" />;
            case 'FINANCE': return <Receipt className="w-4 h-4 text-emerald-500" />;
            default: return <Bell className="w-4 h-4 text-slate-500" />;
        }
    };

    const getNotificationColor = (type: string) => {
        switch (type) {
            case 'INVENTORY': return 'bg-orange-50 border-orange-200/50 dark:bg-orange-950/10 dark:border-orange-500/20';
            case 'CONTRACTOR': return 'bg-blue-50 border-blue-200/50 dark:bg-blue-950/10 dark:border-blue-500/20';
            case 'PROJECT': return 'bg-purple-50 border-purple-200/50 dark:bg-purple-950/10 dark:border-purple-500/20';
            case 'FINANCE': return 'bg-emerald-50 border-emerald-200/50 dark:bg-emerald-950/10 dark:border-emerald-500/20';
            default: return 'bg-slate-50 border-slate-200/50 dark:bg-slate-900/10 dark:border-slate-800/20';
        }
    };

    // Filter notifications based on tabs, search and status
    const filteredNotifications = notifications.filter(n => {
        // Tab Category Filter
        if (activeTab !== 'ALL' && n.type !== activeTab) return false;
        
        // Read/Unread Filter
        if (statusFilter === 'UNREAD' && n.isRead) return false;

        // Search Filter
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            const titleMatch = n.title?.toLowerCase().includes(query) || false;
            const msgMatch = n.message?.toLowerCase().includes(query) || false;
            return titleMatch || msgMatch;
        }

        return true;
    });

    const unreadCount = notifications.filter(n => !n.isRead).length;

    if (!mounted || !userId) return null;

    return (
        <div className="h-screen flex bg-[#f8fafc] overflow-hidden text-xs">
            <Sidebar />
            <div className="flex-1 flex flex-col min-w-0">
                <Header />
                <main className="flex-1 overflow-y-auto pt-0">

                    {/* Gradient Header Hero */}
                    <div className="h-44 bg-slate-900 relative">
                        <div className="absolute inset-0 bg-gradient-to-r from-blue-600/30 via-sky-600/10 to-transparent" />
                        <div className="max-w-5xl mx-auto px-8 h-full flex items-end pb-8 relative z-10">
                            <div className="flex items-center gap-5">
                                <div className="w-14 h-14 rounded-2xl bg-white/10 backdrop-blur-md shadow-2xl flex items-center justify-center text-white border border-white/20">
                                    <Bell className="w-7 h-7 text-sky-400 animate-swing" />
                                </div>
                                <div className="text-white space-y-1">
                                    <h1 className="text-2xl font-black tracking-tight flex items-center gap-2">
                                        Notification Center
                                    </h1>
                                    <p className="text-[10px] text-slate-300 font-medium uppercase tracking-wider">
                                        Manage your system alerts and notification preferences
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="max-w-5xl mx-auto px-8 -mt-8 relative z-20 pb-12">
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                            {/* Left Panel: Notifications List & Tabs */}
                            <div className="lg:col-span-2 space-y-5">
                                <Card className="border-none shadow-sm rounded-3xl overflow-hidden bg-white">
                                    <CardHeader className="pb-4 border-b">
                                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                            <div className="flex items-center gap-2">
                                                <CardTitle className="text-sm font-bold">Activity Log</CardTitle>
                                                {unreadCount > 0 && (
                                                    <Badge className="bg-red-500 text-white font-bold border-none text-[9px] px-1.5 py-0.5">
                                                        {unreadCount} New
                                                    </Badge>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Button 
                                                    variant="ghost" 
                                                    size="sm" 
                                                    disabled={unreadCount === 0 || markAllReadMutation.isPending}
                                                    onClick={() => markAllReadMutation.mutate()}
                                                    className="h-8 px-2.5 text-[10px] font-bold text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-xl"
                                                >
                                                    <CheckCheck className="w-3.5 h-3.5 mr-1" /> Mark All Read
                                                </Button>
                                                <Button 
                                                    variant="ghost" 
                                                    size="sm" 
                                                    disabled={notifications.length === 0 || clearAllMutation.isPending}
                                                    onClick={() => {
                                                        if (confirm("Are you sure you want to delete all notifications?")) {
                                                            clearAllMutation.mutate();
                                                        }
                                                    }}
                                                    className="h-8 px-2.5 text-[10px] font-bold text-rose-500 hover:text-rose-600 hover:bg-rose-50 rounded-xl"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5 mr-1" /> Clear All
                                                </Button>
                                            </div>
                                        </div>

                                        {/* Filters Controls */}
                                        <div className="flex flex-col md:flex-row gap-3 pt-3">
                                            <div className="relative flex-1">
                                                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                                                <Input 
                                                    type="text" 
                                                    placeholder="Search notifications..."
                                                    value={searchQuery}
                                                    onChange={e => setSearchQuery(e.target.value)}
                                                    className="h-9 pl-9 pr-4 text-[11px] rounded-xl border-slate-200/80 focus:border-blue-500 placeholder:opacity-50"
                                                />
                                            </div>
                                            <div className="flex bg-slate-100 p-1 rounded-xl gap-1 h-9">
                                                <button
                                                    onClick={() => setStatusFilter('ALL')}
                                                    className={`px-3 py-1 rounded-lg font-bold text-[10px] transition-all ${
                                                        statusFilter === 'ALL' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'
                                                    }`}
                                                >
                                                    All
                                                </button>
                                                <button
                                                    onClick={() => setStatusFilter('UNREAD')}
                                                    className={`px-3 py-1 rounded-lg font-bold text-[10px] transition-all ${
                                                        statusFilter === 'UNREAD' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'
                                                    }`}
                                                >
                                                    Unread
                                                </button>
                                            </div>
                                        </div>

                                        {/* Categories horizontal scroll tabs */}
                                        <div className="flex items-center gap-1.5 overflow-x-auto py-1 pt-3 border-t border-slate-100 no-scrollbar">
                                            {[
                                                { id: 'ALL', label: 'All', icon: Bell },
                                                { id: 'SYSTEM', label: 'System', icon: Settings },
                                                { id: 'INVENTORY', label: 'Inventory', icon: Warehouse },
                                                { id: 'CONTRACTOR', label: 'Contractors', icon: HardHat },
                                                { id: 'PROJECT', label: 'SOD/Projects', icon: FolderKanban },
                                                { id: 'FINANCE', label: 'Finance', icon: Receipt }
                                            ].map(tab => {
                                                const TabIcon = tab.icon;
                                                return (
                                                    <button
                                                        key={tab.id}
                                                        onClick={() => setActiveTab(tab.id)}
                                                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-bold border transition-all ${
                                                            activeTab === tab.id 
                                                                ? 'bg-slate-900 border-slate-900 text-white shadow-md' 
                                                                : 'bg-white border-slate-100 hover:border-slate-200 text-slate-500 hover:text-slate-700'
                                                        }`}
                                                    >
                                                        <TabIcon className="w-3.5 h-3.5" />
                                                        {tab.label}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </CardHeader>
                                    <CardContent className="p-0">
                                        <div className="divide-y divide-slate-100 max-h-[500px] overflow-y-auto custom-scrollbar">
                                            {filteredNotifications.length > 0 ? (
                                                filteredNotifications.map((n, index) => (
                                                    <div 
                                                        key={n.id}
                                                        className={`p-4 hover:bg-slate-50/80 transition-all flex items-start justify-between gap-4 border-l-4 group ${
                                                            n.isRead ? 'border-l-transparent' : 'border-l-blue-600 bg-blue-50/30'
                                                        }`}
                                                        style={{
                                                            animation: 'fadeIn 0.3s ease-out forwards',
                                                            animationDelay: `${index * 0.05}s`
                                                        }}
                                                    >
                                                        <div className="flex gap-3.5 flex-1 min-w-0">
                                                            <div className={`w-9 h-9 rounded-xl flex items-center justify-center shadow-sm border ${getNotificationColor(n.type)}`}>
                                                                {getNotificationIcon(n.type)}
                                                            </div>
                                                            <div className="flex-1 min-w-0">
                                                                <div className="flex items-center gap-2">
                                                                    <h3 className={`text-xs font-bold truncate ${n.isRead ? 'text-slate-700' : 'text-slate-900'}`}>
                                                                        {n.title}
                                                                    </h3>
                                                                    {n.priority === 'CRITICAL' && (
                                                                        <Badge className="bg-red-500 text-[8px] font-black uppercase text-white px-1.5 py-0">Critical</Badge>
                                                                    )}
                                                                </div>
                                                                <p className="text-[11px] text-slate-500 mt-1 leading-relaxed break-words">
                                                                    {n.message}
                                                                </p>
                                                                <div className="flex items-center gap-2.5 mt-2">
                                                                    <span className="text-[9px] font-bold uppercase text-slate-400">{n.type}</span>
                                                                    <span className="text-slate-200 font-bold">•</span>
                                                                    <div className="flex items-center text-slate-400 gap-1">
                                                                        <Calendar className="w-3 h-3" />
                                                                        <span className="text-[9px]">{format(new Date(n.createdAt), 'MMM dd, yyyy HH:mm')}</span>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                            {!n.isRead && (
                                                                <Button 
                                                                    variant="ghost" 
                                                                    size="icon" 
                                                                    onClick={() => markAsReadMutation.mutate(n.id)}
                                                                    title="Mark as Read"
                                                                    className="h-7 w-7 text-blue-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
                                                                >
                                                                    <CheckCheck className="w-4 h-4" />
                                                                </Button>
                                                            )}
                                                            <Button 
                                                                variant="ghost" 
                                                                size="icon" 
                                                                onClick={() => deleteMutation.mutate(n.id)}
                                                                title="Delete Alert"
                                                                className="h-7 w-7 text-rose-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg"
                                                            >
                                                                <Trash2 className="w-4 h-4" />
                                                            </Button>
                                                            {n.link && (
                                                                <Button 
                                                                    variant="ghost" 
                                                                    size="icon" 
                                                                    onClick={() => window.location.href = n.link!}
                                                                    title="Open Link"
                                                                    className="h-7 w-7 text-slate-500 hover:text-slate-600 hover:bg-slate-100 rounded-lg"
                                                                >
                                                                    <ChevronRight className="w-4 h-4" />
                                                                </Button>
                                                            )}
                                                        </div>
                                                    </div>
                                                ))
                                            ) : (
                                                <div className="p-16 text-center text-slate-400 flex flex-col items-center justify-center gap-3">
                                                    <BellOff className="w-12 h-12 text-slate-300 stroke-1" />
                                                    <div>
                                                        <div className="font-bold text-slate-500">No Notifications Found</div>
                                                        <div className="text-[10px] text-slate-400 mt-1">There are no updates matching your current filters</div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>

                            {/* Right Panel: Settings & Preferences */}
                            <div className="space-y-5">
                                <Card className="border-none shadow-sm rounded-3xl overflow-hidden bg-slate-900 text-white relative">
                                    <div className="absolute inset-0 bg-gradient-to-br from-blue-700/20 via-transparent to-slate-950" />
                                    <CardHeader className="relative z-10 pb-4 border-b border-white/5">
                                        <CardTitle className="text-sm font-bold flex items-center gap-2">
                                            <Settings className="w-4 h-4 text-sky-400" /> Preferences
                                        </CardTitle>
                                        <CardDescription className="text-[10px] text-slate-400">Configure which event categories you want to monitor</CardDescription>
                                    </CardHeader>
                                    <CardContent className="relative z-10 p-0 divide-y divide-white/5">
                                        {['SYSTEM', 'INVENTORY', 'CONTRACTOR', 'PROJECT', 'FINANCE'].map(type => (
                                            <div key={type} className="p-5 flex items-center justify-between hover:bg-white/[0.02] transition-colors">
                                                <div className="space-y-0.5">
                                                    <div className="font-bold text-white text-xs">{getPrefLabel(type)}</div>
                                                    <div className="text-[9px] text-slate-400">Enable/disable triggers for this category</div>
                                                </div>
                                                <Switch 
                                                    checked={isPrefEnabled(type)}
                                                    onCheckedChange={(checked) => toggleMutation.mutate({ type, enabled: checked })}
                                                    disabled={toggleMutation.isPending}
                                                    className="data-[state=checked]:bg-sky-500"
                                                />
                                            </div>
                                        ))}
                                    </CardContent>
                                    <div className="p-4 bg-sky-500/10 border-t border-white/5 relative z-10 flex items-start gap-2.5">
                                        <AlertCircle className="w-4 h-4 text-sky-400 flex-shrink-0 mt-0.5" />
                                        <p className="text-[9.5px] text-sky-200 leading-normal">
                                            Critical admin security events and mandatory password updates are always bypass toggles and will notify you regardless.
                                        </p>
                                    </div>
                                </Card>
                            </div>

                        </div>
                    </div>
                </main>
            </div>
        </div>
    );
}

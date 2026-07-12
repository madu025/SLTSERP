"use client";

import React, { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import Link from 'next/link';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { User, Shield, Building2, Warehouse, Users, History, Lock, Mail, CreditCard, ChevronRight, Bell } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { format } from 'date-fns';

interface ProfileUser {
    id: string;
    username: string;
    name?: string;
    role: string;
}

interface AuditLog {
    id: string;
    action: string;
    entity: string;
    createdAt: string;
}

interface AccessibleOpmc {
    id: string;
    rtom: string;
    name: string;
}

export default function ProfilePage() {
    const [user, setUser] = useState<ProfileUser | null>(null);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        const timer = setTimeout(() => {
            const storedUser = localStorage.getItem('user');
            if (storedUser) {
                try {
                    setUser(JSON.parse(storedUser));
                } catch (e) {
                    console.error("Failed to parse user from localStorage", e);
                }
            }
            setMounted(true);
        }, 0);
        return () => clearTimeout(timer);
    }, []);

    const { data: profileDetails } = useQuery({
        queryKey: ["profile-details"],
        queryFn: async () => {
            const res = await fetch("/api/profile");
            if (!res.ok) return null;
            return res.json();
        },
        enabled: !!user,
    });

    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [pwdError, setPwdError] = useState('');
    const [pwdSuccess, setPwdSuccess] = useState('');

    const changePasswordMutation = useMutation({
        mutationFn: async () => {
            if (!currentPassword || !newPassword || !confirmPassword) {
                throw new Error('All fields are required');
            }
            if (newPassword !== confirmPassword) {
                throw new Error('New password and confirmation do not match');
            }
            if (newPassword.length < 6) {
                throw new Error('Password must be at least 6 characters long');
            }

            const res = await fetch('/api/profile/change-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ currentPassword, newPassword })
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.message || 'Failed to change password');
            }

            return res.json();
        },
        onSuccess: () => {
            setPwdSuccess('Password updated successfully!');
            setPwdError('');
            setCurrentPassword('');
            setNewPassword('');
            setConfirmPassword('');
        },
        onError: (err: Error) => {
            setPwdError(err.message);
            setPwdSuccess('');
        }
    });

    const [editName, setEditName] = useState('');
    const [editEmail, setEditEmail] = useState('');
    const [isEditing, setIsEditing] = useState(false);
    const [profileError, setProfileError] = useState('');
    const [pushEnabled, setPushEnabled] = useState(true);

    const updateProfileMutation = useMutation({
        mutationFn: async () => {
            if (!editName || !editEmail) {
                throw new Error('Name and Email are required');
            }
            const res = await fetch('/api/profile', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: editName, email: editEmail })
            });
            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.message || 'Failed to update profile');
            }
            return res.json();
        },
        onSuccess: (data) => {
            setProfileError('');
            setIsEditing(false);
            if (typeof window !== 'undefined') {
                const storedUser = localStorage.getItem('user');
                if (storedUser) {
                    const parsed = JSON.parse(storedUser);
                    parsed.name = data.name;
                    localStorage.setItem('user', JSON.stringify(parsed));
                }
            }
            window.location.reload();
        },
        onError: (err: Error) => {
            setProfileError(err.message);
        }
    });

    const exportAuditLogs = () => {
        if (!profileDetails?.auditLogs || profileDetails.auditLogs.length === 0) return;
        const headers = ['Action', 'Entity', 'Date'];
        const rows = profileDetails.auditLogs.map((log: AuditLog) => [
            log.action,
            log.entity,
            format(new Date(log.createdAt), 'yyyy-MM-dd HH:mm:ss')
        ]);
        const csvContent = "data:text/csv;charset=utf-8," 
            + [headers.join(','), ...rows.map((r: string[]) => r.join(','))].join('\n');
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `audit_log_${user?.username || 'user'}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const { data: notificationPrefs, refetch: refetchPrefs } = useQuery({
        queryKey: ["notification-preferences"],
        queryFn: async () => {
            const res = await fetch("/api/notifications/preferences");
            if (!res.ok) return [];
            return res.json();
        },
        enabled: !!user,
    });

    const toggleMutation = useMutation({
        mutationFn: async ({ type, enabled }: { type: string; enabled: boolean }) => {
            const res = await fetch("/api/notifications/preferences", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ type, enabled }),
            });
            if (!res.ok) throw new Error("Failed");
            return res.json();
        },
        onSuccess: () => {
            refetchPrefs();
        },
    });

    const PREF_LABELS: Record<string, string> = {
        'INVENTORY': 'Inventory & Stock',
        'PROJECT': 'SOD & Project Updates',
        'CONTRACTOR': 'Contractor Registration',
        'SYSTEM': 'System Notifications',
        'FINANCE': 'Finance & Invoices'
    };

    const isEnabled = (type: string) => {
        const pref = notificationPrefs?.find((p: { type: string; enabled: boolean }) => p.type === type);
        return pref ? pref.enabled : true; // Default to true if not set
    };

    if (!mounted || !user) return null;

    return (
        <div className="h-screen flex bg-[#f8fafc] overflow-hidden text-xs">
            <Sidebar />
            <div className="flex-1 flex flex-col min-w-0">
                <Header />
                <main className="flex-1 overflow-y-auto pt-0">

                    {/* Hero Header */}
                    <div className="h-48 bg-slate-900 relative">
                        <div className="absolute inset-0 bg-gradient-to-r from-blue-600/20 to-transparent" />
                        <div className="max-w-5xl mx-auto px-8 h-full flex items-end pb-8 relative z-10">
                            <div className="flex items-center gap-6">
                                <div className="w-24 h-24 rounded-3xl bg-white shadow-2xl border-4 border-white flex items-center justify-center text-4xl font-bold text-slate-900">
                                    {user.name?.[0] || user.username?.[0]}
                                </div>
                                <div className="text-white space-y-1">
                                    <h1 className="text-3xl font-bold tracking-tight">{user.name}</h1>
                                    <div className="flex items-center gap-2 text-slate-300 font-medium">
                                        <Badge variant="secondary" className="bg-blue-500/10 text-blue-400 border-blue-500/20 text-[10px] py-0">
                                            {user.role}
                                        </Badge>
                                        <span>•</span>
                                        <span className="opacity-80">@{user.username}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="max-w-5xl mx-auto px-8 -mt-8 relative z-20 pb-12">
                        <Tabs defaultValue="overview" className="space-y-6">
                            <TabsList className="bg-white border p-1 rounded-2xl shadow-sm h-12 w-full max-w-md">
                                <TabsTrigger value="overview" className="flex-1 rounded-xl data-[state=active]:bg-slate-900 data-[state=active]:text-white">Overview</TabsTrigger>
                                <TabsTrigger value="access" className="flex-1 rounded-xl data-[state=active]:bg-slate-900 data-[state=active]:text-white">Access & Scope</TabsTrigger>
                                <TabsTrigger value="notifications" className="flex-1 rounded-xl data-[state=active]:bg-slate-900 data-[state=active]:text-white">Notifications</TabsTrigger>
                                <TabsTrigger value="security" className="flex-1 rounded-xl data-[state=active]:bg-slate-900 data-[state=active]:text-white">Security</TabsTrigger>
                            </TabsList>

                            <TabsContent value="overview" className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">

                                {/* Info Cards */}
                                <Card className="md:col-span-2 border-none shadow-sm rounded-3xl">
                                    <CardHeader>
                                        <CardTitle className="text-sm font-bold flex items-center gap-2">
                                            <User className="w-4 h-4 text-blue-500" /> Account Identity
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="grid grid-cols-2 gap-8 py-6">
                                        <div className="space-y-1.5">
                                            <div className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Corporate Email</div>
                                            <div className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                                                <Mail className="w-3.5 h-3.5 text-slate-300" /> {profileDetails?.email || 'Loading...'}
                                            </div>
                                        </div>
                                        <div className="space-y-1.5">
                                            <div className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Employee ID</div>
                                            <div className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                                                <CreditCard className="w-3.5 h-3.5 text-slate-300" /> {profileDetails?.staff?.employeeId || 'N/A'}
                                            </div>
                                        </div>
                                        <div className="space-y-1.5">
                                            <div className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Department</div>
                                            <div className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                                                <Building2 className="w-3.5 h-3.5 text-slate-300" /> {profileDetails?.sectionAssignments?.[0]?.section?.name || 'Operations'}
                                            </div>
                                        </div>
                                        <div className="space-y-1.5">
                                            <div className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Active Since</div>
                                            <div className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                                                <History className="w-3.5 h-3.5 text-slate-300" /> {profileDetails?.createdAt ? format(new Date(profileDetails.createdAt), 'MMMM yyyy') : '...'}
                                            </div>
                                        </div>
                                    </CardContent>
                                    <CardContent className="border-t pt-4">
                                        {isEditing ? (
                                            <div className="space-y-4">
                                                {profileError && (
                                                    <div className="p-3 bg-red-50 border border-red-100 rounded-xl text-red-600 text-xs font-semibold">
                                                        {profileError}
                                                    </div>
                                                )}
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div className="space-y-2">
                                                        <div className="text-[10px] font-bold uppercase text-slate-500">Display Name</div>
                                                        <Input 
                                                            value={editName} 
                                                            onChange={(e) => setEditName(e.target.value)} 
                                                            className="h-10 rounded-xl text-slate-700 bg-white" 
                                                        />
                                                    </div>
                                                    <div className="space-y-2">
                                                        <div className="text-[10px] font-bold uppercase text-slate-500">Corporate Email</div>
                                                        <Input 
                                                            value={editEmail} 
                                                            onChange={(e) => setEditEmail(e.target.value)} 
                                                            className="h-10 rounded-xl text-slate-700 bg-white" 
                                                        />
                                                    </div>
                                                </div>
                                                <div className="flex gap-2 justify-end">
                                                    <Button variant="ghost" size="sm" onClick={() => setIsEditing(false)} className="rounded-xl h-9">
                                                        Cancel
                                                    </Button>
                                                    <Button 
                                                        size="sm" 
                                                        onClick={() => updateProfileMutation.mutate()} 
                                                        disabled={updateProfileMutation.isPending} 
                                                        className="bg-slate-900 text-white rounded-xl h-9 hover:bg-slate-800"
                                                    >
                                                        {updateProfileMutation.isPending ? 'Saving...' : 'Save Changes'}
                                                    </Button>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="flex justify-end">
                                                <Button 
                                                    variant="outline" 
                                                    size="sm" 
                                                    className="rounded-xl h-9 border-slate-200 text-slate-700 font-bold hover:bg-slate-50"
                                                    onClick={() => {
                                                        setEditName(profileDetails?.name || user?.name || '');
                                                        setEditEmail(profileDetails?.email || '');
                                                        setIsEditing(true);
                                                    }}
                                                >
                                                    Edit Profile Details
                                                </Button>
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>


                                {/* Hierarchy Card */}
                                <Card className="border-none shadow-sm rounded-3xl bg-blue-600 text-white overflow-hidden relative">
                                    <div className="absolute top-0 right-0 p-4 opacity-10">
                                        <Users className="w-24 h-24" />
                                    </div>
                                    <CardHeader>
                                        <CardTitle className="text-sm font-bold">Organization Tree</CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-6 pb-6">
                                        <div className="space-y-2">
                                            <div className="text-[9px] uppercase font-bold opacity-60">Reports To</div>
                                            <div className="p-3 bg-white/10 rounded-2xl flex items-center gap-3 backdrop-blur-md border border-white/10">
                                                <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center font-bold">
                                                    {profileDetails?.supervisor?.name?.[0] || '?'}
                                                </div>
                                                <div className="min-w-0">
                                                    <div className="font-bold truncate text-[11px]">{profileDetails?.supervisor?.name || 'Direct Management'}</div>
                                                    <div className="text-[10px] opacity-60 truncate">{profileDetails?.supervisor?.role || 'System'}</div>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="space-y-2 pt-2 border-t border-white/10">
                                            <div className="text-[9px] uppercase font-bold opacity-60">Supervised Staff</div>
                                            <div className="text-2xl font-bold">{profileDetails?.subordinates?.length || 0}</div>
                                            <Link href="/admin/staff" className="text-[10px] opacity-80 underline cursor-pointer hover:text-white/80">View Team Directory</Link>
                                        </div>
                                    </CardContent>
                                </Card>

                                {/* System Activity Log Widget */}
                                <Card className="md:col-span-3 border-none shadow-sm rounded-3xl">
                                    <CardHeader className="flex flex-row items-center justify-between">
                                        <div>
                                            <CardTitle className="text-sm font-bold">Recent System Activity</CardTitle>
                                            <CardDescription className="text-[10px]">Your latest administrative interactions</CardDescription>
                                        </div>
                                        <Button variant="ghost" size="sm" className="text-xs h-7 px-2" onClick={exportAuditLogs}>Export Log</Button>
                                    </CardHeader>
                                    <CardContent className="p-0">
                                        <div className="divide-y border-t">
                                            {profileDetails?.auditLogs?.length > 0 ? profileDetails.auditLogs.map((log: AuditLog) => (
                                                <div key={log.id} className="p-4 hover:bg-slate-50 transition-colors flex items-center justify-between">
                                                    <div className="flex items-center gap-4">
                                                        <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500">
                                                            <History className="w-4 h-4" />
                                                        </div>
                                                        <div>
                                                            <div className="font-bold text-slate-900">{log.action}</div>
                                                            <div className="text-[10px] text-slate-400">{log.entity} • {format(new Date(log.createdAt), 'MMM dd, HH:mm')}</div>
                                                        </div>
                                                    </div>
                                                    <ChevronRight className="w-4 h-4 text-slate-300" />
                                                </div>
                                            )) : (
                                                <div className="p-10 text-center text-slate-400 italic">No recent activity detected.</div>
                                            )}
                                        </div>
                                    </CardContent>
                                </Card>
                            </TabsContent>

                            <TabsContent value="access" className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                <Card className="border-none shadow-sm rounded-3xl">
                                    <CardHeader>
                                        <CardTitle className="text-sm font-bold flex items-center gap-2">
                                            <Building2 className="w-4 h-4 text-orange-500" /> OPMC Jurisdictions
                                        </CardTitle>
                                        <CardDescription className="text-[10px]">Operational areas you are authorized to manage</CardDescription>
                                    </CardHeader>
                                    <CardContent className="space-y-4">
                                        <div className="flex flex-wrap gap-2">
                                            {profileDetails?.accessibleOpmcs?.length > 0 ? profileDetails.accessibleOpmcs.map((opmc: AccessibleOpmc) => (
                                                <div key={opmc.id} className="px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl flex items-center gap-3">
                                                    <div className="w-8 h-8 bg-white shadow-sm border rounded-xl flex items-center justify-center font-bold text-blue-600">
                                                        {opmc.rtom}
                                                    </div>
                                                    <div className="font-semibold text-slate-700">{opmc.name}</div>
                                                </div>
                                            )) : <div className="text-slate-400 italic">No OPMC access assigned.</div>}
                                        </div>
                                    </CardContent>
                                </Card>

                                <Card className="border-none shadow-sm rounded-3xl">
                                    <CardHeader>
                                        <CardTitle className="text-sm font-bold flex items-center gap-2">
                                            <Warehouse className="w-4 h-4 text-green-500" /> Assigned Inventory Store
                                        </CardTitle>
                                        <CardDescription className="text-[10px]">Primary store for material allocations</CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        {profileDetails?.assignedStore ? (
                                            <div className="p-6 bg-slate-900 rounded-3xl text-white flex items-center justify-between overflow-hidden relative">
                                                <div className="relative z-10">
                                                    <div className="text-xs opacity-60 uppercase font-bold tracking-widest mb-1">Current Base</div>
                                                    <div className="text-xl font-bold">{profileDetails.assignedStore.name}</div>
                                                    <div className="mt-4 flex items-center gap-4">
                                                        <div className="text-center">
                                                            <div className="text-[10px] opacity-60">Items</div>
                                                            <div className="font-bold">142</div>
                                                        </div>
                                                        <div className="w-px h-6 bg-white/20" />
                                                        <div className="text-center">
                                                            <div className="text-[10px] opacity-60">Status</div>
                                                            <Badge className="bg-green-500/20 text-green-400 border-none text-[8px]">Active</Badge>
                                                        </div>
                                                    </div>
                                                </div>
                                                <Warehouse className="w-32 h-32 absolute -right-8 -bottom-8 opacity-10" />
                                            </div>
                                        ) : (
                                            <div className="p-10 border-2 border-dashed rounded-3xl text-center text-slate-400 italic">
                                                No specific store assigned.
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                            </TabsContent>

                            <TabsContent value="notifications" className="max-w-2xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 w-full">
                                <Card className="border-none shadow-sm rounded-3xl overflow-hidden">
                                    <CardHeader className="bg-white border-b">
                                        <CardTitle className="text-sm font-bold flex items-center gap-2">
                                            <Bell className="w-4 h-4 text-blue-500" /> Real-time Alert Preferences
                                        </CardTitle>
                                        <CardDescription className="text-[10px]">Customize which types of notifications you receive on the dashboard</CardDescription>
                                    </CardHeader>
                                    <CardContent className="p-0">
                                        <div className="divide-y divide-slate-100">
                                            {Object.keys(PREF_LABELS).map((type) => (
                                                <div key={type} className="p-6 flex items-center justify-between hover:bg-slate-50 transition-colors">
                                                    <div className="space-y-1">
                                                        <div className="font-bold text-slate-900 text-sm">{PREF_LABELS[type]}</div>
                                                        <div className="text-[10px] text-slate-500">Enable/Disable alerts for {PREF_LABELS[type].toLowerCase()} events</div>
                                                    </div>
                                                    <Switch
                                                        checked={isEnabled(type)}
                                                        onCheckedChange={(checked) => toggleMutation.mutate({ type, enabled: checked })}
                                                        disabled={toggleMutation.isPending}
                                                    />
                                                </div>
                                            ))}
                                        </div>
                                    </CardContent>
                                    <div className="p-4 bg-blue-50/50 border-t border-blue-100 flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                                            <Shield className="w-4 h-4" />
                                        </div>
                                        <p className="text-[10px] text-blue-700 leading-tight">
                                            <b>Note:</b> Critical system-wide alerts and password security notifications cannot be disabled.
                                        </p>
                                    </div>
                                </Card>
                            </TabsContent>

                            <TabsContent value="security" className="max-w-2xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 w-full">
                                <Card className="border-none shadow-sm rounded-3xl overflow-hidden">
                                    <CardHeader className="bg-white border-b">
                                        <CardTitle className="text-sm font-bold flex items-center gap-2">
                                            <Lock className="w-4 h-4 text-slate-400" /> Change Access Password
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="p-8 space-y-6">
                                        {pwdError && (
                                            <div className="p-3.5 bg-red-50 border border-red-100 rounded-xl text-red-600 text-xs font-semibold">
                                                {pwdError}
                                            </div>
                                        )}
                                        {pwdSuccess && (
                                            <div className="p-3.5 bg-green-50 border border-green-100 rounded-xl text-green-600 text-xs font-semibold">
                                                {pwdSuccess}
                                            </div>
                                        )}
                                        <div className="space-y-2">
                                            <div className="text-[10px] font-bold uppercase text-slate-500">Current Password</div>
                                            <Input 
                                                type="password" 
                                                placeholder="••••••••" 
                                                className="h-12 rounded-xl text-slate-700"
                                                value={currentPassword}
                                                onChange={(e) => setCurrentPassword(e.target.value)}
                                            />
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <div className="text-[10px] font-bold uppercase text-slate-500">New Password</div>
                                                <Input 
                                                    type="password" 
                                                    placeholder="••••••••" 
                                                    className="h-12 rounded-xl text-slate-700"
                                                    value={newPassword}
                                                    onChange={(e) => setNewPassword(e.target.value)}
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <div className="text-[10px] font-bold uppercase text-slate-500">Confirm New</div>
                                                <Input 
                                                    type="password" 
                                                    placeholder="••••••••" 
                                                    className="h-12 rounded-xl text-slate-700"
                                                    value={confirmPassword}
                                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                                />
                                            </div>
                                        </div>
                                        <Button 
                                            className="w-full h-12 bg-slate-900 rounded-xl font-bold shadow-xl shadow-slate-200 mt-4 text-white hover:bg-slate-800"
                                            onClick={() => changePasswordMutation.mutate()}
                                            disabled={changePasswordMutation.isPending}
                                        >
                                            {changePasswordMutation.isPending ? 'Updating...' : 'Update Password'}
                                        </Button>
                                    </CardContent>
                                </Card>

                                <Card className="border-none shadow-sm rounded-3xl overflow-hidden bg-slate-50">
                                    <CardContent className="p-6 flex items-center justify-between">
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 bg-white border rounded-xl flex items-center justify-center text-slate-500 shadow-sm">
                                                <Bell className="w-5 h-5" />
                                            </div>
                                            <div>
                                                <div className="font-bold text-slate-900">Push Notifications</div>
                                                <div className="text-[10px] text-slate-400">Receive real-time alerts on system events</div>
                                            </div>
                                        </div>
                                        <div 
                                            onClick={() => setPushEnabled(!pushEnabled)}
                                            className={`w-12 h-6 rounded-full flex items-center px-1 cursor-pointer transition-all duration-200 ${pushEnabled ? 'bg-blue-600 justify-end' : 'bg-slate-300 justify-start'}`}
                                        >
                                            <div className="w-4 h-4 bg-white rounded-full shadow-sm" />
                                        </div>
                                    </CardContent>
                                </Card>
                            </TabsContent>
                        </Tabs>
                    </div>
                </main>
            </div>
        </div>
    );
}

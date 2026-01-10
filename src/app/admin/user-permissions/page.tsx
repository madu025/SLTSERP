"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Shield, Check, X, Save } from "lucide-react";
import { toast } from "sonner";

// Available pages/modules
const AVAILABLE_PAGES = [
    { id: 'dashboard', name: 'Dashboard', icon: '📊' },
    { id: 'service-orders', name: 'Service Orders', icon: '📋' },
    { id: 'contractors', name: 'Contractors', icon: '👷' },
    { id: 'restore-requests', name: 'Restore Requests', icon: '🔧' },
    { id: 'invoices', name: 'Invoices', icon: '💰' },
    { id: 'inventory', name: 'Inventory / Stores', icon: '📦' },
    { id: 'procurement', name: 'Procurement', icon: '🛒' },
    { id: 'administration', name: 'Administration', icon: '⚙️' }
];

export default function UserPermissionsPage() {
    const queryClient = useQueryClient();
    const [selectedUser, setSelectedUser] = useState<string>('');
    const [permissions, setPermissions] = useState<string[]>([]);

    // Fetch users
    const { data: users = [] } = useQuery({
        queryKey: ['users'],
        queryFn: async () => {
            const res = await fetch('/api/users');
            if (!res.ok) throw new Error('Failed');
            return res.json();
        }
    });

    // Fetch user's section assignments and permissions
    const { data: assignments = [], isLoading } = useQuery({
        queryKey: ['user-permissions', selectedUser],
        queryFn: async () => {
            if (!selectedUser) return [];
            const res = await fetch(`/api/admin/users/${selectedUser}/permissions`);
            if (!res.ok) throw new Error('Failed');
            const data = await res.json();

            // Extract permissions from assignments
            const perms: string[] = (data as any[]).flatMap((a: any) => {
                try {
                    const parsed = JSON.parse(a.role.permissions || '[]');
                    return Array.isArray(parsed) ? (parsed as string[]) : [];
                } catch {
                    return [];
                }
            });
            setPermissions([...new Set(perms)]);
            return data;
        },
        enabled: !!selectedUser
    });

    // Update permissions
    const updateMutation = useMutation({
        mutationFn: async (newPermissions: string[]) => {
            const res = await fetch(`/api/admin/users/${selectedUser}/permissions`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ permissions: newPermissions })
            });
            if (!res.ok) throw new Error('Failed');
            return res.json();
        },
        onSuccess: () => {
            toast.success('Permissions updated!');
            queryClient.invalidateQueries({ queryKey: ['user-permissions', selectedUser] });
        },
        onError: () => toast.error('Failed to update permissions')
    });

    const togglePermission = (pageId: string) => {
        setPermissions(prev =>
            prev.includes(pageId)
                ? prev.filter(p => p !== pageId)
                : [...prev, pageId]
        );
    };

    const handleSave = () => {
        updateMutation.mutate(permissions);
    };

    const selectedUserData = users.find((u: any) => u.id === selectedUser);

    return (
        <div className="flex h-screen bg-slate-50 overflow-hidden">
            <Sidebar />
            <main className="flex-1 flex flex-col min-w-0 h-full">
                <Header />
                <div className="flex-1 overflow-y-auto p-4 md:p-6">
                    <div className="max-w-5xl mx-auto space-y-6">
                        {/* Header */}
                        <div className="flex items-center justify-between">
                            <div>
                                <h1 className="text-2xl font-bold text-slate-900">User Permissions</h1>
                                <p className="text-slate-500">Manage page access permissions for users</p>
                            </div>
                            {selectedUser && (
                                <Button
                                    onClick={handleSave}
                                    disabled={updateMutation.isPending}
                                    className="bg-blue-600 hover:bg-blue-700"
                                >
                                    <Save className="w-4 h-4 mr-2" />
                                    {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
                                </Button>
                            )}
                        </div>

                        {/* User Selector */}
                        <Card>
                            <CardHeader>
                                <CardTitle>Select User</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <Select value={selectedUser} onValueChange={setSelectedUser}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Choose a user..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {users.map((user: any) => (
                                            <SelectItem key={user.id} value={user.id}>
                                                {user.name} ({user.username}) - {user.role}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </CardContent>
                        </Card>

                        {/* Permissions Grid */}
                        {selectedUser && (
                            <Card>
                                <CardHeader>
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <CardTitle className="flex items-center gap-2">
                                                <Shield className="w-5 h-5" />
                                                Page Access Permissions
                                            </CardTitle>
                                            <p className="text-sm text-slate-500 mt-1">
                                                {selectedUserData?.name} - {selectedUserData?.role}
                                            </p>
                                        </div>
                                        <Badge variant="secondary">
                                            {permissions.length} / {AVAILABLE_PAGES.length} pages
                                        </Badge>
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    {isLoading ? (
                                        <div className="text-center p-8 text-slate-500">Loading...</div>
                                    ) : (
                                        <div className="space-y-4">
                                            {/* Section Assignments Info */}
                                            {assignments.length > 0 && (
                                                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                                                    <p className="text-sm font-semibold text-blue-900 mb-2">
                                                        Current Sections:
                                                    </p>
                                                    <div className="flex flex-wrap gap-2">
                                                        {assignments.map((a: any) => (
                                                            <Badge key={a.id} className="bg-blue-100 text-blue-700">
                                                                {a.section.name} - {a.role.name}
                                                            </Badge>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Permissions Grid */}
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                {AVAILABLE_PAGES.map(page => {
                                                    const hasAccess = permissions.includes(page.id);
                                                    return (
                                                        <label
                                                            key={page.id}
                                                            className={`flex items-center justify-between p-4 rounded-lg border-2 cursor-pointer transition-all ${hasAccess
                                                                ? 'border-green-500 bg-green-50'
                                                                : 'border-slate-200 bg-white hover:border-slate-300'
                                                                }`}
                                                        >
                                                            <div className="flex items-center gap-3">
                                                                <span className="text-2xl">{page.icon}</span>
                                                                <div>
                                                                    <div className="font-medium text-slate-900">
                                                                        {page.name}
                                                                    </div>
                                                                    <div className="text-xs text-slate-500">
                                                                        {page.id}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                {hasAccess ? (
                                                                    <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center">
                                                                        <Check className="w-5 h-5 text-white" />
                                                                    </div>
                                                                ) : (
                                                                    <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center">
                                                                        <X className="w-5 h-5 text-slate-400" />
                                                                    </div>
                                                                )}
                                                                <input
                                                                    type="checkbox"
                                                                    checked={hasAccess}
                                                                    onChange={() => togglePermission(page.id)}
                                                                    className="w-5 h-5 rounded"
                                                                />
                                                            </div>
                                                        </label>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
}

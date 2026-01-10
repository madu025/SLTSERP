"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Shield, Plus, Edit, Trash2, Layers } from "lucide-react";
import { toast } from "sonner";

// Page permissions options
const PAGE_PERMISSIONS = [
    { value: 'dashboard', label: 'Dashboard' },
    { value: 'service-orders', label: 'Service Orders' },
    { value: 'contractors', label: 'Contractors' },
    { value: 'restore-requests', label: 'Restore Requests' },
    { value: 'invoices', label: 'Invoices' },
    { value: 'inventory', label: 'Inventory / Stores' },
    { value: 'procurement', label: 'Procurement' },
    { value: 'administration', label: 'Administration' }
];

export default function SectionRolesPage() {
    const queryClient = useQueryClient();
    const [selectedSection, setSelectedSection] = useState<string>('');
    const [showDialog, setShowDialog] = useState(false);
    const [editingRole, setEditingRole] = useState<any>(null);
    const [formData, setFormData] = useState({
        name: '',
        code: '',
        description: '',
        level: 1,
        permissions: [] as string[]
    });

    // Fetch sections
    const { data: sections = [] } = useQuery({
        queryKey: ['sections'],
        queryFn: async () => {
            const res = await fetch('/api/admin/sections');
            if (!res.ok) throw new Error('Failed');
            return res.json();
        }
    });

    // Fetch roles for selected section
    const { data: roles = [], isLoading } = useQuery({
        queryKey: ['section-roles', selectedSection],
        queryFn: async () => {
            if (!selectedSection) return [];
            const res = await fetch(`/api/admin/sections/${selectedSection}/roles`);
            if (!res.ok) throw new Error('Failed');
            return res.json();
        },
        enabled: !!selectedSection
    });

    // Create/Update role
    const saveMutation = useMutation({
        mutationFn: async (data: any) => {
            const url = editingRole
                ? `/api/admin/sections/${selectedSection}/roles/${editingRole.id}`
                : `/api/admin/sections/${selectedSection}/roles`;
            const method = editingRole ? 'PATCH' : 'POST';

            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            if (!res.ok) throw new Error('Failed');
            return res.json();
        },
        onSuccess: () => {
            toast.success(editingRole ? 'Role updated!' : 'Role created!');
            queryClient.invalidateQueries({ queryKey: ['section-roles', selectedSection] });
            handleCloseDialog();
        },
        onError: () => toast.error('Failed to save role')
    });

    // Delete role
    const deleteMutation = useMutation({
        mutationFn: async (roleId: string) => {
            const res = await fetch(`/api/admin/sections/${selectedSection}/roles/${roleId}`, {
                method: 'DELETE'
            });
            if (!res.ok) throw new Error('Failed');
            return res.json();
        },
        onSuccess: () => {
            toast.success('Role deleted!');
            queryClient.invalidateQueries({ queryKey: ['section-roles', selectedSection] });
        },
        onError: () => toast.error('Failed to delete role')
    });

    const handleCloseDialog = () => {
        setShowDialog(false);
        setEditingRole(null);
        setFormData({ name: '', code: '', description: '', level: 1, permissions: [] });
    };

    const handleEdit = (role: any) => {
        setEditingRole(role);
        setFormData({
            name: role.name,
            code: role.code,
            description: role.description || '',
            level: role.level,
            permissions: JSON.parse(role.permissions || '[]')
        });
        setShowDialog(true);
    };

    const handleSave = () => {
        if (!formData.name || !formData.code) {
            toast.error('Name and Code are required');
            return;
        }
        saveMutation.mutate({
            ...formData,
            permissions: JSON.stringify(formData.permissions)
        });
    };

    const togglePermission = (perm: string) => {
        setFormData(prev => ({
            ...prev,
            permissions: prev.permissions.includes(perm)
                ? prev.permissions.filter(p => p !== perm)
                : [...prev.permissions, perm]
        }));
    };

    const getLevelBadge = (level: number) => {
        const levels: Record<number, { label: string; color: string }> = {
            1: { label: 'Junior', color: 'bg-slate-100 text-slate-700' },
            2: { label: 'Mid', color: 'bg-blue-100 text-blue-700' },
            3: { label: 'Senior', color: 'bg-green-100 text-green-700' },
            4: { label: 'Manager', color: 'bg-purple-100 text-purple-700' }
        };
        return levels[level] || levels[1];
    };

    return (
        <div className="flex h-screen bg-slate-50 overflow-hidden">
            <Sidebar />
            <main className="flex-1 flex flex-col min-w-0 h-full">
                <Header />
                <div className="flex-1 overflow-y-auto p-4 md:p-6">
                    <div className="max-w-7xl mx-auto space-y-6">
                        {/* Header */}
                        <div className="flex items-center justify-between">
                            <div>
                                <h1 className="text-2xl font-bold text-slate-900">Section Roles Management</h1>
                                <p className="text-slate-500">Define job posts and permissions for each section</p>
                            </div>
                            {selectedSection && (
                                <Button onClick={() => setShowDialog(true)} className="bg-blue-600 hover:bg-blue-700">
                                    <Plus className="w-4 h-4 mr-2" />
                                    Add Role
                                </Button>
                            )}
                        </div>

                        {/* Section Selector */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Layers className="w-5 h-5" />
                                    Select Section
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <Select value={selectedSection} onValueChange={setSelectedSection}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Choose a section..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {sections.map((section: any) => (
                                            <SelectItem key={section.id} value={section.id}>
                                                {section.icon} {section.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </CardContent>
                        </Card>

                        {/* Roles Grid */}
                        {selectedSection && (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {isLoading ? (
                                    <div className="col-span-full text-center p-8 text-slate-500">Loading...</div>
                                ) : roles.length === 0 ? (
                                    <div className="col-span-full text-center p-8 text-slate-500">
                                        No roles defined. Create your first role!
                                    </div>
                                ) : (
                                    roles.map((role: any) => {
                                        const levelInfo = getLevelBadge(role.level);
                                        const permissions = JSON.parse(role.permissions || '[]');
                                        return (
                                            <Card key={role.id} className="hover:shadow-md transition-shadow">
                                                <CardHeader className="pb-3">
                                                    <div className="flex items-start justify-between">
                                                        <div className="flex items-center gap-2">
                                                            <Shield className="w-5 h-5 text-blue-600" />
                                                            <CardTitle className="text-base">{role.name}</CardTitle>
                                                        </div>
                                                        <Badge className={levelInfo.color} variant="secondary">
                                                            {levelInfo.label}
                                                        </Badge>
                                                    </div>
                                                </CardHeader>
                                                <CardContent>
                                                    <div className="space-y-3">
                                                        <div className="text-xs text-slate-500">
                                                            <span className="font-semibold">Code:</span> {role.code}
                                                        </div>
                                                        {role.description && (
                                                            <p className="text-sm text-slate-600">{role.description}</p>
                                                        )}
                                                        <div className="text-xs text-slate-500">
                                                            <span className="font-semibold">Permissions:</span> {permissions.length} pages
                                                        </div>
                                                        <div className="flex gap-2 pt-2">
                                                            <Button
                                                                variant="outline"
                                                                size="sm"
                                                                className="flex-1"
                                                                onClick={() => handleEdit(role)}
                                                            >
                                                                <Edit className="w-3 h-3 mr-1" />
                                                                Edit
                                                            </Button>
                                                            <Button
                                                                variant="outline"
                                                                size="sm"
                                                                onClick={() => {
                                                                    if (confirm('Delete this role?')) {
                                                                        deleteMutation.mutate(role.id);
                                                                    }
                                                                }}
                                                                className="text-red-600 hover:text-red-700"
                                                            >
                                                                <Trash2 className="w-3 h-3" />
                                                            </Button>
                                                        </div>
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        );
                                    })
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </main>

            {/* Create/Edit Dialog */}
            <Dialog open={showDialog} onOpenChange={setShowDialog}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>{editingRole ? 'Edit Role' : 'Create Role'}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 max-h-[60vh] overflow-y-auto">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-xs font-bold text-slate-600 uppercase">Name *</label>
                                <Input
                                    className="mt-1"
                                    placeholder="e.g., Project Engineer"
                                    value={formData.name}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-600 uppercase">Code *</label>
                                <Input
                                    className="mt-1"
                                    placeholder="e.g., PROJECT_ENGINEER"
                                    value={formData.code}
                                    onChange={e => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                                />
                            </div>
                        </div>
                        <div>
                            <label className="text-xs font-bold text-slate-600 uppercase">Description</label>
                            <Textarea
                                className="mt-1"
                                placeholder="Brief description"
                                value={formData.description}
                                onChange={e => setFormData({ ...formData, description: e.target.value })}
                            />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-slate-600 uppercase">Level</label>
                            <Select
                                value={formData.level.toString()}
                                onValueChange={v => setFormData({ ...formData, level: parseInt(v) })}
                            >
                                <SelectTrigger className="mt-1">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="1">1 - Junior</SelectItem>
                                    <SelectItem value="2">2 - Mid Level</SelectItem>
                                    <SelectItem value="3">3 - Senior</SelectItem>
                                    <SelectItem value="4">4 - Manager</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <label className="text-xs font-bold text-slate-600 uppercase mb-2 block">
                                Page Permissions
                            </label>
                            <div className="grid grid-cols-2 gap-2">
                                {PAGE_PERMISSIONS.map(perm => (
                                    <label
                                        key={perm.value}
                                        className="flex items-center gap-2 p-2 rounded border hover:bg-slate-50 cursor-pointer"
                                    >
                                        <input
                                            type="checkbox"
                                            checked={formData.permissions.includes(perm.value)}
                                            onChange={() => togglePermission(perm.value)}
                                            className="rounded"
                                        />
                                        <span className="text-sm">{perm.label}</span>
                                    </label>
                                ))}
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={handleCloseDialog}>Cancel</Button>
                        <Button
                            onClick={handleSave}
                            disabled={saveMutation.isPending}
                            className="bg-blue-600 hover:bg-blue-700"
                        >
                            {saveMutation.isPending ? 'Saving...' : 'Save'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

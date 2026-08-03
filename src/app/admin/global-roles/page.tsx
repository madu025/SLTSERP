"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Shield, Check, X, Save, Layers, Building } from "lucide-react";
import { toast } from "sonner";

const AVAILABLE_PAGES = [
    { id: 'dashboard', name: 'Dashboard', icon: '📊' },
    { id: 'service-orders', name: 'Service Orders', icon: '📋' },
    { id: 'contractors', name: 'Contractors', icon: '👷' },
    { id: 'restore-requests', name: 'Restore Requests', icon: '🔧' },
    { id: 'invoices', name: 'Invoices', icon: '💰' },
    { id: 'inventory', name: 'Inventory / Stores', icon: '📦' },
    { id: 'procurement', name: 'Procurement', icon: '🛒' },
    { id: 'administration', name: 'Administration', icon: '⚙️' },
    { id: 'finance', name: 'Finance', icon: '🏦' }
];

// Roles are read dynamically from the live Postgres Role enum via /api/admin/role-options
// so new enum values appear here without frontend code changes.

interface Section {
    id: string;
    name: string;
    code: string;
}

export default function GlobalRolesPage() {
    const queryClient = useQueryClient();
    const [selectedRole, setSelectedRole] = useState<string>('');
    const [rolePermissions, setRolePermissions] = useState<string[]>([]);
    const [roleSections, setRoleSections] = useState<string[]>([]);
    
    // Fetch role list from the live Postgres enum
    const { data: roleOptions } = useQuery<{ roles: string[] }>({
        queryKey: ['role-options'],
        queryFn: async () => {
            const res = await fetch('/api/admin/role-options');
            if (!res.ok) throw new Error('Failed to load role options');
            return res.json();
        },
        staleTime: 5 * 60 * 1000
    });
    const ROLES = roleOptions?.roles || [];

    // Fetch all SystemConfig mappings
    const { data: configs, isLoading: configLoading } = useQuery({
        queryKey: ['system-configs'],
        queryFn: async () => {
            const res = await fetch('/api/admin/system-config');
            if (!res.ok) throw new Error('Failed to load configs');
            return res.json();
        }
    });

    // Fetch available sections
    const { data: sections = [], isLoading: sectionsLoading } = useQuery<Section[]>({
        queryKey: ['sections'],
        queryFn: async () => {
            const res = await fetch('/api/admin/sections');
            if (!res.ok) throw new Error('Failed to load sections');
            return res.json();
        }
    });

    const defaultPermissionsMap = configs?.DEFAULT_ROLE_PERMISSIONS 
        ? JSON.parse(configs.DEFAULT_ROLE_PERMISSIONS) 
        : {};
        
    const sectionMappingMap = configs?.SECTION_MAPPING 
        ? JSON.parse(configs.SECTION_MAPPING) 
        : {};

    // Load data when role selected
    useEffect(() => {
        if (selectedRole && configs) {
            setRolePermissions(defaultPermissionsMap[selectedRole] || []);
            setRoleSections(sectionMappingMap[selectedRole] || []);
        }
    }, [selectedRole, configs]);

    const updateConfigMutation = useMutation({
        mutationFn: async (payload: { key: string, value: string, description: string }) => {
            const res = await fetch('/api/admin/system-config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (!res.ok) throw new Error('Failed to update config');
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['system-configs'] });
        },
        onError: () => toast.error('Failed to save configuration')
    });

    const togglePermission = (pageId: string) => {
        setRolePermissions(prev =>
            prev.includes(pageId) ? prev.filter(p => p !== pageId) : [...prev, pageId]
        );
    };

    const toggleSection = (sectionCode: string) => {
        setRoleSections(prev =>
            prev.includes(sectionCode) ? prev.filter(s => s !== sectionCode) : [...prev, sectionCode]
        );
    };

    const handleSave = async () => {
        if (!selectedRole) return;

        const newPermissionsMap = { ...defaultPermissionsMap, [selectedRole]: rolePermissions };
        const newSectionMap = { ...sectionMappingMap, [selectedRole]: roleSections };

        try {
            await updateConfigMutation.mutateAsync({
                key: 'DEFAULT_ROLE_PERMISSIONS',
                value: JSON.stringify(newPermissionsMap),
                description: 'Default permissions array for each role.'
            });

            await updateConfigMutation.mutateAsync({
                key: 'SECTION_MAPPING',
                value: JSON.stringify(newSectionMap),
                description: 'Mapping of Role to Sections'
            });

            toast.success(`${selectedRole} configuration saved!`);
        } catch (error) {
            console.error(error);
        }
    };

    const isSaving = updateConfigMutation.isPending;

    return (
        <div className="flex h-screen bg-slate-50 overflow-hidden">
            <Sidebar />
            <main className="flex-1 flex flex-col min-w-0 h-full">
                <Header />
                <div className="flex-1 overflow-y-auto p-4 md:p-6">
                    <div className="max-w-6xl mx-auto space-y-6">
                        {/* Header */}
                        <div className="flex items-center justify-between bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                            <div>
                                <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Global Roles Configuration</h1>
                                <p className="text-slate-500 mt-1">Configure default page access and section assignments for system roles.</p>
                            </div>
                            {selectedRole && (
                                <Button
                                    onClick={handleSave}
                                    disabled={isSaving}
                                    className="bg-blue-600 hover:bg-blue-700 shadow-md transition-all px-6"
                                >
                                    <Save className="w-4 h-4 mr-2" />
                                    {isSaving ? 'Saving...' : 'Save Configuration'}
                                </Button>
                            )}
                        </div>

                        {/* Role Selector */}
                        <Card className="border-0 shadow-sm border-t-4 border-blue-500">
                            <CardHeader className="pb-3">
                                <CardTitle className="text-lg">Select Global Role</CardTitle>
                                <CardDescription>Choose an existing system role to modify its default behaviors.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="max-w-md">
                                    <Select value={selectedRole} onValueChange={setSelectedRole}>
                                        <SelectTrigger className="h-12 bg-slate-50 font-medium">
                                            <SelectValue placeholder="Select a role (e.g. OSP_MANAGER)" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {ROLES.map((role) => (
                                                <SelectItem key={role} value={role} className="font-medium">
                                                    {role}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </CardContent>
                        </Card>

                        {configLoading || sectionsLoading ? (
                            <div className="text-center p-12 text-slate-500 animate-pulse">Loading system configurations...</div>
                        ) : selectedRole ? (
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-20">
                                
                                {/* Permissions Card */}
                                <Card className="border-0 shadow-sm">
                                    <CardHeader className="bg-slate-50/50 border-b">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <CardTitle className="flex items-center gap-2 text-lg">
                                                    <Shield className="w-5 h-5 text-blue-600" />
                                                    Default Page Access
                                                </CardTitle>
                                                <CardDescription className="mt-1">
                                                    New users with this role will inherit these permissions.
                                                </CardDescription>
                                            </div>
                                            <Badge variant="secondary" className="bg-blue-100 text-blue-700">
                                                {rolePermissions.length} Enabled
                                            </Badge>
                                        </div>
                                    </CardHeader>
                                    <CardContent className="p-6">
                                        <div className="grid grid-cols-1 gap-3">
                                            {AVAILABLE_PAGES.map(page => {
                                                const hasAccess = rolePermissions.includes(page.id);
                                                return (
                                                    <label
                                                        key={page.id}
                                                        className={`flex items-center justify-between p-4 rounded-xl border-2 cursor-pointer transition-all hover:shadow-sm ${hasAccess
                                                            ? 'border-blue-500 bg-blue-50/50'
                                                            : 'border-slate-100 bg-white hover:border-slate-200'
                                                            }`}
                                                    >
                                                        <div className="flex items-center gap-4">
                                                            <div className="text-2xl p-2 bg-white rounded-lg shadow-sm border border-slate-100">
                                                                {page.icon}
                                                            </div>
                                                            <div>
                                                                <div className="font-bold text-slate-900">
                                                                    {page.name}
                                                                </div>
                                                                <div className="text-xs font-medium text-slate-500 uppercase tracking-wider mt-0.5">
                                                                    {page.id}
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-3">
                                                            {hasAccess ? (
                                                                <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center shadow-sm">
                                                                    <Check className="w-4 h-4 text-white font-bold" />
                                                                </div>
                                                            ) : (
                                                                <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center">
                                                                    <X className="w-4 h-4 text-slate-400" />
                                                                </div>
                                                            )}
                                                            <input
                                                                type="checkbox"
                                                                checked={hasAccess}
                                                                onChange={() => togglePermission(page.id)}
                                                                className="sr-only"
                                                            />
                                                        </div>
                                                    </label>
                                                );
                                            })}
                                        </div>
                                    </CardContent>
                                </Card>

                                {/* Sections Card */}
                                <Card className="border-0 shadow-sm">
                                    <CardHeader className="bg-slate-50/50 border-b">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <CardTitle className="flex items-center gap-2 text-lg">
                                                    <Layers className="w-5 h-5 text-indigo-600" />
                                                    Default Section Assignment
                                                </CardTitle>
                                                <CardDescription className="mt-1">
                                                    New users with this role will be assigned to these sections.
                                                </CardDescription>
                                            </div>
                                            <Badge variant="secondary" className="bg-indigo-100 text-indigo-700">
                                                {roleSections.length} Assigned
                                            </Badge>
                                        </div>
                                    </CardHeader>
                                    <CardContent className="p-6">
                                        <div className="grid grid-cols-1 gap-3">
                                            {sections.map(section => {
                                                const hasAccess = roleSections.includes(section.code);
                                                return (
                                                    <label
                                                        key={section.id}
                                                        className={`flex items-center justify-between p-4 rounded-xl border-2 cursor-pointer transition-all hover:shadow-sm ${hasAccess
                                                            ? 'border-indigo-500 bg-indigo-50/50'
                                                            : 'border-slate-100 bg-white hover:border-slate-200'
                                                            }`}
                                                    >
                                                        <div className="flex items-center gap-4">
                                                            <div className="text-indigo-500 p-2 bg-white rounded-lg shadow-sm border border-slate-100">
                                                                <Building className="w-6 h-6" />
                                                            </div>
                                                            <div>
                                                                <div className="font-bold text-slate-900">
                                                                    {section.name}
                                                                </div>
                                                                <div className="text-xs font-medium text-slate-500 uppercase tracking-wider mt-0.5">
                                                                    {section.code}
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-3">
                                                            {hasAccess ? (
                                                                <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center shadow-sm">
                                                                    <Check className="w-4 h-4 text-white font-bold" />
                                                                </div>
                                                            ) : (
                                                                <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center">
                                                                    <X className="w-4 h-4 text-slate-400" />
                                                                </div>
                                                            )}
                                                            <input
                                                                type="checkbox"
                                                                checked={hasAccess}
                                                                onChange={() => toggleSection(section.code)}
                                                                className="sr-only"
                                                            />
                                                        </div>
                                                    </label>
                                                );
                                            })}
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>
                        ) : null}
                    </div>
                </div>
            </main>
        </div>
    );
}

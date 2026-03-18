"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Shield, Plus, Edit, Trash2, Layers } from "lucide-react";
import { RoleFormDialog } from "./components/RoleFormDialog";
import { useRoleOperations } from "./hooks/useRoleOperations";

export default function SectionRolesPage() {
    const [selectedSection, setSelectedSection] = useState<string>('');
    const [showDialog, setShowDialog] = useState(false);
    const [editingRole, setEditingRole] = useState<any>(null);

    const { upsertMutation, removeMutation } = useRoleOperations(selectedSection);

    // Fetch sections
    const { data: sections = [] } = useQuery({
        queryKey: ['sections'],
        queryFn: async () => {
            const res = await fetch('/api/admin/sections');
            if (!res.ok) throw new Error('Failed to fetch sections');
            return res.json();
        }
    });

    // Fetch roles for selected section
    const { data: roles = [], isLoading } = useQuery({
        queryKey: ['section-roles', selectedSection],
        queryFn: async () => {
            if (!selectedSection) return [];
            const res = await fetch(`/api/admin/sections/${selectedSection}/roles`);
            if (!res.ok) throw new Error('Failed to fetch roles');
            return res.json();
        },
        enabled: !!selectedSection
    });

    const handleEdit = (role: any) => {
        setEditingRole(role);
        setShowDialog(true);
    };

    const handleAdd = () => {
        setEditingRole(null);
        setShowDialog(true);
    };

    const handleFormSubmit = async (data: any) => {
        await upsertMutation.mutateAsync({
            id: editingRole?.id,
            data
        });
        setShowDialog(false);
        setEditingRole(null);
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
                                <Button onClick={handleAdd} className="bg-blue-600 hover:bg-blue-700">
                                    <Plus className="w-4 h-4 mr-2" />
                                    Add Role
                                </Button>
                            )}
                        </div>

                        {/* Section Selector */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2 text-base">
                                    <Layers className="w-5 h-5 text-blue-600" />
                                    Select Departmental Section
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <Select value={selectedSection} onValueChange={setSelectedSection}>
                                    <SelectTrigger className="h-10">
                                        <SelectValue placeholder="Choose a section to manage roles..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {sections.map((section: any) => (
                                            <SelectItem key={section.id} value={section.id}>
                                                <span className="mr-2">{section.icon}</span> {section.name}
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
                                    <div className="col-span-full text-center p-12 text-slate-500 py-20">
                                        <div className="inline-block animate-pulse mb-2 font-bold uppercase tracking-widest text-[10px]">Updating Roles Cache...</div>
                                    </div>
                                ) : roles.length === 0 ? (
                                    <div className="col-span-full text-center p-20 bg-white rounded-xl border-2 border-dashed border-slate-200">
                                        <Shield className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                                        <p className="text-slate-500 font-medium">No roles defined for this section.</p>
                                        <Button variant="link" onClick={handleAdd} className="mt-2 text-blue-600 font-bold">Create your first role</Button>
                                    </div>
                                ) : (
                                    roles.map((role: any) => {
                                        const levelInfo = getLevelBadge(role.level);
                                        const permissions = JSON.parse(role.permissions || '[]');
                                        return (
                                            <Card key={role.id} className="hover:shadow-md transition-shadow border-slate-200 overflow-hidden">
                                                <CardHeader className="pb-3 bg-slate-50/50">
                                                    <div className="flex items-start justify-between">
                                                        <div className="flex items-center gap-2">
                                                            <div className="p-1.5 bg-blue-50 rounded-lg">
                                                                <Shield className="w-4 h-4 text-blue-600" />
                                                            </div>
                                                            <CardTitle className="text-sm font-bold text-slate-800">{role.name}</CardTitle>
                                                        </div>
                                                        <Badge className={`${levelInfo.color} font-bold text-[9px] uppercase tracking-wider h-5 flex items-center shadow-none border-none`} variant="secondary">
                                                            {levelInfo.label}
                                                        </Badge>
                                                    </div>
                                                </CardHeader>
                                                <CardContent className="pt-4">
                                                    <div className="space-y-4">
                                                        <div className="flex items-center justify-between text-[11px]">
                                                            <span className="font-bold text-slate-400 uppercase tracking-widest">Internal Code</span>
                                                            <code className="text-blue-600 font-bold bg-blue-50 px-1.5 py-0.5 rounded">{role.code}</code>
                                                        </div>
                                                        {role.description && (
                                                            <p className="text-[11px] text-slate-500 leading-relaxed italic border-l-2 border-slate-100 pl-3">{role.description}</p>
                                                        )}
                                                        <div className="flex items-center justify-between text-[11px] border-t pt-3 border-slate-50">
                                                            <span className="text-slate-500 font-medium">Page Access Control</span>
                                                            <span className="font-black text-slate-800">{permissions.length} Pages</span>
                                                        </div>
                                                        <div className="flex gap-2 pt-1">
                                                            <Button
                                                                variant="outline"
                                                                size="sm"
                                                                className="flex-1 h-8 text-[11px] font-bold"
                                                                onClick={() => handleEdit(role)}
                                                            >
                                                                <Edit className="w-3.5 h-3.5 mr-1.5 text-blue-600" />
                                                                Modify Role
                                                            </Button>
                                                            <Button
                                                                variant="outline"
                                                                size="sm"
                                                                onClick={() => {
                                                                    if (confirm('Permanently delete this role configuration?')) {
                                                                        removeMutation.mutate(role.id);
                                                                    }
                                                                }}
                                                                className="h-8 w-8 p-0 text-red-500 hover:bg-red-50 hover:text-red-600 border-slate-200"
                                                            >
                                                                <Trash2 className="w-3.5 h-3.5" />
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

            <RoleFormDialog 
                open={showDialog}
                onOpenChange={setShowDialog}
                onSubmit={handleFormSubmit}
                initialData={editingRole}
                isSubmitting={upsertMutation.isPending}
            />
        </div>
    );
}

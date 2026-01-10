"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Layers, Plus, Edit, Trash2, Users } from "lucide-react";
import { toast } from "sonner";

export default function SectionManagementPage() {
    const queryClient = useQueryClient();
    const [showDialog, setShowDialog] = useState(false);
    const [editingSection, setEditingSection] = useState<any>(null);
    const [formData, setFormData] = useState({
        name: '',
        code: '',
        description: '',
        icon: '',
        color: ''
    });

    // Fetch sections
    const { data: sections = [], isLoading } = useQuery({
        queryKey: ['sections'],
        queryFn: async () => {
            const res = await fetch('/api/admin/sections');
            if (!res.ok) throw new Error('Failed to fetch');
            return res.json();
        }
    });

    // Create/Update mutation
    const saveMutation = useMutation({
        mutationFn: async (data: any) => {
            const url = editingSection
                ? `/api/admin/sections/${editingSection.id}`
                : '/api/admin/sections';
            const method = editingSection ? 'PATCH' : 'POST';

            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            if (!res.ok) throw new Error('Failed to save');
            return res.json();
        },
        onSuccess: () => {
            toast.success(editingSection ? 'Section updated!' : 'Section created!');
            queryClient.invalidateQueries({ queryKey: ['sections'] });
            handleCloseDialog();
        },
        onError: () => toast.error('Failed to save section')
    });

    // Delete mutation
    const deleteMutation = useMutation({
        mutationFn: async (id: string) => {
            const res = await fetch(`/api/admin/sections/${id}`, { method: 'DELETE' });
            if (!res.ok) throw new Error('Failed to delete');
            return res.json();
        },
        onSuccess: () => {
            toast.success('Section deleted!');
            queryClient.invalidateQueries({ queryKey: ['sections'] });
        },
        onError: () => toast.error('Failed to delete section')
    });

    const handleCloseDialog = () => {
        setShowDialog(false);
        setEditingSection(null);
        setFormData({ name: '', code: '', description: '', icon: '', color: '' });
    };

    const handleEdit = (section: any) => {
        setEditingSection(section);
        setFormData({
            name: section.name,
            code: section.code,
            description: section.description || '',
            icon: section.icon || '',
            color: section.color || ''
        });
        setShowDialog(true);
    };

    const handleSave = () => {
        if (!formData.name || !formData.code) {
            toast.error('Name and Code are required');
            return;
        }
        saveMutation.mutate(formData);
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
                                <h1 className="text-2xl font-bold text-slate-900">Section Management</h1>
                                <p className="text-slate-500">Manage departments and organizational sections</p>
                            </div>
                            <Button onClick={() => setShowDialog(true)} className="bg-blue-600 hover:bg-blue-700">
                                <Plus className="w-4 h-4 mr-2" />
                                Add Section
                            </Button>
                        </div>

                        {/* Sections Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {isLoading ? (
                                <div className="col-span-full text-center p-8 text-slate-500">Loading...</div>
                            ) : sections.length === 0 ? (
                                <div className="col-span-full text-center p-8 text-slate-500">
                                    No sections found. Create your first section!
                                </div>
                            ) : (
                                sections.map((section: any) => (
                                    <Card key={section.id} className="hover:shadow-md transition-shadow">
                                        <CardHeader className="pb-3">
                                            <div className="flex items-start justify-between">
                                                <div className="flex items-center gap-2">
                                                    <Layers className="w-5 h-5 text-blue-600" />
                                                    <CardTitle className="text-base">{section.name}</CardTitle>
                                                </div>
                                                <Badge variant="secondary">{section.code}</Badge>
                                            </div>
                                        </CardHeader>
                                        <CardContent>
                                            <div className="space-y-3">
                                                {section.description && (
                                                    <p className="text-sm text-slate-600">{section.description}</p>
                                                )}
                                                <div className="flex items-center gap-2 text-xs text-slate-500">
                                                    <Users className="w-3 h-3" />
                                                    <span>{section._count?.roles || 0} roles</span>
                                                    <span>•</span>
                                                    <span>{section._count?.userAssignments || 0} users</span>
                                                </div>
                                                <div className="flex gap-2 pt-2">
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        className="flex-1"
                                                        onClick={() => handleEdit(section)}
                                                    >
                                                        <Edit className="w-3 h-3 mr-1" />
                                                        Edit
                                                    </Button>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => {
                                                            if (confirm('Delete this section?')) {
                                                                deleteMutation.mutate(section.id);
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
                                ))
                            )}
                        </div>
                    </div>
                </div>
            </main>

            {/* Create/Edit Dialog */}
            <Dialog open={showDialog} onOpenChange={setShowDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{editingSection ? 'Edit Section' : 'Create Section'}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div>
                            <label className="text-xs font-bold text-slate-600 uppercase">Name *</label>
                            <Input
                                className="mt-1"
                                placeholder="e.g., Projects"
                                value={formData.name}
                                onChange={e => setFormData({ ...formData, name: e.target.value })}
                            />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-slate-600 uppercase">Code *</label>
                            <Input
                                className="mt-1"
                                placeholder="e.g., PROJECTS"
                                value={formData.code}
                                onChange={e => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                            />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-slate-600 uppercase">Description</label>
                            <Input
                                className="mt-1"
                                placeholder="Brief description"
                                value={formData.description}
                                onChange={e => setFormData({ ...formData, description: e.target.value })}
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-xs font-bold text-slate-600 uppercase">Icon</label>
                                <Input
                                    className="mt-1"
                                    placeholder="📊"
                                    value={formData.icon}
                                    onChange={e => setFormData({ ...formData, icon: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-600 uppercase">Color</label>
                                <Input
                                    className="mt-1"
                                    placeholder="#3B82F6"
                                    value={formData.color}
                                    onChange={e => setFormData({ ...formData, color: e.target.value })}
                                />
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

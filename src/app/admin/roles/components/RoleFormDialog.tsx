"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";

interface RoleFormDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSubmit: (values: any) => void;
    initialData?: any;
    isSubmitting: boolean;
}

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

export function RoleFormDialog({
    open,
    onOpenChange,
    onSubmit,
    initialData,
    isSubmitting
}: RoleFormDialogProps) {
    const [formData, setFormData] = useState({
        name: '',
        code: '',
        description: '',
        level: 1,
        permissions: [] as string[]
    });

    useEffect(() => {
        if (open) {
            if (initialData) {
                setFormData({
                    name: initialData.name,
                    code: initialData.code,
                    description: initialData.description || '',
                    level: initialData.level,
                    permissions: JSON.parse(initialData.permissions || '[]')
                });
            } else {
                setFormData({ name: '', code: '', description: '', level: 1, permissions: [] });
            }
        }
    }, [open, initialData]);

    const handleSave = () => {
        if (!formData.name || !formData.code) {
            toast.error('Name and Code are required');
            return;
        }
        onSubmit({
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

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle>{initialData ? 'Edit Role' : 'Create Role'}</DialogTitle>
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
                                        className="rounded border-slate-300"
                                    />
                                    <span className="text-sm">{perm.label}</span>
                                </label>
                            ))}
                        </div>
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                    <Button
                        onClick={handleSave}
                        disabled={isSubmitting}
                        className="bg-blue-600 hover:bg-blue-700"
                    >
                        {isSubmitting ? 'Saving...' : 'Save'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

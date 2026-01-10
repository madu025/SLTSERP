"use client";

import React, { useState, useEffect } from 'react';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import { useRouter } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { GripVertical, Plus, Check } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

interface ColumnConfig {
    key: string;
    label: string;
    required?: boolean;
}

interface TableSettings {
    tableName: string;
    availableColumns: ColumnConfig[];
    visibleColumns: string[];
}

const TABLE_LABELS: Record<string, string> = {
    'pending_sod': 'Pending Service Orders',
    'completed_sod': 'Completed Service Orders',
    'return_sod': 'Return Service Orders',
    'restore_request': 'Restore Requests'
};

export default function TableSettingsPage() {
    const queryClient = useQueryClient();
    const router = useRouter();
    const [draggedItem, setDraggedItem] = useState<{ tableName: string; index: number } | null>(null);

    // --- ACCESS CHECK ---
    useEffect(() => {
        const storedUser = localStorage.getItem('user');
        if (storedUser) {
            const user = JSON.parse(storedUser);
            if (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN') {
                router.push('/dashboard');
            }
        } else {
            router.push('/login');
        }
    }, [router]);

    // --- QUERIES ---
    const { data: settings, isLoading } = useQuery<Record<string, TableSettings>>({
        queryKey: ['table-settings'],
        queryFn: async () => {
            const res = await fetch('/api/admin/table-settings');
            if (!res.ok) throw new Error('Failed');
            return res.json();
        }
    });

    // --- MUTATIONS ---
    const mutation = useMutation({
        mutationFn: async (variables: { tableName: string; visibleColumns: string[] }) => {
            const res = await fetch('/api/admin/table-settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(variables)
            });
            if (!res.ok) throw new Error('Failed');
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['table-settings'] });
            toast.success("Settings saved successfully");
        },
        onError: () => toast.error("Failed to save settings")
    });

    // --- HANDLERS (Optimistic UI handled by simple local state overrides could be redundant if we just rely on react-query invalidation, but for dnd we need local state usually. 
    // For simplicity, we will assume direct mutation on Drop for "Save on change" or local state management.
    // Let's implement independent local state for editing, initialized from data)

    // Actually, handling complex local state derived from query props is tricky. 
    // We'll trust the query data but we need a way to mutate it locally for DnD before saving.
    // simpler: We will just use the query data and optimistic updates or just wait for re-fetch?
    // DnD feels laggy if we wait for server. Let's create a local copy component for each table.

    if (isLoading || !settings) {
        return <div className="min-h-screen flex bg-slate-50 items-center justify-center text-slate-500">Loading settings...</div>;
    }

    return (
        <div className="h-screen flex bg-slate-50 overflow-hidden">
            <Sidebar />
            <main className="flex-1 flex flex-col min-w-0 h-full">
                <Header />
                <div className="flex-1 overflow-y-auto p-4 md:p-8">
                    <div className="max-w-5xl mx-auto space-y-6">
                        <div>
                            <h1 className="text-xl font-bold text-slate-900">Table Configuration</h1>
                            <p className="text-xs text-slate-500">Customize column visibility and ordering for system tables.</p>
                        </div>

                        <div className="grid gap-6">
                            {Object.entries(settings).map(([tableName, tableSettings]) => (
                                <TableConfigCard
                                    key={tableName}
                                    tableName={tableName}
                                    settings={tableSettings}
                                    onSave={(cols) => mutation.mutate({ tableName, visibleColumns: cols })}
                                    isSaving={mutation.isPending}
                                />
                            ))}
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}

// Sub-component to manage local DnD state
function TableConfigCard({ tableName, settings, onSave, isSaving }: { tableName: string, settings: TableSettings, onSave: (cols: string[]) => void, isSaving: boolean }) {
    const [cols, setCols] = useState(settings.visibleColumns);
    const [draggedIdx, setDraggedIdx] = useState<number | null>(null);

    // Sync if server updates (optional, might conflict with typing)
    useEffect(() => {
        setCols(settings.visibleColumns);
    }, [settings.visibleColumns]);

    const getLabel = (key: string) => settings.availableColumns.find(c => c.key === key)?.label || key;
    const isRequired = (key: string) => settings.availableColumns.find(c => c.key === key)?.required;

    const toggleColumn = (key: string) => {
        if (cols.includes(key)) {
            if (isRequired(key)) return;
            setCols(cols.filter(c => c !== key));
        } else {
            setCols([...cols, key]);
        }
    };

    const handleDragStart = (e: React.DragEvent, index: number) => {
        if (isRequired(cols[index])) return; // Prevent dragging required if needed? Usually we allow reorder even for required.
        // Let's allow reordering everything for now.
        setDraggedIdx(index);
        e.dataTransfer.effectAllowed = "move";
    };

    const handleDragOver = (e: React.DragEvent, index: number) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
    };

    const handleDrop = (e: React.DragEvent, dropIndex: number) => {
        e.preventDefault();
        if (draggedIdx === null) return;
        const newCols = [...cols];
        const [moved] = newCols.splice(draggedIdx, 1);
        newCols.splice(dropIndex, 0, moved);
        setCols(newCols);
        setDraggedIdx(null);
    };

    const hasChanges = JSON.stringify(cols) !== JSON.stringify(settings.visibleColumns);

    return (
        <Card>
            <CardHeader className="py-4 px-6 bg-slate-50/50 border-b">
                <div className="flex justify-between items-center">
                    <div>
                        <CardTitle className="text-base font-bold text-slate-800">{TABLE_LABELS[tableName] || tableName}</CardTitle>
                        <CardDescription className="text-xs">{cols.length} columns visible</CardDescription>
                    </div>
                    {hasChanges && (
                        <div className="flex gap-2">
                            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setCols(settings.visibleColumns)}>Reset</Button>
                            <Button size="sm" className="h-7 text-xs bg-blue-600 hover:bg-blue-700" onClick={() => onSave(cols)} disabled={isSaving}>
                                {isSaving ? 'Saving...' : 'Save Changes'}
                            </Button>
                        </div>
                    )}
                </div>
            </CardHeader>
            <CardContent className="p-6">
                <div className="space-y-6">
                    {/* Active Columns */}
                    <div>
                        <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Visible Columns (Drag to Reorder)</h4>
                        <div className="space-y-2">
                            {cols.map((col, idx) => (
                                <div
                                    key={col}
                                    draggable
                                    onDragStart={(e) => handleDragStart(e, idx)}
                                    onDragOver={(e) => handleDragOver(e, idx)}
                                    onDrop={(e) => handleDrop(e, idx)}
                                    className="flex items-center gap-3 p-2 rounded-lg border bg-white hover:border-blue-300 transition-colors group cursor-move"
                                >
                                    <GripVertical className="w-4 h-4 text-slate-300 group-hover:text-slate-500" />
                                    <span className="text-sm font-medium text-slate-700 flex-1">{getLabel(col)}</span>
                                    {isRequired(col) && <Badge variant="secondary" className="text-[10px] h-5">Required</Badge>}
                                    {!isRequired(col) && (
                                        <Button size="icon" variant="ghost" className="h-6 w-6 text-slate-400 hover:text-red-500" onClick={() => toggleColumn(col)}>
                                            <span className="sr-only">Remove</span>
                                            ×
                                        </Button>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Available Columns */}
                    <div>
                        <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Available to Add</h4>
                        <div className="flex flex-wrap gap-2">
                            {settings.availableColumns.filter(c => !cols.includes(c.key)).map(col => (
                                <Button
                                    key={col.key}
                                    variant="outline"
                                    size="sm"
                                    className="h-8 text-xs border-dashed"
                                    onClick={() => toggleColumn(col.key)}
                                >
                                    <Plus className="w-3 h-3 mr-1" />
                                    {col.label}
                                </Button>
                            ))}
                            {settings.availableColumns.every(c => cols.includes(c.key)) && (
                                <p className="text-xs text-slate-400 italic">All columns added.</p>
                            )}
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

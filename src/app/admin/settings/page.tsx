"use client";

import React, { useState, useEffect } from 'react';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import { useRouter } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { GripVertical, Plus, Check, Users, Building2, UserCog, HardHat, Warehouse, FileText, Settings, Database, ChevronDown, ChevronUp, Layers, Table as TableIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { MaterialAssignment } from './MaterialAssignment';
import { cn } from "@/lib/utils";

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

const AdminDashboard = () => {
    const router = useRouter();
    const queryClient = useQueryClient();

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
    const { data: settings = {}, isLoading } = useQuery<Record<string, TableSettings>>({
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

    if (isLoading) {
        return (
            <div className="h-screen flex bg-slate-50 overflow-hidden">
                <Sidebar />
                <main className="flex-1 flex flex-col min-w-0 h-full">
                    <Header />
                    <div className="flex-1 flex items-center justify-center">
                        <div className="text-slate-500">Loading settings...</div>
                    </div>
                </main>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 flex bg-slate-50 overflow-hidden">
            <Sidebar />
            <main className="flex-1 flex flex-col min-w-0 h-full">
                <Header />
                <div className="flex-1 overflow-y-auto p-4 md:p-8">
                    <div className="max-w-6xl mx-auto space-y-6">
                        <div>
                            <h1 className="text-2xl font-bold text-slate-900">System Settings</h1>
                            <p className="text-slate-500">Configure global application settings and table preferences.</p>
                        </div>

                        {/* System Configs */}
                        <CollapsibleSection title="Global Configurations" icon={<Settings className="w-5 h-5" />} defaultOpen={false}>
                            <SystemSettingsCard />
                        </CollapsibleSection>

                        <CollapsibleSection title="Advanced Operations" icon={<Layers className="w-5 h-5" />} defaultOpen={false}>
                            <AdvancedOperationsCard />
                        </CollapsibleSection>

                        <CollapsibleSection title="Material Assignment" icon={<Database className="w-5 h-5" />} defaultOpen={true}>
                            <MaterialAssignment />
                        </CollapsibleSection>

                        <CollapsibleSection title="Table Configuration" icon={<TableIcon className="w-5 h-5" />} defaultOpen={false}>
                            <div>
                                <p className="text-slate-500 mb-4 px-1">Customize column visibility and ordering for system tables.</p>
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
                        </CollapsibleSection>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default AdminDashboard;

// Component for Global System Settings
function SystemSettingsCard() {
    const queryClient = useQueryClient();

    // Fetch Configs
    const { data: configs = {} } = useQuery<Record<string, string>>({
        queryKey: ['system-config'],
        queryFn: async () => (await fetch('/api/admin/system-config')).json()
    });

    const mutation = useMutation({
        mutationFn: async ({ key, value }: { key: string, value: string }) => {
            const res = await fetch('/api/admin/system-config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ key, value })
            });
            if (!res.ok) throw new Error('Failed');
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['system-config'] });
            toast.success("Configuration updated");
        },
        onError: () => toast.error("Failed to update configuration")
    });

    const ospSource = configs['OSP_MATERIAL_SOURCE'] || 'SLT';

    return (
        <Card className="border-l-4 border-l-blue-600 mb-8">
            <CardHeader className="py-4">
                <div className="flex items-center gap-2">
                    <Settings className="w-5 h-5 text-blue-600" />
                    <CardTitle className="text-lg">Global Configurations</CardTitle>
                </div>
                <CardDescription>Manage project-wide settings and defaults.</CardDescription>
            </CardHeader>
            <CardContent className="py-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* OSP FTTH Material Source Setting */}
                    <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                        <div className="flex items-start justify-between mb-4">
                            <div>
                                <h4 className="text-sm font-bold text-slate-800 uppercase tracking-wide">OSP FTTH Material Source</h4>
                                <p className="text-xs text-slate-500 mt-1">
                                    Determines the primary stock source for OSP FTTH Service Orders.
                                    <br /><span className="italic opacity-70">(Future projects like High-rise will support mixed material sources).</span>
                                </p>
                            </div>
                            <Badge variant="outline" className={ospSource === 'SLT' ? 'bg-blue-50 text-blue-700' : 'bg-orange-50 text-orange-700'}>
                                {ospSource}
                            </Badge>
                        </div>

                        <div className="flex items-center gap-3">
                            <div className="flex-1">
                                <Label className="text-xs font-semibold text-slate-500 mb-1.5 block">Default Source for OSP FTTH</Label>
                                <Select
                                    value={ospSource}
                                    onValueChange={(val) => mutation.mutate({ key: 'OSP_MATERIAL_SOURCE', value: val })}
                                    disabled={mutation.isPending}
                                >
                                    <SelectTrigger className="bg-white h-9">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="SLT">
                                            <div className="flex flex-col">
                                                <span className="font-medium">SLT Provided (Default)</span>
                                                <span className="text-[10px] text-slate-400">Materials issued by SLT, no company stock deduction.</span>
                                            </div>
                                        </SelectItem>
                                        <SelectItem value="COMPANY">
                                            <div className="flex flex-col">
                                                <span className="font-medium">Company (SLTS) Supplied</span>
                                                <span className="text-[10px] text-slate-400">Deducts from Contractor/Company Inventory.</span>
                                            </div>
                                        </SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        {ospSource === 'COMPANY' && (
                            <div className="mt-3 p-2 bg-yellow-50 text-yellow-700 text-xs rounded border border-yellow-200 flex items-start gap-2">
                                <Database className="w-3 h-3 mt-0.5" />
                                <span>Caution: Switching to COMPANY mode will affect stock levels for all new OSP completions.</span>
                            </div>
                        )}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

// Advanced Operations Component
function AdvancedOperationsCard() {
    const [isSyncing, setIsSyncing] = useState(false);
    const [syncStats, setSyncStats] = useState<any>(null);

    const handleSync = async () => {
        setIsSyncing(true);
        setSyncStats(null);
        try {
            const res = await fetch('/api/cron/sync-all');
            const data = await res.json();
            if (data.success) {
                setSyncStats(data.stats);
                toast.success("Global SOD Sync completed!");
            } else {
                toast.error("Sync failed: " + data.error);
            }
        } catch (error) {
            toast.error("Network error during sync");
        } finally {
            setIsSyncing(false);
        }
    };

    return (
        <Card className="border-l-4 border-l-purple-600 mb-8">
            <CardHeader className="py-4">
                <div className="flex items-center gap-2">
                    <Layers className="w-5 h-5 text-purple-600" />
                    <CardTitle className="text-lg">System Operations</CardTitle>
                </div>
                <CardDescription>Perform manual system-wide maintenance and data synchronization.</CardDescription>
            </CardHeader>
            <CardContent className="py-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Manual SOD Sync */}
                    <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                        <div className="flex items-start justify-between mb-4">
                            <div className="flex-1">
                                <h4 className="text-sm font-bold text-slate-800 uppercase tracking-wide">Manual SOD Sync</h4>
                                <p className="text-xs text-slate-500 mt-1">
                                    Trigger a manual update for all OPMCs from the SLT API.
                                    Used for out-of-schedule updates.
                                </p>
                            </div>
                            <Button
                                size="sm"
                                className="bg-purple-600 hover:bg-purple-700"
                                onClick={handleSync}
                                disabled={isSyncing}
                            >
                                {isSyncing ? 'Syncing...' : 'Start Sync'}
                            </Button>
                        </div>

                        {syncStats && (
                            <div className="mt-3 grid grid-cols-4 gap-2 text-center">
                                <div className="p-2 bg-white rounded border">
                                    <div className="text-xs text-slate-400">Success</div>
                                    <div className="text-sm font-bold text-green-600">{syncStats.success}</div>
                                </div>
                                <div className="p-2 bg-white rounded border">
                                    <div className="text-xs text-slate-400">Failed</div>
                                    <div className="text-sm font-bold text-red-600">{syncStats.failed}</div>
                                </div>
                                <div className="p-2 bg-white rounded border">
                                    <div className="text-xs text-slate-400">Created</div>
                                    <div className="text-sm font-bold text-blue-600">{syncStats.created}</div>
                                </div>
                                <div className="p-2 bg-white rounded border">
                                    <div className="text-xs text-slate-400">Updated</div>
                                    <div className="text-sm font-bold text-orange-600">{syncStats.updated}</div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Future: Backup/Index maintenance */}
                    <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 opacity-60">
                        <div className="flex items-start justify-between mb-4">
                            <div>
                                <h4 className="text-sm font-bold text-slate-800 uppercase tracking-wide">Database Maintenance</h4>
                                <p className="text-xs text-slate-500 mt-1">
                                    Perform periodic indexing and cleanup operations.
                                </p>
                            </div>
                            <Button size="sm" variant="outline" disabled>Optimized</Button>
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
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

function CollapsibleSection({ title, icon, children, defaultOpen = false }: { title: string, icon: React.ReactNode, children: React.ReactNode, defaultOpen?: boolean }) {
    const [isOpen, setIsOpen] = useState(defaultOpen);

    return (
        <div className="border rounded-xl bg-white shadow-sm overflow-hidden transition-all duration-200">
            <div
                onClick={() => setIsOpen(!isOpen)}
                className={cn(
                    "flex items-center justify-between p-4 cursor-pointer hover:bg-slate-50 transition-colors select-none",
                    isOpen ? "border-b border-slate-100 bg-slate-50/50" : ""
                )}
            >
                <div className="flex items-center gap-3">
                    <div className={cn("p-2 rounded-lg transition-colors", isOpen ? "bg-blue-100 text-blue-600" : "bg-slate-100 text-slate-600")}>
                        {icon}
                    </div>
                    <h3 className={cn("font-bold text-lg", isOpen ? "text-blue-900" : "text-slate-700")}>{title}</h3>
                </div>
                <div className={cn("p-1 rounded-full text-slate-400 transition-transform duration-200", isOpen && "transform rotate-180 text-blue-500")}>
                    <ChevronDown className="w-5 h-5" />
                </div>
            </div>

            <div className={cn(
                "transition-[max-height,opacity] duration-300 ease-in-out overflow-hidden",
                isOpen ? "max-h-[5000px] opacity-100" : "max-h-0 opacity-0"
            )}>
                <div className="p-6 bg-slate-50/30">
                    {children}
                </div>
            </div>
        </div>
    );
}

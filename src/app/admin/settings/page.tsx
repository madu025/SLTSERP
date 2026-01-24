"use client";

import React, { useState, useEffect } from 'react';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import { useRouter } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { GripVertical, Plus, Settings, Database, ChevronDown, Layers, Table as TableIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
                                            key={`${tableName}-${tableSettings.visibleColumns.join(',')}`}
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

// Types for Advanced operations
interface ResetResults {
    message: string;
    serviceOrders?: number;
    statusHistory?: number;
    materialUsage?: number;
    logsDeleted?: number;
}

interface SyncStats {
    queuedCount: number;
    lastSyncTriggered: string;
}

interface HistoricStats {
    checked: number;
    completed: number;
    errors?: string[];
}

// Advanced Operations Component
function AdvancedOperationsCard() {
    const router = useRouter();
    const queryClient = useQueryClient();
    const [isSyncing, setIsSyncing] = useState(false);
    const [isHistoricSync, setIsHistoricSync] = useState(false);
    const [isRecalculating, setIsRecalculating] = useState(false);
    const [isClearing, setIsClearing] = useState(false);
    const [syncStats, setSyncStats] = useState<SyncStats | null>(null);
    const [historicStats, setHistoricStats] = useState<HistoricStats | null>(null);
    const [clearResults, setClearResults] = useState<ResetResults | null>(null);

    const handleHistoricSync = async () => {
        const confirmed = window.confirm(
            '⏳ HISTORY SYNC\n\n' +
            'This will sync ALL completed Service Orders starting from 2026-01-01.\n\n' +
            'This process may take a while depending on the data volume.\n' +
            'Missing SODs will be created.\n\n' +
            'Proceed?'
        );

        if (!confirmed) return;

        setIsHistoricSync(true);
        setHistoricStats(null);
        try {
            const res = await fetch('/api/automation/completed-sod-sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ startDate: '2026-01-01' })
            });

            const data = await res.json();
            if (data.success) {
                setHistoricStats(data.data as HistoricStats);
                toast.success("Historical Sync completed!");
            } else {
                toast.error("Sync failed: " + (data.error || 'Unknown error'));
            }
        } catch {
            toast.error("Network error during sync");
        } finally {
            setIsHistoricSync(false);
        }
    };

    const handleSync = async () => {
        setIsSyncing(true);
        setSyncStats(null);
        try {
            const res = await fetch('/api/cron/sync-all');
            const data = await res.json();
            if (data.success) {
                setSyncStats(data.stats as SyncStats);
                toast.success("Global SOD Sync completed!");
            } else {
                toast.error("Sync failed: " + (data.error || 'Unknown error'));
            }
        } catch {
            toast.error("Network error during sync");
        } finally {
            setIsSyncing(false);
        }
    };

    const handleClearServiceOrders = async () => {
        const confirmed = window.confirm(
            '⚠️ WARNING: This will permanently delete ALL Service Order data!\n\n' +
            'This includes:\n' +
            '- All Pending, Completed, and Returned Service Orders\n' +
            '- All Status History\n' +
            '- All Material Usage Records\n' +
            '- All Restore Requests\n' +
            '- Dashboard Statistics\n\n' +
            'This action CANNOT be undone!\n\n' +
            'Are you absolutely sure you want to proceed?'
        );

        if (!confirmed) return;

        const confirmStr = window.prompt('🚨 FINAL SECURITY CHECK\n\nPlease type "RESET_ALL" to proceed with the full system reset:');

        if (confirmStr !== 'RESET_ALL') {
            if (confirmStr !== null) toast.error("Incorrect confirmation text.");
            return;
        }

        setIsClearing(true);
        setClearResults(null);
        try {
            const res = await fetch('/api/admin/system/reset-sods', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ confirmText: 'RESET_ALL' })
            });
            const data = await res.json();

            if (res.ok) {
                setClearResults({ message: data.message });
                toast.success(data.message);
                queryClient.invalidateQueries();
            } else {
                toast.error("Clear failed: " + (data.message || 'Unknown error'));
            }
        } catch {
            toast.error("Network error during clear operation");
        } finally {
            setIsClearing(false);
        }
    };

    const handleRecalculateStats = async () => {
        setIsRecalculating(true);
        try {
            const res = await fetch('/api/admin/system/recalculate-stats', { method: 'POST' });
            const data = await res.json();
            if (res.ok) {
                toast.success(data.message || "Statistics recalculated successfully!");
                queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
            } else {
                toast.error("Recalculation failed: " + (data.message || 'Unknown error'));
            }
        } catch {
            toast.error("Network error during recalculation");
        } finally {
            setIsRecalculating(false);
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
                            <div className="mt-3 space-y-3">
                                <div className="p-3 bg-white rounded border border-purple-100 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-purple-50 flex items-center justify-center text-purple-600">
                                            <Layers className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Jobs Queued</p>
                                            <p className="text-xl font-bold text-purple-700">{syncStats.queuedCount} RTOMs</p>
                                        </div>
                                    </div>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => router.push('/admin/jobs')}
                                        className="text-xs border-purple-200 text-purple-700 hover:bg-purple-50"
                                    >
                                        Track Progress
                                    </Button>
                                </div>
                                <p className="text-[10px] text-slate-400 italic text-center">
                                    Sync triggered at {new Date(syncStats.lastSyncTriggered).toLocaleTimeString()}
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Historical Sync (2026) */}
                    <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                        <div className="flex items-start justify-between mb-4">
                            <div className="flex-1">
                                <h4 className="text-sm font-bold text-slate-800 uppercase tracking-wide">Full History Sync (2026)</h4>
                                <p className="text-xs text-slate-500 mt-1">
                                    Sync ALL Completed Service Orders starting from <b>Jan 1st, 2026</b>.
                                    Use this to recover missing historical data.
                                </p>
                            </div>
                            <Button
                                size="sm"
                                variant="outline"
                                className="border-blue-600 text-blue-600 hover:bg-blue-50"
                                onClick={handleHistoricSync}
                                disabled={isHistoricSync}
                            >
                                {isHistoricSync ? 'Syncing...' : 'Sync History'}
                            </Button>
                        </div>
                        {historicStats && (
                            <div className="mt-3 p-3 bg-white rounded border border-blue-100">
                                <p className="text-xs text-slate-500 mb-1">Result:</p>
                                <div className="flex gap-4 text-sm">
                                    <span className="text-slate-700"><b>{historicStats.checked}</b> Checked</span>
                                    <span className="text-green-600"><b>{historicStats.completed}</b> Processed</span>
                                </div>
                                {historicStats.errors && historicStats.errors.length > 0 && (
                                    <p className="text-[10px] text-red-500 mt-1">{historicStats.errors.length} errors occurred.</p>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Recalculate Dashboard Stats */}
                    <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                        <div className="flex items-start justify-between mb-4">
                            <div className="flex-1">
                                <h4 className="text-sm font-bold text-slate-800 uppercase tracking-wide">Recalculate Dashboard Stats</h4>
                                <p className="text-xs text-slate-500 mt-1">
                                    Refresh all performance indicators and RTOM stats from source data.
                                    Fixes inconsistencies in dashboard counts.
                                </p>
                            </div>
                            <Button
                                size="sm"
                                variant="outline"
                                className="border-emerald-600 text-emerald-600 hover:bg-emerald-50"
                                onClick={handleRecalculateStats}
                                disabled={isRecalculating}
                            >
                                {isRecalculating ? 'Recalculating...' : 'Fix Stats'}
                            </Button>
                        </div>
                    </div>

                    {/* Clear All Service Orders */}
                    <div className="p-4 bg-red-50 rounded-lg border border-red-200 md:col-span-2">
                        <div className="flex items-start justify-between mb-4">
                            <div className="flex-1">
                                <h4 className="text-sm font-bold text-red-800 uppercase tracking-wide">Clear All Service Orders</h4>
                                <p className="text-xs text-red-600 mt-1">
                                    ⚠️ DANGER: Permanently delete all SOD data.
                                    Use for production daily reset only!
                                </p>
                            </div>
                            <Button
                                size="sm"
                                variant="destructive"
                                className="bg-red-600 hover:bg-red-700"
                                onClick={handleClearServiceOrders}
                                disabled={isClearing}
                            >
                                {isClearing ? 'Clearing...' : 'Clear All'}
                            </Button>
                        </div>

                        {clearResults && (
                            <div className="mt-3 p-3 bg-white rounded border border-red-100">
                                <p className="text-xs text-slate-700">{clearResults.message}</p>
                            </div>
                        )}
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

    // Note: This component is keyed by settings in the parent, so it automatically 
    // resets 'cols' state when global settings are updated/saved.
    // This removes the need for a useEffect to sync props to state.


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

    const handleDragOver = (e: React.DragEvent) => {
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
                                    onDragOver={handleDragOver}
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

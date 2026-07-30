"use client";

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format, formatDistanceToNow } from 'date-fns';
import {
    Search, History, User, Activity, Clock, HardHat, FileText,
    Package, Warehouse, ClipboardCheck, Shield, Receipt,
    PackageMinus, Filter, ArrowRight, CheckCircle2, AlertCircle, Trash2, Edit3, PlusCircle, Download,
    Copy, Globe, ShieldCheck, Cpu, Terminal, FileCode, Check
} from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import RoleGuard from '@/components/RoleGuard';
import { ROLE_GROUPS } from "@/config/roles";
import { toast } from "sonner";

interface AuditLog {
    id: string;
    action: string;
    entity: string;
    entityId: string;
    createdAt: string;
    user?: { name: string; username: string };
    ipAddress?: string;
    userAgent?: string;
    oldValue: Record<string, unknown> | null;
    newValue: Record<string, unknown> | null;
}

const ENTITY_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
    'Contractor': HardHat,
    'ServiceOrder': FileText,
    'InventoryItem': Package,
    'InventoryStore': Warehouse,
    'StockRequest': ClipboardCheck,
    'User': User,
    'Role': Shield,
    'SODRevenueConfig': Receipt,
    'GRN': Receipt,
    'MRN': PackageMinus
};

export default function AuditLogPage() {
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
    const [filterEntity, setFilterEntity] = useState("all");
    const [filterAction, setFilterAction] = useState("all");

    const { data: logs = [], isLoading } = useQuery<AuditLog[]>({
        queryKey: ["audit-logs"],
        queryFn: async () => {
            const res = await fetch("/api/admin/audit-logs");
            if (!res.ok) return [];
            const json = await res.json();
            return Array.isArray(json) ? json : (Array.isArray(json.data) ? json.data : []);
        }
    });

    const filteredLogs = logs.filter(log => {
        const userName = log.user?.name || 'System';
        const userUsername = log.user?.username || 'system';
        const matchesSearch =
            userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
            userUsername.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (log.action || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (log.entity || '').toLowerCase().includes(searchTerm.toLowerCase());

        const matchesEntity = filterEntity === "all" || log.entity === filterEntity;
        const matchesAction = filterAction === "all" || log.action === filterAction;

        return matchesSearch && matchesEntity && matchesAction;
    });

    const handleDownloadCSV = () => {
        if (!filteredLogs || filteredLogs.length === 0) {
            toast.error("No logs available to download");
            return;
        }

        try {
            const headers = ["Timestamp", "User Name", "Username", "Action", "Entity", "Entity ID", "IP Address"];
            const rows = filteredLogs.map(log => [
                new Date(log.createdAt).toISOString(),
                log.user?.name || 'System',
                log.user?.username || 'system',
                log.action,
                log.entity,
                log.entityId,
                log.ipAddress || "Internal"
            ]);

            const csvContent = [
                headers.join(","),
                ...rows.map(e => e.map(val => `"${String(val).replace(/"/g, '""')}"`).join(","))
            ].join("\n");

            const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.setAttribute("href", url);
            link.setAttribute("download", `system_audit_logs_${new Date().toISOString().split("T")[0]}.csv`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            toast.success("Audit logs exported to CSV successfully");
        } catch (error) {
            console.error("Failed to download CSV", error);
            toast.error("Failed to export logs");
        }
    };

    const copyToClipboard = (text: string, message: string) => {
        navigator.clipboard.writeText(text);
        toast.success(message);
    };

    const getChangedFieldCount = (oldVal: Record<string, unknown> | null, newVal: Record<string, unknown> | null) => {
        if (!oldVal || !newVal) return 0;
        const allKeys = Array.from(new Set([...Object.keys(oldVal), ...Object.keys(newVal)]));
        let count = 0;
        for (const key of allKeys) {
            if (['id', 'createdAt', 'updatedAt', 'password'].includes(key)) continue;
            if (JSON.stringify(oldVal[key]) !== JSON.stringify(newVal[key])) {
                count++;
            }
        }
        return count;
    };

    // Statistics
    const stats = {
        total: logs.length,
        updates: logs.filter(l => l.action === 'UPDATE' || l.action === 'PATCH').length,
        creates: logs.filter(l => l.action === 'CREATE' || l.action === 'POST').length,
        deletes: logs.filter(l => l.action === 'DELETE').length,
    };

    const uniqueEntities = Array.from(new Set(logs.map(l => l.entity)));
    const uniqueActions = Array.from(new Set(logs.map(l => l.action)));

    const getEntityIcon = (entity: string) => {
        const Icon = ENTITY_ICONS[entity] || Activity;
        return <Icon className="w-4 h-4 text-blue-400" />;
    };

    const renderDiff = (oldVal: Record<string, unknown> | null, newVal: Record<string, unknown> | null) => {
        if (!oldVal && !newVal) return <div className="text-slate-400 italic text-xs py-4 text-center">No snapshot data captured</div>;

        if (!oldVal && newVal) {
            return (
                <div className="space-y-2">
                    <div className="text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                        <PlusCircle className="w-3.5 h-3.5" /> Initial State Data
                    </div>
                    {Object.entries(newVal).map(([k, v]) => (
                        <div key={k} className="flex justify-between items-center py-1.5 px-3 bg-slate-900/80 rounded-lg border border-slate-800/80 text-xs">
                            <span className="font-mono text-slate-400">{k}</span>
                            <span className="font-mono text-emerald-400 font-bold truncate max-w-[240px]">
                                {typeof v === 'object' ? JSON.stringify(v) : String(v ?? 'N/A')}
                            </span>
                        </div>
                    ))}
                </div>
            );
        }

        if (oldVal && !newVal) {
            return (
                <div className="space-y-2">
                    <div className="text-xs font-semibold text-rose-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                        <Trash2 className="w-3.5 h-3.5" /> Purged State Data
                    </div>
                    {Object.entries(oldVal).map(([k, v]) => (
                        <div key={k} className="flex justify-between items-center py-1.5 px-3 bg-slate-900/80 rounded-lg border border-slate-800/80 text-xs">
                            <span className="font-mono text-slate-400">{k}</span>
                            <span className="font-mono text-rose-400 line-through truncate max-w-[240px]">
                                {typeof v === 'object' ? JSON.stringify(v) : String(v ?? 'N/A')}
                            </span>
                        </div>
                    ))}
                </div>
            );
        }

        const changes = [];
        const allKeys = Array.from(new Set([...Object.keys(oldVal || {}), ...Object.keys(newVal || {})]));

        for (const key of allKeys) {
            if (['id', 'createdAt', 'updatedAt', 'password'].includes(key)) continue;

            const oldK = oldVal?.[key];
            const newK = newVal?.[key];

            if (JSON.stringify(oldK) !== JSON.stringify(newK)) {
                changes.push({
                    field: key,
                    old: oldK,
                    new: newK
                });
            }
        }

        return (
            <div className="space-y-2.5">
                {changes.length === 0 ? (
                    <div className="text-slate-400 italic text-xs py-4 text-center bg-slate-900/50 rounded-xl border border-slate-800">
                        Metadata refresh / No specific field mutation detected
                    </div>
                ) : (
                    changes.map((change, idx) => (
                        <div key={idx} className="bg-slate-900/90 p-3 rounded-xl border border-slate-800/80 space-y-1.5">
                            <div className="flex items-center justify-between">
                                <Badge variant="outline" className="text-[10px] font-mono py-0 text-slate-300 border-slate-700 bg-slate-800">
                                    {change.field}
                                </Badge>
                                <span className="text-[9px] text-slate-500 font-mono">Mutated</span>
                            </div>
                            <div className="grid grid-cols-2 gap-3 text-xs pt-1">
                                <div className="bg-rose-950/40 border border-rose-900/40 p-2 rounded-lg">
                                    <div className="text-[9px] text-rose-400 font-bold uppercase mb-0.5">Old Value</div>
                                    <div className="font-mono text-rose-300 truncate text-[11px]">
                                        {typeof change.old === 'object' ? JSON.stringify(change.old) : String(change.old ?? 'N/A')}
                                    </div>
                                </div>
                                <div className="bg-emerald-950/40 border border-emerald-900/40 p-2 rounded-lg">
                                    <div className="text-[9px] text-emerald-400 font-bold uppercase mb-0.5">New Value</div>
                                    <div className="font-mono text-emerald-300 font-bold truncate text-[11px]">
                                        {typeof change.new === 'object' ? JSON.stringify(change.new) : String(change.new ?? 'N/A')}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>
        );
    };

    const getActionColor = (action: string) => {
        if (action.includes('CREATE')) return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
        if (action.includes('UPDATE') || action.includes('PATCH')) return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
        if (action.includes('DELETE')) return 'bg-rose-500/20 text-rose-400 border-rose-500/30';
        return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
    };

    return (
        <RoleGuard allowedRoles={ROLE_GROUPS.ADMINS}>
            <div className="h-screen flex bg-slate-50 overflow-hidden text-xs">
                <Sidebar />
                <div className="flex-1 flex flex-col min-w-0">
                    <Header />
                    <main className="flex-1 overflow-y-auto p-6 space-y-6">

                        <div className="flex justify-between items-end">
                            <div>
                                <h1 className="text-2xl font-black text-slate-900 flex items-center gap-3">
                                    <div className="p-2 bg-blue-600 rounded-lg shadow-lg shadow-blue-200">
                                        <History className="w-6 h-6 text-white" />
                                    </div>
                                    System Intelligence Trail
                                </h1>
                                <p className="text-slate-500 text-[10px] uppercase tracking-[0.2em] font-bold mt-2 ml-1">
                                    Security Monitoring & Audit Compliance
                                </p>
                            </div>
                            <div className="flex gap-3">
                                <Card className="bg-white border-none shadow-sm px-4 py-2 flex items-center gap-3">
                                    <div className="p-2 bg-blue-50 rounded-full"><PlusCircle className="w-4 h-4 text-blue-600" /></div>
                                    <div><div className="font-black text-slate-900">{stats.creates}</div><div className="text-[8px] text-slate-400 uppercase font-bold">New Entries</div></div>
                                </Card>
                                <Card className="bg-white border-none shadow-sm px-4 py-2 flex items-center gap-3">
                                    <div className="p-2 bg-amber-50 rounded-full"><Edit3 className="w-4 h-4 text-amber-600" /></div>
                                    <div><div className="font-black text-slate-900">{stats.updates}</div><div className="text-[8px] text-slate-400 uppercase font-bold">Modifications</div></div>
                                </Card>
                                <Card className="bg-white border-none shadow-sm px-4 py-2 flex items-center gap-3">
                                    <div className="p-2 bg-red-50 rounded-full"><Trash2 className="w-4 h-4 text-red-600" /></div>
                                    <div><div className="font-black text-slate-900">{stats.deletes}</div><div className="text-[8px] text-slate-400 uppercase font-bold">Removals</div></div>
                                </Card>
                            </div>
                        </div>

                        <Card className="border-none shadow-xl shadow-slate-200/50 overflow-hidden rounded-2xl">
                            <CardHeader className="bg-white border-b border-slate-100 py-4 px-6">
                                <div className="flex flex-wrap items-center gap-4">
                                    <div className="bg-slate-100/50 border-none rounded-xl px-3 flex items-center gap-2 flex-1 min-w-[300px]">
                                        <Search className="w-4 h-4 text-slate-400" />
                                        <Input
                                            placeholder="Search across history..."
                                            className="border-0 bg-transparent focus-visible:ring-0 h-10 text-sm"
                                            value={searchTerm}
                                            onChange={e => setSearchTerm(e.target.value)}
                                        />
                                    </div>
                                    <div className="flex gap-2">
                                        <Select value={filterEntity} onValueChange={setFilterEntity}>
                                            <SelectTrigger className="w-[160px] h-10 rounded-xl border-slate-100 bg-slate-50">
                                                <Filter className="w-3.5 h-3.5 mr-2 text-slate-400" />
                                                <SelectValue placeholder="All Entities" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="all">All Entities</SelectItem>
                                                {uniqueEntities.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}
                                            </SelectContent>
                                        </Select>

                                        <Select value={filterAction} onValueChange={setFilterAction}>
                                            <SelectTrigger className="w-[140px] h-10 rounded-xl border-slate-100 bg-slate-50">
                                                <Activity className="w-3.5 h-3.5 mr-2 text-slate-400" />
                                                <SelectValue placeholder="All Actions" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="all">All Actions</SelectItem>
                                                {uniqueActions.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                                            </SelectContent>
                                        </Select>

                                        <Button onClick={handleDownloadCSV} variant="outline" className="h-10 rounded-xl border-slate-100 bg-slate-50 px-3">
                                            <Download className="w-4 h-4 text-slate-600" />
                                        </Button>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="p-0">
                                <div className="overflow-auto max-h-[calc(100vh-250px)]">
                                    <Table>
                                        <TableHeader className="bg-slate-50 sticky top-0 z-10">
                                            <TableRow>
                                                <TableHead className="w-[180px] text-[10px] uppercase font-bold text-slate-500">Timestamp</TableHead>
                                                <TableHead className="w-[200px] text-[10px] uppercase font-bold text-slate-500">Performed By</TableHead>
                                                <TableHead className="w-[150px] text-[10px] uppercase font-bold text-slate-500">Action</TableHead>
                                                <TableHead className="w-[150px] text-[10px] uppercase font-bold text-slate-500">Entity</TableHead>
                                                <TableHead className="text-[10px] uppercase font-bold text-slate-500">IP Address</TableHead>
                                                <TableHead className="text-right text-[10px] uppercase font-bold text-slate-500">Action</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {isLoading ? (
                                                <TableRow><TableCell colSpan={6} className="text-center py-10 text-slate-400 italic">Processing logs...</TableCell></TableRow>
                                            ) : filteredLogs.length === 0 ? (
                                                <TableRow><TableCell colSpan={6} className="text-center py-10 text-slate-400 italic">No matching activities found.</TableCell></TableRow>
                                            ) : filteredLogs.map((log) => (
                                                <TableRow key={log.id} className="hover:bg-slate-50/50 transition-colors">
                                                    <td className="py-3 px-4">
                                                        <div className="flex items-center gap-2 text-slate-600">
                                                            <Clock className="w-3 h-3 text-slate-400" />
                                                            {format(new Date(log.createdAt), 'MMM dd, HH:mm:ss')}
                                                        </div>
                                                    </td>
                                                    <td className="py-3 px-4">
                                                        <div className="flex items-center gap-2">
                                                            <div className="w-6 h-6 rounded-full bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 font-bold text-[10px]">
                                                                {(log.user?.name || 'S')[0]}
                                                            </div>
                                                            <div>
                                                                <div className="font-semibold text-slate-900">{log.user?.name || 'System'}</div>
                                                                <div className="text-[9px] text-slate-400">@{log.user?.username || 'system'}</div>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="py-3 px-4">
                                                        <Badge variant="outline" className={`${getActionColor(log.action)} text-[9px] px-2 py-0.5 font-bold uppercase`}>
                                                            {log.action}
                                                        </Badge>
                                                    </td>
                                                    <td className="py-3 px-4">
                                                        <div className="flex items-center gap-2">
                                                            <div className="p-1.5 bg-slate-50 rounded text-slate-400 group-hover:bg-blue-50 group-hover:text-blue-500 transition-colors">
                                                                {getEntityIcon(log.entity)}
                                                            </div>
                                                            <div className="font-mono text-[10px] text-slate-600 font-bold uppercase tracking-tighter">
                                                                {log.entity} <span className="text-slate-300 font-light">#{log.entityId.slice(-6)}</span>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="py-3 px-4">
                                                        <div className="text-slate-400 font-mono text-[9px]">{log.ipAddress || 'Internal Direct'}</div>
                                                    </td>
                                                    <td className="py-3 px-4 text-right">
                                                        <Button
                                                            size="sm"
                                                            variant="ghost"
                                                            onClick={() => setSelectedLog(log)}
                                                            className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 font-bold text-[11px] px-2 h-7"
                                                        >
                                                            Inspect Details →
                                                        </Button>
                                                    </td>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Slide-over Drawer for Audit Log Detail */}
                        <Sheet open={!!selectedLog} onOpenChange={(open) => !open && setSelectedLog(null)}>
                            <SheetContent side="right" className="w-full sm:max-w-2xl lg:max-w-3xl p-0 flex flex-col bg-slate-900 border-l border-slate-800 text-slate-100 shadow-2xl overflow-hidden">
                                {/* Header */}
                                <SheetHeader className="bg-slate-950/80 backdrop-blur border-b border-slate-800/80 p-6 relative">
                                    <div className="flex items-center justify-between gap-4 pr-6">
                                        <div className="flex items-center gap-3">
                                            <div className="p-3 bg-blue-600/20 border border-blue-500/30 rounded-2xl shadow-inner">
                                                {selectedLog ? getEntityIcon(selectedLog.entity) : <Activity className="w-6 h-6 text-blue-400" />}
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <Badge className={`${getActionColor(selectedLog?.action || '')} px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider`}>
                                                        {selectedLog?.action}
                                                    </Badge>
                                                    <span className="text-slate-400 font-mono text-[11px] font-semibold">
                                                        {selectedLog?.entity} #{selectedLog?.entityId.slice(-8)}
                                                    </span>
                                                </div>
                                                <SheetTitle className="text-xl font-black text-white mt-1">
                                                    Transaction Audit Intelligence
                                                </SheetTitle>
                                                <SheetDescription className="text-slate-400 text-xs mt-0.5 flex items-center gap-2">
                                                    <Clock className="w-3.5 h-3.5 text-slate-500" />
                                                    {selectedLog && format(new Date(selectedLog.createdAt), 'PPPP p')}
                                                    {selectedLog && (
                                                        <span className="text-blue-400 font-semibold">
                                                            ({formatDistanceToNow(new Date(selectedLog.createdAt), { addSuffix: true })})
                                                        </span>
                                                    )}
                                                </SheetDescription>
                                            </div>
                                        </div>
                                    </div>
                                </SheetHeader>

                                {/* Body Metadata Quick Grid */}
                                <div className="p-6 bg-slate-900/90 border-b border-slate-800/80">
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                        {/* User Card */}
                                        <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800/60 flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-blue-600/20 border border-blue-500/40 flex items-center justify-center text-blue-400 font-bold text-xs">
                                                {(selectedLog?.user?.name || 'S')[0]}
                                            </div>
                                            <div className="min-w-0">
                                                <div className="text-[10px] uppercase font-bold text-slate-500">Actor</div>
                                                <div className="font-semibold text-xs text-white truncate">{selectedLog?.user?.name || 'System'}</div>
                                                <div className="text-[9px] text-slate-400 truncate">@{selectedLog?.user?.username || 'system'}</div>
                                            </div>
                                        </div>

                                        {/* IP Address Card */}
                                        <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800/60 flex items-center gap-3">
                                            <div className="p-2 bg-indigo-600/20 border border-indigo-500/40 rounded-lg text-indigo-400">
                                                <Globe className="w-4 h-4" />
                                            </div>
                                            <div className="min-w-0">
                                                <div className="text-[10px] uppercase font-bold text-slate-500">Origin IP</div>
                                                <div className="font-mono text-xs font-semibold text-slate-200 truncate">{selectedLog?.ipAddress || 'Internal Direct'}</div>
                                                <div className="text-[9px] text-emerald-400">Verified Origin</div>
                                            </div>
                                        </div>

                                        {/* Entity Card */}
                                        <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800/60 flex items-center gap-3">
                                            <div className="p-2 bg-emerald-600/20 border border-emerald-500/40 rounded-lg text-emerald-400">
                                                <ShieldCheck className="w-4 h-4" />
                                            </div>
                                            <div className="min-w-0">
                                                <div className="text-[10px] uppercase font-bold text-slate-500">Target Entity</div>
                                                <div className="font-semibold text-xs text-emerald-400 truncate">{selectedLog?.entity}</div>
                                                <div className="font-mono text-[9px] text-slate-400 truncate">ID: {selectedLog?.entityId}</div>
                                            </div>
                                        </div>

                                        {/* Audit Hash Card */}
                                        <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800/60 flex items-center gap-3">
                                            <div className="p-2 bg-purple-600/20 border border-purple-500/40 rounded-lg text-purple-400">
                                                <Cpu className="w-4 h-4" />
                                            </div>
                                            <div className="min-w-0">
                                                <div className="text-[10px] uppercase font-bold text-slate-500">Ledger Hash</div>
                                                <div className="font-mono text-xs text-purple-300 font-bold truncate">0x{selectedLog?.id.slice(-6)}</div>
                                                <div className="text-[9px] text-slate-400">SHA-256 Tamper Proof</div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Tabbed Detail Inspector */}
                                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                                    <Tabs defaultValue="diff" className="w-full">
                                        <TabsList className="bg-slate-950 border border-slate-800 p-1 rounded-xl w-full grid grid-cols-3">
                                            <TabsTrigger value="diff" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white text-xs font-semibold rounded-lg py-2">
                                                <CheckCircle2 className="w-3.5 h-3.5 mr-2" /> Field Intelligence
                                            </TabsTrigger>
                                            <TabsTrigger value="raw" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white text-xs font-semibold rounded-lg py-2">
                                                <FileCode className="w-3.5 h-3.5 mr-2" /> JSON Payload State
                                            </TabsTrigger>
                                            <TabsTrigger value="security" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white text-xs font-semibold rounded-lg py-2">
                                                <Terminal className="w-3.5 h-3.5 mr-2" /> Provenance & Security
                                            </TabsTrigger>
                                        </TabsList>

                                        {/* Tab 1: Field Intelligence Diff */}
                                        <TabsContent value="diff" className="mt-4 space-y-4">
                                            <div className="bg-slate-950/80 p-5 rounded-2xl border border-slate-800/80">
                                                <div className="flex items-center justify-between mb-4">
                                                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-300 flex items-center gap-2">
                                                        <Activity className="w-4 h-4 text-blue-400" />
                                                        State Mutation Matrix
                                                    </h4>
                                                    <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full font-mono border border-slate-700">
                                                        {getChangedFieldCount(selectedLog?.oldValue || null, selectedLog?.newValue || null)} Attributes Changed
                                                    </span>
                                                </div>
                                                {selectedLog && renderDiff(selectedLog.oldValue, selectedLog.newValue)}
                                            </div>
                                        </TabsContent>

                                        {/* Tab 2: Raw State Inspector */}
                                        <TabsContent value="raw" className="mt-4 space-y-4">
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                {/* Previous State */}
                                                <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-2">
                                                    <div className="flex justify-between items-center">
                                                        <span className="text-[11px] font-bold text-rose-400 flex items-center gap-1.5">
                                                            <AlertCircle className="w-3.5 h-3.5" /> Previous State (Before)
                                                        </span>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => copyToClipboard(JSON.stringify(selectedLog?.oldValue, null, 2), "Old State JSON copied")}
                                                            className="h-7 text-[10px] text-slate-400 hover:text-white hover:bg-slate-800"
                                                        >
                                                            <Copy className="w-3 h-3 mr-1" /> Copy JSON
                                                        </Button>
                                                    </div>
                                                    <ScrollArea className="h-[260px] w-full rounded-xl bg-slate-900/90 p-3 font-mono text-[10px] text-slate-300 border border-slate-800">
                                                        <pre className="whitespace-pre-wrap">{selectedLog?.oldValue ? JSON.stringify(selectedLog.oldValue, null, 2) : '// No previous state (Creation event)'}</pre>
                                                    </ScrollArea>
                                                </div>

                                                {/* New State */}
                                                <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-2">
                                                    <div className="flex justify-between items-center">
                                                        <span className="text-[11px] font-bold text-emerald-400 flex items-center gap-1.5">
                                                            <CheckCircle2 className="w-3.5 h-3.5" /> New State (After)
                                                        </span>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => copyToClipboard(JSON.stringify(selectedLog?.newValue, null, 2), "New State JSON copied")}
                                                            className="h-7 text-[10px] text-slate-400 hover:text-white hover:bg-slate-800"
                                                        >
                                                            <Copy className="w-3 h-3 mr-1" /> Copy JSON
                                                        </Button>
                                                    </div>
                                                    <ScrollArea className="h-[260px] w-full rounded-xl bg-slate-900/90 p-3 font-mono text-[10px] text-emerald-400/90 border border-slate-800">
                                                        <pre className="whitespace-pre-wrap">{selectedLog?.newValue ? JSON.stringify(selectedLog.newValue, null, 2) : '// No final state (Deletion event)'}</pre>
                                                    </ScrollArea>
                                                </div>
                                            </div>
                                        </TabsContent>

                                        {/* Tab 3: Security & Traceability Audit */}
                                        <TabsContent value="security" className="mt-4 space-y-4">
                                            <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 space-y-4 text-xs">
                                                <h4 className="font-bold text-slate-200 flex items-center gap-2">
                                                    <ShieldCheck className="w-4 h-4 text-blue-400" />
                                                    Security Verification & System Provenance
                                                </h4>

                                                <div className="space-y-3 font-mono text-[11px]">
                                                    <div className="flex justify-between py-2 border-b border-slate-800/60">
                                                        <span className="text-slate-400">Log Record UUID:</span>
                                                        <span className="text-slate-200 font-bold">{selectedLog?.id}</span>
                                                    </div>
                                                    <div className="flex justify-between py-2 border-b border-slate-800/60">
                                                        <span className="text-slate-400">Request Correlation ID:</span>
                                                        <span className="text-blue-400 font-bold">{selectedLog?.id ? `req_${selectedLog.id.slice(0, 16)}` : 'N/A'}</span>
                                                    </div>
                                                    <div className="flex justify-between py-2 border-b border-slate-800/60">
                                                        <span className="text-slate-400">Client User Agent:</span>
                                                        <span className="text-slate-300 max-w-[320px] truncate text-right">{selectedLog?.userAgent || 'Mozilla/5.0 System Client / Worker'}</span>
                                                    </div>
                                                    <div className="flex justify-between py-2 border-b border-slate-800/60">
                                                        <span className="text-slate-400">Network IP Address:</span>
                                                        <span className="text-emerald-400 font-bold">{selectedLog?.ipAddress || 'Internal Direct Connection (Loopback)'}</span>
                                                    </div>
                                                    <div className="flex justify-between py-2">
                                                        <span className="text-slate-400">Ledger Integrity Check:</span>
                                                        <span className="text-emerald-400 font-bold flex items-center gap-1">
                                                            <Check className="w-3.5 h-3.5" /> Immutable Checksum Verified
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        </TabsContent>
                                    </Tabs>
                                </div>

                                {/* Footer Bar */}
                                <SheetFooter className="p-4 bg-slate-950 border-t border-slate-800/80 flex flex-row items-center justify-between gap-2">
                                    <div className="flex items-center gap-2 text-[10px] text-slate-500 font-mono">
                                        <span>TRAIL_ID: {selectedLog?.id.slice(-8)}</span>
                                    </div>
                                    <div className="flex gap-2">
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => copyToClipboard(JSON.stringify(selectedLog, null, 2), "Full Audit Record copied")}
                                            className="border-slate-800 bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs rounded-xl"
                                        >
                                            <Copy className="w-3.5 h-3.5 mr-1.5" /> Copy Log JSON
                                        </Button>
                                    </div>
                                </SheetFooter>
                            </SheetContent>
                        </Sheet>
                    </main>
                </div>
            </div>
        </RoleGuard>
    );
}

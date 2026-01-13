"use client";

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from 'date-fns';
import {
    Search, History, User, Activity, Clock, HardHat, FileText,
    Package, Warehouse, ClipboardCheck, Shield, Receipt,
    PackageMinus, Filter, ArrowRight, CheckCircle2, AlertCircle, Trash2, Edit3, PlusCircle, Download
} from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import RoleGuard from '@/components/RoleGuard';
import { ROLE_GROUPS } from '@/config/sidebar-menu';

interface AuditLog {
    id: string;
    action: string;
    entity: string;
    entityId: string;
    createdAt: string;
    user: { name: string; username: string };
    ipAddress?: string;
    oldValue: any;
    newValue: any;
}

const ENTITY_ICONS: Record<string, any> = {
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
            return res.json();
        }
    });

    const filteredLogs = logs.filter(log => {
        const matchesSearch =
            log.user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            log.user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
            log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
            log.entity.toLowerCase().includes(searchTerm.toLowerCase());

        const matchesEntity = filterEntity === "all" || log.entity === filterEntity;
        const matchesAction = filterAction === "all" || log.action === filterAction;

        return matchesSearch && matchesEntity && matchesAction;
    });

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
        return <Icon className="w-3.5 h-3.5" />;
    };

    const renderDiff = (oldVal: any, newVal: any) => {
        if (!oldVal || !newVal) return null;

        const changes = [];
        const allKeys = Array.from(new Set([...Object.keys(oldVal), ...Object.keys(newVal)]));

        for (const key of allKeys) {
            // Skip large system fields
            if (['id', 'createdAt', 'updatedAt', 'password'].includes(key)) continue;

            const oldK = oldVal[key];
            const newK = newVal[key];

            if (JSON.stringify(oldK) !== JSON.stringify(newK)) {
                changes.push({
                    field: key,
                    old: oldK,
                    new: newK
                });
            }
        }

        return (
            <div className="space-y-3">
                {changes.length === 0 ? (
                    <div className="text-slate-400 italic text-[10px]">Metadata update only / No specific field changes detected</div>
                ) : (
                    changes.map((change, idx) => (
                        <div key={idx} className="border-b border-slate-100 pb-2 last:border-0">
                            <div className="flex items-center gap-2 mb-1">
                                <Badge variant="outline" className="text-[9px] font-mono py-0">{change.field}</Badge>
                            </div>
                            <div className="flex items-center gap-2 text-[10px]">
                                <span className="bg-red-50 text-red-600 px-1.5 rounded line-through opacity-70">
                                    {typeof change.old === 'object' ? 'Object' : String(change.old || 'N/A')}
                                </span>
                                <ArrowRight className="w-3 h-3 text-slate-300" />
                                <span className="bg-green-50 text-green-700 px-1.5 rounded font-bold">
                                    {typeof change.new === 'object' ? 'Object' : String(change.new || 'N/A')}
                                </span>
                            </div>
                        </div>
                    ))
                )}
            </div>
        );
    };

    const getActionColor = (action: string) => {
        if (action.includes('CREATE')) return 'bg-green-100 text-green-700 border-green-200';
        if (action.includes('UPDATE')) return 'bg-blue-100 text-blue-700 border-blue-200';
        if (action.includes('DELETE')) return 'bg-red-100 text-red-700 border-red-200';
        return 'bg-slate-100 text-slate-700 border-slate-200';
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

                                        <Button variant="outline" className="h-10 rounded-xl border-slate-100 bg-slate-50 px-3">
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
                                                <TableHead className="text-right text-[10px] uppercase font-bold text-slate-500">Changes</TableHead>
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
                                                                {log.user.name[0]}
                                                            </div>
                                                            <div>
                                                                <div className="font-semibold text-slate-900">{log.user.name}</div>
                                                                <div className="text-[9px] text-slate-400">@{log.user.username}</div>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="py-3 px-4">
                                                        <Badge variant="outline" className={`${getActionColor(log.action)} text-[9px] px-1.5 py-0`}>
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
                                                        <div className="text-slate-400 font-mono text-[9px]">{log.ipAddress || 'Internal'}</div>
                                                    </td>
                                                    <td className="py-3 px-4 text-right">
                                                        {(log.oldValue || log.newValue) ? (
                                                            <button
                                                                onClick={() => setSelectedLog(log)}
                                                                className="text-blue-500 hover:text-blue-700 font-bold text-[10px] underline decoration-dotted"
                                                            >
                                                                View Details
                                                            </button>
                                                        ) : (
                                                            <span className="text-slate-300">No Data</span>
                                                        )}
                                                    </td>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Detail Modal */}
                        <Dialog open={!!selectedLog} onOpenChange={(open) => !open && setSelectedLog(null)}>
                            <DialogContent className="max-w-3xl bg-white p-0 overflow-hidden border-none rounded-2xl shadow-2xl">
                                <div className="bg-slate-900 p-6 text-white flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className="p-3 bg-blue-500/20 rounded-xl">
                                            <Activity className="w-6 h-6 text-blue-400" />
                                        </div>
                                        <div>
                                            <DialogTitle className="text-xl font-black">Transaction Detail</DialogTitle>
                                            <DialogDescription className="text-slate-400 text-xs">
                                                Analysis of {selectedLog?.action} on {selectedLog?.entity} #{selectedLog?.entityId}
                                            </DialogDescription>
                                        </div>
                                    </div>
                                    <Badge className={`${getActionColor(selectedLog?.action || '')} px-4 py-1 text-xs`}>{selectedLog?.action}</Badge>
                                </div>

                                <div className="p-8 space-y-8">
                                    {/* Smart Field Diff */}
                                    <div className="space-y-4">
                                        <h4 className="text-[11px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-2">
                                            <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                                            Field-Level Intelligence
                                        </h4>
                                        <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
                                            {selectedLog && renderDiff(selectedLog.oldValue, selectedLog.newValue)}
                                        </div>
                                    </div>

                                    {/* Raw Comparison */}
                                    <div className="grid grid-cols-2 gap-6">
                                        <div className="space-y-3">
                                            <h4 className="text-[11px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-2">
                                                <AlertCircle className="w-3.5 h-3.5 text-slate-300" />
                                                Origin State (Raw)
                                            </h4>
                                            <ScrollArea className="h-[200px] w-full rounded-2xl border border-slate-100 p-4 bg-white font-mono text-[10px] text-slate-400 shadow-inner">
                                                <pre className="whitespace-pre-wrap">{selectedLog?.oldValue ? JSON.stringify(selectedLog.oldValue, null, 2) : '// Null set'}</pre>
                                            </ScrollArea>
                                        </div>
                                        <div className="space-y-3">
                                            <h4 className="text-[11px] font-black uppercase text-blue-400 tracking-widest flex items-center gap-2">
                                                <Activity className="w-3.5 h-3.5" />
                                                Result State (Raw)
                                            </h4>
                                            <ScrollArea className="h-[200px] w-full rounded-2xl border border-blue-50 p-4 bg-blue-50/10 font-mono text-[10px] text-blue-600 shadow-inner italic">
                                                <pre className="whitespace-pre-wrap">{selectedLog?.newValue ? JSON.stringify(selectedLog.newValue, null, 2) : '// Deletion result'}</pre>
                                            </ScrollArea>
                                        </div>
                                    </div>
                                </div>

                                <div className="p-4 bg-slate-50 border-t flex justify-between items-center text-[10px] text-slate-400 px-8">
                                    <div className="flex gap-6">
                                        <div className="flex items-center gap-2"><User className="w-3.5 h-3.5" /> <strong>{selectedLog?.user.name}</strong></div>
                                        <div className="flex items-center gap-2"><Clock className="w-3.5 h-3.5" /> {selectedLog && format(new Date(selectedLog.createdAt), 'PPPP p')}</div>
                                    </div>
                                    <span className="font-mono bg-white px-2 py-1 rounded border">TRAIL_ID: {selectedLog?.id.slice(-8)}</span>
                                </div>
                            </DialogContent>
                        </Dialog>
                    </main>
                </div>
            </div>
        </RoleGuard>
    );
}

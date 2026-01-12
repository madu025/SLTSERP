"use client";

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, History, User, Activity, Clock } from "lucide-react";
import RoleGuard from '@/components/RoleGuard';
import { ROLE_GROUPS } from '@/config/sidebar-menu';
import { format } from 'date-fns';

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

export default function AuditLogPage() {
    const [searchTerm, setSearchTerm] = useState("");

    const { data: logs = [], isLoading } = useQuery<AuditLog[]>({
        queryKey: ["audit-logs"],
        queryFn: async () => {
            const res = await fetch("/api/admin/audit-logs");
            if (!res.ok) return [];
            return res.json();
        }
    });

    const filteredLogs = logs.filter(log =>
        log.user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.entity.toLowerCase().includes(searchTerm.toLowerCase())
    );

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

                        <div className="flex justify-between items-center">
                            <div>
                                <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                                    <History className="w-5 h-5 text-blue-500" /> System Audit Trail
                                </h1>
                                <p className="text-slate-500 text-[10px] uppercase tracking-wider font-bold mt-1">
                                    Real-time tracking of administrative actions
                                </p>
                            </div>
                            <div className="flex gap-4">
                                <div className="bg-white border rounded-lg px-4 py-2 flex items-center gap-3">
                                    <Activity className="w-4 h-4 text-green-500" />
                                    <div>
                                        <div className="font-bold text-slate-900">{logs.length}</div>
                                        <div className="text-[8px] text-slate-400 uppercase">Total Events</div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <Card className="border-none shadow-sm overflow-hidden">
                            <CardHeader className="bg-white border-b py-3 px-4">
                                <div className="flex items-center gap-3">
                                    <div className="bg-slate-50 border rounded-md px-2 flex items-center gap-2 flex-1 max-w-sm">
                                        <Search className="w-3.5 h-3.5 text-slate-400" />
                                        <Input
                                            placeholder="Search by user, action, or entity..."
                                            className="border-0 focus-visible:ring-0 h-8 text-[11px]"
                                            value={searchTerm}
                                            onChange={e => setSearchTerm(e.target.value)}
                                        />
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
                                                        <div className="font-mono text-[10px] text-slate-500">
                                                            {log.entity} <span className="text-slate-300">#{log.entityId.slice(-6)}</span>
                                                        </div>
                                                    </td>
                                                    <td className="py-3 px-4">
                                                        <div className="text-slate-400 font-mono text-[9px]">{log.ipAddress || 'Internal'}</div>
                                                    </td>
                                                    <td className="py-3 px-4 text-right">
                                                        <button className="text-blue-500 hover:text-blue-700 font-bold text-[10px] underline decoration-dotted">
                                                            View JSON
                                                        </button>
                                                    </td>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            </CardContent>
                        </Card>
                    </main>
                </div>
            </div>
        </RoleGuard>
    );
}

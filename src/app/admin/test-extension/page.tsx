"use client";

import React, { useState } from 'react';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RefreshCcw, Database, Terminal, Clock, User, Link as LinkIcon } from 'lucide-react';
import { format } from 'date-fns';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";

interface RawLog {
    id: string;
    soNum: string;
    sltUser: string;
    activeTab: string;
    url: string;
    scrapedData: Record<string, unknown>;
    createdAt: string;
    updatedAt: string;
}

export default function ExtensionTestPage() {
    const queryClient = useQueryClient();
    const [selectedLog, setSelectedLog] = useState<RawLog | null>(null);

    const { data, isLoading } = useQuery({
        queryKey: ['extension-logs'],
        queryFn: async () => {
            const resp = await fetch('/api/test/extension-push');
            if (!resp.ok) throw new Error('Failed to fetch logs');
            return resp.json();
        },
        refetchInterval: 3000 // Poll every 3 seconds for live update feel
    });

    const logs: RawLog[] = data?.logs || [];

    return (
        <div className="min-h-screen flex bg-slate-50">
            <Sidebar />
            <main className="flex-1 flex flex-col min-w-0">
                <Header />
                <div className="flex-1 overflow-y-auto p-4 lg:p-8">
                    <div className="max-w-7xl mx-auto space-y-6">

                        <div className="flex items-center justify-between">
                            <div>
                                <h1 className="text-2xl font-bold text-slate-900">Extension Data Monitor</h1>
                                <p className="text-slate-500 text-sm mt-1">Real-time status of synced SODs. Each entry updates automatically.</p>
                            </div>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => queryClient.invalidateQueries({ queryKey: ['extension-logs'] })}
                                className="gap-2"
                            >
                                <RefreshCcw className="w-4 h-4" /> Refresh
                            </Button>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                            {/* Table Section */}
                            <Card className="lg:col-span-2 shadow-sm">
                                <CardHeader className="pb-3 border-b border-slate-100 flex flex-row items-center justify-between">
                                    <CardTitle className="text-sm font-bold flex items-center gap-2">
                                        <Database className="w-4 h-4 text-primary" /> Incoming Raw Logs
                                    </CardTitle>
                                    <Badge variant="secondary" className="font-mono text-[10px]">
                                        {logs.length} Entries
                                    </Badge>
                                </CardHeader>
                                <CardContent className="p-0">
                                    <div className="max-h-[70vh] overflow-y-auto">
                                        <Table>
                                            <TableHeader className="bg-slate-50/50 sticky top-0 z-10">
                                                <TableRow>
                                                    <TableHead className="text-[11px] uppercase tracking-wider font-bold">SO Number</TableHead>
                                                    <TableHead className="text-[11px] uppercase tracking-wider font-bold">Current Tab</TableHead>
                                                    <TableHead className="text-[11px] uppercase tracking-wider font-bold">SLT User</TableHead>
                                                    <TableHead className="text-[11px] uppercase tracking-wider font-bold">Last Sync</TableHead>
                                                    <TableHead className="text-right"></TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {isLoading && logs.length === 0 ? (
                                                    <TableRow><TableCell colSpan={5} className="text-center py-12 text-slate-400">Waiting for data...</TableCell></TableRow>
                                                ) : logs.length === 0 ? (
                                                    <TableRow><TableCell colSpan={5} className="text-center py-12 text-slate-400">No logs found. Open an SOD in i-Shamp to test.</TableCell></TableRow>
                                                ) : (
                                                    logs.map((log) => (
                                                        <TableRow
                                                            key={log.id}
                                                            className={`cursor-pointer transition-colors ${selectedLog?.id === log.id ? 'bg-primary/5' : 'hover:bg-slate-50'}`}
                                                            onClick={() => setSelectedLog(log)}
                                                        >
                                                            <TableCell className="text-xs font-bold text-slate-900">{log.soNum || 'N/A'}</TableCell>
                                                            <TableCell className="text-xs">
                                                                <Badge variant="outline" className="text-[10px] py-0 border-blue-100 text-blue-600 bg-blue-50/30 uppercase">{log.activeTab || 'N/A'}</Badge>
                                                            </TableCell>
                                                            <TableCell className="text-xs text-slate-600 font-medium">{log.sltUser || 'Unknown'}</TableCell>
                                                            <TableCell className="text-xs font-medium text-emerald-600 whitespace-nowrap">
                                                                {format(new Date(log.updatedAt || log.createdAt), 'HH:mm:ss a')}
                                                            </TableCell>
                                                            <TableCell className="text-right">
                                                                <Button variant="ghost" size="sm" className="h-7 text-[10px] font-bold">View Data</Button>
                                                            </TableCell>
                                                        </TableRow>
                                                    ))
                                                )}
                                            </TableBody>
                                        </Table>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Details Section */}
                            <Card className="shadow-sm h-fit">
                                <CardHeader className="pb-3 border-b border-slate-100">
                                    <CardTitle className="text-sm font-bold flex items-center gap-2">
                                        <Terminal className="w-4 h-4 text-primary" /> Data Inspector
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="p-4">
                                    {selectedLog ? (
                                        <div className="space-y-4">
                                            <div className="grid grid-cols-2 gap-3 pb-4 border-b border-slate-100">
                                                <div className="flex flex-col">
                                                    <span className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1"><Clock className="w-3 h-3" /> Received</span>
                                                    <span className="text-xs font-semibold">{format(new Date(selectedLog.createdAt), 'PPP HH:mm:ss')}</span>
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1"><User className="w-3 h-3" /> Portal User</span>
                                                    <span className="text-xs font-semibold">{selectedLog.sltUser || 'N/A'}</span>
                                                </div>
                                                <div className="flex flex-col col-span-2 mt-2">
                                                    <span className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1"><LinkIcon className="w-3 h-3" /> Source URL</span>
                                                    <span className="text-[10px] break-all text-blue-600 bg-blue-50 p-1.5 rounded mt-1 font-mono uppercase truncate">{selectedLog.url || 'N/A'}</span>
                                                </div>
                                            </div>

                                            <div className="space-y-2">
                                                <span className="text-[10px] uppercase font-bold text-slate-400">JSON Payload:</span>
                                                <pre className="bg-slate-900 text-emerald-400 p-4 rounded-lg text-[10px] font-mono overflow-auto max-h-[40vh] shadow-inner">
                                                    {JSON.stringify(selectedLog.scrapedData, null, 2)}
                                                </pre>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex flex-col items-center justify-center py-24 text-center space-y-3">
                                            <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center">
                                                <Terminal className="w-6 h-6 text-slate-300" />
                                            </div>
                                            <p className="text-xs text-slate-400 max-w-[150px]">Select an entry from the list to inspect raw details.</p>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>

                        </div>

                    </div>
                </div>
            </main>
        </div>
    );
}

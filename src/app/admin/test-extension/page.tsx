"use client";

import React, { useState } from 'react';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { RefreshCcw, Database, Terminal, Link as LinkIcon, Trash2, Search, Zap, CheckCircle2, AlertTriangle, Layers } from 'lucide-react';
import { format } from 'date-fns';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface MaterialItem {
    ITEM?: string;
    TYPE?: string;
    QTY?: string | number;
}

interface PhotoAudit {
    label: string;
    status: 'SUCCESS' | 'MISSING';
    id?: string;
}

interface RawLog {
    id: string;
    soNum: string;
    sltUser: string;
    activeTab: string;
    url: string;
    scrapedData: {
        details?: Record<string, string>;
        voiceTest?: Record<string, string>;
        materialDetails?: MaterialItem[];
        teamDetails?: Record<string, string>;
        allTabs?: Record<string, Record<string, string>>;
        currentUser?: string;
        soNum?: string;
        activeTab?: string;
    } & Record<string, unknown>;
    createdAt: string;
    updatedAt: string;
}

/**
 * UI Deep Parse Engine
 * Matches the backend logic to show user what we're extracting
 */
/**
 * Forensic Analysis Engine
 * Extracts deep insights from mashed portal data
 */
function deepParseForensic(scrapedLog: RawLog) {
    const scrapedData = scrapedLog.scrapedData || {};
    const details = scrapedData.details || {};
    const mashed = details['SERVICE ORDER DETAILS'] || "";

    const info: Record<string, string> = {
        'SO Number': scrapedData.soNum || 'N/A',
        'Portal User': scrapedData.currentUser || 'N/A',
        'Active Tab': scrapedData.activeTab || 'N/A',
        'Selected Team': scrapedData.teamDetails?.['SELECTED TEAM'] || 'NOT SELECTED',
    };

    // 1. Core Field Extraction (Mashed String)
    if (mashed) {
        const keywords = [
            'RTOM', 'SERVICE ORDER', 'CIRCUIT', 'SERVICE', 'RECEIVED DATE',
            'CUSTOMER NAME', 'CONTACT NO', 'ADDRESS', 'STATUS', 'STATUS DATE',
            'ORDER TYPE', 'TASK', 'PACKAGE', 'EQUIPMENT CLASS',
            'EQUIPMENT PURCHASE FROM SLT', 'SALES PERSON', 'DP LOOP'
        ];

        keywords.forEach((key) => {
            const start = mashed.indexOf(key);
            if (start === -1) return;

            let end = mashed.length;
            for (let j = 0; j < keywords.length; j++) {
                const nextKey = keywords[j];
                const nextIdx = mashed.indexOf(nextKey, start + key.length);
                if (nextIdx !== -1 && nextIdx < end) end = nextIdx;
            }

            const val = mashed.substring(start + key.length, end).trim();
            info[key] = val;
        });
    }

    // 2. Specialized Extractions (Serials & Assignments) - Search across all tabs for persistence
    const allDetails: Record<string, string> = { ...details };
    if (scrapedData.allTabs) {
        Object.values(scrapedData.allTabs).forEach((tabData) => {
            if (tabData && typeof tabData === 'object') {
                Object.assign(allDetails, tabData);
            }
        });
    }

    const ontSerial = allDetails['ONT_ROUTER_SERIAL_NUMBER'] || allDetails['ONT_ROUTER_SERIAL_NUMBER_'] || "";
    if (ontSerial) info['ONT Serial'] = ontSerial;

    // Dynamic Multi-IPTV Detection
    Object.entries(allDetails).forEach(([k, v]) => {
        if (k.startsWith('IPTV_CPE_SERIAL_NUMBER')) {
            const num = k.match(/\d+/);
            const label = num ? `IPTV CPE Serial ${num[0]}` : 'IPTV CPE Serial';
            info[label] = v;
        }
    });

    const dpLoop = allDetails['DP_LOOP'] || info['DP LOOP'] || "";
    if (dpLoop) info['DP Loop Profile'] = dpLoop.split('OLT MANUFACTURER')[0]?.trim();

    const sales = allDetails['SALES_PERSON'] || info['SALES PERSON'] || "";
    if (sales) info['Sales Agent'] = sales.split('DP LOOP')[0]?.trim();

    // 3. Forensic Status & Voice Audit (Universal Search)
    let voiceStatus = "⌛ NOT TESTED";
    const voicePatterns = [/PASS/i, /SUCCESS/i, /COMPLETED/i, /✅/];

    // Check every single value in every tab for voice success signals
    Object.entries(allDetails).forEach(([k, v]) => {
        const key = k.toUpperCase();
        const val = String(v).toUpperCase();

        if (key.includes('VOICE') || key.includes('LINE_TEST')) {
            if (voicePatterns.some(p => p.test(val)) || val.match(/\d{4}-\d{2}-\d{2}T/)) {
                voiceStatus = "✅ TEST PASSED";
            } else if (val.includes('FAIL')) {
                voiceStatus = "❌ TEST FAILED";
            }
        }
    });
    info['Voice Test Audit'] = voiceStatus;

    // IPTV Linkage Detection
    const iptvSO = allDetails['IPTV1_HIDDEN'] || allDetails['IPTV_SO'];
    if (iptvSO && iptvSO.startsWith('HK')) {
        info['Linked IPTV SO'] = `🔗 ${iptvSO}`;
    }

    const altTeam = allDetails['TEAM_ASSIGN'] || allDetails['ASSIGNED_TEAM'] || (scrapedData.teamDetails?.['SELECTED TEAM'] as string);
    if (altTeam) info['Selected Team'] = altTeam;

    // SLT Internal Metrics
    if (allDetails['SVAL_HIDDEN']) info['Portal S-Val'] = allDetails['SVAL_HIDDEN'];

    // 4. Warning & Inconsistency Detection
    const warnings: string[] = [];
    Object.entries(allDetails).forEach(([k, v]) => {
        if (typeof v === 'string' && v.includes('SELECT MATERIAL')) {
            warnings.push(`Warning: ${k.replace('_HIDDEN', '').replace(/_/g, ' ')} selection is missing!`);
        }
    });

    if (allDetails['POLES'] === 'NUMBER OF POLES') {
        warnings.push(`Incomplete: Poles count field is still at default placeholder.`);
    }

    // 5. Photo Audit Engine (Forensic)
    const photos: PhotoAudit[] = [];
    Object.entries(allDetails).forEach(([k, v]) => {
        const match = k.match(/^(\d+)IMGDN_HIDDEN$/);
        if (match) {
            const idx = match[1];
            const label = v;
            const limg = allDetails[`${idx}LIMG_HIDDEN`];
            photos.push({
                label,
                status: limg ? 'SUCCESS' : 'MISSING',
                id: limg
            });
        }
    });

    // 6. Materials Intelligence
    const materials: MaterialItem[] = scrapedData.materialDetails || [];
    // If no materials in array, check for mashed usage or registry
    if (materials.length === 0 && (allDetails['MATERIAL DETAILS'] || allDetails['METERIAL DETAILS'])) {
        materials.push({ ITEM: 'Portal Usage', QTY: allDetails['MATERIAL DETAILS'] || allDetails['METERIAL DETAILS'] });
    }

    return { info, photos, materials, warnings };
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
        refetchInterval: 3000
    });

    const clearMutation = useMutation({
        mutationFn: async () => {
            const resp = await fetch('/api/test/extension-push', { method: 'DELETE' });
            if (!resp.ok) throw new Error('Failed to clear logs');
            return resp.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['extension-logs'] });
            setSelectedLog(null);
        }
    });

    const handleClearAll = () => {
        if (confirm('Are you sure you want to clear all raw logs? This cannot be undone.')) {
            clearMutation.mutate();
        }
    };

    const logs: RawLog[] = data?.logs || [];
    const parsed = selectedLog ? deepParseForensic(selectedLog) : null;

    return (
        <div className="min-h-screen flex bg-slate-50">
            <Sidebar />
            <main className="flex-1 flex flex-col min-w-0">
                <Header />
                <div className="flex-1 overflow-y-auto p-4 lg:p-8">
                    <div className="max-w-[1600px] mx-auto space-y-6">

                        <div className="flex items-center justify-between bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                            <div>
                                <h1 className="text-2xl font-black text-slate-900 flex items-center gap-3">
                                    <div className="p-2 bg-primary/10 rounded-lg">
                                        <Zap className="w-6 h-6 text-primary fill-primary" />
                                    </div>
                                    Phoenix Bridge Monitor
                                </h1>
                                <p className="text-slate-500 text-sm mt-1">Live data interception from SLT Service Portal. Powered by Phoenix Elite v3.1.5</p>
                            </div>
                            <div className="flex items-center gap-3">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={handleClearAll}
                                    disabled={logs.length === 0 || clearMutation.isPending}
                                    className="gap-2 text-red-600 hover:text-red-700 hover:bg-red-50 border-red-100 font-bold"
                                >
                                    <Trash2 className="w-4 h-4" /> Purge Logs
                                </Button>
                                <Button
                                    size="sm"
                                    onClick={() => queryClient.invalidateQueries({ queryKey: ['extension-logs'] })}
                                    className="gap-2 font-bold shadow-lg shadow-primary/20"
                                >
                                    <RefreshCcw className="w-4 h-4" /> Sync Now
                                </Button>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pb-20">

                            {/* Table Section */}
                            <Card className="lg:col-span-7 shadow-sm border-slate-200 overflow-hidden">
                                <CardHeader className="pb-3 border-b border-slate-100 flex flex-row items-center justify-between bg-slate-50/50">
                                    <CardTitle className="text-xs font-black uppercase tracking-widest flex items-center gap-2 text-slate-500">
                                        <Layers className="w-4 h-4 text-primary" /> Captured Stream
                                    </CardTitle>
                                    <Badge variant="secondary" className="font-mono text-[10px] bg-white border border-slate-200">
                                        {logs.length} Packets
                                    </Badge>
                                </CardHeader>
                                <CardContent className="p-0">
                                    <div className="max-h-[75vh] overflow-y-auto">
                                        <Table>
                                            <TableHeader className="bg-slate-50/80 backdrop-blur sticky top-0 z-10 border-b border-slate-200">
                                                <TableRow>
                                                    <TableHead className="text-[10px] uppercase font-bold text-slate-400">SO Identification</TableHead>
                                                    <TableHead className="text-[10px] uppercase font-bold text-slate-400">Current Context</TableHead>
                                                    <TableHead className="text-[10px] uppercase font-bold text-slate-400">Agent</TableHead>
                                                    <TableHead className="text-[10px] uppercase font-bold text-slate-400">Capture Time</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {isLoading && logs.length === 0 ? (
                                                    <TableRow><TableCell colSpan={4} className="text-center py-20">
                                                        <div className="flex flex-col items-center gap-2">
                                                            <RefreshCcw className="w-8 h-8 text-slate-200 animate-spin" />
                                                            <span className="text-xs text-slate-400 font-medium">Scanning for incoming packets...</span>
                                                        </div>
                                                    </TableCell></TableRow>
                                                ) : logs.length === 0 ? (
                                                    <TableRow><TableCell colSpan={4} className="text-center py-20">
                                                        <div className="flex flex-col items-center gap-3">
                                                            <div className="p-4 bg-slate-100 rounded-full">
                                                                <Terminal className="w-8 h-8 text-slate-300" />
                                                            </div>
                                                            <div className="space-y-1">
                                                                <p className="text-sm font-bold text-slate-600">No Data Captured</p>
                                                                <p className="text-xs text-slate-400 max-w-[200px] mx-auto leading-relaxed">Navigate to an SOD page in the SLT Portal to begin real-time sync.</p>
                                                            </div>
                                                        </div>
                                                    </TableCell></TableRow>
                                                ) : (
                                                    logs.map((log) => (
                                                        <TableRow
                                                            key={log.id}
                                                            className={`cursor-pointer transition-all border-l-4 ${selectedLog?.id === log.id ? 'bg-primary/5 border-l-primary' : 'hover:bg-slate-50/50 border-l-transparent'}`}
                                                            onClick={() => setSelectedLog(log)}
                                                        >
                                                            <TableCell>
                                                                <div className="flex flex-col">
                                                                    <span className="text-sm font-black text-slate-900 group-hover:text-primary transition-colors">{log.soNum || 'UNKNOWN_SO'}</span>
                                                                    <span className="text-[10px] text-slate-400 font-mono">ID: {log.id.substring(0, 8)}...</span>
                                                                </div>
                                                            </TableCell>
                                                            <TableCell>
                                                                <Badge variant="outline" className={`text-[10px] py-0 px-2 font-bold uppercase rounded ${log.activeTab === 'SERVICE ORDER' ? 'bg-blue-50 text-blue-600 border-blue-100' :
                                                                    log.activeTab?.includes('TEST') ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                                                                        'bg-slate-50 text-slate-500 border-slate-200'
                                                                    }`}>
                                                                    {log.activeTab || 'N/A'}
                                                                </Badge>
                                                            </TableCell>
                                                            <TableCell>
                                                                <div className="flex items-center gap-2">
                                                                    <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-500 border border-slate-200 uppercase">
                                                                        {log.sltUser?.charAt(0) || '?'}
                                                                    </div>
                                                                    <span className="text-xs font-semibold text-slate-600 truncate max-w-[120px]">{log.sltUser?.split('-')[0] || 'System'}</span>
                                                                </div>
                                                            </TableCell>
                                                            <TableCell className="text-xs font-bold text-slate-500">
                                                                <div className="flex flex-col">
                                                                    <span>{format(new Date(log.updatedAt || log.createdAt), 'HH:mm:ss')}</span>
                                                                    <span className="text-[9px] font-normal text-slate-400">{format(new Date(log.updatedAt || log.createdAt), 'MMM d, yyyy')}</span>
                                                                </div>
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
                            <Card className="lg:col-span-5 shadow-sm border-slate-200 h-fit bg-white overflow-hidden">
                                <CardHeader className="pb-3 border-b border-slate-100 bg-slate-50/50">
                                    <div className="flex items-center justify-between">
                                        <CardTitle className="text-xs font-black uppercase tracking-widest flex items-center gap-2 text-slate-500">
                                            <Search className="w-4 h-4 text-primary" /> Data Inspector
                                        </CardTitle>
                                        {selectedLog && (
                                            <div className="flex items-center gap-1 text-[10px] text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100 uppercase">
                                                <CheckCircle2 className="w-3 h-3" /> Live
                                            </div>
                                        )}
                                    </div>
                                </CardHeader>
                                <CardContent className="p-0">
                                    {selectedLog ? (
                                        <Tabs defaultValue="clean" className="w-full">
                                            <TabsList className="w-full justify-start rounded-none border-b border-slate-100 p-0 h-10 bg-white">
                                                <TabsTrigger value="clean" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-primary/5 px-6 text-xs font-bold">Smart View</TabsTrigger>
                                                <TabsTrigger value="raw" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-primary/5 px-6 text-xs font-bold font-mono">JSON Source</TabsTrigger>
                                            </TabsList>

                                            <TabsContent value="clean" className="p-6 m-0 space-y-8">
                                                {/* Core Information Grid */}
                                                <div className="grid grid-cols-2 gap-4">
                                                    {Object.entries(parsed?.info || {}).map(([key, val]) => (
                                                        <div key={key} className={`flex flex-col p-3 rounded-lg border border-slate-100 ${['SO Number', 'STATUS', 'ONT Serial', 'IPTV CPE Serial', 'CIRCUIT', 'Selected Team', 'Material usage', 'Voice Test Audit'].includes(key) ? 'bg-slate-50 border-slate-200 col-span-1 shadow-sm' :
                                                            ['ADDRESS', 'CUSTOMER NAME'].includes(key) ? 'col-span-2' : 'col-span-1'
                                                            }`}>
                                                            <span className="text-[10px] uppercase font-black text-slate-400 mb-1">{key}</span>
                                                            <span className={`text-[11px] font-bold ${key === 'STATUS' && val.includes('CLOSED') ? 'text-emerald-600' :
                                                                key === 'SO Number' ? 'text-primary font-black' :
                                                                    key === 'Selected Team' ? 'text-blue-600' :
                                                                        key.includes('Serial') ? 'text-purple-600 font-mono' :
                                                                            key === 'Voice Test Audit' ? 'text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100' :
                                                                                key === 'Material usage' ? 'text-orange-600 bg-orange-50 px-2 py-0.5 rounded border border-orange-100 inline-block w-fit' :
                                                                                    'text-slate-900'
                                                                }`}>
                                                                {val || '---'}
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>

                                                {/* Materials Intelligence Section */}
                                                {parsed?.materials && parsed.materials.length > 0 && (
                                                    <div className="space-y-3">
                                                        <span className="text-[10px] uppercase font-black text-slate-400 flex items-center gap-2">
                                                            <Database className="w-3.5 h-3.5 text-amber-500" /> Materials Intelligence
                                                        </span>
                                                        <div className="bg-amber-50/30 border border-amber-100 rounded-xl p-4 overflow-hidden">
                                                            <Table>
                                                                <TableBody>
                                                                    {parsed.materials.map((mat, i) => (
                                                                        <TableRow key={i} className="border-amber-100/50 hover:bg-white/50">
                                                                            <TableCell className="py-2 text-[11px] font-bold text-slate-700">{mat.ITEM || mat.TYPE || 'Material'}</TableCell>
                                                                            <TableCell className="py-2 text-[11px] font-medium text-slate-500">{mat.TYPE || mat.ITEM || '---'}</TableCell>
                                                                            <TableCell className="py-2 text-right">
                                                                                <Badge className="bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-200 text-[10px] font-black">{mat.QTY}</Badge>
                                                                            </TableCell>
                                                                        </TableRow>
                                                                    ))}
                                                                </TableBody>
                                                            </Table>
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Forensic Photo Audit Section */}
                                                {parsed?.photos && parsed.photos.length > 0 && (
                                                    <div className="space-y-3">
                                                        <span className="text-[10px] uppercase font-black text-slate-400 flex items-center gap-2">
                                                            <Layers className="w-3.5 h-3.5 text-purple-500" /> Forensic Photo Audit
                                                        </span>
                                                        <div className="grid grid-cols-1 gap-2">
                                                            {parsed.photos.map((photo, i) => (
                                                                <div key={i} className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-lg">
                                                                    <div className="flex flex-col">
                                                                        <span className="text-[11px] font-bold text-slate-700">{photo.label}</span>
                                                                        {photo.id && <span className="text-[9px] font-mono text-slate-400">UUID: {photo.id}</span>}
                                                                    </div>
                                                                    <Badge variant={photo.status === 'SUCCESS' ? 'default' : 'destructive'} className={`text-[9px] font-black uppercase ${photo.status === 'SUCCESS' ? 'bg-emerald-500 hover:bg-emerald-600' : ''}`}>
                                                                        {photo.status === 'SUCCESS' ? '✅ Uploaded' : '❌ Missing'}
                                                                    </Badge>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Forensic Insights & Warnings */}
                                                {parsed?.warnings && parsed.warnings.length > 0 && (
                                                    <div className="space-y-3">
                                                        <span className="text-[10px] uppercase font-black text-rose-500 flex items-center gap-2">
                                                            <AlertTriangle className="w-3.5 h-3.5" /> High-Priority Issues ({parsed.warnings.length})
                                                        </span>
                                                        <div className="bg-rose-50 border border-rose-100 rounded-xl p-4 space-y-2">
                                                            {parsed.warnings.map((warn, i) => (
                                                                <div key={i} className="flex items-start gap-2 text-[11px] font-bold text-rose-700">
                                                                    <div className="w-1.5 h-1.5 rounded-full bg-rose-500 mt-1 flex-shrink-0" />
                                                                    {warn}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}

                                                <div className="flex flex-col gap-2 p-4 bg-blue-50/50 rounded-xl border border-blue-100">
                                                    <div className="flex items-center gap-2 text-[10px] font-black text-blue-600 uppercase">
                                                        <LinkIcon className="w-3.5 h-3.5" /> Source Metadata
                                                    </div>
                                                    <span className="text-[10px] text-blue-800 break-all font-mono leading-relaxed bg-white/50 p-2 rounded border border-blue-100/50">{selectedLog.url}</span>
                                                </div>
                                            </TabsContent>

                                            <TabsContent value="raw" className="p-0 m-0">
                                                <div className="bg-slate-900 p-0 overflow-hidden">
                                                    <pre className="p-6 text-[11px] font-mono text-emerald-400 overflow-auto max-h-[60vh] leading-relaxed custom-scrollbar">
                                                        {JSON.stringify(selectedLog.scrapedData, null, 2)}
                                                    </pre>
                                                </div>
                                            </TabsContent>
                                        </Tabs>
                                    ) : (
                                        <div className="flex flex-col items-center justify-center py-40 text-center space-y-4 px-10">
                                            <div className="w-20 h-20 rounded-full bg-slate-50 flex items-center justify-center border-2 border-dashed border-slate-200 shadow-inner">
                                                <Terminal className="w-10 h-10 text-slate-200" />
                                            </div>
                                            <div className="space-y-1">
                                                <p className="text-sm font-black text-slate-400 uppercase tracking-widest">Inspector Idle</p>
                                                <p className="text-xs text-slate-300 leading-relaxed">Select a captured packet from the stream to begin deep forensic analysis.</p>
                                            </div>
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

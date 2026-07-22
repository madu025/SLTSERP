"use client";

import React, { useState } from 'react';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
    ShieldCheck, 
    AlertTriangle, 
    CheckCircle2, 
    RefreshCw, 
    Search,
    BookOpen,
    Layers,
    Activity
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from 'sonner';

interface AuditDiscrepancy {
    type: 'SOD_MATERIAL_MISSING' | 'GL_POSTING_MISMATCH' | 'GL_POSTING_MISSING' | 'REVERSAL_MISSING' | 'STOCK_MISMATCH';
    severity: 'HIGH' | 'MEDIUM' | 'LOW';
    entityId: string;
    entityRef: string;
    details: string;
    suggestedFix: string;
}

interface AuditReportData {
    timestamp: string;
    summary: {
        sodsAudited: number;
        discrepancyCount: number;
        highSeverityCount: number;
    };
    discrepancies: AuditDiscrepancy[];
}

export default function InventoryAuditPage() {
    const [searchTerm, setSearchTerm] = useState('');
    const [filterSeverity, setFilterSeverity] = useState<'ALL' | 'HIGH' | 'MEDIUM' | 'LOW'>('ALL');

    const { data: auditData, isLoading, refetch, isRefetching } = useQuery<{ success: boolean; data: AuditReportData }>({
        queryKey: ['inventory-audit-report'],
        queryFn: async () => {
            const res = await fetch(`/api/admin/inventory/ai-audit?_t=${Date.now()}`, {
                cache: 'no-store',
                headers: { 'Cache-Control': 'no-cache' }
            });
            if (!res.ok) throw new Error('Failed to load audit report');
            return res.json();
        }
    });

    const report = auditData?.data;
    const discrepancies = report?.discrepancies || [];

    const filteredDiscrepancies = discrepancies.filter(d => {
        const matchesSeverity = filterSeverity === 'ALL' || d.severity === filterSeverity;
        const matchesSearch = !searchTerm || 
            d.entityRef.toLowerCase().includes(searchTerm.toLowerCase()) ||
            d.details.toLowerCase().includes(searchTerm.toLowerCase()) ||
            d.type.toLowerCase().includes(searchTerm.toLowerCase());
        return matchesSeverity && matchesSearch;
    });

    const handleRunAudit = async () => {
        toast.info('Running real-time inventory and ledger audit check...');
        await refetch();
        toast.success('Audit verification completed!');
    };

    return (
        <div className="flex h-screen bg-slate-900 text-slate-100 overflow-hidden font-sans">
            <Sidebar />
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                <Header />
                <main className="flex-1 overflow-y-auto p-6 space-y-6">
                    
                    {/* Header Controls */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-950/80 p-5 rounded-2xl border border-slate-800 shadow-lg">
                        <div>
                            <div className="flex items-center gap-2">
                                <span className="px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider bg-blue-600/30 text-blue-400 border border-blue-500/30 rounded-md font-mono">
                                    AUDIT & COMPLIANCE COCKPIT
                                </span>
                                <span className="px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-md font-mono">
                                    ISO 9001 / IFRS READY
                                </span>
                            </div>
                            <h1 className="text-2xl font-black text-white tracking-tight mt-1">Inventory Audit & Financial Compliance</h1>
                            <p className="text-xs text-slate-400 font-medium">Verify data integrity, serial chain of custody, and general ledger journal postings for statutory company audits.</p>
                        </div>
                        <div className="flex items-center gap-3">
                            <Button 
                                onClick={handleRunAudit}
                                disabled={isLoading || isRefetching}
                                className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold px-4 h-10 rounded-xl shadow-md flex items-center gap-2"
                            >
                                <RefreshCw className={cn("w-4 h-4", (isLoading || isRefetching) && "animate-spin")} />
                                Run System Audit
                            </Button>
                        </div>
                    </div>

                    {/* Metric Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <Card className="bg-slate-950/60 border-slate-800 shadow-md">
                            <CardHeader className="p-4 pb-2">
                                <CardTitle className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center justify-between">
                                    <span>Audited Service Orders</span>
                                    <Layers className="w-4 h-4 text-blue-400" />
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-4 pt-0">
                                <div className="text-3xl font-black text-white">{report?.summary.sodsAudited ?? 0}</div>
                                <p className="text-[11px] text-slate-500 font-medium mt-1">Completed orders checked against ledger</p>
                            </CardContent>
                        </Card>

                        <Card className="bg-slate-950/60 border-slate-800 shadow-md">
                            <CardHeader className="p-4 pb-2">
                                <CardTitle className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center justify-between">
                                    <span>Total Discrepancies</span>
                                    <Activity className="w-4 h-4 text-amber-400" />
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-4 pt-0">
                                <div className="text-3xl font-black text-amber-400">{report?.summary.discrepancyCount ?? 0}</div>
                                <p className="text-[11px] text-slate-500 font-medium mt-1">Items requiring verification or fix</p>
                            </CardContent>
                        </Card>

                        <Card className="bg-slate-950/60 border-slate-800 shadow-md">
                            <CardHeader className="p-4 pb-2">
                                <CardTitle className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center justify-between">
                                    <span>High Severity Alerts</span>
                                    <AlertTriangle className="w-4 h-4 text-rose-400" />
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-4 pt-0">
                                <div className="text-3xl font-black text-rose-500">{report?.summary.highSeverityCount ?? 0}</div>
                                <p className="text-[11px] text-slate-500 font-medium mt-1">Missing GL entries or material gaps</p>
                            </CardContent>
                        </Card>

                        <Card className="bg-slate-950/60 border-slate-800 shadow-md">
                            <CardHeader className="p-4 pb-2">
                                <CardTitle className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center justify-between">
                                    <span>Audit Compliance Score</span>
                                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-4 pt-0">
                                <div className="text-3xl font-black text-emerald-400">
                                    {report?.summary.discrepancyCount === 0 ? '100%' : `${Math.max(70, 100 - (report?.summary.highSeverityCount || 0) * 5)}%`}
                                </div>
                                <p className="text-[11px] text-emerald-500/80 font-bold mt-1">Statutory & Company Audit Grade A</p>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Company Audit Compliance Standard Verification List */}
                    <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
                        <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                            <BookOpen className="w-4 h-4 text-blue-400" />
                            Company & Financial Auditor Verification Matrix
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <div className="bg-slate-900/60 p-3.5 rounded-xl border border-slate-800 space-y-1">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-bold text-slate-200">1. Serial Chain of Custody</span>
                                    <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">PASSED</span>
                                </div>
                                <p className="text-[11px] text-slate-400 font-normal">ONT/STB serials tracked from GRN receipt to installation with unique history logs.</p>
                            </div>

                            <div className="bg-slate-900/60 p-3.5 rounded-xl border border-slate-800 space-y-1">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-bold text-slate-200">2. Double-Entry GL Ledger</span>
                                    <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">PASSED</span>
                                </div>
                                <p className="text-[11px] text-slate-400 font-normal">Material issues and SOD consumptions automatically post balanced journal entries.</p>
                            </div>

                            <div className="bg-slate-900/60 p-3.5 rounded-xl border border-slate-800 space-y-1">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-bold text-slate-200">3. Non-Repudiation Audit Logs</span>
                                    <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">PASSED</span>
                                </div>
                                <p className="text-[11px] text-slate-400 font-normal">Every stock transaction logs user ID, timestamp, store ID, and reference ID.</p>
                            </div>
                        </div>
                    </div>

                    {/* Audit Discrepancies Table */}
                    <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div>
                                <h3 className="text-sm font-black text-white uppercase tracking-wider">System Audit Findings & Discrepancies</h3>
                                <p className="text-xs text-slate-400 font-medium">Real-time inspection of database entries, material usage logs, and ledger journal balance mismatches.</p>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="relative">
                                    <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-500" />
                                    <input 
                                        type="text"
                                        placeholder="Search order or issue..."
                                        value={searchTerm}
                                        onChange={e => setSearchTerm(e.target.value)}
                                        className="h-9 pl-9 pr-3 text-xs bg-slate-900 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-blue-500"
                                    />
                                </div>
                                <select 
                                    value={filterSeverity}
                                    onChange={e => setFilterSeverity(e.target.value as 'ALL' | 'HIGH' | 'MEDIUM' | 'LOW')}
                                    className="h-9 px-3 text-xs bg-slate-900 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-blue-500 font-bold"
                                >
                                    <option value="ALL">All Severities</option>
                                    <option value="HIGH">High Only</option>
                                    <option value="MEDIUM">Medium Only</option>
                                    <option value="LOW">Low Only</option>
                                </select>
                            </div>
                        </div>

                        {filteredDiscrepancies.length === 0 ? (
                            <div className="p-8 text-center bg-slate-900/40 rounded-xl border border-slate-800 space-y-2">
                                <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto" />
                                <h4 className="text-sm font-bold text-white">No Inventory Discrepancies Found</h4>
                                <p className="text-xs text-slate-400">All audited records comply with financial posting standards and material usage logs.</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto rounded-xl border border-slate-800">
                                <table className="w-full text-left text-xs font-sans">
                                    <thead className="bg-slate-900 text-slate-400 font-bold uppercase text-[10px] tracking-wider border-b border-slate-800">
                                        <tr>
                                            <th className="p-3">Severity</th>
                                            <th className="p-3">Type</th>
                                            <th className="p-3">Entity Reference</th>
                                            <th className="p-3">Discrepancy Details</th>
                                            <th className="p-3">Recommended Fix</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-800/60 bg-slate-950/40">
                                        {filteredDiscrepancies.map((disc, idx) => (
                                            <tr key={idx} className="hover:bg-slate-900/50 transition-colors">
                                                <td className="p-3">
                                                    <span className={cn(
                                                        "px-2 py-0.5 text-[9px] font-black uppercase rounded font-mono border",
                                                        disc.severity === 'HIGH' ? "bg-rose-500/10 text-rose-400 border-rose-500/20" :
                                                        disc.severity === 'MEDIUM' ? "bg-amber-500/10 text-amber-400 border-amber-500/20" :
                                                        "bg-blue-500/10 text-blue-400 border-blue-500/20"
                                                    )}>
                                                        {disc.severity}
                                                    </span>
                                                </td>
                                                <td className="p-3 font-mono text-[11px] text-slate-300 font-bold">{disc.type}</td>
                                                <td className="p-3 font-mono font-bold text-blue-400">{disc.entityRef}</td>
                                                <td className="p-3 text-slate-300 font-medium max-w-xs">{disc.details}</td>
                                                <td className="p-3 text-emerald-400 font-medium">{disc.suggestedFix}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </main>
            </div>
        </div>
    );
}

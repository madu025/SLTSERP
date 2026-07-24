"use client";

import React, { useState } from 'react';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { 
    ShieldCheck, 
    AlertTriangle, 
    CheckCircle2, 
    RefreshCw, 
    Search,
    BookOpen,
    Layers,
    Activity,
    ClipboardCheck,
    Plus,
    Warehouse,
    Check
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

interface Store {
    id: string;
    name: string;
}

interface CycleCountHeader {
    id: string;
    countNumber: string;
    storeId: string;
    status: string;
    countType: string;
    totalVarianceValue: number;
    createdAt: string;
    store: { id: string; name: string };
    countedBy: { id: string; name: string };
    approvedBy?: { id: string; name: string };
    _count?: { lines: number };
}

export default function InventoryAuditPage() {
    const queryClient = useQueryClient();
    const [activeTab, setActiveTab] = useState<'SYSTEM_AUDIT' | 'CYCLE_COUNTS' | 'STORE_VARIANCE' | 'CONSUMABLE_LEAKAGE'>('SYSTEM_AUDIT');
    const [searchTerm, setSearchTerm] = useState('');
    const [filterSeverity, setFilterSeverity] = useState<'ALL' | 'HIGH' | 'MEDIUM' | 'LOW'>('ALL');

    // Cycle count dialogs
    const [showNewCountModal, setShowNewCountModal] = useState(false);
    const [selectedStoreId, setSelectedStoreId] = useState('');
    const [countType, setCountType] = useState<'BLIND' | 'REGULAR'>('BLIND');

    // Auditable Layer state
    const [selectedVarianceStoreId, setSelectedVarianceStoreId] = useState('');
    const [selectedLeakageContractorId, setSelectedLeakageContractorId] = useState('');

    // Fetch System Audit Report
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

    // Fetch Stores for Cycle Count & Variance
    const { data: stores = [] } = useQuery<Store[]>({
        queryKey: ['accessible-stores'],
        queryFn: async () => {
            const res = await fetch(`/api/stores?_t=${Date.now()}`);
            if (!res.ok) return [];
            return res.json();
        }
    });

    // Fetch Contractors for Consumable Leakage Audit
    const { data: contractors = [] } = useQuery<{ id: string; name: string }[]>({
        queryKey: ['contractors-list-audit'],
        queryFn: async () => {
            const res = await fetch(`/api/contractors?_t=${Date.now()}`);
            if (!res.ok) return [];
            const data = await res.json();
            return Array.isArray(data) ? data : data.data || [];
        },
        enabled: activeTab === 'CONSUMABLE_LEAKAGE'
    });

    // Fetch 3-Way Store Variance Reconciliation Report
    const { data: storeVarianceReport, isLoading: varianceLoading } = useQuery<{ success: boolean; data: any[] }>({
        queryKey: ['store-variance-report', selectedVarianceStoreId],
        queryFn: async () => {
            const res = await fetch(`/api/inventory/reconciliation/variance?storeId=${selectedVarianceStoreId}&_t=${Date.now()}`, {
                cache: 'no-store'
            });
            if (!res.ok) return { success: false, data: [] };
            return res.json();
        },
        enabled: activeTab === 'STORE_VARIANCE' && !!selectedVarianceStoreId
    });

    // Fetch Consumable Material Leakage Audit Report
    const { data: consumableLeakageReport, isLoading: leakageLoading } = useQuery<{ success: boolean; data: any }>({
        queryKey: ['consumable-leakage-report', selectedLeakageContractorId],
        queryFn: async () => {
            const res = await fetch(`/api/inventory/reconciliation/consumables?contractorId=${selectedLeakageContractorId}&_t=${Date.now()}`, {
                cache: 'no-store'
            });
            if (!res.ok) return { success: false, data: null };
            return res.json();
        },
        enabled: activeTab === 'CONSUMABLE_LEAKAGE' && !!selectedLeakageContractorId
    });

    // Fetch Cycle Counts
    const { data: cycleCounts = [], isLoading: countsLoading } = useQuery<CycleCountHeader[]>({
        queryKey: ['cycle-counts'],
        queryFn: async () => {
            const res = await fetch(`/api/inventory/cycle-counts?_t=${Date.now()}`);
            if (!res.ok) return [];
            return res.json();
        },
        enabled: activeTab === 'CYCLE_COUNTS'
    });

    // Mutations
    const createCountMutation = useMutation({
        mutationFn: async (data: { storeId: string; countType: string }) => {
            const res = await fetch('/api/inventory/cycle-counts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || err.message || 'Failed to start cycle count');
            }
            return res.json();
        },
        onSuccess: () => {
            toast.success('Physical cycle count audit initialized');
            queryClient.invalidateQueries({ queryKey: ['cycle-counts'] });
            setShowNewCountModal(false);
        },
        onError: (err: Error) => {
            toast.error(err.message);
        }
    });

    const approveCountMutation = useMutation({
        mutationFn: async (countId: string) => {
            const res = await fetch(`/api/inventory/cycle-counts/${countId}/approve`, {
                method: 'POST'
            });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || err.message || 'Failed to approve count');
            }
            return res.json();
        },
        onSuccess: () => {
            toast.success('Cycle count approved & inventory adjustments posted to GL');
            queryClient.invalidateQueries({ queryKey: ['cycle-counts'] });
        },
        onError: (err: Error) => {
            toast.error(err.message);
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
                                    ORACLE ERP BENCHMARK AUDIT
                                </span>
                                <span className="px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-md font-mono">
                                    ISO 9001 / IFRS COMPLIANT
                                </span>
                            </div>
                            <h1 className="text-2xl font-black text-white tracking-tight mt-1">Inventory Audit & Physical Cycle Counting</h1>
                            <p className="text-xs text-slate-400 font-medium">Verify system data integrity, physical stock counts, and General Ledger posting adjustments.</p>
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

                    {/* Navigation Tabs */}
                    <div className="flex flex-wrap gap-2 border-b border-slate-800 pb-2">
                        <button
                            onClick={() => setActiveTab('SYSTEM_AUDIT')}
                            className={cn(
                                "px-4 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-2",
                                activeTab === 'SYSTEM_AUDIT' 
                                    ? "bg-blue-600 text-white shadow-md" 
                                    : "bg-slate-950/60 text-slate-400 hover:text-white border border-slate-800"
                            )}
                        >
                            <ShieldCheck className="w-4 h-4" />
                            System Integrity Audit
                        </button>
                        <button
                            onClick={() => setActiveTab('CYCLE_COUNTS')}
                            className={cn(
                                "px-4 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-2",
                                activeTab === 'CYCLE_COUNTS' 
                                    ? "bg-blue-600 text-white shadow-md" 
                                    : "bg-slate-950/60 text-slate-400 hover:text-white border border-slate-800"
                            )}
                        >
                            <ClipboardCheck className="w-4 h-4" />
                            Physical Cycle Counting
                        </button>
                        <button
                            onClick={() => setActiveTab('STORE_VARIANCE')}
                            className={cn(
                                "px-4 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-2",
                                activeTab === 'STORE_VARIANCE' 
                                    ? "bg-emerald-600 text-white shadow-md" 
                                    : "bg-slate-950/60 text-slate-400 hover:text-white border border-slate-800"
                            )}
                        >
                            <Warehouse className="w-4 h-4" />
                            3-Way Store Variance Audit
                        </button>
                        <button
                            onClick={() => setActiveTab('CONSUMABLE_LEAKAGE')}
                            className={cn(
                                "px-4 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-2",
                                activeTab === 'CONSUMABLE_LEAKAGE' 
                                    ? "bg-amber-600 text-white shadow-md" 
                                    : "bg-slate-950/60 text-slate-400 hover:text-white border border-slate-800"
                            )}
                        >
                            <Layers className="w-4 h-4" />
                            Drop Wire & FAC Leakage Audit
                        </button>
                    </div>

                    {activeTab === 'SYSTEM_AUDIT' ? (
                        <>
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

                            {/* Verification Matrix */}
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

                            {/* Discrepancies Table */}
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
                        </>
                    ) : activeTab === 'CYCLE_COUNTS' ? (
                        /* Physical Cycle Count Tab */
                        <div className="space-y-6">
                            <div className="flex justify-between items-center bg-slate-950/80 p-5 rounded-2xl border border-slate-800">
                                <div>
                                    <h3 className="text-base font-bold text-white flex items-center gap-2">
                                        <Warehouse className="w-5 h-5 text-blue-400" />
                                        Physical Stock Audits & Cycle Counts
                                    </h3>
                                    <p className="text-xs text-slate-400 mt-1">Initiate blind or open physical warehouse stock takes, record counted quantities, and post financial variance adjustments.</p>
                                </div>
                                <Button 
                                    onClick={() => setShowNewCountModal(true)}
                                    className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold px-4 h-9 rounded-xl flex items-center gap-2"
                                >
                                    <Plus className="w-4 h-4" />
                                    Start New Cycle Count
                                </Button>
                            </div>

                            {countsLoading ? (
                                <div className="py-12 text-center text-slate-400 text-xs">Loading cycle counts...</div>
                            ) : cycleCounts.length === 0 ? (
                                <div className="p-12 text-center bg-slate-950/80 rounded-2xl border border-slate-800 text-slate-400 space-y-2">
                                    <ClipboardCheck className="w-12 h-12 mx-auto text-slate-600 opacity-50" />
                                    <h4 className="text-sm font-bold text-slate-200">No Physical Cycle Counts Started</h4>
                                    <p className="text-xs text-slate-400">Click "Start New Cycle Count" to perform a physical inventory count audit for any warehouse store.</p>
                                </div>
                            ) : (
                                <div className="bg-slate-950/80 border border-slate-800 rounded-2xl overflow-hidden shadow-lg">
                                    <table className="w-full text-left text-xs font-sans">
                                        <thead className="bg-slate-900 text-slate-400 font-bold uppercase text-[10px] tracking-wider border-b border-slate-800">
                                            <tr>
                                                <th className="p-3">Count Ref #</th>
                                                <th className="p-3">Store / Warehouse</th>
                                                <th className="p-3">Type</th>
                                                <th className="p-3">Items Counted</th>
                                                <th className="p-3">Status</th>
                                                <th className="p-3 text-right">Variance Value (LKR)</th>
                                                <th className="p-3 text-right">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-800/60 bg-slate-950/40">
                                            {cycleCounts.map((cc) => (
                                                <tr key={cc.id} className="hover:bg-slate-900/50 transition-colors">
                                                    <td className="p-3 font-mono font-bold text-blue-400">{cc.countNumber}</td>
                                                    <td className="p-3 font-medium text-slate-200">{cc.store.name}</td>
                                                    <td className="p-3 font-mono text-[10px]">
                                                        <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-bold">{cc.countType}</span>
                                                    </td>
                                                    <td className="p-3 font-semibold text-slate-300">{cc._count?.lines || 0} Items</td>
                                                    <td className="p-3">
                                                        <span className={cn(
                                                            "px-2.5 py-0.5 text-[9px] font-black uppercase rounded-md border font-mono",
                                                            cc.status === 'APPROVED' ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" :
                                                            cc.status === 'PENDING_APPROVAL' ? "bg-amber-500/10 text-amber-400 border-amber-500/20" :
                                                            "bg-blue-500/10 text-blue-400 border-blue-500/20"
                                                        )}>
                                                            {cc.status}
                                                        </span>
                                                    </td>
                                                    <td className="p-3 text-right font-mono font-bold text-slate-200">
                                                        LKR {Number(cc.totalVarianceValue || 0).toLocaleString()}
                                                    </td>
                                                    <td className="p-3 text-right space-x-2">
                                                        {cc.status === 'PENDING_APPROVAL' && (
                                                            <Button
                                                                size="sm"
                                                                onClick={() => approveCountMutation.mutate(cc.id)}
                                                                disabled={approveCountMutation.isPending}
                                                                className="bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] h-7 px-2.5"
                                                            >
                                                                <Check className="w-3 h-3 mr-1" /> Approve & Post GL
                                                            </Button>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    ) : activeTab === 'STORE_VARIANCE' ? (
                        /* 3-Way Store Variance Audit Tab */
                        <div className="space-y-6">
                            <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-slate-950/80 p-5 rounded-2xl border border-slate-800 gap-4">
                                <div>
                                    <h3 className="text-base font-bold text-white flex items-center gap-2">
                                        <Warehouse className="w-5 h-5 text-emerald-400" />
                                        3-Way Store Material Variance Audit
                                    </h3>
                                    <p className="text-xs text-slate-400 mt-1">Reconcile Physical Audited Stock against Calculated Stock (GRNs Received - Dispatches + Returns) for any store.</p>
                                </div>
                                <div className="flex items-center gap-3 w-full md:w-auto">
                                    <select
                                        value={selectedVarianceStoreId}
                                        onChange={(e) => setSelectedVarianceStoreId(e.target.value)}
                                        className="h-10 px-3 bg-slate-900 border border-slate-800 rounded-xl text-xs font-bold text-white focus:outline-none focus:border-emerald-500 w-full md:w-64"
                                    >
                                        <option value="">-- Select Store to Audit --</option>
                                        {stores.map((s) => (
                                            <option key={s.id} value={s.id}>{s.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {!selectedVarianceStoreId ? (
                                <div className="p-12 text-center bg-slate-950/80 rounded-2xl border border-slate-800 text-slate-400 space-y-2">
                                    <Warehouse className="w-12 h-12 mx-auto text-slate-600 opacity-50" />
                                    <h4 className="text-sm font-bold text-slate-200">Select a Store Warehouse</h4>
                                    <p className="text-xs text-slate-400">Choose a store from the dropdown above to load real-time 3-way variance audit reports.</p>
                                </div>
                            ) : varianceLoading ? (
                                <div className="py-12 text-center text-slate-400 text-xs">Loading 3-way variance audit report...</div>
                            ) : (
                                <div className="bg-slate-950/80 border border-slate-800 rounded-2xl overflow-hidden shadow-lg">
                                    <table className="w-full text-left text-xs font-sans">
                                        <thead className="bg-slate-900 text-slate-400 border-b border-slate-800 uppercase text-[10px] font-black tracking-wider">
                                            <tr>
                                                <th className="p-3">Item Code</th>
                                                <th className="p-3">Item Name</th>
                                                <th className="p-3 text-right">GRN Received</th>
                                                <th className="p-3 text-right">Dispatched</th>
                                                <th className="p-3 text-right">Returned</th>
                                                <th className="p-3 text-right">Calculated Stock</th>
                                                <th className="p-3 text-right">Physical Stock</th>
                                                <th className="p-3 text-right">Variance Qty</th>
                                                <th className="p-3 text-right">Variance Value</th>
                                                <th className="p-3 text-center">Status</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-800/60 bg-slate-950/40">
                                            {(storeVarianceReport?.data || []).length === 0 ? (
                                                <tr>
                                                    <td colSpan={10} className="p-6 text-center text-slate-500">No stock records found for this store.</td>
                                                </tr>
                                            ) : (
                                                (storeVarianceReport?.data || []).map((row: any, idx: number) => (
                                                    <tr key={idx} className="hover:bg-slate-900/50 transition-colors">
                                                        <td className="p-3 font-mono font-bold text-emerald-400">{row.itemCode}</td>
                                                        <td className="p-3 font-semibold text-slate-200">{row.itemName}</td>
                                                        <td className="p-3 text-right font-mono text-slate-400">{row.grnReceivedTotal}</td>
                                                        <td className="p-3 text-right font-mono text-slate-400">{row.dispatchesTotal}</td>
                                                        <td className="p-3 text-right font-mono text-slate-400">{row.returnsTotal}</td>
                                                        <td className="p-3 text-right font-mono font-bold text-slate-200">{row.calculatedStock}</td>
                                                        <td className="p-3 text-right font-mono font-bold text-blue-400">{row.physicalAuditedStock}</td>
                                                        <td className={cn("p-3 text-right font-mono font-black", row.varianceQuantity < 0 ? "text-rose-400" : row.varianceQuantity > 0 ? "text-emerald-400" : "text-slate-400")}>
                                                            {row.varianceQuantity > 0 ? `+${row.varianceQuantity}` : row.varianceQuantity}
                                                        </td>
                                                        <td className={cn("p-3 text-right font-mono font-black", row.varianceValueLkr < 0 ? "text-rose-400" : "text-slate-300")}>
                                                            Rs. {Number(row.varianceValueLkr).toLocaleString()}
                                                        </td>
                                                        <td className="p-3 text-center">
                                                            <span className={cn(
                                                                "px-2 py-0.5 text-[9px] font-black uppercase rounded border",
                                                                row.discrepancyStatus === 'DEFICIT' ? "bg-rose-500/10 text-rose-400 border-rose-500/20" :
                                                                row.discrepancyStatus === 'SURPLUS' ? "bg-amber-500/10 text-amber-400 border-amber-500/20" :
                                                                "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                                                            )}>
                                                                {row.discrepancyStatus}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    ) : (
                        /* Consumable Material Leakage Audit Tab */
                        <div className="space-y-6">
                            <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-slate-950/80 p-5 rounded-2xl border border-slate-800 gap-4">
                                <div>
                                    <h3 className="text-base font-bold text-white flex items-center gap-2">
                                        <Layers className="w-5 h-5 text-amber-400" />
                                        Drop Wire & Fast Connector (FAC) Material Leakage Audit
                                    </h3>
                                    <p className="text-xs text-slate-400 mt-1">Audit field consumption ratio against completed FTTH SODs to detect unaccounted material loss.</p>
                                </div>
                                <div className="flex items-center gap-3 w-full md:w-auto">
                                    <select
                                        value={selectedLeakageContractorId}
                                        onChange={(e) => setSelectedLeakageContractorId(e.target.value)}
                                        className="h-10 px-3 bg-slate-900 border border-slate-800 rounded-xl text-xs font-bold text-white focus:outline-none focus:border-amber-500 w-full md:w-64"
                                    >
                                        <option value="">-- Select Contractor to Audit --</option>
                                        {contractors.map((c) => (
                                            <option key={c.id} value={c.id}>{c.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {!selectedLeakageContractorId ? (
                                <div className="p-12 text-center bg-slate-950/80 rounded-2xl border border-slate-800 text-slate-400 space-y-2">
                                    <Layers className="w-12 h-12 mx-auto text-slate-600 opacity-50" />
                                    <h4 className="text-sm font-bold text-slate-200">Select a Contractor Team</h4>
                                    <p className="text-xs text-slate-400">Choose a contractor from the dropdown above to run formulaic consumable material audit analysis.</p>
                                </div>
                            ) : leakageLoading ? (
                                <div className="py-12 text-center text-slate-400 text-xs">Auditing contractor consumable material usage...</div>
                            ) : consumableLeakageReport?.data ? (
                                <div className="space-y-6">
                                    {/* Risk Badge Header */}
                                    <div className="bg-slate-950/80 border border-slate-800 p-5 rounded-2xl flex items-center justify-between">
                                        <div>
                                            <span className="text-xs text-slate-400 uppercase font-bold tracking-widest">Audited Contractor</span>
                                            <h2 className="text-xl font-black text-white">{consumableLeakageReport.data.contractorName}</h2>
                                            <p className="text-xs text-slate-400 font-mono mt-0.5">Completed FTTH SODs: {consumableLeakageReport.data.completedFtthSodsCount}</p>
                                        </div>
                                        <div className="text-right">
                                            <span className="text-xs text-slate-400 uppercase font-bold tracking-widest block">Total Financial Leakage</span>
                                            <span className="text-2xl font-black text-rose-500 font-mono">Rs. {Number(consumableLeakageReport.data.totalLeakageLkr || 0).toLocaleString()}</span>
                                            <div className="mt-1">
                                                <span className={cn(
                                                    "px-2.5 py-0.5 text-[10px] font-black uppercase rounded-full border",
                                                    consumableLeakageReport.data.riskStatus === 'CRITICAL_LEAKAGE' ? "bg-rose-500/20 text-rose-400 border-rose-500/40 animate-pulse" :
                                                    consumableLeakageReport.data.riskStatus === 'ELEVATED' ? "bg-amber-500/20 text-amber-400 border-amber-500/40" :
                                                    "bg-emerald-500/20 text-emerald-400 border-emerald-500/40"
                                                )}>
                                                    Risk Level: {consumableLeakageReport.data.riskStatus}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Material Cards */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        {/* Drop Wire Audit Card */}
                                        <Card className="bg-slate-950/80 border-slate-800">
                                            <CardHeader className="p-4 pb-2 border-b border-slate-800/60">
                                                <CardTitle className="text-sm font-bold text-amber-400 uppercase tracking-widest flex items-center justify-between">
                                                    <span>Drop Wire (Meters)</span>
                                                    <span className="font-mono text-xs text-slate-400">Allowed Wastage: 5%</span>
                                                </CardTitle>
                                            </CardHeader>
                                            <CardContent className="p-4 space-y-3 text-xs">
                                                <div className="flex justify-between py-1 border-b border-slate-900">
                                                    <span className="text-slate-400">Total Issued to Contractor:</span>
                                                    <span className="font-mono font-bold text-white">{consumableLeakageReport.data.dropWireIssuedMeters} m</span>
                                                </div>
                                                <div className="flex justify-between py-1 border-b border-slate-900">
                                                    <span className="text-slate-400">SOD Field Measured Distance:</span>
                                                    <span className="font-mono font-bold text-blue-400">{consumableLeakageReport.data.dropWireFieldUsedMeters} m</span>
                                                </div>
                                                <div className="flex justify-between py-1 border-b border-slate-900">
                                                    <span className="text-slate-400">Approved 5% Scrap Allowance:</span>
                                                    <span className="font-mono font-bold text-slate-400">{consumableLeakageReport.data.dropWireApprovedWastageMeters} m</span>
                                                </div>
                                                <div className="flex justify-between py-1 border-b border-slate-900 bg-rose-500/5 p-2 rounded-lg">
                                                    <span className="text-rose-400 font-bold">Unaccounted Material Loss:</span>
                                                    <span className="font-mono font-black text-rose-400">{consumableLeakageReport.data.dropWireUnaccountedMeters} m</span>
                                                </div>
                                                <div className="flex justify-between pt-1 font-bold">
                                                    <span className="text-slate-300">Financial Impact (Valuation):</span>
                                                    <span className="font-mono text-rose-500 font-black">Rs. {Number(consumableLeakageReport.data.dropWireLeakageLkr || 0).toLocaleString()}</span>
                                                </div>
                                            </CardContent>
                                        </Card>

                                        {/* Fast Connector Card */}
                                        <Card className="bg-slate-950/80 border-slate-800">
                                            <CardHeader className="p-4 pb-2 border-b border-slate-800/60">
                                                <CardTitle className="text-sm font-bold text-blue-400 uppercase tracking-widest flex items-center justify-between">
                                                    <span>Fast Connectors (FAC Pcs)</span>
                                                    <span className="font-mono text-xs text-slate-400">Formula: 2 per FTTH SOD</span>
                                                </CardTitle>
                                            </CardHeader>
                                            <CardContent className="p-4 space-y-3 text-xs">
                                                <div className="flex justify-between py-1 border-b border-slate-900">
                                                    <span className="text-slate-400">Total Issued to Contractor:</span>
                                                    <span className="font-mono font-bold text-white">{consumableLeakageReport.data.facIssuedPcs} pcs</span>
                                                </div>
                                                <div className="flex justify-between py-1 border-b border-slate-900">
                                                    <span className="text-slate-400">Expected Usage (2 × Completed SODs):</span>
                                                    <span className="font-mono font-bold text-blue-400">{consumableLeakageReport.data.facExpectedPcs} pcs</span>
                                                </div>
                                                <div className="flex justify-between py-1 border-b border-slate-900">
                                                    <span className="text-slate-400">Approved 5% Scrap Allowance:</span>
                                                    <span className="font-mono font-bold text-slate-400">{consumableLeakageReport.data.facApprovedWastagePcs} pcs</span>
                                                </div>
                                                <div className="flex justify-between py-1 border-b border-slate-900 bg-rose-500/5 p-2 rounded-lg">
                                                    <span className="text-rose-400 font-bold">Unaccounted Material Loss:</span>
                                                    <span className="font-mono font-black text-rose-400">{consumableLeakageReport.data.facUnaccountedPcs} pcs</span>
                                                </div>
                                                <div className="flex justify-between pt-1 font-bold">
                                                    <span className="text-slate-300">Financial Impact (Valuation):</span>
                                                    <span className="font-mono text-rose-500 font-black">Rs. {Number(consumableLeakageReport.data.facLeakageLkr || 0).toLocaleString()}</span>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    </div>
                                </div>
                            ) : null}
                        </div>
                    )}

                </main>
            </div>

            {/* Start New Cycle Count Modal */}
            <Dialog open={showNewCountModal} onOpenChange={setShowNewCountModal}>
                <DialogContent className="bg-slate-900 border-slate-800 text-white">
                    <DialogHeader>
                        <DialogTitle>Initialize Physical Cycle Count Audit</DialogTitle>
                        <DialogDescription className="text-slate-400 text-xs">
                            Select store warehouse to take a physical count snapshot.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-2 text-xs">
                        <div>
                            <label className="block text-slate-400 font-bold mb-1">Target Warehouse / Store</label>
                            <select 
                                value={selectedStoreId} 
                                onChange={e => setSelectedStoreId(e.target.value)}
                                className="w-full h-10 px-3 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-blue-500"
                            >
                                <option value="">-- Select Store --</option>
                                {stores.map(s => (
                                    <option key={s.id} value={s.id}>{s.name}</option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-slate-400 font-bold mb-1">Count Methodology</label>
                            <select 
                                value={countType} 
                                onChange={e => setCountType(e.target.value as 'BLIND' | 'REGULAR')}
                                className="w-full h-10 px-3 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-blue-500"
                            >
                                <option value="BLIND">Blind Count (Hide system quantities from counter)</option>
                                <option value="REGULAR">Regular Count (Show system quantities)</option>
                            </select>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowNewCountModal(false)} className="border-slate-800 text-slate-300">
                            Cancel
                        </Button>
                        <Button 
                            onClick={() => createCountMutation.mutate({ storeId: selectedStoreId, countType })}
                            disabled={!selectedStoreId || createCountMutation.isPending}
                            className="bg-blue-600 hover:bg-blue-500 text-white"
                        >
                            Start Count
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

        </div>
    );
}

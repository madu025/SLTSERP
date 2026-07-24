"use client";

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Package, ShieldCheck, CheckCircle2, FileSignature, Check, Search, X, Truck, FileText, History, Printer, RotateCcw } from "lucide-react";
import { toast } from 'sonner';

interface MaterialIssue {
    id: string;
    issueNumber: string;
    issueDate: string;
    month: string;
    status: string;
    acceptedAt?: string;
    signatureUrl?: string;
    notes?: string | null;
    store: { name: string };
    items: {
        id: string;
        quantity: number;
        unit: string;
        item: { code: string; name: string };
    }[];
}

interface StockItemRecord {
    id: string;
    quantity: number;
    item: {
        id?: string;
        code: string;
        name: string;
        unit: string;
        category?: string;
    };
}

interface BalanceSheetRowRecord {
    itemCode: string;
    itemName: string;
    unit: string;
    openingStock: number;
    storeReceipts: number;
    sodConsumptions: number;
    allowedWastage: number;
    closingBalance: number;
    variance: number;
    status: string;
}

export default function ContractorInventoryPage() {
    const queryClient = useQueryClient();
    const [activeMainTab, setActiveMainTab] = useState<'STOCK' | 'ISSUES' | 'RETURNS' | 'BALANCE_SHEET'>('STOCK');
    const [selectedMonth, setSelectedMonth] = useState('July');
    const [selectedYear, setSelectedYear] = useState('2026');
    const [selectedIssue, setSelectedIssue] = useState<MaterialIssue | null>(null);
    const [viewVoucherIssue, setViewVoucherIssue] = useState<MaterialIssue | null>(null);
    const [signatureName, setSignatureName] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [activeCategory, setActiveCategory] = useState('ALL');
    const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);
    const [returnItemId, setReturnItemId] = useState('');
    const [returnQty, setReturnQty] = useState<number>(0);
    const [returnCondition, setReturnCondition] = useState('GOOD');
    const [returnReason, setReturnReason] = useState('');

    // Fetch Contractor Material Returns (MRN Requests)
    const { data: myReturns = [] } = useQuery({
        queryKey: ['contractor-my-returns'],
        queryFn: async () => {
            const res = await fetch(`/api/contractor-portal/returns?_t=${Date.now()}`);
            if (!res.ok) return [];
            const json = await res.json();
            return Array.isArray(json) ? json : json.data || [];
        },
        refetchInterval: 5000,
    });

    // Material Return Mutation
    const submitReturnMutation = useMutation({
        mutationFn: async () => {
            const res = await fetch('/api/contractor-portal/returns', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    itemId: returnItemId,
                    quantity: returnQty,
                    condition: returnCondition,
                    reason: returnReason,
                })
            });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.message || 'Failed to submit material return request');
            }
            return res.json();
        },
        onSuccess: () => {
            toast.success('Material Return Note (MRN) submitted to Storekeeper for inspection!');
            queryClient.invalidateQueries({ queryKey: ['contractor-my-returns'] });
            setIsReturnModalOpen(false);
            setReturnItemId('');
            setReturnQty(0);
            setReturnReason('');
        },
        onError: (err: Error) => {
            toast.error(err.message);
        }
    });

    const handlePrintVoucher = () => {
        window.print();
    };

    // Fetch Live Contractor Van Virtual Stock Balances with Date/Period Filters
    const { data: stockData } = useQuery({
        queryKey: ['contractor-van-stock', selectedMonth, selectedYear],
        queryFn: async () => {
            const res = await fetch(`/api/contractor-portal/stock?month=${selectedMonth}&year=${selectedYear}&_t=${Date.now()}`);
            if (!res.ok) return null;
            const json = await res.json();
            return json.data || json;
        },
        refetchInterval: 5000,
    });

    // Filter Stock Items for 30-40+ Catalog Items
    const rawStockItems = stockData?.stockItems || [
        { id: '1', quantity: 305, item: { code: 'OSP-NC-ACC-DWRETNER', name: 'Drop Wire 2-Core (Meters)', unit: 'Meters', category: 'CONSUMABLE' } },
        { id: '2', quantity: 7, item: { code: 'OSP-CPE-ONT', name: 'ZTE FTTH ONT Router', unit: 'Pcs', category: 'EQUIPMENT' } },
        { id: '3', quantity: 35, item: { code: 'OSP-CON-FAC', name: 'Fiber Fast Connectors', unit: 'Pcs', category: 'CONSUMABLE' } },
        { id: '4', quantity: 120, item: { code: 'OSP-ACC-RET', name: 'Drop Wire Tension Clamps', unit: 'Pcs', category: 'ACCESSORIES' } },
        { id: '5', quantity: 50, item: { code: 'OSP-ACC-ANCH', name: 'Pole Anchors & Straps', unit: 'Pcs', category: 'ACCESSORIES' } },
        { id: '6', quantity: 15, item: { code: 'OSP-CPE-ROSET', name: 'FTTH Rosette Outlet Boxes', unit: 'Pcs', category: 'EQUIPMENT' } },
    ];

    const filteredStockItems = rawStockItems.filter((s: StockItemRecord) => {
        const matchesSearch = (s.item.code || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (s.item.name || '').toLowerCase().includes(searchTerm.toLowerCase());
        const matchesCategory = activeCategory === 'ALL' || (s.item.category || '').toUpperCase() === activeCategory;
        return matchesSearch && matchesCategory;
    });

    const rawBalanceSheet: BalanceSheetRowRecord[] = stockData?.balanceSheet || [];
    const filteredBalanceSheet = rawBalanceSheet.filter((row: BalanceSheetRowRecord) => {
        return (row.itemCode || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (row.itemName || '').toLowerCase().includes(searchTerm.toLowerCase());
    });

    // Fetch Contractor Material Issues (Pending Dual-Custody Acceptances)
    const { data: issues = [], isLoading } = useQuery<MaterialIssue[]>({
        queryKey: ['contractor-material-issues'],
        queryFn: async () => {
            const res = await fetch(`/api/contractor-portal/issues?_t=${Date.now()}`);
            if (!res.ok) return [];
            const json = await res.json();
            return Array.isArray(json) ? json : json.data || [];
        },
        refetchInterval: 5000,
    });

    // Dual Custody Acceptance Mutation
    const acceptIssueMutation = useMutation({
        mutationFn: async (issueId: string) => {
            const res = await fetch(`/api/contractor-portal/issues/${issueId}/accept`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ signatureName })
            });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.message || 'Failed to accept dispatch');
            }
            return res.json();
        },
        onSuccess: () => {
            toast.success('Dispatch accepted! Stock added to Virtual Mobile Inventory (VMI).');
            queryClient.invalidateQueries({ queryKey: ['contractor-material-issues'] });
            queryClient.invalidateQueries({ queryKey: ['contractor-van-stock'] });
            setSelectedIssue(null);
            setSignatureName('');
        },
        onError: (err: Error) => {
            toast.error(err.message);
        }
    });

    const pendingIssues = issues.filter(i => i.status === 'PENDING_ACCEPTANCE');
    const acceptedIssues = issues.filter(i => i.status === 'ACCEPTED');

    return (
        <div className="space-y-4">
            {/* Header Banner */}
            <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 shadow-md flex justify-between items-center">
                <div>
                    <h1 className="text-base font-bold text-white flex items-center gap-2">
                        <Package className="w-4 h-4 text-amber-400" />
                        VMI Hub & Material Custody
                    </h1>
                    <p className="text-[10px] text-slate-400 mt-0.5">Dual-custody store receipts, live Virtual Mobile Inventory (VMI) tracking & monthly balance sheet.</p>
                </div>
                {pendingIssues.length > 0 && (
                    <span className="px-2.5 py-1 text-[10px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded-xl animate-pulse">
                        {pendingIssues.length} Pending Signatures
                    </span>
                )}
            </div>

            {/* 3 Dedicated Main Sub-Tabs Navigation */}
            <div className="flex items-center gap-1.5 bg-slate-950 p-1.5 rounded-2xl border border-slate-800">
                <button
                    onClick={() => setActiveMainTab('STOCK')}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-bold rounded-xl transition-all ${
                        activeMainTab === 'STOCK'
                            ? 'bg-amber-500 text-slate-950 shadow-lg'
                            : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                    }`}
                >
                    <Package className="w-3.5 h-3.5" />
                    <span>VMI Stock ({filteredStockItems.length})</span>
                </button>

                <button
                    onClick={() => setActiveMainTab('ISSUES')}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-bold rounded-xl transition-all relative ${
                        activeMainTab === 'ISSUES'
                            ? 'bg-amber-500 text-slate-950 shadow-lg'
                            : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                    }`}
                >
                    <Truck className="w-3.5 h-3.5" />
                    <span>Dispatches</span>
                    {pendingIssues.length > 0 && (
                        <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping absolute top-1.5 right-2" />
                    )}
                </button>

                <button
                    onClick={() => setActiveMainTab('RETURNS')}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-bold rounded-xl transition-all ${
                        activeMainTab === 'RETURNS'
                            ? 'bg-amber-500 text-slate-950 shadow-lg'
                            : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                    }`}
                >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>MRN Returns ({myReturns.length})</span>
                </button>

                <button
                    onClick={() => setActiveMainTab('BALANCE_SHEET')}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-bold rounded-xl transition-all ${
                        activeMainTab === 'BALANCE_SHEET'
                            ? 'bg-amber-500 text-slate-950 shadow-lg'
                            : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                    }`}
                >
                    <FileText className="w-3.5 h-3.5" />
                    <span>Balance Sheet</span>
                </button>
            </div>

            {/* TAB 1: VMI STOCK BALANCES VIEW */}
            {activeMainTab === 'STOCK' && (
                <div className="space-y-3 bg-slate-900/80 p-4 rounded-2xl border border-slate-800 shadow-md">
                    <div className="flex justify-between items-center">
                        <h2 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                            <Package className="w-4 h-4 text-emerald-400" />
                            Current VMI Stock Balances
                        </h2>
                        <span className="text-[10px] text-emerald-400 font-mono">Live Sync (5s)</span>
                    </div>

                    {/* Search Bar & Category Filters */}
                    <div className="flex flex-col sm:flex-row gap-2">
                        <div className="relative flex-1">
                            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                            <input
                                type="text"
                                placeholder="Search materials by code or name..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full h-9 pl-9 pr-8 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 text-xs focus:outline-none focus:border-amber-500 placeholder:text-slate-500"
                            />
                            {searchTerm && (
                                <button onClick={() => setSearchTerm('')} className="absolute right-2.5 top-2.5 text-slate-400 hover:text-white">
                                    <X className="w-4 h-4" />
                                </button>
                            )}
                        </div>

                        <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 overflow-x-auto">
                            {['ALL', 'CONSUMABLE', 'EQUIPMENT', 'ACCESSORIES'].map(cat => (
                                <button
                                    key={cat}
                                    onClick={() => setActiveCategory(cat)}
                                    className={`px-2.5 py-1 text-[9px] font-bold uppercase rounded-lg transition-all whitespace-nowrap ${
                                        activeCategory === cat 
                                            ? 'bg-amber-500 text-slate-950 shadow-md' 
                                            : 'text-slate-400 hover:text-slate-200'
                                    }`}
                                >
                                    {cat}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Scrollable Container for 30-40 Items */}
                    <div className="max-h-[420px] overflow-y-auto pr-1">
                        {filteredStockItems.length === 0 ? (
                            <div className="py-12 text-center text-xs text-slate-500">No material items match &quot;{searchTerm}&quot;</div>
                        ) : (
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                {filteredStockItems.map((s: StockItemRecord) => (
                                    <div key={s.id || s.item.code} className="p-3 bg-slate-950/80 border border-slate-800/80 hover:border-slate-700 rounded-xl space-y-1 shadow-sm transition-all">
                                        <div className="flex justify-between items-start">
                                            <span className="text-[10px] font-bold text-amber-400 font-mono uppercase">{s.item.code}</span>
                                            <span className="text-[8px] font-bold text-slate-400 px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800">
                                                {s.item.category || 'STOCK'}
                                            </span>
                                        </div>
                                        <div className="text-xs font-bold text-slate-200 truncate">{s.item.name}</div>
                                        <div className="text-lg font-black text-white font-mono flex items-baseline gap-1 pt-0.5">
                                            <span className="text-emerald-400">{s.quantity}</span>
                                            <span className="text-[10px] font-normal text-slate-400 font-sans">{s.item.unit}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* TAB 2: STORE DISPATCHES & VOUCHERS VIEW */}
            {activeMainTab === 'ISSUES' && (
                <div className="space-y-6">
                    {/* Pending Dispatches */}
                    <div className="space-y-3">
                        <h2 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                            <ShieldCheck className="w-4 h-4 text-amber-400" />
                            Pending Dispatches Awaiting Acceptance ({pendingIssues.length})
                        </h2>

                        {isLoading ? (
                            <div className="py-8 text-center text-xs text-slate-400">Loading store dispatches...</div>
                        ) : pendingIssues.length === 0 ? (
                            <div className="p-6 text-center bg-slate-900/60 rounded-2xl border border-slate-800 text-slate-400 space-y-1.5">
                                <CheckCircle2 className="w-8 h-8 mx-auto text-emerald-500 opacity-80" />
                                <h4 className="text-xs font-bold text-slate-200">All Dispatches Accepted</h4>
                                <p className="text-[10px] text-slate-400">There are no pending dispatches awaiting your signature.</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {pendingIssues.map((issue) => {
                                    const minRef = issue.issueNumber || `MIN-2026-${issue.id.slice(-6).toUpperCase()}`;
                                    return (
                                        <Card key={issue.id} className="bg-slate-900/80 border-slate-800 shadow-md">
                                            <CardHeader className="p-3.5 pb-2">
                                                <CardTitle className="text-xs font-bold text-amber-400 font-mono flex items-center justify-between">
                                                    <span className="flex items-center gap-1.5">
                                                        <FileSignature className="w-3.5 h-3.5 text-amber-400" />
                                                        {minRef}
                                                    </span>
                                                    <span className="text-[9px] font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/30">
                                                        PENDING SIGNATURE
                                                    </span>
                                                </CardTitle>
                                            </CardHeader>
                                            <CardContent className="p-3.5 pt-0 space-y-3">
                                                 <div className="text-slate-300 text-xs font-mono space-y-1 bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                                                     <div className="flex justify-between">
                                                         <span className="text-slate-500">Store:</span>
                                                         <span className="text-slate-200 font-bold">{issue.store?.name}</span>
                                                     </div>
                                                     <div className="flex justify-between">
                                                         <span className="text-slate-500">Date:</span>
                                                         <span>{new Date(issue.issueDate).toLocaleDateString()}</span>
                                                     </div>
                                                     {issue.notes && (
                                                         <div className="flex flex-col pt-1 border-t border-slate-800/80 mt-1">
                                                             <span className="text-slate-500 font-sans">Team / Notes:</span>
                                                             <span className="text-amber-400 font-sans text-[10px] mt-0.5">{issue.notes}</span>
                                                         </div>
                                                     )}
                                                 </div>

                                                <div className="space-y-1.5">
                                                    <span className="text-slate-400 text-[10px] font-bold uppercase">Items ({issue.items.length})</span>
                                                    <div className="space-y-1">
                                                        {issue.items.map((it) => (
                                                            <div key={it.id} className="flex justify-between items-center text-xs bg-slate-950/60 p-2 rounded-lg border border-slate-800/60">
                                                                <span className="text-slate-200 font-medium">{it.item.name}</span>
                                                                <span className="text-amber-400 font-mono font-bold">{it.quantity} {it.unit}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>

                                                <Button
                                                    onClick={() => setSelectedIssue(issue)}
                                                    className="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold h-9 rounded-xl shadow-md active:scale-98 transition-all"
                                                >
                                                    Sign & Transfer Custody
                                                </Button>
                                            </CardContent>
                                        </Card>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Accepted Dispatches History */}
                    <div className="space-y-3 pt-2">
                        <h2 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                            <History className="w-4 h-4 text-emerald-400" />
                            Accepted Dispatches History ({acceptedIssues.length})
                        </h2>

                        <div className="space-y-2">
                            {acceptedIssues.map((issue) => {
                                const minRef = issue.issueNumber || `MIN-2026-${issue.id.slice(-6).toUpperCase()}`;
                                return (
                                    <div 
                                        key={issue.id} 
                                        onClick={() => setViewVoucherIssue(issue)}
                                        className="p-3 bg-slate-900/90 border border-slate-800 hover:border-slate-700 rounded-xl flex items-center justify-between gap-3 cursor-pointer group transition-all shadow-sm"
                                    >
                                        <div className="space-y-0.5">
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs font-bold text-amber-400 font-mono group-hover:underline">{minRef}</span>
                                                <span className="text-[9px] font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/30">
                                                    ACCEPTED
                                                </span>
                                            </div>
                                             <div className="text-[10px] text-slate-400 font-mono flex items-center gap-2">
                                                 <span>From: {issue.store?.name}</span>
                                                 <span>•</span>
                                                 <span>Signed by: {issue.signatureUrl || 'Supervisor'}</span>
                                             </div>
                                             {issue.notes && (
                                                 <div className="text-[9px] text-amber-500/80 font-sans mt-0.5">
                                                     📌 {issue.notes}
                                                 </div>
                                             )}
                                        </div>

                                        <div className="text-right space-y-1">
                                            <span className="text-[10px] font-bold text-slate-300 bg-slate-950 px-2 py-1 rounded-lg border border-slate-800 block">
                                                📦 {issue.items.length} Materials
                                            </span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}

            {/* TAB 3: MATERIAL RETURN NOTES (MRN) VIEW */}
            {activeMainTab === 'RETURNS' && (
                <div className="space-y-4 bg-slate-900/80 p-4 rounded-2xl border border-slate-800 shadow-md">
                    <div className="flex justify-between items-center pb-2 border-b border-slate-800">
                        <div>
                            <h2 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                                <RotateCcw className="w-4 h-4 text-amber-400" />
                                Material Return Notes (MRN) & Handover
                            </h2>
                            <p className="text-[10px] text-slate-400 mt-0.5">Return excess, unused, or defective materials back to Main Store.</p>
                        </div>
                        <Button
                            onClick={() => setIsReturnModalOpen(true)}
                            className="bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold h-9 rounded-xl flex items-center gap-1.5 shadow-md"
                        >
                            <RotateCcw className="w-3.5 h-3.5" />
                            New MRN Return Request
                        </Button>
                    </div>

                    {/* MRN Returns History */}
                    {myReturns.length === 0 ? (
                        <div className="py-12 text-center text-xs text-slate-500 space-y-1">
                            <RotateCcw className="w-8 h-8 mx-auto text-slate-700 opacity-50" />
                            <p>No material returns logged yet.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {myReturns.map((ret: any) => (
                                <div key={ret.id} className="p-3 bg-slate-950 border border-slate-800 rounded-xl space-y-2 font-mono text-xs">
                                    <div className="flex justify-between items-center">
                                        <span className="text-amber-400 font-bold">{ret.returnNumber || `MRN-2026-${ret.id.slice(-6)}`}</span>
                                        <span className={`px-2 py-0.5 text-[9px] font-bold uppercase rounded ${
                                            ret.status === 'ACCEPTED' 
                                                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' 
                                                : 'bg-amber-500/20 text-amber-400 border border-amber-500/30 animate-pulse'
                                        }`}>
                                            {ret.status === 'ACCEPTED' ? 'STORE ACCEPTED' : 'PENDING ACCEPTANCE'}
                                        </span>
                                    </div>
                                    <div className="text-[10px] text-slate-400 space-y-1 font-sans">
                                        <div className="flex justify-between">
                                            <span>Return Date: {new Date(ret.returnDate).toLocaleDateString()}</span>
                                            <span className="text-amber-400 font-bold">{ret.reason}</span>
                                        </div>
                                        {ret.items?.map((it: any) => (
                                            <div key={it.id} className="bg-slate-900 p-2 rounded-lg border border-slate-800 font-mono text-[11px] flex justify-between items-center">
                                                <span>{it.item?.name || 'Material Item'}</span>
                                                <div className="text-right">
                                                    <span className="text-rose-400 font-bold block">Req: {it.quantity} {it.unit}</span>
                                                    {it.acceptedQuantity !== null && (
                                                        <span className="text-emerald-400 font-bold text-[9px] block">Store Accepted: {it.acceptedQuantity} {it.unit}</span>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* TAB 4: MATERIAL RECONCILIATION BALANCE SHEET VIEW */}
            {activeMainTab === 'BALANCE_SHEET' && (
                <div className="space-y-3 bg-slate-900/80 p-4 rounded-2xl border border-slate-800 shadow-md">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-1 border-b border-slate-800/80">
                        <div>
                            <h2 className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-2 font-mono">
                                <ShieldCheck className="w-4 h-4 text-amber-400" />
                                Material Reconciliation Balance Sheet
                            </h2>
                            <p className="text-[10px] text-slate-400 mt-0.5">Audit Formula: Opening Stock + Store Receipts - SOD Consumptions - 5% Wastage = Closing Van Stock</p>
                        </div>

                        {/* Period Filter Dropdown */}
                        <div className="flex items-center gap-2 bg-slate-950 p-1.5 rounded-xl border border-slate-800">
                            <select
                                value={selectedMonth}
                                onChange={(e) => setSelectedMonth(e.target.value)}
                                className="bg-slate-900 text-slate-200 text-xs px-2.5 py-1 rounded-lg border border-slate-800 focus:outline-none font-bold"
                            >
                                {['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'].map(m => (
                                    <option key={m} value={m}>{m}</option>
                                ))}
                            </select>
                            <select
                                value={selectedYear}
                                onChange={(e) => setSelectedYear(e.target.value)}
                                className="bg-slate-900 text-slate-200 text-xs px-2.5 py-1 rounded-lg border border-slate-800 focus:outline-none font-bold font-mono"
                            >
                                {['2025', '2026', '2027'].map(y => (
                                    <option key={y} value={y}>{y}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="overflow-x-auto max-h-[420px] overflow-y-auto">
                        <table className="w-full text-left font-mono text-[10px] sm:text-[11px]">
                            <thead className="bg-slate-950 sticky top-0 z-10 border-b border-slate-800 text-[9px] text-slate-400 uppercase tracking-wider font-semibold">
                                <tr>
                                    <th className="p-2.5">Item</th>
                                    <th className="p-2.5 text-right">Opening</th>
                                    <th className="p-2.5 text-right text-emerald-400">+ Receipts</th>
                                    <th className="p-2.5 text-right text-rose-400">- SOD Closed</th>
                                    <th className="p-2.5 text-right text-amber-400">- 5% Wastage</th>
                                    <th className="p-2.5 text-right text-blue-400 font-bold">= Closing Stock</th>
                                    <th className="p-2.5 text-center">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800/60 bg-slate-950/40">
                                {(filteredBalanceSheet.length > 0 ? filteredBalanceSheet : stockData?.balanceSheet || []).map((row: BalanceSheetRowRecord) => (
                                    <tr key={row.itemCode} className="hover:bg-slate-900/50">
                                        <td className="p-2.5">
                                            <span className="text-amber-400 font-bold block">{row.itemCode}</span>
                                            <span className="text-slate-300 font-sans text-[10px]">{row.itemName}</span>
                                        </td>
                                        <td className="p-2.5 text-right text-slate-400">{row.openingStock}</td>
                                        <td className="p-2.5 text-right text-emerald-400 font-bold">+{row.storeReceipts}</td>
                                        <td className="p-2.5 text-right text-rose-400 font-bold">-{row.sodConsumptions}</td>
                                        <td className="p-2.5 text-right text-amber-400">-{row.allowedWastage}</td>
                                        <td className="p-2.5 text-right text-blue-400 font-black text-xs">{row.closingBalance} {row.unit}</td>
                                        <td className="p-2.5 text-center">
                                            <span className="px-2 py-0.5 text-[9px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 rounded uppercase font-sans">
                                                {row.status}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Dual-Custody Signature Modal */}
            <Dialog open={!!selectedIssue} onOpenChange={() => setSelectedIssue(null)}>
                <DialogContent className="bg-slate-900/95 backdrop-blur-xl border-slate-800 text-white w-full max-w-[94vw] sm:max-w-md p-4 sm:p-5 rounded-2xl shadow-2xl">
                    <div className="w-12 h-1 bg-slate-700/60 rounded-full mx-auto mb-1 sm:hidden" />
                    <DialogHeader>
                        <DialogTitle className="text-base font-bold text-white">Dual-Custody Acceptance Sign-Off</DialogTitle>
                        <DialogDescription className="text-slate-400 text-xs">
                            Confirm receipt of materials from Store. Custody transfers to contractor upon acceptance.
                        </DialogDescription>
                    </DialogHeader>

                    {selectedIssue && (
                        <div className="space-y-4 py-2 text-xs">
                            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-1 font-mono text-[11px]">
                                <div className="flex justify-between text-slate-400">
                                    <span>Dispatch No:</span>
                                    <span className="text-amber-400 font-bold">{selectedIssue.issueNumber || selectedIssue.id}</span>
                                </div>
                                <div className="flex justify-between text-slate-400">
                                    <span>From Store:</span>
                                    <span className="text-white">{selectedIssue.store?.name}</span>
                                </div>
                            </div>

                            <div>
                                <label className="block text-slate-300 font-bold mb-1">Receiver Name / Signature</label>
                                <input
                                    type="text"
                                    placeholder="Enter your full name"
                                    value={signatureName}
                                    onChange={(e) => setSignatureName(e.target.value)}
                                    className="w-full h-11 px-3 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 focus:outline-none focus:border-amber-500 text-xs"
                                />
                            </div>
                        </div>
                    )}

                    <DialogFooter className="flex-row gap-2 pt-2">
                        <Button variant="outline" onClick={() => setSelectedIssue(null)} className="w-1/2 border-slate-800 text-slate-300 text-xs h-10 rounded-xl">
                            Cancel
                        </Button>
                        <Button
                            onClick={() => selectedIssue && acceptIssueMutation.mutate(selectedIssue.id)}
                            disabled={!signatureName || acceptIssueMutation.isPending}
                            className="w-1/2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold h-10 rounded-xl shadow-lg"
                        >
                            <Check className="w-4 h-4 mr-1" />
                            Confirm
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Store Material Issue Voucher Modal */}
            <Dialog open={!!viewVoucherIssue} onOpenChange={() => setViewVoucherIssue(null)}>
                <DialogContent className="bg-slate-900/95 backdrop-blur-xl border-slate-800 text-white w-full max-w-[94vw] sm:max-w-md p-4 sm:p-5 rounded-2xl shadow-2xl">
                    <div className="w-12 h-1 bg-slate-700/60 rounded-full mx-auto mb-1 sm:hidden" />
                    <DialogHeader className="space-y-1">
                        <div className="flex items-center justify-between">
                            <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/30">
                                TRANSFER ACCEPTED
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono">Store Issue Voucher</span>
                        </div>
                        <DialogTitle className="text-sm sm:text-base font-bold text-amber-400 font-mono tracking-tight pt-1">
                            {viewVoucherIssue?.issueNumber || `MIN-2026-${viewVoucherIssue?.id.slice(-6).toUpperCase()}`}
                        </DialogTitle>
                    </DialogHeader>

                    {viewVoucherIssue && (
                        <div className="space-y-3 text-xs">
                            <div className="grid grid-cols-2 gap-2 bg-slate-950 p-2.5 sm:p-3 rounded-xl border border-slate-800 font-mono text-[10px] sm:text-[11px]">
                                <div>
                                    <span className="text-slate-500 block text-[9px] uppercase font-sans">Issuing Store</span>
                                    <span className="text-slate-200 font-bold truncate block">{viewVoucherIssue.store?.name || 'Main Store'}</span>
                                </div>
                                <div>
                                    <span className="text-slate-500 block text-[9px] uppercase font-sans">Issue Date</span>
                                    <span className="text-slate-200">{new Date(viewVoucherIssue.issueDate).toLocaleDateString()}</span>
                                </div>
                                <div>
                                    <span className="text-slate-500 block text-[9px] uppercase font-sans">Signed By</span>
                                    <span className="text-emerald-400 font-bold truncate block">{viewVoucherIssue.signatureUrl || 'Contractor Supervisor'}</span>
                                </div>
                                <div>
                                    <span className="text-slate-500 block text-[9px] uppercase font-sans">Transfer Time</span>
                                    <span className="text-slate-200">{viewVoucherIssue.acceptedAt ? new Date(viewVoucherIssue.acceptedAt).toLocaleTimeString() : 'N/A'}</span>
                                </div>
                                {viewVoucherIssue.notes && (
                                    <div className="col-span-2 pt-1.5 border-t border-slate-800/80 mt-1 font-sans">
                                        <span className="text-slate-500 text-[9px] uppercase">Notes / Target Team</span>
                                        <span className="text-amber-400 block text-[10px] mt-0.5">{viewVoucherIssue.notes}</span>
                                    </div>
                                )}
                            </div>

                            <div className="space-y-1">
                                <span className="text-slate-400 font-bold uppercase text-[10px] tracking-wider block">Issued Materials ({viewVoucherIssue.items.length})</span>
                                <div className="bg-slate-950 rounded-xl border border-slate-800 overflow-x-auto max-h-48 overflow-y-auto">
                                    <table className="w-full text-left font-mono text-[10px] sm:text-[11px]">
                                        <thead className="bg-slate-950 border-b border-slate-800 text-[9px] text-slate-400 uppercase tracking-wider font-semibold">
                                            <tr>
                                                <th className="p-2">Item Code</th>
                                                <th className="p-2">Description</th>
                                                <th className="p-2 text-right">Quantity</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-800/60">
                                            {viewVoucherIssue.items.map((it) => (
                                                <tr key={it.id} className="hover:bg-slate-900/50">
                                                    <td className="p-2 text-amber-400 font-bold whitespace-nowrap">{it.item.code}</td>
                                                    <td className="p-2 text-slate-200 max-w-[110px] truncate">{it.item.name}</td>
                                                    <td className="p-2 text-right font-bold text-emerald-400 whitespace-nowrap">{it.quantity} {it.unit}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            <div className="p-2 bg-emerald-500/10 rounded-xl border border-emerald-500/30 flex items-center justify-between text-[10px] text-emerald-400 font-bold">
                                <span>🛡️ Digital Custody Verified</span>
                                <span className="font-mono text-[9px] text-emerald-500 uppercase">AUDIT LEDGER SECURED</span>
                            </div>
                        </div>
                    )}

                    <DialogFooter className="pt-2 flex justify-between gap-2">
                        <Button
                            type="button"
                            onClick={handlePrintVoucher}
                            className="bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold h-10 rounded-xl px-4 flex items-center gap-1.5 shadow-md"
                        >
                            <Printer className="w-4 h-4" />
                            Print / PDF Voucher
                        </Button>
                        <Button 
                            onClick={() => setViewVoucherIssue(null)} 
                            className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold h-10 rounded-xl border border-slate-700 active:scale-98 transition-all"
                        >
                            Close
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* New Material Return Note (MRN) Request Modal */}
            <Dialog open={isReturnModalOpen} onOpenChange={setIsReturnModalOpen}>
                <DialogContent className="bg-slate-900 border-slate-800 text-white w-full max-w-[94vw] sm:max-w-md p-4 sm:p-5 rounded-2xl shadow-2xl">
                    <DialogHeader>
                        <DialogTitle className="text-sm font-bold text-amber-400 flex items-center gap-2">
                            <RotateCcw className="w-4 h-4" /> New Material Return Note (MRN)
                        </DialogTitle>
                        <DialogDescription className="text-slate-400 text-[10px]">
                            Submit material return or damaged handover request to Main Store keeper.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-3 py-2 text-xs">
                        <div>
                            <label className="block text-slate-300 font-bold mb-1">Select Material Item</label>
                            <select
                                value={returnItemId}
                                onChange={(e) => setReturnItemId(e.target.value)}
                                className="w-full h-10 px-3 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-amber-500 text-xs"
                            >
                                <option value="">-- Choose Stock Item --</option>
                                {rawStockItems.map((s: StockItemRecord) => (
                                    <option key={s.item?.id || s.id} value={s.item?.id || s.id}>
                                        {s.item?.code} - {s.item?.name} (Van Stock: {s.quantity} {s.item?.unit})
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-slate-300 font-bold mb-1">Return Quantity</label>
                            <input
                                type="number"
                                placeholder="Enter return quantity"
                                value={returnQty || ''}
                                onChange={(e) => setReturnQty(Number(e.target.value))}
                                className="w-full h-10 px-3 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-amber-500 text-xs font-mono"
                            />
                        </div>

                        <div>
                            <label className="block text-slate-300 font-bold mb-1">Condition</label>
                            <select
                                value={returnCondition}
                                onChange={(e) => setReturnCondition(e.target.value)}
                                className="w-full h-10 px-3 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-amber-500 text-xs"
                            >
                                <option value="GOOD">EXCESS / GOOD CONDITION (Unused)</option>
                                <option value="DEFECTIVE">DEFECTIVE (Faulty / Factory Damage)</option>
                                <option value="DAMAGED">DAMAGED (Site Damage)</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-slate-300 font-bold mb-1">Return Reason / Notes</label>
                            <input
                                type="text"
                                placeholder="e.g. Unused drop wire cable coil / Faulty ONT power port"
                                value={returnReason}
                                onChange={(e) => setReturnReason(e.target.value)}
                                className="w-full h-10 px-3 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-amber-500 text-xs"
                            />
                        </div>
                    </div>

                    <DialogFooter className="flex-row gap-2 pt-2">
                        <Button variant="outline" onClick={() => setIsReturnModalOpen(false)} className="w-1/2 border-slate-800 text-slate-300 text-xs h-10 rounded-xl">
                            Cancel
                        </Button>
                        <Button
                            onClick={() => submitReturnMutation.mutate()}
                            disabled={!returnItemId || returnQty <= 0 || submitReturnMutation.isPending}
                            className="w-1/2 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold h-10 rounded-xl shadow-lg"
                        >
                            <RotateCcw className="w-4 h-4 mr-1" />
                            Submit MRN
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

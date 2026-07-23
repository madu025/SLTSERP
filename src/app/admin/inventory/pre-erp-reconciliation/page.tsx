"use client";

import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import RoleGuard from '@/components/RoleGuard';
import { ROLE_GROUPS } from '@/config/sidebar-menu';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
    Dialog, DialogContent, DialogDescription, DialogFooter,
    DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
    Package, FileSpreadsheet, RefreshCw, Edit3, LayoutGrid, TableProperties,
    Calendar, Scale, Search, ShieldCheck
} from 'lucide-react';
import { toast } from 'sonner';

// ─────────────────────────────────────────────────────────────────────────────
// Types & Constants
// ─────────────────────────────────────────────────────────────────────────────

interface OPMC {
    id: string;
    name: string;
    rtom: string;
}

interface MaterialBalanceItem {
    id: string;
    opmcId: string | null;
    itemId: string;
    itemCode: string;
    itemName: string;
    year: number;
    month: string;
    carryForwardQuantity: number;
    receivedQuantity: number;
    totalInHandQuantity: number;
    usageQuantity: number;
    wastageQuantity: number;
    faultyQuantity: number;
    totalUsageQuantity: number;
    closingBalanceQuantity: number;
    receivedCostLkr: number;
    usageCostLkr: number;
    unitCostLkr: number;
    status: 'UNRECONCILED' | 'ADJUSTED' | 'RECONCILED';
    item: { unit: string };
    adjustments?: {
        id: string;
        physicalAuditedQty: number;
        varianceQuantity: number;
        varianceReason: string;
        status: string;
    }[];
}

const ORDERED_ITEMS = [
    { code: 'FAC_CONN',        label: 'FAC Conn',      wastagePctRate: 0.02, wastagePct: '2%' },
    { code: 'FIBER_ROSETTE',   label: 'Rosette',       wastagePctRate: 0.00, wastagePct: '0%' },
    { code: 'HOOK_C',          label: 'Hook C',        wastagePctRate: 0.00, wastagePct: '0%' },
    { code: 'HOOK_L',          label: 'Hook L',        wastagePctRate: 0.00, wastagePct: '0%' },
    { code: 'BOLT_NUT',        label: 'Bolt & Nut',   wastagePctRate: 0.00, wastagePct: '0%' },
    { code: 'DW_RETAINER',     label: 'DW Retainer',  wastagePctRate: 0.01, wastagePct: '1%' },
    { code: 'CAT5E',           label: 'CAT5E',         wastagePctRate: 0.01, wastagePct: '1%' },
    { code: 'TWIN_WIRE',       label: 'Twin Wire',     wastagePctRate: 0.05, wastagePct: '5%' },
    { code: 'FIBER_DROP_F1G1', label: 'Fiber Drop',    wastagePctRate: 0.05, wastagePct: '5%' },
    { code: 'POLE_5.6M',       label: 'Pole 5.6m',     wastagePctRate: 0.00, wastagePct: '0%' },
    { code: 'POLE_6.7M',       label: 'Pole 6.7m',     wastagePctRate: 0.00, wastagePct: '0%' },
    { code: 'POLE_8M',         label: 'Pole 8m',       wastagePctRate: 0.00, wastagePct: '0%' },
];

const MONTH_ORDER: Record<string, number> = {
    'JAN': 1, 'FEB': 2, 'MARCH': 3, 'APRIL': 4, 'MAY': 5, 'JUNE': 6,
    'JULY': 7, 'AUG': 8, 'SEP': 9, 'OCT': 10, 'NOV': 11, 'DEC': 12,
};

function round2(val: number): number {
    return Math.round((val + Number.EPSILON) * 100) / 100;
}

function formatLKR(amount: number): string {
    if (amount >= 1_000_000) return `LKR ${(amount / 1_000_000).toFixed(2)}M`;
    if (amount >= 1_000)     return `LKR ${(amount / 1_000).toFixed(2)}K`;
    return `LKR ${amount.toFixed(2)}`;
}

function formatNum(val: number | undefined | null): string {
    if (val === undefined || val === null) return '0.00';
    return val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Page Component
// ─────────────────────────────────────────────────────────────────────────────

export default function PreErpReconciliationPage() {
    const queryClient = useQueryClient();

    // ── Filter & View State ──────────────────────────────────────────────────
    const [viewMode, setViewMode] = useState<'monthly_grid' | 'item_table'>('monthly_grid');
    const [selectedOpmcId, setSelectedOpmcId] = useState<string>('');
    const [selectedYear, setSelectedYear] = useState<string>('');
    const [selectedMonthFilter, setSelectedMonthFilter] = useState<string>('');
    const [searchQuery, setSearchQuery] = useState<string>('');

    // ── Single Item Adjustment Modal ──────────────────────────────────────────
    const [adjustBalance, setAdjustBalance] = useState<MaterialBalanceItem | null>(null);
    const [physicalQty, setPhysicalQty] = useState<string>('');
    const [varianceReason, setVarianceReason] = useState<'UNRECORDED_RECEIPT' | 'BUFFER_STOCK' | 'FIELD_SCRAP' | 'OTHER'>('UNRECORDED_RECEIPT');

    // ── Month Edit Side Drawer ────────────────────────────────────────────────
    const [editMonthBlock, setEditMonthBlock] = useState<{ year: number; month: string; items: MaterialBalanceItem[] } | null>(null);
    const [editFormValues, setEditFormValues] = useState<Record<string, { rec: number; usage: number }>>({});

    // ── Fetch OPMCs ──────────────────────────────────────────────────────────
    const { data: opmcs = [] } = useQuery<OPMC[]>({
        queryKey: ['opmcs'],
        queryFn: async () => {
            const res = await fetch('/api/opmcs', { cache: 'no-store' });
            const json = await res.json() as { data?: OPMC[]; items?: OPMC[] };
            return json.data ?? json.items ?? [];
        },
    });

    // ── Fetch Balances ────────────────────────────────────────────────────────
    const {
        data: balanceData,
        isLoading,
        refetch,
    } = useQuery<{ items: MaterialBalanceItem[]; total: number }>({
        queryKey: ['pre-erp-balances', selectedOpmcId, selectedYear, selectedMonthFilter],
        queryFn: async () => {
            const params = new URLSearchParams({
                _t: String(Date.now()),
                ...(selectedOpmcId && { opmcId: selectedOpmcId }),
                ...(selectedYear && { year: selectedYear }),
                ...(selectedMonthFilter && { month: selectedMonthFilter }),
                limit: '500',
            });
            const res = await fetch(`/api/inventory/pre-erp-reconciliation?${params.toString()}`, {
                cache: 'no-store',
                headers: { 'Cache-Control': 'no-cache' },
            });
            return res.json();
        },
    });

    // ── Group & Sort Monthly Blocks Chronologically (Latest Month First) ──────
    const monthlyBlocks = useMemo(() => {
        const itemsList = balanceData?.items ?? [];
        const map = new Map<string, { year: number; month: string; itemMap: Map<string, MaterialBalanceItem>; rawList: MaterialBalanceItem[] }>();

        for (const item of itemsList) {
            const key = `${item.year}-${item.month}`;
            if (!map.has(key)) {
                map.set(key, { year: item.year, month: item.month, itemMap: new Map(), rawList: [] });
            }
            map.get(key)!.itemMap.set(item.itemCode, item);
            map.get(key)!.rawList.push(item);
        }

        // Sort DESCENDING: Latest month first (Feb 2026 -> Jan 2026 -> ... -> July 2024)
        const list = Array.from(map.values());
        list.sort((a, b) => {
            if (a.year !== b.year) return b.year - a.year;
            const idxA = MONTH_ORDER[a.month] ?? 0;
            const idxB = MONTH_ORDER[b.month] ?? 0;
            return idxB - idxA;
        });

        return list;
    }, [balanceData]);

    // ── Mutations ─────────────────────────────────────────────────────────────

    const importMutation = useMutation({
        mutationFn: async () => {
            const res = await fetch('/api/inventory/pre-erp-reconciliation/import', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    filePath: 'D:/MyProject/SLTSERP/Material Report Summary -From  June.xlsx',
                }),
            });
            if (!res.ok) throw new Error('Import failed');
            return res.json() as Promise<{ totalRecordsProcessed: number; monthsProcessed: number }>;
        },
        onSuccess: (data) => {
            toast.success(`Successfully imported ${data.totalRecordsProcessed} material records across ${data.monthsProcessed} months!`);
            void queryClient.invalidateQueries({ queryKey: ['pre-erp-balances'] });
        },
        onError: (err: Error) => toast.error(err.message),
    });

    const bulkSaveMonthMutation = useMutation({
        mutationFn: async () => {
            if (!editMonthBlock) return;
            const payloadItems = editMonthBlock.items.map((item) => {
                const form = editFormValues[item.itemId] || {
                    rec: item.receivedQuantity,
                    usage: item.usageQuantity,
                };
                const wastageRate = ORDERED_ITEMS.find((o) => o.code === item.itemCode)?.wastagePctRate ?? 0;
                const calculatedWastage = round2(form.usage * wastageRate);

                return {
                    opmcId: selectedOpmcId || null,
                    itemId: item.itemId,
                    year: item.year,
                    month: item.month,
                    carryForwardQuantity: item.carryForwardQuantity, // Auto-cascaded from previous month
                    receivedQuantity: round2(form.rec),
                    usageQuantity: round2(form.usage),
                    wastageQuantity: calculatedWastage, // Auto-calculated
                    unitCostLkr: item.unitCostLkr,
                };
            });

            const res = await fetch('/api/inventory/pre-erp-reconciliation', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ items: payloadItems }),
            });
            if (!res.ok) throw new Error('Failed to save monthly changes');
            return res.json();
        },
        onSuccess: () => {
            toast.success(`Successfully updated material balance & auto-calculated wastage for ${editMonthBlock?.month} ${editMonthBlock?.year}!`);
            setEditMonthBlock(null);
            void queryClient.invalidateQueries({ queryKey: ['pre-erp-balances'] });
        },
        onError: (err: Error) => toast.error(err.message),
    });

    const adjustMutation = useMutation({
        mutationFn: async () => {
            if (!adjustBalance || physicalQty === '') throw new Error('Fill in physical count');
            const res = await fetch('/api/inventory/pre-erp-reconciliation/adjust', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    balanceId: adjustBalance.id,
                    physicalAuditedQty: round2(Number(physicalQty)),
                    varianceReason,
                }),
            });
            if (!res.ok) throw new Error('Adjustment submission failed');
            return res.json();
        },
        onSuccess: () => {
            toast.success('Physical audit adjustment submitted for approval');
            setAdjustBalance(null);
            setPhysicalQty('');
            void queryClient.invalidateQueries({ queryKey: ['pre-erp-balances'] });
        },
        onError: (err: Error) => toast.error(err.message),
    });

    const items = balanceData?.items ?? [];
    const filteredItems = items.filter((i) =>
        i.itemName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        i.itemCode.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const selectedOpmc = opmcs.find((o) => o.id === selectedOpmcId);

    // Open month edit side drawer
    const handleOpenEditMonth = (block: { year: number; month: string; rawList: MaterialBalanceItem[] }) => {
        const initialForm: Record<string, { rec: number; usage: number }> = {};
        block.rawList.forEach((i) => {
            initialForm[i.itemId] = {
                rec: i.receivedQuantity,
                usage: i.usageQuantity,
            };
        });
        setEditFormValues(initialForm);
        setEditMonthBlock({ year: block.year, month: block.month, items: block.rawList });
    };

    return (
        <RoleGuard allowedRoles={[...ROLE_GROUPS.ADMINS, ...ROLE_GROUPS.STORES, 'FINANCE_MANAGER']}>
            <div className="flex h-screen bg-slate-50 text-slate-900 overflow-hidden">
                <Sidebar />
                <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                    <Header />

                    <main className="flex-1 overflow-y-auto p-6 space-y-6">
                        {/* ── Header ───────────────────────────────────────────── */}
                        <div className="flex flex-wrap items-start justify-between gap-4">
                            <div>
                                <div className="flex items-center gap-2 mb-1">
                                    <Badge className="bg-amber-100 text-amber-800 border border-amber-300 font-mono text-[10px] uppercase tracking-wider">Stores Module</Badge>
                                    <Badge variant="outline" className="border-slate-300 text-slate-600 text-[10px]">Pre-ERP Monthly Ledger (2 Decimals)</Badge>
                                </div>
                                <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
                                    <Package className="w-6 h-6 text-amber-600" />
                                    Pre-ERP Material Reconciliation
                                </h1>
                                <p className="text-sm text-slate-500 mt-1">
                                    Automated Carry Forward Cascade &amp; Wastage Engine (July 2024 – Feb 2026)
                                    {selectedOpmc ? (
                                        <span className="ml-2 text-amber-700 font-semibold">· {selectedOpmc.name}</span>
                                    ) : (
                                        <span className="ml-2 text-emerald-700 font-semibold">· All Island / Main Central Store Scope</span>
                                    )}
                                </p>
                            </div>

                            <div className="flex items-center gap-3 flex-wrap">
                                {/* View Mode Toggle */}
                                <div className="flex gap-1 bg-slate-200 border border-slate-300 rounded-lg p-1">
                                    <button
                                        id="view-monthly-grid"
                                        onClick={() => setViewMode('monthly_grid')}
                                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-colors ${viewMode === 'monthly_grid' ? 'bg-amber-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
                                    >
                                        <LayoutGrid className="w-3.5 h-3.5" />
                                        Monthly Excel View
                                    </button>
                                    <button
                                        id="view-item-table"
                                        onClick={() => setViewMode('item_table')}
                                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-colors ${viewMode === 'item_table' ? 'bg-amber-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
                                    >
                                        <TableProperties className="w-3.5 h-3.5" />
                                        Item Master List
                                    </button>
                                </div>

                                {/* Scope / OPMC */}
                                <Select value={selectedOpmcId || 'ALL'} onValueChange={(v) => setSelectedOpmcId(v === 'ALL' ? '' : v)}>
                                    <SelectTrigger id="reconcile-opmc" className="w-56 bg-white border-slate-300 text-slate-800 text-sm font-medium">
                                        <SelectValue placeholder="Select Scope" />
                                    </SelectTrigger>
                                    <SelectContent className="bg-white border-slate-200 text-slate-800">
                                        <SelectItem value="ALL">All Island / Main Central Store</SelectItem>
                                        {opmcs.map((o) => (
                                            <SelectItem key={o.id} value={o.id}>{o.name} ({o.rtom})</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>

                                {/* Year */}
                                <Select value={selectedYear || 'ALL'} onValueChange={(v) => setSelectedYear(v === 'ALL' ? '' : v)}>
                                    <SelectTrigger id="reconcile-year" className="w-32 bg-white border-slate-300 text-slate-800 text-sm font-medium">
                                        <SelectValue placeholder="Year" />
                                    </SelectTrigger>
                                    <SelectContent className="bg-white border-slate-200 text-slate-800">
                                        <SelectItem value="ALL">All Years</SelectItem>
                                        <SelectItem value="2026">2026</SelectItem>
                                        <SelectItem value="2025">2025</SelectItem>
                                        <SelectItem value="2024">2024</SelectItem>
                                    </SelectContent>
                                </Select>

                                <Button id="refresh-balances" size="sm" variant="outline" onClick={() => void refetch()} className="border-slate-300 text-slate-700 hover:bg-slate-100 font-semibold">
                                    <RefreshCw className="w-4 h-4 mr-1.5" />
                                    Refresh
                                </Button>

                                <Button
                                    id="import-excel"
                                    size="sm"
                                    onClick={() => importMutation.mutate()}
                                    disabled={importMutation.isPending}
                                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-sm"
                                >
                                    {importMutation.isPending ? (
                                        <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" /> Importing...</>
                                    ) : (
                                        <><FileSpreadsheet className="w-4 h-4 mr-1.5" /> Re-Import Excel</>
                                    )}
                                </Button>
                            </div>
                        </div>

                        {/* ── Month Quick Jump Bar ─────────────────────────────── */}
                        {viewMode === 'monthly_grid' && monthlyBlocks.length > 0 && (
                            <div className="bg-white border border-slate-200 rounded-xl p-3 flex items-center gap-2 overflow-x-auto text-xs font-mono shadow-sm">
                                <span className="text-slate-600 font-sans font-bold shrink-0 mr-1 flex items-center gap-1">
                                    <Calendar className="w-3.5 h-3.5 text-amber-600" /> Jump to Month:
                                </span>
                                {monthlyBlocks.map((b) => (
                                    <a
                                        key={`${b.year}-${b.month}`}
                                        href={`#month-block-${b.year}-${b.month}`}
                                        className="px-2.5 py-1 rounded bg-slate-100 hover:bg-amber-100 text-slate-700 hover:text-amber-900 border border-slate-200 transition-colors shrink-0 font-sans text-xs font-medium"
                                    >
                                        {b.month} {b.year}
                                    </a>
                                ))}
                            </div>
                        )}

                        {/* ── View 1: Monthly Excel Grid View ─────────────────────── */}
                        {viewMode === 'monthly_grid' && (
                            <div className="space-y-6">
                                {isLoading ? (
                                    <div className="rounded-xl border border-slate-200 bg-white p-12 text-center text-slate-500 shadow-sm">
                                        <div className="w-8 h-8 border-2 border-amber-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                                        <p className="text-sm">Loading monthly Excel material blocks...</p>
                                    </div>
                                ) : monthlyBlocks.length === 0 ? (
                                    <div className="rounded-xl border border-slate-200 bg-white p-12 text-center text-slate-500 shadow-sm">
                                        <FileSpreadsheet className="w-12 h-12 text-slate-400 mx-auto mb-3" />
                                        <p className="text-sm font-semibold text-slate-700">No monthly material records found</p>
                                        <p className="text-xs text-slate-500 mt-1">Click "Re-Import Excel" to load legacy report from D:\MyProject\SLTSERP\Material Report Summary -From June.xlsx</p>
                                    </div>
                                ) : (
                                    monthlyBlocks.map((block) => {
                                        let monthReceivedCost = 0;
                                        let monthUsageCost = 0;
                                        ORDERED_ITEMS.forEach((col) => {
                                            const rec = block.itemMap.get(col.code);
                                            if (rec) {
                                                monthReceivedCost += rec.receivedCostLkr;
                                                monthUsageCost += rec.usageCostLkr;
                                            }
                                        });

                                        return (
                                            <div
                                                id={`month-block-${block.year}-${block.month}`}
                                                key={`${block.year}-${block.month}`}
                                                className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm"
                                            >
                                                {/* Block Header */}
                                                <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                                                    <div className="flex items-center gap-3">
                                                        <Calendar className="w-5 h-5 text-amber-600" />
                                                        <div>
                                                            <h2 className="text-base font-bold text-slate-900 tracking-wide">{block.month} {block.year}</h2>
                                                            <span className="text-[11px] text-slate-500">12 Core Material Categories</span>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-4 text-xs font-mono">
                                                        <span className="text-emerald-700 font-bold">Received: {formatLKR(monthReceivedCost)}</span>
                                                        <span className="text-blue-700 font-bold">Usage: {formatLKR(monthUsageCost)}</span>
                                                        <Button
                                                            id={`edit-month-${block.year}-${block.month}`}
                                                            size="sm"
                                                            variant="outline"
                                                            onClick={() => handleOpenEditMonth(block)}
                                                            className="border-amber-300 text-amber-900 bg-amber-50 hover:bg-amber-100 font-semibold text-xs h-7 ml-2"
                                                        >
                                                            <Edit3 className="w-3.5 h-3.5 mr-1 text-amber-700" />
                                                            Edit Received &amp; Usage
                                                        </Button>
                                                    </div>
                                                </div>

                                                {/* Excel Grid Table */}
                                                <div className="overflow-x-auto">
                                                    <table className="w-full text-xs border-collapse">
                                                        <thead>
                                                            <tr className="border-b-2 border-slate-300 bg-slate-100 text-slate-700 font-bold">
                                                                <th className="px-4 py-3 text-left sticky left-0 bg-slate-100 text-slate-800 font-bold uppercase text-xs tracking-wider min-w-44 z-20 border-r border-slate-200 border-b-2 border-slate-300">
                                                                    METRIC / STATUS
                                                                </th>
                                                                {ORDERED_ITEMS.map((col) => (
                                                                    <th key={col.code} className="px-3 py-2.5 text-right bg-slate-100 min-w-28 border-b-2 border-slate-300">
                                                                        <div className="font-bold text-slate-900 text-xs uppercase tracking-wider">{col.label}</div>
                                                                        <span className="inline-block mt-0.5 px-1.5 py-0.5 rounded bg-rose-100 text-rose-800 text-[10px] font-mono font-bold">
                                                                            Wastage: {col.wastagePct}
                                                                        </span>
                                                                    </th>
                                                                ))}
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-slate-200 font-mono">
                                                            {/* 1. Carry Forward Balance (Auto-Cascaded) */}
                                                            <tr className="bg-amber-50/50 hover:bg-amber-50 transition-colors">
                                                                <td className="px-4 py-2 font-sans font-bold text-amber-900 sticky left-0 bg-white z-10 border-r border-slate-200">
                                                                    Carry Forward Balance
                                                                    <span className="ml-1 text-[10px] text-amber-700 font-sans font-normal">(Auto)</span>
                                                                </td>
                                                                {ORDERED_ITEMS.map((col) => {
                                                                    const item = block.itemMap.get(col.code);
                                                                    return (
                                                                        <td key={col.code} className="px-3 py-2 text-right text-amber-900 font-semibold">
                                                                            {formatNum(item?.carryForwardQuantity)}
                                                                        </td>
                                                                    );
                                                                })}
                                                            </tr>

                                                            {/* 2. Received (Manual Entry) */}
                                                            <tr className="bg-emerald-50/50 hover:bg-emerald-50 transition-colors">
                                                                <td className="px-4 py-2 font-sans font-bold text-emerald-900 sticky left-0 bg-white z-10 border-r border-slate-200">
                                                                    Received
                                                                </td>
                                                                {ORDERED_ITEMS.map((col) => {
                                                                    const item = block.itemMap.get(col.code);
                                                                    return (
                                                                        <td key={col.code} className="px-3 py-2 text-right text-emerald-900 font-bold">
                                                                            {formatNum(item?.receivedQuantity)}
                                                                        </td>
                                                                    );
                                                                })}
                                                            </tr>

                                                            {/* 3. Total Inhand */}
                                                            <tr className="bg-slate-100/70 hover:bg-slate-100 font-semibold transition-colors">
                                                                <td className="px-4 py-2 font-sans text-slate-800 sticky left-0 bg-white z-10 border-r border-slate-200 font-bold">
                                                                    Total Inhand
                                                                </td>
                                                                {ORDERED_ITEMS.map((col) => {
                                                                    const item = block.itemMap.get(col.code);
                                                                    return (
                                                                        <td key={col.code} className="px-3 py-2 text-right text-slate-900">
                                                                            {formatNum(item?.totalInHandQuantity)}
                                                                        </td>
                                                                    );
                                                                })}
                                                            </tr>

                                                            {/* 4. Usage (Manual Entry) */}
                                                            <tr className="bg-blue-50/50 hover:bg-blue-50 transition-colors">
                                                                <td className="px-4 py-2 font-sans font-bold text-blue-900 sticky left-0 bg-white z-10 border-r border-slate-200">
                                                                    Usage
                                                                </td>
                                                                {ORDERED_ITEMS.map((col) => {
                                                                    const item = block.itemMap.get(col.code);
                                                                    return (
                                                                        <td key={col.code} className="px-3 py-2 text-right text-blue-900 font-semibold">
                                                                            {formatNum(item?.usageQuantity)}
                                                                        </td>
                                                                    );
                                                                })}
                                                            </tr>

                                                            {/* 5. Wastage (Auto Calculated) */}
                                                            <tr className="bg-rose-50/50 hover:bg-rose-50 transition-colors">
                                                                <td className="px-4 py-2 font-sans font-bold text-rose-900 sticky left-0 bg-white z-10 border-r border-slate-200">
                                                                    Wastage
                                                                    <span className="ml-1 text-[10px] text-rose-700 font-sans font-normal">(Auto)</span>
                                                                </td>
                                                                {ORDERED_ITEMS.map((col) => {
                                                                    const item = block.itemMap.get(col.code);
                                                                    return (
                                                                        <td key={col.code} className="px-3 py-2 text-right text-rose-900 font-semibold">
                                                                            {formatNum(item?.wastageQuantity)}
                                                                        </td>
                                                                    );
                                                                })}
                                                            </tr>

                                                            {/* 6. Total Usage */}
                                                            <tr className="bg-slate-100/70 hover:bg-slate-100 font-bold transition-colors">
                                                                <td className="px-4 py-2 font-sans text-slate-900 sticky left-0 bg-white z-10 border-r border-slate-200 font-bold">
                                                                    Total Usage
                                                                </td>
                                                                {ORDERED_ITEMS.map((col) => {
                                                                    const item = block.itemMap.get(col.code);
                                                                    return (
                                                                        <td key={col.code} className="px-3 py-2 text-right text-slate-900">
                                                                            {formatNum(item?.totalUsageQuantity)}
                                                                        </td>
                                                                    );
                                                                })}
                                                            </tr>

                                                            {/* 7. Closing Balance */}
                                                            <tr className="bg-slate-900 text-white font-extrabold">
                                                                <td className="px-4 py-2.5 font-sans text-amber-400 sticky left-0 bg-slate-900 z-10 border-r border-slate-800">
                                                                    Computed Closing Balance
                                                                </td>
                                                                {ORDERED_ITEMS.map((col) => {
                                                                    const item = block.itemMap.get(col.code);
                                                                    const isNeg = (item?.closingBalanceQuantity ?? 0) < 0;
                                                                    return (
                                                                        <td key={col.code} className={`px-3 py-2.5 text-right font-mono ${isNeg ? 'text-rose-300' : 'text-emerald-300'}`}>
                                                                            {formatNum(item?.closingBalanceQuantity)}
                                                                        </td>
                                                                    );
                                                                })}
                                                            </tr>

                                                            {/* 8. Received Rs */}
                                                            <tr className="bg-white hover:bg-slate-50 text-[11px] text-slate-600">
                                                                <td className="px-4 py-1.5 font-sans text-slate-600 sticky left-0 bg-white z-10 border-r border-slate-200">
                                                                    Received Cost (LKR)
                                                                </td>
                                                                {ORDERED_ITEMS.map((col) => {
                                                                    const item = block.itemMap.get(col.code);
                                                                    return (
                                                                        <td key={col.code} className="px-3 py-1.5 text-right text-slate-600 font-medium">
                                                                            {item?.receivedCostLkr ? formatLKR(item.receivedCostLkr) : '—'}
                                                                        </td>
                                                                    );
                                                                })}
                                                            </tr>

                                                            {/* 9. Usage Rs */}
                                                            <tr className="bg-white hover:bg-slate-50 text-[11px] text-slate-600">
                                                                <td className="px-4 py-1.5 font-sans text-slate-600 sticky left-0 bg-white z-10 border-r border-slate-200">
                                                                    Usage Cost (LKR)
                                                                </td>
                                                                {ORDERED_ITEMS.map((col) => {
                                                                    const item = block.itemMap.get(col.code);
                                                                    return (
                                                                        <td key={col.code} className="px-3 py-1.5 text-right text-slate-600 font-medium">
                                                                            {item?.usageCostLkr ? formatLKR(item.usageCostLkr) : '—'}
                                                                        </td>
                                                                    );
                                                                })}
                                                            </tr>
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        )}

                        {/* ── View 2: Item Master List View ─────────────────────── */}
                        {viewMode === 'item_table' && (
                            <div className="space-y-4">
                                <div className="flex items-center gap-4 bg-white border border-slate-200 rounded-xl p-3 shadow-sm">
                                    <div className="relative flex-1">
                                        <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                                        <Input
                                            id="search-materials"
                                            placeholder="Search by material code or description (e.g. Fiber Drop Wire, HOOK L)..."
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            className="pl-9 bg-slate-50 border-slate-300 text-slate-900 placeholder:text-slate-400 text-sm"
                                        />
                                    </div>
                                    <span className="text-xs text-slate-500 font-mono">{filteredItems.length} records</span>
                                </div>

                                <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm border-collapse">
                                            <thead>
                                                <tr className="border-b border-slate-200 bg-slate-100">
                                                    <th className="px-4 py-3 text-left font-bold text-slate-700 text-xs">Period</th>
                                                    <th className="px-4 py-3 text-left font-bold text-slate-700 text-xs">Material Item</th>
                                                    <th className="px-4 py-3 text-right font-bold text-amber-800 text-xs">Opening (C/F)</th>
                                                    <th className="px-4 py-3 text-right font-bold text-emerald-800 text-xs">Received</th>
                                                    <th className="px-4 py-3 text-right font-bold text-slate-800 text-xs">Total In-Hand</th>
                                                    <th className="px-4 py-3 text-right font-bold text-blue-800 text-xs">Usage</th>
                                                    <th className="px-4 py-3 text-right font-bold text-rose-800 text-xs">Wastage</th>
                                                    <th className="px-4 py-3 text-right font-bold text-emerald-800 text-xs">Computed Balance</th>
                                                    <th className="px-4 py-3 text-left font-bold text-slate-700 text-xs">Status</th>
                                                    <th className="px-4 py-3 text-center font-bold text-slate-700 text-xs">Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-200 font-mono">
                                                {isLoading ? (
                                                    <tr><td colSpan={10} className="px-4 py-10 text-center text-slate-500 text-xs font-sans">Loading material balances...</td></tr>
                                                ) : filteredItems.length === 0 ? (
                                                    <tr><td colSpan={10} className="px-4 py-12 text-center text-slate-500 text-xs font-sans">No records matching search.</td></tr>
                                                ) : (
                                                    filteredItems.map((row) => (
                                                        <tr key={row.id} className="hover:bg-slate-50 transition-colors">
                                                            <td className="px-4 py-3 font-sans text-xs text-slate-600">{row.month} {row.year}</td>
                                                            <td className="px-4 py-3 font-sans">
                                                                <p className="font-semibold text-slate-900">{row.itemName}</p>
                                                                <p className="text-[10px] text-slate-500 font-mono">{row.itemCode} ({row.item.unit})</p>
                                                            </td>
                                                            <td className="px-4 py-3 text-right text-amber-900 font-semibold">{formatNum(row.carryForwardQuantity)}</td>
                                                            <td className="px-4 py-3 text-right text-emerald-800 font-bold">+{formatNum(row.receivedQuantity)}</td>
                                                            <td className="px-4 py-3 text-right text-slate-800">{formatNum(row.totalInHandQuantity)}</td>
                                                            <td className="px-4 py-3 text-right text-blue-800 font-semibold">{formatNum(row.usageQuantity)}</td>
                                                            <td className="px-4 py-3 text-right text-rose-800 font-semibold">{formatNum(row.wastageQuantity)}</td>
                                                            <td className={`px-4 py-3 text-right font-bold ${row.closingBalanceQuantity < 0 ? 'text-rose-700' : 'text-emerald-700'}`}>
                                                                {formatNum(row.closingBalanceQuantity)}
                                                            </td>
                                                            <td className="px-4 py-3 font-sans">
                                                                <Badge className={`text-[10px] ${row.status === 'RECONCILED' ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-slate-100 text-slate-700 border border-slate-300'}`}>
                                                                    {row.status}
                                                                </Badge>
                                                            </td>
                                                            <td className="px-4 py-3 text-center">
                                                                <Button
                                                                    id={`reconcile-item-${row.id}`}
                                                                    size="sm"
                                                                    variant="ghost"
                                                                    className="text-amber-700 hover:bg-amber-50 h-7 px-2 text-xs font-sans font-semibold"
                                                                    onClick={() => {
                                                                        setAdjustBalance(row);
                                                                        setPhysicalQty(String(Math.max(0, row.closingBalanceQuantity)));
                                                                    }}
                                                                >
                                                                    <Scale className="w-3.5 h-3.5 mr-1" />
                                                                    Reconcile
                                                                </Button>
                                                            </td>
                                                        </tr>
                                                    ))
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        )}
                    </main>
                </div>
            </div>

            {/* ── Edit Month Side Drawer (Automated CarryForward & Wastage) ────── */}
            {editMonthBlock && (
                <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/50 backdrop-blur-xs transition-opacity animate-in fade-in duration-200">
                    <div className="absolute inset-0" onClick={() => setEditMonthBlock(null)} />

                    <div className="relative w-full max-w-3xl bg-white h-full shadow-2xl flex flex-col border-l border-slate-200 z-10 animate-in slide-in-from-right duration-300">
                        {/* Drawer Header */}
                        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                            <div>
                                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                                    <Edit3 className="w-5 h-5 text-amber-600" />
                                    Edit Month Data (Received &amp; Usage Entry)
                                </h2>
                                <p className="text-xs text-slate-500 mt-0.5">
                                    Period: <span className="font-bold text-slate-800">{editMonthBlock.month} {editMonthBlock.year}</span> · Carry Forward &amp; Wastage Auto-Calculated
                                </p>
                            </div>
                            <button
                                id="close-month-drawer"
                                onClick={() => setEditMonthBlock(null)}
                                className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors"
                            >
                                ✕
                            </button>
                        </div>

                        {/* Drawer Content */}
                        <div className="flex-1 overflow-y-auto p-6 space-y-4">
                            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-xs text-emerald-900 font-medium flex items-center gap-2">
                                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                                <span>
                                    <strong>Automated Business Rules:</strong> You only enter <strong>Received</strong> &amp; <strong>Usage</strong>. Carry Forward is auto-derived from the previous month, and Wastage is auto-calculated based on item wastage rules. All values round to 2 decimal places.
                                </span>
                            </div>

                            <table className="w-full text-xs border-collapse">
                                <thead>
                                    <tr className="border-b-2 border-slate-200 text-slate-700 font-bold uppercase tracking-wider bg-slate-100">
                                        <th className="px-3 py-2.5 text-left">Material Item</th>
                                        <th className="px-2 py-2.5 text-right w-28 text-amber-800">Carry Forward (Auto)</th>
                                        <th className="px-2 py-2.5 text-right w-28 text-emerald-800">Received (Manual)</th>
                                        <th className="px-2 py-2.5 text-right w-28 text-blue-800">Usage (Manual)</th>
                                        <th className="px-2 py-2.5 text-right w-28 text-rose-800">Wastage (Auto)</th>
                                        <th className="px-3 py-2.5 text-right w-28 text-emerald-800">Closing Bal</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200 font-mono">
                                    {editMonthBlock.items.map((item) => {
                                        const form = editFormValues[item.itemId] || {
                                            rec: item.receivedQuantity,
                                            usage: item.usageQuantity,
                                        };
                                        const wastageRate = ORDERED_ITEMS.find((o) => o.code === item.itemCode)?.wastagePctRate ?? 0;

                                        const cf = round2(item.carryForwardQuantity);
                                        const rec = round2(form.rec);
                                        const usage = round2(form.usage);
                                        const autoWastage = round2(usage * wastageRate);
                                        const calcInHand = round2(cf + rec);
                                        const calcTotalUsage = round2(usage + autoWastage);
                                        const calcClosing = round2(calcInHand - calcTotalUsage);

                                        return (
                                            <tr key={item.itemId} className="hover:bg-slate-50">
                                                <td className="px-3 py-2.5 font-sans">
                                                    <p className="font-semibold text-slate-900">{item.itemName}</p>
                                                    <span className="text-[10px] text-slate-500 font-mono">{item.itemCode} ({item.item.unit})</span>
                                                </td>
                                                {/* Carry Forward (Auto Read-Only) */}
                                                <td className="px-3 py-2 text-right font-semibold text-amber-900 bg-amber-50/50">
                                                    {formatNum(cf)}
                                                </td>
                                                {/* Received (Manual Edit Input) */}
                                                <td className="px-1.5 py-2">
                                                    <Input
                                                        type="number"
                                                        step="0.01"
                                                        value={form.rec}
                                                        onChange={(e) => setEditFormValues({
                                                            ...editFormValues,
                                                            [item.itemId]: { ...form, rec: Number(e.target.value) }
                                                        })}
                                                        className="h-8 bg-white border-emerald-300 text-right text-emerald-800 font-mono text-xs font-bold"
                                                    />
                                                </td>
                                                {/* Usage (Manual Edit Input) */}
                                                <td className="px-1.5 py-2">
                                                    <Input
                                                        type="number"
                                                        step="0.01"
                                                        value={form.usage}
                                                        onChange={(e) => setEditFormValues({
                                                            ...editFormValues,
                                                            [item.itemId]: { ...form, usage: Number(e.target.value) }
                                                        })}
                                                        className="h-8 bg-white border-blue-300 text-right text-blue-800 font-mono text-xs font-semibold"
                                                    />
                                                </td>
                                                {/* Wastage (Auto Calculated Read-Only) */}
                                                <td className="px-3 py-2 text-right font-semibold text-rose-900 bg-rose-50/50">
                                                    {formatNum(autoWastage)}
                                                </td>
                                                {/* Closing Balance (Auto Calculated) */}
                                                <td className={`px-3 py-2.5 text-right font-black ${calcClosing < 0 ? 'text-rose-700' : 'text-emerald-700'}`}>
                                                    {formatNum(calcClosing)}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        {/* Drawer Footer */}
                        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-3">
                            <Button variant="outline" onClick={() => setEditMonthBlock(null)} className="border-slate-300 text-slate-700 font-semibold">
                                Cancel
                            </Button>
                            <Button
                                id="save-month-changes"
                                onClick={() => bulkSaveMonthMutation.mutate()}
                                disabled={bulkSaveMonthMutation.isPending}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-sm"
                            >
                                {bulkSaveMonthMutation.isPending ? 'Saving & Recalculating...' : 'Save Month Changes'}
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Reconcile Modal ───────────────────────────────────────────── */}
            <Dialog open={!!adjustBalance} onOpenChange={(o) => !o && setAdjustBalance(null)}>
                <DialogContent className="bg-white border-slate-200 text-slate-900 max-w-md shadow-lg">
                    <DialogHeader>
                        <DialogTitle className="text-slate-900 flex items-center gap-2 font-bold">
                            <Scale className="w-5 h-5 text-amber-600" />
                            Reconcile Physical Stock Count
                        </DialogTitle>
                        <DialogDescription className="text-slate-500">
                            {adjustBalance && `${adjustBalance.itemName} (${adjustBalance.month} ${adjustBalance.year})`}
                        </DialogDescription>
                    </DialogHeader>

                    {adjustBalance && (
                        <div className="space-y-4 py-2 text-sm">
                            <div className="rounded-lg bg-slate-100 p-3 space-y-1 border border-slate-200">
                                <div className="flex justify-between text-xs text-slate-600">
                                    <span>System Calculated Stock:</span>
                                    <span className="font-mono text-slate-900 font-bold">{formatNum(adjustBalance.closingBalanceQuantity)} {adjustBalance.item.unit}</span>
                                </div>
                                <div className="flex justify-between text-xs text-slate-600">
                                    <span>Unit Cost:</span>
                                    <span className="font-mono text-slate-900">LKR {formatNum(adjustBalance.unitCostLkr)}</span>
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-xs text-slate-600 font-semibold uppercase tracking-wider">Physical Audited Count ({adjustBalance.item.unit}) *</label>
                                <Input
                                    id="physical-count"
                                    type="number"
                                    step="0.01"
                                    value={physicalQty}
                                    onChange={(e) => setPhysicalQty(e.target.value)}
                                    placeholder="Enter physical count"
                                    className="bg-slate-50 border-slate-300 text-slate-900 font-bold"
                                />
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-xs text-slate-600 font-semibold uppercase tracking-wider">Discrepancy Reason *</label>
                                <Select value={varianceReason} onValueChange={(v) => setVarianceReason(v as typeof varianceReason)}>
                                    <SelectTrigger id="variance-reason" className="bg-white border-slate-300 text-slate-900">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="bg-white border-slate-200 text-slate-900">
                                        <SelectItem value="UNRECORDED_RECEIPT">Unrecorded SLT GRN Receipt</SelectItem>
                                        <SelectItem value="BUFFER_STOCK">Pre-existing Buffer Stock Utilized</SelectItem>
                                        <SelectItem value="FIELD_SCRAP">Field Scrap / Damaged Unentered</SelectItem>
                                        <SelectItem value="OTHER">Other Physical Audit Variance</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            {physicalQty !== '' && (
                                <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-900 font-semibold">
                                    Variance: <span className="font-bold font-mono">{formatNum(round2(Number(physicalQty)) - adjustBalance.closingBalanceQuantity)} {adjustBalance.item.unit}</span>
                                </div>
                            )}
                        </div>
                    )}

                    <DialogFooter className="gap-2 border-t border-slate-200 pt-3">
                        <Button variant="outline" onClick={() => setAdjustBalance(null)} className="border-slate-300 text-slate-700 font-semibold">
                            Cancel
                        </Button>
                        <Button
                            id="submit-adjustment"
                            onClick={() => adjustMutation.mutate()}
                            disabled={adjustMutation.isPending}
                            className="bg-amber-600 hover:bg-amber-700 text-white font-bold shadow-sm"
                        >
                            {adjustMutation.isPending ? 'Submitting...' : 'Submit Adjustment'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </RoleGuard>
    );
}

"use client";

import React, { useState, useCallback } from 'react';
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
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
    AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { PieChart as PieIcon, Plus, Trash2, Lock, RefreshCw, CheckCircle, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface OPMC {
    id: string;
    name: string;
    rtom: string;
}

interface Budget {
    id: string;
    opmcId: string;
    fiscalYear: number;
    quarter: number | null;
    expenditureType: 'CAPEX' | 'OPEX';
    category: string;
    allocatedAmount: number;
    description: string | null;
    status: string;
    approvedById: string | null;
    approvedAt: string | null;
    createdAt: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const SPEND_CATEGORIES = [
    { value: 'NETWORK_INFRA',      label: 'Network Infrastructure' },
    { value: 'MAINTENANCE',        label: 'Maintenance' },
    { value: 'CONTRACTOR_PAYMENT', label: 'Contractor Payments' },
    { value: 'PETTY_CASH',         label: 'Petty Cash' },
    { value: 'VEHICLE',            label: 'Vehicle / Transport' },
    { value: 'EQUIPMENT',          label: 'Equipment' },
    { value: 'OTHER',              label: 'Other' },
];

const CURRENT_YEAR = new Date().getFullYear();
const FISCAL_YEARS = Array.from({ length: 5 }, (_, i) => CURRENT_YEAR - 2 + i);

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
    ACTIVE:  { label: 'Active',  className: 'bg-emerald-600/20 text-emerald-300 border border-emerald-700' },
    FROZEN:  { label: 'Frozen',  className: 'bg-slate-600/20 text-slate-400 border border-slate-700' },
    REVISED: { label: 'Revised', className: 'bg-amber-600/20 text-amber-300 border border-amber-700' },
};

function formatLKR(amount: number): string {
    if (amount >= 1_000_000) return `LKR ${(amount / 1_000_000).toFixed(2)}M`;
    if (amount >= 1_000)     return `LKR ${(amount / 1_000).toFixed(1)}K`;
    return `LKR ${amount.toFixed(0)}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────

export default function BudgetAllocationsPage() {
    const queryClient = useQueryClient();

    // ── Filters ──────────────────────────────────────────────────────────────
    const [filterOpmcId, setFilterOpmcId] = useState<string>('');
    const [filterFY, setFilterFY] = useState<number>(CURRENT_YEAR);
    const [filterType, setFilterType] = useState<string>('');

    // ── Dialog State ─────────────────────────────────────────────────────────
    const [createOpen, setCreateOpen] = useState(false);
    const [deleteId, setDeleteId] = useState<string | null>(null);

    // ── Form State ───────────────────────────────────────────────────────────
    const [form, setForm] = useState({
        opmcId: '',
        fiscalYear: CURRENT_YEAR,
        quarter: '' as '' | number,
        expenditureType: 'CAPEX' as 'CAPEX' | 'OPEX',
        category: 'NETWORK_INFRA',
        allocatedAmount: '',
        description: '',
    });

    // ── Fetch OPMCs ──────────────────────────────────────────────────────────
    const { data: opmcs = [] } = useQuery<OPMC[]>({
        queryKey: ['opmcs'],
        queryFn: async () => {
            const res = await fetch('/api/opmcs', { cache: 'no-store' });
            const json = await res.json() as { data?: OPMC[]; items?: OPMC[] };
            return json.data ?? json.items ?? [];
        },
    });

    React.useEffect(() => {
        if (opmcs.length > 0 && !filterOpmcId) {
            setFilterOpmcId(opmcs[0].id);
            setForm((f) => ({ ...f, opmcId: opmcs[0].id }));
        }
    }, [opmcs, filterOpmcId]);

    // ── Fetch Budgets ─────────────────────────────────────────────────────────
    const {
        data: budgets = [],
        isLoading,
        refetch,
    } = useQuery<Budget[]>({
        queryKey: ['budgets', filterOpmcId, filterFY, filterType],
        queryFn: async () => {
            const params = new URLSearchParams({
                _t: String(Date.now()),
                ...(filterOpmcId && { opmcId: filterOpmcId }),
                ...(filterFY && { fiscalYear: String(filterFY) }),
                ...(filterType && { expenditureType: filterType }),
            });
            const res = await fetch(`/api/finance/budget?${params.toString()}`, {
                cache: 'no-store',
                headers: { 'Cache-Control': 'no-cache' },
            });
            const json = await res.json() as { data?: Budget[] } | Budget[];
            return (Array.isArray(json) ? json : json.data) ?? [];
        },
        enabled: !!filterOpmcId,
    });

    // ── Mutations ─────────────────────────────────────────────────────────────

    const createMutation = useMutation({
        mutationFn: async (data: typeof form) => {
            const res = await fetch('/api/finance/budget', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    opmcId: data.opmcId,
                    fiscalYear: data.fiscalYear,
                    quarter: data.quarter === '' ? undefined : Number(data.quarter),
                    expenditureType: data.expenditureType,
                    category: data.category,
                    allocatedAmount: Number(data.allocatedAmount),
                    description: data.description || undefined,
                }),
            });
            if (!res.ok) {
                const err = await res.json() as { error?: { message?: string } };
                throw new Error(err?.error?.message ?? 'Failed to create budget');
            }
            return res.json();
        },
        onSuccess: () => {
            toast.success('Budget allocation created successfully');
            setCreateOpen(false);
            setForm((f) => ({ ...f, allocatedAmount: '', description: '' }));
            void queryClient.invalidateQueries({ queryKey: ['budgets'] });
        },
        onError: (err: Error) => toast.error(err.message),
    });

    const deleteMutation = useMutation({
        mutationFn: async (id: string) => {
            const res = await fetch(`/api/finance/budget/${id}`, { method: 'DELETE' });
            if (!res.ok) throw new Error('Failed to freeze budget');
            return res.json();
        },
        onSuccess: (_, id) => {
            toast.success('Budget frozen successfully');
            setDeleteId(null);
            queryClient.setQueryData<Budget[]>(
                ['budgets', filterOpmcId, filterFY, filterType],
                (prev) => prev?.map((b) => b.id === id ? { ...b, status: 'FROZEN' } : b) ?? []
            );
        },
        onError: (err: Error) => toast.error(err.message),
    });

    const handleCreate = useCallback(() => {
        if (!form.opmcId || !form.allocatedAmount || Number(form.allocatedAmount) <= 0) {
            toast.error('Please fill in all required fields');
            return;
        }
        createMutation.mutate(form);
    }, [form, createMutation]);

    // ── Summary Stats ─────────────────────────────────────────────────────────
    const capexTotal = budgets.filter((b) => b.expenditureType === 'CAPEX' && b.status === 'ACTIVE').reduce((s, b) => s + b.allocatedAmount, 0);
    const opexTotal  = budgets.filter((b) => b.expenditureType === 'OPEX'  && b.status === 'ACTIVE').reduce((s, b) => s + b.allocatedAmount, 0);

    const selectedOpmc = opmcs.find((o) => o.id === filterOpmcId);

    return (
        <RoleGuard allowedRoles={[...ROLE_GROUPS.ADMINS, ...ROLE_GROUPS.FINANCE, 'OSP_MANAGER']}>
            <div className="flex h-screen bg-slate-950 text-slate-100 overflow-hidden">
                <Sidebar />
                <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                    <Header />

                    <main className="flex-1 overflow-y-auto p-6 space-y-6">
                        {/* ── Page Header ──────────────────────────────────────── */}
                        <div className="flex flex-wrap items-start justify-between gap-4">
                            <div>
                                <div className="flex items-center gap-2 mb-1">
                                    <Badge className="bg-blue-600 text-white font-mono text-[10px] uppercase tracking-wider">Finance Module</Badge>
                                    <Badge variant="outline" className="border-slate-700 text-slate-400 text-[10px]">Budget Governance</Badge>
                                </div>
                                <h1 className="text-2xl font-black tracking-tight text-white flex items-center gap-2">
                                    <PieIcon className="w-6 h-6 text-blue-400" />
                                    Budget Allocations
                                </h1>
                                <p className="text-sm text-slate-400 mt-1">
                                    Manage CAPEX &amp; OPEX annual budget allocations per OPMC
                                    {selectedOpmc && <span className="ml-2 text-blue-400 font-medium">· {selectedOpmc.name} ({selectedOpmc.rtom})</span>}
                                </p>
                            </div>

                            <div className="flex items-center gap-3 flex-wrap">
                                {/* OPMC */}
                                <Select value={filterOpmcId} onValueChange={setFilterOpmcId}>
                                    <SelectTrigger id="budget-opmc" className="w-52 bg-slate-900 border-slate-700 text-white text-sm">
                                        <SelectValue placeholder="Select OPMC" />
                                    </SelectTrigger>
                                    <SelectContent className="bg-slate-900 border-slate-700 text-white">
                                        {opmcs.map((o) => (
                                            <SelectItem key={o.id} value={o.id}>{o.name} ({o.rtom})</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>

                                {/* FY */}
                                <Select value={String(filterFY)} onValueChange={(v) => setFilterFY(Number(v))}>
                                    <SelectTrigger id="budget-fy" className="w-32 bg-slate-900 border-slate-700 text-white text-sm">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="bg-slate-900 border-slate-700 text-white">
                                        {FISCAL_YEARS.map((y) => (
                                            <SelectItem key={y} value={String(y)}>FY {y}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>

                                {/* Type Filter */}
                                <Select value={filterType || 'ALL'} onValueChange={(v) => setFilterType(v === 'ALL' ? '' : v)}>
                                    <SelectTrigger id="budget-type" className="w-32 bg-slate-900 border-slate-700 text-white text-sm">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="bg-slate-900 border-slate-700 text-white">
                                        <SelectItem value="ALL">All Types</SelectItem>
                                        <SelectItem value="CAPEX">CAPEX</SelectItem>
                                        <SelectItem value="OPEX">OPEX</SelectItem>
                                    </SelectContent>
                                </Select>

                                <Button id="refresh-budgets" size="sm" variant="outline" onClick={() => void refetch()} className="border-slate-700 text-slate-300 hover:bg-slate-800">
                                    <RefreshCw className="w-4 h-4 mr-1.5" />
                                    Refresh
                                </Button>
                                <Button id="create-budget" size="sm" onClick={() => setCreateOpen(true)} className="bg-blue-600 hover:bg-blue-700 text-white">
                                    <Plus className="w-4 h-4 mr-1.5" />
                                    New Allocation
                                </Button>
                            </div>
                        </div>

                        {/* ── Summary Cards ─────────────────────────────────────── */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div className="rounded-xl border border-emerald-800/50 bg-emerald-950/20 p-4">
                                <p className="text-xs text-emerald-400 uppercase tracking-widest mb-1">CAPEX Budget</p>
                                <p className="text-xl font-black text-white">{formatLKR(capexTotal)}</p>
                                <p className="text-xs text-slate-500 mt-0.5">Active allocations</p>
                            </div>
                            <div className="rounded-xl border border-blue-800/50 bg-blue-950/20 p-4">
                                <p className="text-xs text-blue-400 uppercase tracking-widest mb-1">OPEX Budget</p>
                                <p className="text-xl font-black text-white">{formatLKR(opexTotal)}</p>
                                <p className="text-xs text-slate-500 mt-0.5">Active allocations</p>
                            </div>
                            <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
                                <p className="text-xs text-slate-400 uppercase tracking-widest mb-1">Total Budget</p>
                                <p className="text-xl font-black text-white">{formatLKR(capexTotal + opexTotal)}</p>
                                <p className="text-xs text-slate-500 mt-0.5">FY {filterFY}</p>
                            </div>
                            <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
                                <p className="text-xs text-slate-400 uppercase tracking-widest mb-1">Allocations</p>
                                <p className="text-xl font-black text-white">{budgets.filter((b) => b.status === 'ACTIVE').length}</p>
                                <p className="text-xs text-slate-500 mt-0.5">{budgets.filter((b) => b.status === 'FROZEN').length} frozen</p>
                            </div>
                        </div>

                        {/* ── Budget Table ──────────────────────────────────────── */}
                        <div className="rounded-xl border border-slate-800 bg-slate-900 overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b border-slate-800 text-xs text-slate-400 uppercase tracking-widest bg-slate-900/50">
                                            <th className="px-5 py-3 text-left">Category</th>
                                            <th className="px-5 py-3 text-left">Type</th>
                                            <th className="px-5 py-3 text-left">Period</th>
                                            <th className="px-5 py-3 text-right">Allocated Amount</th>
                                            <th className="px-5 py-3 text-left">Description</th>
                                            <th className="px-5 py-3 text-left">Status</th>
                                            <th className="px-5 py-3 text-center">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-800/50">
                                        {isLoading ? (
                                            <tr><td colSpan={7} className="px-5 py-10 text-center text-slate-500 text-xs">Loading budget allocations...</td></tr>
                                        ) : budgets.length === 0 ? (
                                            <tr>
                                                <td colSpan={7} className="px-5 py-12 text-center">
                                                    <div className="flex flex-col items-center gap-3">
                                                        <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center">
                                                            <PieIcon className="w-6 h-6 text-slate-600" />
                                                        </div>
                                                        <p className="text-slate-500 text-sm">No budget allocations for FY {filterFY}</p>
                                                        <Button size="sm" onClick={() => setCreateOpen(true)} className="bg-blue-600 hover:bg-blue-700 text-white">
                                                            <Plus className="w-4 h-4 mr-1.5" />
                                                            Create First Allocation
                                                        </Button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ) : (
                                            budgets.map((b) => (
                                                <tr key={b.id} className="hover:bg-slate-800/40 transition-colors">
                                                    <td className="px-5 py-3 font-medium text-white">
                                                        {SPEND_CATEGORIES.find((c) => c.value === b.category)?.label ?? b.category}
                                                    </td>
                                                    <td className="px-5 py-3">
                                                        <Badge className={`text-[10px] ${b.expenditureType === 'CAPEX' ? 'bg-emerald-600/20 text-emerald-300 border border-emerald-700' : 'bg-blue-600/20 text-blue-300 border border-blue-700'}`}>
                                                            {b.expenditureType}
                                                        </Badge>
                                                    </td>
                                                    <td className="px-5 py-3 text-slate-400 text-xs">
                                                        FY {b.fiscalYear}{b.quarter ? ` · Q${b.quarter}` : ' · Full Year'}
                                                    </td>
                                                    <td className="px-5 py-3 text-right font-bold text-white">{formatLKR(b.allocatedAmount)}</td>
                                                    <td className="px-5 py-3 text-slate-400 text-xs max-w-xs truncate">{b.description ?? '—'}</td>
                                                    <td className="px-5 py-3">
                                                        <Badge className={`text-[10px] ${STATUS_CONFIG[b.status]?.className ?? ''}`}>
                                                            {STATUS_CONFIG[b.status]?.label ?? b.status}
                                                        </Badge>
                                                    </td>
                                                    <td className="px-5 py-3 text-center">
                                                        {b.status !== 'FROZEN' && (
                                                            <Button
                                                                id={`freeze-budget-${b.id}`}
                                                                size="sm"
                                                                variant="ghost"
                                                                className="text-slate-400 hover:text-red-400 hover:bg-red-950/30 h-8 px-2"
                                                                onClick={() => setDeleteId(b.id)}
                                                            >
                                                                <Lock className="w-3.5 h-3.5 mr-1" />
                                                                Freeze
                                                            </Button>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </main>
                </div>
            </div>

            {/* ── Create Budget Dialog ──────────────────────────────────────── */}
            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                <DialogContent className="bg-slate-900 border-slate-800 text-white max-w-md">
                    <DialogHeader>
                        <DialogTitle className="text-white flex items-center gap-2">
                            <Plus className="w-5 h-5 text-blue-400" />
                            New Budget Allocation
                        </DialogTitle>
                        <DialogDescription className="text-slate-400">
                            Create a CAPEX or OPEX budget allocation for a specific category and period.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-2">
                        {/* OPMC */}
                        <div className="space-y-1.5">
                            <label className="text-xs text-slate-400 uppercase tracking-wider">OPMC *</label>
                            <Select value={form.opmcId} onValueChange={(v) => setForm((f) => ({ ...f, opmcId: v }))}>
                                <SelectTrigger id="form-opmc" className="bg-slate-800 border-slate-700 text-white">
                                    <SelectValue placeholder="Select OPMC" />
                                </SelectTrigger>
                                <SelectContent className="bg-slate-800 border-slate-700 text-white">
                                    {opmcs.map((o) => (
                                        <SelectItem key={o.id} value={o.id}>{o.name} ({o.rtom})</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* FY + Quarter */}
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <label className="text-xs text-slate-400 uppercase tracking-wider">Fiscal Year *</label>
                                <Select value={String(form.fiscalYear)} onValueChange={(v) => setForm((f) => ({ ...f, fiscalYear: Number(v) }))}>
                                    <SelectTrigger id="form-fy" className="bg-slate-800 border-slate-700 text-white">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="bg-slate-800 border-slate-700 text-white">
                                        {FISCAL_YEARS.map((y) => (
                                            <SelectItem key={y} value={String(y)}>FY {y}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs text-slate-400 uppercase tracking-wider">Quarter</label>
                                <Select value={String(form.quarter)} onValueChange={(v) => setForm((f) => ({ ...f, quarter: v === '' ? '' : Number(v) }))}>
                                    <SelectTrigger id="form-quarter" className="bg-slate-800 border-slate-700 text-white">
                                        <SelectValue placeholder="Full Year" />
                                    </SelectTrigger>
                                    <SelectContent className="bg-slate-800 border-slate-700 text-white">
                                        <SelectItem value="">Full Year</SelectItem>
                                        <SelectItem value="1">Q1 (Jan-Mar)</SelectItem>
                                        <SelectItem value="2">Q2 (Apr-Jun)</SelectItem>
                                        <SelectItem value="3">Q3 (Jul-Sep)</SelectItem>
                                        <SelectItem value="4">Q4 (Oct-Dec)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        {/* Type */}
                        <div className="space-y-1.5">
                            <label className="text-xs text-slate-400 uppercase tracking-wider">Expenditure Type *</label>
                            <div className="grid grid-cols-2 gap-2">
                                {(['CAPEX', 'OPEX'] as const).map((t) => (
                                    <button
                                        id={`type-${t}`}
                                        key={t}
                                        onClick={() => setForm((f) => ({ ...f, expenditureType: t }))}
                                        className={`py-2.5 rounded-lg border text-sm font-semibold transition-all ${
                                            form.expenditureType === t
                                                ? t === 'CAPEX'
                                                    ? 'border-emerald-600 bg-emerald-600/20 text-emerald-300'
                                                    : 'border-blue-600 bg-blue-600/20 text-blue-300'
                                                : 'border-slate-700 text-slate-400 hover:border-slate-600'
                                        }`}
                                    >
                                        {t}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Category */}
                        <div className="space-y-1.5">
                            <label className="text-xs text-slate-400 uppercase tracking-wider">Category *</label>
                            <Select value={form.category} onValueChange={(v) => setForm((f) => ({ ...f, category: v }))}>
                                <SelectTrigger id="form-category" className="bg-slate-800 border-slate-700 text-white">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="bg-slate-800 border-slate-700 text-white">
                                    {SPEND_CATEGORIES.map((c) => (
                                        <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Amount */}
                        <div className="space-y-1.5">
                            <label className="text-xs text-slate-400 uppercase tracking-wider">Allocated Amount (LKR) *</label>
                            <Input
                                id="form-amount"
                                type="number"
                                min={0}
                                value={form.allocatedAmount}
                                onChange={(e) => setForm((f) => ({ ...f, allocatedAmount: e.target.value }))}
                                placeholder="e.g. 10000000"
                                className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-600"
                            />
                            {form.allocatedAmount && Number(form.allocatedAmount) >= 1000 && (
                                <p className="text-xs text-emerald-400">= {formatLKR(Number(form.allocatedAmount))}</p>
                            )}
                        </div>

                        {/* Description */}
                        <div className="space-y-1.5">
                            <label className="text-xs text-slate-400 uppercase tracking-wider">Description</label>
                            <Input
                                id="form-description"
                                value={form.description}
                                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                                placeholder="e.g. Fiber expansion budget Q1 2025"
                                className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-600"
                            />
                        </div>
                    </div>

                    <DialogFooter className="gap-2">
                        <Button variant="outline" onClick={() => setCreateOpen(false)} className="border-slate-700 text-slate-300">
                            Cancel
                        </Button>
                        <Button
                            id="submit-budget"
                            onClick={handleCreate}
                            disabled={createMutation.isPending}
                            className="bg-blue-600 hover:bg-blue-700 text-white"
                        >
                            {createMutation.isPending ? (
                                <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" /> Creating...</>
                            ) : (
                                <><CheckCircle className="w-4 h-4 mr-1.5" />Create Allocation</>
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ── Freeze Confirmation Dialog ────────────────────────────────── */}
            <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
                <AlertDialogContent className="bg-slate-900 border-slate-800 text-white">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2">
                            <Lock className="w-5 h-5 text-amber-400" />
                            Freeze Budget Allocation
                        </AlertDialogTitle>
                        <AlertDialogDescription className="text-slate-400">
                            Freezing will lock this budget allocation. It will no longer accept new changes. This action can be reversed by an administrator.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel className="border-slate-700 text-slate-300 hover:bg-slate-800">Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            id="confirm-freeze"
                            className="bg-amber-600 hover:bg-amber-700 text-white"
                            onClick={() => deleteId && deleteMutation.mutate(deleteId)}
                        >
                            <Lock className="w-4 h-4 mr-1.5" />
                            Freeze Budget
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </RoleGuard>
    );
}

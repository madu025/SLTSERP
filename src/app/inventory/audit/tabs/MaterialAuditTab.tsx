"use client";

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import {
    FileText, RefreshCw, TrendingUp, TrendingDown, DollarSign, PackageCheck
} from 'lucide-react';

interface OPMC {
    id: string;
    name: string;
    rtom: string;
}

interface MaterialAuditItem {
    itemCode: string;
    itemName: string;
    unit: string;
    totalReceivedQty: number;
    totalUsageQty: number;
    totalWastageQty: number;
    totalFaultyQty: number;
    totalUsageAndWastageQty: number;
    calculatedBalanceQty: number;
    totalReceivedCostLkr: number;
    totalUsageCostLkr: number;
    netFinancialVarianceLkr: number;
    discrepancyStatus: 'SURPLUS' | 'DEFICIT' | 'BALANCED';
    recordsCount: number;
}

interface ExecutiveAuditSummary {
    opmcId: string;
    totalReceivedCostLkr: number;
    totalUsageCostLkr: number;
    netDiscrepancyLkr: number;
    itemsAuditedCount: number;
    discrepancyItemsCount: number;
    itemSummaries: MaterialAuditItem[];
}

function formatLKR(amount: number): string {
    if (amount >= 1_000_000) return `LKR ${(amount / 1_000_000).toFixed(2)}M`;
    if (amount >= 1_000)     return `LKR ${(amount / 1_000).toFixed(1)}K`;
    return `LKR ${amount.toFixed(0)}`;
}

function formatCompact(amount: number): string {
    if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(1)}M`;
    if (amount >= 1_000)     return `${(amount / 1_000).toFixed(0)}K`;
    return `${amount}`;
}

export default function MaterialAuditTab() {
    const [selectedOpmcId, setSelectedOpmcId] = useState<string>('');

    // Fetch OPMCs
    const { data: opmcs = [] } = useQuery<OPMC[]>({
        queryKey: ['opmcs'],
        queryFn: async () => {
            const res = await fetch('/api/opmcs', { cache: 'no-store' });
            const json = await res.json() as { data?: OPMC[]; items?: OPMC[] };
            return json.data ?? json.items ?? [];
        },
    });

    // Fetch Audit Summary
    const { data: auditSummary, isLoading, refetch } = useQuery<ExecutiveAuditSummary>({
        queryKey: ['material-audit-summary', selectedOpmcId],
        queryFn: async () => {
            const params = new URLSearchParams({
                _t: String(Date.now()),
                ...(selectedOpmcId && { opmcId: selectedOpmcId }),
            });
            const res = await fetch(`/api/inventory/pre-erp-reconciliation/summary?${params.toString()}`, {
                cache: 'no-store',
                headers: { 'Cache-Control': 'no-cache' },
            });
            return res.json();
        },
    });

    const chartData = (auditSummary?.itemSummaries ?? []).map((item) => ({
        name: item.itemName,
        received: item.totalReceivedCostLkr,
        usage: item.totalUsageCostLkr,
    }));

    return (
        <div className="space-y-6">
            {/* Control & Header Toolbar */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-slate-950 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                <div>
                    <h2 className="text-base font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                        <FileText className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                        Executive Material Reconciliation Audit
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                        Cumulative Material Received vs Consumed Analysis across regional stores and OPMCs.
                    </p>
                </div>

                <div className="flex items-center gap-3 w-full sm:w-auto">
                    <Select value={selectedOpmcId || 'ALL'} onValueChange={(v) => setSelectedOpmcId(v === 'ALL' ? '' : v)}>
                        <SelectTrigger className="w-full sm:w-56 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 text-xs font-bold h-9">
                            <SelectValue placeholder="Scope: All Island" />
                        </SelectTrigger>
                        <SelectContent className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200">
                            <SelectItem value="ALL">All Island / Main Store</SelectItem>
                            {opmcs.map((o) => (
                                <SelectItem key={o.id} value={o.id}>{o.name} ({o.rtom})</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    <Button size="sm" variant="outline" onClick={() => void refetch()} className="border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-900 text-xs font-bold h-9 gap-1.5 shrink-0">
                        <RefreshCw className="w-3.5 h-3.5" />
                        Refresh
                    </Button>
                </div>
            </div>

            {/* Executive KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-4 shadow-sm">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Total Received</span>
                        <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400"><DollarSign className="w-4 h-4" /></div>
                    </div>
                    <p className="text-xl font-bold font-mono text-emerald-700 dark:text-emerald-400 mt-2">
                        {isLoading ? '...' : formatLKR(auditSummary?.totalReceivedCostLkr ?? 0)}
                    </p>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 block">Cumulative Material Receipts</span>
                </div>

                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-4 shadow-sm">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Total Consumed</span>
                        <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400"><TrendingUp className="w-4 h-4" /></div>
                    </div>
                    <p className="text-xl font-bold font-mono text-blue-700 dark:text-blue-400 mt-2">
                        {isLoading ? '...' : formatLKR(auditSummary?.totalUsageCostLkr ?? 0)}
                    </p>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 block">Deployments + Wastage</span>
                </div>

                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-4 shadow-sm">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Net Variance</span>
                        <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400"><TrendingDown className="w-4 h-4" /></div>
                    </div>
                    <p className="text-xl font-bold font-mono text-amber-700 dark:text-amber-400 mt-2">
                        {isLoading ? '...' : formatLKR(auditSummary?.netDiscrepancyLkr ?? 0)}
                    </p>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 block">Net Financial Balance Value</span>
                </div>

                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-4 shadow-sm">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Audited Items</span>
                        <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-900 text-slate-700 dark:text-slate-300"><PackageCheck className="w-4 h-4" /></div>
                    </div>
                    <p className="text-xl font-bold font-mono text-slate-900 dark:text-white mt-2">
                        {isLoading ? '...' : `${auditSummary?.itemsAuditedCount ?? 0} Items`}
                    </p>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 block">100% Pre-ERP Legacy Coverage</span>
                </div>
            </div>

            {/* Chart */}
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-5 shadow-sm w-full min-w-0">
                <h3 className="text-xs font-black uppercase text-slate-900 dark:text-white tracking-wider mb-4">Financial Value Comparison: Received vs Consumed (LKR)</h3>
                <ResponsiveContainer width="100%" height={260} minWidth={0}>
                    <BarChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 60 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 10 }} angle={-35} textAnchor="end" interval={0} />
                        <YAxis tickFormatter={formatCompact} tick={{ fill: '#64748b', fontSize: 11 }} />
                        <Tooltip formatter={(v: unknown) => formatLKR(Number(v))} />
                        <Legend wrapperStyle={{ fontSize: 12, color: '#64748b' }} />
                        <Bar dataKey="received" name="Received Cost (LKR)" fill="#059669" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="usage" name="Usage Cost (LKR)" fill="#2563eb" radius={[4, 4, 0, 0]} />
                    </BarChart>
                </ResponsiveContainer>
            </div>

            {/* Item Discrepancy Breakdown Table */}
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 overflow-hidden shadow-sm">
                <div className="px-5 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
                    <h3 className="text-xs font-black uppercase text-slate-900 dark:text-white tracking-wider">Item-by-Item Reconciliation Summary</h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-xs font-sans text-left">
                        <thead>
                            <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900/80 text-[10px] text-slate-500 uppercase font-bold tracking-wider">
                                <th className="px-4 py-3">Material Item</th>
                                <th className="px-4 py-3 text-right text-emerald-600 dark:text-emerald-400">Total Received</th>
                                <th className="px-4 py-3 text-right text-blue-600 dark:text-blue-400">Total Usage</th>
                                <th className="px-4 py-3 text-right text-rose-600 dark:text-rose-400">Wastage</th>
                                <th className="px-4 py-3 text-right font-bold text-amber-600 dark:text-amber-400">Computed Balance</th>
                                <th className="px-4 py-3 text-right text-slate-700 dark:text-slate-300">Usage Cost (LKR)</th>
                                <th className="px-4 py-3 text-left">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 dark:divide-slate-800 bg-white dark:bg-slate-950 font-mono">
                            {isLoading ? (
                                <tr><td colSpan={7} className="px-4 py-12 text-center text-slate-400 text-xs font-sans">Loading audit summary...</td></tr>
                            ) : (auditSummary?.itemSummaries ?? []).map((item) => (
                                <tr key={item.itemCode} className="hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors">
                                    <td className="px-4 py-3 font-sans">
                                        <p className="font-semibold text-slate-900 dark:text-white">{item.itemName}</p>
                                        <span className="text-[10px] text-slate-400 font-mono">{item.itemCode} ({item.unit})</span>
                                    </td>
                                    <td className="px-4 py-3 text-right text-emerald-600 dark:text-emerald-400 font-bold">{item.totalReceivedQty.toLocaleString()}</td>
                                    <td className="px-4 py-3 text-right text-blue-600 dark:text-blue-400 font-semibold">{item.totalUsageQty.toLocaleString()}</td>
                                    <td className="px-4 py-3 text-right text-rose-600 dark:text-rose-400 font-semibold">{item.totalWastageQty.toLocaleString()}</td>
                                    <td className={`px-4 py-3 text-right font-bold ${item.calculatedBalanceQty < 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                                        {item.calculatedBalanceQty.toLocaleString()}
                                    </td>
                                    <td className="px-4 py-3 text-right text-slate-700 dark:text-slate-300 font-semibold">{formatLKR(item.totalUsageCostLkr)}</td>
                                    <td className="px-4 py-3 font-sans">
                                        <Badge className={`text-[10px] ${
                                            item.discrepancyStatus === 'SURPLUS' ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800' :
                                            item.discrepancyStatus === 'DEFICIT' ? 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/30 dark:text-rose-400 dark:border-rose-800' :
                                            'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
                                        }`}>
                                            {item.discrepancyStatus}
                                        </Badge>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

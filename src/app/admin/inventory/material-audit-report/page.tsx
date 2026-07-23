"use client";

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import RoleGuard from '@/components/RoleGuard';
import { ROLE_GROUPS } from '@/config/sidebar-menu';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import {
    FileText, RefreshCw, AlertTriangle, TrendingUp, TrendingDown, DollarSign, PackageCheck
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

export default function MaterialAuditReportPage() {
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
        <RoleGuard allowedRoles={[...ROLE_GROUPS.ADMINS, ...ROLE_GROUPS.STORES, 'FINANCE_MANAGER']}>
            <div className="flex h-screen bg-slate-50 text-slate-900 overflow-hidden">
                <Sidebar />
                <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                    <Header />

                    <main className="flex-1 overflow-y-auto p-6 space-y-6">
                        {/* Header */}
                        <div className="flex flex-wrap items-start justify-between gap-4">
                            <div>
                                <div className="flex items-center gap-2 mb-1">
                                    <Badge className="bg-amber-100 text-amber-800 border border-amber-300 font-mono text-[10px] uppercase">Executive Report</Badge>
                                    <Badge variant="outline" className="border-slate-300 text-slate-600 text-[10px]">Pre-ERP Opening Audit</Badge>
                                </div>
                                <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
                                    <FileText className="w-6 h-6 text-amber-600" />
                                    Material Reconciliation Audit Report
                                </h1>
                                <p className="text-sm text-slate-500 mt-1">
                                    Executive Cumulative Material Received vs Consumed Analysis across 21 Months
                                </p>
                            </div>

                            <div className="flex items-center gap-3">
                                <Select value={selectedOpmcId || 'ALL'} onValueChange={(v) => setSelectedOpmcId(v === 'ALL' ? '' : v)}>
                                    <SelectTrigger className="w-56 bg-white border-slate-300 text-slate-800 text-sm font-medium">
                                        <SelectValue placeholder="Scope: All Island" />
                                    </SelectTrigger>
                                    <SelectContent className="bg-white border-slate-200 text-slate-800">
                                        <SelectItem value="ALL">All Island / Main Central Store</SelectItem>
                                        {opmcs.map((o) => (
                                            <SelectItem key={o.id} value={o.id}>{o.name} ({o.rtom})</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>

                                <Button size="sm" variant="outline" onClick={() => void refetch()} className="border-slate-300 text-slate-700 hover:bg-slate-100 font-semibold">
                                    <RefreshCw className="w-4 h-4 mr-1.5" />
                                    Refresh Report
                                </Button>
                            </div>
                        </div>

                        {/* Executive KPI Cards */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Received Value</span>
                                    <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600"><DollarSign className="w-4 h-4" /></div>
                                </div>
                                <p className="text-xl font-bold font-mono text-emerald-700 mt-2">
                                    {isLoading ? '...' : formatLKR(auditSummary?.totalReceivedCostLkr ?? 0)}
                                </p>
                                <span className="text-[11px] text-slate-500 mt-1 block">Cumulative SLT Material Receipts</span>
                            </div>

                            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Consumed Value</span>
                                    <div className="p-2 rounded-lg bg-blue-50 text-blue-600"><TrendingUp className="w-4 h-4" /></div>
                                </div>
                                <p className="text-xl font-bold font-mono text-blue-700 mt-2">
                                    {isLoading ? '...' : formatLKR(auditSummary?.totalUsageCostLkr ?? 0)}
                                </p>
                                <span className="text-[11px] text-slate-500 mt-1 block">Field Deployments + Wastage</span>
                            </div>

                            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Net Financial Balance</span>
                                    <div className="p-2 rounded-lg bg-amber-50 text-amber-600"><TrendingDown className="w-4 h-4" /></div>
                                </div>
                                <p className="text-xl font-bold font-mono text-amber-700 mt-2">
                                    {isLoading ? '...' : formatLKR(auditSummary?.netDiscrepancyLkr ?? 0)}
                                </p>
                                <span className="text-[11px] text-slate-500 mt-1 block">Net Surplus Material Value</span>
                            </div>

                            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Audited Categories</span>
                                    <div className="p-2 rounded-lg bg-slate-100 text-slate-700"><PackageCheck className="w-4 h-4" /></div>
                                </div>
                                <p className="text-xl font-bold font-mono text-slate-900 mt-2">
                                    {isLoading ? '...' : `${auditSummary?.itemsAuditedCount ?? 0} Items`}
                                </p>
                                <span className="text-[11px] text-slate-500 mt-1 block">100% Pre-ERP Legacy Coverage</span>
                            </div>
                        </div>

                        {/* Chart */}
                        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                            <h2 className="text-sm font-bold text-slate-900 mb-4">Financial Value Comparison: Received vs Consumed (LKR)</h2>
                            <ResponsiveContainer width="100%" height={260}>
                                <BarChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 60 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                                    <XAxis dataKey="name" tick={{ fill: '#475569', fontSize: 10 }} angle={-35} textAnchor="end" interval={0} />
                                    <YAxis tickFormatter={formatCompact} tick={{ fill: '#475569', fontSize: 11 }} />
                                    <Tooltip formatter={(v: unknown) => formatLKR(Number(v))} />
                                    <Legend wrapperStyle={{ fontSize: 12, color: '#475569' }} />
                                    <Bar dataKey="received" name="Received Cost (LKR)" fill="#059669" radius={[4, 4, 0, 0]} />
                                    <Bar dataKey="usage" name="Usage Cost (LKR)" fill="#2563eb" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>

                        {/* Item Discrepancy Breakdown Table */}
                        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
                            <div className="px-5 py-4 border-b border-slate-200 bg-slate-50">
                                <h2 className="text-sm font-bold text-slate-900">Item-by-Item Reconciliation Summary</h2>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm border-collapse">
                                    <thead>
                                        <tr className="border-b border-slate-200 bg-slate-100 text-xs text-slate-700 font-bold uppercase">
                                            <th className="px-4 py-3 text-left">Material Item</th>
                                            <th className="px-4 py-3 text-right text-emerald-800">Total Received</th>
                                            <th className="px-4 py-3 text-right text-blue-800">Total Usage</th>
                                            <th className="px-4 py-3 text-right text-rose-800">Wastage</th>
                                            <th className="px-4 py-3 text-right font-bold text-amber-800">Computed Balance</th>
                                            <th className="px-4 py-3 text-right text-slate-800">Usage Cost (LKR)</th>
                                            <th className="px-4 py-3 text-left text-slate-700">Discrepancy Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-200 font-mono">
                                        {isLoading ? (
                                            <tr><td colSpan={7} className="px-4 py-10 text-center text-slate-500 text-xs font-sans">Loading audit summary...</td></tr>
                                        ) : (auditSummary?.itemSummaries ?? []).map((item) => (
                                            <tr key={item.itemCode} className="hover:bg-slate-50 transition-colors">
                                                <td className="px-4 py-3 font-sans">
                                                    <p className="font-semibold text-slate-900">{item.itemName}</p>
                                                    <span className="text-[10px] text-slate-500 font-mono">{item.itemCode} ({item.unit})</span>
                                                </td>
                                                <td className="px-4 py-3 text-right text-emerald-800 font-bold">{item.totalReceivedQty.toLocaleString()}</td>
                                                <td className="px-4 py-3 text-right text-blue-800 font-semibold">{item.totalUsageQty.toLocaleString()}</td>
                                                <td className="px-4 py-3 text-right text-rose-800 font-semibold">{item.totalWastageQty.toLocaleString()}</td>
                                                <td className={`px-4 py-3 text-right font-bold ${item.calculatedBalanceQty < 0 ? 'text-rose-700' : 'text-emerald-700'}`}>
                                                    {item.calculatedBalanceQty.toLocaleString()}
                                                </td>
                                                <td className="px-4 py-3 text-right text-slate-700 font-semibold">{formatLKR(item.totalUsageCostLkr)}</td>
                                                <td className="px-4 py-3 font-sans">
                                                    <Badge className={`text-[10px] ${
                                                        item.discrepancyStatus === 'SURPLUS' ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' :
                                                        item.discrepancyStatus === 'DEFICIT' ? 'bg-rose-100 text-rose-800 border border-rose-300' :
                                                        'bg-slate-100 text-slate-700 border border-slate-300'
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
                    </main>
                </div>
            </div>
        </RoleGuard>
    );
}

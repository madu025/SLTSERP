"use client";

import React, { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import RoleGuard from '@/components/RoleGuard';
import { ROLE_GROUPS } from '@/config/sidebar-menu';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
    BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
    XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import {
    TrendingUp, TrendingDown, AlertTriangle, RefreshCw,
    DollarSign, Building2, Zap, PieChart as PieIcon,
    BarChart2, Activity, ArrowUpRight, ArrowDownRight,
} from 'lucide-react';
import { toast } from 'sonner';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface BudgetVsActualItem {
    category: string;
    expenditureType: 'CAPEX' | 'OPEX';
    allocated: number;
    actual: number;
    variance: number;
    utilizationPct: number;
    isAlert: boolean;
}

interface KpiPanel {
    capexRatio: number;
    opexRatio: number;
    totalSpend: number;
    avgMonthlyBurn: number;
    currentQuarterSpend: number;
}

interface SummaryData {
    capex: { budgeted: number; actual: number; variance: number; utilizationPct: number };
    opex:  { budgeted: number; actual: number; variance: number; utilizationPct: number };
    breakdown: BudgetVsActualItem[];
    alerts: BudgetVsActualItem[];
    kpi: KpiPanel;
    topExpenses: { id: string; description: string; amount: number; category: string; expenditureType: string; transactionDate: string }[];
}

interface TrendPoint {
    month: string;
    label: string;
    capex: number;
    opex: number;
}

interface OPMC {
    id: string;
    name: string;
    rtom: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const CAPEX_COLOR = '#10b981'; // emerald-500
const OPEX_COLOR  = '#3b82f6'; // blue-500
const ALERT_COLOR = '#ef4444'; // red-500

const CATEGORY_LABELS: Record<string, string> = {
    NETWORK_INFRA:       'Network Infrastructure',
    MAINTENANCE:         'Maintenance',
    CONTRACTOR_PAYMENT:  'Contractor Payments',
    PETTY_CASH:          'Petty Cash',
    VEHICLE:             'Vehicle / Transport',
    EQUIPMENT:           'Equipment',
    OTHER:               'Other',
};

const CURRENT_YEAR = new Date().getFullYear();
const FISCAL_YEARS = Array.from({ length: 5 }, (_, i) => CURRENT_YEAR - 2 + i);

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

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

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

function KpiCard({ label, value, sub, icon: Icon, color, trend }: {
    label: string;
    value: string;
    sub?: string;
    icon: React.ComponentType<{ className?: string }>;
    color: string;
    trend?: 'up' | 'down' | 'neutral';
}) {
    return (
        <div className={`relative overflow-hidden rounded-xl border bg-slate-900 p-5 flex flex-col gap-3 border-slate-800 hover:border-slate-700 transition-colors`}>
            <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-widest">{label}</span>
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${color}`}>
                    <Icon className="w-5 h-5" />
                </div>
            </div>
            <div>
                <p className="text-2xl font-black text-white">{value}</p>
                {sub && (
                    <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                        {trend === 'up' && <ArrowUpRight className="w-3 h-3 text-emerald-400" />}
                        {trend === 'down' && <ArrowDownRight className="w-3 h-3 text-red-400" />}
                        {sub}
                    </p>
                )}
            </div>
            {/* Subtle glow */}
            <div className={`absolute -bottom-4 -right-4 w-24 h-24 rounded-full opacity-5 blur-xl ${color}`} />
        </div>
    );
}

function UtilizationBar({ pct, isAlert }: { pct: number; isAlert: boolean }) {
    const color = isAlert ? 'bg-red-500' : pct > 70 ? 'bg-amber-500' : 'bg-emerald-500';
    return (
        <div className="w-full bg-slate-800 rounded-full h-2">
            <div
                className={`${color} h-2 rounded-full transition-all duration-500`}
                style={{ width: `${Math.min(pct, 100)}%` }}
            />
        </div>
    );
}

const CustomTooltip = ({ active, payload, label }: Record<string, unknown>) => {
    if (!active || !Array.isArray(payload) || payload.length === 0) return null;
    return (
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-3 shadow-xl text-sm">
            <p className="font-semibold text-white mb-2">{String(label)}</p>
            {(payload as { name: string; value: number; color: string }[]).map((p) => (
                <p key={p.name} className="flex justify-between gap-6" style={{ color: p.color }}>
                    <span>{p.name}</span>
                    <span className="font-bold">{formatLKR(p.value)}</span>
                </p>
            ))}
        </div>
    );
};

// ─────────────────────────────────────────────────────────────────────────────
// Main Page Component
// ─────────────────────────────────────────────────────────────────────────────

export default function CapexOpexDashboardPage() {
    const [fiscalYear, setFiscalYear] = useState<number>(CURRENT_YEAR);
    const [selectedOpmcId, setSelectedOpmcId] = useState<string>('');
    const [activeChart, setActiveChart] = useState<'bar' | 'line' | 'pie'>('bar');

    // ── Fetch OPMCs ──────────────────────────────────────────────────────────
    const { data: opmcs = [] } = useQuery<OPMC[]>({
        queryKey: ['opmcs'],
        queryFn: async () => {
            const res = await fetch('/api/opmcs', { cache: 'no-store' });
            const json = await res.json() as { data?: OPMC[]; items?: OPMC[] };
            return json.data ?? json.items ?? [];
        },
    });

    // Set default OPMC once loaded
    React.useEffect(() => {
        if (opmcs.length > 0 && !selectedOpmcId) {
            setSelectedOpmcId(opmcs[0].id);
        }
    }, [opmcs, selectedOpmcId]);

    // ── Fetch Summary ─────────────────────────────────────────────────────────
    const {
        data: summary,
        isLoading: summaryLoading,
        refetch: refetchSummary,
        error: summaryError,
    } = useQuery<SummaryData>({
        queryKey: ['capex-opex-summary', selectedOpmcId, fiscalYear],
        queryFn: async () => {
            if (!selectedOpmcId) throw new Error('No OPMC selected');
            const res = await fetch(
                `/api/finance/capex-opex/summary?opmcId=${selectedOpmcId}&fiscalYear=${fiscalYear}&_t=${Date.now()}`,
                { cache: 'no-store', headers: { 'Cache-Control': 'no-cache' } }
            );
            if (!res.ok) throw new Error('Failed to fetch summary');
            const json = await res.json() as { data?: SummaryData } | SummaryData;
            return ('data' in json && json.data) ? json.data : json as SummaryData;
        },
        enabled: !!selectedOpmcId,
        retry: 1,
    });

    // ── Fetch Trend ───────────────────────────────────────────────────────────
    const { data: trendData } = useQuery<{ trend: TrendPoint[] }>({
        queryKey: ['capex-opex-trend', selectedOpmcId, fiscalYear],
        queryFn: async () => {
            if (!selectedOpmcId) throw new Error('No OPMC selected');
            const res = await fetch(
                `/api/finance/capex-opex/trend?opmcId=${selectedOpmcId}&fiscalYear=${fiscalYear}&_t=${Date.now()}`,
                { cache: 'no-store' }
            );
            const json = await res.json() as { data?: { trend: TrendPoint[] } } | { trend: TrendPoint[] };
            return ('data' in json && json.data) ? json.data : json as { trend: TrendPoint[] };
        },
        enabled: !!selectedOpmcId,
    });

    const handleRefresh = useCallback(async () => {
        await refetchSummary();
        toast.success('Dashboard refreshed');
    }, [refetchSummary]);

    // ── Bar chart data: one bar per category, two series (CAPEX/OPEX) ─────────
    const barData = React.useMemo(() => {
        if (!summary?.breakdown) return [];
        const catMap = new Map<string, { category: string; capex: number; opex: number }>();
        for (const item of summary.breakdown) {
            if (!catMap.has(item.category)) {
                catMap.set(item.category, { category: CATEGORY_LABELS[item.category] ?? item.category, capex: 0, opex: 0 });
            }
            const entry = catMap.get(item.category)!;
            if (item.expenditureType === 'CAPEX') entry.capex = item.actual;
            else entry.opex = item.actual;
        }
        return Array.from(catMap.values());
    }, [summary]);

    // ── Donut data ─────────────────────────────────────────────────────────────
    const donutData = React.useMemo(() => {
        if (!summary) return [];
        return [
            { name: 'CAPEX', value: summary.capex.actual, color: CAPEX_COLOR },
            { name: 'OPEX', value: summary.opex.actual, color: OPEX_COLOR },
        ].filter((d) => d.value > 0);
    }, [summary]);

    const selectedOpmc = opmcs.find((o) => o.id === selectedOpmcId);

    return (
        <RoleGuard allowedRoles={[...ROLE_GROUPS.ADMINS, ...ROLE_GROUPS.FINANCE, 'OSP_MANAGER', 'AREA_MANAGER']}>
            <div className="flex h-screen bg-slate-950 text-slate-100 overflow-hidden">
                <Sidebar />
                <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                    <Header />

                    <main className="flex-1 overflow-y-auto p-6 space-y-6">
                        {/* ── Page Header ──────────────────────────────────────── */}
                        <div className="flex flex-wrap items-start justify-between gap-4">
                            <div>
                                <div className="flex items-center gap-2 mb-1">
                                    <Badge className="bg-emerald-600 text-white font-mono text-[10px] uppercase tracking-wider">Finance Module</Badge>
                                    <Badge variant="outline" className="border-slate-700 text-slate-400 text-[10px]">CAPEX / OPEX</Badge>
                                </div>
                                <h1 className="text-2xl font-black tracking-tight text-white flex items-center gap-2">
                                    <TrendingUp className="w-6 h-6 text-emerald-400" />
                                    CAPEX &amp; OPEX Dashboard
                                </h1>
                                <p className="text-sm text-slate-400 mt-1">
                                    Capital &amp; Operational Expenditure Tracking
                                    {selectedOpmc && (
                                        <span className="ml-2 text-emerald-400 font-medium">· {selectedOpmc.name} ({selectedOpmc.rtom})</span>
                                    )}
                                </p>
                            </div>

                            {/* Filters */}
                            <div className="flex items-center gap-3 flex-wrap">
                                {/* OPMC Selector */}
                                <Select value={selectedOpmcId} onValueChange={setSelectedOpmcId}>
                                    <SelectTrigger id="opmc-selector" className="w-52 bg-slate-900 border-slate-700 text-white text-sm">
                                        <SelectValue placeholder="Select OPMC" />
                                    </SelectTrigger>
                                    <SelectContent className="bg-slate-900 border-slate-700 text-white">
                                        {opmcs.map((o) => (
                                            <SelectItem key={o.id} value={o.id}>{o.name} ({o.rtom})</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>

                                {/* Fiscal Year Selector */}
                                <Select value={String(fiscalYear)} onValueChange={(v) => setFiscalYear(Number(v))}>
                                    <SelectTrigger id="fy-selector" className="w-32 bg-slate-900 border-slate-700 text-white text-sm">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="bg-slate-900 border-slate-700 text-white">
                                        {FISCAL_YEARS.map((y) => (
                                            <SelectItem key={y} value={String(y)}>FY {y}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>

                                <Button
                                    id="refresh-dashboard"
                                    size="sm"
                                    variant="outline"
                                    onClick={() => void handleRefresh()}
                                    className="border-slate-700 text-slate-300 hover:bg-slate-800"
                                >
                                    <RefreshCw className="w-4 h-4 mr-1.5" />
                                    Refresh
                                </Button>
                            </div>
                        </div>

                        {/* ── Error State ──────────────────────────────────────── */}
                        {summaryError && (
                            <div className="rounded-xl border border-red-800 bg-red-950/30 p-4 flex items-center gap-3">
                                <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0" />
                                <p className="text-sm text-red-300">Failed to load dashboard data. Please check your selection and try again.</p>
                            </div>
                        )}

                        {/* ── KPI Cards ─────────────────────────────────────────── */}
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                            <KpiCard
                                label="CAPEX Budget"
                                value={summaryLoading ? '...' : formatLKR(summary?.capex.budgeted ?? 0)}
                                sub={`${summary?.capex.utilizationPct ?? 0}% utilized`}
                                icon={Building2}
                                color="bg-emerald-500/20 text-emerald-400"
                                trend="neutral"
                            />
                            <KpiCard
                                label="CAPEX Actual Spend"
                                value={summaryLoading ? '...' : formatLKR(summary?.capex.actual ?? 0)}
                                sub={`Variance: ${formatLKR(summary?.capex.variance ?? 0)}`}
                                icon={TrendingUp}
                                color="bg-emerald-600/20 text-emerald-300"
                                trend={( summary?.capex.variance ?? 0) >= 0 ? 'up' : 'down'}
                            />
                            <KpiCard
                                label="OPEX Budget"
                                value={summaryLoading ? '...' : formatLKR(summary?.opex.budgeted ?? 0)}
                                sub={`${summary?.opex.utilizationPct ?? 0}% utilized`}
                                icon={Zap}
                                color="bg-blue-500/20 text-blue-400"
                                trend="neutral"
                            />
                            <KpiCard
                                label="OPEX Actual Spend"
                                value={summaryLoading ? '...' : formatLKR(summary?.opex.actual ?? 0)}
                                sub={`Monthly burn: ${formatLKR(summary?.kpi.avgMonthlyBurn ?? 0)}`}
                                icon={Activity}
                                color="bg-blue-600/20 text-blue-300"
                                trend={(summary?.opex.variance ?? 0) >= 0 ? 'up' : 'down'}
                            />
                        </div>

                        {/* ── KPI Row 2: CAPEX/OPEX Ratio ──────────────────────── */}
                        {summary?.kpi && (
                            <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
                                <div className="flex items-center justify-between mb-3">
                                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest">CAPEX vs OPEX Ratio</p>
                                    <span className="text-xs text-slate-500">Total: {formatLKR(summary.kpi.totalSpend)}</span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className="text-xs text-emerald-400 font-semibold w-16 text-right">{summary.kpi.capexRatio}% CAPEX</span>
                                    <div className="flex-1 h-4 rounded-full bg-slate-800 overflow-hidden flex">
                                        <div
                                            className="bg-emerald-500 h-full transition-all duration-700"
                                            style={{ width: `${summary.kpi.capexRatio}%` }}
                                        />
                                        <div
                                            className="bg-blue-500 h-full transition-all duration-700"
                                            style={{ width: `${summary.kpi.opexRatio}%` }}
                                        />
                                    </div>
                                    <span className="text-xs text-blue-400 font-semibold w-16">{summary.kpi.opexRatio}% OPEX</span>
                                </div>
                                <div className="flex justify-between mt-2 text-xs text-slate-500">
                                    <span>Current Quarter: {formatLKR(summary.kpi.currentQuarterSpend)}</span>
                                    <span>Avg. Monthly Burn: {formatLKR(summary.kpi.avgMonthlyBurn)}</span>
                                </div>
                            </div>
                        )}

                        {/* ── Charts Section ────────────────────────────────────── */}
                        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                            {/* Chart Toggle + Main Chart */}
                            <div className="xl:col-span-2 rounded-xl border border-slate-800 bg-slate-900 p-5">
                                <div className="flex items-center justify-between mb-5">
                                    <h2 className="text-sm font-bold text-white">
                                        {activeChart === 'bar' && 'Budget vs Actual — by Category'}
                                        {activeChart === 'line' && 'Monthly Spend Trend'}
                                        {activeChart === 'pie' && 'CAPEX / OPEX Proportion'}
                                    </h2>
                                    <div className="flex gap-1 bg-slate-800 rounded-lg p-1">
                                        <button
                                            id="chart-bar"
                                            onClick={() => setActiveChart('bar')}
                                            className={`p-1.5 rounded-md transition-colors ${activeChart === 'bar' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'}`}
                                        >
                                            <BarChart2 className="w-4 h-4" />
                                        </button>
                                        <button
                                            id="chart-line"
                                            onClick={() => setActiveChart('line')}
                                            className={`p-1.5 rounded-md transition-colors ${activeChart === 'line' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'}`}
                                        >
                                            <Activity className="w-4 h-4" />
                                        </button>
                                        <button
                                            id="chart-pie"
                                            onClick={() => setActiveChart('pie')}
                                            className={`p-1.5 rounded-md transition-colors ${activeChart === 'pie' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'}`}
                                        >
                                            <PieIcon className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>

                                {summaryLoading ? (
                                    <div className="h-64 flex items-center justify-center">
                                        <div className="flex flex-col items-center gap-3">
                                            <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                                            <span className="text-xs text-slate-500">Loading chart data...</span>
                                        </div>
                                    </div>
                                ) : (
                                    <ResponsiveContainer width="100%" height={280}>
                                        {activeChart === 'bar' ? (
                                            <BarChart data={barData} margin={{ top: 5, right: 10, left: 10, bottom: 60 }}>
                                                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                                                <XAxis dataKey="category" tick={{ fill: '#94a3b8', fontSize: 10 }} angle={-35} textAnchor="end" interval={0} />
                                                <YAxis tickFormatter={formatCompact} tick={{ fill: '#94a3b8', fontSize: 11 }} />
                                                <Tooltip content={<CustomTooltip />} />
                                                <Legend wrapperStyle={{ paddingTop: 10, fontSize: 12, color: '#94a3b8' }} />
                                                <Bar dataKey="capex" name="CAPEX Actual" fill={CAPEX_COLOR} radius={[4, 4, 0, 0]} />
                                                <Bar dataKey="opex" name="OPEX Actual" fill={OPEX_COLOR} radius={[4, 4, 0, 0]} />
                                            </BarChart>
                                        ) : activeChart === 'line' ? (
                                            <LineChart data={trendData?.trend ?? []} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                                                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                                                <XAxis dataKey="label" tick={{ fill: '#94a3b8', fontSize: 10 }} />
                                                <YAxis tickFormatter={formatCompact} tick={{ fill: '#94a3b8', fontSize: 11 }} />
                                                <Tooltip content={<CustomTooltip />} />
                                                <Legend wrapperStyle={{ fontSize: 12, color: '#94a3b8' }} />
                                                <Line type="monotone" dataKey="capex" name="CAPEX" stroke={CAPEX_COLOR} strokeWidth={2} dot={{ r: 4, fill: CAPEX_COLOR }} activeDot={{ r: 6 }} />
                                                <Line type="monotone" dataKey="opex" name="OPEX" stroke={OPEX_COLOR} strokeWidth={2} dot={{ r: 4, fill: OPEX_COLOR }} activeDot={{ r: 6 }} />
                                            </LineChart>
                                        ) : (
                                            <PieChart>
                                                <Pie
                                                    data={donutData}
                                                    cx="50%"
                                                    cy="50%"
                                                    innerRadius={70}
                                                    outerRadius={110}
                                                    paddingAngle={3}
                                                    dataKey="value"
                                                    label={({ name, percent }: { name?: string; percent?: number }) => `${name ?? ''} ${((percent ?? 0) * 100).toFixed(1)}%`}
                                                    labelLine={{ stroke: '#475569' }}
                                                >
                                                    {donutData.map((entry) => (
                                                        <Cell key={entry.name} fill={entry.color} />
                                                    ))}
                                                </Pie>
                                                <Tooltip formatter={(value: unknown) => formatLKR(Number(value))} />
                                            </PieChart>
                                        )}
                                    </ResponsiveContainer>
                                )}
                            </div>

                            {/* Variance Alerts Panel */}
                            <div className="rounded-xl border border-slate-800 bg-slate-900 p-5 flex flex-col gap-4">
                                <div className="flex items-center gap-2">
                                    <AlertTriangle className="w-4 h-4 text-amber-400" />
                                    <h2 className="text-sm font-bold text-white">Budget Alerts</h2>
                                    {(summary?.alerts?.length ?? 0) > 0 && (
                                        <Badge className="ml-auto bg-red-600 text-white text-[10px]">{summary!.alerts.length}</Badge>
                                    )}
                                </div>
                                <p className="text-xs text-slate-500">Categories exceeding 90% utilization</p>

                                {summaryLoading ? (
                                    <div className="flex-1 flex items-center justify-center">
                                        <div className="w-6 h-6 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
                                    </div>
                                ) : (summary?.alerts?.length ?? 0) === 0 ? (
                                    <div className="flex-1 flex flex-col items-center justify-center gap-2 text-center">
                                        <div className="w-12 h-12 rounded-full bg-emerald-500/20 flex items-center justify-center">
                                            <TrendingDown className="w-6 h-6 text-emerald-400" />
                                        </div>
                                        <p className="text-sm text-slate-400">All budgets within limit</p>
                                    </div>
                                ) : (
                                    <div className="space-y-3 overflow-y-auto max-h-64">
                                        {summary!.alerts.map((a, i) => (
                                            <div key={i} className="rounded-lg bg-red-950/30 border border-red-900/50 p-3">
                                                <div className="flex items-center justify-between mb-1.5">
                                                    <span className="text-xs font-semibold text-white">{CATEGORY_LABELS[a.category] ?? a.category}</span>
                                                    <Badge className={`text-[10px] ${a.expenditureType === 'CAPEX' ? 'bg-emerald-600' : 'bg-blue-600'}`}>
                                                        {a.expenditureType}
                                                    </Badge>
                                                </div>
                                                <UtilizationBar pct={a.utilizationPct} isAlert={a.isAlert} />
                                                <div className="flex justify-between mt-1.5 text-[10px] text-slate-500">
                                                    <span>{formatLKR(a.actual)} / {formatLKR(a.allocated)}</span>
                                                    <span className="text-red-400 font-bold">{a.utilizationPct}%</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* ── Budget vs Actual Table ─────────────────────────────── */}
                        <div className="rounded-xl border border-slate-800 bg-slate-900 overflow-hidden">
                            <div className="px-5 py-4 border-b border-slate-800 flex items-center gap-2">
                                <DollarSign className="w-4 h-4 text-emerald-400" />
                                <h2 className="text-sm font-bold text-white">Budget vs Actual Breakdown</h2>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b border-slate-800 text-xs text-slate-400 uppercase tracking-widest">
                                            <th className="px-5 py-3 text-left">Category</th>
                                            <th className="px-5 py-3 text-left">Type</th>
                                            <th className="px-5 py-3 text-right">Budget</th>
                                            <th className="px-5 py-3 text-right">Actual</th>
                                            <th className="px-5 py-3 text-right">Variance</th>
                                            <th className="px-5 py-3 text-left w-40">Utilization</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-800/50">
                                        {summaryLoading ? (
                                            <tr><td colSpan={6} className="px-5 py-8 text-center text-slate-500 text-xs">Loading...</td></tr>
                                        ) : (summary?.breakdown?.length ?? 0) === 0 ? (
                                            <tr><td colSpan={6} className="px-5 py-8 text-center text-slate-500 text-xs">No budget data for FY {fiscalYear}. Create budget allocations to get started.</td></tr>
                                        ) : (
                                            summary!.breakdown.map((row, i) => (
                                                <tr key={i} className={`hover:bg-slate-800/40 transition-colors ${row.isAlert ? 'bg-red-950/10' : ''}`}>
                                                    <td className="px-5 py-3 font-medium text-white">{CATEGORY_LABELS[row.category] ?? row.category}</td>
                                                    <td className="px-5 py-3">
                                                        <Badge className={`text-[10px] ${row.expenditureType === 'CAPEX' ? 'bg-emerald-600/20 text-emerald-300 border border-emerald-700' : 'bg-blue-600/20 text-blue-300 border border-blue-700'}`}>
                                                            {row.expenditureType}
                                                        </Badge>
                                                    </td>
                                                    <td className="px-5 py-3 text-right text-slate-300">{formatLKR(row.allocated)}</td>
                                                    <td className="px-5 py-3 text-right text-white font-medium">{formatLKR(row.actual)}</td>
                                                    <td className={`px-5 py-3 text-right font-semibold ${row.variance >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                                        {row.variance >= 0 ? '+' : ''}{formatLKR(row.variance)}
                                                    </td>
                                                    <td className="px-5 py-3">
                                                        <div className="flex items-center gap-2">
                                                            <UtilizationBar pct={row.utilizationPct} isAlert={row.isAlert} />
                                                            <span className={`text-xs font-bold w-10 flex-shrink-0 ${row.isAlert ? 'text-red-400' : 'text-slate-300'}`}>{row.utilizationPct}%</span>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* ── Top Expenses ───────────────────────────────────────── */}
                        {(summary?.topExpenses?.length ?? 0) > 0 && (
                            <div className="rounded-xl border border-slate-800 bg-slate-900 overflow-hidden">
                                <div className="px-5 py-4 border-b border-slate-800 flex items-center gap-2">
                                    <TrendingUp className="w-4 h-4 text-blue-400" />
                                    <h2 className="text-sm font-bold text-white">Top 5 Expenses — FY {fiscalYear}</h2>
                                </div>
                                <div className="divide-y divide-slate-800/50">
                                    {summary!.topExpenses.map((e, i) => (
                                        <div key={e.id} className="flex items-center gap-4 px-5 py-3 hover:bg-slate-800/40 transition-colors">
                                            <span className="text-xs text-slate-600 font-bold w-4">{i + 1}</span>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm text-white font-medium truncate">{e.description}</p>
                                                <p className="text-xs text-slate-500">{CATEGORY_LABELS[e.category] ?? e.category} · {new Date(e.transactionDate).toLocaleDateString('en-LK')}</p>
                                            </div>
                                            <Badge className={`text-[10px] flex-shrink-0 ${e.expenditureType === 'CAPEX' ? 'bg-emerald-600/20 text-emerald-300 border border-emerald-700' : 'bg-blue-600/20 text-blue-300 border border-blue-700'}`}>
                                                {e.expenditureType}
                                            </Badge>
                                            <span className="text-sm font-bold text-white flex-shrink-0">{formatLKR(e.amount)}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </main>
                </div>
            </div>
        </RoleGuard>
    );
}

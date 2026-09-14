'use client';

import { useState, useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import RoleGuard from '@/components/RoleGuard';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import {
    Package, FileSpreadsheet, RefreshCw, TrendingUp, AlertTriangle,
    Search, Download, ChevronUp, ChevronDown, Lock, Info,
} from 'lucide-react';
import type { MaterialSummaryReport, MaterialSummaryRow } from '@/services/inventory/material-summary-report.service';

// ─── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number, dp = 2) {
    return n.toLocaleString('en-LK', { minimumFractionDigits: dp, maximumFractionDigits: dp });
}

function fmtLKR(n: number) {
    if (n >= 1_000_000) return `LKR ${(n / 1_000_000).toFixed(2)}M`;
    if (n >= 1_000)     return `LKR ${(n / 1_000).toFixed(1)}K`;
    return `LKR ${n.toFixed(0)}`;
}

function downloadCSV(rows: MaterialSummaryRow[]) {
    const header = 'RTOM,Year,Month,Item Code,Item Name,Unit,Total Qty,Total Cost (LKR),SOD Count,Avg Qty/SOD,Exceeds Limit';
    const lines = rows.map(r =>
        [r.rtom, r.year, r.monthLabel, r.itemCode, `"${r.itemName}"`, r.unit,
         r.totalQuantity, r.totalCostLkr, r.sodCount, r.avgQtyPerSod, r.exceedsLimitCount].join(',')
    );
    const blob = new Blob([[header, ...lines].join('\n')], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `material-summary-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
}

type SortKey = keyof Pick<MaterialSummaryRow, 'rtom' | 'monthLabel' | 'itemCode' | 'totalQuantity' | 'totalCostLkr' | 'sodCount' | 'avgQtyPerSod' | 'exceedsLimitCount'>;

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = [CURRENT_YEAR, CURRENT_YEAR - 1, CURRENT_YEAR - 2];
const MONTHS = [
    { v: '', label: 'All Months' },
    { v: '1', label: 'January' }, { v: '2', label: 'February' }, { v: '3', label: 'March' },
    { v: '4', label: 'April' },   { v: '5', label: 'May' },      { v: '6', label: 'June' },
    { v: '7', label: 'July' },    { v: '8', label: 'August' },   { v: '9', label: 'September' },
    { v: '10', label: 'October' },{ v: '11', label: 'November' },{ v: '12', label: 'December' },
];

// ─── Page Component ────────────────────────────────────────────────────────────

export default function MaterialSummaryReportPage() {
    const [year,      setYear]      = useState<string>(String(CURRENT_YEAR));
    const [month,     setMonth]     = useState<string>('');
    const [rtom,      setRtom]      = useState<string>('');
    const [itemCode,  setItemCode]  = useState<string>('');
    const [search,    setSearch]    = useState('');
    const [sortKey,   setSortKey]   = useState<SortKey>('rtom');
    const [sortDir,   setSortDir]   = useState<'asc' | 'desc'>('asc');
    const [activeTab, setActiveTab] = useState<'table' | 'chart'>('table');

    // Build query string
    const qp = useMemo(() => {
        const p = new URLSearchParams({ _t: String(Date.now()) });
        if (year)     p.set('year', year);
        if (month)    p.set('month', month);
        if (rtom)     p.set('rtom', rtom);
        if (itemCode) p.set('itemCode', itemCode);
        return p.toString();
    }, [year, month, rtom, itemCode]);

    const { data: report, isLoading, refetch } = useQuery<MaterialSummaryReport>({
        queryKey: ['material-summary', year, month, rtom, itemCode],
        queryFn: async () => {
            const res = await fetch(`/api/inventory/reports/material-summary?${qp}`, { cache: 'no-store' });
            const json = await res.json() as { success: boolean; data: MaterialSummaryReport };
            return json.data;
        },
    });

    const handleSort = useCallback((key: SortKey) => {
        if (key === sortKey) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
        else { setSortKey(key); setSortDir('asc'); }
    }, [sortKey]);

    const filteredRows = useMemo(() => {
        if (!report?.rows) return [];
        let rows = [...report.rows];
        if (search) {
            const q = search.toLowerCase();
            rows = rows.filter(r =>
                r.rtom.toLowerCase().includes(q) ||
                r.itemCode.toLowerCase().includes(q) ||
                r.itemName.toLowerCase().includes(q)
            );
        }
        rows.sort((a, b) => {
            const av = a[sortKey], bv = b[sortKey];
            const cmp = typeof av === 'string' ? (av as string).localeCompare(bv as string) : (av as number) - (bv as number);
            return sortDir === 'asc' ? cmp : -cmp;
        });
        return rows;
    }, [report, search, sortKey, sortDir]);

    // Chart data: top 10 items by total quantity
    const chartData = useMemo(() => {
        if (!report?.rows) return [];
        const byItem = new Map<string, number>();
        for (const r of report.rows) byItem.set(r.itemCode, (byItem.get(r.itemCode) ?? 0) + r.totalQuantity);
        return [...byItem.entries()]
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([code, qty]) => ({ code, qty }));
    }, [report]);

    const SortIcon = ({ col }: { col: SortKey }) =>
        sortKey === col
            ? (sortDir === 'asc' ? <ChevronUp className="w-3 h-3 inline ml-0.5 text-blue-400" /> : <ChevronDown className="w-3 h-3 inline ml-0.5 text-blue-400" />)
            : null;

    return (
        <RoleGuard allowedRoles={['SUPER_ADMIN', 'ADMIN', 'OSP_MANAGER', 'MANAGER', 'AREA_MANAGER', 'ENGINEER', 'FINANCE_MANAGER', 'STORES_MANAGER']}>
            <div className="flex h-screen bg-slate-50 dark:bg-slate-950 overflow-hidden font-sans">
                <Sidebar />
                <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                    <Header />
                    <main className="flex-1 overflow-y-auto">
                        <div className="max-w-[1600px] mx-auto p-4 md:p-6 space-y-6">

                            {/* ── Page Header ── */}
                            <div className="relative overflow-hidden bg-gradient-to-r from-violet-700 via-purple-700 to-indigo-700 rounded-2xl p-6 text-white shadow-xl">
                                <div className="absolute inset-0 opacity-10"
                                    style={{ backgroundImage: 'repeating-linear-gradient(45deg,#fff 0,#fff 1px,transparent 0,transparent 50%)', backgroundSize: '14px 14px' }} />
                                <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-4">
                                    <div>
                                        <div className="flex items-center gap-2 mb-2">
                                            <Package className="w-6 h-6 text-violet-200" />
                                            <span className="text-xs font-black uppercase tracking-widest text-violet-200">Material Consumption</span>
                                        </div>
                                        <h1 className="text-2xl font-black tracking-tight">Monthly Material Summary Report</h1>
                                        <p className="text-sm text-violet-200 mt-1">SOD Field Usage · RTOM × Month × Item Pivot · H1 2026 Ready</p>
                                    </div>
                                    {report && (
                                        <div className="flex flex-wrap gap-3">
                                            <div className="bg-white/10 backdrop-blur rounded-xl px-4 py-2 text-center min-w-[90px]">
                                                <p className="text-[10px] font-bold uppercase tracking-wider text-violet-200">Total Rows</p>
                                                <p className="text-xl font-black">{report.totals.rowCount.toLocaleString()}</p>
                                            </div>
                                            <div className="bg-white/10 backdrop-blur rounded-xl px-4 py-2 text-center min-w-[90px]">
                                                <p className="text-[10px] font-bold uppercase tracking-wider text-violet-200">Total Cost</p>
                                                <p className="text-xl font-black">{fmtLKR(report.totals.totalCostLkr)}</p>
                                            </div>
                                            <div className="bg-white/10 backdrop-blur rounded-xl px-4 py-2 text-center min-w-[90px]">
                                                <p className="text-[10px] font-bold uppercase tracking-wider text-violet-200">SODs Covered</p>
                                                <p className="text-xl font-black">{report.totals.totalSodCount.toLocaleString()}</p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* ── Filter Bar ── */}
                            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm">
                                <div className="flex flex-wrap gap-3 items-end">
                                    {/* Year */}
                                    <div className="space-y-1 min-w-[110px]">
                                        <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Year</label>
                                        <Select value={year} onValueChange={setYear}>
                                            <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="">All Years</SelectItem>
                                                {YEARS.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    {/* Month */}
                                    <div className="space-y-1 min-w-[130px]">
                                        <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Month</label>
                                        <Select value={month} onValueChange={setMonth}>
                                            <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="All Months" /></SelectTrigger>
                                            <SelectContent>
                                                {MONTHS.map(m => <SelectItem key={m.v} value={m.v}>{m.label}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    {/* RTOM */}
                                    <div className="space-y-1 min-w-[130px]">
                                        <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">RTOM</label>
                                        <Select value={rtom} onValueChange={setRtom} disabled={report?.isScopedView}>
                                            <SelectTrigger className="h-9 text-xs">
                                                <SelectValue placeholder={report?.isScopedView ? `${report.scopedRtomLabel ?? 'Your RTOM'} (Locked)` : 'All RTOMs'} />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="">All RTOMs</SelectItem>
                                                {(report?.distinctRtoms ?? []).map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    {/* Item */}
                                    <div className="space-y-1 min-w-[180px]">
                                        <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Item</label>
                                        <Select value={itemCode} onValueChange={setItemCode}>
                                            <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="All Items" /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="">All Items</SelectItem>
                                                {(report?.distinctItems ?? []).map(i => <SelectItem key={i.code} value={i.code}>{i.code} – {i.name}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    {/* Search */}
                                    <div className="flex-1 min-w-[200px] space-y-1">
                                        <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Search</label>
                                        <div className="relative">
                                            <Search className="absolute left-2.5 top-2 w-4 h-4 text-slate-400" />
                                            <Input
                                                id="material-summary-search"
                                                placeholder="RTOM, item code or name…"
                                                value={search}
                                                onChange={e => setSearch(e.target.value)}
                                                className="pl-8 h-9 text-xs"
                                            />
                                        </div>
                                    </div>
                                    {/* Actions */}
                                    <div className="flex gap-2 pt-4">
                                        <Button id="material-summary-refresh" size="sm" variant="outline" onClick={() => refetch()} disabled={isLoading}>
                                            <RefreshCw className={`w-4 h-4 mr-1.5 ${isLoading ? 'animate-spin' : ''}`} /> Refresh
                                        </Button>
                                        <Button id="material-summary-export" size="sm" className="bg-violet-600 hover:bg-violet-700 text-white" onClick={() => filteredRows.length && downloadCSV(filteredRows)} disabled={!filteredRows.length}>
                                            <Download className="w-4 h-4 mr-1.5" /> Export CSV
                                        </Button>
                                    </div>
                                </div>
                            </div>

                            {/* ── Scoped View Banner ── */}
                            {report?.isScopedView && (
                                <div className="flex items-center gap-2.5 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl px-4 py-3">
                                    <Info className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                                    <p className="text-xs font-semibold text-amber-800 dark:text-amber-300">
                                        <strong>Scoped View:</strong> Showing data for your assigned RTOM only
                                        {report.scopedRtomLabel && ` — ${report.scopedRtomLabel}`}.
                                        Contact OSP Manager for cross-RTOM visibility.
                                    </p>
                                </div>
                            )}
                            {report && !report.canViewCosts && (
                                <div className="flex items-center gap-2.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3">
                                    <Lock className="w-4 h-4 text-slate-400 shrink-0" />
                                    <p className="text-xs font-medium text-slate-600 dark:text-slate-400">
                                        <strong>Quantity-only view:</strong> Cost columns are hidden for your role.
                                        Finance Manager access is required to view LKR cost data.
                                    </p>
                                </div>
                            )}

                            {/* ── Tab Toggle ── */}
                            <div className="flex gap-2">
                                {(['table', 'chart'] as const).map(t => (
                                    <button key={t} id={`material-summary-tab-${t}`}
                                        onClick={() => setActiveTab(t)}
                                        className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border ${
                                            activeTab === t
                                                ? 'bg-violet-600 text-white border-violet-600 shadow'
                                                : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-violet-400'
                                        }`}>
                                        {t === 'table' ? <><FileSpreadsheet className="w-4 h-4 inline mr-1.5" />Pivot Table</> : <><TrendingUp className="w-4 h-4 inline mr-1.5" />Top Items Chart</>}
                                    </button>
                                ))}
                                {filteredRows.length > 0 && (
                                    <span className="ml-auto text-xs text-slate-400 self-center">
                                        {filteredRows.length.toLocaleString()} rows
                                    </span>
                                )}
                            </div>

                            {/* ── Loading ── */}
                            {isLoading && (
                                <div className="flex items-center justify-center py-16">
                                    <RefreshCw className="w-8 h-8 text-violet-500 animate-spin mr-3" />
                                    <span className="text-slate-500 font-medium">Loading material data…</span>
                                </div>
                            )}

                            {/* ── Table View ── */}
                            {!isLoading && activeTab === 'table' && (
                                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-xs">
                                            <thead>
                                                <tr className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
                                                    {([
                                                        { key: 'rtom',              label: 'RTOM' },
                                                        { key: 'monthLabel',        label: 'Month' },
                                                        { key: 'itemCode',          label: 'Item Code' },
                                                        { key: null,                label: 'Item Name' },
                                                        { key: null,                label: 'Unit' },
                                                        { key: 'totalQuantity',     label: 'Total Qty' },
                                                        ...(report?.canViewCosts ? [{ key: 'totalCostLkr' as SortKey, label: 'Total Cost (LKR)' }] : []),
                                                        { key: 'sodCount',          label: 'SOD Count' },
                                                        { key: 'avgQtyPerSod',      label: 'Avg Qty/SOD' },
                                                        { key: 'exceedsLimitCount', label: 'Exceeds Limit' },
                                                    ] as { key: SortKey | null; label: string }[]).map(({ key, label }) => (
                                                        <th key={label}
                                                            onClick={() => key && handleSort(key)}
                                                            className={`px-3 py-2.5 text-left font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 whitespace-nowrap select-none ${key ? 'cursor-pointer hover:text-violet-600' : ''}`}>
                                                            {label} {key && <SortIcon col={key} />}
                                                        </th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {filteredRows.length === 0 ? (
                                                    <tr><td colSpan={report?.canViewCosts ? 10 : 8} className="text-center py-12 text-slate-400">No data found. Adjust filters and try again.</td></tr>
                                                ) : filteredRows.map((row, i) => (
                                                    <tr key={i} className="border-b border-slate-100 dark:border-slate-800 hover:bg-violet-50/40 dark:hover:bg-violet-950/20 transition-colors">
                                                        <td className="px-3 py-2 font-bold text-slate-700 dark:text-slate-200">{row.rtom}</td>
                                                        <td className="px-3 py-2 text-slate-500">{row.monthLabel} {row.year}</td>
                                                        <td className="px-3 py-2 font-mono text-violet-700 dark:text-violet-400 font-bold">{row.itemCode}</td>
                                                        <td className="px-3 py-2 text-slate-600 dark:text-slate-300 max-w-[200px] truncate" title={row.itemName}>{row.itemName}</td>
                                                        <td className="px-3 py-2 text-slate-500">{row.unit}</td>
                                                        <td className="px-3 py-2 font-bold text-right text-slate-800 dark:text-slate-100">{fmt(row.totalQuantity)}</td>
                                                        {report?.canViewCosts && (
                                                            <td className="px-3 py-2 text-right text-emerald-700 dark:text-emerald-400 font-semibold">{fmtLKR(row.totalCostLkr)}</td>
                                                        )}
                                                        <td className="px-3 py-2 text-right text-slate-600">{row.sodCount.toLocaleString()}</td>
                                                        <td className="px-3 py-2 text-right text-indigo-600 dark:text-indigo-400 font-semibold">{fmt(row.avgQtyPerSod)}</td>
                                                        <td className="px-3 py-2 text-center">
                                                            {row.exceedsLimitCount > 0
                                                                ? <Badge variant="destructive" className="text-[10px] font-bold px-1.5"><AlertTriangle className="w-3 h-3 mr-0.5 inline" />{row.exceedsLimitCount}</Badge>
                                                                : <span className="text-slate-300 dark:text-slate-600">—</span>}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                            {filteredRows.length > 0 && report && (
                                                <tfoot>
                                                    <tr className="bg-violet-50 dark:bg-violet-950/30 border-t-2 border-violet-200 dark:border-violet-800 font-black">
                                                        <td colSpan={report.canViewCosts ? 5 : 5} className="px-3 py-2.5 text-xs font-black text-violet-700 dark:text-violet-300 uppercase tracking-wider">Grand Total</td>
                                                        <td className="px-3 py-2.5 text-right text-violet-800 dark:text-violet-200">{fmt(report.totals.totalQuantity)}</td>
                                                        {report.canViewCosts && (
                                                            <td className="px-3 py-2.5 text-right text-violet-800 dark:text-violet-200">{fmtLKR(report.totals.totalCostLkr)}</td>
                                                        )}
                                                        <td className="px-3 py-2.5 text-right text-violet-800 dark:text-violet-200">{report.totals.totalSodCount.toLocaleString()}</td>
                                                        <td colSpan={2} />
                                                    </tr>
                                                </tfoot>
                                            )}
                                        </table>
                                    </div>
                                </div>
                            )}

                            {/* ── Chart View ── */}
                            {!isLoading && activeTab === 'chart' && (
                                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-6">
                                    <h2 className="text-sm font-black uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-4">Top 10 Items by Total Quantity Consumed</h2>
                                    {chartData.length === 0 ? (
                                        <p className="text-center text-slate-400 py-12">No data available</p>
                                    ) : (
                                        <ResponsiveContainer width="100%" height={380}>
                                            <BarChart data={chartData} margin={{ top: 5, right: 20, left: 20, bottom: 60 }}>
                                                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                                                <XAxis dataKey="code" angle={-35} textAnchor="end" tick={{ fontSize: 11, fontWeight: 700 }} />
                                                <YAxis tick={{ fontSize: 11 }} />
                                                <Tooltip
                                                    formatter={(v: number | undefined) => [fmt(v ?? 0), 'Total Qty']}
                                                    contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }}
                                                />
                                                <Legend />
                                                <Bar dataKey="qty" name="Total Quantity" fill="#7c3aed" radius={[6, 6, 0, 0]} />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    )}
                                </div>
                            )}

                        </div>
                    </main>
                </div>
            </div>
        </RoleGuard>
    );
}

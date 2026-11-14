"use client";

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import RoleGuard from '@/components/RoleGuard';
import { TrendingUp, TrendingDown, FileText, Download } from "lucide-react";
import { downloadCsv } from '@/lib/csv-export';

interface AccountBalanceSummary {
    code: string;
    name: string;
    type: string;
    netBalance: number;
}

interface PnlBase {
    revenueAccounts: AccountBalanceSummary[];
    expenseAccounts: AccountBalanceSummary[];
    totalRevenue: number;
    totalExpense: number;
    netProfit: number;
}
interface PnlData extends PnlBase {
    comparison?: PnlBase;
    comparisonMode?: 'previous' | 'yoy';
}

type Preset = 'all' | 'thisMonth' | 'lastMonth' | 'thisQuarter' | 'thisYear' | 'lastYear' | 'custom';
type Compare = 'none' | 'previous' | 'yoy';

const iso = (d: Date) => d.toISOString();
const utc = (y: number, m: number, d: number, end = false) =>
    new Date(Date.UTC(y, m, d, end ? 23 : 0, end ? 59 : 0, end ? 59 : 0, end ? 999 : 0));

function presetRange(p: Preset, now = new Date()): { from?: Date; to?: Date } {
    const y = now.getUTCFullYear();
    const m = now.getUTCMonth();
    switch (p) {
        case 'thisMonth': return { from: utc(y, m, 1), to: now };
        case 'lastMonth': return { from: utc(y, m - 1, 1), to: new Date(utc(y, m, 1).getTime() - 1) };
        case 'thisQuarter': { const q = Math.floor(m / 3) * 3; return { from: utc(y, q, 1), to: now }; }
        case 'thisYear': return { from: utc(y, 0, 1), to: now };
        case 'lastYear': return { from: utc(y - 1, 0, 1), to: new Date(utc(y, 0, 1).getTime() - 1) };
        default: return {};
    }
}

const fmt = (v: number) => v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function Variance({ cur, base, lowerIsBetter = false }: { cur: number; base: number; lowerIsBetter?: boolean }) {
    const diff = cur - base;
    if (Math.abs(diff) < 0.005) return <span className="text-xs text-slate-600">no change</span>;
    const good = (diff > 0) !== lowerIsBetter;
    const pctText = base === 0 ? 'n/a' : `${((diff / Math.abs(base)) * 100).toFixed(1)}%`;
    return (
        <span className={`text-xs font-semibold ${good ? 'text-emerald-700' : 'text-red-700'}`}>
            {diff > 0 ? '+' : ''}{fmt(diff)} ({pctText})
        </span>
    );
}

export default function PnlPage() {
    const [preset, setPreset] = useState<Preset>('thisMonth');
    const [compare, setCompare] = useState<Compare>('previous');
    const [customFrom, setCustomFrom] = useState('');
    const [customTo, setCustomTo] = useState('');

    const range = useMemo(() => {
        if (preset === 'custom') {
            if (!customFrom || !customTo) return {};
            return { from: new Date(`${customFrom}T00:00:00.000Z`), to: new Date(`${customTo}T23:59:59.999Z`) };
        }
        return presetRange(preset);
    }, [preset, customFrom, customTo]);

    const canCompare = !!range.from && !!range.to;
    const effectiveCompare: Compare = canCompare ? compare : 'none';

    const { data, isLoading, error } = useQuery<PnlData>({
        queryKey: ['pnl-report', range.from?.toISOString(), range.to?.toISOString(), effectiveCompare],
        queryFn: async ({ signal }) => {
            const params = new URLSearchParams();
            if (range.from) params.set('from', iso(range.from));
            if (range.to) params.set('to', iso(range.to));
            if (effectiveCompare !== 'none') params.set('compare', effectiveCompare);
            const res = await fetch(`/api/finance/reports/pnl?${params}`, { cache: 'no-store', signal });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error?.message || 'Failed to fetch Profit & Loss');
            return json.data;
        }
    });

    const isProfitable = (data?.netProfit || 0) >= 0;
    const cmp = data?.comparison;
    const cmpLabel = data?.comparisonMode === 'yoy' ? 'same period last year' : 'previous period';
    const baseOf = (list: AccountBalanceSummary[] | undefined, code: string) => list?.find((a) => a.code === code)?.netBalance ?? 0;

    const exportCsv = () => {
        if (!data) return;
        const rows: (string | number)[][] = [['Section', 'Account', 'Name', 'Amount', ...(cmp ? [`Comparison (${cmpLabel})`] : [])]];
        const add = (section: string, list: AccountBalanceSummary[], cmpList?: AccountBalanceSummary[]) => {
            for (const a of list) rows.push([section, a.code, a.name, a.netBalance, ...(cmpList ? [baseOf(cmpList, a.code)] : [])]);
        };
        add('Revenue', data.revenueAccounts, cmp?.revenueAccounts);
        add('Expense', data.expenseAccounts, cmp?.expenseAccounts);
        rows.push(['Total', '', 'Revenue', data.totalRevenue, ...(cmp ? [cmp.totalRevenue] : [])]);
        rows.push(['Total', '', 'Expense', data.totalExpense, ...(cmp ? [cmp.totalExpense] : [])]);
        rows.push(['Total', '', 'Net profit', data.netProfit, ...(cmp ? [cmp.netProfit] : [])]);
        downloadCsv('profit-and-loss.csv', rows);
    };

    const renderSection = (title: string, headerTone: string, total: number, cmpTotal: number | undefined, list: AccountBalanceSummary[] | undefined,
        cmpList: AccountBalanceSummary[] | undefined, emptyText: string, lowerIsBetter: boolean) => (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className={`${headerTone} p-4 border-b border-slate-200 flex justify-between items-center`}>
                <h2 className="font-bold uppercase text-xs tracking-wider text-slate-900">{title}</h2>
                <div className="text-right">
                    <span className="font-mono font-bold text-slate-900 text-sm">LKR {fmt(total)}</span>
                    {cmpTotal !== undefined && <div><Variance cur={total} base={cmpTotal} lowerIsBetter={lowerIsBetter} /></div>}
                </div>
            </div>
            <div className="divide-y divide-slate-100">
                {isLoading ? (
                    <div className="p-6 text-center text-slate-700">Loading accounts...</div>
                ) : (list?.length || 0) === 0 ? (
                    <div className="p-6 text-center text-slate-700 text-sm">{emptyText}</div>
                ) : (
                    list?.map(acc => (
                        <div key={acc.code} className="p-3.5 flex justify-between items-center hover:bg-slate-50 gap-3">
                            <div className="min-w-0">
                                <a href={`/finance/reports/gl-viewer?accountCode=${encodeURIComponent(acc.code)}`} className="font-mono font-bold text-blue-800 underline text-xs mr-2">{acc.code}</a>
                                <span className="text-sm font-medium text-slate-900">{acc.name}</span>
                            </div>
                            <div className="text-right shrink-0">
                                <span className="font-mono font-semibold text-slate-900 text-sm">LKR {fmt(acc.netBalance)}</span>
                                {cmpList && <div><Variance cur={acc.netBalance} base={baseOf(cmpList, acc.code)} lowerIsBetter={lowerIsBetter} /></div>}
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );

    return (
        <RoleGuard>
            <div className="flex h-screen bg-slate-50 overflow-hidden">
                <Sidebar />
                <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                    <Header />
                    <main className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">

                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div>
                                <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
                                    <FileText className="w-7 h-7 text-indigo-600" />
                                    Profit & Loss Statement (Income Statement)
                                </h1>
                                <p className="text-sm text-slate-700 mt-1">
                                    Revenues, cost of sales and expenses for the selected period, with an optional comparison.
                                </p>
                            </div>

                            <div className={`p-4 rounded-xl border flex items-center gap-3 ${isProfitable ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-rose-50 border-rose-200 text-rose-900'}`}>
                                {isProfitable ? <TrendingUp className="w-6 h-6 text-emerald-600" /> : <TrendingDown className="w-6 h-6 text-rose-600" />}
                                <div>
                                    <div className="text-xs uppercase font-bold text-slate-700">Net Profit / (Loss)</div>
                                    <div className="text-xl font-bold font-mono">LKR {fmt(data?.netProfit || 0)}</div>
                                    {cmp && <Variance cur={data?.netProfit || 0} base={cmp.netProfit} />}
                                </div>
                            </div>
                        </div>

                        <div className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-3">
                            <label className="text-xs font-semibold text-slate-900">Period
                                <select value={preset} onChange={(e) => setPreset(e.target.value as Preset)}
                                    className="mt-1 block rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900">
                                    <option value="thisMonth">This month</option>
                                    <option value="lastMonth">Last month</option>
                                    <option value="thisQuarter">This quarter</option>
                                    <option value="thisYear">This year</option>
                                    <option value="lastYear">Last year</option>
                                    <option value="all">All time</option>
                                    <option value="custom">Custom range</option>
                                </select>
                            </label>
                            {preset === 'custom' && (
                                <>
                                    <label className="text-xs font-semibold text-slate-900">From
                                        <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)}
                                            className="mt-1 block rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900" />
                                    </label>
                                    <label className="text-xs font-semibold text-slate-900">To
                                        <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)}
                                            className="mt-1 block rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900" />
                                    </label>
                                </>
                            )}
                            <label className="text-xs font-semibold text-slate-900">Compare with
                                <select value={compare} onChange={(e) => setCompare(e.target.value as Compare)} disabled={!canCompare}
                                    className="mt-1 block rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900 disabled:opacity-50">
                                    <option value="none">No comparison</option>
                                    <option value="previous">Previous period</option>
                                    <option value="yoy">Same period last year</option>
                                </select>
                            </label>
                            {!canCompare && <span className="text-xs text-slate-700">Pick a dated period to compare.</span>}
                            <button onClick={exportCsv} disabled={!data}
                                className="ml-auto inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100 disabled:opacity-50">
                                <Download className="w-4 h-4" />Export CSV
                            </button>
                        </div>
                        {error && <p className="text-sm text-red-700">{(error as Error).message}</p>}

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {renderSection('Revenues & Operating Income', 'bg-blue-50', data?.totalRevenue || 0, cmp?.totalRevenue,
                                data?.revenueAccounts, cmp?.revenueAccounts, 'No revenue recorded for period.', false)}
                            {renderSection('Expenses & Cost of Sales', 'bg-rose-50', data?.totalExpense || 0, cmp?.totalExpense,
                                data?.expenseAccounts, cmp?.expenseAccounts, 'No expenses recorded for period.', true)}
                        </div>
                        {cmp && <p className="text-xs text-slate-700">Variances are against the {cmpLabel}.</p>}
                    </main>
                </div>
            </div>
        </RoleGuard>
    );
}

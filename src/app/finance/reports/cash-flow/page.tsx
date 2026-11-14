"use client";

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import RoleGuard from '@/components/RoleGuard';
import { Banknote, Download } from "lucide-react";

interface CashAccount { code: string; name: string; totalDebit: number; totalCredit: number; netBalance: number }
interface CashFlowBase {
    cashAccounts: CashAccount[];
    openingCash: number;
    totalInflow: number;
    totalOutflow: number;
    netCashFlow: number;
    closingCash: number;
}
interface CashFlowData extends CashFlowBase {
    comparison?: CashFlowBase;
    comparisonMode?: 'previous' | 'yoy';
}

type Preset = 'thisMonth' | 'lastMonth' | 'thisQuarter' | 'thisYear' | 'lastYear';
type Compare = 'none' | 'previous' | 'yoy';

const utc = (y: number, m: number, d: number) => new Date(Date.UTC(y, m, d));
function presetRange(p: Preset, now = new Date()) {
    const y = now.getUTCFullYear();
    const m = now.getUTCMonth();
    switch (p) {
        case 'lastMonth': return { from: utc(y, m - 1, 1), to: new Date(utc(y, m, 1).getTime() - 1) };
        case 'thisQuarter': return { from: utc(y, Math.floor(m / 3) * 3, 1), to: now };
        case 'thisYear': return { from: utc(y, 0, 1), to: now };
        case 'lastYear': return { from: utc(y - 1, 0, 1), to: new Date(utc(y, 0, 1).getTime() - 1) };
        default: return { from: utc(y, m, 1), to: now };
    }
}

const fmt = (v: number) => v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function Line({ label, value, base, lowerIsBetter = false, strong = false }: { label: string; value: number; base?: number; lowerIsBetter?: boolean; strong?: boolean }) {
    const diff = base === undefined ? null : value - base;
    const good = diff === null ? null : (diff > 0) !== lowerIsBetter;
    return (
        <div className={`flex items-center justify-between gap-3 p-3.5 ${strong ? 'bg-slate-50 font-bold' : ''}`}>
            <span className="text-sm text-slate-900">{label}</span>
            <span className="text-right">
                <span className="font-mono text-sm font-semibold text-slate-900">LKR {fmt(value)}</span>
                {diff !== null && Math.abs(diff) >= 0.005 && (
                    <span className={`block text-xs font-semibold ${good ? 'text-emerald-700' : 'text-red-700'}`}>{diff > 0 ? '+' : ''}{fmt(diff)}</span>
                )}
            </span>
        </div>
    );
}

export default function CashFlowPage() {
    const [preset, setPreset] = useState<Preset>('thisMonth');
    const [compare, setCompare] = useState<Compare>('previous');
    const range = useMemo(() => presetRange(preset), [preset]);

    const { data, isLoading, error } = useQuery<CashFlowData>({
        queryKey: ['cash-flow-report', preset, compare],
        queryFn: async ({ signal }) => {
            const params = new URLSearchParams({ from: range.from.toISOString(), to: range.to.toISOString() });
            if (compare !== 'none') params.set('compare', compare);
            const res = await fetch(`/api/finance/reports/cashflow?${params}`, { cache: 'no-store', signal });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error?.message || 'Failed to fetch Cash Flow');
            return json.data;
        },
    });

    const cmp = data?.comparison;
    const cmpLabel = data?.comparisonMode === 'yoy' ? 'same period last year' : 'previous period';

    const exportCsv = () => {
        if (!data) return;
        const rows: (string | number)[][] = [['Line', 'Amount', ...(cmp ? [`Comparison (${cmpLabel})`] : [])],
            ['Opening cash', data.openingCash, ...(cmp ? [cmp.openingCash] : [])],
            ['Cash inflow', data.totalInflow, ...(cmp ? [cmp.totalInflow] : [])],
            ['Cash outflow', data.totalOutflow, ...(cmp ? [cmp.totalOutflow] : [])],
            ['Net cash flow', data.netCashFlow, ...(cmp ? [cmp.netCashFlow] : [])],
            ['Closing cash', data.closingCash, ...(cmp ? [cmp.closingCash] : [])]];
        for (const a of data.cashAccounts) rows.push([`Account ${a.code} ${a.name.replace(/,/g, ' ')} (net movement)`, a.totalDebit - a.totalCredit]);
        const url = URL.createObjectURL(new Blob([rows.map((r) => r.join(',')).join('\n')], { type: 'text/csv' }));
        const a = document.createElement('a');
        a.href = url; a.download = 'cash-flow.csv'; a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <RoleGuard>
            <div className="flex h-screen bg-slate-50 overflow-hidden">
                <Sidebar />
                <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                    <Header />
                    <main className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
                        <div>
                            <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
                                <Banknote className="w-7 h-7 text-indigo-600" />Cash Flow Statement
                            </h1>
                            <p className="text-sm text-slate-700 mt-1">Movement on bank and petty-cash accounts for the period, derived from posted ledger entries.</p>
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
                                </select>
                            </label>
                            <label className="text-xs font-semibold text-slate-900">Compare with
                                <select value={compare} onChange={(e) => setCompare(e.target.value as Compare)}
                                    className="mt-1 block rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900">
                                    <option value="none">No comparison</option>
                                    <option value="previous">Previous period</option>
                                    <option value="yoy">Same period last year</option>
                                </select>
                            </label>
                            <button onClick={exportCsv} disabled={!data}
                                className="ml-auto inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100 disabled:opacity-50">
                                <Download className="w-4 h-4" />Export CSV
                            </button>
                        </div>
                        {error && <p className="text-sm text-red-700">{(error as Error).message}</p>}

                        <div className="bg-white rounded-xl shadow-sm border border-slate-200 divide-y divide-slate-100 overflow-hidden">
                            {isLoading || !data ? (
                                <div className="p-6 text-center text-slate-700">Loading cash flow...</div>
                            ) : (
                                <>
                                    <Line label="Opening cash" value={data.openingCash} base={cmp?.openingCash} />
                                    <Line label="Cash inflow (receipts)" value={data.totalInflow} base={cmp?.totalInflow} />
                                    <Line label="Cash outflow (payments)" value={data.totalOutflow} base={cmp?.totalOutflow} lowerIsBetter />
                                    <Line label="Net cash flow" value={data.netCashFlow} base={cmp?.netCashFlow} strong />
                                    <Line label="Closing cash" value={data.closingCash} base={cmp?.closingCash} strong />
                                </>
                            )}
                        </div>

                        {data && data.cashAccounts.length > 0 && (
                            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                                <div className="p-4 border-b border-slate-200 text-xs font-bold uppercase tracking-wider text-slate-900">Cash accounts</div>
                                {data.cashAccounts.map((a) => (
                                    <div key={a.code} className="flex items-center justify-between p-3.5 border-b border-slate-100 text-sm text-slate-900">
                                        <a href={`/finance/reports/gl-viewer?accountCode=${encodeURIComponent(a.code)}`} className="underline text-blue-800">
                                            <span className="font-mono font-bold text-xs mr-2">{a.code}</span>{a.name}
                                        </a>
                                        <span className="font-mono font-semibold">LKR {fmt(a.totalDebit - a.totalCredit)}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                        {cmp && <p className="text-xs text-slate-700">Variances are against the {cmpLabel}.</p>}
                    </main>
                </div>
            </div>
        </RoleGuard>
    );
}

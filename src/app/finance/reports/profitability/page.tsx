"use client";

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import RoleGuard from '@/components/RoleGuard';
import { Card, CardContent } from '@/components/ui/card';
import { Download, Loader2, Building2, AlertTriangle } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell } from 'recharts';
import type { ProfitabilityReport } from '@/services/finance/profitability.service';
import { downloadCsv } from '@/lib/csv-export';

type Preset = 'all' | 'thisMonth' | 'thisQuarter' | 'thisYear' | 'lastYear';
type By = 'opmc' | 'project';

const fmt = (v: number) => v.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
const compact = (v: number) => new Intl.NumberFormat('en-LK', { notation: 'compact', maximumFractionDigits: 1 }).format(v);
const utc = (y: number, m: number, d: number) => new Date(Date.UTC(y, m, d));

function presetRange(p: Preset, now = new Date()): { from?: Date; to?: Date } {
    const y = now.getUTCFullYear();
    const m = now.getUTCMonth();
    switch (p) {
        case 'thisMonth': return { from: utc(y, m, 1), to: now };
        case 'thisQuarter': return { from: utc(y, Math.floor(m / 3) * 3, 1), to: now };
        case 'thisYear': return { from: utc(y, 0, 1), to: now };
        case 'lastYear': return { from: utc(y - 1, 0, 1), to: new Date(utc(y, 0, 1).getTime() - 1) };
        default: return {};
    }
}

export default function ProfitabilityPage() {
    const [by, setBy] = useState<By>('opmc');
    const [preset, setPreset] = useState<Preset>('thisYear');
    const range = useMemo(() => presetRange(preset), [preset]);

    const { data, isLoading, error } = useQuery<ProfitabilityReport>({
        queryKey: ['finance-profitability', by, preset],
        queryFn: async ({ signal }) => {
            const params = new URLSearchParams({ by });
            if (range.from) params.set('from', range.from.toISOString());
            if (range.to) params.set('to', range.to.toISOString());
            const res = await fetch(`/api/finance/reports/profitability?${params}`, { cache: 'no-store', signal });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error?.message || 'Failed to load profitability');
            return json.data;
        },
        staleTime: 60_000,
        refetchOnWindowFocus: false,
    });

    const exportCsv = () => {
        if (!data) return;
        const rows: (string | number)[][] = [[by === 'opmc' ? 'OPMC' : 'Project', 'Detail', 'Revenue', 'Direct cost', 'Operating expense', 'Gross margin', 'Net profit', 'Margin %'],
            ...data.rows.map((r) => [r.label, (r.sublabel ?? ''), r.revenue, r.directCost, r.opex, r.grossMargin, r.netProfit, r.marginPct ?? ''])];
        downloadCsv(`profitability-by-${by}.csv`, rows);
    };

    const chartRows = (data?.rows ?? []).slice(0, 12).map((r) => ({ name: r.label.length > 18 ? `${r.label.slice(0, 17)}…` : r.label, net: r.netProfit }));

    return (
        <RoleGuard>
            <div className="flex h-screen bg-slate-50 overflow-hidden">
                <Sidebar />
                <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                    <Header />
                    <main className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
                        <div>
                            <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
                                <Building2 className="w-7 h-7 text-indigo-600" />Profitability by OPMC &amp; project
                            </h1>
                            <p className="text-sm text-slate-700 mt-1">Which OPMCs and projects make or lose money, from posted ledger entries.</p>
                        </div>

                        <div className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-3">
                            <label className="text-xs font-semibold text-slate-900">Group by
                                <select value={by} onChange={(e) => setBy(e.target.value as By)}
                                    className="mt-1 block rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900">
                                    <option value="opmc">OPMC</option>
                                    <option value="project">Project</option>
                                </select>
                            </label>
                            <label className="text-xs font-semibold text-slate-900">Period
                                <select value={preset} onChange={(e) => setPreset(e.target.value as Preset)}
                                    className="mt-1 block rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900">
                                    <option value="thisMonth">This month</option>
                                    <option value="thisQuarter">This quarter</option>
                                    <option value="thisYear">This year</option>
                                    <option value="lastYear">Last year</option>
                                    <option value="all">All time</option>
                                </select>
                            </label>
                            <button onClick={exportCsv} disabled={!data}
                                className="ml-auto inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100 disabled:opacity-50">
                                <Download className="w-4 h-4" />Export CSV
                            </button>
                        </div>

                        {isLoading && <div className="flex h-40 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /></div>}
                        {error && <p className="text-sm text-red-700">{(error as Error).message}</p>}

                        {data && (
                            <>
                                {data.unattributedRevenuePct !== null && data.unattributedRevenuePct > 0 && (
                                    <div className="flex items-start gap-2 rounded-xl border border-amber-400 bg-amber-50 p-3 text-sm text-slate-900">
                                        <AlertTriangle className="mt-0.5 h-4 w-4 text-amber-700" />
                                        <span>{data.unattributedRevenuePct}% of revenue is not attributed to any {by === 'opmc' ? 'OPMC' : 'project'} (its source document carries none), so it appears under &ldquo;Unattributed&rdquo;.</span>
                                    </div>
                                )}

                                <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
                                    {[['Revenue', data.totals.revenue], ['Direct cost', data.totals.directCost], ['Operating expense', data.totals.opex], ['Net profit', data.totals.netProfit]].map(([label, value]) => (
                                        <Card key={label as string} className="shadow-sm"><CardContent className="p-4">
                                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-700">{label as string}</p>
                                            <p className={`mt-1 text-xl font-bold ${label === 'Net profit' && (value as number) < 0 ? 'text-red-700' : 'text-slate-900'}`}>LKR {fmt(value as number)}</p>
                                        </CardContent></Card>
                                    ))}
                                </div>

                                {chartRows.length > 0 && (
                                    <Card className="shadow-sm"><CardContent className="p-5">
                                        <h2 className="text-lg font-bold text-slate-900 mb-3">Net profit by {by === 'opmc' ? 'OPMC' : 'project'}</h2>
                                        <div className="h-64 w-full">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <BarChart data={chartRows}>
                                                    <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" />
                                                    <XAxis dataKey="name" tick={{ fill: '#334155', fontSize: 10 }} interval={0} angle={-20} textAnchor="end" height={60} />
                                                    <YAxis tickFormatter={compact} tick={{ fill: '#334155', fontSize: 11 }} />
                                                    <Tooltip formatter={(v) => `LKR ${fmt(Number(v))}`} />
                                                    <Bar dataKey="net" name="Net profit">
                                                        {chartRows.map((r, i) => <Cell key={i} fill={r.net < 0 ? '#ef4444' : '#10b981'} />)}
                                                    </Bar>
                                                </BarChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </CardContent></Card>
                                )}

                                <Card className="shadow-sm"><CardContent className="p-5 overflow-x-auto">
                                    {data.rows.length === 0 ? <p className="text-sm text-slate-700">No postings in this period.</p> : (
                                        <table className="w-full text-sm">
                                            <thead><tr className="border-b border-slate-300 text-left text-slate-900">
                                                <th className="py-2 pr-3">{by === 'opmc' ? 'OPMC' : 'Project'}</th>
                                                <th className="py-2 pr-3 text-right">Revenue</th><th className="py-2 pr-3 text-right">Direct cost</th>
                                                <th className="py-2 pr-3 text-right">Opex</th><th className="py-2 pr-3 text-right">Net profit</th><th className="py-2 text-right">Margin</th>
                                            </tr></thead>
                                            <tbody>
                                                {data.rows.map((r) => (
                                                    <tr key={r.key ?? 'unattributed'} className="border-b border-slate-200 text-slate-900">
                                                        <td className="py-2 pr-3">
                                                            <span className={`font-semibold ${r.key === null ? 'italic' : ''}`}>{r.label}</span>
                                                            {r.sublabel && <span className="block text-xs text-slate-700">{r.sublabel}</span>}
                                                        </td>
                                                        <td className="py-2 pr-3 text-right">{fmt(r.revenue)}</td>
                                                        <td className="py-2 pr-3 text-right">{fmt(r.directCost)}</td>
                                                        <td className="py-2 pr-3 text-right">{fmt(r.opex)}</td>
                                                        <td className={`py-2 pr-3 text-right font-semibold ${r.netProfit < 0 ? 'text-red-700' : ''}`}>{fmt(r.netProfit)}</td>
                                                        <td className="py-2 text-right">{r.marginPct === null ? '—' : `${r.marginPct}%`}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    )}
                                </CardContent></Card>
                                <p className="text-xs text-slate-700">{data.note}</p>
                            </>
                        )}
                    </main>
                </div>
            </div>
        </RoleGuard>
    );
}

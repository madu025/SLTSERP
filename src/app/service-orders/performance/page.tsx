"use client";

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import RoleGuard from '@/components/RoleGuard';
import ExportCsvButton from '@/components/ExportCsvButton';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, Gauge } from 'lucide-react';
import { AGE_BUCKETS, type SodPerformanceReport, type TurnaroundRow, type AgeingRow } from '@/lib/sod-performance-shared';

type Tab = 'sla' | 'ageing' | 'capacity' | 'returns' | 'teams';
type Window = '7' | '30' | '90' | '365';

const TABS: { id: Tab; label: string }[] = [
    { id: 'sla', label: 'SLA & turnaround' },
    { id: 'ageing', label: 'Backlog ageing' },
    { id: 'capacity', label: 'Recovery capacity' },
    { id: 'returns', label: 'Return reasons' },
    { id: 'teams', label: 'Team productivity' },
];

const CATEGORY_LABEL: Record<string, string> = {
    PORT_SHORTAGE: 'Port shortage', INFRASTRUCTURE_ISSUE: 'Infrastructure issue', CUSTOMER_ABSENT: 'Customer absent / not ready',
    MATERIAL_SHORTAGE: 'Material shortage', OTHER: 'Other', NO_REASON: 'No reason recorded',
};

const pctTone = (v: number | null) => (v === null ? '' : v >= 90 ? 'bg-emerald-100 text-emerald-900' : v >= 70 ? 'bg-amber-100 text-amber-900' : 'bg-red-100 text-red-900');
const ageTone = (v: number) => (v === 0 ? 'text-slate-500' : 'text-slate-900 font-semibold');

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
    return (
        <Card className="shadow-sm"><CardContent className="p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-700">{label}</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{value}</p>
            {sub && <p className="text-xs text-slate-700">{sub}</p>}
        </CardContent></Card>
    );
}

function TurnaroundTable({ rows, label }: { rows: TurnaroundRow[]; label: string }) {
    return (
        <table className="w-full text-sm">
            <thead><tr className="border-b border-slate-300 text-left text-slate-900">
                <th className="py-2 pr-3">{label}</th><th className="py-2 pr-3 text-right">Completed</th><th className="py-2 pr-3 text-right">Median days</th>
                <th className="py-2 pr-3 text-right">P90 days</th><th className="py-2 pr-3 text-right">Average</th><th className="py-2 text-right">Within SLA</th>
            </tr></thead>
            <tbody>
                {rows.map((r) => (
                    <tr key={r.key} className="border-b border-slate-200 text-slate-900">
                        <td className="py-2 pr-3 font-medium">{r.label}</td>
                        <td className="py-2 pr-3 text-right">{r.completed.toLocaleString()}</td>
                        <td className="py-2 pr-3 text-right">{r.medianDays ?? '—'}</td>
                        <td className="py-2 pr-3 text-right">{r.p90Days ?? '—'}</td>
                        <td className="py-2 pr-3 text-right">{r.avgDays ?? '—'}</td>
                        <td className="py-2 text-right"><span className={`rounded px-2 py-0.5 font-semibold ${pctTone(r.slaPct)}`}>{r.slaPct === null ? '—' : `${r.slaPct}%`}</span></td>
                    </tr>
                ))}
            </tbody>
        </table>
    );
}

function AgeingTable({ rows, label }: { rows: AgeingRow[]; label: string }) {
    return (
        <table className="w-full text-sm">
            <thead><tr className="border-b border-slate-300 text-left text-slate-900">
                <th className="py-2 pr-3">{label}</th><th className="py-2 pr-3 text-right">Open</th>
                {AGE_BUCKETS.map((b) => <th key={b} className="py-2 pr-3 text-right">{b} d</th>)}
                <th className="py-2 text-right">Over 14 d</th>
            </tr></thead>
            <tbody>
                {rows.map((r) => (
                    <tr key={r.key} className="border-b border-slate-200 text-slate-900">
                        <td className="py-2 pr-3 font-medium">{r.label}</td>
                        <td className="py-2 pr-3 text-right font-semibold">{r.open.toLocaleString()}</td>
                        {AGE_BUCKETS.map((b) => <td key={b} className={`py-2 pr-3 text-right ${ageTone(r.buckets[b])}`}>{r.buckets[b]}</td>)}
                        <td className={`py-2 text-right ${r.over14 > 0 ? 'font-bold text-red-700' : ''}`}>{r.over14}</td>
                    </tr>
                ))}
            </tbody>
        </table>
    );
}

export default function SodPerformancePage() {
    const [tab, setTab] = useState<Tab>('sla');
    const [win, setWin] = useState<Window>('30');
    const range = useMemo(() => {
        const to = new Date();
        return { from: new Date(to.getTime() - Number(win) * 24 * 3600 * 1000), to };
    }, [win]);

    const { data, isLoading, error } = useQuery<SodPerformanceReport>({
        queryKey: ['sod-performance', win],
        queryFn: async ({ signal }) => {
            const params = new URLSearchParams({ from: range.from.toISOString(), to: range.to.toISOString() });
            const res = await fetch(`/api/service-orders/performance?${params}`, { cache: 'no-store', signal });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error?.message || 'Failed to load SOD performance');
            return json.data;
        },
        staleTime: 60_000,
        refetchOnWindowFocus: false,
    });

    const exportRows = () => {
        if (!data) return [];
        if (tab === 'sla') return [['RTOM', 'Completed', 'Median days', 'P90 days', 'Average days', 'Within SLA', 'SLA %'],
            ...data.turnaroundByRtom.map((r) => [r.label, r.completed, r.medianDays, r.p90Days, r.avgDays, r.withinSla, r.slaPct])];
        if (tab === 'ageing') return [['RTOM', 'Open', ...AGE_BUCKETS.map((b) => `${b} days`), 'Over 14 days'],
            ...data.ageingByRtom.map((r) => [r.label, r.open, ...AGE_BUCKETS.map((b) => r.buckets[b]), r.over14])];
        if (tab === 'capacity') return [['RTOM', 'Open', 'Completed last 14 days', 'Per day', 'Days to clear'],
            ...data.capacityByRtom.map((r) => [r.label, r.open, r.completedLast14Days, r.perDay, r.daysToClear])];
        if (tab === 'returns') return [['Reason', 'Orders', '%'], ...data.returnReasons.map((r) => [CATEGORY_LABEL[r.category] ?? r.category, r.count, r.pct])];
        return [['Team', 'Contractor', 'Completed', 'Active days', 'Per active day'],
            ...data.teamProductivity.map((t) => [t.teamName, t.contractorName, t.completed, t.activeDays, t.perActiveDay])];
    };

    const unassigned = data?.turnaroundByContractor.find((r) => r.key === 'NONE');
    const unassignedPct = data && unassigned && data.overall.completed > 0 ? Math.round((unassigned.completed / data.overall.completed) * 100) : 0;

    return (
        <RoleGuard>
            <div className="flex h-screen bg-slate-50 overflow-hidden">
                <Sidebar />
                <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                    <Header />
                    <main className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                                <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
                                    <Gauge className="w-7 h-7 text-indigo-600" />Service order performance
                                </h1>
                                <p className="text-sm text-slate-700 mt-1">Turnaround against the {data?.slaDays ?? 7}-day target, backlog ageing, recovery capacity, return reasons and team output.</p>
                            </div>
                            <div className="flex items-end gap-3">
                                <label className="text-xs font-semibold text-slate-900">Window
                                    <select value={win} onChange={(e) => setWin(e.target.value as Window)}
                                        className="mt-1 block rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900">
                                        <option value="7">Last 7 days</option><option value="30">Last 30 days</option>
                                        <option value="90">Last 90 days</option><option value="365">Last 12 months</option>
                                    </select>
                                </label>
                                <ExportCsvButton filename={`sod-${tab}.csv`} disabled={!data} getRows={exportRows} />
                            </div>
                        </div>

                        {isLoading && <div className="flex h-40 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /></div>}
                        {error && <p className="text-sm text-red-700">{(error as Error).message}</p>}

                        {data && (
                            <>
                                <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
                                    <Stat label="Completed in window" value={data.overall.completed.toLocaleString()} />
                                    <Stat label="Within SLA" value={data.overall.slaPct === null ? '—' : `${data.overall.slaPct}%`} sub={`target ${data.slaDays} days`} />
                                    <Stat label="Median turnaround" value={data.overall.medianDays === null ? '—' : `${data.overall.medianDays} d`} sub={data.overall.p90Days === null ? undefined : `90% done within ${data.overall.p90Days} d`} />
                                    <Stat label="Open backlog" value={data.ageingByRtom.reduce((a, r) => a + r.open, 0).toLocaleString()} sub={`${data.ageingByRtom.reduce((a, r) => a + r.over14, 0)} older than 14 days`} />
                                </div>

                                <div className="flex flex-wrap gap-1 rounded-xl border border-slate-200 bg-white p-1">
                                    {TABS.map((t) => (
                                        <button key={t.id} onClick={() => setTab(t.id)}
                                            className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${tab === t.id ? 'bg-indigo-700 text-white' : 'text-slate-900 hover:bg-slate-100'}`}>{t.label}</button>
                                    ))}
                                </div>

                                <Card className="shadow-sm"><CardContent className="p-5 overflow-x-auto space-y-6">
                                    {tab === 'sla' && (
                                        <>
                                            <div><h2 className="mb-2 font-bold text-slate-900">By RTOM</h2><TurnaroundTable rows={data.turnaroundByRtom} label="RTOM" /></div>
                                            <div>
                                                <h2 className="mb-1 font-bold text-slate-900">By contractor</h2>
                                                {unassignedPct > 0 && <p className="mb-2 text-xs text-slate-700">{unassignedPct}% of completed orders have no contractor recorded, so contractor figures cover only the assigned part.</p>}
                                                <TurnaroundTable rows={data.turnaroundByContractor} label="Contractor" />
                                            </div>
                                        </>
                                    )}
                                    {tab === 'ageing' && (
                                        <>
                                            <div><h2 className="mb-2 font-bold text-slate-900">Open orders by RTOM</h2><AgeingTable rows={data.ageingByRtom} label="RTOM" /></div>
                                            <div><h2 className="mb-2 font-bold text-slate-900">Open orders by contractor</h2><AgeingTable rows={data.ageingByContractor} label="Contractor" /></div>
                                        </>
                                    )}
                                    {tab === 'capacity' && (
                                        <div>
                                            <p className="mb-2 text-sm text-slate-900">Days to clear = open backlog divided by the daily completions of the last 14 days. Longest first.</p>
                                            <table className="w-full text-sm">
                                                <thead><tr className="border-b border-slate-300 text-left text-slate-900">
                                                    <th className="py-2 pr-3">RTOM</th><th className="py-2 pr-3 text-right">Open</th><th className="py-2 pr-3 text-right">Completed (14 d)</th>
                                                    <th className="py-2 pr-3 text-right">Per day</th><th className="py-2 text-right">Days to clear</th>
                                                </tr></thead>
                                                <tbody>
                                                    {data.capacityByRtom.map((r) => (
                                                        <tr key={r.key} className="border-b border-slate-200 text-slate-900">
                                                            <td className="py-2 pr-3 font-medium">{r.label}</td><td className="py-2 pr-3 text-right">{r.open}</td>
                                                            <td className="py-2 pr-3 text-right">{r.completedLast14Days}</td><td className="py-2 pr-3 text-right">{r.perDay}</td>
                                                            <td className="py-2 text-right">
                                                                <span className={`rounded px-2 py-0.5 font-semibold ${r.daysToClear === null ? 'bg-red-100 text-red-900' : r.daysToClear > 14 ? 'bg-red-100 text-red-900' : r.daysToClear > 7 ? 'bg-amber-100 text-amber-900' : 'bg-emerald-100 text-emerald-900'}`}>
                                                                    {r.daysToClear === null ? 'No recent output' : `${r.daysToClear} d`}
                                                                </span>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                    {tab === 'returns' && (
                                        <div>
                                            <p className="mb-2 text-sm text-slate-900">{data.returnedOrders.toLocaleString()} orders returned in the window, grouped from the free-text return reason.</p>
                                            {data.returnReasons.length === 0 ? <p className="text-sm text-slate-700">No returns in this window.</p> : (
                                                <ul className="space-y-2">
                                                    {data.returnReasons.map((r) => (
                                                        <li key={r.category}>
                                                            <div className="flex justify-between text-sm text-slate-900"><span>{CATEGORY_LABEL[r.category] ?? r.category}</span><span className="font-semibold">{r.count.toLocaleString()} · {r.pct}%</span></div>
                                                            <div className="mt-1 h-2 rounded bg-slate-200"><div className="h-2 rounded bg-indigo-600" style={{ width: `${r.pct}%` }} /></div>
                                                        </li>
                                                    ))}
                                                </ul>
                                            )}
                                        </div>
                                    )}
                                    {tab === 'teams' && (
                                        <table className="w-full text-sm">
                                            <thead><tr className="border-b border-slate-300 text-left text-slate-900">
                                                <th className="py-2 pr-3">Team</th><th className="py-2 pr-3">Contractor</th><th className="py-2 pr-3 text-right">Completed</th>
                                                <th className="py-2 pr-3 text-right">Active days</th><th className="py-2 text-right">Per active day</th>
                                            </tr></thead>
                                            <tbody>
                                                {data.teamProductivity.length === 0 && <tr><td colSpan={5} className="py-3 text-slate-700">No team output in this window.</td></tr>}
                                                {data.teamProductivity.map((t) => (
                                                    <tr key={t.teamId} className="border-b border-slate-200 text-slate-900">
                                                        <td className="py-2 pr-3 font-medium">{t.teamName}</td><td className="py-2 pr-3">{t.contractorName}</td>
                                                        <td className="py-2 pr-3 text-right">{t.completed}</td><td className="py-2 pr-3 text-right">{t.activeDays}</td>
                                                        <td className="py-2 text-right font-semibold">{t.perActiveDay ?? '—'}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    )}
                                </CardContent></Card>

                                <ul className="list-disc space-y-1 pl-5 text-xs text-slate-700">{data.notes.map((n) => <li key={n}>{n}</li>)}</ul>
                            </>
                        )}
                    </main>
                </div>
            </div>
        </RoleGuard>
    );
}

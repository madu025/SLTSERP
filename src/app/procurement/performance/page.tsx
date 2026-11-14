"use client";

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import RoleGuard from '@/components/RoleGuard';
import ExportCsvButton from '@/components/ExportCsvButton';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, Timer } from 'lucide-react';
import type { ProcurementReport } from '@/lib/supply-chain-shared';
import { AgeingBars, CompletedTrend, Panel, compact } from '@/app/dashboard/components/health/HealthCharts';

function Stat({ label, value, sub, tone = '' }: { label: string; value: string; sub?: string; tone?: string }) {
    return (
        <Card className="shadow-sm"><CardContent className="p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-700">{label}</p>
            <p className={`mt-1 text-2xl font-bold text-slate-900 ${tone}`}>{value}</p>
            {sub && <p className="text-xs text-slate-700">{sub}</p>}
        </CardContent></Card>
    );
}

const th = 'py-2 pr-3 text-left text-slate-900';
const dayTone = (d: number | null) => (d === null ? '' : d > 14 ? 'bg-red-100 text-red-900' : d > 7 ? 'bg-amber-100 text-amber-900' : 'bg-emerald-100 text-emerald-900');

export default function ProcurementPerformancePage() {
    const { data, isLoading, error } = useQuery<ProcurementReport>({
        queryKey: ['procurement-performance'],
        queryFn: async ({ signal }) => {
            const res = await fetch('/api/procurement/performance', { cache: 'no-store', signal });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error?.message || 'Failed to load procurement performance');
            return json.data;
        },
        staleTime: 60_000,
        refetchOnWindowFocus: false,
    });

    const exportRows = () => data ? [
        ['System', 'PO', 'Vendor', 'Expected delivery', 'Days late', 'Amount'],
        ...data.latePos.map((p) => [p.system, p.poNumber, p.vendor, p.expectedDelivery?.slice(0, 10) ?? '', p.daysLate, p.amount]),
    ] : [];

    return (
        <RoleGuard>
            <div className="flex h-screen bg-slate-50 overflow-hidden">
                <Sidebar />
                <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                    <Header />
                    <main className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2"><Timer className="w-7 h-7 text-indigo-600" />Procurement performance</h1>
                            <ExportCsvButton filename="late-purchase-orders.csv" disabled={!data} getRows={exportRows} />
                        </div>

                        {isLoading && <div className="flex h-40 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /></div>}
                        {error && <p className="text-sm text-red-700">{(error as Error).message}</p>}

                        {data && (
                            <>
                                <div className="grid grid-cols-2 gap-4 xl:grid-cols-5">
                                    <Stat label="Open store POs" value={String(data.store.openPos)} sub={`${data.store.noDeliveryDate} without a delivery date`} />
                                    <Stat label="Late store POs" value={String(data.store.late)} tone={data.store.late > 0 ? 'text-red-700' : ''} />
                                    <Stat label="Late project POs" value={String(data.project.late)} tone={data.project.late > 0 ? 'text-red-700' : ''} />
                                    <Stat label="Request to receipt" value={data.store.leadTime.medianDays === null ? '—' : `${data.store.leadTime.medianDays} d`} sub={data.store.leadTime.p90Days === null ? undefined : `90% within ${data.store.leadTime.p90Days} d`} />
                                    <Stat label="Project PO fulfilment" value={data.project.fulfilmentPct === null ? '—' : `${data.project.fulfilmentPct}%`} />
                                </div>

                                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                                    <Panel title="Late store POs by days late"><AgeingBars data={data.store.lateBuckets.map((b) => ({ name: `${b.bucket} d`, value: b.count }))} empty="No late purchase orders" /></Panel>
                                    <Panel title="Request to receipt, average days · 6 months">
                                        <CompletedTrend name="Average days" empty="No completed requests in the last 6 months" data={data.store.leadTimeMonthly.map((m) => ({ label: m.label, completed: m.avgDays ?? 0 }))} />
                                    </Panel>
                                </div>

                                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                                    <Panel title="Requests waiting for approval">
                                        <table className="w-full text-sm">
                                            <thead><tr className="border-b border-slate-300"><th className={th}>Waiting for</th><th className={`${th} text-right`}>Requests</th><th className={`${th} text-right`}>Oldest (days)</th></tr></thead>
                                            <tbody>
                                                {data.store.waiting.length === 0 && <tr><td colSpan={3} className="py-3 text-slate-700">No pending requests.</td></tr>}
                                                {data.store.waiting.map((w) => (
                                                    <tr key={w.label} className="border-b border-slate-200 text-slate-900">
                                                        <td className="py-2 pr-3 font-medium">{w.label}</td><td className="py-2 pr-3 text-right">{w.count}</td>
                                                        <td className="py-2 text-right"><span className={`rounded px-2 py-0.5 font-semibold ${dayTone(w.oldestDays)}`}>{w.oldestDays ?? '—'}</span></td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </Panel>
                                    <Panel title="Project purchase orders by status">
                                        <table className="w-full text-sm">
                                            <thead><tr className="border-b border-slate-300"><th className={th}>Status</th><th className={`${th} text-right`}>POs</th><th className={`${th} text-right`}>Amount</th></tr></thead>
                                            <tbody>
                                                {data.project.funnel.length === 0 && <tr><td colSpan={3} className="py-3 text-slate-700">No project purchase orders.</td></tr>}
                                                {data.project.funnel.map((f) => (
                                                    <tr key={f.status} className="border-b border-slate-200 text-slate-900">
                                                        <td className="py-2 pr-3 font-medium">{f.status.replace(/_/g, ' ')}</td><td className="py-2 pr-3 text-right">{f.count}</td><td className="py-2 text-right">{compact(f.amount)}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                        {data.project.pendingApproval.count > 0 && <p className="mt-2 text-xs font-semibold text-amber-800">{data.project.pendingApproval.count} waiting for approval, oldest {data.project.pendingApproval.oldestDays} days</p>}
                                    </Panel>
                                </div>

                                <Panel title={`Late purchase orders (${data.latePos.length})`}>
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm">
                                            <thead><tr className="border-b border-slate-300"><th className={th}>PO</th><th className={th}>Vendor</th><th className={th}>System</th><th className={`${th} text-right`}>Expected</th><th className={`${th} text-right`}>Days late</th><th className={`${th} text-right`}>Amount</th></tr></thead>
                                            <tbody>
                                                {data.latePos.length === 0 && <tr><td colSpan={6} className="py-3 text-slate-700">Nothing is late.</td></tr>}
                                                {data.latePos.map((p) => (
                                                    <tr key={`${p.system}-${p.id}`} className="border-b border-slate-200 text-slate-900">
                                                        <td className="py-2 pr-3 font-medium"><Link href={p.href} className="hover:underline">{p.poNumber}</Link></td>
                                                        <td className="py-2 pr-3">{p.vendor}</td><td className="py-2 pr-3">{p.system === 'STORE' ? 'Store' : 'Project'}</td>
                                                        <td className="py-2 pr-3 text-right">{p.expectedDelivery?.slice(0, 10)}</td>
                                                        <td className="py-2 pr-3 text-right"><span className={`rounded px-2 py-0.5 font-semibold ${dayTone(p.daysLate)}`}>{p.daysLate}</span></td>
                                                        <td className="py-2 text-right">{p.amount === null ? '—' : compact(p.amount)}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </Panel>
                            </>
                        )}
                    </main>
                </div>
            </div>
        </RoleGuard>
    );
}

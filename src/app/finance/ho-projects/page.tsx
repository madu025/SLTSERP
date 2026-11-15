"use client";

import { useQuery } from '@tanstack/react-query';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import RoleGuard from '@/components/RoleGuard';
import ExportCsvButton from '@/components/ExportCsvButton';
import { Loader2, Landmark } from 'lucide-react';
import { Panel } from '@/app/dashboard/components/health/HealthCharts';

interface Row { projectId: string; project: string; code: string | null; billed: number; sentToHo: number; collected: number; outstandingAtSlt: number; voucherRequested: number; voucherWithHo: number; voucherPaid: number; netWithHo: number }
const th = 'py-2 pr-3 text-right text-slate-900';

export default function HoProjectsPage() {
    const q = useQuery<Row[]>({
        queryKey: ['ho-projects'],
        queryFn: async () => {
            const res = await fetch('/api/finance/ho/projects', { cache: 'no-store' });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error?.message || 'Failed to load the position');
            return json.data ?? json;
        },
        staleTime: 15_000, retry: false,
    });
    const rows = q.data ?? [];
    const exportRows = () => [['Project', 'Code', 'Billed to SLT', 'Sent to Head Office', 'Collected by Head Office', 'Still owed by SLT', 'Payments requested', 'With Head Office', 'Paid by Head Office', 'Net with Head Office'], ...rows.map((r) => [r.project, r.code ?? '', r.billed, r.sentToHo, r.collected, r.outstandingAtSlt, r.voucherRequested, r.voucherWithHo, r.voucherPaid, r.netWithHo])];

    return (
        <RoleGuard>
            <div className="flex h-screen bg-slate-50 overflow-hidden">
                <Sidebar />
                <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                    <Header />
                    <main className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
                        <div className="flex flex-wrap items-end justify-between gap-3">
                            <div>
                                <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2"><Landmark className="w-7 h-7 text-indigo-600" />Project position with Head Office</h1>
                                <p className="mt-1 text-sm text-slate-700">Per project: what was billed to SLT, what Head Office has collected, and what Head Office has paid out for the project. Net is positive when Head Office holds more for OSP than it has paid.</p>
                            </div>
                            <ExportCsvButton filename="project-head-office-position.csv" disabled={rows.length === 0} getRows={exportRows} />
                        </div>
                        {q.isLoading && <Loader2 className="h-5 w-5 animate-spin text-blue-600" />}
                        {q.error && <p className="text-sm text-red-700">{(q.error as Error).message}</p>}
                        <Panel title={`Projects (${rows.length})`}>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead><tr className="border-b border-slate-300"><th className={`${th} text-left`}>Project</th><th className={th}>Billed to SLT</th><th className={th}>Sent to HO</th><th className={th}>Collected by HO</th><th className={th}>Still owed by SLT</th><th className={th}>Payments requested</th><th className={th}>With HO</th><th className={th}>Paid by HO</th><th className={th}>Net with HO</th></tr></thead>
                                    <tbody>
                                        {rows.length === 0 && !q.isLoading && <tr><td colSpan={9} className="py-3 text-slate-700">No projects have invoices submitted to SLT yet.</td></tr>}
                                        {rows.map((r) => (
                                            <tr key={r.projectId} className="border-b border-slate-200 text-slate-900" data-testid="hpj-row">
                                                <td className="py-2 pr-3 font-medium">{r.project}{r.code ? <span className="ml-1 text-xs text-slate-700">({r.code})</span> : null}</td>
                                                <td className="py-2 pr-3 text-right">{r.billed.toLocaleString()}</td><td className="py-2 pr-3 text-right">{r.sentToHo.toLocaleString()}</td><td className="py-2 pr-3 text-right" data-testid="hpj-collected">{r.collected.toLocaleString()}</td>
                                                <td className="py-2 pr-3 text-right">{r.outstandingAtSlt.toLocaleString()}</td><td className="py-2 pr-3 text-right">{r.voucherRequested.toLocaleString()}</td><td className="py-2 pr-3 text-right">{r.voucherWithHo.toLocaleString()}</td>
                                                <td className="py-2 pr-3 text-right" data-testid="hpj-paid">{r.voucherPaid.toLocaleString()}</td><td className="py-2 text-right font-semibold" data-testid="hpj-net">{r.netWithHo.toLocaleString()}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </Panel>
                    </main>
                </div>
            </div>
        </RoleGuard>
    );
}

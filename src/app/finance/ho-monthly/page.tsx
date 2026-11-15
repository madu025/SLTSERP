"use client";

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import RoleGuard from '@/components/RoleGuard';
import ExportCsvButton from '@/components/ExportCsvButton';
import { Loader2, CalendarCheck } from 'lucide-react';
import { Panel } from '@/app/dashboard/components/health/HealthCharts';

interface Row { kind: 'VENDOR' | 'CONTRACTOR'; id: string; number: string; payee: string; project: string | null; projectId: string | null; dueDate: string | null; overdue: boolean; outstanding: number; requested: number; withHeadOffice: number; unrequested: number; state: string }
interface Plan { month: string; rows: Row[]; totals: { due: number; requested: number; withHeadOffice: number; unrequested: number; overdue: number; paidByHeadOfficeThisMonth: number }; funding: { requested: number; approved: number; funded: number } | null }
const th = 'py-2 pr-3 text-left text-slate-900';
const STATE: Record<string, { label: string; tone: string }> = {
    NOT_REQUESTED: { label: 'Not requested', tone: 'bg-red-100 text-red-900' },
    REQUESTED: { label: 'Request in OSP', tone: 'bg-amber-100 text-amber-900' },
    WITH_HEAD_OFFICE: { label: 'With Head Office', tone: 'bg-indigo-100 text-indigo-900' },
};

export default function HoMonthlyPage() {
    const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
    const q = useQuery<Plan>({
        queryKey: ['ho-monthly', month],
        queryFn: async () => {
            const res = await fetch(`/api/finance/ho/monthly?month=${month}`, { cache: 'no-store' });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error?.message || 'Failed to load the plan');
            return json.data ?? json;
        },
        staleTime: 15_000, retry: false,
    });
    const d = q.data;
    const exportRows = () => [['Type', 'Document', 'Payee', 'Project', 'Due', 'Outstanding', 'Requested', 'With Head Office', 'Still to request', 'State'], ...(d?.rows ?? []).map((r) => [r.kind, r.number, r.payee, r.project ?? '', r.dueDate ?? '', r.outstanding, r.requested, r.withHeadOffice, r.unrequested, r.state])];
    const kpi = (label: string, value: number, id: string) => (
        <div className="rounded-lg border border-slate-300 bg-white p-4" data-testid={id}>
            <div className="text-xs font-semibold text-slate-900">{label}</div>
            <div className="mt-1 text-xl font-bold text-slate-900">{value.toLocaleString()}</div>
        </div>
    );

    return (
        <RoleGuard>
            <div className="flex h-screen bg-slate-50 overflow-hidden">
                <Sidebar />
                <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                    <Header />
                    <main className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
                        <div className="flex flex-wrap items-end justify-between gap-3">
                            <div>
                                <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2"><CalendarCheck className="w-7 h-7 text-indigo-600" />Monthly payments to Head Office</h1>
                                <p className="mt-1 text-sm text-slate-700">Everything owed to vendors and sub-contractors up to the end of the month, and where each payment stands. Request what is missing, send the approved ones to Head Office, and ask for the funding.</p>
                            </div>
                            <div className="flex items-end gap-3">
                                <label className="text-xs font-semibold text-slate-900">Month<input data-testid="hm-month" type="month" value={month} onChange={(e) => e.target.value && setMonth(e.target.value)} className="mt-1 block rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900" /></label>
                                <ExportCsvButton filename={`monthly-plan-${month}.csv`} disabled={!d || d.rows.length === 0} getRows={exportRows} />
                            </div>
                        </div>
                        {q.isLoading && <Loader2 className="h-5 w-5 animate-spin text-blue-600" />}
                        {q.error && <p className="text-sm text-red-700">{(q.error as Error).message}</p>}
                        {d && (
                            <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
                                {kpi('Due up to month end', d.totals.due, 'hm-due')}
                                {kpi('Overdue', d.totals.overdue, 'hm-overdue')}
                                {kpi('Still to request', d.totals.unrequested, 'hm-unrequested')}
                                {kpi('With Head Office', d.totals.withHeadOffice, 'hm-withho')}
                                {kpi('Paid by Head Office this month', d.totals.paidByHeadOfficeThisMonth, 'hm-paid')}
                            </div>
                        )}
                        {d?.funding && (
                            <p className="text-sm text-slate-900" data-testid="hm-funding">Funding asked for this month: requested {d.funding.requested.toLocaleString()} · approved {d.funding.approved.toLocaleString()} · funded {d.funding.funded.toLocaleString()}. <a className="font-semibold text-indigo-800 underline" href="/finance/ho-funding">Open funding requests</a></p>
                        )}
                        <Panel title={`Payables (${d?.rows.length ?? 0})`}>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead><tr className="border-b border-slate-300"><th className={th}>Type</th><th className={th}>Document</th><th className={th}>Payee</th><th className={th}>Project</th><th className={th}>Due</th><th className={`${th} text-right`}>Outstanding</th><th className={`${th} text-right`}>Requested</th><th className={`${th} text-right`}>Still to request</th><th className={th}>State</th><th /></tr></thead>
                                    <tbody>
                                        {(d?.rows.length ?? 0) === 0 && !q.isLoading && <tr><td colSpan={10} className="py-3 text-slate-700">Nothing is due for this month.</td></tr>}
                                        {(d?.rows ?? []).map((r) => (
                                            <tr key={r.id} className="border-b border-slate-200 text-slate-900" data-testid="hm-row">
                                                <td className="py-2 pr-3">{r.kind === 'VENDOR' ? 'Vendor' : 'Contractor'}</td><td className="py-2 pr-3 font-medium">{r.number}</td><td className="py-2 pr-3">{r.payee}</td><td className="py-2 pr-3">{r.project ?? '—'}</td>
                                                <td className={`py-2 pr-3 ${r.overdue ? 'font-bold text-red-700' : ''}`}>{r.dueDate ?? '—'}</td>
                                                <td className="py-2 pr-3 text-right">{r.outstanding.toLocaleString()}</td><td className="py-2 pr-3 text-right">{r.requested.toLocaleString()}</td><td className="py-2 pr-3 text-right font-semibold">{r.unrequested.toLocaleString()}</td>
                                                <td className="py-2 pr-3"><span className={`rounded px-2 py-0.5 font-semibold ${STATE[r.state]?.tone ?? ''}`}>{STATE[r.state]?.label ?? r.state}</span></td>
                                                <td className="py-2 text-right">
                                                    {r.unrequested > 0 && (r.kind === 'VENDOR'
                                                        ? <a data-testid="hm-request" href={`/finance/ho-payments?invoice=${r.id}`} className="rounded border border-indigo-300 bg-indigo-50 px-2 py-0.5 text-xs font-bold text-indigo-900 hover:bg-indigo-100">Request payment</a>
                                                        : <a data-testid="hm-request" href={`/projects/${r.projectId}`} className="rounded border border-indigo-300 bg-indigo-50 px-2 py-0.5 text-xs font-bold text-indigo-900 hover:bg-indigo-100">Open project</a>)}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            <div className="mt-3 flex flex-wrap gap-3 border-t border-slate-200 pt-3 text-sm">
                                <a href="/finance/ho-payments" className="rounded-md bg-indigo-700 px-4 py-2 font-semibold text-white hover:bg-indigo-800">Send approved requests to Head Office</a>
                                <a href="/finance/ho-funding" className="rounded-md border border-slate-300 bg-white px-4 py-2 font-semibold text-slate-900 hover:bg-slate-100">Ask Head Office for funding</a>
                            </div>
                        </Panel>
                    </main>
                </div>
            </div>
        </RoleGuard>
    );
}

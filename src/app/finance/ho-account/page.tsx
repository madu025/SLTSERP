"use client";

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import RoleGuard from '@/components/RoleGuard';
import ExportCsvButton from '@/components/ExportCsvButton';
import { Loader2, Landmark } from 'lucide-react';
import { Panel } from '@/app/dashboard/components/health/HealthCharts';

interface Row { date: string; type: string; reference: string; detail: string; paidOnBehalf: number; returned: number; balance: number }
const th = 'py-2 pr-3 text-left text-slate-900';
const TYPE: Record<string, string> = { PV_PAYMENT: 'Payment by Head Office', HO_FUNDING: 'Petty cash funded', PETTY_CASH_REIMBURSEMENT: 'Petty cash replenished', HO_COLLECTION: 'Collected from SLT by Head Office' };

export default function HoAccountPage() {
    const [from, setFrom] = useState('');
    const [to, setTo] = useState('');
    const q = useQuery<{ balance: number; rows: Row[] }>({
        queryKey: ['ho-account', from, to],
        queryFn: async () => {
            const p = new URLSearchParams();
            if (from) p.set('from', from);
            if (to) p.set('to', to);
            const res = await fetch(`/api/finance/ho/account?${p}`, { cache: 'no-store' });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error?.message || 'Failed to load the account');
            return json.data;
        },
        staleTime: 15_000, retry: false,
    });
    const rows = q.data?.rows ?? [];
    const exportRows = () => [['Date', 'Type', 'Reference', 'Detail', 'Paid on our behalf', 'Returned', 'Balance'], ...rows.map((r) => [r.date, TYPE[r.type] ?? r.type, r.reference, r.detail, r.paidOnBehalf, r.returned, r.balance])];

    return (
        <RoleGuard>
            <div className="flex h-screen bg-slate-50 overflow-hidden">
                <Sidebar />
                <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                    <Header />
                    <main className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
                        <div className="flex flex-wrap items-end justify-between gap-3">
                            <div>
                                <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2"><Landmark className="w-7 h-7 text-indigo-600" />Head Office account</h1>
                                <p className="mt-1 text-sm text-slate-700">What Head Office has paid or funded on OSP&apos;s behalf. Reconcile this statement with Head Office every month.</p>
                            </div>
                            <div className="flex items-end gap-3">
                                <label className="text-xs font-semibold text-slate-900">From<input data-testid="ha-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="mt-1 block rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900" /></label>
                                <label className="text-xs font-semibold text-slate-900">To<input data-testid="ha-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} className="mt-1 block rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900" /></label>
                                <ExportCsvButton filename="head-office-account.csv" disabled={rows.length === 0} getRows={exportRows} />
                            </div>
                        </div>

                        {q.isLoading && <Loader2 className="h-5 w-5 animate-spin text-blue-600" />}
                        {q.error && <p className="text-sm text-red-700">{(q.error as Error).message}</p>}
                        {q.data && (
                            <div className="rounded-lg border border-slate-300 bg-white p-4" data-testid="ha-balance">
                                <div className="text-xs font-semibold text-slate-900">Due to Head Office</div>
                                <div className="mt-1 text-2xl font-bold text-slate-900">{q.data.balance.toLocaleString()}</div>
                            </div>
                        )}

                        <Panel title={`Entries (${rows.length})`}>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead><tr className="border-b border-slate-300"><th className={th}>Date</th><th className={th}>Type</th><th className={th}>Reference</th><th className={th}>Detail</th><th className={`${th} text-right`}>Paid / funded</th><th className={`${th} text-right`}>Returned</th><th className={`${th} text-right`}>Balance</th></tr></thead>
                                    <tbody>
                                        {rows.length === 0 && !q.isLoading && <tr><td colSpan={7} className="py-3 text-slate-700">No entries yet.</td></tr>}
                                        {rows.map((r, i) => (
                                            <tr key={i} className="border-b border-slate-200 text-slate-900" data-testid="ha-row">
                                                <td className="py-2 pr-3">{r.date}</td><td className="py-2 pr-3">{TYPE[r.type] ?? r.type}</td><td className="py-2 pr-3 font-medium">{r.reference}</td><td className="py-2 pr-3">{r.detail}</td>
                                                <td className="py-2 pr-3 text-right">{r.paidOnBehalf ? r.paidOnBehalf.toLocaleString() : ''}</td><td className="py-2 pr-3 text-right">{r.returned ? r.returned.toLocaleString() : ''}</td><td className="py-2 text-right font-semibold">{r.balance.toLocaleString()}</td>
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

"use client";

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import RoleGuard from '@/components/RoleGuard';
import ExportCsvButton from '@/components/ExportCsvButton';
import { Loader2, Landmark } from 'lucide-react';
import { Panel } from '@/app/dashboard/components/health/HealthCharts';

interface Rec { id: string; month: string; ledgerBalance: number; hoBalance: number; difference: number; status: string; note: string | null; recordedAt: string }
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
    const qc = useQueryClient();
    const [rMonth, setRMonth] = useState(() => new Date().toISOString().slice(0, 7));
    const [rBalance, setRBalance] = useState('');
    const [rNote, setRNote] = useState('');
    const recs = useQuery<{ history: Rec[]; ledgerBalance: number | null }>({
        queryKey: ['ho-recs', rMonth],
        queryFn: async () => {
            const res = await fetch(`/api/finance/ho/reconciliation?month=${rMonth}`, { cache: 'no-store' });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error?.message || 'Failed to load reconciliations');
            return json.data ?? json;
        },
        staleTime: 10_000, retry: false,
    });
    const record = useMutation({
        mutationFn: async () => {
            const res = await fetch('/api/finance/ho/reconciliation', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ month: rMonth, hoBalance: Number(rBalance), note: rNote || undefined }) });
            const json = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(json?.error?.message || 'Could not record the reconciliation');
            return json.data ?? json;
        },
        onSuccess: () => { toast.success('Reconciliation recorded'); setRBalance(''); setRNote(''); qc.invalidateQueries({ queryKey: ['ho-recs'] }); },
        onError: (e: Error) => toast.error(e.message),
    });
    const ledgerAt = recs.data?.ledgerBalance ?? null;
    const liveDiff = ledgerAt !== null && rBalance !== '' ? Math.round((ledgerAt - Number(rBalance)) * 100) / 100 : null;
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

                        <Panel title="Month-end reconciliation with Head Office">
                            <p className="mb-3 text-sm text-slate-700">Enter the closing balance on Head Office&apos;s own statement. A month with no difference is marked reconciled and is final; a difference needs an explanation.</p>
                            <div className="flex flex-wrap items-end gap-3">
                                <label className="text-xs font-semibold text-slate-900">Month<input data-testid="hr-month" type="month" value={rMonth} onChange={(e) => e.target.value && setRMonth(e.target.value)} className="mt-1 block rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900" /></label>
                                <div className="text-sm text-slate-900">Our ledger at month end: <span className="font-bold" data-testid="hr-ledger">{ledgerAt === null ? '…' : ledgerAt.toLocaleString()}</span></div>
                                <label className="text-xs font-semibold text-slate-900">Head Office closing balance<input data-testid="hr-ho" type="number" value={rBalance} onChange={(e) => setRBalance(e.target.value)} className="mt-1 block rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900" /></label>
                                <label className="text-xs font-semibold text-slate-900">Note<input data-testid="hr-note" value={rNote} onChange={(e) => setRNote(e.target.value)} className="mt-1 block w-64 rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900" /></label>
                                <button data-testid="hr-go" disabled={rBalance === '' || record.isPending} onClick={() => record.mutate()} className="rounded-md bg-indigo-700 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-800 disabled:opacity-50">Record reconciliation</button>
                                {liveDiff !== null && <span className={`text-sm font-bold ${liveDiff === 0 ? 'text-emerald-800' : 'text-red-700'}`} data-testid="hr-diff">Difference {liveDiff.toLocaleString()}</span>}
                            </div>
                            <table className="mt-4 w-full text-sm">
                                <thead><tr className="border-b border-slate-300"><th className={th}>Month</th><th className={`${th} text-right`}>Our ledger</th><th className={`${th} text-right`}>Head Office</th><th className={`${th} text-right`}>Difference</th><th className={th}>Status</th><th className={th}>Note</th></tr></thead>
                                <tbody>
                                    {(recs.data?.history ?? []).length === 0 && <tr><td colSpan={6} className="py-3 text-slate-700">No month has been reconciled yet.</td></tr>}
                                    {(recs.data?.history ?? []).map((r) => (
                                        <tr key={r.id} className="border-b border-slate-200 text-slate-900" data-testid="hr-row">
                                            <td className="py-2 pr-3 font-medium">{r.month}</td><td className="py-2 pr-3 text-right">{r.ledgerBalance.toLocaleString()}</td><td className="py-2 pr-3 text-right">{r.hoBalance.toLocaleString()}</td><td className="py-2 pr-3 text-right">{r.difference.toLocaleString()}</td>
                                            <td className="py-2 pr-3"><span className={`rounded px-2 py-0.5 font-semibold ${r.status === 'RECONCILED' ? 'bg-emerald-100 text-emerald-900' : 'bg-amber-100 text-amber-900'}`}>{r.status}</span></td><td className="py-2 pr-3">{r.note ?? ''}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </Panel>

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

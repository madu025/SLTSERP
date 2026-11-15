"use client";

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import RoleGuard from '@/components/RoleGuard';
import { Loader2, Landmark } from 'lucide-react';
import { Panel, compact } from '@/app/dashboard/components/health/HealthCharts';

interface Funding { id: string; requestNumber: string; purpose: string; status: string; requestedAmount: number; approvedAmount: number; fundedAmount: number; hoReference: string | null; remarks: string | null; createdAt: string }
interface Position { requested: number; approved: number; funded: number; submittedUnpaid: { count: number; amount: number }; confirmedPaid: { count: number; amount: number }; paymentsAllocationLeft: number; dueToHeadOffice: number }
interface Suggestion { vouchers: { count: number; amount: number }; invoices: { count: number; uncoveredAmount: number }; total: number }
interface PettyAccount { id: string; name: string; imprestLimit: number | string; currentBalance: number | string }

const th = 'py-2 pr-3 text-left text-slate-900';
const input = 'mt-1 block w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900';
const PURPOSE: Record<string, string> = { PAYMENTS: 'Payments due', PETTY_CASH_FLOAT: 'Petty cash float', PETTY_CASH_REPLENISH: 'Petty cash replenishment' };
const TONE: Record<string, string> = { DRAFT: 'bg-slate-100 text-slate-900', SUBMITTED: 'bg-amber-100 text-amber-900', APPROVED: 'bg-blue-100 text-blue-900', FUNDED: 'bg-emerald-100 text-emerald-900', REJECTED: 'bg-red-100 text-red-900', CANCELLED: 'bg-red-100 text-red-900' };

async function api<T>(url: string, init?: RequestInit): Promise<T> {
    const res = await fetch(url, { cache: 'no-store', ...init, headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) } });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json?.error?.message || (typeof json?.error === 'string' ? json.error : '') || 'Request failed');
    return (json.data ?? json) as T;
}

const Kpi = ({ label, value, sub, id }: { label: string; value: string; sub?: string; id: string }) => (
    <div className="rounded-lg border border-slate-300 bg-white p-4" data-testid={id}>
        <div className="text-xs font-semibold text-slate-900">{label}</div>
        <div className="mt-1 text-2xl font-bold text-slate-900">{value}</div>
        {sub && <div className="mt-0.5 text-xs text-slate-700">{sub}</div>}
    </div>
);

export default function HoFundingPage() {
    const qc = useQueryClient();
    const [purpose, setPurpose] = useState('PAYMENTS');
    const [amount, setAmount] = useState('');
    const [periodTo, setPeriodTo] = useState(() => new Date(Date.now() + 14 * 864e5).toISOString().slice(0, 10));
    const [accountId, setAccountId] = useState('');
    const [remarks, setRemarks] = useState('');
    const [act, setAct] = useState<{ id: string; mode: 'APPROVE' | 'FUND' | 'REJECT'; amount: number } | null>(null);
    const [aAmount, setAAmount] = useState('');
    const [aRef, setARef] = useState('');
    const [aDate, setADate] = useState(new Date().toISOString().slice(0, 10));
    const [aReason, setAReason] = useState('');

    const position = useQuery<Position>({ queryKey: ['hf-position'], queryFn: () => api('/api/finance/ho/funding?position=1'), staleTime: 15_000, retry: false });
    const list = useQuery<Funding[]>({ queryKey: ['hf-list'], queryFn: () => api('/api/finance/ho/funding'), staleTime: 10_000 });
    const accounts = useQuery<PettyAccount[]>({ queryKey: ['hf-petty'], queryFn: async () => { const r = await api<PettyAccount[] | { data: PettyAccount[] }>('/api/finance/petty-cash/accounts'); return Array.isArray(r) ? r : (r as { data: PettyAccount[] }).data ?? []; }, staleTime: 60_000 });
    const refresh = () => { qc.invalidateQueries({ queryKey: ['hf-list'] }); qc.invalidateQueries({ queryKey: ['hf-position'] }); qc.invalidateQueries({ queryKey: ['hf-petty'] }); };

    const suggest = useMutation({
        mutationFn: () => api<Suggestion>(`/api/finance/ho/funding?suggest=${periodTo}`),
        onSuccess: (s) => { setAmount(String(s.total)); setRemarks(`${s.vouchers.count} request(s) with Head Office or approved (${s.vouchers.amount.toLocaleString()}) and ${s.invoices.count} approved invoice(s) not yet requested (${s.invoices.uncoveredAmount.toLocaleString()})`); },
        onError: (e: Error) => toast.error(e.message),
    });
    const post = useMutation({
        mutationFn: (body: Record<string, unknown>) => api('/api/finance/ho/funding', { method: 'POST', body: JSON.stringify(body) }),
        onSuccess: () => { toast.success('Done'); setAct(null); setAmount(''); setRemarks(''); setARef(''); setAReason(''); refresh(); },
        onError: (e: Error) => toast.error(e.message),
    });

    const rows = list.data ?? [];
    const p = position.data;

    return (
        <RoleGuard>
            <div className="flex h-screen bg-slate-50 overflow-hidden">
                <Sidebar />
                <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                    <Header />
                    <main className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
                        <div>
                            <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2"><Landmark className="w-7 h-7 text-indigo-600" />Head Office funding</h1>
                            <p className="mt-1 text-sm text-slate-700">OSP Finance asks for funds; Head Office approves (all or part) and provides them. Petty cash funding tops up the imprest.</p>
                        </div>

                        {position.isLoading && <Loader2 className="h-5 w-5 animate-spin text-blue-600" />}
                        {position.error && <p className="text-sm text-red-700">{(position.error as Error).message}</p>}
                        {p && (
                            <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
                                <Kpi id="hf-kpi-requested" label="Requested" value={compact(p.requested)} />
                                <Kpi id="hf-kpi-approved" label="Approved by HO" value={compact(p.approved)} />
                                <Kpi id="hf-kpi-funded" label="Funded" value={compact(p.funded)} />
                                <Kpi id="hf-kpi-with-ho" label="With Head Office, unpaid" value={compact(p.submittedUnpaid.amount)} sub={`${p.submittedUnpaid.count} request(s)`} />
                                <Kpi id="hf-kpi-paid" label="Paid by Head Office" value={compact(p.confirmedPaid.amount)} sub={`${p.confirmedPaid.count} request(s)`} />
                                <Kpi id="hf-kpi-due" label="Due to Head Office" value={compact(p.dueToHeadOffice)} sub="current account" />
                            </div>
                        )}

                        <Panel title="New funding request">
                            <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                                <label className="text-xs font-semibold text-slate-900">Purpose
                                    <select data-testid="hf-purpose" value={purpose} onChange={(e) => setPurpose(e.target.value)} className={input}>
                                        <option value="PAYMENTS">Payments due</option><option value="PETTY_CASH_FLOAT">Petty cash float</option>
                                    </select>
                                </label>
                                {purpose === 'PAYMENTS' ? (
                                    <label className="text-xs font-semibold text-slate-900">Needed up to
                                        <input data-testid="hf-period" type="date" value={periodTo} onChange={(e) => setPeriodTo(e.target.value)} className={input} />
                                    </label>
                                ) : (
                                    <label className="text-xs font-semibold text-slate-900">Petty cash account
                                        <select data-testid="hf-account" value={accountId} onChange={(e) => setAccountId(e.target.value)} className={input}>
                                            <option value="">Choose…</option>
                                            {(accounts.data ?? []).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                                        </select>
                                    </label>
                                )}
                                <label className="text-xs font-semibold text-slate-900">Amount
                                    <input data-testid="hf-amount" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} className={input} />
                                </label>
                                <label className="text-xs font-semibold text-slate-900">Remarks
                                    <input data-testid="hf-remarks" value={remarks} onChange={(e) => setRemarks(e.target.value)} className={input} />
                                </label>
                            </div>
                            <div className="mt-3 flex gap-2">
                                {purpose === 'PAYMENTS' && <button data-testid="hf-suggest" onClick={() => suggest.mutate()} disabled={suggest.isPending} className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100 disabled:opacity-50">Suggest from payments due</button>}
                                <button data-testid="hf-create" disabled={post.isPending || !Number(amount) || (purpose !== 'PAYMENTS' && !accountId)} onClick={() => post.mutate({ action: 'CREATE', purpose, requestedAmount: Number(amount), periodTo: purpose === 'PAYMENTS' ? periodTo : undefined, pettyCashAccountId: purpose === 'PAYMENTS' ? undefined : accountId, remarks: remarks || undefined })} className="rounded-md bg-indigo-700 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-800 disabled:opacity-50">Create request</button>
                            </div>
                        </Panel>

                        <Panel title={`Funding requests (${rows.length})`}>
                            {list.isLoading && <Loader2 className="h-5 w-5 animate-spin text-blue-600" />}
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead><tr className="border-b border-slate-300"><th className={th}>Request</th><th className={th}>Purpose</th><th className={`${th} text-right`}>Requested</th><th className={`${th} text-right`}>Approved</th><th className={`${th} text-right`}>Funded</th><th className={th}>Status</th><th className={th}>HO reference</th><th className={`${th} text-right`}>Actions</th></tr></thead>
                                    <tbody>
                                        {rows.length === 0 && !list.isLoading && <tr><td colSpan={8} className="py-3 text-slate-700">No funding requests yet.</td></tr>}
                                        {rows.map((r) => (
                                            <tr key={r.id} className="border-b border-slate-200 text-slate-900" data-testid="hf-row">
                                                <td className="py-2 pr-3 font-medium">{r.requestNumber}</td><td className="py-2 pr-3">{PURPOSE[r.purpose] ?? r.purpose}</td>
                                                <td className="py-2 pr-3 text-right">{r.requestedAmount.toLocaleString()}</td><td className="py-2 pr-3 text-right">{r.approvedAmount ? r.approvedAmount.toLocaleString() : '—'}</td><td className="py-2 pr-3 text-right">{r.fundedAmount ? r.fundedAmount.toLocaleString() : '—'}</td>
                                                <td className="py-2 pr-3"><span className={`rounded px-2 py-0.5 font-semibold ${TONE[r.status] ?? ''}`} data-testid="hf-status">{r.status}</span></td>
                                                <td className="py-2 pr-3">{r.hoReference ?? '—'}</td>
                                                <td className="py-2 text-right whitespace-nowrap">
                                                    {r.status === 'DRAFT' && <button data-testid="hf-submit" onClick={() => post.mutate({ action: 'SUBMIT', id: r.id })} className="ml-1.5 rounded border border-slate-300 bg-white px-2 py-0.5 text-xs font-bold text-slate-900 hover:bg-slate-100">Submit to HO</button>}
                                                    {['DRAFT', 'SUBMITTED', 'APPROVED'].includes(r.status) && <button data-testid="hf-cancel" onClick={() => post.mutate({ action: 'CANCEL', id: r.id })} className="ml-1.5 rounded border border-slate-300 bg-white px-2 py-0.5 text-xs font-bold text-slate-900 hover:bg-slate-100">Cancel</button>}
                                                    {r.status === 'SUBMITTED' && <>
                                                        <button data-testid="hf-approve" onClick={() => { setAct({ id: r.id, mode: 'APPROVE', amount: r.requestedAmount }); setAAmount(String(r.requestedAmount)); }} className="ml-1.5 rounded border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-xs font-bold text-emerald-900 hover:bg-emerald-100">Approve</button>
                                                        <button data-testid="hf-reject" onClick={() => setAct({ id: r.id, mode: 'REJECT', amount: 0 })} className="ml-1.5 rounded border border-red-300 bg-red-50 px-2 py-0.5 text-xs font-bold text-red-900 hover:bg-red-100">Reject</button>
                                                    </>}
                                                    {r.status === 'APPROVED' && <button data-testid="hf-fund" onClick={() => { setAct({ id: r.id, mode: 'FUND', amount: r.approvedAmount }); setAAmount(String(r.approvedAmount)); }} className="ml-1.5 rounded border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-xs font-bold text-emerald-900 hover:bg-emerald-100">Mark funded</button>}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </Panel>

                        {act && (
                            <Panel title={act.mode === 'APPROVE' ? 'Approve (Head Office)' : act.mode === 'FUND' ? 'Confirm funds provided (Head Office)' : 'Reject (Head Office)'}>
                                <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                                    {act.mode !== 'REJECT' && (
                                        <label className="text-xs font-semibold text-slate-900">{act.mode === 'APPROVE' ? 'Approved amount' : 'Funded amount'}
                                            <input data-testid="hf-act-amount" type="number" value={aAmount} onChange={(e) => setAAmount(e.target.value)} className={input} />
                                        </label>
                                    )}
                                    {act.mode === 'FUND' && (<>
                                        <label className="text-xs font-semibold text-slate-900">Head Office reference
                                            <input data-testid="hf-act-ref" value={aRef} onChange={(e) => setARef(e.target.value)} className={input} />
                                        </label>
                                        <label className="text-xs font-semibold text-slate-900">Date
                                            <input data-testid="hf-act-date" type="date" value={aDate} onChange={(e) => setADate(e.target.value)} className={input} />
                                        </label>
                                    </>)}
                                    {act.mode === 'REJECT' && (
                                        <label className="text-xs font-semibold text-slate-900 md:col-span-2">Reason
                                            <input data-testid="hf-act-reason" value={aReason} onChange={(e) => setAReason(e.target.value)} className={input} />
                                        </label>
                                    )}
                                    <div className="flex items-end gap-2">
                                        <button data-testid="hf-act-go" disabled={post.isPending} onClick={() => post.mutate(act.mode === 'APPROVE' ? { action: 'APPROVE', id: act.id, approvedAmount: Number(aAmount) } : act.mode === 'FUND' ? { action: 'FUND', id: act.id, hoReference: aRef, fundedDate: aDate, fundedAmount: Number(aAmount) } : { action: 'REJECT', id: act.id, reason: aReason })} className="rounded-md bg-indigo-700 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-800 disabled:opacity-50">Confirm</button>
                                        <button onClick={() => setAct(null)} className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900">Close</button>
                                    </div>
                                </div>
                            </Panel>
                        )}
                    </main>
                </div>
            </div>
        </RoleGuard>
    );
}

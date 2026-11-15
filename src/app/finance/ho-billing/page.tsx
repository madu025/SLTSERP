"use client";

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import RoleGuard from '@/components/RoleGuard';
import { Loader2, FileInput } from 'lucide-react';
import { Panel } from '@/app/dashboard/components/health/HealthCharts';

interface Ready { id: string; invoiceNumber: string; title: string; project: string | null; totalAmount: number; balanceAmount: number; dueDate: string | null; submittedAt: string | null; submissionReference: string | null; hoCollectionStatus: string; hoReturnReason: string | null }
interface PackInvoice { id: string; invoiceNumber: string; title: string; project: string | null; status: string; total: number; collected: number; balance: number; submissionReference: string | null }
interface Pack { id: string; batchNumber: string; status: string; totalAmount: number; invoiceCount: number; collected: number; submittedAt: string; invoices: PackInvoice[] }
interface PackLine { invoiceNumber: string; project: string | null; title: string; periodFrom: string; periodTo: string; invoiceDate: string; dueDate: string; submissionReference: string | null; submittedToSltOn: string; subtotal: number; vat: number; sscl: number; withholding: number; total: number; collected: number; balance: number; status: string; sentBy: string | null }

const th = 'py-2 pr-3 text-left text-slate-900';
const input = 'mt-1 block w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900';
const TONE: Record<string, string> = { SENT_TO_HO: 'bg-indigo-100 text-indigo-900', PARTIALLY_COLLECTED: 'bg-amber-100 text-amber-900', COLLECTED: 'bg-emerald-100 text-emerald-900', RETURNED: 'bg-red-100 text-red-900' };
const LABEL: Record<string, string> = { SENT_TO_HO: 'WITH HEAD OFFICE', COLLECTED: 'COLLECTED BY HEAD OFFICE', PARTIALLY_COLLECTED: 'PART COLLECTED' };

async function api<T>(url: string, init?: RequestInit): Promise<T> {
    const res = await fetch(url, { cache: 'no-store', ...init, headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) } });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json?.error?.message || (typeof json?.error === 'string' ? json.error : '') || 'Request failed');
    return (json.data ?? json) as T;
}

function downloadCsv(name: string, rows: (string | number | null)[][]) {
    const csv = rows.map((r) => r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\r\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    a.download = name;
    a.click();
    URL.revokeObjectURL(a.href);
}

export default function HoBillingPage() {
    const qc = useQueryClient();
    const [picked, setPicked] = useState<string[]>([]);
    const [note, setNote] = useState('');
    const [act, setAct] = useState<{ inv: PackInvoice; mode: 'COLLECT' | 'RETURN' } | null>(null);
    const [amount, setAmount] = useState('');
    const [hoRef, setHoRef] = useState('');
    const [hoDate, setHoDate] = useState(new Date().toISOString().slice(0, 10));
    const [reason, setReason] = useState('');

    const ready = useQuery<Ready[]>({ queryKey: ['hb-ready'], queryFn: () => api('/api/finance/ho/billing?ready=1'), staleTime: 10_000 });
    const packs = useQuery<Pack[]>({ queryKey: ['hb-packs'], queryFn: () => api('/api/finance/ho/billing'), staleTime: 10_000 });
    const refresh = () => { qc.invalidateQueries({ queryKey: ['hb-ready'] }); qc.invalidateQueries({ queryKey: ['hb-packs'] }); };

    const send = useMutation({
        mutationFn: () => api('/api/finance/ho/billing', { method: 'POST', body: JSON.stringify({ action: 'SEND', invoiceIds: picked, note: note || undefined }) }),
        onSuccess: () => { toast.success('Billing pack sent to Head Office'); setPicked([]); setNote(''); refresh(); },
        onError: (e: Error) => toast.error(e.message),
    });
    const decide = useMutation({
        mutationFn: () => {
            if (!act) throw new Error('Nothing selected');
            const body = act.mode === 'COLLECT'
                ? { action: 'COLLECT', invoiceId: act.inv.id, amount: Number(amount || act.inv.balance), hoReference: hoRef, hoDate: new Date(`${hoDate}T00:00:00.000Z`).toISOString() }
                : { action: 'RETURN', invoiceId: act.inv.id, reason };
            return api('/api/finance/ho/billing', { method: 'POST', body: JSON.stringify(body) });
        },
        onSuccess: () => { toast.success('Updated'); setAct(null); setAmount(''); setHoRef(''); setReason(''); refresh(); },
        onError: (e: Error) => toast.error(e.message),
    });
    const downloadPack = async (p: Pack) => {
        try {
            const pack = await api<{ batchNumber: string; lines: PackLine[] }>(`/api/finance/ho/billing/${p.id}`);
            downloadCsv(`${pack.batchNumber}.csv`, [
                ['Invoice', 'Project', 'Title', 'Period from', 'Period to', 'Invoice date', 'Due', 'SLT submission ref', 'Submitted to SLT', 'Subtotal', 'VAT', 'SSCL', 'Withholding', 'Invoice total', 'Collected', 'Balance', 'Status', 'Sent by'],
                ...pack.lines.map((l) => [l.invoiceNumber, l.project, l.title, l.periodFrom, l.periodTo, l.invoiceDate, l.dueDate, l.submissionReference, l.submittedToSltOn, l.subtotal, l.vat, l.sscl, l.withholding, l.total, l.collected, l.balance, l.status, l.sentBy]),
            ]);
        } catch (e) { toast.error((e as Error).message); }
    };

    const rows = ready.data ?? [];
    const pickedTotal = rows.filter((r) => picked.includes(r.id)).reduce((a, r) => a + r.balanceAmount, 0);

    return (
        <RoleGuard>
            <div className="flex h-screen bg-slate-50 overflow-hidden">
                <Sidebar />
                <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                    <Header />
                    <main className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
                        <div>
                            <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2"><FileInput className="w-7 h-7 text-indigo-600" />Billing to Head Office</h1>
                            <p className="mt-1 text-sm text-slate-700">Client invoices already submitted to SLT are sent to Head Office as a record. Head Office collects from SLT and confirms each collection with its own reference.</p>
                        </div>

                        <Panel title={`Ready to send to Head Office (${rows.length})`}>
                            {ready.isLoading && <Loader2 className="h-5 w-5 animate-spin text-blue-600" />}
                            {ready.error && <p className="text-sm text-red-700">{(ready.error as Error).message}</p>}
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead><tr className="border-b border-slate-300"><th className={th} /><th className={th}>Invoice</th><th className={th}>Project</th><th className={th}>SLT reference</th><th className={th}>Due</th><th className={`${th} text-right`}>Balance</th><th className={th}>Note</th></tr></thead>
                                    <tbody>
                                        {rows.length === 0 && !ready.isLoading && <tr><td colSpan={7} className="py-3 text-slate-700">No client invoices are waiting to be sent.</td></tr>}
                                        {rows.map((r) => (
                                            <tr key={r.id} className="border-b border-slate-200 text-slate-900" data-testid="hb-ready">
                                                <td className="py-2 pr-2"><input data-testid="hb-pick" type="checkbox" checked={picked.includes(r.id)} onChange={(e) => setPicked(e.target.checked ? [...picked, r.id] : picked.filter((x) => x !== r.id))} /></td>
                                                <td className="py-2 pr-3 font-medium">{r.invoiceNumber}</td><td className="py-2 pr-3">{r.project ?? '—'}</td><td className="py-2 pr-3">{r.submissionReference ?? '—'}</td>
                                                <td className="py-2 pr-3">{r.dueDate ? r.dueDate.slice(0, 10) : '—'}</td><td className="py-2 pr-3 text-right">{r.balanceAmount.toLocaleString()}</td>
                                                <td className="py-2 pr-3">{r.hoCollectionStatus === 'RETURNED' ? <span className="rounded bg-red-100 px-2 py-0.5 font-semibold text-red-900">Returned: {r.hoReturnReason}</span> : ''}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            {rows.length > 0 && (
                                <div className="mt-3 flex flex-wrap items-end gap-3 border-t border-slate-200 pt-3">
                                    <label className="text-xs font-semibold text-slate-900">Note for Head Office
                                        <input data-testid="hb-note" value={note} onChange={(e) => setNote(e.target.value)} className={`${input} w-72`} />
                                    </label>
                                    <button data-testid="hb-send" disabled={picked.length === 0 || send.isPending} onClick={() => send.mutate()} className="rounded-md bg-indigo-700 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-800 disabled:opacity-50">Send {picked.length || ''} selected to Head Office{picked.length ? ` (${pickedTotal.toLocaleString()})` : ''}</button>
                                </div>
                            )}
                        </Panel>

                        {act && (
                            <Panel title={act.mode === 'COLLECT' ? `Confirm collection: ${act.inv.invoiceNumber} (balance ${act.inv.balance.toLocaleString()})` : `Return ${act.inv.invoiceNumber} to OSP Finance`}>
                                <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                                    {act.mode === 'COLLECT' ? (<>
                                        <label className="text-xs font-semibold text-slate-900">Amount collected
                                            <input data-testid="hb-amount" type="number" value={amount} placeholder={String(act.inv.balance)} onChange={(e) => setAmount(e.target.value)} className={input} />
                                        </label>
                                        <label className="text-xs font-semibold text-slate-900">Head Office reference
                                            <input data-testid="hb-ref" value={hoRef} onChange={(e) => setHoRef(e.target.value)} className={input} />
                                        </label>
                                        <label className="text-xs font-semibold text-slate-900">Date collected
                                            <input data-testid="hb-date" type="date" value={hoDate} onChange={(e) => setHoDate(e.target.value)} className={input} />
                                        </label>
                                    </>) : (
                                        <label className="text-xs font-semibold text-slate-900 md:col-span-3">Reason
                                            <input data-testid="hb-reason" value={reason} onChange={(e) => setReason(e.target.value)} className={input} />
                                        </label>
                                    )}
                                    <div className="flex items-end gap-2">
                                        <button data-testid="hb-go" disabled={decide.isPending || (act.mode === 'COLLECT' ? !hoRef.trim() : !reason.trim())} onClick={() => decide.mutate()} className="rounded-md bg-indigo-700 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-800 disabled:opacity-50">{act.mode === 'COLLECT' ? 'Confirm collected' : 'Return invoice'}</button>
                                        <button onClick={() => setAct(null)} className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900">Close</button>
                                    </div>
                                </div>
                            </Panel>
                        )}

                        <Panel title={`Billing packs sent to Head Office (${(packs.data ?? []).length})`}>
                            {(packs.data ?? []).length === 0 && !packs.isLoading && <p className="text-sm text-slate-700">No packs sent yet.</p>}
                            {(packs.data ?? []).map((p) => (
                                <div key={p.id} className="mb-4 rounded border border-slate-300 bg-white p-3" data-testid="hb-pack">
                                    <div className="flex flex-wrap items-center justify-between gap-2 text-slate-900">
                                        <div><span className="font-bold">{p.batchNumber}</span> <span className="text-sm">· sent {String(p.submittedAt).slice(0, 10)} · {p.invoiceCount} invoice(s) · {p.totalAmount.toLocaleString()}</span> <span className={`ml-2 rounded px-2 py-0.5 text-xs font-semibold ${TONE[p.status === 'SENT' ? 'SENT_TO_HO' : p.status] ?? ''}`} data-testid="hb-pack-status">{p.status.replace('_', ' ')}</span></div>
                                        <button data-testid="hb-download" onClick={() => downloadPack(p)} className="rounded border border-slate-300 bg-white px-2 py-0.5 text-xs font-bold text-slate-900 hover:bg-slate-100">Download pack</button>
                                    </div>
                                    <table className="mt-2 w-full text-sm">
                                        <thead><tr className="border-b border-slate-300"><th className={th}>Invoice</th><th className={th}>Project</th><th className={`${th} text-right`}>Total</th><th className={`${th} text-right`}>Collected</th><th className={`${th} text-right`}>Balance</th><th className={th}>Status</th><th className={`${th} text-right`}>Head Office</th></tr></thead>
                                        <tbody>
                                            {p.invoices.map((i) => (
                                                <tr key={i.id} className="border-b border-slate-200 text-slate-900" data-testid="hb-invoice">
                                                    <td className="py-2 pr-3 font-medium">{i.invoiceNumber}</td><td className="py-2 pr-3">{i.project ?? '—'}</td>
                                                    <td className="py-2 pr-3 text-right">{i.total.toLocaleString()}</td><td className="py-2 pr-3 text-right">{i.collected.toLocaleString()}</td><td className="py-2 pr-3 text-right">{i.balance.toLocaleString()}</td>
                                                    <td className="py-2 pr-3"><span className={`rounded px-2 py-0.5 font-semibold ${TONE[i.status] ?? ''}`} data-testid="hb-status">{LABEL[i.status] ?? i.status.replace('_', ' ')}</span></td>
                                                    <td className="py-2 text-right whitespace-nowrap">
                                                        {['SENT_TO_HO', 'PARTIALLY_COLLECTED'].includes(i.status) && <button data-testid="hb-collect" onClick={() => { setAct({ inv: i, mode: 'COLLECT' }); setAmount(''); }} className="ml-1.5 rounded border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-xs font-bold text-emerald-900 hover:bg-emerald-100">Confirm collected</button>}
                                                        {i.status === 'SENT_TO_HO' && <button data-testid="hb-return" onClick={() => setAct({ inv: i, mode: 'RETURN' })} className="ml-1.5 rounded border border-slate-300 bg-white px-2 py-0.5 text-xs font-bold text-slate-900 hover:bg-slate-100">Return</button>}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ))}
                        </Panel>
                    </main>
                </div>
            </div>
        </RoleGuard>
    );
}

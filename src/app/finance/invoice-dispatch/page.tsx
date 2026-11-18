"use client";

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import RoleGuard from '@/components/RoleGuard';
import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';
import { Loader2, Send } from 'lucide-react';

interface Inv {
    id: string; invoiceNumber: string; totalAmount: string | number; month: number | null; year: number | null; rtomArea: string | null;
    ospSentAt: string | null; ospNote: string | null; contractor: { name: string } | null; _count: { sods: number };
}
interface HoInv extends Inv { vouchers: Array<{ pvNumber: string; status: string; amount: number; hoReference: string | null; hoPaidDate: string | null }> }
interface Board { ready: Inv[]; withManagers: Inv[]; approved: HoInv[]; beforeVerify: number }
interface Outcome { invoiceNumber: string; message?: string }
interface Result { done: Outcome[]; failed: Outcome[] }

const th = 'py-2 pr-3 text-left text-xs font-bold uppercase tracking-wide text-slate-900';
const money = (v: string | number) => `Rs. ${Number(v || 0).toLocaleString('en-LK', { maximumFractionDigits: 2 })}`;
const day = (d: string | null) => (d ? new Date(d).toLocaleDateString('en-GB') : '-');
const VOUCHER_LABEL: Record<string, string> = { DRAFT: 'Request drafted', PENDING_APPROVAL: 'Request awaiting approval', APPROVED: 'Approved, not yet with Head Office', SUBMITTED_TO_HO: 'With Head Office', PAID: 'Paid by Head Office' };

export default function InvoiceDispatchPage() {
    const qc = useQueryClient();
    const [picked, setPicked] = useState<Set<string>>(new Set());
    const [result, setResult] = useState<Result | null>(null);

    const q = useQuery<Board>({
        queryKey: ['invoice-dispatch'],
        queryFn: async () => {
            const res = await fetch('/api/finance/invoice-dispatch', { cache: 'no-store' });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error?.message || 'Failed to load the invoices');
            return json.data ?? json;
        },
        staleTime: 10_000, retry: false,
    });
    const ready = useMemo(() => q.data?.ready ?? [], [q.data]);
    const allPicked = ready.length > 0 && ready.every((i) => picked.has(i.id));

    const send = useMutation({
        mutationFn: async (ids: string[]) => {
            const res = await fetch('/api/finance/invoice-dispatch', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ invoiceIds: ids }) });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error?.message || 'Could not send the invoices');
            return (json.data ?? json) as Result;
        },
        onSuccess: (r) => {
            if (r.done.length > 0) toast.success(`${r.done.length} invoice${r.done.length === 1 ? '' : 's'} sent to the OSP managers`);
            if (r.failed.length > 0) toast.error(`${r.failed.length} could not be sent`);
            setResult(r); setPicked(new Set());
            qc.invalidateQueries({ queryKey: ['invoice-dispatch'] });
        },
        onError: (e: Error) => toast.error(e.message),
    });

    const toggle = (id: string) => setPicked((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; });
    const ids = [...picked];

    return (
        <RoleGuard permissionId={RBAC_PERMISSIONS.FINANCE_WRITE}>
            <div className="flex h-screen bg-slate-50 overflow-hidden">
                <Sidebar />
                <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                    <Header />
                    <main className="flex-1 overflow-y-auto p-4 md:p-6 space-y-5">
                        <div>
                            <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2"><Send className="w-7 h-7 text-indigo-700" />Send Invoices to OSP Managers</h1>
                            <p className="mt-1 text-sm text-slate-800">These contractor invoices were confirmed by the contractor and verified by OSP Quality. Send them to the OSP managers for approval. Approved invoices then go to Head Office for payment, and Head Office&apos;s reference shows here.</p>
                        </div>

                        {q.data && (
                            <div className="flex flex-wrap gap-2 text-xs font-bold text-slate-900">
                                <span className="rounded-full border border-emerald-400 bg-emerald-100 px-3 py-1">Ready to send {q.data.ready.length}</span>
                                <span className="rounded-full border border-amber-400 bg-amber-100 px-3 py-1">With OSP managers {q.data.withManagers.length}</span>
                                <span className="rounded-full border border-sky-400 bg-sky-100 px-3 py-1">Approved, to Head Office {q.data.approved.length}</span>
                                <span className="rounded-full border border-slate-400 bg-slate-100 px-3 py-1">Not verified yet {q.data.beforeVerify}</span>
                            </div>
                        )}

                        {result && result.failed.length > 0 && (
                            <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-slate-900" role="alert">
                                <p className="font-bold text-red-900">Not sent ({result.failed.length})</p>
                                <ul className="mt-1 list-disc pl-5">{result.failed.slice(0, 20).map((f) => <li key={f.invoiceNumber}><span className="font-semibold">{f.invoiceNumber}</span>: {f.message}</li>)}</ul>
                            </div>
                        )}

                        {q.isLoading ? <div className="py-8 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-slate-700" /></div>
                            : q.isError ? <p className="text-sm text-red-800">{(q.error as Error).message}</p> : (
                                <>
                                    <section className="rounded-xl border border-slate-200 bg-white p-4">
                                        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                                            <h2 className="text-base font-bold text-slate-900">Ready to send</h2>
                                            <button type="button" disabled={ids.length === 0 || send.isPending} onClick={() => send.mutate(ids)} className="h-9 rounded-md bg-emerald-700 px-4 text-sm font-bold text-white disabled:opacity-50">{send.isPending ? 'Sending...' : `Send selected (${ids.length}) to OSP managers`}</button>
                                        </div>
                                        {ready.length === 0 ? <p className="text-sm text-slate-900">No verified invoices are waiting to be sent.</p> : (
                                            <div className="overflow-x-auto">
                                                <table className="w-full text-sm">
                                                    <thead><tr className="border-b border-slate-300">
                                                        <th className={th}><input type="checkbox" checked={allPicked} onChange={() => setPicked(allPicked ? new Set() : new Set(ready.map((i) => i.id)))} aria-label="Select all" /></th>
                                                        <th className={th}>Invoice</th><th className={th}>Contractor</th><th className={th}>Area</th><th className={th}>Period</th><th className={th}>Orders</th><th className={th}>Total</th><th className={th}>Returned note</th>
                                                    </tr></thead>
                                                    <tbody>
                                                        {ready.map((i) => (
                                                            <tr key={i.id} className="border-b border-slate-200 text-slate-900">
                                                                <td className="py-2 pr-3"><input type="checkbox" checked={picked.has(i.id)} onChange={() => toggle(i.id)} aria-label={`Select ${i.invoiceNumber}`} /></td>
                                                                <td className="py-2 pr-3 font-mono font-semibold">{i.invoiceNumber}</td>
                                                                <td className="py-2 pr-3">{i.contractor?.name ?? '-'}</td>
                                                                <td className="py-2 pr-3">{i.rtomArea ?? '-'}</td>
                                                                <td className="py-2 pr-3">{i.month && i.year ? `${i.month}/${i.year}` : '-'}</td>
                                                                <td className="py-2 pr-3">{i._count.sods}</td>
                                                                <td className="py-2 pr-3 font-semibold">{money(i.totalAmount)}</td>
                                                                <td className="py-2 pr-3 text-xs">{i.ospNote ? <span className="font-semibold text-red-800">Returned: {i.ospNote}</span> : '-'}</td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        )}
                                    </section>

                                    <section className="rounded-xl border border-slate-200 bg-white p-4">
                                        <h2 className="mb-3 text-base font-bold text-slate-900">With the OSP managers</h2>
                                        {q.data!.withManagers.length === 0 ? <p className="text-sm text-slate-900">Nothing is waiting for an OSP manager.</p> : (
                                            <table className="w-full text-sm">
                                                <thead><tr className="border-b border-slate-300"><th className={th}>Invoice</th><th className={th}>Contractor</th><th className={th}>Total</th><th className={th}>Sent</th></tr></thead>
                                                <tbody>{q.data!.withManagers.map((i) => (
                                                    <tr key={i.id} className="border-b border-slate-200 text-slate-900"><td className="py-2 pr-3 font-mono font-semibold">{i.invoiceNumber}</td><td className="py-2 pr-3">{i.contractor?.name ?? '-'}</td><td className="py-2 pr-3 font-semibold">{money(i.totalAmount)}</td><td className="py-2 pr-3">{day(i.ospSentAt)}</td></tr>
                                                ))}</tbody>
                                            </table>
                                        )}
                                    </section>

                                    <section className="rounded-xl border border-slate-200 bg-white p-4">
                                        <h2 className="mb-1 text-base font-bold text-slate-900">Approved, with Head Office</h2>
                                        <p className="mb-3 text-xs text-slate-800">Payment requests are made on Finance, Head Office Run. Head Office pays and gives its reference.</p>
                                        {q.data!.approved.length === 0 ? <p className="text-sm text-slate-900">No approved invoices yet.</p> : (
                                            <table className="w-full text-sm">
                                                <thead><tr className="border-b border-slate-300"><th className={th}>Invoice</th><th className={th}>Contractor</th><th className={th}>Total</th><th className={th}>Where it stands</th><th className={th}>Head Office reference</th></tr></thead>
                                                <tbody>{q.data!.approved.map((i) => (
                                                    <tr key={i.id} className="border-b border-slate-200 align-top text-slate-900">
                                                        <td className="py-2 pr-3 font-mono font-semibold">{i.invoiceNumber}</td>
                                                        <td className="py-2 pr-3">{i.contractor?.name ?? '-'}</td>
                                                        <td className="py-2 pr-3 font-semibold">{money(i.totalAmount)}</td>
                                                        <td className="py-2 pr-3 text-xs">{i.vouchers.length === 0 ? 'No payment request yet' : i.vouchers.map((v) => <div key={v.pvNumber}>{v.pvNumber}: {VOUCHER_LABEL[v.status] ?? v.status}</div>)}</td>
                                                        <td className="py-2 pr-3 text-xs font-semibold">{i.vouchers.filter((v) => v.hoReference).map((v) => <div key={v.pvNumber}>{v.hoReference} ({day(v.hoPaidDate)})</div>)}{i.vouchers.every((v) => !v.hoReference) && '-'}</td>
                                                    </tr>
                                                ))}</tbody>
                                            </table>
                                        )}
                                    </section>
                                </>
                            )}
                    </main>
                </div>
            </div>
        </RoleGuard>
    );
}

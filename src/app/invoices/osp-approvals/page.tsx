"use client";

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import RoleGuard from '@/components/RoleGuard';
import { Loader2, BadgeCheck } from 'lucide-react';

interface Inv {
    id: string; invoiceNumber: string; totalAmount: string | number; amountA: string | number; amountB: string | number; month: number | null; year: number | null;
    rtomArea: string | null; ospSentAt: string | null; contractor: { name: string } | null; _count: { sods: number };
}
interface Outcome { invoiceNumber: string; message?: string }
interface Result { done: Outcome[]; failed: Outcome[] }

const th = 'py-2 pr-3 text-left text-xs font-bold uppercase tracking-wide text-slate-900';
const money = (v: string | number) => `Rs. ${Number(v || 0).toLocaleString('en-LK', { maximumFractionDigits: 2 })}`;
const day = (d: string | null) => (d ? new Date(d).toLocaleDateString('en-GB') : '-');

export default function OspApprovalsPage() {
    const qc = useQueryClient();
    const [picked, setPicked] = useState<Set<string>>(new Set());
    const [reason, setReason] = useState('');
    const [result, setResult] = useState<Result | null>(null);

    const q = useQuery<Inv[]>({
        queryKey: ['osp-invoice-approvals'],
        queryFn: async () => {
            const res = await fetch('/api/invoices/osp-approvals', { cache: 'no-store' });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error?.message || 'Failed to load the invoices');
            return json.data ?? json;
        },
        staleTime: 10_000, retry: false,
    });
    const invoices = useMemo(() => q.data ?? [], [q.data]);
    const allPicked = invoices.length > 0 && invoices.every((i) => picked.has(i.id));

    const act = useMutation({
        mutationFn: async (v: { action: 'APPROVE' | 'RETURN'; ids: string[] }) => {
            const res = await fetch('/api/invoices/osp-approvals', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: v.action, invoiceIds: v.ids, note: v.action === 'RETURN' ? reason : undefined }) });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error?.message || 'Action failed');
            return { action: v.action, data: (json.data ?? json) as Result };
        },
        onSuccess: ({ action, data }) => {
            if (data.done.length > 0) toast.success(action === 'APPROVE' ? `${data.done.length} invoice${data.done.length === 1 ? '' : 's'} approved` : `${data.done.length} invoice${data.done.length === 1 ? '' : 's'} returned to Finance`);
            if (data.failed.length > 0) toast.error(`${data.failed.length} could not be ${action === 'APPROVE' ? 'approved' : 'returned'}`);
            setResult(data); setPicked(new Set()); if (action === 'RETURN') setReason('');
            qc.invalidateQueries({ queryKey: ['osp-invoice-approvals'] });
        },
        onError: (e: Error) => toast.error(e.message),
    });

    const toggle = (id: string) => setPicked((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; });
    const ids = [...picked];

    return (
        <RoleGuard>
            <div className="flex h-screen bg-slate-50 overflow-hidden">
                <Sidebar />
                <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                    <Header />
                    <main className="flex-1 overflow-y-auto p-4 md:p-6 space-y-5">
                        <div>
                            <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2"><BadgeCheck className="w-7 h-7 text-indigo-700" />OSP Manager Invoice Approvals</h1>
                            <p className="mt-1 text-sm text-slate-800">Finance sends you contractor invoices that the contractor confirmed and OSP Quality verified. Approve them one by one or many at once, or return them to Finance with a reason. Approved invoices go to Head Office for payment. You cannot approve an invoice you sent yourself.</p>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                            <button type="button" disabled={ids.length === 0 || act.isPending} onClick={() => act.mutate({ action: 'APPROVE', ids })} className="h-9 rounded-md bg-emerald-700 px-4 text-sm font-bold text-white disabled:opacity-50">{act.isPending ? 'Working...' : `Approve selected (${ids.length})`}</button>
                            <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason to return" aria-label="Reason to return" className="h-9 w-64 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-600" />
                            <button type="button" disabled={ids.length === 0 || reason.trim().length < 3 || act.isPending} onClick={() => act.mutate({ action: 'RETURN', ids })} className="h-9 rounded-md border border-red-700 bg-white px-4 text-sm font-bold text-red-800 disabled:opacity-50">Return selected</button>
                        </div>

                        {result && result.failed.length > 0 && (
                            <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-slate-900" role="alert">
                                <p className="font-bold text-red-900">Not changed ({result.failed.length})</p>
                                <ul className="mt-1 list-disc pl-5">{result.failed.slice(0, 20).map((f) => <li key={f.invoiceNumber}><span className="font-semibold">{f.invoiceNumber}</span>: {f.message}</li>)}</ul>
                            </div>
                        )}

                        <div className="rounded-xl border border-slate-200 bg-white p-4">
                            {q.isLoading ? <div className="py-8 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-slate-700" /></div>
                                : q.isError ? <p className="text-sm text-red-800">{(q.error as Error).message}</p>
                                    : invoices.length === 0 ? <p className="text-sm text-slate-900">No invoices are waiting for your approval.</p> : (
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-sm">
                                                <thead><tr className="border-b border-slate-300">
                                                    <th className={th}><input type="checkbox" checked={allPicked} onChange={() => setPicked(allPicked ? new Set() : new Set(invoices.map((i) => i.id)))} aria-label="Select all" /></th>
                                                    <th className={th}>Invoice</th><th className={th}>Contractor</th><th className={th}>Area</th><th className={th}>Period</th><th className={th}>Orders</th>
                                                    <th className={th}>Total</th><th className={th}>Part A / Part B</th><th className={th}>Sent by Finance</th><th className={th}></th>
                                                </tr></thead>
                                                <tbody>
                                                    {invoices.map((i) => (
                                                        <tr key={i.id} className="border-b border-slate-200 text-slate-900">
                                                            <td className="py-2 pr-3"><input type="checkbox" checked={picked.has(i.id)} onChange={() => toggle(i.id)} aria-label={`Select ${i.invoiceNumber}`} /></td>
                                                            <td className="py-2 pr-3 font-mono font-semibold">{i.invoiceNumber}</td>
                                                            <td className="py-2 pr-3">{i.contractor?.name ?? '-'}</td>
                                                            <td className="py-2 pr-3">{i.rtomArea ?? '-'}</td>
                                                            <td className="py-2 pr-3">{i.month && i.year ? `${i.month}/${i.year}` : '-'}</td>
                                                            <td className="py-2 pr-3">{i._count.sods}</td>
                                                            <td className="py-2 pr-3 font-semibold">{money(i.totalAmount)}</td>
                                                            <td className="py-2 pr-3 text-xs">{money(i.amountA)} / {money(i.amountB)}</td>
                                                            <td className="py-2 pr-3 whitespace-nowrap">{day(i.ospSentAt)}</td>
                                                            <td className="py-2 whitespace-nowrap">
                                                                <a href={`/public/invoices/${i.id}`} target="_blank" rel="noreferrer" className="mr-2 text-xs font-bold text-indigo-800 underline">View invoice</a>
                                                                <button type="button" disabled={act.isPending} onClick={() => act.mutate({ action: 'APPROVE', ids: [i.id] })} className="rounded bg-emerald-700 px-3 py-1 text-xs font-bold text-white disabled:opacity-50">Approve</button>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                        </div>
                    </main>
                </div>
            </div>
        </RoleGuard>
    );
}

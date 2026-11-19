"use client";

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import RoleGuard from '@/components/RoleGuard';
import { Loader2, ShieldCheck } from 'lucide-react';

interface QueueInvoice {
    id: string; invoiceNumber: string; totalAmount: string | number; amountA: string | number; amountB: string | number;
    month: number | null; year: number | null; rtomArea: string | null; contractorConfirmedAt: string | null; createdAt: string;
    contractor: { name: string } | null; _count: { sods: number };
}
interface Queue { ready: QueueInvoice[]; inApproval: number }

const th = 'py-2 pr-3 text-left text-xs font-bold uppercase tracking-wide text-slate-900';
const money = (v: string | number) => `Rs. ${Number(v || 0).toLocaleString('en-LK', { maximumFractionDigits: 2 })}`;
const day = (d: string | null) => (d ? new Date(d).toLocaleDateString('en-GB') : '-');

export default function OspQualityQueuePage() {
    const qc = useQueryClient();
    const q = useQuery<Queue>({
        queryKey: ['osp-quality-queue'],
        queryFn: async () => {
            const res = await fetch('/api/finance/sf-audit/queue', { cache: 'no-store' });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error?.message || 'Failed to load the OSP Quality queue');
            return json.data ?? json;
        },
        staleTime: 10_000, retry: false,
    });

    const verify = useMutation({
        mutationFn: async (id: string) => {
            const res = await fetch(`/api/invoices/${id}/sf-audit-approve`, { method: 'POST' });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error?.message || 'Could not verify the invoice');
            return json.data ?? json;
        },
        onSuccess: (d: { message?: string }) => { toast.success(d.message || 'Invoice verified'); qc.invalidateQueries({ queryKey: ['osp-quality-queue'] }); },
        onError: (e: Error) => toast.error(e.message),
    });

    const ready = q.data?.ready ?? [];

    // Verify many at once: each invoice goes through the same single-invoice endpoint, one after the other
    const [picked, setPicked] = useState<string[]>([]);
    const verifyMany = useMutation({
        mutationFn: async (ids: string[]) => {
            const failed: string[] = [];
            for (const id of ids) {
                const res = await fetch(`/api/invoices/${id}/sf-audit-approve`, { method: 'POST' });
                if (!res.ok) { const json = await res.json().catch(() => ({})); failed.push(json?.error?.message || 'could not verify'); }
            }
            return { done: ids.length - failed.length, failed };
        },
        onSuccess: (r: { done: number; failed: string[] }) => {
            setPicked([]);
            if (r.failed.length === 0) toast.success(`${r.done} invoice${r.done === 1 ? '' : 's'} verified`);
            else toast.warning(`${r.done} verified, ${r.failed.length} not verified: ${r.failed[0]}`);
            qc.invalidateQueries({ queryKey: ['osp-quality-queue'] });
        },
        onError: (e: Error) => toast.error(e.message),
    });
    const allPicked = ready.length > 0 && ready.every((i) => picked.includes(i.id));

    return (
        <RoleGuard>
            <div className="flex h-screen bg-slate-50 overflow-hidden">
                <Sidebar />
                <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                    <Header />
                    <main className="flex-1 overflow-y-auto p-4 md:p-6 space-y-5">
                        <div>
                            <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2"><ShieldCheck className="w-7 h-7 text-indigo-700" />OSP Quality: invoices to verify</h1>
                            <p className="mt-1 text-sm text-slate-800">An invoice appears here after the contractor accepted it and the Area Manager approved it. Check it, then verify it so it can go to Finance.</p>
                        </div>

                        {q.data && (
                            <div className="flex flex-wrap gap-2 text-xs font-bold text-slate-900">
                                <span className="rounded-full border border-emerald-400 bg-emerald-100 px-3 py-1">Ready to verify {ready.length}</span>
                                <span className="rounded-full border border-amber-400 bg-amber-100 px-3 py-1">Still in area approval {q.data.inApproval}</span>
                            </div>
                        )}

                        <div className="rounded-xl border border-slate-200 bg-white p-4">
                            {ready.length > 1 && (
                                <div className="mb-3">
                                    <button type="button" disabled={picked.length === 0 || verifyMany.isPending} onClick={() => verifyMany.mutate(picked)} className="rounded bg-emerald-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{verifyMany.isPending ? 'Verifying...' : `Verify selected (${picked.length})`}</button>
                                </div>
                            )}
                            {q.isLoading ? <div className="py-8 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-slate-700" /></div>
                                : q.isError ? <p className="text-sm text-red-800">{(q.error as Error).message}</p>
                                    : ready.length === 0 ? <p className="text-sm text-slate-900">No invoices are waiting for verification.</p> : (
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-sm">
                                                <thead><tr className="border-b border-slate-300">
                                                    <th className={th}><input type="checkbox" aria-label="Select all" checked={allPicked} onChange={(e) => setPicked(e.target.checked ? ready.map((i) => i.id) : [])} /></th><th className={th}>Invoice</th><th className={th}>Contractor</th><th className={th}>Area</th><th className={th}>Period</th>
                                                    <th className={th}>Orders</th><th className={th}>Total</th><th className={th}>Confirmed by contractor</th><th className={th}></th>
                                                </tr></thead>
                                                <tbody>
                                                    {ready.map((i) => (
                                                        <tr key={i.id} className="border-b border-slate-200 text-slate-900">
                                                            <td className="py-2 pr-3"><input type="checkbox" aria-label={`Select ${i.invoiceNumber}`} checked={picked.includes(i.id)} onChange={(e) => setPicked(e.target.checked ? [...picked, i.id] : picked.filter((x) => x !== i.id))} /></td>
                                                            <td className="py-2 pr-3 font-mono font-semibold">{i.invoiceNumber}</td>
                                                            <td className="py-2 pr-3">{i.contractor?.name ?? '-'}</td>
                                                            <td className="py-2 pr-3">{i.rtomArea ?? '-'}</td>
                                                            <td className="py-2 pr-3">{i.month && i.year ? `${i.month}/${i.year}` : '-'}</td>
                                                            <td className="py-2 pr-3">{i._count.sods}</td>
                                                            <td className="py-2 pr-3 font-semibold">{money(i.totalAmount)}</td>
                                                            <td className="py-2 pr-3 whitespace-nowrap">{day(i.contractorConfirmedAt)}</td>
                                                            <td className="py-2 whitespace-nowrap">
                                                                <a href={`/public/invoices/${i.id}`} target="_blank" rel="noreferrer" className="mr-2 text-xs font-bold text-indigo-800 underline">View invoice</a>
                                                                <button type="button" disabled={verify.isPending} onClick={() => verify.mutate(i.id)} className="rounded bg-emerald-700 px-3 py-1 text-xs font-bold text-white disabled:opacity-50">Verify</button>
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

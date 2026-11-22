"use client";

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

interface Order { id: string; soNum: string; rtom: string; customerName: string | null; completedDate: string | null; contractorAmount: number; material: string[] }
const money = (n: number) => `Rs. ${n.toLocaleString('en-LK', { maximumFractionDigits: 2 })}`;
const day = (d: string | null) => (d ? new Date(d).toLocaleDateString('en-GB') : '-');
const th = 'py-2 pr-3 text-left text-xs font-bold uppercase tracking-wide text-slate-900';

export default function ContractorVerifyOrdersPage() {
    const qc = useQueryClient();
    const [picked, setPicked] = useState<Set<string>>(new Set());
    const [note, setNote] = useState('');

    const q = useQuery<Order[]>({
        queryKey: ['contractor-verify-sods'],
        queryFn: async () => {
            const res = await fetch('/api/contractor/verify-sods', { cache: 'no-store' });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error?.message || 'Failed to load the orders');
            return json.data ?? json;
        },
        staleTime: 10_000, retry: false,
    });
    const orders = q.data ?? [];
    const toggle = (ids: string[], on: boolean) => setPicked((p) => { const n = new Set(p); ids.forEach((id) => (on ? n.add(id) : n.delete(id))); return n; });

    const act = useMutation({
        mutationFn: async (body: Record<string, unknown>) => {
            const res = await fetch('/api/contractor/verify-sods', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error?.message || 'Action failed');
            return { action: body.action as string, data: json.data ?? json };
        },
        onSuccess: ({ action, data }) => {
            if (action === 'VERIFY') toast.success(`${data.verified} order${data.verified === 1 ? '' : 's'} verified`);
            else toast.success(`${data.returned} order${data.returned === 1 ? '' : 's'} sent back to the check`);
            setPicked(new Set()); setNote('');
            qc.invalidateQueries({ queryKey: ['contractor-verify-sods'] });
        },
        onError: (e: Error) => toast.error(e.message),
    });
    const ids = [...picked];

    return (
        <div className="space-y-4 p-4">
            <div>
                <h1 className="text-xl font-bold text-white">Verify completed orders</h1>
                <p className="mt-1 text-sm text-slate-200">These orders of your team were checked by the Area Coordinator or the QC Officer. Check the material and the customer. Tick the correct ones and press <span className="font-bold">Verify</span>; they then go to the Engineer for invoicing. If something is wrong, tick the order, write what is wrong and press <span className="font-bold">Report a problem</span>: it goes back to the check.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-300 bg-white p-3">
                <span className="text-sm font-bold text-slate-900">{ids.length} selected</span>
                <button type="button" onClick={() => toggle(orders.map((o) => o.id), ids.length !== orders.length)} className="h-9 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-900">{ids.length === orders.length && orders.length > 0 ? 'Clear selection' : 'Select all'}</button>
                <button type="button" disabled={ids.length === 0 || act.isPending} onClick={() => act.mutate({ action: 'VERIFY', sodIds: ids })} className="h-9 rounded-md bg-emerald-700 px-4 text-sm font-bold text-white disabled:opacity-50">Verify</button>
                <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="What is wrong" aria-label="What is wrong" className="h-9 w-64 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-600" />
                <button type="button" disabled={ids.length === 0 || note.trim().length < 3 || act.isPending} onClick={() => act.mutate({ action: 'REPORT', sodIds: ids, note })} className="h-9 rounded-md border border-red-700 bg-white px-3 text-sm font-bold text-red-800 disabled:opacity-50">Report a problem</button>
            </div>
            {q.isLoading ? <div className="py-8 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-slate-700" /></div>
                : q.isError ? <p className="text-sm text-red-300">{(q.error as Error).message}</p>
                    : orders.length === 0 ? <p className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-900">No orders are waiting for your verification.</p>
                        : (
                            <div className="overflow-x-auto rounded-xl border border-slate-300 bg-white p-3">
                                <table className="w-full text-sm">
                                    <thead><tr className="border-b border-slate-300"><th className={th}></th><th className={th}>SO number</th><th className={th}>Area</th><th className={th}>Customer</th><th className={th}>Completed</th><th className={th}>Material</th><th className={th}>Payment</th></tr></thead>
                                    <tbody>
                                        {orders.map((o) => (
                                            <tr key={o.id} className="border-b border-slate-200 align-top text-slate-900">
                                                <td className="py-1.5 pr-3"><input type="checkbox" checked={picked.has(o.id)} onChange={(e) => toggle([o.id], e.target.checked)} aria-label={`Select ${o.soNum}`} /></td>
                                                <td className="py-1.5 pr-3 font-semibold">{o.soNum}</td>
                                                <td className="py-1.5 pr-3">{o.rtom}</td>
                                                <td className="py-1.5 pr-3">{o.customerName ?? '-'}</td>
                                                <td className="py-1.5 pr-3 whitespace-nowrap">{day(o.completedDate)}</td>
                                                <td className="py-1.5 pr-3">{o.material.length ? o.material.map((m, i) => <div key={i}>{m}</div>) : <span className="font-semibold text-red-800">No material entered</span>}</td>
                                                <td className="py-1.5 whitespace-nowrap">{money(o.contractorAmount)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
        </div>
    );
}

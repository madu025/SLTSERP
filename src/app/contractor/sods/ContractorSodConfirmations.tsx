"use client";

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ClipboardCheck } from 'lucide-react';

interface Order { id: string; soNum: string; customerName: string | null; completedDate: string | null; rtom: string }
interface Queue { orders: Order[] }
interface Outcome { soNum: string; message?: string }
interface Result { approved?: Outcome[]; returned?: Outcome[]; failed: Outcome[] }

const day = (d: string | null) => (d ? new Date(d).toLocaleDateString('en-GB') : '-');

/**
 * The contractor's step of the SOD invoicing gate: completed orders of this contractor that wait for its confirmation. Confirming
 * sends them on (to the Engineer by default); disputing sends them back to the start with the contractor's reason.
 */
export default function ContractorSodConfirmations() {
    const queryClient = useQueryClient();
    const [picked, setPicked] = useState<Set<string>>(new Set());
    const [reason, setReason] = useState('');
    const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

    const headers = () => {
        const token = typeof window !== 'undefined' ? (localStorage.getItem('contractor_token') || localStorage.getItem('token')) : null;
        const h: Record<string, string> = { 'Cache-Control': 'no-cache' };
        if (token) h.Authorization = `Bearer ${token}`;
        return h;
    };

    const { data } = useQuery<Queue>({
        queryKey: ['contractor-sod-approvals'],
        queryFn: async () => {
            const res = await fetch(`/api/contractor-portal/sod-approvals?_t=${Date.now()}`, { headers: headers() });
            if (!res.ok) throw new Error('Failed to load the orders to confirm');
            const json = await res.json();
            return json.data ?? json;
        },
        refetchInterval: 60_000, retry: false,
    });
    const orders = data?.orders ?? [];

    const act = useMutation({
        mutationFn: async (v: { action: 'APPROVE' | 'RETURN'; ids: string[] }) => {
            const res = await fetch('/api/contractor-portal/sod-approvals', {
                method: 'POST', headers: { ...headers(), 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: v.action, sodIds: v.ids, note: v.action === 'RETURN' ? reason : undefined }),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error?.message || 'Could not save your answer');
            return { action: v.action, data: (json.data ?? json) as Result };
        },
        onSuccess: ({ action, data: r }) => {
            const done = (action === 'APPROVE' ? r.approved : r.returned) ?? [];
            const bad = r.failed.length;
            setMessage({ ok: bad === 0, text: `${done.length} order${done.length === 1 ? '' : 's'} ${action === 'APPROVE' ? 'confirmed' : 'sent back'}${bad ? `; ${bad} could not be changed: ${r.failed[0].message}` : ''}` });
            setPicked(new Set()); setReason('');
            queryClient.invalidateQueries({ queryKey: ['contractor-sod-approvals'] });
        },
        onError: (e: Error) => setMessage({ ok: false, text: e.message }),
    });

    if (orders.length === 0 && !message) return null;
    const ids = [...picked];
    const toggle = (id: string) => setPicked((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; });

    return (
        <div className="rounded-xl border border-amber-500/50 bg-amber-500/10 p-3 space-y-3" role="region" aria-label="Orders to confirm">
            <div className="flex items-center gap-2 text-xs font-bold text-amber-200">
                <ClipboardCheck className="w-4 h-4" />
                {orders.length} completed order{orders.length === 1 ? '' : 's'} waiting for your confirmation
            </div>
            {message && <div className={`rounded-lg border p-2 text-xs font-bold ${message.ok ? 'border-emerald-500/50 bg-emerald-500/15 text-emerald-200' : 'border-rose-500/50 bg-rose-500/15 text-rose-200'}`} role="status">{message.text}</div>}
            {orders.length > 0 && (
                <>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs text-slate-100">
                            <thead className="text-[10px] uppercase text-slate-300"><tr>
                                <th className="p-2"><input type="checkbox" aria-label="Select all" checked={orders.every((o) => picked.has(o.id))} onChange={() => setPicked(orders.every((o) => picked.has(o.id)) ? new Set() : new Set(orders.map((o) => o.id)))} /></th>
                                <th className="p-2">SO number</th><th className="p-2">Customer</th><th className="p-2">Area</th><th className="p-2">Completed</th>
                            </tr></thead>
                            <tbody>
                                {orders.map((o) => (
                                    <tr key={o.id} className="border-t border-slate-700">
                                        <td className="p-2"><input type="checkbox" aria-label={`Select ${o.soNum}`} checked={picked.has(o.id)} onChange={() => toggle(o.id)} /></td>
                                        <td className="p-2 font-mono font-bold">{o.soNum}</td><td className="p-2">{o.customerName ?? '-'}</td><td className="p-2">{o.rtom}</td><td className="p-2">{day(o.completedDate)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <button type="button" disabled={ids.length === 0 || act.isPending} onClick={() => act.mutate({ action: 'APPROVE', ids })} className="h-9 rounded-lg bg-emerald-600 px-4 text-xs font-bold text-white disabled:opacity-50">{act.isPending ? 'Saving...' : `Confirm selected (${ids.length})`}</button>
                        <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="What is wrong? (to dispute)" aria-label="Reason to dispute" className="h-9 min-w-[12rem] flex-1 rounded-lg border border-slate-500 bg-slate-950 px-3 text-xs text-white placeholder:text-slate-400" />
                        <button type="button" disabled={ids.length === 0 || reason.trim().length < 3 || act.isPending} onClick={() => act.mutate({ action: 'RETURN', ids })} className="h-9 rounded-lg bg-rose-700 px-4 text-xs font-bold text-white disabled:opacity-50">Dispute selected</button>
                    </div>
                </>
            )}
        </div>
    );
}

"use client";

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import RoleGuard from '@/components/RoleGuard';
import { Loader2, ClipboardCheck } from 'lucide-react';
import { Panel } from '@/app/dashboard/components/health/HealthCharts';

interface Hist { stage: string; action: string; note: string | null; createdAt: string; user: { name: string | null } }
interface Inv {
    id: string; invoiceNumber: string; totalAmount: number | string; amountA: number | string; amountB: number | string;
    month: number | null; year: number | null; rtomArea: string | null; confirmStage: string;
    contractor: { name: string }; confirmations: Hist[];
}
const LABEL: Record<string, string> = { AREA_COORDINATOR: 'Area Coordinator', QC_OFFICER: 'QC Officer', AREA_ENGINEER: 'Area Engineer / Officer', AREA_MANAGER: 'Area Manager' };
const th = 'py-2 pr-3 text-left text-slate-900';
const money = (v: number | string) => Number(v).toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function InvoiceConfirmationsPage() {
    const qc = useQueryClient();
    const [notes, setNotes] = useState<Record<string, string>>({});
    const q = useQuery<{ stages: string[]; invoices: Inv[] }>({
        queryKey: ['invoice-confirmations'],
        queryFn: async () => {
            const res = await fetch('/api/invoices/confirmations', { cache: 'no-store' });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error?.message || 'Failed to load invoices');
            return json.data ?? json;
        },
        staleTime: 10_000, retry: false,
    });
    const act = useMutation({
        mutationFn: async (v: { invoiceId: string; action: 'CONFIRM' | 'RETURN' }) => {
            const res = await fetch('/api/invoices/confirmations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ invoiceId: v.invoiceId, action: v.action, note: notes[v.invoiceId] || undefined }) });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error?.message || 'Action failed');
            return json.data ?? json;
        },
        onSuccess: (d: { invoiceNumber: string; stage: string }) => {
            toast.success(d.stage === 'CONFIRMED' ? `${d.invoiceNumber} fully confirmed - ready for Invoice and Quality section` : `${d.invoiceNumber} moved to ${LABEL[d.stage] ?? d.stage}`);
            qc.invalidateQueries({ queryKey: ['invoice-confirmations'] });
        },
        onError: (e: Error) => toast.error(e.message),
    });

    return (
        <RoleGuard>
            <div className="flex h-screen bg-slate-50 overflow-hidden">
                <Sidebar />
                <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                    <Header />
                    <main className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
                        <div>
                            <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2"><ClipboardCheck className="w-7 h-7 text-indigo-600" />Contractor invoice confirmations</h1>
                            <p className="mt-1 text-sm text-slate-700">Chain: Area Coordinator, QC Officer, Area Engineer / Officer (skipped when the area has none), Area Manager. You see only invoices waiting at your stage in your own area.</p>
                        </div>
                        <Panel title={`Waiting for you${q.data ? ` (${q.data.invoices.length})` : ''}`}>
                            {q.isLoading ? <div className="py-8 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-slate-700" /></div>
                                : q.isError ? <p className="text-sm text-red-700">{(q.error as Error).message}</p>
                                    : !q.data || q.data.invoices.length === 0 ? <p className="text-sm text-slate-700">No invoices are waiting at your stage.</p> : (
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-sm">
                                                <thead><tr className="border-b border-slate-200"><th className={th}>Invoice</th><th className={th}>Contractor</th><th className={th}>Area</th><th className={`${th} text-right`}>Total</th><th className={`${th} text-right`}>Part A</th><th className={`${th} text-right`}>Part B</th><th className={th}>Your stage</th><th className={th}>Done so far</th><th className={th}>Note</th><th className={th}></th></tr></thead>
                                                <tbody>
                                                    {q.data.invoices.map((i) => (
                                                        <tr key={i.id} className="border-b border-slate-100 align-top text-slate-900">
                                                            <td className="py-2 pr-3 font-medium">{i.invoiceNumber}</td>
                                                            <td className="py-2 pr-3">{i.contractor.name}</td>
                                                            <td className="py-2 pr-3">{i.rtomArea ?? '-'}</td>
                                                            <td className="py-2 pr-3 text-right">{money(i.totalAmount)}</td>
                                                            <td className="py-2 pr-3 text-right">{money(i.amountA)}</td>
                                                            <td className="py-2 pr-3 text-right">{money(i.amountB)}</td>
                                                            <td className="py-2 pr-3">{LABEL[i.confirmStage] ?? i.confirmStage}</td>
                                                            <td className="py-2 pr-3 text-xs text-slate-700">{i.confirmations.length === 0 ? '-' : i.confirmations.map((h, n) => <div key={n}>{LABEL[h.stage] ?? h.stage}: {h.action === 'CONFIRMED' ? 'confirmed' : 'returned'} by {h.user.name ?? 'user'}{h.note ? ` (${h.note})` : ''}</div>)}</td>
                                                            <td className="py-2 pr-3"><input value={notes[i.id] ?? ''} onChange={(e) => setNotes({ ...notes, [i.id]: e.target.value })} placeholder="Reason if returning" className="w-44 rounded border border-slate-300 bg-white px-2 py-1 text-slate-900" /></td>
                                                            <td className="py-2 whitespace-nowrap">
                                                                <button disabled={act.isPending} onClick={() => act.mutate({ invoiceId: i.id, action: 'CONFIRM' })} className="rounded bg-emerald-700 px-3 py-1 text-white hover:bg-emerald-800 disabled:opacity-50">Confirm</button>
                                                                <button disabled={act.isPending} onClick={() => act.mutate({ invoiceId: i.id, action: 'RETURN' })} className="ml-2 rounded border border-red-700 bg-white px-3 py-1 text-red-800 hover:bg-red-50 disabled:opacity-50">Return</button>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                        </Panel>
                    </main>
                </div>
            </div>
        </RoleGuard>
    );
}

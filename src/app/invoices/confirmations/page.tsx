"use client";

import { Fragment, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import RoleGuard from '@/components/RoleGuard';
import { Loader2, ClipboardCheck } from 'lucide-react';

interface Hist { stage: string; action: string; note: string | null; createdAt: string; user: { name: string | null } }
interface Inv {
    id: string; invoiceNumber: string; totalAmount: number | string; amountA: number | string; amountB: number | string; month: number | null; year: number | null;
    rtomArea: string | null; confirmStage: string; stageLabel: string; contractor: { name: string | null }; sodCount: number; removedCount: number; approvals: Hist[];
}
interface Queue { stages: Array<{ key: string; label: string; canRemoveSods: boolean }>; counts: Record<string, number>; invoices: Inv[] }
interface Sod { id: string; soNum: string; rtom: string; customerName: string | null; completedDate: string | null; contractorAmount: number | string | null; qcStatus: string | null; sltsPatStatus: string | null; opmcPatStatus: string | null; hoPatStatus: string | null }
interface Removed { soNum: string; reason: string; amount: number | string; createdAt: string; user: { name: string | null } }
interface Outcome { invoiceNumber: string; message?: string }
interface Result { approved?: Outcome[]; returned?: Outcome[]; failed: Outcome[] }

const LABEL: Record<string, string> = { AREA_COORDINATOR: 'Area Coordinator', QC_OFFICER: 'QC Officer', CONTRACTOR: 'Contractor', ENGINEER: 'Area Engineer / Officer', AREA_MANAGER: 'Area Manager (ARM)' };
const th = 'py-2 pr-3 text-left text-xs font-bold uppercase tracking-wide text-slate-900';
const money = (v: number | string | null) => `Rs. ${Number(v ?? 0).toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const day = (d: string | null) => (d ? new Date(d).toLocaleDateString('en-GB') : '-');

function SodPanel({ invoice, canRemove, onChanged }: { invoice: Inv; canRemove: boolean; onChanged: () => void }) {
    const [picked, setPicked] = useState<Set<string>>(new Set());
    const [reason, setReason] = useState('');
    const q = useQuery<{ sods: Sod[]; removed: Removed[] }>({
        queryKey: ['invoice-confirmation-sods', invoice.id],
        queryFn: async () => {
            const res = await fetch(`/api/invoices/confirmations?invoiceId=${invoice.id}`, { cache: 'no-store' });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error?.message || 'Failed to load the service orders');
            return json.data ?? json;
        },
        retry: false,
    });
    const remove = useMutation({
        mutationFn: async () => {
            const res = await fetch('/api/invoices/confirmations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'REMOVE_SODS', invoiceId: invoice.id, sodIds: [...picked], note: reason }) });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error?.message || 'Could not take the service orders out');
            return json.data ?? json;
        },
        onSuccess: (r: { removed: string[]; cancelled: boolean }) => {
            toast.success(r.cancelled ? 'Every service order was taken out: the invoice was cancelled' : `${r.removed.length} service order${r.removed.length === 1 ? '' : 's'} taken out; they are back on the verification list`);
            setPicked(new Set()); setReason(''); q.refetch(); onChanged();
        },
        onError: (e: Error) => toast.error(e.message),
    });
    const sods = q.data?.sods ?? [];
    const toggle = (id: string) => setPicked((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; });
    return (
        <div className="space-y-3 rounded-lg border border-slate-300 bg-slate-50 p-3">
            {q.isLoading ? <Loader2 className="w-5 h-5 animate-spin text-slate-700" /> : q.isError ? <p className="text-sm text-red-800">{(q.error as Error).message}</p> : (
                <>
                    <div className="overflow-x-auto">
                        <table className="w-full text-xs text-slate-900">
                            <thead><tr className="border-b border-slate-300">
                                {canRemove && <th className={th}><input type="checkbox" aria-label="Select all service orders" checked={sods.length > 0 && sods.every((s) => picked.has(s.id))} onChange={() => setPicked(sods.every((s) => picked.has(s.id)) ? new Set() : new Set(sods.map((s) => s.id)))} /></th>}
                                <th className={th}>SO number</th><th className={th}>Customer</th><th className={th}>RTOM</th><th className={th}>Completed</th><th className={th}>Amount</th><th className={th}>QC</th><th className={th}>PAT</th>
                            </tr></thead>
                            <tbody>
                                {sods.map((s) => (
                                    <tr key={s.id} className="border-b border-slate-200">
                                        {canRemove && <td className="py-1 pr-3"><input type="checkbox" aria-label={`Select ${s.soNum}`} checked={picked.has(s.id)} onChange={() => toggle(s.id)} /></td>}
                                        <td className="py-1 pr-3 font-semibold">{s.soNum}</td><td className="py-1 pr-3">{s.customerName ?? '-'}</td><td className="py-1 pr-3">{s.rtom}</td>
                                        <td className="py-1 pr-3">{day(s.completedDate)}</td><td className="py-1 pr-3">{money(s.contractorAmount)}</td>
                                        <td className="py-1 pr-3">{s.qcStatus ? s.qcStatus.replace('QC_', '').replace('_', ' ').toLowerCase() : '-'}</td>
                                        <td className="py-1 pr-3">{[s.sltsPatStatus, s.opmcPatStatus, s.hoPatStatus].every((p) => p === 'PAT_PASSED') ? 'Passed' : 'Check'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    {canRemove && (
                        <div className="flex flex-wrap items-center gap-2">
                            <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why are they taken out? (quality problem, invoiced by mistake...)" aria-label="Reason to take service orders out" className="h-9 min-w-[18rem] flex-1 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-600" />
                            <button type="button" disabled={picked.size === 0 || reason.trim().length < 3 || remove.isPending} onClick={() => { if (confirm(`Take ${picked.size} service order(s) out of ${invoice.invoiceNumber}? They go back to the verification list and the invoice total is recalculated.`)) remove.mutate(); }} className="h-9 rounded-md border border-red-700 bg-white px-4 text-sm font-bold text-red-800 disabled:opacity-50">{remove.isPending ? 'Working...' : `Take out of invoice (${picked.size})`}</button>
                        </div>
                    )}
                    {(q.data?.removed.length ?? 0) > 0 && (
                        <div className="text-xs text-slate-900">
                            <p className="font-bold">Already taken out of this invoice</p>
                            <ul className="list-disc pl-5">{q.data!.removed.map((r, i) => <li key={i}><span className="font-semibold">{r.soNum}</span> ({money(r.amount)}) by {r.user.name ?? 'user'} on {day(r.createdAt)}: {r.reason}</li>)}</ul>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}

export default function InvoiceApprovalsPage() {
    const qc = useQueryClient();
    const [stage, setStage] = useState('');
    const [search, setSearch] = useState('');
    const [picked, setPicked] = useState<Set<string>>(new Set());
    const [reason, setReason] = useState('');
    const [open, setOpen] = useState<string | null>(null);
    const [result, setResult] = useState<Result | null>(null);

    const q = useQuery<Queue>({
        queryKey: ['invoice-confirmations', stage, search],
        queryFn: async () => {
            const sp = new URLSearchParams();
            if (stage) sp.set('stage', stage);
            if (search.trim()) sp.set('q', search.trim());
            const res = await fetch(`/api/invoices/confirmations?${sp}`, { cache: 'no-store' });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error?.message || 'Failed to load the invoices');
            return json.data ?? json;
        },
        staleTime: 10_000, retry: false,
    });
    const invoices = useMemo(() => q.data?.invoices ?? [], [q.data]);
    const allPicked = invoices.length > 0 && invoices.every((i) => picked.has(i.id));
    const canRemoveAt = (key: string) => q.data?.stages.find((s) => s.key === key)?.canRemoveSods ?? false;

    const act = useMutation({
        mutationFn: async (v: { action: 'APPROVE' | 'RETURN'; ids: string[] }) => {
            const res = await fetch('/api/invoices/confirmations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: v.action, invoiceIds: v.ids, note: v.action === 'RETURN' ? reason : undefined }) });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error?.message || 'Action failed');
            return { action: v.action, data: (json.data ?? json) as Result };
        },
        onSuccess: ({ action, data }) => {
            const done = (action === 'APPROVE' ? data.approved : data.returned) ?? [];
            if (done.length > 0) toast.success(action === 'APPROVE' ? `${done.length} invoice${done.length === 1 ? '' : 's'} approved` : `${done.length} invoice${done.length === 1 ? '' : 's'} returned to the first step`);
            if (data.failed.length > 0) toast.error(`${data.failed.length} could not be ${action === 'APPROVE' ? 'approved' : 'returned'}`);
            setResult(data); setPicked(new Set()); if (action === 'RETURN') setReason('');
            qc.invalidateQueries({ queryKey: ['invoice-confirmations'] });
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
                            <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2"><ClipboardCheck className="w-7 h-7 text-indigo-700" />Invoice Approvals</h1>
                            <p className="mt-1 text-sm text-slate-800">A new contractor invoice is approved in turn by the Area Coordinator, QC Officer, the Contractor, the Area Engineer / Officer (skipped when the area has none) and the Area Manager. An administrator can reorder the steps on the gate screen. You see the invoices waiting at your step, in your area. Open an invoice to see its service orders; if one has a quality problem or was invoiced by mistake, take it out and it goes back to the verification list.</p>
                        </div>

                        {q.data && q.data.stages.length > 0 && (
                            <div className="flex flex-wrap gap-2" role="group" aria-label="Step">
                                <button type="button" aria-pressed={stage === ''} onClick={() => { setStage(''); setPicked(new Set()); }} className={`rounded-full border px-3 py-1 text-xs font-bold ${stage === '' ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-300 bg-white text-slate-900 hover:border-slate-500'}`}>All my steps {Object.values(q.data.counts).reduce((a, b) => a + b, 0)}</button>
                                {q.data.stages.map((s) => (
                                    <button key={s.key} type="button" aria-pressed={stage === s.key} onClick={() => { setStage(s.key); setPicked(new Set()); }} className={`rounded-full border px-3 py-1 text-xs font-bold ${stage === s.key ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-300 bg-white text-slate-900 hover:border-slate-500'}`}>{s.label} {q.data.counts[s.key] ?? 0}</button>
                                ))}
                            </div>
                        )}

                        <div className="flex flex-wrap items-center gap-2">
                            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search invoice number or contractor" aria-label="Search invoices" className="h-9 w-72 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-600" />
                            <button type="button" disabled={ids.length === 0 || act.isPending} onClick={() => act.mutate({ action: 'APPROVE', ids })} className="h-9 rounded-md bg-emerald-700 px-4 text-sm font-bold text-white disabled:opacity-50">{act.isPending ? 'Working...' : `Approve selected (${ids.length})`}</button>
                            <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason to return" aria-label="Reason to return" className="h-9 w-56 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-600" />
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
                                    : invoices.length === 0 ? <p className="text-sm text-slate-900">No invoices are waiting at your step.</p> : (
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-sm">
                                                <thead><tr className="border-b border-slate-300">
                                                    <th className={th}><input type="checkbox" checked={allPicked} onChange={() => setPicked(allPicked ? new Set() : new Set(invoices.map((i) => i.id)))} aria-label="Select all" /></th>
                                                    <th className={th}>Invoice</th><th className={th}>Contractor</th><th className={th}>Area</th><th className={th}>Period</th><th className={th}>Orders</th><th className={th}>Total</th>
                                                    <th className={th}>Waiting at</th><th className={th}>History</th><th className={th}></th>
                                                </tr></thead>
                                                <tbody>
                                                    {invoices.map((i) => (
                                                        <Fragment key={i.id}>
                                                            <tr className="border-b border-slate-200 align-top text-slate-900">
                                                                <td className="py-2 pr-3"><input type="checkbox" checked={picked.has(i.id)} onChange={() => toggle(i.id)} aria-label={`Select ${i.invoiceNumber}`} /></td>
                                                                <td className="py-2 pr-3 font-mono font-semibold">{i.invoiceNumber}</td>
                                                                <td className="py-2 pr-3">{i.contractor.name ?? '-'}</td>
                                                                <td className="py-2 pr-3">{i.rtomArea ?? '-'}</td>
                                                                <td className="py-2 pr-3">{i.month && i.year ? `${i.month}/${i.year}` : '-'}</td>
                                                                <td className="py-2 pr-3">{i.sodCount}{i.removedCount > 0 && <span className="ml-1 text-xs font-semibold text-red-800">({i.removedCount} taken out)</span>}</td>
                                                                <td className="py-2 pr-3 font-semibold">{money(i.totalAmount)}</td>
                                                                <td className="py-2 pr-3 font-semibold">{i.stageLabel ?? LABEL[i.confirmStage] ?? i.confirmStage}</td>
                                                                <td className="py-2 pr-3 text-xs text-slate-800">{i.approvals.length === 0 ? '-' : i.approvals.slice(-3).map((h, n) => <div key={n}>{LABEL[h.stage] ?? h.stage}: {h.action === 'RETURNED' ? 'returned' : h.action === 'RESTARTED' ? 'restarted' : 'approved'}{h.action === 'RESTARTED' ? '' : ` by ${h.user.name ?? 'user'}`}{h.note ? ` (${h.note})` : ''}</div>)}</td>
                                                                <td className="py-2 whitespace-nowrap">
                                                                    <button type="button" aria-expanded={open === i.id} onClick={() => setOpen(open === i.id ? null : i.id)} className="mr-2 text-xs font-bold text-indigo-800 underline">{open === i.id ? 'Hide service orders' : 'View service orders'}</button>
                                                                    <button type="button" disabled={act.isPending} onClick={() => act.mutate({ action: 'APPROVE', ids: [i.id] })} className="rounded bg-emerald-700 px-3 py-1 text-xs font-bold text-white disabled:opacity-50">Approve</button>
                                                                </td>
                                                            </tr>
                                                            {open === i.id && <tr><td colSpan={10} className="pb-3"><SodPanel invoice={i} canRemove={canRemoveAt(i.confirmStage)} onChanged={() => qc.invalidateQueries({ queryKey: ['invoice-confirmations'] })} /></td></tr>}
                                                        </Fragment>
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

"use client";

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import RoleGuard from '@/components/RoleGuard';
import { Loader2, ClipboardCheck } from 'lucide-react';

interface Hist { stage: string; action: string; note: string | null; createdAt: string; user: { name: string | null } }
interface Order {
    contractorAmount: number | null;
    id: string; soNum: string; rtom: string; customerName: string | null; completedDate: string | null; sodApprovalStage: string; stageLabel: string;
    sltsPatStatus: string | null; opmcPatStatus: string | null; hoPatStatus: string | null; qcStatus: string | null;
    contractor: { name: string } | null; approvals: Hist[];
}
interface Queue { stages: Array<{ key: string; label: string }>; counts: Record<string, number>; orders: Order[]; total?: number }
interface Outcome { soNum: string; stage?: string; message?: string }
interface Result { approved?: Outcome[]; returned?: Outcome[]; failed: Outcome[] }

const LABEL: Record<string, string> = { AREA_COORDINATOR: 'Area Coordinator', QC_OFFICER: 'QC Officer', CONTRACTOR: 'Contractor', ENGINEER: 'Area Engineer / Officer', AREA_ENGINEER: 'Area Engineer / Officer', AREA_MANAGER: 'Area Manager (ARM)', CONFIRMED: 'Ready for the engineer', READY: 'Ready for the engineer' };
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const money = (n: number | null) => (n === null ? '-' : `Rs. ${n.toLocaleString('en-LK', { maximumFractionDigits: 2 })}`);
const th = 'py-2 pr-3 text-left text-xs font-bold uppercase tracking-wide text-slate-900';
const day = (d: string | null) => (d ? new Date(d).toLocaleDateString('en-GB') : '-');
const pat = (s: string | null) => (s === 'PAT_PASSED' ? { t: 'Passed', c: 'bg-emerald-100 text-emerald-900 border-emerald-300' } : { t: s ? s.replace('PAT_', '').toLowerCase() : 'pending', c: 'bg-amber-100 text-amber-900 border-amber-300' });

export default function SodApprovalsPage() {
    const qc = useQueryClient();
    const [stage, setStage] = useState('');
    const [search, setSearch] = useState('');
    const [month, setMonth] = useState(0);
    const [year, setYear] = useState(new Date().getFullYear());
    const [picked, setPicked] = useState<Set<string>>(new Set());
    const [reason, setReason] = useState('');
    const [result, setResult] = useState<Result | null>(null);

    const q = useQuery<Queue>({
        queryKey: ['sod-approvals', stage, search, month, year],
        queryFn: async () => {
            const sp = new URLSearchParams();
            if (stage) sp.set('stage', stage);
            if (search.trim()) sp.set('q', search.trim());
            if (month) { sp.set('month', String(month)); sp.set('year', String(year)); }
            const res = await fetch(`/api/service-orders/approvals?${sp}`, { cache: 'no-store' });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error?.message || 'Failed to load the approval queue');
            return json.data ?? json;
        },
        staleTime: 10_000, retry: false,
    });
    const orders = useMemo(() => q.data?.orders ?? [], [q.data]);
    const allPicked = orders.length > 0 && orders.every((o) => picked.has(o.id));

    const act = useMutation({
        mutationFn: async (v: { action: 'APPROVE' | 'RETURN'; ids: string[] }) => {
            const res = await fetch('/api/service-orders/approvals', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: v.action, sodIds: v.ids, note: v.action === 'RETURN' ? reason : undefined }) });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error?.message || 'Action failed');
            return { action: v.action, data: (json.data ?? json) as Result };
        },
        onSuccess: ({ action, data }) => {
            const done = (action === 'APPROVE' ? data.approved : data.returned) ?? [];
            if (done.length > 0) toast.success(action === 'APPROVE' ? `${done.length} order${done.length === 1 ? '' : 's'} approved` : `${done.length} order${done.length === 1 ? '' : 's'} returned to the start of the chain`);
            if (data.failed.length > 0) toast.error(`${data.failed.length} could not be ${action === 'APPROVE' ? 'approved' : 'returned'}`);
            setResult(data); setPicked(new Set()); if (action === 'RETURN') setReason('');
            qc.invalidateQueries({ queryKey: ['sod-approvals'] });
        },
        onError: (e: Error) => toast.error(e.message),
    });

    const toggle = (id: string) => setPicked((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; });
    const toggleAll = () => setPicked(allPicked ? new Set() : new Set(orders.map((o) => o.id)));
    const ids = [...picked];

    return (
        <RoleGuard>
            <div className="flex h-screen bg-slate-50 overflow-hidden">
                <Sidebar />
                <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                    <Header />
                    <main className="flex-1 overflow-y-auto p-4 md:p-6 space-y-5">
                        <div>
                            <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2"><ClipboardCheck className="w-7 h-7 text-indigo-700" />SOD Approvals</h1>
                            <p className="mt-1 text-sm text-slate-800">Completed service orders are passed by the Area Coordinator and then the QC Officer of their own area (an administrator can change the steps on the gate screen). You see the orders waiting at your step, in your area. Tick one or many and approve, as often as you like during the month. Passed orders go to the Engineer, who creates the invoices at month end.</p>
                        </div>

                        {q.data && q.data.stages.length > 0 && (
                            <div className="flex flex-wrap gap-2" role="group" aria-label="Stage">
                                <button type="button" aria-pressed={stage === ''} onClick={() => { setStage(''); setPicked(new Set()); }} className={`rounded-full border px-3 py-1 text-xs font-bold ${stage === '' ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-300 bg-white text-slate-900 hover:border-slate-500'}`}>All my stages {Object.values(q.data.counts).reduce((a, b) => a + b, 0)}</button>
                                {q.data.stages.map((s) => (
                                    <button key={s.key} type="button" aria-pressed={stage === s.key} onClick={() => { setStage(s.key); setPicked(new Set()); }} className={`rounded-full border px-3 py-1 text-xs font-bold ${stage === s.key ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-300 bg-white text-slate-900 hover:border-slate-500'}`}>{s.label} {q.data.counts[s.key] ?? 0}</button>
                                ))}
                            </div>
                        )}

                        <div className="flex flex-wrap items-center gap-2">
                            <select aria-label="Completed in month" value={month} onChange={(e) => { setMonth(Number(e.target.value)); setPicked(new Set()); }} className="h-9 rounded-md border border-slate-300 bg-white px-2 text-sm text-slate-900">
                                <option value={0}>Any month</option>
                                {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
                            </select>
                            <select aria-label="Completed in year" value={year} onChange={(e) => { setYear(Number(e.target.value)); setPicked(new Set()); }} className="h-9 rounded-md border border-slate-300 bg-white px-2 text-sm text-slate-900">
                                {[new Date().getFullYear() - 1, new Date().getFullYear()].map((y) => <option key={y} value={y}>{y}</option>)}
                            </select>
                            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search SO number, customer or voice number" aria-label="Search orders" className="h-9 w-72 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-600" />
                            <button type="button" disabled={ids.length === 0 || act.isPending} onClick={() => act.mutate({ action: 'APPROVE', ids })} className="h-9 rounded-md bg-emerald-700 px-4 text-sm font-bold text-white disabled:opacity-50">{act.isPending ? 'Working...' : `Approve selected (${ids.length})`}</button>
                            <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason to return" aria-label="Reason to return" className="h-9 w-56 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-600" />
                            <button type="button" disabled={ids.length === 0 || reason.trim().length < 3 || act.isPending} onClick={() => act.mutate({ action: 'RETURN', ids })} className="h-9 rounded-md border border-red-700 bg-white px-4 text-sm font-bold text-red-800 disabled:opacity-50">Return selected</button>
                        </div>

                        {result && result.failed.length > 0 && (
                            <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-slate-900" role="alert">
                                <p className="font-bold text-red-900">Not changed ({result.failed.length})</p>
                                <ul className="mt-1 list-disc pl-5">{result.failed.slice(0, 20).map((f) => <li key={f.soNum}><span className="font-semibold">{f.soNum}</span>: {f.message}</li>)}</ul>
                            </div>
                        )}

                        <div className="rounded-xl border border-slate-200 bg-white p-4">
                            {q.isLoading ? <div className="py-8 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-slate-700" /></div>
                                : q.isError ? <p className="text-sm text-red-800">{(q.error as Error).message}</p>
                                    : orders.length === 0 ? <p className="text-sm text-slate-900">No orders are waiting at your stage.</p> : (
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-sm">
                                                <thead><tr className="border-b border-slate-300">
                                                    <th className={th}><input type="checkbox" checked={allPicked} onChange={toggleAll} aria-label="Select all" /></th>
                                                    <th className={th}>SO number</th><th className={th}>Customer</th><th className={th}>RTOM</th><th className={th}>Contractor</th><th className={th}>Completed</th><th className={th}>Payment</th>
                                                    <th className={th}>PAT (SLTS / OPMC / HO)</th><th className={th}>QC</th><th className={th}>Waiting at</th><th className={th}>History</th><th className={th}></th>
                                                </tr></thead>
                                                <tbody>
                                                    {orders.map((o) => (
                                                        <tr key={o.id} className="border-b border-slate-200 align-top text-slate-900">
                                                            <td className="py-2 pr-3"><input type="checkbox" checked={picked.has(o.id)} onChange={() => toggle(o.id)} aria-label={`Select ${o.soNum}`} /></td>
                                                            <td className="py-2 pr-3 font-semibold">{o.soNum}</td>
                                                            <td className="py-2 pr-3">{o.customerName ?? '-'}</td>
                                                            <td className="py-2 pr-3">{o.rtom}</td>
                                                            <td className="py-2 pr-3">{o.contractor?.name ?? <span className="font-semibold text-red-800">Not assigned</span>}</td>
                                                            <td className="py-2 pr-3 whitespace-nowrap">{day(o.completedDate)}</td>
                                                            <td className="py-2 pr-3 whitespace-nowrap">{money(o.contractorAmount)}</td>
                                                            <td className="py-2 pr-3 whitespace-nowrap">{[o.sltsPatStatus, o.opmcPatStatus, o.hoPatStatus].map((s, i) => { const p = pat(s); return <span key={i} className={`mr-1 inline-block rounded border px-1.5 py-0.5 text-[11px] font-semibold ${p.c}`}>{p.t}</span>; })}</td>
                                                            <td className="py-2 pr-3 text-xs">{o.qcStatus ? o.qcStatus.replace('QC_', '').replace('_', ' ').toLowerCase() : '-'}</td>
                                                            <td className="py-2 pr-3 font-semibold">{o.stageLabel ?? LABEL[o.sodApprovalStage] ?? o.sodApprovalStage}</td>
                                                            <td className="py-2 pr-3 text-xs text-slate-800">{o.approvals.length === 0 ? '-' : o.approvals.slice(-3).map((h, n) => <div key={n}>{LABEL[h.stage] ?? h.stage}: {h.action === 'RETURNED' ? 'returned' : h.action === 'RESTARTED' ? 'restarted' : 'approved'}{h.action === 'RESTARTED' ? '' : ` by ${h.user.name ?? 'user'}`}{h.note ? ` (${h.note})` : ''}</div>)}</td>
                                                            <td className="py-2 whitespace-nowrap"><button type="button" disabled={act.isPending} onClick={() => act.mutate({ action: 'APPROVE', ids: [o.id] })} className="rounded bg-emerald-700 px-3 py-1 text-xs font-bold text-white disabled:opacity-50">Approve</button></td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                            {(q.data?.total ?? 0) > orders.length && <p className="mt-2 text-xs text-slate-800">Showing the first {orders.length} of {q.data?.total} (oldest first). Approve these and the next ones appear, or narrow the list with the month and the search.</p>}
                                        </div>
                                    )}
                        </div>
                    </main>
                </div>
            </div>
        </RoleGuard>
    );
}

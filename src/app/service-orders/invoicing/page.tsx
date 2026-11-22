"use client";

import { useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import RoleGuard from '@/components/RoleGuard';
import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';
import { Loader2, Receipt } from 'lucide-react';

interface Order { id: string; soNum: string; completedDate: string | null; completedMonth: string; late: boolean; contractorAmount: number; revenueAmount: number; held: boolean; holdReason: string | null }
interface Group { key: string; contractorId: string; contractorName: string; opmcId: string; area: string; orders: Order[]; total: number; lateCount: number }
interface Candidates { groups: Group[]; held: Group[]; total: number; waitingCheck: number; waitingContractor: number }
interface RecentInvoice { id: string; invoiceNumber: string; month: number | null; year: number | null; total: number; stage: string; status: string; createdAt: string; contractor: string; area: string; orders: number }
interface Created { contractor: string; area: string; invoiceNumber?: string; orders: number; total?: number; error?: string }
interface CreateResult { created: Created[]; blocked: Array<{ soNum: string; reasons: string[] }>; notEligible: number }

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const th = 'py-2 pr-3 text-left text-xs font-bold uppercase tracking-wide text-slate-900';
const money = (n: number) => `Rs. ${n.toLocaleString('en-LK', { maximumFractionDigits: 2 })}`;
const day = (d: string | null) => (d ? new Date(d).toLocaleDateString('en-GB') : '-');
const REASON: Record<string, string> = {
    PAT_APPROVALS_INCOMPLETE: 'PAT approvals are not all passed',
    MATERIAL_COST_MISSING_OR_INVALID: 'a material line has no cost',
    REVENUE_SNAPSHOT_MISSING_OR_INVALID: 'no revenue amount',
    CONTRACTOR_COST_SNAPSHOT_MISSING_OR_INVALID: 'no contractor amount',
    COMPLETION_DATE_MISSING: 'no completion date',
    CONTRACTOR_ASSIGNMENT_MISSING: 'no contractor',
};

export default function InvoicingPage() {
    const qc = useQueryClient();
    const now = new Date();
    const [month, setMonth] = useState(now.getMonth() + 1);
    const [year, setYear] = useState(now.getFullYear());
    const [filter, setFilter] = useState('');
    const [picked, setPicked] = useState<Set<string>>(new Set());
    const [reason, setReason] = useState('');
    const [result, setResult] = useState<CreateResult | null>(null);

    const q = useQuery<Candidates>({
        queryKey: ['invoicing', month, year],
        queryFn: async () => {
            const res = await fetch(`/api/invoicing?month=${month}&year=${year}`, { cache: 'no-store' });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error?.message || 'Failed to load the orders');
            return json.data ?? json;
        },
        staleTime: 10_000, retry: false,
    });

    const recent = useQuery<RecentInvoice[]>({
        queryKey: ['invoicing', 'recent'],
        queryFn: async () => { const res = await fetch('/api/invoicing?view=invoices', { cache: 'no-store' }); const json = await res.json(); if (!res.ok) throw new Error(json.error?.message || 'Failed to load the invoices'); return json.data ?? json; },
        staleTime: 10_000, retry: false,
    });

    const needle = filter.trim().toLowerCase();
    const match = (g: Group) => !needle || `${g.contractorName} ${g.area}`.toLowerCase().includes(needle);
    const groups = (q.data?.groups ?? []).filter(match);
    const held = (q.data?.held ?? []).filter(match);
    const allOrders = groups.flatMap((g) => g.orders);
    const picks = allOrders.filter((o) => picked.has(o.id));
    const pickTotal = picks.reduce((a, o) => a + o.contractorAmount, 0);

    const act = useMutation({
        mutationFn: async (body: Record<string, unknown>) => {
            const res = await fetch('/api/invoicing', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error?.message || 'Action failed');
            return { action: body.action as string, data: json.data ?? json };
        },
        onSuccess: ({ action, data }) => {
            if (action === 'CREATE') {
                const r = data as CreateResult;
                setResult(r);
                const ok = r.created.filter((c) => c.invoiceNumber).length;
                if (ok) toast.success(`${ok} invoice${ok === 1 ? '' : 's'} created`);
                if (r.created.some((c) => c.error) || r.blocked.length) toast.warning('Some orders or invoices need attention');
            } else if (action === 'HOLD') toast.success(`${data.held} order${data.held === 1 ? '' : 's'} held back`);
            else if (action === 'RELEASE') toast.success(`${data.released} order${data.released === 1 ? '' : 's'} released`);
            else toast.success(`${data.returned} order${data.returned === 1 ? '' : 's'} sent back to the check`);
            setPicked(new Set()); setReason('');
            qc.invalidateQueries({ queryKey: ['invoicing'] });
        },
        onError: (e: Error) => toast.error(e.message),
    });

    const toggle = (ids: string[], on: boolean) => setPicked((p) => { const n = new Set(p); ids.forEach((id) => (on ? n.add(id) : n.delete(id))); return n; });
    const createInvoices = () => {
        const names = new Set(picks.map((o) => groups.find((g) => g.orders.includes(o))?.key));
        if (!confirm(`Create invoices for ${picks.length} order${picks.length === 1 ? '' : 's'} (${names.size} invoice${names.size === 1 ? '' : 's'}, one for each contractor and area)? Billing month: ${MONTHS[month - 1]} ${year}.`)) return;
        act.mutate({ action: 'CREATE', month, year, sodIds: picks.map((o) => o.id) });
    };

    return (
        <RoleGuard permissionId={RBAC_PERMISSIONS.SOD_INVOICE}>
            <div className="flex h-screen bg-slate-50 overflow-hidden">
                <Sidebar />
                <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                    <Header />
                    <main className="flex-1 overflow-y-auto p-4 md:p-6 space-y-5">
                        <div>
                            <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2"><Receipt className="w-7 h-7 text-indigo-700" />Invoicing</h1>
                            <p className="mt-1 text-sm text-slate-800">These orders passed the check on Completed SOD (connection, material and photos) by the Area Coordinator or the QC Officer of your area, and were then verified by the contractor. Choose the billing month, tick the orders and press <span className="font-bold">Create invoices</span>: one invoice is made for each contractor and area. Orders completed in an earlier month than the billing month are late SODs; they go on this month&apos;s invoice and are shown as late. Then the contractor reviews each invoice and the Area Manager approves it.</p>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                            <select aria-label="Billing month" value={month} onChange={(e) => { setMonth(Number(e.target.value)); setPicked(new Set()); }} className="h-9 rounded-md border border-slate-300 bg-white px-2 text-sm text-slate-900">
                                {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
                            </select>
                            <select aria-label="Billing year" value={year} onChange={(e) => { setYear(Number(e.target.value)); setPicked(new Set()); }} className="h-9 rounded-md border border-slate-300 bg-white px-2 text-sm text-slate-900">
                                {[now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1].map((y) => <option key={y} value={y}>{y}</option>)}
                            </select>
                            <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Contractor or RTOM" aria-label="Filter by contractor or RTOM" className="h-9 w-56 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-600" />
                            <button type="button" onClick={() => toggle(allOrders.map((o) => o.id), picks.length !== allOrders.length)} className="h-9 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-900 hover:bg-slate-100">{picks.length === allOrders.length && allOrders.length > 0 ? 'Clear selection' : 'Select all'}</button>
                        </div>

                        {(q.data?.waitingCheck ?? 0) > 0 && (
                            <p className="rounded-xl border border-amber-400 bg-amber-50 p-3 text-sm text-amber-950">
                                <span className="font-bold">{q.data?.waitingCheck}</span> finished order{q.data?.waitingCheck === 1 ? ' is' : 's are'} still waiting for the check in your area. <Link href="/service-orders/work-order/completed?check=waiting" className="font-bold underline">Open Completed SOD</Link>
                            </p>
                        )}

                        {(q.data?.waitingContractor ?? 0) > 0 && (
                            <p className="rounded-xl border border-sky-500 bg-sky-50 p-3 text-sm text-slate-900">
                                <span className="font-bold">{q.data?.waitingContractor}</span> checked order{q.data?.waitingContractor === 1 ? ' is' : 's are'} waiting for the contractor to verify {q.data?.waitingContractor === 1 ? 'it' : 'them'}; they appear here once verified.
                            </p>
                        )}

                        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-300 bg-white p-3">
                            <span className="text-sm font-bold text-slate-900">{picks.length} order{picks.length === 1 ? '' : 's'} selected{picks.length ? ` · ${money(pickTotal)}` : ''}</span>
                            <button type="button" disabled={picks.length === 0 || act.isPending} onClick={createInvoices} className="h-9 rounded-md bg-emerald-700 px-4 text-sm font-bold text-white disabled:opacity-50">{act.isPending ? 'Working...' : 'Create invoices'}</button>
                            <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (to hold or return)" aria-label="Reason" className="h-9 w-64 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-600" />
                            <button type="button" disabled={picks.length === 0 || reason.trim().length < 3 || act.isPending} onClick={() => act.mutate({ action: 'HOLD', sodIds: picks.map((o) => o.id), reason })} className="h-9 rounded-md border border-slate-700 bg-white px-3 text-sm font-bold text-slate-900 disabled:opacity-50">Hold back</button>
                            <button type="button" disabled={picks.length === 0 || reason.trim().length < 3 || act.isPending} onClick={() => act.mutate({ action: 'RETURN', sodIds: picks.map((o) => o.id), reason })} className="h-9 rounded-md border border-red-700 bg-white px-3 text-sm font-bold text-red-800 disabled:opacity-50">Return to the check</button>
                        </div>

                        {result && (
                            <div className="space-y-2 rounded-xl border border-slate-300 bg-white p-4 text-sm text-slate-900" role="status">
                                <p className="font-bold">Result</p>
                                <ul className="list-disc pl-5">
                                    {result.created.map((c, i) => <li key={i}>{c.contractor} · {c.area} · {c.orders} order{c.orders === 1 ? '' : 's'}: {c.invoiceNumber ? <span className="font-semibold text-emerald-900">{c.invoiceNumber} ({money(c.total ?? 0)})</span> : <span className="font-semibold text-red-800">{c.error}</span>}</li>)}
                                </ul>
                                {result.blocked.length > 0 && (
                                    <div className="rounded-lg border border-amber-400 bg-amber-50 p-3">
                                        <p className="font-bold text-amber-950">Not invoiced yet ({result.blocked.length})</p>
                                        <ul className="mt-1 list-disc pl-5">{result.blocked.slice(0, 30).map((b) => <li key={b.soNum}><span className="font-semibold">{b.soNum}</span>: {b.reasons.map((r) => REASON[r] ?? r).join('; ')}</li>)}</ul>
                                    </div>
                                )}
                                {result.created.some((c) => c.invoiceNumber) && <p className="text-xs text-slate-800">Each new invoice now waits for the contractor to accept it, then for the Area Manager to approve it.</p>}
                                {result.notEligible > 0 && <p className="text-xs text-slate-800">{result.notEligible} selected order(s) were not eligible (not passed, held back, in another area, or completed after the billing month).</p>}
                            </div>
                        )}

                        {q.isLoading ? <div className="py-8 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-slate-700" /></div>
                            : q.isError ? <p className="text-sm text-red-800">{(q.error as Error).message}</p>
                                : groups.length === 0 ? <p className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-900">No orders are waiting to be invoiced for {MONTHS[month - 1]} {year} in your area. They appear here after the Area Coordinator or the QC Officer passes them on Completed SOD and the contractor verifies them.</p>
                                    : groups.map((g) => {
                                        const ids = g.orders.map((o) => o.id);
                                        const all = ids.every((id) => picked.has(id));
                                        return (
                                            <section key={g.key} className="rounded-xl border border-slate-300 bg-white p-4">
                                                <div className="flex flex-wrap items-center gap-3">
                                                    <input type="checkbox" checked={all} onChange={(e) => toggle(ids, e.target.checked)} aria-label={`Select all of ${g.contractorName} in ${g.area}`} />
                                                    <h2 className="text-base font-bold text-slate-900">{g.contractorName} · {g.area}</h2>
                                                    <span className="text-sm text-slate-900">{g.orders.length} orders · {money(g.total)}</span>
                                                    {g.lateCount > 0 && <span className="rounded-full border border-amber-400 bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-950">{g.lateCount} late SOD{g.lateCount === 1 ? '' : 's'}</span>}
                                                </div>
                                                <div className="mt-2 overflow-x-auto">
                                                    <table className="w-full text-sm">
                                                        <thead><tr className="border-b border-slate-300"><th className={th}></th><th className={th}>SO number</th><th className={th}>Completed</th><th className={th}>Payment</th><th className={th}></th></tr></thead>
                                                        <tbody>
                                                            {g.orders.map((o) => (
                                                                <tr key={o.id} className="border-b border-slate-200 text-slate-900">
                                                                    <td className="py-1.5 pr-3"><input type="checkbox" checked={picked.has(o.id)} onChange={(e) => toggle([o.id], e.target.checked)} aria-label={`Select ${o.soNum}`} /></td>
                                                                    <td className="py-1.5 pr-3 font-semibold">{o.soNum}</td>
                                                                    <td className="py-1.5 pr-3 whitespace-nowrap">{day(o.completedDate)}</td>
                                                                    <td className="py-1.5 pr-3 whitespace-nowrap">{money(o.contractorAmount)}</td>
                                                                    <td className="py-1.5">{o.late && <span className="rounded border border-amber-400 bg-amber-100 px-1.5 py-0.5 text-[11px] font-bold text-amber-950">Late SOD (completed {o.completedMonth})</span>}</td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </section>
                                        );
                                    })}

                        <section className="rounded-xl border border-slate-300 bg-white p-4">
                            <h2 className="text-base font-bold text-slate-900">Invoices of your area</h2>
                            <p className="text-xs text-slate-800">The latest invoices and where each one waits. You have no further step on them: the contractor accepts, then the Area Manager approves.</p>
                            {recent.isLoading ? <p className="mt-2 text-sm text-slate-900">Loading...</p> : (recent.data ?? []).length === 0 ? <p className="mt-2 text-sm text-slate-900">No invoices yet.</p> : (
                                <div className="mt-2 overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead><tr className="border-b border-slate-300"><th className={th}>Invoice</th><th className={th}>Contractor</th><th className={th}>Area</th><th className={th}>Month</th><th className={th}>Orders</th><th className={th}>Total</th><th className={th}>Waiting for</th></tr></thead>
                                        <tbody>
                                            {(recent.data ?? []).map((i) => (
                                                <tr key={i.id} className="border-b border-slate-200 text-slate-900">
                                                    <td className="py-1.5 pr-3 font-semibold whitespace-nowrap">{i.invoiceNumber}</td>
                                                    <td className="py-1.5 pr-3">{i.contractor}</td>
                                                    <td className="py-1.5 pr-3">{i.area}</td>
                                                    <td className="py-1.5 pr-3 whitespace-nowrap">{i.month ? MONTHS[i.month - 1] : '-'} {i.year ?? ''}</td>
                                                    <td className="py-1.5 pr-3">{i.orders}</td>
                                                    <td className="py-1.5 pr-3 whitespace-nowrap">{money(i.total)}</td>
                                                    <td className="py-1.5 font-semibold">{i.stage}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </section>

                        {held.length > 0 && (
                            <section className="rounded-xl border border-amber-400 bg-amber-50 p-4">
                                <h2 className="text-base font-bold text-amber-950">Held back ({held.reduce((a, g) => a + g.orders.length, 0)})</h2>
                                <p className="text-xs text-amber-950">These orders have a problem. They are billed in the month you release and invoice them.</p>
                                <ul className="mt-2 space-y-1 text-sm text-slate-900">
                                    {held.flatMap((g) => g.orders.map((o) => (
                                        <li key={o.id} className="flex flex-wrap items-center gap-2">
                                            <span className="font-semibold">{o.soNum}</span><span>{g.contractorName} · {g.area}</span><span>{o.holdReason}</span>
                                            <button type="button" disabled={act.isPending} onClick={() => act.mutate({ action: 'RELEASE', sodIds: [o.id] })} className="rounded border border-slate-700 bg-white px-2 py-0.5 text-xs font-bold text-slate-900">Release</button>
                                        </li>
                                    )))}
                                </ul>
                            </section>
                        )}
                    </main>
                </div>
            </div>
        </RoleGuard>
    );
}

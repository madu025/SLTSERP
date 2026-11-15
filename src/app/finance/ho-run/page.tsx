"use client";

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import RoleGuard from '@/components/RoleGuard';
import { Loader2, ListChecks } from 'lucide-react';
import { Panel } from '@/app/dashboard/components/health/HealthCharts';

type Cat = 'VENDOR_GOODS' | 'PROJECT_CONTRACTOR' | 'SOD_CONTRACTOR' | 'SITE_OFFICE_RENT' | 'VEHICLE_RENTAL' | 'OTHER_SERVICE';
interface CatInfo { key: Cat; label: string; defaultWhtPercent: number; allowRetention: boolean; requires: string }
interface PayRow { kind: 'VENDOR' | 'CONTRACTOR' | 'SOD'; category: Cat; id: string; number: string; payee: string; project: string | null; dueDate: string | null; overdue: boolean; outstanding: number; requested: number; unrequested: number; state: string; whtDefault: number; blocked: string | null }
interface QueueRow { id: string; pvNumber: string; status: string; payee: string; project: string | null; amount: number; taxWithheld: number; net: number; category: Cat; createdById: string | null }
interface RunResult { label?: string; pvNumber?: string; ok: boolean; error?: string }
interface Candidate { sourceId: string; label: string; landlord: string | null; vendorId: string | null; amount: number; billedInvoice: string | null }
interface Vendor { id: string; name: string }
interface SvcInvoice { id: string; invoiceNumber: string; status: string; category: string; totalAmount: number | string; periodMonth: string | null; vendor: { name: string } }

const th = 'py-2 pr-3 text-left text-slate-900';
const input = 'mt-1 block w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900';
const btn = 'rounded-md bg-indigo-700 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-800 disabled:opacity-50';
const TABS = [['payables', '1. Choose payables'], ['approve', '2. Approve'], ['send', '3. Send to Head Office'], ['service', 'Rent and vehicle invoices']] as const;

async function api<T>(url: string, init?: RequestInit): Promise<T> {
    const res = await fetch(url, { cache: 'no-store', ...init, headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) } });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json?.error?.message || (typeof json?.error === 'string' ? json.error : '') || 'Request failed');
    return (json.data ?? json) as T;
}

function ResultList({ results }: { results: RunResult[] | null }) {
    if (!results) return null;
    return (
        <ul className="mt-3 space-y-1 text-sm" data-testid="run-results">
            {results.map((r, i) => (
                <li key={i} className={r.ok ? 'text-emerald-800' : 'text-red-700'}>{r.ok ? '✓' : '✗'} {r.pvNumber ?? r.label}{r.ok ? '' : `: ${r.error}`}</li>
            ))}
        </ul>
    );
}

export default function HoRunPage() {
    const qc = useQueryClient();
    const [tab, setTab] = useState<(typeof TABS)[number][0]>('payables');
    const [category, setCategory] = useState<Cat>('PROJECT_CONTRACTOR');
    const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
    const [sel, setSel] = useState<Record<string, { amount: string; wht: string }>>({});
    const [results, setResults] = useState<RunResult[] | null>(null);
    const [pickedApprove, setPickedApprove] = useState<string[]>([]);
    const [pickedSend, setPickedSend] = useState<string[]>([]);
    const [note, setNote] = useState('');
    const [cand, setCand] = useState<string[]>([]);
    const [svcKind, setSvcKind] = useState<'RENT' | 'VEHICLE'>('RENT');
    const [man, setMan] = useState({ category: 'SITE_OFFICE_RENT', vendorId: '', invoiceNumber: '', invoiceDate: new Date().toISOString().slice(0, 10), periodMonth: new Date().toISOString().slice(0, 7), description: '', amount: '', tax: '' });

    const cats = useQuery<CatInfo[]>({ queryKey: ['run-cats'], queryFn: () => api('/api/finance/ho/run?categories=1'), staleTime: 600_000 });
    const pay = useQuery<{ month: string; rows: PayRow[] }>({ queryKey: ['run-pay', category, month], queryFn: () => api(`/api/finance/ho/run?category=${category}&month=${month}`), staleTime: 10_000, retry: false });
    const queue = useQuery<QueueRow[]>({ queryKey: ['run-queue'], queryFn: () => api('/api/finance/ho/run?queue=1'), staleTime: 5_000 });
    const candidates = useQuery<Candidate[]>({ queryKey: ['run-cand', svcKind, month], queryFn: () => api(`/api/procurement/invoices?candidates=${svcKind}&month=${month}`), enabled: tab === 'service', staleTime: 10_000 });
    const vendors = useQuery<Vendor[]>({ queryKey: ['run-vendors'], queryFn: async () => { const r = await api<Vendor[] | { data: Vendor[] }>('/api/vendors'); return Array.isArray(r) ? r : (r as { data: Vendor[] }).data ?? []; }, enabled: tab === 'service', staleTime: 60_000 });
    const svc = useQuery<SvcInvoice[]>({ queryKey: ['run-svc'], queryFn: async () => (await api<SvcInvoice[]>('/api/procurement/invoices')).filter((i) => i.category && i.category !== 'PO_GOODS'), enabled: tab === 'service', staleTime: 5_000 });
    const refresh = () => ['run-pay', 'run-queue', 'run-cand', 'run-svc'].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));

    const info = (cats.data ?? []).find((c) => c.key === category);
    const rows = pay.data?.rows ?? [];
    const chosen = rows.filter((r) => sel[r.id]);
    const amountOf = (r: PayRow) => Number(sel[r.id]?.amount || r.unrequested);
    const toggle = (r: PayRow, on: boolean) => setSel((s) => { const n = { ...s }; if (on) n[r.id] = { amount: String(r.unrequested), wht: String(r.whtDefault) }; else delete n[r.id]; return n; });

    const create = useMutation({
        mutationFn: () => api<RunResult[]>('/api/finance/ho/run', { method: 'POST', body: JSON.stringify({ action: 'CREATE', items: chosen.map((r) => ({ kind: r.kind, id: r.id, amount: amountOf(r), taxWithheld: Number(sel[r.id]?.wht || 0) })) }) }),
        onSuccess: (r) => { setResults(r); setSel({}); refresh(); toast[r.every((x) => x.ok) ? 'success' : 'warning'](`${r.filter((x) => x.ok).length} of ${r.length} requests created`); },
        onError: (e: Error) => toast.error(e.message),
    });
    const approve = useMutation({
        mutationFn: () => api<RunResult[]>('/api/finance/ho/run', { method: 'POST', body: JSON.stringify({ action: 'APPROVE', voucherIds: pickedApprove }) }),
        onSuccess: (r) => { setResults(r); setPickedApprove([]); refresh(); toast[r.every((x) => x.ok) ? 'success' : 'warning'](`${r.filter((x) => x.ok).length} of ${r.length} approved`); },
        onError: (e: Error) => toast.error(e.message),
    });
    const send = useMutation({
        mutationFn: () => api('/api/finance/ho/batches', { method: 'POST', body: JSON.stringify({ voucherIds: pickedSend, note: note || undefined }) }),
        onSuccess: () => { toast.success('Pack sent to Head Office'); setPickedSend([]); setNote(''); setResults(null); refresh(); },
        onError: (e: Error) => toast.error(e.message),
    });
    const generate = useMutation({
        mutationFn: () => api<{ label: string; ok: boolean; invoiceNumber?: string; error?: string }[]>('/api/procurement/invoices', { method: 'POST', body: JSON.stringify({ action: 'GENERATE', kind: svcKind, month, sourceIds: cand }) }),
        onSuccess: (r) => { setResults(r.map((x) => ({ label: x.label, pvNumber: x.invoiceNumber, ok: x.ok, error: x.error }))); setCand([]); refresh(); toast.success('Done'); },
        onError: (e: Error) => toast.error(e.message),
    });
    const manual = useMutation({
        mutationFn: () => api('/api/procurement/invoices', { method: 'POST', body: JSON.stringify({ action: 'CREATE_SERVICE', category: man.category, vendorId: man.vendorId, invoiceNumber: man.invoiceNumber, invoiceDate: man.invoiceDate, periodMonth: man.periodMonth || undefined, lines: [{ description: man.description || man.category, unitPrice: Number(man.amount), taxAmount: Number(man.tax || 0) }] }) }),
        onSuccess: () => { toast.success('Service invoice entered'); setMan({ ...man, invoiceNumber: '', amount: '', tax: '', description: '' }); refresh(); },
        onError: (e: Error) => toast.error(e.message),
    });
    const approveInvoice = useMutation({
        mutationFn: (id: string) => api('/api/procurement/invoices', { method: 'POST', body: JSON.stringify({ action: 'APPROVE', id }) }),
        onSuccess: () => { toast.success('Invoice approved'); refresh(); },
        onError: (e: Error) => toast.error(e.message),
    });

    const toApprove = (queue.data ?? []).filter((q) => q.status === 'PENDING_APPROVAL');
    const toSend = (queue.data ?? []).filter((q) => q.status === 'APPROVED');
    const sendTotal = toSend.filter((q) => pickedSend.includes(q.id)).reduce((a, q) => a + q.net, 0);

    return (
        <RoleGuard>
            <div className="flex h-screen bg-slate-50 overflow-hidden">
                <Sidebar />
                <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                    <Header />
                    <main className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
                        <div>
                            <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2"><ListChecks className="w-7 h-7 text-indigo-600" />Bulk payment run</h1>
                            <p className="mt-1 text-sm text-slate-700">Pick a category and month, choose what to pay (all or part of each invoice), create the requests together, approve them (a different person) and send them to Head Office as one pack.</p>
                        </div>
                        <div className="flex flex-wrap gap-2" role="tablist">
                            {TABS.map(([k, label]) => (
                                <button key={k} data-testid={`run-tab-${k}`} onClick={() => { setTab(k); setResults(null); }} className={`rounded-md border px-3 py-1.5 text-sm font-semibold ${tab === k ? 'border-indigo-700 bg-indigo-700 text-white' : 'border-slate-300 bg-white text-slate-900 hover:bg-slate-100'}`}>{label}{k === 'approve' && toApprove.length ? ` (${toApprove.length})` : ''}{k === 'send' && toSend.length ? ` (${toSend.length})` : ''}</button>
                            ))}
                        </div>

                        {tab === 'payables' && (
                            <Panel title="Payables">
                                <div className="flex flex-wrap items-end gap-3">
                                    <label className="text-xs font-semibold text-slate-900">Category
                                        <select data-testid="run-category" value={category} onChange={(e) => { setCategory(e.target.value as Cat); setSel({}); setResults(null); }} className={input}>
                                            {(cats.data ?? []).map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
                                        </select>
                                    </label>
                                    <label className="text-xs font-semibold text-slate-900">Due up to the end of
                                        <input data-testid="run-month" type="month" value={month} onChange={(e) => e.target.value && setMonth(e.target.value)} className={input} />
                                    </label>
                                    {info && <p className="text-xs text-slate-700">Needs: {info.requires}. Withholding tax is prefilled at {info.defaultWhtPercent}% and can be changed.</p>}
                                </div>
                                {pay.isLoading && <Loader2 className="mt-3 h-5 w-5 animate-spin text-blue-600" />}
                                {pay.error && <p className="mt-3 text-sm text-red-700">{(pay.error as Error).message}</p>}
                                <div className="mt-3 overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead><tr className="border-b border-slate-300"><th className={th} /><th className={th}>Document</th><th className={th}>Payee</th><th className={th}>Project</th><th className={th}>Due</th><th className={`${th} text-right`}>Outstanding</th><th className={`${th} text-right`}>Requested</th><th className={`${th} text-right`}>Pay now</th><th className={`${th} text-right`}>Withholding</th></tr></thead>
                                        <tbody>
                                            {rows.length === 0 && !pay.isLoading && <tr><td colSpan={9} className="py-3 text-slate-700">Nothing is waiting to be paid in this category.</td></tr>}
                                            {rows.map((r) => (
                                                <tr key={r.id} className="border-b border-slate-200 text-slate-900" data-testid="run-row">
                                                    <td className="py-2 pr-2"><input data-testid="run-pick" type="checkbox" disabled={r.unrequested <= 0 || !!r.blocked} checked={!!sel[r.id]} onChange={(e) => toggle(r, e.target.checked)} /></td>
                                                    <td className="py-2 pr-3 font-medium">{r.number}</td><td className="py-2 pr-3">{r.payee}</td><td className="py-2 pr-3">{r.project ?? '—'}</td>
                                                    <td className={`py-2 pr-3 ${r.overdue ? 'font-bold text-red-700' : ''}`}>{r.dueDate ?? '—'}</td>
                                                    <td className="py-2 pr-3 text-right">{r.outstanding.toLocaleString()}</td><td className="py-2 pr-3 text-right">{r.requested.toLocaleString()}</td>
                                                    <td className="py-2 pr-3 text-right">{sel[r.id] ? <input data-testid="run-amount" type="number" value={sel[r.id].amount} onChange={(e) => setSel({ ...sel, [r.id]: { ...sel[r.id], amount: e.target.value } })} className="w-28 rounded border border-slate-300 bg-white px-2 py-1 text-right text-slate-900" /> : r.blocked ? <span className="text-xs text-red-700">{r.blocked}</span> : r.unrequested.toLocaleString()}</td>
                                                    <td className="py-2 text-right">{sel[r.id] ? <input data-testid="run-wht" type="number" value={sel[r.id].wht} onChange={(e) => setSel({ ...sel, [r.id]: { ...sel[r.id], wht: e.target.value } })} className="w-24 rounded border border-slate-300 bg-white px-2 py-1 text-right text-slate-900" /> : ''}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-slate-200 pt-3">
                                    <button data-testid="run-create" disabled={chosen.length === 0 || create.isPending} onClick={() => create.mutate()} className={btn}>Create {chosen.length || ''} payment request{chosen.length === 1 ? '' : 's'} ({chosen.reduce((a, r) => a + amountOf(r), 0).toLocaleString()})</button>
                                    <span className="text-xs text-slate-700">Requests are sent for approval straight away. A different person approves them on the next step.</span>
                                </div>
                                <ResultList results={results} />
                            </Panel>
                        )}

                        {tab === 'approve' && (
                            <Panel title={`Requests waiting for approval (${toApprove.length})`}>
                                <table className="w-full text-sm">
                                    <thead><tr className="border-b border-slate-300"><th className={th} /><th className={th}>Request</th><th className={th}>Category</th><th className={th}>Payee</th><th className={th}>Project</th><th className={`${th} text-right`}>Amount</th><th className={`${th} text-right`}>Withholding</th><th className={`${th} text-right`}>Net</th></tr></thead>
                                    <tbody>
                                        {toApprove.length === 0 && <tr><td colSpan={8} className="py-3 text-slate-700">Nothing is waiting for approval.</td></tr>}
                                        {toApprove.map((q) => (
                                            <tr key={q.id} className="border-b border-slate-200 text-slate-900" data-testid="run-approve-row">
                                                <td className="py-2 pr-2"><input data-testid="run-approve-pick" type="checkbox" checked={pickedApprove.includes(q.id)} onChange={(e) => setPickedApprove(e.target.checked ? [...pickedApprove, q.id] : pickedApprove.filter((x) => x !== q.id))} /></td>
                                                <td className="py-2 pr-3 font-medium">{q.pvNumber}</td><td className="py-2 pr-3">{q.category.replace(/_/g, ' ')}</td><td className="py-2 pr-3">{q.payee}</td><td className="py-2 pr-3">{q.project ?? '—'}</td>
                                                <td className="py-2 pr-3 text-right">{q.amount.toLocaleString()}</td><td className="py-2 pr-3 text-right">{q.taxWithheld.toLocaleString()}</td><td className="py-2 text-right">{q.net.toLocaleString()}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                <div className="mt-3 flex items-center gap-3 border-t border-slate-200 pt-3">
                                    <button data-testid="run-approve" disabled={pickedApprove.length === 0 || approve.isPending} onClick={() => approve.mutate()} className={btn}>Approve {pickedApprove.length || ''} selected</button>
                                    <button onClick={() => setPickedApprove(toApprove.map((q) => q.id))} className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100">Select all</button>
                                </div>
                                <ResultList results={results} />
                            </Panel>
                        )}

                        {tab === 'send' && (
                            <Panel title={`Approved requests ready for Head Office (${toSend.length})`}>
                                <table className="w-full text-sm">
                                    <thead><tr className="border-b border-slate-300"><th className={th} /><th className={th}>Request</th><th className={th}>Category</th><th className={th}>Payee</th><th className={th}>Project</th><th className={`${th} text-right`}>Net to pay</th></tr></thead>
                                    <tbody>
                                        {toSend.length === 0 && <tr><td colSpan={6} className="py-3 text-slate-700">No approved requests are waiting to be sent.</td></tr>}
                                        {toSend.map((q) => (
                                            <tr key={q.id} className="border-b border-slate-200 text-slate-900" data-testid="run-send-row">
                                                <td className="py-2 pr-2"><input data-testid="run-send-pick" type="checkbox" checked={pickedSend.includes(q.id)} onChange={(e) => setPickedSend(e.target.checked ? [...pickedSend, q.id] : pickedSend.filter((x) => x !== q.id))} /></td>
                                                <td className="py-2 pr-3 font-medium">{q.pvNumber}</td><td className="py-2 pr-3">{q.category.replace(/_/g, ' ')}</td><td className="py-2 pr-3">{q.payee}</td><td className="py-2 pr-3">{q.project ?? '—'}</td><td className="py-2 text-right">{q.net.toLocaleString()}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                <div className="mt-3 flex flex-wrap items-end gap-3 border-t border-slate-200 pt-3">
                                    <label className="text-xs font-semibold text-slate-900">Note for Head Office<input data-testid="run-note" value={note} onChange={(e) => setNote(e.target.value)} className={`${input} w-72`} /></label>
                                    <button data-testid="run-send" disabled={pickedSend.length === 0 || send.isPending} onClick={() => send.mutate()} className={btn}>Send {pickedSend.length || ''} to Head Office{pickedSend.length ? ` (${sendTotal.toLocaleString()})` : ''}</button>
                                    <button onClick={() => setPickedSend(toSend.map((q) => q.id))} className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100">Select all</button>
                                </div>
                            </Panel>
                        )}

                        {tab === 'service' && (<>
                            <Panel title="Generate this month's invoices from the records">
                                <div className="flex flex-wrap items-end gap-3">
                                    <label className="text-xs font-semibold text-slate-900">Kind
                                        <select data-testid="svc-kind" value={svcKind} onChange={(e) => { setSvcKind(e.target.value as 'RENT' | 'VEHICLE'); setCand([]); }} className={input}><option value="RENT">Site office rent (agreements)</option><option value="VEHICLE">Vehicle rentals (approved monthly summaries)</option></select>
                                    </label>
                                    <label className="text-xs font-semibold text-slate-900">Month<input type="month" value={month} onChange={(e) => e.target.value && setMonth(e.target.value)} className={input} /></label>
                                </div>
                                <table className="mt-3 w-full text-sm">
                                    <thead><tr className="border-b border-slate-300"><th className={th} /><th className={th}>Record</th><th className={th}>Payee</th><th className={`${th} text-right`}>Amount</th><th className={th}>Status</th></tr></thead>
                                    <tbody>
                                        {(candidates.data ?? []).length === 0 && !candidates.isLoading && <tr><td colSpan={5} className="py-3 text-slate-700">No records for this month.</td></tr>}
                                        {(candidates.data ?? []).map((c) => (
                                            <tr key={c.sourceId} className="border-b border-slate-200 text-slate-900" data-testid="svc-cand">
                                                <td className="py-2 pr-2"><input type="checkbox" disabled={!!c.billedInvoice || !c.vendorId} checked={cand.includes(c.sourceId)} onChange={(e) => setCand(e.target.checked ? [...cand, c.sourceId] : cand.filter((x) => x !== c.sourceId))} /></td>
                                                <td className="py-2 pr-3 font-medium">{c.label}</td><td className="py-2 pr-3">{c.landlord ?? '—'}</td><td className="py-2 pr-3 text-right">{c.amount.toLocaleString()}</td>
                                                <td className="py-2 pr-3">{c.billedInvoice ? `Billed (${c.billedInvoice})` : c.vendorId ? 'Ready' : 'Link the payee to a vendor first'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                <button data-testid="svc-generate" disabled={cand.length === 0 || generate.isPending} onClick={() => generate.mutate()} className={`${btn} mt-3`}>Generate {cand.length || ''} invoice{cand.length === 1 ? '' : 's'}</button>
                                <ResultList results={results} />
                            </Panel>
                            <Panel title="Enter a service invoice by hand">
                                <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                                    <label className="text-xs font-semibold text-slate-900">Category<select data-testid="svc-category" value={man.category} onChange={(e) => setMan({ ...man, category: e.target.value })} className={input}><option value="SITE_OFFICE_RENT">Site office rent</option><option value="VEHICLE_RENTAL">Vehicle rental</option><option value="OTHER_SERVICE">Other service</option></select></label>
                                    <label className="text-xs font-semibold text-slate-900">Vendor<select data-testid="svc-vendor" value={man.vendorId} onChange={(e) => setMan({ ...man, vendorId: e.target.value })} className={input}><option value="">Choose…</option>{(vendors.data ?? []).map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}</select></label>
                                    <label className="text-xs font-semibold text-slate-900">Invoice number<input data-testid="svc-number" value={man.invoiceNumber} onChange={(e) => setMan({ ...man, invoiceNumber: e.target.value })} className={input} /></label>
                                    <label className="text-xs font-semibold text-slate-900">Invoice date<input type="date" value={man.invoiceDate} onChange={(e) => setMan({ ...man, invoiceDate: e.target.value })} className={input} /></label>
                                    <label className="text-xs font-semibold text-slate-900">For month<input type="month" value={man.periodMonth} onChange={(e) => setMan({ ...man, periodMonth: e.target.value })} className={input} /></label>
                                    <label className="text-xs font-semibold text-slate-900 md:col-span-1">Description<input value={man.description} onChange={(e) => setMan({ ...man, description: e.target.value })} className={input} /></label>
                                    <label className="text-xs font-semibold text-slate-900">Amount<input data-testid="svc-amount" type="number" value={man.amount} onChange={(e) => setMan({ ...man, amount: e.target.value })} className={input} /></label>
                                    <label className="text-xs font-semibold text-slate-900">Tax (VAT)<input type="number" value={man.tax} onChange={(e) => setMan({ ...man, tax: e.target.value })} className={input} /></label>
                                </div>
                                <button data-testid="svc-create" disabled={!man.vendorId || !man.invoiceNumber || !(Number(man.amount) > 0) || manual.isPending} onClick={() => manual.mutate()} className={`${btn} mt-3`}>Enter invoice</button>
                            </Panel>
                            <Panel title="Rent and vehicle invoices">
                                <table className="w-full text-sm">
                                    <thead><tr className="border-b border-slate-300"><th className={th}>Invoice</th><th className={th}>Category</th><th className={th}>Vendor</th><th className={th}>Month</th><th className={`${th} text-right`}>Total</th><th className={th}>Status</th><th /></tr></thead>
                                    <tbody>
                                        {(svc.data ?? []).length === 0 && <tr><td colSpan={7} className="py-3 text-slate-700">No service invoices yet.</td></tr>}
                                        {(svc.data ?? []).map((i) => (
                                            <tr key={i.id} className="border-b border-slate-200 text-slate-900" data-testid="svc-invoice">
                                                <td className="py-2 pr-3 font-medium">{i.invoiceNumber}</td><td className="py-2 pr-3">{i.category.replace(/_/g, ' ')}</td><td className="py-2 pr-3">{i.vendor.name}</td><td className="py-2 pr-3">{i.periodMonth ?? '—'}</td><td className="py-2 pr-3 text-right">{Number(i.totalAmount).toLocaleString()}</td><td className="py-2 pr-3" data-testid="svc-status">{i.status.replace('_', ' ')}</td>
                                                <td className="py-2 text-right">{['MATCHED', 'VARIANCE', 'DRAFT'].includes(i.status) && <button data-testid="svc-approve" disabled={approveInvoice.isPending} onClick={() => approveInvoice.mutate(i.id)} className="rounded border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-xs font-bold text-emerald-900 hover:bg-emerald-100">Approve</button>}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </Panel>
                        </>)}
                    </main>
                </div>
            </div>
        </RoleGuard>
    );
}

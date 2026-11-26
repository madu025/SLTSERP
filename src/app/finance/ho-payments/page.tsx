"use client";

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import RoleGuard from '@/components/RoleGuard';
import { Loader2, Send } from 'lucide-react';
import { Panel, compact } from '@/app/dashboard/components/health/HealthCharts';

interface Invoice { id: string; invoiceNumber: string; status: string; grnId?: string | null; matchStatus?: string; totalAmount: number | string; paidAmount: number | string; dueDate: string | null; vendor: { name: string; code: string } }
interface Voucher { id: string; pvNumber: string; status: string; type: string; amount: number | string; netAmount: number | string; taxWithheld: number | string; payeeName: string; supplierInvoiceId: string | null; hoPaidAmount?: number | string; hoBatchId: string | null; hoReference: string | null; createdAt: string }
interface Pack { id: string; batchNumber: string; status: string; totalAmount: number; voucherCount: number; paid: number; submittedAt: string }
interface PackLine { category: string; pvNumber: string; payee: string; type: string; amount: number; taxWithheld: number; retention: number; net: number; status: string; hoReference: string | null; hoPaidDate: string | null; invoiceNumber: string | null; invoiceDate: string | null; dueDate: string | null; matchStatus: string | null; poNumber: string | null; grnNumbers: string[]; approvedBy: string | null; project: string | null }

const th = 'py-2 pr-3 text-left text-slate-900';
const input = 'mt-1 block w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900';
const TONE: Record<string, string> = { DRAFT: 'bg-slate-100 text-slate-900', PENDING_APPROVAL: 'bg-amber-100 text-amber-900', APPROVED: 'bg-blue-100 text-blue-900', SUBMITTED_TO_HO: 'bg-indigo-100 text-indigo-900', PAID: 'bg-emerald-100 text-emerald-900', REJECTED: 'bg-red-100 text-red-900', CANCELLED: 'bg-red-100 text-red-900' };
const LABEL: Record<string, string> = { SUBMITTED_TO_HO: 'WITH HEAD OFFICE', PAID: 'PAID BY HEAD OFFICE' };

async function api<T>(url: string, init?: RequestInit): Promise<T> {
    const res = await fetch(url, { cache: 'no-store', ...init, headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) } });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json?.error?.message || (typeof json?.error === 'string' ? json.error : '') || 'Request failed');
    return (json.data ?? json) as T;
}

function downloadCsv(name: string, rows: (string | number | null)[][]) {
    const csv = rows.map((r) => r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\r\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    a.download = name;
    a.click();
    URL.revokeObjectURL(a.href);
}

function Inner() {
    const qc = useQueryClient();
    const preselect = useSearchParams().get('invoice') ?? '';
    const [invoiceId, setInvoiceId] = useState(preselect);
    const [amount, setAmount] = useState('');
    const [wht, setWht] = useState('0');
    const [picked, setPicked] = useState<string[]>([]);
    const [note, setNote] = useState('');
    const [confirm, setConfirm] = useState<{ id: string; mode: 'PAID' | 'RETURN' | 'PART' } | null>(null);
    const [partAmount, setPartAmount] = useState('');
    const [hoRef, setHoRef] = useState('');
    const [hoDate, setHoDate] = useState(new Date().toISOString().slice(0, 10));
    const [reason, setReason] = useState('');

    const invoices = useQuery<Invoice[]>({ queryKey: ['hp-invoices'], queryFn: async () => (await api<Invoice[]>('/api/procurement/invoices')).filter((i) => ['APPROVED', 'PARTIALLY_PAID'].includes(i.status) || (!!i.grnId && ['MATCHED', 'VARIANCE'].includes(i.status))), staleTime: 15_000 });
    const vouchers = useQuery<Voucher[]>({ queryKey: ['hp-vouchers'], queryFn: async () => { const r = await api<Voucher[] | { data: Voucher[] }>('/api/finance/payment-vouchers'); return Array.isArray(r) ? r : (r as { data: Voucher[] }).data ?? []; }, staleTime: 10_000 });
    const packs = useQuery<Pack[]>({ queryKey: ['hp-packs'], queryFn: () => api('/api/finance/ho/batches'), staleTime: 10_000 });

    const selected = (invoices.data ?? []).find((i) => i.id === invoiceId);
    const outstanding = selected ? Number(selected.totalAmount) - Number(selected.paidAmount) : 0;
    const refresh = () => { qc.invalidateQueries({ queryKey: ['hp-vouchers'] }); qc.invalidateQueries({ queryKey: ['hp-invoices'] }); qc.invalidateQueries({ queryKey: ['hp-packs'] }); };

    const create = useMutation({
        mutationFn: () => api('/api/finance/payment-vouchers', { method: 'POST', body: JSON.stringify({ supplierInvoiceId: invoiceId, title: `Payment of ${selected?.invoiceNumber}`, payeeName: selected?.vendor.name ?? 'Vendor', amount: Number(amount || outstanding), taxWithheld: Number(wht) || 0, paymentMethod: 'HEAD_OFFICE' }) }),
        onSuccess: () => { toast.success('Payment request created'); setAmount(''); setWht('0'); refresh(); },
        onError: (e: Error) => toast.error(e.message),
    });
    const move = useMutation({
        mutationFn: ({ id, status, extra }: { id: string; status: string; extra?: Record<string, string> }) => api(`/api/finance/payment-vouchers/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status, ...(status === 'CANCELLED' ? { cancelledReason: 'Cancelled by user' } : {}), ...(status === 'REJECTED' ? { rejectionReason: 'Rejected by approver' } : {}), ...extra }) }),
        onSuccess: () => { toast.success('Updated'); setConfirm(null); setHoRef(''); setReason(''); refresh(); },
        onError: (e: Error, vars) => {
            // accepting a voucher whose GRN invoice does not match the order: ask the reason, then accept again with it
            if (vars.status === 'APPROVED' && /MATCH_OVERRIDE_REASON_REQUIRED/.test(e.message)) {
                const why = window.prompt('The vendor invoice does not match the order and the GRN. Reason for accepting it:');
                if (why && why.trim().length >= 5) move.mutate({ ...vars, extra: { ...(vars.extra ?? {}), matchOverrideReason: why.trim() } });
                return;
            }
            toast.error(e.message);
        },
    });
    // the Account Executive at HO records a payment HO made on a vendor voucher, in full or one part
    const payPart = useMutation({
        mutationFn: ({ id }: { id: string }) => api(`/api/finance/payment-vouchers/${id}/payments`, { method: 'POST', body: JSON.stringify({ amount: Number(partAmount), reference: hoRef.trim(), paidDate: hoDate }) }),
        onSuccess: () => { toast.success('HO payment recorded'); setConfirm(null); setHoRef(''); setPartAmount(''); refresh(); },
        onError: (e: Error) => toast.error(e.message),
    });
    const submitPack = useMutation({
        mutationFn: () => api('/api/finance/ho/batches', { method: 'POST', body: JSON.stringify({ voucherIds: picked, note: note || undefined }) }),
        onSuccess: () => { toast.success('Pack submitted to Head Office'); setPicked([]); setNote(''); refresh(); },
        onError: (e: Error) => toast.error(e.message),
    });
    const downloadPack = async (p: Pack) => {
        try {
            const pack = await api<{ batchNumber: string; lines: PackLine[] }>(`/api/finance/ho/batches/${p.id}`);
            downloadCsv(`${pack.batchNumber}.csv`, [
                ['Voucher', 'Category', 'Payee', 'Type', 'Project', 'Invoice', 'Invoice date', 'Due', 'Match', 'PO', 'GRNs', 'Gross', 'Withholding tax', 'Retention', 'Net to pay', 'Approved by', 'Status', 'HO reference', 'HO paid date'],
                ...pack.lines.map((l) => [l.pvNumber, l.category, l.payee, l.type, l.project, l.invoiceNumber, l.invoiceDate, l.dueDate, l.matchStatus, l.poNumber, l.grnNumbers.join(' '), l.amount, l.taxWithheld, l.retention, l.net, l.approvedBy, l.status, l.hoReference, l.hoPaidDate]),
            ]);
        } catch (e) { toast.error((e as Error).message); }
    };

    const rows = vouchers.data ?? [];
    const approved = rows.filter((v) => v.status === 'APPROVED' && !v.hoBatchId);
    const pickedTotal = approved.filter((v) => picked.includes(v.id)).reduce((a, v) => a + Number(v.netAmount), 0);
    const next: Record<string, { label: string; status: string }[]> = {
        DRAFT: [{ label: 'Submit', status: 'PENDING_APPROVAL' }, { label: 'Cancel', status: 'CANCELLED' }],
        PENDING_APPROVAL: [{ label: 'Approve', status: 'APPROVED' }, { label: 'Reject', status: 'REJECTED' }],
        APPROVED: [{ label: 'Cancel', status: 'CANCELLED' }],
    };

    return (
        <RoleGuard>
            <div className="flex h-screen bg-slate-50 overflow-hidden">
                <Sidebar />
                <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                    <Header />
                    <main className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
                        <div>
                            <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2"><Send className="w-7 h-7 text-indigo-600" />Payment requests to Head Office</h1>
                            <p className="mt-1 text-sm text-slate-700">OSP Finance prepares and approves the request; Head Office pays and confirms it with its own reference.</p>
                        </div>

                        <Panel title="Vendor invoices awaiting a payment request (one per GRN)">
                            {invoices.isLoading && <Loader2 className="h-5 w-5 animate-spin text-blue-600" />}
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead><tr className="border-b border-slate-300"><th className={th}>Vendor</th><th className={th}>Invoice</th><th className={`${th} text-right`}>Total</th><th className={`${th} text-right`}>Paid</th><th className={`${th} text-right`}>Due</th><th className={th}>Status</th><th /></tr></thead>
                                    <tbody>
                                        {(invoices.data ?? []).length === 0 && !invoices.isLoading && <tr><td colSpan={7} className="py-3 text-slate-700">No approved invoices waiting for payment.</td></tr>}
                                        {(invoices.data ?? []).map((i) => (
                                            <tr key={i.id} className={`border-b border-slate-200 text-slate-900 ${i.id === invoiceId ? 'bg-indigo-50' : ''}`} data-testid="vp-invoice">
                                                <td className="py-2 pr-3 font-medium">{i.vendor.name}</td><td className="py-2 pr-3">{i.invoiceNumber}</td>
                                                <td className="py-2 pr-3 text-right">{compact(Number(i.totalAmount))}</td><td className="py-2 pr-3 text-right">{compact(Number(i.paidAmount))}</td>
                                                <td className={`py-2 pr-3 text-right ${i.dueDate && new Date(i.dueDate) < new Date() ? 'font-bold text-red-700' : ''}`}>{i.dueDate ? i.dueDate.slice(0, 10) : '—'}</td>
                                                <td className="py-2 pr-3">{i.status.replace('_', ' ')}</td>
                                                <td className="py-2 text-right"><button data-testid="vp-select" onClick={() => { setInvoiceId(i.id); setAmount(''); }} className="rounded border border-indigo-300 bg-indigo-50 px-2 py-0.5 text-xs font-bold text-indigo-900 hover:bg-indigo-100">Request payment</button></td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </Panel>

                        {selected && (
                            <Panel title={`New payment request: ${selected.vendor.name} · ${selected.invoiceNumber} (outstanding ${outstanding.toLocaleString()})`}>
                                <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                                    <label className="text-xs font-semibold text-slate-900">Amount (gross)
                                        <input data-testid="vp-amount" type="number" value={amount} placeholder={String(outstanding)} onChange={(e) => setAmount(e.target.value)} className={input} />
                                    </label>
                                    <label className="text-xs font-semibold text-slate-900">Withholding tax
                                        <input data-testid="vp-wht" type="number" value={wht} onChange={(e) => setWht(e.target.value)} className={input} />
                                    </label>
                                </div>
                                <button data-testid="vp-create" disabled={create.isPending} onClick={() => create.mutate()} className="mt-3 rounded-md bg-indigo-700 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-800 disabled:opacity-50">Create payment request</button>
                            </Panel>
                        )}

                        <Panel title={`Payment requests (${rows.length})`}>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead><tr className="border-b border-slate-300"><th className={th} /><th className={th}>Request</th><th className={th}>Payee</th><th className={th}>Type</th><th className={`${th} text-right`}>Net to pay</th><th className={th}>Status</th><th className={th}>HO reference</th><th className={`${th} text-right`}>Actions</th></tr></thead>
                                    <tbody>
                                        {rows.length === 0 && <tr><td colSpan={8} className="py-3 text-slate-700">No payment requests yet.</td></tr>}
                                        {rows.map((v) => (
                                            <tr key={v.id} className="border-b border-slate-200 text-slate-900" data-testid="vp-voucher">
                                                <td className="py-2 pr-2">{v.status === 'APPROVED' && !v.hoBatchId && <input data-testid="vp-pick" type="checkbox" checked={picked.includes(v.id)} onChange={(e) => setPicked(e.target.checked ? [...picked, v.id] : picked.filter((x) => x !== v.id))} />}</td>
                                                <td className="py-2 pr-3 font-medium">{v.pvNumber}</td><td className="py-2 pr-3">{v.payeeName}</td><td className="py-2 pr-3">{v.type}</td>
                                                <td className="py-2 pr-3 text-right">{Number(v.netAmount).toLocaleString()}</td>
                                                <td className="py-2 pr-3"><span className={`rounded px-2 py-0.5 font-semibold ${TONE[v.status] ?? ''}`} data-testid="vp-status">{LABEL[v.status] ?? v.status.replace('_', ' ')}</span></td>
                                                <td className="py-2 pr-3" data-testid="vp-ho">{v.hoReference ?? '—'}{v.supplierInvoiceId && Number(v.hoPaidAmount ?? 0) > 0 ? ` · paid ${Number(v.hoPaidAmount).toLocaleString()} of ${Number(v.amount).toLocaleString()}` : ''}</td>
                                                <td className="py-2 text-right whitespace-nowrap">
                                                    {(next[v.status] ?? []).map((a) => <button key={a.status} data-testid={`vp-${a.label.toLowerCase()}`} onClick={() => move.mutate({ id: v.id, status: a.status })} disabled={move.isPending} className="ml-1.5 rounded border border-slate-300 bg-white px-2 py-0.5 text-xs font-bold text-slate-900 hover:bg-slate-100 disabled:opacity-50">{a.label}</button>)}
                                                    {v.status === 'SUBMITTED_TO_HO' && (<>
                                                        {v.supplierInvoiceId ? <button data-testid="vp-pay-part" onClick={() => { setConfirm({ id: v.id, mode: 'PART' }); setPartAmount(String(Number(v.amount) - Number(v.hoPaidAmount ?? 0))); }} className="ml-1.5 rounded border border-violet-300 bg-violet-50 px-2 py-0.5 text-xs font-bold text-violet-900 hover:bg-violet-100">Record HO payment</button> : <button data-testid="vp-confirm" onClick={() => setConfirm({ id: v.id, mode: 'PAID' })} className="ml-1.5 rounded border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-xs font-bold text-emerald-900 hover:bg-emerald-100">Confirm paid</button>}
                                                        <button data-testid="vp-return" onClick={() => setConfirm({ id: v.id, mode: 'RETURN' })} className="ml-1.5 rounded border border-slate-300 bg-white px-2 py-0.5 text-xs font-bold text-slate-900 hover:bg-slate-100">Return</button>
                                                    </>)}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            {approved.length > 0 && (
                                <div className="mt-3 flex flex-wrap items-end gap-3 border-t border-slate-200 pt-3">
                                    <label className="text-xs font-semibold text-slate-900">Note for Head Office
                                        <input data-testid="hp-note" value={note} onChange={(e) => setNote(e.target.value)} className={`${input} w-72`} />
                                    </label>
                                    <button data-testid="hp-submit" disabled={picked.length === 0 || submitPack.isPending} onClick={() => submitPack.mutate()} className="rounded-md bg-indigo-700 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-800 disabled:opacity-50">Submit {picked.length || ''} selected to Head Office{picked.length ? ` (${pickedTotal.toLocaleString()})` : ''}</button>
                                </div>
                            )}
                        </Panel>

                        {confirm && (
                            <Panel title={confirm.mode === 'PAID' ? 'Confirm the payment made by Head Office' : confirm.mode === 'PART' ? 'Record a payment made by Head Office (full or part)' : 'Return this request to OSP Finance'}>
                                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                                    {confirm.mode === 'PART' ? (<>
                                        <label className="text-xs font-semibold text-slate-900">Amount paid now
                                            <input data-testid="ho-part-amount" type="number" min={0} step="0.01" value={partAmount} onChange={(e) => setPartAmount(e.target.value)} className={input} />
                                        </label>
                                        <label className="text-xs font-semibold text-slate-900">Cheque / transfer reference
                                            <input data-testid="ho-ref" value={hoRef} onChange={(e) => setHoRef(e.target.value)} className={input} />
                                        </label>
                                        <label className="text-xs font-semibold text-slate-900">Date paid
                                            <input data-testid="ho-date" type="date" value={hoDate} onChange={(e) => setHoDate(e.target.value)} className={input} />
                                        </label>
                                    </>) : confirm.mode === 'PAID' ? (<>
                                        <label className="text-xs font-semibold text-slate-900">Head Office payment reference
                                            <input data-testid="ho-ref" value={hoRef} onChange={(e) => setHoRef(e.target.value)} className={input} />
                                        </label>
                                        <label className="text-xs font-semibold text-slate-900">Date paid
                                            <input data-testid="ho-date" type="date" value={hoDate} onChange={(e) => setHoDate(e.target.value)} className={input} />
                                        </label>
                                    </>) : (
                                        <label className="text-xs font-semibold text-slate-900 md:col-span-2">Reason
                                            <input data-testid="ho-reason" value={reason} onChange={(e) => setReason(e.target.value)} className={input} />
                                        </label>
                                    )}
                                    <div className="flex items-end gap-2">
                                        {confirm.mode === 'PART' && <button data-testid="ho-part-go" disabled={payPart.isPending || hoRef.trim().length < 3 || !(Number(partAmount) > 0)} onClick={() => payPart.mutate({ id: confirm.id })} className="rounded-md bg-violet-800 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-900 disabled:opacity-50">Record payment</button>}
                                        {confirm.mode !== 'PART' && <button data-testid="ho-go" disabled={move.isPending || (confirm.mode === 'PAID' ? !hoRef.trim() : !reason.trim())} onClick={() => move.mutate(confirm.mode === 'PAID' ? { id: confirm.id, status: 'PAID', extra: { hoReference: hoRef, hoPaidDate: hoDate } } : { id: confirm.id, status: 'APPROVED', extra: { returnReason: reason } })} className="rounded-md bg-indigo-700 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-800 disabled:opacity-50">{confirm.mode === 'PAID' ? 'Confirm paid' : 'Return request'}</button>}
                                        <button onClick={() => setConfirm(null)} className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900">Close</button>
                                    </div>
                                </div>
                            </Panel>
                        )}

                        <Panel title={`Packs sent to Head Office (${(packs.data ?? []).length})`}>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead><tr className="border-b border-slate-300"><th className={th}>Pack</th><th className={th}>Sent</th><th className={`${th} text-right`}>Requests</th><th className={`${th} text-right`}>Paid</th><th className={`${th} text-right`}>Net total</th><th className={th}>Status</th><th /></tr></thead>
                                    <tbody>
                                        {(packs.data ?? []).length === 0 && <tr><td colSpan={7} className="py-3 text-slate-700">No packs sent yet.</td></tr>}
                                        {(packs.data ?? []).map((p) => (
                                            <tr key={p.id} className="border-b border-slate-200 text-slate-900" data-testid="hp-pack">
                                                <td className="py-2 pr-3 font-medium">{p.batchNumber}</td><td className="py-2 pr-3">{String(p.submittedAt).slice(0, 10)}</td>
                                                <td className="py-2 pr-3 text-right">{p.voucherCount}</td><td className="py-2 pr-3 text-right">{p.paid}</td>
                                                <td className="py-2 pr-3 text-right">{p.totalAmount.toLocaleString()}</td><td className="py-2 pr-3" data-testid="hp-pack-status">{p.status.replace('_', ' ')}</td>
                                                <td className="py-2 text-right"><button data-testid="hp-download" onClick={() => downloadPack(p)} className="rounded border border-slate-300 bg-white px-2 py-0.5 text-xs font-bold text-slate-900 hover:bg-slate-100">Download pack</button></td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </Panel>
                    </main>
                </div>
            </div>
        </RoleGuard>
    );
}

export default function HoPaymentsPage() {
    return <Suspense fallback={null}><Inner /></Suspense>;
}

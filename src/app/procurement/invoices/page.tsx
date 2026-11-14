"use client";

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import RoleGuard from '@/components/RoleGuard';
import ExportCsvButton from '@/components/ExportCsvButton';
import { Loader2, ReceiptText } from 'lucide-react';
import { Panel, compact } from '@/app/dashboard/components/health/HealthCharts';

interface PoRow { id: string; poNumber: string; vendor: string; vendorId: string | null; status: string; totalAmount: number | string }
interface Ctx {
    kind: 'STORE' | 'PROJECT'; poId: string; poNumber: string; vendorId: string | null; vendorName: string; currency: string;
    lines: { poItemId: string; description: string; orderedQty: number; orderedPrice: number; receivedQty: number; invoicedBefore: number; billable: number }[];
}
interface InvoiceRow {
    id: string; invoiceNumber: string; status: string; matchStatus: string; totalAmount: number | string; invoiceDate: string; overrideReason?: string | null; rejectionReason?: string | null;
    vendor: { name: string; code: string }; storePo?: { poNumber: string } | null; projectPo?: { poNumber: string } | null;
    matchDetail?: { lines?: { poItemId: string; description?: string; result: string; priceVariancePct: number | null }[] } | null;
}

const th = 'py-2 pr-3 text-left text-slate-900';
const STATUS_TONE: Record<string, string> = {
    MATCHED: 'bg-emerald-100 text-emerald-900', VARIANCE: 'bg-amber-100 text-amber-900', APPROVED: 'bg-blue-100 text-blue-900',
    PAID: 'bg-slate-200 text-slate-900', REJECTED: 'bg-red-100 text-red-900', DRAFT: 'bg-slate-100 text-slate-900',
};
const RESULT_TONE: Record<string, string> = { MATCHED: 'text-emerald-800', PRICE_VARIANCE: 'text-amber-800', QTY_OVER_RECEIVED: 'text-red-800', NOT_RECEIVED: 'text-red-800' };

async function api<T>(url: string, init?: RequestInit): Promise<T> {
    const res = await fetch(url, { cache: 'no-store', ...init, headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) } });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json?.error?.message || (typeof json?.error === 'string' ? json.error : '') || 'Request failed');
    return (json.data ?? json) as T;
}

export default function SupplierInvoicesPage() {
    const qc = useQueryClient();
    const [poKey, setPoKey] = useState('');
    const [invoiceNumber, setInvoiceNumber] = useState('');
    const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().slice(0, 10));
    const [qty, setQty] = useState<Record<string, number>>({});
    const [price, setPrice] = useState<Record<string, number>>({});
    const [tax, setTax] = useState<Record<string, number>>({});

    const invoices = useQuery<InvoiceRow[]>({ queryKey: ['supplier-invoices'], queryFn: () => api('/api/procurement/invoices'), staleTime: 15_000 });
    const pos = useQuery<PoRow[]>({ queryKey: ['store-pos-for-invoice'], queryFn: () => api('/api/procurement/purchase-orders'), staleTime: 30_000 });
    const ctx = useQuery<Ctx>({
        queryKey: ['po-context', poKey],
        enabled: !!poKey,
        queryFn: async () => {
            const c = await api<Ctx>(`/api/procurement/invoices?po=${poKey}`);
            setQty(Object.fromEntries(c.lines.map((l) => [l.poItemId, l.billable])));
            setPrice(Object.fromEntries(c.lines.map((l) => [l.poItemId, l.orderedPrice])));
            setTax({});
            return c;
        },
    });

    const refresh = () => { qc.invalidateQueries({ queryKey: ['supplier-invoices'] }); qc.invalidateQueries({ queryKey: ['po-context'] }); };
    const create = useMutation({
        mutationFn: () => {
            const [kind, poId] = poKey.split(':');
            return api<InvoiceRow>('/api/procurement/invoices', {
                method: 'POST',
                body: JSON.stringify({
                    action: 'CREATE', kind, poId, invoiceNumber, invoiceDate,
                    lines: (ctx.data?.lines ?? []).filter((l) => (qty[l.poItemId] ?? 0) > 0).map((l) => ({ poItemId: l.poItemId, quantity: qty[l.poItemId], unitPrice: price[l.poItemId] ?? l.orderedPrice, taxAmount: tax[l.poItemId] ?? 0 })),
                }),
            });
        },
        onSuccess: (inv) => { toast.success(`Invoice entered: ${inv.matchStatus === 'MATCHED' ? 'matches the order and receipts' : 'does NOT match, review before approving'}`); setInvoiceNumber(''); refresh(); },
        onError: (e: Error) => toast.error(e.message),
    });
    const act = useMutation({
        mutationFn: (body: Record<string, unknown>) => api('/api/procurement/invoices', { method: 'POST', body: JSON.stringify(body) }),
        onSuccess: () => { toast.success('Done'); refresh(); },
        onError: (e: Error) => toast.error(e.message),
    });

    const approve = (inv: InvoiceRow) => {
        let overrideReason: string | undefined;
        if (inv.matchStatus !== 'MATCHED') {
            const r = window.prompt('This invoice does not match the order and receipts. Reason for approving anyway?');
            if (!r || r.trim().length < 5) return;
            overrideReason = r;
        }
        act.mutate({ action: 'APPROVE', id: inv.id, overrideReason });
    };
    const reject = (inv: InvoiceRow) => {
        const r = window.prompt('Reason for rejecting this invoice?');
        if (r && r.trim().length >= 3) act.mutate({ action: 'REJECT', id: inv.id, reason: r });
    };

    const rows = invoices.data ?? [];
    const exportRows = () => [['Vendor', 'Invoice', 'PO', 'Date', 'Total', 'Status', 'Match'], ...rows.map((r) => [r.vendor.name, r.invoiceNumber, r.storePo?.poNumber ?? r.projectPo?.poNumber ?? '', r.invoiceDate.slice(0, 10), Number(r.totalAmount), r.status, r.matchStatus])];
    const openPos = (pos.data ?? []).filter((p) => p.vendorId && !['CANCELLED', 'CLOSED'].includes(p.status));

    return (
        <RoleGuard>
            <div className="flex h-screen bg-slate-50 overflow-hidden">
                <Sidebar />
                <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                    <Header />
                    <main className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2"><ReceiptText className="w-7 h-7 text-indigo-600" />Supplier invoices</h1>
                            <ExportCsvButton filename="supplier-invoices.csv" disabled={rows.length === 0} getRows={exportRows} />
                        </div>

                        <Panel title="Enter an invoice (matched against the order and the goods received)">
                            <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                                <label className="text-xs font-semibold text-slate-900 md:col-span-2">Purchase order
                                    <select data-testid="inv-po" value={poKey} onChange={(e) => setPoKey(e.target.value)} className="mt-1 block w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900">
                                        <option value="">Choose an order…</option>
                                        {openPos.map((p) => <option key={p.id} value={`STORE:${p.id}`}>{p.poNumber} · {p.vendor} · {Number(p.totalAmount).toLocaleString()}</option>)}
                                    </select>
                                </label>
                                <label className="text-xs font-semibold text-slate-900">Vendor invoice no.
                                    <input data-testid="inv-number" value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} className="mt-1 block w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900" />
                                </label>
                                <label className="text-xs font-semibold text-slate-900">Invoice date
                                    <input type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} className="mt-1 block w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900" />
                                </label>
                            </div>
                            {ctx.isLoading && <Loader2 className="mt-3 h-5 w-5 animate-spin text-blue-600" />}
                            {ctx.data && (
                                <div className="mt-3 overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead><tr className="border-b border-slate-300"><th className={th}>Line</th><th className={`${th} text-right`}>Ordered</th><th className={`${th} text-right`}>Received</th><th className={`${th} text-right`}>Billed before</th><th className={`${th} text-right`}>Invoice qty</th><th className={`${th} text-right`}>Unit price</th><th className={`${th} text-right`}>Tax</th></tr></thead>
                                        <tbody>
                                            {ctx.data.lines.map((l) => (
                                                <tr key={l.poItemId} className="border-b border-slate-200 text-slate-900">
                                                    <td className="py-2 pr-3 font-medium">{l.description}</td>
                                                    <td className="py-2 pr-3 text-right">{l.orderedQty}</td><td className="py-2 pr-3 text-right">{l.receivedQty}</td><td className="py-2 pr-3 text-right">{l.invoicedBefore}</td>
                                                    <td className="py-2 pr-3 text-right"><input data-testid="inv-qty" type="number" value={qty[l.poItemId] ?? 0} onChange={(e) => setQty((p) => ({ ...p, [l.poItemId]: parseFloat(e.target.value) || 0 }))} className="w-20 rounded border border-slate-300 bg-white px-1 py-0.5 text-right text-slate-900" /></td>
                                                    <td className="py-2 pr-3 text-right"><input data-testid="inv-price" type="number" value={price[l.poItemId] ?? 0} onChange={(e) => setPrice((p) => ({ ...p, [l.poItemId]: parseFloat(e.target.value) || 0 }))} className="w-24 rounded border border-slate-300 bg-white px-1 py-0.5 text-right text-slate-900" /></td>
                                                    <td className="py-2 text-right"><input type="number" value={tax[l.poItemId] ?? 0} onChange={(e) => setTax((p) => ({ ...p, [l.poItemId]: parseFloat(e.target.value) || 0 }))} className="w-20 rounded border border-slate-300 bg-white px-1 py-0.5 text-right text-slate-900" /></td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                    <button data-testid="inv-submit" onClick={() => create.mutate()} disabled={create.isPending || !invoiceNumber.trim()} className="mt-3 rounded-md bg-indigo-700 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-800 disabled:opacity-50">Enter invoice</button>
                                </div>
                            )}
                        </Panel>

                        <Panel title={`Invoices (${rows.length})`}>
                            {invoices.isLoading && <Loader2 className="h-5 w-5 animate-spin text-blue-600" />}
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead><tr className="border-b border-slate-300"><th className={th}>Vendor</th><th className={th}>Invoice</th><th className={th}>PO</th><th className={`${th} text-right`}>Total</th><th className={th}>Match</th><th className={th}>Status</th><th className={`${th} text-right`}>Actions</th></tr></thead>
                                    <tbody>
                                        {rows.length === 0 && <tr><td colSpan={7} className="py-3 text-slate-700">No supplier invoices yet.</td></tr>}
                                        {rows.map((r) => (
                                            <tr key={r.id} className="border-b border-slate-200 text-slate-900" data-testid="inv-row">
                                                <td className="py-2 pr-3 font-medium">{r.vendor.name}</td>
                                                <td className="py-2 pr-3">{r.invoiceNumber}</td>
                                                <td className="py-2 pr-3">{r.storePo?.poNumber ?? r.projectPo?.poNumber}</td>
                                                <td className="py-2 pr-3 text-right">{compact(Number(r.totalAmount))}</td>
                                                <td className="py-2 pr-3">
                                                    <span className={`rounded px-2 py-0.5 font-semibold ${STATUS_TONE[r.matchStatus] ?? ''}`} data-testid="inv-match">{r.matchStatus}</span>
                                                    {r.matchStatus !== 'MATCHED' && r.matchDetail?.lines?.filter((l) => l.result !== 'MATCHED').map((l) => <div key={l.poItemId} className={`text-[11px] ${RESULT_TONE[l.result] ?? ''}`}>{l.description}: {l.result.replace(/_/g, ' ').toLowerCase()}{l.priceVariancePct !== null && l.result === 'PRICE_VARIANCE' ? ` (${l.priceVariancePct}%)` : ''}</div>)}
                                                </td>
                                                <td className="py-2 pr-3"><span className={`rounded px-2 py-0.5 font-semibold ${STATUS_TONE[r.status] ?? ''}`} data-testid="inv-status">{r.status}</span></td>
                                                <td className="py-2 text-right whitespace-nowrap">
                                                    {['MATCHED', 'VARIANCE', 'DRAFT'].includes(r.status) && <>
                                                        <button data-testid="inv-approve" onClick={() => approve(r)} className="mr-2 rounded border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-xs font-bold text-emerald-900 hover:bg-emerald-100">Approve</button>
                                                        <button data-testid="inv-reject" onClick={() => reject(r)} className="rounded border border-red-300 bg-red-50 px-2 py-0.5 text-xs font-bold text-red-900 hover:bg-red-100">Reject</button>
                                                    </>}
                                                    {r.status === 'APPROVED' && <button onClick={() => act.mutate({ action: 'MARK_PAID', id: r.id })} className="rounded border border-slate-300 bg-slate-50 px-2 py-0.5 text-xs font-bold text-slate-900 hover:bg-slate-100">Mark paid</button>}
                                                </td>
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

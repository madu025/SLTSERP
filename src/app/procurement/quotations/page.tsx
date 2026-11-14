"use client";

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import RoleGuard from '@/components/RoleGuard';
import ExportCsvButton from '@/components/ExportCsvButton';
import { Loader2, Scale } from 'lucide-react';
import { Panel, compact } from '@/app/dashboard/components/health/HealthCharts';

interface ReqRow { id: string; prNumber: string; title: string; items: number; quotations: number; received: number; awarded: boolean }
interface Quote {
    id: string; quoteNumber: string; vendorId: string; vendorName: string; status: string; total: number; deliveryDays: number | null; validUntil: string | null;
    paymentTerms: string | null; score: number | null; expired: boolean; lowest: boolean; complete: boolean; prices: Record<string, number | null>;
}
interface Comparison {
    requisition: { id: string; prNumber: string; title: string; status: string };
    items: { id: string; itemCode: string; description: string; unit: string; quantity: number; estimatedPrice: number }[];
    quotes: Quote[]; awardedQuotationId: string | null;
}
interface Vendor { id: string; code: string; name: string }

const th = 'py-2 pr-3 text-left text-slate-900';
const STATUS_TONE: Record<string, string> = { REQUESTED: 'bg-slate-100 text-slate-900', RECEIVED: 'bg-blue-100 text-blue-900', ACCEPTED: 'bg-emerald-100 text-emerald-900', REJECTED: 'bg-red-100 text-red-900' };

async function api<T>(url: string, init?: RequestInit): Promise<T> {
    const res = await fetch(url, { cache: 'no-store', ...init, headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) } });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json?.error?.message || (typeof json?.error === 'string' ? json.error : '') || 'Request failed');
    return (json.data ?? json) as T;
}

export default function QuotationsPage() {
    const qc = useQueryClient();
    const [reqId, setReqId] = useState('');
    const [picked, setPicked] = useState<Record<string, boolean>>({});
    const [editing, setEditing] = useState<string | null>(null);
    const [prices, setPrices] = useState<Record<string, number>>({});
    const [deliveryDays, setDeliveryDays] = useState('');
    const [validUntil, setValidUntil] = useState('');

    const reqs = useQuery<ReqRow[]>({ queryKey: ['rfq-reqs'], queryFn: () => api('/api/procurement/rfq'), staleTime: 30_000 });
    const vendors = useQuery<Vendor[]>({ queryKey: ['rfq-vendors'], queryFn: () => api('/api/procurement/vendors/list'), staleTime: 300_000 });
    const cmp = useQuery<Comparison>({ queryKey: ['rfq-compare', reqId], enabled: !!reqId, queryFn: () => api(`/api/procurement/rfq?requisitionId=${reqId}`) });

    const refresh = () => { qc.invalidateQueries({ queryKey: ['rfq-compare'] }); qc.invalidateQueries({ queryKey: ['rfq-reqs'] }); };
    const request = useMutation({
        mutationFn: () => api<{ created: { emailed: boolean }[]; skippedVendors: number }>('/api/procurement/rfq', { method: 'POST', body: JSON.stringify({ action: 'REQUEST', requisitionId: reqId, vendorIds: Object.keys(picked).filter((k) => picked[k]) }) }),
        onSuccess: (r) => { toast.success(`${r.created.length} quotation request(s) created, ${r.created.filter((c) => c.emailed).length} emailed`); setPicked({}); refresh(); },
        onError: (e: Error) => toast.error(e.message),
    });
    const submit = useMutation({
        mutationFn: (quotationId: string) => api('/api/procurement/rfq', {
            method: 'POST',
            body: JSON.stringify({ action: 'SUBMIT_QUOTE', quotationId, deliveryDays: deliveryDays ? Number(deliveryDays) : null, validUntil: validUntil || null, prices: (cmp.data?.items ?? []).map((i) => ({ requisitionItemId: i.id, unitPrice: prices[i.id] ?? 0 })) }),
        }),
        onSuccess: () => { toast.success('Quotation recorded'); setEditing(null); setPrices({}); refresh(); },
        onError: (e: Error) => toast.error(e.message),
    });
    const award = useMutation({
        mutationFn: ({ quotationId, reason }: { quotationId: string; reason?: string }) => api<{ purchaseOrder: { poNumber: string } }>('/api/procurement/rfq', { method: 'POST', body: JSON.stringify({ action: 'AWARD', quotationId, reason }) }),
        onSuccess: (r) => { toast.success(`Awarded: draft purchase order ${r.purchaseOrder.poNumber} created`); refresh(); },
        onError: (e: Error) => toast.error(e.message),
    });

    const doAward = (q: Quote) => {
        let reason: string | undefined;
        const lowest = cmp.data?.quotes.find((x) => x.lowest && !x.expired);
        if (lowest && lowest.id !== q.id) {
            const r = window.prompt(`${lowest.vendorName} quoted lower. Why award ${q.vendorName}?`);
            if (!r || r.trim().length < 5) return;
            reason = r;
        }
        award.mutate({ quotationId: q.id, reason });
    };

    const c = cmp.data;
    const exportRows = () => c ? [['Item', 'Quantity', ...c.quotes.map((q) => q.vendorName)], ...c.items.map((i) => [`${i.itemCode} ${i.description}`, i.quantity, ...c.quotes.map((q) => q.prices[i.id])]), ['Total', '', ...c.quotes.map((q) => q.total)]] : [];

    return (
        <RoleGuard>
            <div className="flex h-screen bg-slate-50 overflow-hidden">
                <Sidebar />
                <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                    <Header />
                    <main className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2"><Scale className="w-7 h-7 text-indigo-600" />Quotations</h1>
                            <ExportCsvButton filename="quotation-comparison.csv" disabled={!c} getRows={exportRows} />
                        </div>

                        <Panel title="Approved requisitions">
                            {reqs.isLoading && <Loader2 className="h-5 w-5 animate-spin text-blue-600" />}
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead><tr className="border-b border-slate-300"><th className={th}>Requisition</th><th className={th}>Title</th><th className={`${th} text-right`}>Items</th><th className={`${th} text-right`}>Quotations</th><th className={`${th} text-right`}>Received</th><th className={th}>Status</th><th /></tr></thead>
                                    <tbody>
                                        {(reqs.data ?? []).length === 0 && !reqs.isLoading && <tr><td colSpan={7} className="py-3 text-slate-700">No approved requisitions.</td></tr>}
                                        {(reqs.data ?? []).map((r) => (
                                            <tr key={r.id} className="border-b border-slate-200 text-slate-900" data-testid="rfq-req">
                                                <td className="py-2 pr-3 font-medium">{r.prNumber}</td><td className="py-2 pr-3">{r.title}</td>
                                                <td className="py-2 pr-3 text-right">{r.items}</td><td className="py-2 pr-3 text-right">{r.quotations}</td><td className="py-2 pr-3 text-right">{r.received}</td>
                                                <td className="py-2 pr-3">{r.awarded ? <span className="rounded bg-emerald-100 px-2 py-0.5 font-semibold text-emerald-900">Awarded</span> : r.received > 0 ? 'Ready to compare' : r.quotations > 0 ? 'Waiting for quotes' : 'No RFQ yet'}</td>
                                                <td className="py-2 text-right"><button data-testid="rfq-open" onClick={() => setReqId(r.id)} className="rounded border border-indigo-300 bg-indigo-50 px-2 py-0.5 text-xs font-bold text-indigo-900 hover:bg-indigo-100">Open</button></td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </Panel>

                        {c && (
                            <>
                                <Panel title={`${c.requisition.prNumber} · ${c.requisition.title}`}>
                                    {!c.awardedQuotationId && (
                                        <div className="mb-4">
                                            <p className="mb-2 text-xs font-semibold text-slate-900">Request quotations from</p>
                                            <div className="flex flex-wrap gap-3">
                                                {(vendors.data ?? []).map((v) => (
                                                    <label key={v.id} className="flex items-center gap-1.5 text-sm text-slate-900">
                                                        <input data-testid="rfq-vendor" type="checkbox" checked={!!picked[v.id]} onChange={(e) => setPicked((p) => ({ ...p, [v.id]: e.target.checked }))} />{v.name}
                                                    </label>
                                                ))}
                                            </div>
                                            <button data-testid="rfq-send" disabled={request.isPending || !Object.values(picked).some(Boolean)} onClick={() => request.mutate()} className="mt-3 rounded-md bg-indigo-700 px-3 py-1.5 text-sm font-semibold text-white hover:bg-indigo-800 disabled:opacity-50">Send request</button>
                                        </div>
                                    )}
                                    <div className="overflow-x-auto" data-testid="rfq-matrix">
                                        <table className="w-full text-sm">
                                            <thead><tr className="border-b border-slate-300"><th className={th}>Item</th><th className={`${th} text-right`}>Qty</th>{c.quotes.map((q) => <th key={q.id} className={`${th} text-right`}>{q.vendorName}<div className="text-[11px] font-normal text-slate-700">{q.quoteNumber}</div></th>)}</tr></thead>
                                            <tbody>
                                                {c.items.map((i) => {
                                                    const vals = c.quotes.map((q) => q.prices[i.id]).filter((v): v is number => v !== null && v > 0);
                                                    const min = vals.length ? Math.min(...vals) : null;
                                                    return (
                                                        <tr key={i.id} className="border-b border-slate-200 text-slate-900">
                                                            <td className="py-2 pr-3 font-medium">{i.itemCode} · {i.description}</td><td className="py-2 pr-3 text-right">{i.quantity} {i.unit}</td>
                                                            {c.quotes.map((q) => <td key={q.id} className={`py-2 pr-3 text-right ${q.prices[i.id] !== null && q.prices[i.id] === min ? 'font-bold text-emerald-800' : ''}`}>{q.prices[i.id] === null ? '—' : Number(q.prices[i.id]).toLocaleString()}</td>)}
                                                        </tr>
                                                    );
                                                })}
                                                <tr className="border-b border-slate-300 text-slate-900"><td className="py-2 pr-3 font-bold">Total</td><td />{c.quotes.map((q) => <td key={q.id} className={`py-2 pr-3 text-right font-bold ${q.lowest ? 'text-emerald-800' : ''}`} data-testid="rfq-total">{q.total > 0 ? compact(q.total) : '—'}</td>)}</tr>
                                                <tr className="border-b border-slate-200 text-slate-900"><td className="py-2 pr-3">Delivery (days)</td><td />{c.quotes.map((q) => <td key={q.id} className="py-2 pr-3 text-right">{q.deliveryDays ?? '—'}</td>)}</tr>
                                                <tr className="border-b border-slate-200 text-slate-900"><td className="py-2 pr-3">Valid until</td><td />{c.quotes.map((q) => <td key={q.id} className={`py-2 pr-3 text-right ${q.expired ? 'text-red-700 font-semibold' : ''}`}>{q.validUntil ? q.validUntil.slice(0, 10) : '—'}{q.expired ? ' (expired)' : ''}</td>)}</tr>
                                                <tr className="border-b border-slate-200 text-slate-900"><td className="py-2 pr-3">Score</td><td />{c.quotes.map((q) => <td key={q.id} className="py-2 pr-3 text-right font-semibold" data-testid="rfq-score">{q.score ?? '—'}</td>)}</tr>
                                                <tr className="text-slate-900"><td className="py-2 pr-3">Status</td><td />{c.quotes.map((q) => (
                                                    <td key={q.id} className="py-2 pr-3 text-right">
                                                        <span className={`rounded px-2 py-0.5 font-semibold ${STATUS_TONE[q.status] ?? ''}`} data-testid="rfq-status">{q.status}</span>
                                                        <div className="mt-1.5 space-x-1.5">
                                                            {['REQUESTED', 'RECEIVED'].includes(q.status) && !c.awardedQuotationId && <button data-testid="rfq-enter" onClick={() => { setEditing(q.id); setPrices({}); }} className="rounded border border-slate-300 bg-white px-2 py-0.5 text-xs font-bold text-slate-900 hover:bg-slate-100">Enter prices</button>}
                                                            {q.status === 'RECEIVED' && !c.awardedQuotationId && <button data-testid="rfq-award" onClick={() => doAward(q)} className="rounded border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-xs font-bold text-emerald-900 hover:bg-emerald-100">Award</button>}
                                                        </div>
                                                    </td>
                                                ))}</tr>
                                            </tbody>
                                        </table>
                                    </div>
                                </Panel>

                                {editing && (
                                    <Panel title={`Enter prices: ${c.quotes.find((q) => q.id === editing)?.vendorName}`}>
                                        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                                            {c.items.map((i) => (
                                                <label key={i.id} className="flex items-center justify-between gap-3 text-sm text-slate-900">
                                                    <span>{i.itemCode} · {i.description} ({i.quantity} {i.unit})</span>
                                                    <input data-testid="rfq-price" type="number" value={prices[i.id] ?? ''} onChange={(e) => setPrices((p) => ({ ...p, [i.id]: parseFloat(e.target.value) || 0 }))} className="w-28 rounded border border-slate-300 bg-white px-1 py-0.5 text-right text-slate-900" />
                                                </label>
                                            ))}
                                            <label className="flex items-center justify-between gap-3 text-sm text-slate-900">Delivery days<input type="number" value={deliveryDays} onChange={(e) => setDeliveryDays(e.target.value)} className="w-28 rounded border border-slate-300 bg-white px-1 py-0.5 text-right text-slate-900" /></label>
                                            <label className="flex items-center justify-between gap-3 text-sm text-slate-900">Valid until<input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} className="rounded border border-slate-300 bg-white px-1 py-0.5 text-slate-900" /></label>
                                        </div>
                                        <button data-testid="rfq-save" onClick={() => submit.mutate(editing)} disabled={submit.isPending} className="mt-3 rounded-md bg-indigo-700 px-3 py-1.5 text-sm font-semibold text-white hover:bg-indigo-800 disabled:opacity-50">Save quotation</button>
                                    </Panel>
                                )}
                            </>
                        )}
                    </main>
                </div>
            </div>
        </RoleGuard>
    );
}

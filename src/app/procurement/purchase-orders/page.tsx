"use client";

import Link from 'next/link';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import RoleGuard from '@/components/RoleGuard';
import ExportCsvButton from '@/components/ExportCsvButton';
import { Loader2, ClipboardList } from 'lucide-react';
import { Panel, compact } from '@/app/dashboard/components/health/HealthCharts';
import type { UnifiedPo } from '@/services/procurement/unified-po.service';

const th = 'py-2 pr-3 text-left text-slate-900';
const STATUSES = ['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'ISSUED', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CLOSED', 'CANCELLED'];
const TONE: Record<string, string> = {
    DRAFT: 'bg-slate-100 text-slate-900', PENDING_APPROVAL: 'bg-amber-100 text-amber-900', APPROVED: 'bg-blue-100 text-blue-900', ISSUED: 'bg-indigo-100 text-indigo-900',
    PARTIALLY_RECEIVED: 'bg-cyan-100 text-cyan-900', RECEIVED: 'bg-emerald-100 text-emerald-900', CLOSED: 'bg-slate-200 text-slate-900', CANCELLED: 'bg-red-100 text-red-900',
};

export default function PurchaseOrdersPage() {
    const [kind, setKind] = useState('');
    const [status, setStatus] = useState('');
    const { data, isLoading, error } = useQuery<UnifiedPo[]>({
        queryKey: ['unified-pos', kind, status],
        queryFn: async ({ signal }) => {
            const params = new URLSearchParams();
            if (kind) params.set('kind', kind);
            if (status) params.set('status', status);
            const res = await fetch(`/api/procurement/purchase-orders/all?${params}`, { cache: 'no-store', signal });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error?.message || 'Failed to load purchase orders');
            return json.data;
        },
        staleTime: 20_000,
        refetchOnWindowFocus: false,
    });
    const rows = data ?? [];
    const exportRows = () => [['PO', 'Type', 'Vendor', 'Status', 'Total', 'Currency', 'Order date', 'Expected', 'For'], ...rows.map((r) => [r.poNumber, r.kind === 'STORE' ? 'Store' : 'Project', r.vendorName, r.status, r.total, r.currency, r.orderDate.slice(0, 10), r.expectedDelivery?.slice(0, 10) ?? '', r.scopeLabel])];
    const counts = STATUSES.map((s) => ({ s, n: rows.filter((r) => r.status === s).length })).filter((c) => c.n > 0);

    return (
        <RoleGuard>
            <div className="flex h-screen bg-slate-50 overflow-hidden">
                <Sidebar />
                <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                    <Header />
                    <main className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2"><ClipboardList className="w-7 h-7 text-indigo-600" />Purchase orders</h1>
                            <div className="flex items-end gap-3">
                                <label className="text-xs font-semibold text-slate-900">Type
                                    <select data-testid="po-kind" value={kind} onChange={(e) => setKind(e.target.value)} className="mt-1 block rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900">
                                        <option value="">All</option><option value="STORE">Store</option><option value="PROJECT">Project</option>
                                    </select>
                                </label>
                                <label className="text-xs font-semibold text-slate-900">Status
                                    <select data-testid="po-status-filter" value={status} onChange={(e) => setStatus(e.target.value)} className="mt-1 block rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900">
                                        <option value="">All</option>{STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
                                    </select>
                                </label>
                                <ExportCsvButton filename="purchase-orders.csv" disabled={rows.length === 0} getRows={exportRows} />
                            </div>
                        </div>

                        {counts.length > 0 && (
                            <div className="flex flex-wrap gap-2">
                                {counts.map((c) => <span key={c.s} className={`rounded px-2 py-1 text-xs font-semibold ${TONE[c.s]}`}>{c.s.replace(/_/g, ' ')} · {c.n}</span>)}
                            </div>
                        )}

                        <Panel title={`Orders (${rows.length})`}>
                            {isLoading && <Loader2 className="h-5 w-5 animate-spin text-blue-600" />}
                            {error && <p className="text-sm text-red-700">{(error as Error).message}</p>}
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead><tr className="border-b border-slate-300"><th className={th}>PO</th><th className={th}>Type</th><th className={th}>Vendor</th><th className={th}>For</th><th className={th}>Status</th><th className={`${th} text-right`}>Total</th><th className={`${th} text-right`}>Expected</th></tr></thead>
                                    <tbody>
                                        {rows.length === 0 && !isLoading && <tr><td colSpan={7} className="py-3 text-slate-700">No purchase orders.</td></tr>}
                                        {rows.map((r) => (
                                            <tr key={`${r.kind}-${r.id}`} className="border-b border-slate-200 text-slate-900" data-testid="po-row">
                                                <td className="py-2 pr-3 font-medium"><Link href={r.href} className="hover:underline">{r.poNumber}</Link></td>
                                                <td className="py-2 pr-3">{r.kind === 'STORE' ? 'Store' : 'Project'}</td>
                                                <td className="py-2 pr-3">{r.vendorName}{!r.vendorId && <span className="ml-1 text-[11px] text-amber-800">(not linked)</span>}</td>
                                                <td className="py-2 pr-3">{r.scopeLabel}</td>
                                                <td className="py-2 pr-3"><span className={`rounded px-2 py-0.5 font-semibold ${TONE[r.status] ?? ''}`} data-testid="po-row-status">{r.status.replace(/_/g, ' ')}</span></td>
                                                <td className="py-2 pr-3 text-right">{compact(r.total)}</td>
                                                <td className="py-2 text-right">{r.expectedDelivery ? r.expectedDelivery.slice(0, 10) : '—'}</td>
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

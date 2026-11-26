"use client";

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import RoleGuard from '@/components/RoleGuard';
import ExportCsvButton from '@/components/ExportCsvButton';
import { Loader2, ScrollText } from 'lucide-react';
import { Panel, compact } from '@/app/dashboard/components/health/HealthCharts';
import type { VendorBalanceRow, VendorStatement } from '@/services/finance/vendor-statement.service';

const th = 'py-2 pr-3 text-left text-slate-900';

async function api<T>(url: string): Promise<T> {
    const res = await fetch(url, { cache: 'no-store' });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json?.error?.message || 'Request failed');
    return (json.data ?? json) as T;
}

export default function VendorStatementPage() {
    const [vendorId, setVendorId] = useState('');
    const list = useQuery<VendorBalanceRow[]>({ queryKey: ['vs-list'], queryFn: () => api('/api/finance/vendor-statement'), staleTime: 30_000 });
    const stmt = useQuery<VendorStatement>({ queryKey: ['vs-one', vendorId], enabled: !!vendorId, queryFn: () => api(`/api/finance/vendor-statement?vendorId=${vendorId}`) });
    const s = stmt.data;
    const exportRows = () => s ? [['Date', 'Type', 'Reference', 'Detail', 'Invoiced', 'Paid / credited', 'Balance'], ...s.lines.map((l) => [l.date, l.type, l.reference, l.detail, l.debit, l.credit, l.balance])] : [];

    return (
        <RoleGuard>
            <div className="flex h-screen bg-slate-50 overflow-hidden">
                <Sidebar />
                <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                    <Header />
                    <main className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2"><ScrollText className="w-7 h-7 text-indigo-600" />Vendor statement</h1>
                            <ExportCsvButton filename="vendor-statement.csv" disabled={!s} getRows={exportRows} />
                        </div>

                        <Panel title="Vendors">
                            {list.isLoading && <Loader2 className="h-5 w-5 animate-spin text-blue-600" />}
                            {list.error && <p className="text-sm text-red-700">{(list.error as Error).message}</p>}
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead><tr className="border-b border-slate-300"><th className={th}>Vendor</th><th className={`${th} text-right`}>Invoiced</th><th className={`${th} text-right`}>Paid</th><th className={`${th} text-right`}>Debit notes</th><th className={`${th} text-right`}>Balance</th><th /></tr></thead>
                                    <tbody>
                                        {(list.data ?? []).length === 0 && !list.isLoading && <tr><td colSpan={6} className="py-3 text-slate-700">No vendor invoices yet.</td></tr>}
                                        {(list.data ?? []).map((v) => (
                                            <tr key={v.vendorId} className="border-b border-slate-200 text-slate-900" data-testid="vs-row">
                                                <td className="py-2 pr-3 font-medium">{v.name}</td><td className="py-2 pr-3 text-right">{compact(v.invoiced)}</td><td className="py-2 pr-3 text-right">{compact(v.paid)}</td>
                                                <td className="py-2 pr-3 text-right">{compact(v.debitNotes)}</td><td className="py-2 pr-3 text-right font-semibold" data-testid="vs-balance">{compact(v.balance)}</td>
                                                <td className="py-2 text-right"><button data-testid="vs-open" onClick={() => setVendorId(v.vendorId)} className="rounded border border-indigo-300 bg-indigo-50 px-2 py-0.5 text-xs font-bold text-indigo-900 hover:bg-indigo-100">Open</button></td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </Panel>

                        {s && (
                            <Panel title={`${s.vendor.name} · balance ${s.totals.balance.toLocaleString()}${s.overdue > 0 ? ` · overdue ${s.overdue.toLocaleString()}` : ''}`}>
                                <div className="overflow-x-auto" data-testid="vs-statement">
                                    <table className="w-full text-sm">
                                        <thead><tr className="border-b border-slate-300"><th className={th}>Date</th><th className={th}>Type</th><th className={th}>Reference</th><th className={th}>Detail</th><th className={`${th} text-right`}>Invoiced</th><th className={`${th} text-right`}>Paid / credited</th><th className={`${th} text-right`}>Balance</th></tr></thead>
                                        <tbody>
                                            {s.lines.map((l, i) => (
                                                <tr key={i} className="border-b border-slate-200 text-slate-900">
                                                    <td className="py-2 pr-3">{l.date}</td><td className="py-2 pr-3">{l.type.replace(/_/g, ' ')}</td><td className="py-2 pr-3 font-medium">{l.reference}</td><td className="py-2 pr-3">{l.detail}</td>
                                                    <td className="py-2 pr-3 text-right">{l.debit ? l.debit.toLocaleString() : ''}</td><td className="py-2 pr-3 text-right">{l.credit ? l.credit.toLocaleString() : ''}</td><td className="py-2 text-right font-semibold">{l.balance.toLocaleString()}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </Panel>
                        )}
                    </main>
                </div>
            </div>
        </RoleGuard>
    );
}

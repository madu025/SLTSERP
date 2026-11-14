"use client";

import { useQuery } from '@tanstack/react-query';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import RoleGuard from '@/components/RoleGuard';
import ExportCsvButton from '@/components/ExportCsvButton';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, HeartPulse } from 'lucide-react';
import type { InventoryHealth } from '@/lib/supply-chain-shared';
import { AgeingBars, Panel, compact } from '@/app/dashboard/components/health/HealthCharts';

function Stat({ label, value, tone = '' }: { label: string; value: string; tone?: string }) {
    return (
        <Card className="shadow-sm"><CardContent className="p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-700">{label}</p>
            <p className={`mt-1 text-2xl font-bold text-slate-900 ${tone}`}>{value}</p>
        </CardContent></Card>
    );
}

const th = 'py-2 pr-3 text-left text-slate-900';
const num = (v: number | null) => (v === null ? '—' : compact(v));

export default function InventoryHealthPage() {
    const { data, isLoading, error } = useQuery<InventoryHealth>({
        queryKey: ['inventory-health'],
        queryFn: async ({ signal }) => {
            const res = await fetch('/api/inventory/health', { cache: 'no-store', signal });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error?.message || 'Failed to load inventory health');
            return json.data;
        },
        staleTime: 60_000,
        refetchOnWindowFocus: false,
    });

    const exportRows = () => data ? [
        ['Store', 'Item code', 'Item', 'Available', 'Minimum', 'Suggested order', 'Stock-out'],
        ...data.reorder.map((r) => [r.store, r.code, r.name, r.available, r.min, r.suggestedQty, r.stockOut ? 'yes' : 'no']),
    ] : [];

    return (
        <RoleGuard>
            <div className="flex h-screen bg-slate-50 overflow-hidden">
                <Sidebar />
                <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                    <Header />
                    <main className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2"><HeartPulse className="w-7 h-7 text-indigo-600" />Inventory health</h1>
                            <ExportCsvButton filename="reorder-list.csv" disabled={!data} getRows={exportRows} />
                        </div>

                        {isLoading && <div className="flex h-40 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /></div>}
                        {error && <p className="text-sm text-red-700">{(error as Error).message}</p>}

                        {data && (
                            <>
                                <div className="grid grid-cols-2 gap-4 xl:grid-cols-5">
                                    <Stat label="Stock value" value={num(data.totals.value)} />
                                    <Stat label="Below reorder" value={String(data.totals.belowReorder)} tone={data.totals.belowReorder > 0 ? 'text-amber-700' : ''} />
                                    <Stat label="Stock-outs" value={String(data.totals.stockOut)} tone={data.totals.stockOut > 0 ? 'text-red-700' : ''} />
                                    <Stat label="Dead stock value" value={num(data.totals.deadValue)} />
                                    <Stat label="Stores never counted" value={String(data.neverCountedStores)} tone={data.neverCountedStores > 0 ? 'text-amber-700' : ''} />
                                </div>

                                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                                    {data.showValues && <Panel title="Stock value by store">
                                        <AgeingBars data={data.stores.slice(0, 8).map((s) => ({ name: s.name.slice(0, 12), value: s.value ?? 0 }))} format={compact} empty="No stock" color="#6366f1" />
                                    </Panel>}
                                    <Panel title="Dead stock by days without movement">
                                        <AgeingBars data={data.dead.map((d) => ({ name: d.bucket, value: data.showValues && (data.totals.deadValue ?? 0) > 0 ? (d.value ?? 0) : d.skus }))} format={compact} empty="No dead stock" />
                                    </Panel>
                                </div>

                                <Panel title={`Reorder list (${data.totals.belowReorder})`}>
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm">
                                            <thead><tr className="border-b border-slate-300"><th className={th}>Store</th><th className={th}>Item</th><th className={`${th} text-right`}>Available</th><th className={`${th} text-right`}>Minimum</th><th className={`${th} text-right`}>Suggested order</th><th className={`${th} text-right`}>Status</th></tr></thead>
                                            <tbody>
                                                {data.reorder.length === 0 && <tr><td colSpan={6} className="py-3 text-slate-700">Nothing below its reorder level.</td></tr>}
                                                {data.reorder.slice(0, 25).map((r) => (
                                                    <tr key={`${r.storeId}-${r.code}`} className="border-b border-slate-200 text-slate-900">
                                                        <td className="py-2 pr-3">{r.store}</td><td className="py-2 pr-3 font-medium">{r.code} · {r.name}</td>
                                                        <td className="py-2 pr-3 text-right">{r.available}</td><td className="py-2 pr-3 text-right">{r.min}</td><td className="py-2 pr-3 text-right font-semibold">{r.suggestedQty}</td>
                                                        <td className="py-2 text-right"><span className={`rounded px-2 py-0.5 font-semibold ${r.stockOut ? 'bg-red-100 text-red-900' : 'bg-amber-100 text-amber-900'}`}>{r.stockOut ? 'Out of stock' : 'Low'}</span></td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </Panel>

                                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                                    <Panel title="Dead stock, largest first">
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-sm">
                                                <thead><tr className="border-b border-slate-300"><th className={th}>Item</th><th className={th}>Store</th><th className={`${th} text-right`}>Qty</th><th className={`${th} text-right`}>Value</th><th className={`${th} text-right`}>Idle days</th></tr></thead>
                                                <tbody>
                                                    {data.deadTop.length === 0 && <tr><td colSpan={5} className="py-3 text-slate-700">No dead stock.</td></tr>}
                                                    {data.deadTop.map((d, i) => (
                                                        <tr key={i} className="border-b border-slate-200 text-slate-900">
                                                            <td className="py-2 pr-3 font-medium">{d.code}</td><td className="py-2 pr-3">{d.store}</td>
                                                            <td className="py-2 pr-3 text-right">{d.quantity}</td><td className="py-2 pr-3 text-right">{num(d.value)}</td>
                                                            <td className="py-2 text-right">{d.daysSinceMove ?? 'never'}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </Panel>
                                    <Panel title="Batches expiring within 30 days">
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-sm">
                                                <thead><tr className="border-b border-slate-300"><th className={th}>Item</th><th className={th}>Batch</th><th className={`${th} text-right`}>Qty</th><th className={`${th} text-right`}>Days left</th></tr></thead>
                                                <tbody>
                                                    {data.expiring.length === 0 && <tr><td colSpan={4} className="py-3 text-slate-700">Nothing expiring.</td></tr>}
                                                    {data.expiring.map((e, i) => (
                                                        <tr key={i} className="border-b border-slate-200 text-slate-900">
                                                            <td className="py-2 pr-3 font-medium">{e.item}</td><td className="py-2 pr-3">{e.batch}</td><td className="py-2 pr-3 text-right">{e.quantity}</td>
                                                            <td className="py-2 text-right"><span className={`rounded px-2 py-0.5 font-semibold ${e.daysLeft < 0 ? 'bg-red-100 text-red-900' : 'bg-amber-100 text-amber-900'}`}>{e.daysLeft < 0 ? 'expired' : e.daysLeft}</span></td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </Panel>
                                </div>

                                {data.showValues && (
                                    <Panel title="Largest stock lines: value and days of cover">
                                        <table className="w-full text-sm">
                                            <thead><tr className="border-b border-slate-300"><th className={th}>Item</th><th className={`${th} text-right`}>Value</th><th className={`${th} text-right`}>Used (90 d)</th><th className={`${th} text-right`}>Cover (days)</th></tr></thead>
                                            <tbody>
                                                {data.turnover.map((t) => (
                                                    <tr key={t.code} className="border-b border-slate-200 text-slate-900">
                                                        <td className="py-2 pr-3 font-medium">{t.code} · {t.name}</td><td className="py-2 pr-3 text-right">{num(t.value)}</td>
                                                        <td className="py-2 pr-3 text-right">{num(t.outflow90)}</td><td className="py-2 text-right">{t.coverDays ?? '—'}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </Panel>
                                )}

                                <ul className="list-disc space-y-1 pl-5 text-xs text-slate-700">{data.notes.map((n) => <li key={n}>{n}</li>)}</ul>
                            </>
                        )}
                    </main>
                </div>
            </div>
        </RoleGuard>
    );
}

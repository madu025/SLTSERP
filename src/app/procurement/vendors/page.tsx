"use client";

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import RoleGuard from '@/components/RoleGuard';
import ExportCsvButton from '@/components/ExportCsvButton';
import { Loader2, Award } from 'lucide-react';
import { MIN_ORDERS_FOR_VENDOR_RANKING, VENDOR_SCORE_WEIGHTS, type VendorScorecard } from '@/lib/supply-chain-shared';
import { AgeingBars, Panel, compact } from '@/app/dashboard/components/health/HealthCharts';

const th = 'py-2 pr-3 text-left text-slate-900';
const scoreTone = (s: number | null) => (s === null ? 'text-slate-700' : s >= 80 ? 'bg-emerald-100 text-emerald-900' : s >= 60 ? 'bg-amber-100 text-amber-900' : 'bg-red-100 text-red-900');
const pct = (v: number | null) => (v === null ? '—' : `${v}%`);

export default function VendorScorecardPage() {
    const [months, setMonths] = useState('12');
    const { data, isLoading, error } = useQuery<VendorScorecard>({
        queryKey: ['vendor-scorecard', months],
        queryFn: async ({ signal }) => {
            const res = await fetch(`/api/procurement/vendors/scorecard?months=${months}`, { cache: 'no-store', signal });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error?.message || 'Failed to load vendor scorecard');
            return json.data;
        },
        staleTime: 60_000,
        refetchOnWindowFocus: false,
    });

    const exportRows = () => data ? [
        ['Vendor', 'Orders', 'Spend', 'On-time %', 'Reject %', 'Avg lead days', 'Score'],
        ...data.rows.map((r) => [r.name, r.orders, r.spend, r.onTimePct, r.rejectPct, r.avgLeadDays, r.score]),
    ] : [];

    return (
        <RoleGuard>
            <div className="flex h-screen bg-slate-50 overflow-hidden">
                <Sidebar />
                <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                    <Header />
                    <main className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2"><Award className="w-7 h-7 text-indigo-600" />Vendor scorecard</h1>
                            <div className="flex items-end gap-3">
                                <label className="text-xs font-semibold text-slate-900">Window
                                    <select value={months} onChange={(e) => setMonths(e.target.value)} className="mt-1 block rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900">
                                        <option value="6">Last 6 months</option><option value="12">Last 12 months</option><option value="24">Last 24 months</option>
                                    </select>
                                </label>
                                <ExportCsvButton filename="vendor-scorecard.csv" disabled={!data} getRows={exportRows} />
                            </div>
                        </div>

                        {isLoading && <div className="flex h-40 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /></div>}
                        {error && <p className="text-sm text-red-700">{(error as Error).message}</p>}

                        {data && (
                            <>
                                <Panel title={`Spend by vendor · ${compact(data.totalSpend)} total`}>
                                    <AgeingBars data={data.rows.slice(0, 8).map((r) => ({ name: r.name.slice(0, 12), value: r.spend }))} format={compact} empty="No purchase orders in this window" color="#6366f1" />
                                </Panel>

                                <Panel title="Vendors">
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm">
                                            <thead><tr className="border-b border-slate-300"><th className={th}>Vendor</th><th className={`${th} text-right`}>Orders</th><th className={`${th} text-right`}>Spend</th><th className={`${th} text-right`}>On time</th><th className={`${th} text-right`}>Rejects</th><th className={`${th} text-right`}>Lead (days)</th><th className={`${th} text-right`}>Score</th></tr></thead>
                                            <tbody>
                                                {data.rows.length === 0 && <tr><td colSpan={7} className="py-3 text-slate-700">No vendor activity in this window.</td></tr>}
                                                {data.rows.map((r) => (
                                                    <tr key={r.vendorId} className="border-b border-slate-200 text-slate-900">
                                                        <td className="py-2 pr-3 font-medium">{r.name}</td><td className="py-2 pr-3 text-right">{r.orders}</td><td className="py-2 pr-3 text-right">{compact(r.spend)}</td>
                                                        <td className="py-2 pr-3 text-right">{pct(r.onTimePct)}</td><td className="py-2 pr-3 text-right">{pct(r.rejectPct)}</td><td className="py-2 pr-3 text-right">{r.avgLeadDays ?? '—'}</td>
                                                        <td className="py-2 text-right"><span className={`rounded px-2 py-0.5 font-semibold ${scoreTone(r.score)}`} title={r.lowVolume ? `Fewer than ${MIN_ORDERS_FOR_VENDOR_RANKING} orders: not ranked` : undefined}>{r.score ?? 'n/a'}</span></td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </Panel>

                                {data.unlinked.length > 0 && (
                                    <Panel title="Store purchase orders: vendors typed as free text (not scored)">
                                        <ul className="grid grid-cols-1 gap-1 text-sm text-slate-900 sm:grid-cols-2 lg:grid-cols-3">
                                            {data.unlinked.map((u) => <li key={u.name} className="flex justify-between border-b border-slate-200 py-1"><span className="font-medium">{u.name}</span><span>{u.pos} PO(s)</span></li>)}
                                        </ul>
                                    </Panel>
                                )}

                                <ul className="list-disc space-y-1 pl-5 text-xs text-slate-700">
                                    <li>Score = on-time {VENDOR_SCORE_WEIGHTS.onTime} + quality {VENDOR_SCORE_WEIGHTS.quality} + price {VENDOR_SCORE_WEIGHTS.price} + lead time {VENDOR_SCORE_WEIGHTS.leadTime} points; criteria without data are left out and the rest re-weighted. Price is not scored because POs carry no link to their quotation.</li>
                                    <li>Vendors with fewer than {MIN_ORDERS_FOR_VENDOR_RANKING} orders are shown but not scored.</li>
                                </ul>
                            </>
                        )}
                    </main>
                </div>
            </div>
        </RoleGuard>
    );
}

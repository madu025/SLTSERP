"use client";

import { useQuery } from '@tanstack/react-query';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import RoleGuard from '@/components/RoleGuard';
import ExportCsvButton from '@/components/ExportCsvButton';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, Scale, AlertTriangle, CheckCircle2 } from 'lucide-react';
import type { LiabilitiesSchedule } from '@/services/finance/liabilities-schedule.service';

const fmt = (v: number) => v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function Check({ label, ledger, sub, diff }: { label: string; ledger: number; sub: number; diff: number }) {
    const ok = Math.abs(diff) < 0.01;
    return (
        <div className={`rounded-xl border p-4 ${ok ? 'border-emerald-300 bg-emerald-50' : 'border-amber-400 bg-amber-50'}`}>
            <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
                {ok ? <CheckCircle2 className="h-4 w-4 text-emerald-700" /> : <AlertTriangle className="h-4 w-4 text-amber-700" />}
                {label}
            </div>
            <dl className="mt-2 grid grid-cols-3 gap-2 text-xs text-slate-900">
                <div><dt className="font-semibold">Ledger</dt><dd className="font-mono">{fmt(ledger)}</dd></div>
                <div><dt className="font-semibold">Sub-ledger</dt><dd className="font-mono">{fmt(sub)}</dd></div>
                <div><dt className="font-semibold">Difference</dt><dd className={`font-mono font-bold ${ok ? '' : 'text-red-700'}`}>{fmt(diff)}</dd></div>
            </dl>
        </div>
    );
}

export default function LiabilitiesPage() {
    const { data, isLoading, error } = useQuery<LiabilitiesSchedule>({
        queryKey: ['finance-liabilities'],
        queryFn: async ({ signal }) => {
            const res = await fetch('/api/finance/liabilities', { cache: 'no-store', signal });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error?.message || 'Failed to load liabilities');
            return json.data;
        },
        refetchOnWindowFocus: false,
    });

    return (
        <RoleGuard>
            <div className="flex h-screen bg-slate-50 overflow-hidden">
                <Sidebar />
                <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                    <Header />
                    <main className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                                <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
                                    <Scale className="w-7 h-7 text-indigo-600" />Liabilities schedule
                                </h1>
                                <p className="text-sm text-slate-700 mt-1">Everything the company owes, grouped for management, with sub-ledger cross-checks.</p>
                            </div>
                            <ExportCsvButton filename="liabilities-schedule.csv" disabled={!data}
                                getRows={() => [['Category', 'Account', 'Name', 'Balance'],
                                    ...(data?.groups ?? []).flatMap((g) => g.accounts.map((a) => [g.label, a.code, a.name, a.balance])),
                                    ['TOTAL', '', '', data?.totalLiabilities ?? 0]]} />
                        </div>

                        {isLoading && <div className="flex h-40 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /></div>}
                        {error && <p className="text-sm text-red-700">{(error as Error).message}</p>}

                        {data && (
                            <>
                                <Card className="shadow-sm"><CardContent className="p-5">
                                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-700">Total liabilities</p>
                                    <p className="mt-1 text-3xl font-bold text-slate-900">LKR {fmt(data.totalLiabilities)}</p>
                                    <p className="text-xs text-slate-700">As of {new Date(data.asOf).toLocaleDateString('en-GB')}</p>
                                </CardContent></Card>

                                {data.groups.length === 0 && <p className="text-sm text-slate-900">No liability balances are recorded.</p>}
                                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                                    {data.groups.map((g) => (
                                        <Card key={g.category} className="shadow-sm"><CardContent className="p-5">
                                            <div className="flex items-baseline justify-between">
                                                <h2 className="font-bold text-slate-900">{g.label}</h2>
                                                <span className="font-mono font-bold text-slate-900">{fmt(g.total)}</span>
                                            </div>
                                            <table className="mt-2 w-full text-sm"><tbody>
                                                {g.accounts.map((a) => (
                                                    <tr key={a.code} className="border-t border-slate-200 text-slate-900">
                                                        <td className="py-1.5 pr-2">
                                                            <a className="font-mono text-xs font-bold text-blue-800 underline mr-2" href={`/finance/reports/gl-viewer?accountCode=${encodeURIComponent(a.code)}`}>{a.code}</a>{a.name}
                                                        </td>
                                                        <td className="py-1.5 text-right font-mono">{fmt(a.balance)}</td>
                                                    </tr>
                                                ))}
                                            </tbody></table>
                                        </CardContent></Card>
                                    ))}
                                </div>

                                <section className="space-y-3">
                                    <h2 className="text-lg font-bold text-slate-900">Sub-ledger cross-checks</h2>
                                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                                        <Check label="Contractor / vendor payables" ledger={data.reconciliation.contractorPayablesLedger}
                                            sub={data.reconciliation.contractorPayablesSubLedger} diff={data.reconciliation.contractorPayablesDifference} />
                                        <Check label="Retention held" ledger={data.reconciliation.retentionLedger}
                                            sub={data.reconciliation.retentionHeldSubLedger} diff={data.reconciliation.retentionDifference} />
                                    </div>
                                </section>
                                <p className="text-xs text-slate-700">{data.note}</p>
                            </>
                        )}
                    </main>
                </div>
            </div>
        </RoleGuard>
    );
}

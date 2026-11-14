"use client";

import { useQuery } from '@tanstack/react-query';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import RoleGuard from '@/components/RoleGuard';
import { Badge } from "@/components/ui/badge";
import { useMemo, useState } from 'react';
import { Landmark, CheckCircle2, AlertTriangle, Download } from "lucide-react";
import { downloadCsv } from '@/lib/csv-export';

interface AccountBalanceSummary {
    code: string;
    name: string;
    type: string;
    netBalance: number;
}

interface BalanceSheetBase {
    assetAccounts: AccountBalanceSummary[];
    liabilityAccounts: AccountBalanceSummary[];
    equityAccounts: AccountBalanceSummary[];
    totalAssets: number;
    totalLiabilities: number;
    retainedEarnings: number;
    totalEquity: number;
    totalLiabilitiesAndEquity: number;
    isBalanced: boolean;
    difference: number;
}
interface BalanceSheetData extends BalanceSheetBase {
    comparison?: BalanceSheetBase;
}

type CompareTo = 'none' | 'lastMonthEnd' | 'lastYearEnd';
const fmt = (v: number) => v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const endOfDay = (s: string) => new Date(`${s}T23:59:59.999Z`);
const compareDate = (mode: CompareTo, asOf: string): Date | undefined => {
    const d = endOfDay(asOf);
    if (mode === 'lastMonthEnd') return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1) - 1);
    if (mode === 'lastYearEnd') return new Date(Date.UTC(d.getUTCFullYear(), 0, 1) - 1);
    return undefined;
};

function Variance({ cur, base, lowerIsBetter = false }: { cur: number; base: number; lowerIsBetter?: boolean }) {
    const diff = cur - base;
    if (Math.abs(diff) < 0.005) return <span className="text-xs text-slate-600">no change</span>;
    const good = (diff > 0) !== lowerIsBetter;
    return <span className={`text-xs font-semibold ${good ? 'text-emerald-700' : 'text-red-700'}`}>{diff > 0 ? '+' : ''}{fmt(diff)}</span>;
}

function Amount({ acc, list, lowerIsBetter }: { acc: AccountBalanceSummary; list?: AccountBalanceSummary[]; lowerIsBetter?: boolean }) {
    return (
        <span className="text-right">
            <span className="font-mono font-semibold text-slate-900 text-sm">LKR {fmt(acc.netBalance)}</span>
            {list && <span className="block"><Variance cur={acc.netBalance} base={list.find((a) => a.code === acc.code)?.netBalance ?? 0} lowerIsBetter={lowerIsBetter} /></span>}
        </span>
    );
}

export default function BalanceSheetPage() {
    const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
    const [asOf, setAsOf] = useState(today);
    const [compareTo, setCompareTo] = useState<CompareTo>('lastMonthEnd');
    const cmpDate = compareDate(compareTo, asOf);

    const { data, isLoading } = useQuery<BalanceSheetData>({
        queryKey: ['balance-sheet-report', asOf, cmpDate?.toISOString() ?? 'none'],
        queryFn: async ({ signal }) => {
            const params = new URLSearchParams({ asOf: endOfDay(asOf).toISOString() });
            if (cmpDate) params.set('compareAsOf', cmpDate.toISOString());
            const res = await fetch(`/api/finance/reports/balance-sheet?${params}`, { cache: 'no-store', signal });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error?.message || 'Failed to fetch Balance Sheet');
            return json.data;
        }
    });

    const cmp = data?.comparison;
    const exportCsv = () => {
        if (!data) return;
        const rows: (string | number)[][] = [['Section', 'Account', 'Name', `Balance at ${asOf}`, ...(cmp && cmpDate ? [`Balance at ${cmpDate.toISOString().slice(0, 10)}`] : [])]];
        const add = (section: string, list: AccountBalanceSummary[], cmpList?: AccountBalanceSummary[]) => {
            for (const a of list) rows.push([section, a.code, a.name, a.netBalance, ...(cmpList ? [cmpList.find((x) => x.code === a.code)?.netBalance ?? 0] : [])]);
        };
        add('Asset', data.assetAccounts, cmp?.assetAccounts);
        add('Liability', data.liabilityAccounts, cmp?.liabilityAccounts);
        add('Equity', data.equityAccounts, cmp?.equityAccounts);
        rows.push(['Equity', 'P&L-EARN', 'Current period retained earnings', data.retainedEarnings, ...(cmp ? [cmp.retainedEarnings] : [])]);
        rows.push(['Total', '', 'Assets', data.totalAssets, ...(cmp ? [cmp.totalAssets] : [])]);
        rows.push(['Total', '', 'Liabilities', data.totalLiabilities, ...(cmp ? [cmp.totalLiabilities] : [])]);
        rows.push(['Total', '', 'Equity', data.totalEquity, ...(cmp ? [cmp.totalEquity] : [])]);
        downloadCsv(`balance-sheet-${asOf}.csv`, rows);
    };

    return (
        <RoleGuard>
            <div className="flex h-screen bg-slate-50 overflow-hidden">
                <Sidebar />
                <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                    <Header />
                    <main className="flex-1 overflow-y-auto p-6 space-y-6">
                        
                        {/* Header */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div>
                                <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
                                    <Landmark className="w-7 h-7 text-indigo-600" />
                                    Balance Sheet Statement
                                </h1>
                                <p className="text-sm text-slate-500 mt-1">
                                    Statement of Financial Position: Assets = Liabilities + Equity.
                                </p>
                            </div>

                            {data?.isBalanced ? (
                                <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 py-1.5 px-4 text-sm font-semibold flex items-center gap-1.5 self-start">
                                    <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Equation Balanced
                                </Badge>
                            ) : (
                                <Badge className="bg-rose-100 text-rose-800 border-rose-300 py-1.5 px-4 text-sm font-semibold flex items-center gap-1.5 self-start">
                                    <AlertTriangle className="w-4 h-4 text-rose-600" /> Imbalance Detected
                                </Badge>
                            )}
                        </div>

                        <div className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-3">
                            <label className="text-xs font-semibold text-slate-900">As of
                                <input type="date" value={asOf} max={today} onChange={(e) => e.target.value && setAsOf(e.target.value)}
                                    className="mt-1 block rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900" />
                            </label>
                            <label className="text-xs font-semibold text-slate-900">Compare to
                                <select value={compareTo} onChange={(e) => setCompareTo(e.target.value as CompareTo)}
                                    className="mt-1 block rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900">
                                    <option value="none">No comparison</option>
                                    <option value="lastMonthEnd">End of previous month</option>
                                    <option value="lastYearEnd">End of previous year</option>
                                </select>
                            </label>
                            <button onClick={exportCsv} disabled={!data}
                                className="ml-auto inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100 disabled:opacity-50">
                                <Download className="w-4 h-4" />Export CSV
                            </button>
                        </div>

                        {/* Equation Summary Cards */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="bg-emerald-50 rounded-xl p-5 border border-emerald-200">
                                <div className="text-xs font-semibold uppercase text-emerald-700">Total Assets</div>
                                <div className="text-2xl font-bold text-emerald-950 mt-1 font-mono">
                                    LKR {(data?.totalAssets || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                </div>
                                {cmp && <Variance cur={data?.totalAssets || 0} base={cmp.totalAssets} />}
                            </div>
                            <div className="bg-amber-50 rounded-xl p-5 border border-amber-200">
                                <div className="text-xs font-semibold uppercase text-amber-700">Total Liabilities</div>
                                <div className="text-2xl font-bold text-amber-950 mt-1 font-mono">
                                    LKR {(data?.totalLiabilities || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                </div>
                                {cmp && <Variance cur={data?.totalLiabilities || 0} base={cmp.totalLiabilities} lowerIsBetter />}
                            </div>
                            <div className="bg-indigo-50 rounded-xl p-5 border border-indigo-200">
                                <div className="text-xs font-semibold uppercase text-indigo-700">Total Liabilities + Equity</div>
                                <div className="text-2xl font-bold text-indigo-950 mt-1 font-mono">
                                    LKR {(data?.totalLiabilitiesAndEquity || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                </div>
                            </div>
                        </div>

                        {/* Balance Sheet Layout */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            
                            {/* Assets Column */}
                            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                                <div className="bg-emerald-100/70 p-4 border-b border-emerald-200 flex justify-between items-center">
                                    <h2 className="font-bold text-emerald-900 uppercase text-xs tracking-wider">Assets</h2>
                                    <span className="font-mono font-bold text-emerald-950 text-sm">
                                        LKR {(data?.totalAssets || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                    </span>
                                </div>
                                <div className="divide-y divide-slate-100">
                                    {isLoading ? (
                                        <div className="p-6 text-center text-slate-500">Loading Asset accounts...</div>
                                    ) : (
                                        data?.assetAccounts.map(acc => (
                                            <div key={acc.code} className="p-3.5 flex justify-between items-center hover:bg-slate-50">
                                                <div>
                                                    <span className="font-mono font-bold text-slate-900 text-xs mr-2">{acc.code}</span>
                                                    <span className="text-sm font-medium text-slate-800">{acc.name}</span>
                                                </div>
                                                <Amount acc={acc} list={cmp?.assetAccounts} />
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>

                            {/* Liabilities & Equity Column */}
                            <div className="space-y-6">
                                {/* Liabilities */}
                                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                                    <div className="bg-amber-100/70 p-4 border-b border-amber-200 flex justify-between items-center">
                                        <h2 className="font-bold text-amber-900 uppercase text-xs tracking-wider">Liabilities</h2>
                                        <span className="font-mono font-bold text-amber-950 text-sm">
                                            LKR {(data?.totalLiabilities || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                        </span>
                                    </div>
                                    <div className="divide-y divide-slate-100">
                                        {isLoading ? (
                                            <div className="p-6 text-center text-slate-500">Loading Liabilities...</div>
                                        ) : (
                                            data?.liabilityAccounts.map(acc => (
                                                <div key={acc.code} className="p-3.5 flex justify-between items-center hover:bg-slate-50">
                                                    <div>
                                                        <span className="font-mono font-bold text-slate-900 text-xs mr-2">{acc.code}</span>
                                                        <span className="text-sm font-medium text-slate-800">{acc.name}</span>
                                                    </div>
                                                    <Amount acc={acc} list={cmp?.liabilityAccounts} lowerIsBetter />
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>

                                {/* Equity */}
                                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                                    <div className="bg-indigo-100/70 p-4 border-b border-indigo-200 flex justify-between items-center">
                                        <h2 className="font-bold text-indigo-900 uppercase text-xs tracking-wider">Equity</h2>
                                        <span className="font-mono font-bold text-indigo-950 text-sm">
                                            LKR {(data?.totalEquity || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                        </span>
                                    </div>
                                    <div className="divide-y divide-slate-100">
                                        <div className="p-3.5 flex justify-between items-center bg-indigo-50/50">
                                            <div>
                                                <span className="font-mono font-bold text-indigo-900 text-xs mr-2">P&L-EARN</span>
                                                <span className="text-sm font-semibold text-indigo-900">Current Period Retained Earnings</span>
                                            </div>
                                            <span className="font-mono font-bold text-indigo-900 text-sm">
                                                LKR {(data?.retainedEarnings || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                            </span>
                                        </div>
                                        {data?.equityAccounts.map(acc => (
                                            <div key={acc.code} className="p-3.5 flex justify-between items-center hover:bg-slate-50">
                                                <div>
                                                    <span className="font-mono font-bold text-slate-900 text-xs mr-2">{acc.code}</span>
                                                    <span className="text-sm font-medium text-slate-800">{acc.name}</span>
                                                </div>
                                                <Amount acc={acc} list={cmp?.equityAccounts} lowerIsBetter />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                        </div>

                    </main>
                </div>
            </div>
        </RoleGuard>
    );
}

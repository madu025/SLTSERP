"use client";

import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import RoleGuard from '@/components/RoleGuard';
import { Card, CardContent } from '@/components/ui/card';
import { Download, Loader2, Target } from 'lucide-react';
import type { BudgetVsActualReport } from '@/services/finance/ledger-budget.service';
import { downloadCsv } from '@/lib/csv-export';

interface Account { code: string; name: string; type: string; isPostable?: boolean; isActive?: boolean }

const fmt = (v: number) => v.toLocaleString('en-US', { maximumFractionDigits: 0 });
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default function BudgetVsActualPage() {
    const queryClient = useQueryClient();
    const thisYear = new Date().getUTCFullYear();
    const [year, setYear] = useState(thisYear);
    const [expanded, setExpanded] = useState<string | null>(null);
    const [accountCode, setAccountCode] = useState('');
    const [annual, setAnnual] = useState('');
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<string | null>(null);

    const { data, isLoading, error } = useQuery<BudgetVsActualReport>({
        queryKey: ['finance-budget-vs-actual', year],
        queryFn: async ({ signal }) => {
            const res = await fetch(`/api/finance/budget-vs-actual?year=${year}`, { cache: 'no-store', signal });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error?.message || 'Failed to load budget vs actual');
            return json.data;
        },
        refetchOnWindowFocus: false,
    });

    const { data: accounts } = useQuery<Account[]>({
        queryKey: ['finance-coa-for-budget'],
        queryFn: async ({ signal }) => {
            const res = await fetch('/api/finance/chart-of-accounts', { signal });
            const json = await res.json();
            return (json.data?.accounts ?? []) as Account[];
        },
        staleTime: 10 * 60_000,
    });
    const budgetable = useMemo(
        () => (accounts ?? []).filter((a) => (a.type === 'REVENUE' || a.type === 'EXPENSE') && a.isPostable !== false && a.isActive !== false),
        [accounts],
    );

    const save = async () => {
        setSaving(true); setMessage(null);
        try {
            const res = await fetch('/api/finance/budget-vs-actual', {
                method: 'PUT', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ fiscalYear: year, accountCode, annual: Number(annual) }),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error?.message || 'Could not save the budget');
            setMessage(`Budget saved for ${accountCode}: ${fmt(Number(annual))} for ${year}, spread evenly over 12 months.`);
            setAnnual('');
            await queryClient.invalidateQueries({ queryKey: ['finance-budget-vs-actual'] });
        } catch (e) {
            setMessage((e as Error).message);
        } finally {
            setSaving(false);
        }
    };

    const exportCsv = () => {
        if (!data) return;
        const rows: (string | number)[][] = [['Account', 'Name', 'Type', 'Annual budget', 'YTD budget', 'YTD actual', 'Variance (+ favourable)', 'Variance %'],
            ...data.rows.map((r) => [r.accountCode, r.accountName, r.kind, r.annualBudget, r.ytdBudget, r.ytdActual, r.variance, r.variancePct ?? ''])];
        downloadCsv(`budget-vs-actual-${year}.csv`, rows);
    };

    const tone = (v: number) => (v < 0 ? 'text-red-700' : v > 0 ? 'text-emerald-700' : 'text-slate-900');

    return (
        <RoleGuard>
            <div className="flex h-screen bg-slate-50 overflow-hidden">
                <Sidebar />
                <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                    <Header />
                    <main className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
                        <div>
                            <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
                                <Target className="w-7 h-7 text-indigo-600" />Budget vs actual (GL accounts)
                            </h1>
                            <p className="text-sm text-slate-700 mt-1">Monthly budget per revenue and expense account against posted ledger actuals. Positive variance is always favourable.</p>
                        </div>

                        <div className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-3">
                            <label className="text-xs font-semibold text-slate-900">Fiscal year
                                <select value={year} onChange={(e) => setYear(Number(e.target.value))}
                                    className="mt-1 block rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900">
                                    {[thisYear - 1, thisYear, thisYear + 1].map((y) => <option key={y} value={y}>{y}</option>)}
                                </select>
                            </label>
                            <label className="text-xs font-semibold text-slate-900">Set budget for account
                                <select value={accountCode} onChange={(e) => setAccountCode(e.target.value)}
                                    className="mt-1 block max-w-[18rem] rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900">
                                    <option value="">Select account…</option>
                                    {budgetable.map((a) => <option key={a.code} value={a.code}>{a.code} · {a.name}</option>)}
                                </select>
                            </label>
                            <label className="text-xs font-semibold text-slate-900">Annual amount (LKR)
                                <input type="number" min={0} value={annual} onChange={(e) => setAnnual(e.target.value)}
                                    className="mt-1 block w-40 rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900" />
                            </label>
                            <button onClick={save} disabled={saving || !accountCode || annual === '' || Number(annual) < 0}
                                className="rounded-md bg-indigo-700 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-800 disabled:opacity-50">
                                {saving ? 'Saving…' : 'Save budget'}
                            </button>
                            <button onClick={exportCsv} disabled={!data}
                                className="ml-auto inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100 disabled:opacity-50">
                                <Download className="w-4 h-4" />Export CSV
                            </button>
                        </div>
                        {message && <p className="text-sm text-slate-900">{message}</p>}
                        {isLoading && <div className="flex h-40 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /></div>}
                        {error && <p className="text-sm text-red-700">{(error as Error).message}</p>}

                        {data && (
                            <>
                                <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
                                    {[
                                        ['Revenue (YTD actual vs budget)', data.totals.revenueActual, data.totals.revenueBudget, false],
                                        ['Expenses (YTD actual vs budget)', data.totals.expenseActual, data.totals.expenseBudget, true],
                                        ['Net (YTD actual vs budget)', data.totals.netActual, data.totals.netBudget, false],
                                    ].map(([label, actual, budget, lowerBetter]) => {
                                        const a = actual as number, b = budget as number;
                                        const v = lowerBetter ? b - a : a - b;
                                        return (
                                            <Card key={label as string} className="shadow-sm"><CardContent className="p-4">
                                                <p className="text-xs font-semibold uppercase tracking-wide text-slate-700">{label as string}</p>
                                                <p className="mt-1 text-xl font-bold text-slate-900">{fmt(a)} <span className="text-sm font-normal text-slate-700">of {fmt(b)}</span></p>
                                                <p className={`text-xs font-semibold ${tone(v)}`}>{v > 0 ? '+' : ''}{fmt(v)} {v >= 0 ? 'favourable' : 'unfavourable'}</p>
                                            </CardContent></Card>
                                        );
                                    })}
                                </div>

                                {!data.hasBudget && <p className="text-sm text-slate-900">No budget is set for {year} yet. Choose an account above and enter its annual amount to start tracking.</p>}

                                <Card className="shadow-sm"><CardContent className="p-5 overflow-x-auto">
                                    {data.rows.length === 0 ? <p className="text-sm text-slate-700">No budgets or postings for {year}.</p> : (
                                        <table className="w-full text-sm">
                                            <thead><tr className="border-b border-slate-300 text-left text-slate-900">
                                                <th className="py-2 pr-3">Account</th><th className="py-2 pr-3 text-right">Annual budget</th>
                                                <th className="py-2 pr-3 text-right">YTD budget</th><th className="py-2 pr-3 text-right">YTD actual</th>
                                                <th className="py-2 pr-3 text-right">Variance</th><th className="py-2 text-right">%</th>
                                            </tr></thead>
                                            <tbody>
                                                {data.rows.map((r) => (
                                                    <>
                                                        <tr key={r.accountCode} onClick={() => setExpanded(expanded === r.accountCode ? null : r.accountCode)}
                                                            className="cursor-pointer border-b border-slate-200 text-slate-900 hover:bg-slate-50">
                                                            <td className="py-2 pr-3"><span className="font-mono text-xs font-bold mr-2">{r.accountCode}</span>{r.accountName}
                                                                <span className="ml-2 text-[10px] font-bold uppercase text-slate-600">{r.kind}</span></td>
                                                            <td className="py-2 pr-3 text-right">{fmt(r.annualBudget)}</td>
                                                            <td className="py-2 pr-3 text-right">{fmt(r.ytdBudget)}</td>
                                                            <td className="py-2 pr-3 text-right">{fmt(r.ytdActual)}</td>
                                                            <td className={`py-2 pr-3 text-right font-semibold ${tone(r.variance)}`}>{r.variance > 0 ? '+' : ''}{fmt(r.variance)}</td>
                                                            <td className={`py-2 text-right ${tone(r.variance)}`}>{r.variancePct === null ? '—' : `${r.variancePct}%`}</td>
                                                        </tr>
                                                        {expanded === r.accountCode && (
                                                            <tr key={`${r.accountCode}-m`} className="bg-slate-50">
                                                                <td colSpan={6} className="p-3">
                                                                    <div className="grid grid-cols-6 gap-2 text-xs text-slate-900 md:grid-cols-12">
                                                                        {MONTHS.map((m, i) => (
                                                                            <div key={m} className="rounded border border-slate-200 bg-white p-1.5">
                                                                                <div className="font-bold">{m}</div>
                                                                                <div>B {fmt(r.monthlyBudget[i])}</div>
                                                                                <div>A {fmt(r.monthlyActual[i])}</div>
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        )}
                                                    </>
                                                ))}
                                            </tbody>
                                        </table>
                                    )}
                                </CardContent></Card>
                                <p className="text-xs text-slate-700">YTD runs through month {data.throughMonth} of {year}. Click an account to see its months (B = budget, A = actual).</p>
                            </>
                        )}
                    </main>
                </div>
            </div>
        </RoleGuard>
    );
}

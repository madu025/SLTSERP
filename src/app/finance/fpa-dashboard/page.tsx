'use client';

import { useState, useEffect, useMemo } from 'react';
import RoleGuard from '@/components/RoleGuard';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Loader2, ArrowUpRight, ArrowDownRight, Minus, Download } from 'lucide-react';
import { ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, Legend, CartesianGrid } from 'recharts';

interface Metrics {
  totalRevenue: number; totalCOGS: number; grossMargin: number; grossMarginPct: number;
  totalOpex: number; netProfit: number; netProfitPct: number;
}
interface FPAMetrics extends Metrics {
  period: string;
  previous: Metrics & { period: string };
  priorYear: Metrics & { period: string };
  monthly: { month: string; revenue: number; directCost: number; opex: number; netProfit: number }[];
  topExpenses: { code: string; name: string; amount: number; sharePct: number }[];
}

const formatCurrency = (val: number) => new Intl.NumberFormat('en-LK', { style: 'currency', currency: 'LKR', maximumFractionDigits: 0 }).format(val);
const compact = (val: number) => new Intl.NumberFormat('en-LK', { notation: 'compact', maximumFractionDigits: 1 }).format(val);

function change(cur: number, base: number): number | null {
  return base === 0 ? null : ((cur - base) / Math.abs(base)) * 100;
}

function Delta({ cur, base, label, lowerIsBetter = false }: { cur: number; base: number; label: string; lowerIsBetter?: boolean }) {
  const c = change(cur, base);
  if (c === null) return <p className="text-xs text-slate-600">{label}: no prior base</p>;
  const flat = Math.abs(c) < 0.05;
  const good = flat ? null : (c > 0) !== lowerIsBetter;
  const tone = good === null ? 'text-slate-600' : good ? 'text-emerald-700' : 'text-red-700';
  const Icon = flat ? Minus : c > 0 ? ArrowUpRight : ArrowDownRight;
  return (
    <p className={`text-xs font-semibold flex items-center gap-1 ${tone}`}>
      <Icon className="w-3 h-3" />{Math.abs(c).toFixed(1)}% <span className="font-normal text-slate-600">{label}</span>
    </p>
  );
}

function Kpi({ title, value, cur, prev, py, prevLabel, pyLabel, accent, lowerIsBetter, sub }: {
  title: string; value: number; cur: number; prev: number; py: number; prevLabel: string; pyLabel: string;
  accent: string; lowerIsBetter?: boolean; sub?: string;
}) {
  return (
    <Card className={`border-l-4 ${accent} shadow-sm`}>
      <CardContent className="p-5 space-y-1">
        <p className="text-sm font-medium text-slate-700">{title}</p>
        <h3 className="text-2xl font-bold text-slate-900">{formatCurrency(value)}</h3>
        {sub && <p className="text-xs text-slate-700">{sub}</p>}
        <Delta cur={cur} base={prev} label={`vs ${prevLabel}`} lowerIsBetter={lowerIsBetter} />
        <Delta cur={cur} base={py} label={`vs ${pyLabel} (YoY)`} lowerIsBetter={lowerIsBetter} />
      </CardContent>
    </Card>
  );
}

export default function FPADashboardPage() {
  const [metrics, setMetrics] = useState<FPAMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [year, setYear] = useState<string>(new Date().getFullYear().toString());
  const [quarter, setQuarter] = useState<string>('all');

  useEffect(() => {
    const controller = new AbortController();
    const fetchMetrics = async () => {
      setLoading(true);
      setFailed(false);
      try {
        let url = `/api/finance/fpa-dashboard?year=${year}`;
        if (quarter !== 'all') url += `&quarter=${quarter}`;
        const res = await fetch(url, { cache: 'no-store', signal: controller.signal });
        if (!res.ok) throw new Error(String(res.status));
        const data = await res.json();
        setMetrics(data.data ?? null);
      } catch (error) {
        if ((error as Error).name !== 'AbortError') { console.error('Error fetching FP&A metrics:', error); setFailed(true); }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };
    fetchMetrics();
    return () => controller.abort();
  }, [year, quarter]);

  const exportCsv = useMemo(() => () => {
    if (!metrics) return;
    const rows = [
      ['Month', 'Revenue', 'Direct cost', 'Operating expense', 'Net profit'],
      ...metrics.monthly.map((m) => [m.month, m.revenue, m.directCost, m.opex, m.netProfit]),
    ];
    const csv = rows.map((r) => r.join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const a = document.createElement('a');
    a.href = url; a.download = `fpa-monthly-${year}.csv`; a.click();
    URL.revokeObjectURL(url);
  }, [metrics, year]);

  return (
    <RoleGuard>
      <div className="flex h-screen bg-slate-50 overflow-hidden">
        <Sidebar />
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <Header />
          <main className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
            <div className="flex flex-wrap justify-between items-center gap-4">
              <div>
                <h1 className="text-3xl font-bold text-slate-900 tracking-tight">FP&A Profitability</h1>
                <p className="text-slate-700 mt-1">Posted ledger results with period-on-period and year-on-year comparison.</p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Select value={year} onValueChange={setYear}>
                  <SelectTrigger className="w-[110px]"><SelectValue placeholder="Year" /></SelectTrigger>
                  <SelectContent>
                    {[2024, 2025, 2026, 2027].map(y => (<SelectItem key={y} value={y.toString()}>{y}</SelectItem>))}
                  </SelectContent>
                </Select>
                <Select value={quarter} onValueChange={setQuarter}>
                  <SelectTrigger className="w-[140px]"><SelectValue placeholder="Quarter" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Full Year</SelectItem>
                    <SelectItem value="1">Q1 (Jan-Mar)</SelectItem>
                    <SelectItem value="2">Q2 (Apr-Jun)</SelectItem>
                    <SelectItem value="3">Q3 (Jul-Sep)</SelectItem>
                    <SelectItem value="4">Q4 (Oct-Dec)</SelectItem>
                  </SelectContent>
                </Select>
                <button onClick={exportCsv} disabled={!metrics}
                  className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-900 hover:bg-slate-100 disabled:opacity-50">
                  <Download className="w-4 h-4" />Export CSV
                </button>
              </div>
            </div>

            {loading ? (
              <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /></div>
            ) : metrics ? (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                  <Kpi title="Total revenue" value={metrics.totalRevenue} cur={metrics.totalRevenue} prev={metrics.previous.totalRevenue} py={metrics.priorYear.totalRevenue}
                    prevLabel={metrics.previous.period} pyLabel={metrics.priorYear.period} accent="border-l-blue-500" />
                  <Kpi title="Gross margin" value={metrics.grossMargin} cur={metrics.grossMargin} prev={metrics.previous.grossMargin} py={metrics.priorYear.grossMargin}
                    prevLabel={metrics.previous.period} pyLabel={metrics.priorYear.period} accent="border-l-emerald-500" sub={`${metrics.grossMarginPct}% of revenue`} />
                  <Kpi title="Operating expenses" value={metrics.totalOpex} cur={metrics.totalOpex} prev={metrics.previous.totalOpex} py={metrics.priorYear.totalOpex}
                    prevLabel={metrics.previous.period} pyLabel={metrics.priorYear.period} accent="border-l-amber-500" lowerIsBetter />
                  <Kpi title="Net profit" value={metrics.netProfit} cur={metrics.netProfit} prev={metrics.previous.netProfit} py={metrics.priorYear.netProfit}
                    prevLabel={metrics.previous.period} pyLabel={metrics.priorYear.period} accent="border-l-purple-500" sub={`${metrics.netProfitPct}% margin`} />
                </div>

                <Card className="shadow-sm">
                  <CardContent className="p-5">
                    <h2 className="text-lg font-bold text-slate-900 mb-1">Monthly trend · {year}</h2>
                    <p className="text-xs text-slate-700 mb-4">Revenue, direct cost and operating expense by month; the line is net profit.</p>
                    <div className="h-72 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={metrics.monthly}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" />
                          <XAxis dataKey="month" tick={{ fill: '#334155', fontSize: 11 }} />
                          <YAxis tickFormatter={compact} tick={{ fill: '#334155', fontSize: 11 }} />
                          <Tooltip formatter={(v) => formatCurrency(Number(v))} />
                          <Legend />
                          <Bar dataKey="revenue" name="Revenue" fill="#3b82f6" />
                          <Bar dataKey="directCost" name="Direct cost" fill="#f59e0b" />
                          <Bar dataKey="opex" name="Operating expense" fill="#94a3b8" />
                          <Line type="monotone" dataKey="netProfit" name="Net profit" stroke="#7c3aed" strokeWidth={2} dot={false} />
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>

                <Card className="shadow-sm">
                  <CardContent className="p-5">
                    <h2 className="text-lg font-bold text-slate-900 mb-3">Largest expense lines · {metrics.period}</h2>
                    {metrics.topExpenses.length === 0 ? (
                      <p className="text-sm text-slate-700">No expenses posted in this period.</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-left text-slate-900 border-b border-slate-300">
                              <th className="py-2 pr-4">Account</th><th className="py-2 pr-4">Name</th>
                              <th className="py-2 pr-4 text-right">Amount</th><th className="py-2 text-right">Share</th>
                            </tr>
                          </thead>
                          <tbody>
                            {metrics.topExpenses.map((e) => (
                              <tr key={e.code} className="border-b border-slate-200 text-slate-900">
                                <td className="py-2 pr-4 font-mono text-xs">
                                  <a className="underline text-blue-800" href={`/finance/reports/gl-viewer?accountCode=${encodeURIComponent(e.code)}`}>{e.code}</a>
                                </td>
                                <td className="py-2 pr-4">{e.name}</td>
                                <td className="py-2 pr-4 text-right">{formatCurrency(e.amount)}</td>
                                <td className="py-2 text-right">{e.sharePct}%</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </>
            ) : (
              <div className="text-center text-slate-700 py-12">{failed ? 'Failed to load FP&A metrics.' : 'No data.'}</div>
            )}
          </main>
        </div>
      </div>
    </RoleGuard>
  );
}

'use client';

import { useQuery } from '@tanstack/react-query';
import RoleGuard from '@/components/RoleGuard';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, Download } from 'lucide-react';
import { ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, Legend, CartesianGrid } from 'recharts';
import type { CashForecast, ReceivablesRisk } from '@/services/finance/cash-forecast.service';
import { downloadCsv } from '@/lib/csv-export';

const money = (v: number) => new Intl.NumberFormat('en-LK', { style: 'currency', currency: 'LKR', maximumFractionDigits: 0 }).format(v);
const compact = (v: number) => new Intl.NumberFormat('en-LK', { notation: 'compact', maximumFractionDigits: 1 }).format(v);

function Stat({ label, value, sub, tone = 'default' }: { label: string; value: string; sub?: string; tone?: 'default' | 'bad' | 'warn' }) {
  const ring = tone === 'bad' ? 'border-l-red-500' : tone === 'warn' ? 'border-l-amber-500' : 'border-l-blue-500';
  return (
    <Card className={`border-l-4 ${ring} shadow-sm`}>
      <CardContent className="p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-700">{label}</p>
        <p className="mt-1 text-xl font-bold text-slate-900">{value}</p>
        {sub && <p className="mt-1 text-xs text-slate-700">{sub}</p>}
      </CardContent>
    </Card>
  );
}

export default function CashForecastPage() {
  const { data, isLoading, error, refetch } = useQuery<{ forecast: CashForecast; risk: ReceivablesRisk }>({
    queryKey: ['finance-cash-forecast'],
    queryFn: async ({ signal }) => {
      const res = await fetch('/api/finance/cash-forecast', { signal, cache: 'no-store' });
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      const body = await res.json();
      return body.data ?? body;
    },
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  const exportCsv = () => {
    if (!data) return;
    const rows = [['Week', 'Start', 'Inflow', 'Outflow', 'Net', 'Closing cash'],
      ...data.forecast.weeks.map((w) => [w.week, w.start, w.inflow, w.outflow, w.net, w.closingCash ?? ''])];
    downloadCsv('cash-forecast-13-weeks.csv', rows);
  };

  const f = data?.forecast;
  const r = data?.risk;

  return (
    <RoleGuard>
      <div className="flex h-screen bg-slate-50 overflow-hidden">
        <Sidebar />
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <Header />
          <main className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Cash forecast &amp; receivables risk</h1>
                <p className="text-slate-700 mt-1">13-week outlook from receivable and payable due dates and payroll, plus DSO, concentration and an indicative credit-loss estimate.</p>
              </div>
              <button onClick={exportCsv} disabled={!data}
                className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100 disabled:opacity-50">
                <Download className="w-4 h-4" />Export CSV
              </button>
            </div>

            {isLoading && <div className="flex h-48 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /></div>}
            {error && <p className="text-sm text-slate-900">Could not load the forecast. <button className="underline font-semibold" onClick={() => refetch()}>Retry</button></p>}

            {f && r && (
              <>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  <Stat label="Opening cash" value={f.openingCash === null ? 'Hidden (scoped access)' : money(f.openingCash)} tone={f.openingCash !== null && f.openingCash < 0 ? 'bad' : 'default'} />
                  <Stat label="Lowest projected cash" value={f.lowestProjectedCash ? money(f.lowestProjectedCash.amount) : '—'}
                    sub={f.lowestProjectedCash ? `in week ${f.lowestProjectedCash.week}` : undefined} tone={f.lowestProjectedCash && f.lowestProjectedCash.amount < 0 ? 'bad' : 'default'} />
                  <Stat label="Overdue receivables" value={money(f.overdueReceivables)} sub="Not assumed collected" tone={f.overdueReceivables > 0 ? 'warn' : 'default'} />
                  <Stat label="Overdue payables" value={money(f.overduePayables)} sub="Shown in week 1" tone={f.overduePayables > 0 ? 'warn' : 'default'} />
                </div>

                <Card className="shadow-sm"><CardContent className="p-5">
                  <h2 className="text-lg font-bold text-slate-900 mb-3">Weekly inflow, outflow and projected cash</h2>
                  <div className="h-72 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={f.weeks}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" />
                        <XAxis dataKey="week" tickFormatter={(w) => `W${w}`} tick={{ fill: '#334155', fontSize: 11 }} />
                        <YAxis tickFormatter={compact} tick={{ fill: '#334155', fontSize: 11 }} />
                        <Tooltip formatter={(v) => money(Number(v))} labelFormatter={(w) => `Week ${w}`} />
                        <Legend />
                        <Bar dataKey="inflow" name="Inflow" fill="#10b981" />
                        <Bar dataKey="outflow" name="Outflow" fill="#ef4444" />
                        {f.openingCash !== null && <Line type="monotone" dataKey="closingCash" name="Projected cash" stroke="#2563eb" strokeWidth={2} dot={false} />}
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="mt-4 overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead><tr className="border-b border-slate-300 text-left text-slate-900">
                        <th className="py-2 pr-3">Week</th><th className="py-2 pr-3">Starts</th><th className="py-2 pr-3 text-right">Inflow</th>
                        <th className="py-2 pr-3 text-right">Outflow</th><th className="py-2 pr-3 text-right">Net</th><th className="py-2 text-right">Projected cash</th>
                      </tr></thead>
                      <tbody>
                        {f.weeks.map((w) => (
                          <tr key={w.week} className="border-b border-slate-200 text-slate-900">
                            <td className="py-2 pr-3">W{w.week}</td><td className="py-2 pr-3">{w.start}</td>
                            <td className="py-2 pr-3 text-right">{money(w.inflow)}</td><td className="py-2 pr-3 text-right">{money(w.outflow)}</td>
                            <td className={`py-2 pr-3 text-right ${w.net < 0 ? 'text-red-700' : ''}`}>{money(w.net)}</td>
                            <td className={`py-2 text-right ${w.closingCash !== null && w.closingCash < 0 ? 'text-red-700 font-semibold' : ''}`}>{w.closingCash === null ? '—' : money(w.closingCash)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent></Card>

                <section className="space-y-3">
                  <h2 className="text-lg font-bold text-slate-900">Receivables risk</h2>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    <Stat label="Total receivables" value={money(r.totalReceivables)} sub={`${r.invoiceCount} open invoices`} />
                    <Stat label="Overdue" value={money(r.overdueTotal)} sub={r.overduePct === null ? undefined : `${r.overduePct}% of receivables`} tone={r.overdueTotal > 0 ? 'warn' : 'default'} />
                    <Stat label="DSO (days)" value={r.dso === null ? '—' : String(r.dso)} sub={`Billed last 90 days: ${money(r.billedLast90Days)}`} tone={r.dso !== null && r.dso > 60 ? 'warn' : 'default'} />
                    <Stat label="Indicative credit loss" value={money(r.expectedCreditLoss)}
                      sub={`Rates by age: ${(r.eclRates.current * 100).toFixed(1)}% / ${(r.eclRates.days31to60 * 100)}% / ${(r.eclRates.days61to90 * 100)}% / ${(r.eclRates.over90 * 100)}%`} />
                  </div>
                  <Card className="shadow-sm"><CardContent className="p-5">
                    <h3 className="font-bold text-slate-900 mb-2">Largest exposures {r.top5SharePct !== null && <span className="font-normal text-slate-700">(top 5 = {r.top5SharePct}% of receivables)</span>}</h3>
                    {r.topExposures.length === 0 ? <p className="text-sm text-slate-700">No open receivables.</p> : (
                      <table className="w-full text-sm"><tbody>
                        {r.topExposures.map((e) => (
                          <tr key={e.projectId} className="border-b border-slate-200 text-slate-900">
                            <td className="py-2 pr-3">{e.name}</td><td className="py-2 pr-3 text-right">{money(e.balance)}</td><td className="py-2 text-right">{e.sharePct}%</td>
                          </tr>
                        ))}
                      </tbody></table>
                    )}
                  </CardContent></Card>
                </section>

                <Card className="shadow-sm"><CardContent className="p-5">
                  <h3 className="font-bold text-slate-900 mb-2">How this forecast is built</h3>
                  <ul className="list-disc pl-5 space-y-1 text-sm text-slate-800">
                    {f.assumptions.map((a) => <li key={a}>{a}</li>)}
                  </ul>
                </CardContent></Card>
              </>
            )}
          </main>
        </div>
      </div>
    </RoleGuard>
  );
}

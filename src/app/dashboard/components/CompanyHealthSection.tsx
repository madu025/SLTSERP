'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, ArrowDownRight, ArrowUpRight, CheckCircle2, Clock3, Info, Minus } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import type { CompanyHealth, Comparison, HealthException } from '@/services/core/company-health.service';
import { AgeingBars, BudgetBar, CompletedTrend, FinanceTrend, Panel, ProjectHealthDonut, Sparkline, compact } from './health/HealthCharts';
import { AtRiskProjectsTable, WeakestRtomsTable } from './health/RiskTables';

interface Props {
    userId: string;
    enabled?: boolean;
}

const pct = (v: number | null) => (v === null ? '—' : `${v.toFixed(1)}%`);

function Delta({ c, lowerIsBetter = false }: { c: Comparison; lowerIsBetter?: boolean }) {
    if (c.changePct === null) return <span className="text-xs text-slate-600 dark:text-slate-400" title="No figure for the same days last month">—</span>;
    const up = c.changePct > 0;
    const flat = Math.abs(c.changePct) < 0.05;
    const good = flat ? null : up !== lowerIsBetter;
    const tone = good === null ? 'text-slate-600 dark:text-slate-400' : good ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400';
    const Icon = flat ? Minus : up ? ArrowUpRight : ArrowDownRight;
    return (
        <span className={`inline-flex items-center gap-0.5 text-xs font-black ${tone}`} title="Compared with the same days of last month">
            <Icon className="h-3.5 w-3.5" />{Math.abs(c.changePct).toFixed(1)}%
        </span>
    );
}

type Tone = 'default' | 'bad' | 'warn' | 'good';
const RING: Record<Tone, string> = { default: 'border-slate-200 dark:border-slate-800', bad: 'border-rose-500/50', warn: 'border-amber-500/50', good: 'border-emerald-500/50' };

function Kpi({ label, value, delta, href, tone = 'default', spark, sparkColor }: {
    label: string; value: string; delta?: React.ReactNode; href?: string; tone?: Tone; spark?: number[]; sparkColor?: string;
}) {
    const body = (
        <div className={`h-full rounded-2xl border ${RING[tone]} bg-white p-4 shadow-sm transition hover:shadow-md dark:bg-slate-950`}>
            <div className="flex items-start justify-between gap-2">
                <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-700 dark:text-slate-300">{label}</p>
                {delta}
            </div>
            <p className="mt-1 text-2xl font-black text-slate-900 dark:text-white">{value}</p>
            {spark && <div className="mt-1"><Sparkline data={spark} color={sparkColor} /></div>}
        </div>
    );
    return href ? <Link href={href} className="block h-full">{body}</Link> : body;
}

function Mini({ label, value, tone = 'default', href }: { label: string; value: string; tone?: Tone; href: string }) {
    const text = tone === 'bad' ? 'text-rose-700 dark:text-rose-400' : tone === 'warn' ? 'text-amber-700 dark:text-amber-400' : tone === 'good' ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-900 dark:text-white';
    return (
        <Link href={href} className={`flex items-center justify-between gap-3 rounded-xl border ${RING[tone]} bg-white px-3 py-2 transition hover:shadow-md dark:bg-slate-950`}>
            <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300">{label}</span>
            <span className={`text-base font-black ${text}`}>{value}</span>
        </Link>
    );
}

const SEVERITY_STYLE: Record<HealthException['severity'], { box: string; icon: React.ReactNode }> = {
    critical: { box: 'border-rose-500/40 bg-rose-500/5', icon: <AlertTriangle className="h-4 w-4 text-rose-600 dark:text-rose-400" /> },
    warning: { box: 'border-amber-500/40 bg-amber-500/5', icon: <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" /> },
    info: { box: 'border-slate-300 bg-slate-500/5 dark:border-slate-700', icon: <Info className="h-4 w-4 text-slate-600 dark:text-slate-400" /> },
};

export default function CompanyHealthSection({ userId, enabled = true }: Props) {
    const [showAll, setShowAll] = useState(false);
    const { data, isLoading, error, refetch } = useQuery<CompanyHealth>({
        queryKey: ['dashboard-company-health', userId],
        queryFn: async ({ signal }) => {
            const res = await fetch('/api/dashboard/company-health', { signal });
            if (res.status === 403) throw new Error('SCOPED');
            if (!res.ok) throw new Error(`Company health request failed (${res.status})`);
            return res.json();
        },
        enabled,
        staleTime: 2 * 60 * 1000,
        refetchOnWindowFocus: false,
        retry: (count, err) => (err as Error).message !== 'SCOPED' && count < 1,
    });

    if (isLoading) {
        return (
            <div className="space-y-4">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    {Array(4).fill(0).map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}
                </div>
                <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                    {Array(4).fill(0).map((_, i) => <Skeleton key={i} className="h-72 rounded-2xl" />)}
                </div>
            </div>
        );
    }
    if ((error as Error | null)?.message === 'SCOPED') {
        return (
            <div className="rounded-2xl border border-slate-300 bg-white p-4 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white">
                Company health is available to users with company-wide access.
            </div>
        );
    }
    if (error || !data) {
        return (
            <div className="rounded-2xl border border-rose-500/40 bg-rose-500/5 p-4 text-sm text-slate-900 dark:text-white">
                Company health could not be loaded. <button className="font-bold underline" onClick={() => refetch()}>Retry</button>
            </div>
        );
    }

    const { finance: f, operations: o, projects: p, fleet, helpdesk: h, inventory: inv, supplyChain: sc, controls: ctl, exceptions } = data;
    const asOf = new Date(data.asOf).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
    const shown = showAll ? exceptions : exceptions.slice(0, 6);
    const arData = f ? [
        { name: '0-30', value: f.arBuckets.current }, { name: '31-60', value: f.arBuckets.days31to60 },
        { name: '61-90', value: f.arBuckets.days61to90 }, { name: '90+', value: f.arBuckets.over90 },
    ] : [];

    return (
        <div className="space-y-5">
            {/* Needs attention */}
            <section className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-slate-100">Needs attention <span className="ml-1 rounded-full bg-rose-600 px-2 py-0.5 text-[10px] text-white">{exceptions.length}</span></h3>
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-700 dark:text-slate-300" title={`${data.periods.currentLabel} to date vs the same days of ${data.periods.previousLabel}`}>
                        <Clock3 className="h-3.5 w-3.5" />{asOf}
                    </span>
                </div>
                {exceptions.length === 0 ? (
                    <div className="flex items-center gap-2 rounded-2xl border border-emerald-500/40 bg-emerald-500/5 p-3 text-sm font-semibold text-slate-900 dark:text-white">
                        <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />All clear
                    </div>
                ) : (
                    <>
                        <ul className="grid grid-cols-1 gap-2 lg:grid-cols-2 xl:grid-cols-3">
                            {shown.map((e) => {
                                const s = SEVERITY_STYLE[e.severity];
                                return (
                                    <li key={e.id}>
                                        <Link href={e.href} className={`flex h-full items-start gap-2.5 rounded-xl border p-2.5 transition hover:shadow-md ${s.box}`}>
                                            <span className="mt-0.5 shrink-0">{s.icon}</span>
                                            <span className="min-w-0">
                                                <span className="block text-xs font-black text-slate-900 dark:text-white">{e.title}</span>
                                                <span className="block truncate text-[11px] text-slate-700 dark:text-slate-300" title={e.detail}>{e.detail}</span>
                                            </span>
                                        </Link>
                                    </li>
                                );
                            })}
                        </ul>
                        {exceptions.length > 6 && (
                            <button type="button" onClick={() => setShowAll((v) => !v)} className="text-xs font-bold text-indigo-700 hover:underline dark:text-indigo-300">
                                {showAll ? 'Show fewer' : `Show all ${exceptions.length}`}
                            </button>
                        )}
                    </>
                )}
            </section>

            {/* Headline numbers */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {f && <Kpi label={`Revenue · ${data.periods.currentLabel}`} value={compact(f.revenue.current)} delta={<Delta c={f.revenue} />} href="/finance/reports/pnl" spark={f.monthly.map((m) => m.revenue)} sparkColor="#10b981" />}
                {f && <Kpi label="Net profit" value={compact(f.netProfit.current)} delta={<Delta c={f.netProfit} />} tone={f.netProfit.current < 0 ? 'bad' : 'good'} href="/finance/reports/pnl" spark={f.monthly.map((m) => m.profit)} sparkColor="#6366f1" />}
                {o && <Kpi label={`Orders completed · ${data.periods.currentLabel}`} value={o.completed.current.toLocaleString()} delta={<Delta c={o.completed} />} href="/service-orders/performance" spark={o.completedMonthly.map((m) => m.completed)} sparkColor="#06b6d4" />}
                {f && <Kpi label="Cash" value={compact(f.cashBalance)} tone={f.cashBalance < 0 ? 'bad' : 'default'} href="/finance/bank" />}
            </div>

            {/* Trends */}
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                {f && <Panel title="Revenue, expense and profit · 6 months" href="/finance/reports/pnl"><FinanceTrend data={f.monthly} /></Panel>}
                {o && <Panel title="Service orders completed · 6 months" href="/service-orders/performance"><CompletedTrend data={o.completedMonthly} /></Panel>}
            </div>

            {/* Ageing */}
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                {f && <Panel title={`Receivables by age (days) · ${compact(f.receivables.total)} total`} href="/finance/ar/aging"><AgeingBars data={arData} format={compact} empty="No receivables outstanding" /></Panel>}
                {o && <Panel title={`Open service orders by age (days) · ${o.openOrders.toLocaleString()} open`} href="/service-orders/performance">
                    <AgeingBars data={o.ageing.map((a) => ({ name: a.bucket, value: a.count }))} format={(v) => v.toLocaleString()} empty="No open orders" />
                </Panel>}
            </div>

            {/* Projects */}
            {p && (
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                    <Panel title="Project health" href="/projects"><ProjectHealthDonut health={p.health} /></Panel>
                    <Panel title="Budget used" href="/projects/dashboards/financials"><BudgetBar used={p.totalActualCost} total={p.totalBudget} /></Panel>
                    <Panel title="Projects at risk" href="/projects"><AtRiskProjectsTable rows={p.atRisk} /></Panel>
                </div>
            )}

            {/* Supply chain */}
            {sc && (sc.lateBuckets || sc.dead || sc.topVendors) && (
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                    {sc.lateBuckets && <Panel title="Late purchase orders (days late)" href="/procurement/performance"><AgeingBars data={sc.lateBuckets.map((b) => ({ name: b.bucket, value: b.count }))} empty="No late purchase orders" /></Panel>}
                    {sc.dead && <Panel title="Dead stock (days idle)" href="/inventory/health"><AgeingBars data={sc.dead.map((d) => ({ name: d.bucket, value: d.value ?? d.skus }))} format={compact} empty="No dead stock" /></Panel>}
                    {sc.topVendors && <Panel title="Top vendors by spend" href="/procurement/vendors"><AgeingBars data={sc.topVendors.map((v) => ({ name: v.name.slice(0, 10), value: v.spend }))} format={compact} empty="No vendor spend" color="#6366f1" /></Panel>}
                </div>
            )}

            {/* Control environment */}
            {ctl && (ctl.breachByKind.length > 0 || ctl.approvals.length > 0) && (
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                    <Panel title="Separation-of-duties breaches (30 days)" href="/admin/control"><AgeingBars data={ctl.breachByKind.map((b) => ({ name: b.label.slice(0, 12), value: b.count }))} empty="No breaches" color="#ef4444" /></Panel>
                    <Panel title="Oldest pending approval by type (days)" href="/admin/control"><AgeingBars data={ctl.approvals.map((a) => ({ name: a.type.slice(0, 12), value: a.oldestDays ?? 0 }))} empty="Nothing waiting" /></Panel>
                </div>
            )}

            {/* Worst RTOMs */}
            {o && o.weakestRtoms.length > 0 && (
                <Panel title="Weakest RTOMs · last 30 days" href="/service-orders/performance"><WeakestRtomsTable rows={o.weakestRtoms} /></Panel>
            )}

            {/* Everything else, one slim row */}
            <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
                {f && <Mini label="Receivables" value={compact(f.receivables.total)} tone={f.receivables.over90 > 0 ? 'bad' : 'default'} href="/finance/ar/aging" />}
                {f && <Mini label="Payables" value={compact(f.payablesTotal)} href="/finance/ap" />}
                {f && <Mini label="YTD profit" value={compact(f.ytdNetProfit)} tone={f.ytdNetProfit < 0 ? 'bad' : 'good'} href="/finance/reports/pnl" />}
                {f && <Mini label="Margin" value={pct(f.marginPct)} href="/finance/reports/profitability" />}
                {fleet && <Mini label="Insurance expired" value={String(fleet.insuranceExpired)} tone={fleet.insuranceExpired > 0 ? 'bad' : 'good'} href="/fleet" />}
                {h && <Mini label="Helpdesk open" value={`${h.openTickets} (${h.slaBreached} late)`} tone={h.slaBreached > 0 ? 'warn' : 'default'} href="/helpdesk" />}
                {sc && sc.stockValue !== null && <Mini label="Stock value" value={compact(sc.stockValue)} href="/inventory/health" />}
                {sc && sc.committed !== null && <Mini label="Committed (open POs)" value={compact(sc.committed)} href="/procurement/vendors" />}
                {sc && sc.belowReorder !== null && <Mini label="Below reorder" value={String(sc.belowReorder)} tone={sc.belowReorder > 0 ? 'warn' : 'good'} href="/inventory/health" />}
                {inv && <Mini label="Stock requests pending" value={`${inv.pendingRequests} (${inv.pendingOver3Days} >3 d)`} tone={inv.pendingOver3Days > 0 ? 'warn' : 'default'} href="/inventory/approvals" />}
            </div>
        </div>
    );
}

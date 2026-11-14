'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, ArrowDownRight, ArrowUpRight, CheckCircle2, Info, Minus } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import type { CompanyHealth, Comparison, HealthException } from '@/services/core/company-health.service';

interface Props {
    userId: string;
    enabled?: boolean;
}

const money = (v: number) =>
    new Intl.NumberFormat('en-LK', { notation: 'compact', maximumFractionDigits: 1 }).format(v);
const pct = (v: number | null) => (v === null ? '—' : `${v.toFixed(1)}%`);

function Delta({ c, lowerIsBetter = false }: { c: Comparison; lowerIsBetter?: boolean }) {
    if (c.changePct === null) {
        return <span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><Minus className="h-3 w-3" />no prior base</span>;
    }
    const up = c.changePct > 0;
    const flat = Math.abs(c.changePct) < 0.05;
    const good = flat ? null : up !== lowerIsBetter;
    const tone = good === null ? 'text-muted-foreground' : good ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400';
    const Icon = flat ? Minus : up ? ArrowUpRight : ArrowDownRight;
    return (
        <span className={`inline-flex items-center gap-1 text-xs font-bold ${tone}`}>
            <Icon className="h-3 w-3" />{Math.abs(c.changePct).toFixed(1)}% vs same days last month
        </span>
    );
}

function Kpi({ label, value, sub, href, tone = 'default' }: {
    label: string; value: string; sub?: React.ReactNode; href?: string; tone?: 'default' | 'bad' | 'warn' | 'good';
}) {
    const ring = tone === 'bad' ? 'border-rose-500/40' : tone === 'warn' ? 'border-amber-500/40' : tone === 'good' ? 'border-emerald-500/40' : 'border-slate-200 dark:border-slate-800';
    const body = (
        <div className={`h-full rounded-2xl border ${ring} bg-white p-4 shadow-sm transition hover:shadow-md dark:bg-slate-950`}>
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-600 dark:text-slate-400">{label}</p>
            <p className="mt-1 text-2xl font-black text-slate-900 dark:text-white">{value}</p>
            {sub && <div className="mt-1 text-xs text-slate-600 dark:text-slate-400">{sub}</div>}
        </div>
    );
    return href ? <Link href={href} className="block h-full">{body}</Link> : body;
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <section className="space-y-3">
            <h3 className="text-sm font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">{title}</h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">{children}</div>
        </section>
    );
}

const SEVERITY_STYLE: Record<HealthException['severity'], { box: string; icon: React.ReactNode; label: string }> = {
    critical: { box: 'border-rose-500/40 bg-rose-500/5', icon: <AlertTriangle className="h-4 w-4 text-rose-600 dark:text-rose-400" />, label: 'Critical' },
    warning: { box: 'border-amber-500/40 bg-amber-500/5', icon: <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />, label: 'Warning' },
    info: { box: 'border-slate-300 bg-slate-500/5 dark:border-slate-700', icon: <Info className="h-4 w-4 text-slate-600 dark:text-slate-400" />, label: 'Info' },
};

export default function CompanyHealthSection({ userId, enabled = true }: Props) {
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
                <Skeleton className="h-28 rounded-2xl" />
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    {Array(8).fill(0).map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}
                </div>
            </div>
        );
    }
    if ((error as Error | null)?.message === 'SCOPED') {
        return (
            <div className="rounded-2xl border border-slate-300 bg-white p-4 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white">
                Company health shows company-wide figures, so it is available only to users with company-wide access. Your other dashboard tabs show your own scope.
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

    const { finance: f, operations: o, projects: p, fleet, helpdesk: h, inventory: inv, exceptions } = data;
    const asOf = new Date(data.asOf).toLocaleString('en-GB');

    return (
        <div className="space-y-6">
            <section className="space-y-2">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h3 className="text-sm font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">
                        Needs attention ({exceptions.length})
                    </h3>
                    <p className="text-xs text-slate-600 dark:text-slate-400">
                        As of {asOf} · {data.periods.currentLabel} to date vs the same days of {data.periods.previousLabel} · company-wide, filters do not apply
                    </p>
                </div>
                {exceptions.length === 0 ? (
                    <div className="flex items-center gap-2 rounded-2xl border border-emerald-500/40 bg-emerald-500/5 p-3 text-sm font-semibold text-slate-900 dark:text-white">
                        <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />No exceptions across the modules you can see.
                    </div>
                ) : (
                    <ul className="grid grid-cols-1 gap-2 lg:grid-cols-2">
                        {exceptions.map((e) => {
                            const s = SEVERITY_STYLE[e.severity];
                            return (
                                <li key={e.id}>
                                    <Link href={e.href} className={`flex items-start gap-3 rounded-2xl border p-3 transition hover:shadow-md ${s.box}`}>
                                        <span className="mt-0.5">{s.icon}</span>
                                        <span className="min-w-0">
                                            <span className="block text-sm font-black text-slate-900 dark:text-white">{e.title}</span>
                                            <span className="block text-xs text-slate-700 dark:text-slate-300">{e.detail}</span>
                                            <span className="mt-1 block text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">{e.area} · {s.label}</span>
                                        </span>
                                    </Link>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </section>

            {f && (
                <Group title="Finance">
                    <Kpi label={`Revenue · ${data.periods.currentLabel}`} value={money(f.revenue.current)} sub={<Delta c={f.revenue} />} href="/finance/reports/pnl" />
                    <Kpi label="Expenses" value={money(f.expense.current)} sub={<Delta c={f.expense} lowerIsBetter />} href="/finance/reports/pnl" />
                    <Kpi label="Net profit" value={money(f.netProfit.current)} tone={f.netProfit.current < 0 ? 'bad' : 'good'}
                        sub={<>Margin {pct(f.marginPct)} · <Delta c={f.netProfit} /></>} href="/finance/reports/pnl" />
                    <Kpi label="Year to date" value={money(f.ytdNetProfit)} sub={`Revenue ${money(f.ytdRevenue)}`} href="/finance/reports/pnl" />
                    <Kpi label="Cash (bank + petty)" value={money(f.cashBalance)} tone={f.cashBalance < 0 ? 'bad' : 'default'} href="/finance/bank" />
                    <Kpi label="Receivables" value={money(f.receivables.total)} href="/finance/ar/aging"
                        tone={f.receivables.over90 > 0 ? 'bad' : (f.receivables.over60Pct ?? 0) > 25 ? 'warn' : 'default'}
                        sub={`${pct(f.receivables.over60Pct)} older than 60 days`} />
                    <Kpi label="Receivables over 90 days" value={money(f.receivables.over90)} tone={f.receivables.over90 > 0 ? 'bad' : 'good'} href="/finance/ar/aging" />
                    <Kpi label="Payables" value={money(f.payablesTotal)} href="/finance/ap" />
                </Group>
            )}

            {o && (
                <Group title="Operations (service orders)">
                    <Kpi label="Open orders" value={String(o.openOrders)} href="/service-orders" />
                    <Kpi label="Open over 10 days" value={String(o.agedOver10Days)} tone={o.agedOver10Days > 0 ? 'warn' : 'good'} href="/service-orders" />
                    <Kpi label="Open over 30 days" value={String(o.agedOver30Days)} tone={o.agedOver30Days > 0 ? 'bad' : 'good'} href="/service-orders" />
                    <Kpi label={`Completed · ${data.periods.currentLabel}`} value={String(o.completed.current)} sub={<Delta c={o.completed} />} href="/service-orders" />
                </Group>
            )}

            {p && (
                <Group title="Projects">
                    <Kpi label="Active projects" value={String(p.active)} href="/projects" />
                    <Kpi label="Over budget" value={String(p.overBudget)} tone={p.overBudget > 0 ? 'bad' : 'good'} href="/projects" />
                    <Kpi label="Past planned end date" value={String(p.overdue)} tone={p.overdue > 0 ? 'warn' : 'good'} href="/projects" />
                    <Kpi label="Budget used" value={pct(p.budgetUsedPct)} sub={`${money(p.totalActualCost)} of ${money(p.totalBudget)}`} href="/projects" />
                </Group>
            )}

            {(fleet || h || inv) && (
                <Group title="Support functions">
                    {fleet && <Kpi label="Insurance expired" value={String(fleet.insuranceExpired)} tone={fleet.insuranceExpired > 0 ? 'bad' : 'good'} href="/fleet" />}
                    {fleet && <Kpi label="Insurance expiring (30 days)" value={String(fleet.insuranceExpiring30d)} tone={fleet.insuranceExpiring30d > 0 ? 'warn' : 'good'} href="/fleet" />}
                    {h && <Kpi label="Open helpdesk tickets" value={String(h.openTickets)} sub={`${h.slaBreached} past SLA`} tone={h.slaBreached > 0 ? 'warn' : 'default'} href="/helpdesk" />}
                    {inv && <Kpi label="Stock requests pending" value={String(inv.pendingRequests)} sub={`${inv.pendingOver3Days} waiting over 3 days`} tone={inv.pendingOver3Days > 0 ? 'warn' : 'default'} href="/inventory/approvals" />}
                </Group>
            )}
        </div>
    );
}

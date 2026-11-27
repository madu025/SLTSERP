/**
 * StatsCardGrid – the two top KPI strips on the dashboard.
 *
 * Renders:
 *  1. Monthly KPI grid (4 × StatCard) – received, invoicable, completed
 *     (with completion-rate sub-label), and returns.
 *  2. Year-to-date strip – brought forward, total received, total completed,
 *     PAT pass, PAT rejected.
 *
 * Every figure uses the shared route-board style (DashFigure, dashboard.css).
 */

import { Inbox, Wallet, CheckCircle2, RotateCcw } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { StatCard } from './StatCard';
import { DashFigure } from './dash-ui';
import type { Stats } from './types';
import { formatSmartNumber } from '@/lib/utils';

export interface StatsCardGridProps {
    isLoading: boolean;
    stats: Stats | undefined;
}

export function StatsCardGrid({ isLoading, stats }: StatsCardGridProps) {
    const total = stats?.monthly?.total || 0;
    const completed = stats?.monthly?.completed || 0;
    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;
    const hasMonthlyData = total > 0 || completed > 0 || (stats?.monthly?.returned || 0) > 0 || (stats?.monthly?.invoicable || 0) > 0;
    const hasYtdData = !!stats?.allTime && ((stats.allTime.total ?? 0) > 0 || (stats.allTime.completed ?? 0) > 0 || (stats.allTime.broughtForward ?? 0) > 0);
    const n = (v: number | undefined | null) => formatSmartNumber(v ?? 0, 0);
    const rs = (v: number | undefined | null) => `Rs. ${formatSmartNumber(v ?? 0, 0)}`;

    if (!isLoading && !hasMonthlyData && !hasYtdData) {
        return (
            <div className="dash-panel">
                <h3>No service orders for this selection yet</h3>
                <p className="dash-note mt-1">Pick another region or RTOM above, or check back after the next sync.</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <section aria-label="This month" aria-busy={isLoading} className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {isLoading ? Array(4).fill(0).map((_, i) => <Skeleton key={i} className="h-28 rounded-[10px]" />) : (
                    <>
                        <StatCard label="Received this month" value={total} icon={<Inbox />} color="blue" href="/service-orders/work-order" />
                        <StatCard label="Ready to invoice this month" value={stats?.monthly?.invoicable || 0} icon={<Wallet />} color="indigo" sub="Orders flagged ready for invoice" href="/service-orders/invoicable" />
                        <StatCard label="Completed this month" value={completed} icon={<CheckCircle2 />} color="emerald" sub={`${completionRate}% of the orders received this month`} subTone={completionRate > 100 ? 'warning' : 'positive'} href="/service-orders/work-order/completed" />
                        <StatCard label="Returned this month" value={stats?.monthly?.returned || 0} icon={<RotateCcw />} color="rose" href="/service-orders/work-order/return" />
                    </>
                )}
            </section>

            {(stats?.financials || stats?.sla) && (
                <section aria-label="Order revenue and waiting orders" className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    {stats?.financials && (
                        <>
                            <DashFigure label="Order revenue, year to date" value={rs(stats.financials.totalRevenue)} tone="pass"
                                hint={`Completed orders by completion date.${(stats.financials.missingAmountCount ?? 0) > 0 ? ` ${n(stats.financials.missingAmountCount)} completed orders have no amount yet and are not included.` : ''}`} />
                            <DashFigure label="Contractor cost, year to date" value={rs(stats.financials.totalContractorCost)} />
                            <DashFigure label="Order margin, year to date" value={rs(stats.financials.netMargin)} tone={stats.financials.netMargin < 0 ? 'fault' : 'pass'}
                                hint={`${stats.financials.marginPercentage}% of the revenue`} />
                        </>
                    )}
                    <DashFigure label="Open orders older than 48 hours" value={n(stats?.sla?.slaBreachedCount)} tone={(stats?.sla?.slaBreachedCount ?? 0) > 0 ? 'wait' : 'neutral'} href="/service-orders/work-order" />
                </section>
            )}

            {stats?.financeSummary && (
                <section aria-label="Billing" className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <DashFigure label="Invoiced" value={rs(stats.financeSummary.invoicedTotal)} href="/finance/invoices"
                        hint={`${stats.financeSummary.pendingInvoices} invoices pending (${rs(stats.financeSummary.pendingInvoiceAmount)}). Cancelled and rejected invoices are not counted.`} />
                    <DashFigure label="Completed, not yet invoiced" value={rs(stats.financeSummary.uninvoicedCompletedAmount)} href="/service-orders/work-order/completed" tone="wait"
                        hint="Same figure as the Finance tab" />
                </section>
            )}

            <section aria-label="Year to date" aria-busy={isLoading}>
                <div className="dash-heading mb-2"><h2 style={{ fontSize: '1.0625rem' }}>Year to date</h2></div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                    {isLoading ? Array(5).fill(0).map((_, i) => <Skeleton key={i} className="h-20 rounded-[10px]" />) : (
                        <>
                            <DashFigure label="Brought forward" value={n(stats?.allTime?.broughtForward)} hint="Open orders received before this year" href="/service-orders/work-order" />
                            <DashFigure label="Received" value={n(stats?.allTime?.total)} />
                            <DashFigure label="Completed" value={n(stats?.allTime?.completed)} href="/service-orders/work-order/completed" />
                            <DashFigure label="PAT passed" value={n(stats?.pat?.passed)} tone="pass" href="/service-orders/work-order/pat" />
                            <DashFigure label="PAT rejected now" value={n(stats?.pat?.rejectedOpen ?? stats?.pat?.rejected)} tone={(stats?.pat?.rejectedOpen ?? 0) > 0 ? 'fault' : 'neutral'} href="/service-orders/work-order/pat" />
                        </>
                    )}
                </div>
                <p className="dash-note mt-2 px-1" style={{ fontSize: '0.8125rem', color: 'var(--dash-ink-2)' }}>
                    {stats?.updatedAt ? `Figures as of ${new Date(stats.updatedAt).toLocaleString('en-GB')}` : 'The time of these figures is not known.'}
                </p>
            </section>
        </div>
    );
}

export default StatsCardGrid;

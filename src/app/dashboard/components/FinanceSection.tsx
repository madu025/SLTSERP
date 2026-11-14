'use client';

import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
    BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from 'recharts';
import {
    DollarSign, AlertCircle, Clock, TrendingUp, TrendingDown, Hourglass, BarChart3, Inbox,
} from 'lucide-react';
import { formatLKR } from '@/lib/utils';
import Link from 'next/link';

interface RevenueTrendPoint {
    month: string;
    year: number;
    revenue: number;
    count: number;
}

interface FinanceStats {
    unbilledRevenue: number;
    unbilledContractorPayout: number;
    pendingPayoutA: number;
    pendingPayoutB: number;
    totalPendingPayouts: number;
    revenueTrend: RevenueTrendPoint[];
    aging: { within30: number; days31To60: number; days61To90: number; over90: number };
    invoiceStatusA: Record<string, number>;
    invoiceStatusB: Record<string, number>;
    totalInvoiced: number;
    invoiceCount: number;
    averageInvoiceAmount: number;
    executiveFinance?: {
        outstandingInvoiceAmount: number;
        outstandingInvoiceCount: number;
        overdueInvoiceAmount: number;
        overdueInvoiceCount: number;
        pendingPaymentVoucherCount: number;
        retentionHeld: number;
        activePenalties: number;
    };
    dataQuality?: {
        invalidFinancialSnapshotCount: number;
        invalidInvoicableSnapshotCount: number;
        wipRule: string;
    };
    updatedAt: string;
}

const hasValue = (val: number | null | undefined) => Number(val || 0) > 0;
const FINANCE_REQUEST_TIMEOUT_MS = 12_000;

function Money({ value, className = '' }: { value: number; className?: string }) {
    return <span className={className}>{formatLKR(value)}</span>;
}

interface FinanceSectionProps {
    rtom?: string;
    enabled?: boolean;
}

export default function FinanceSection({ rtom = 'ALL', enabled = true }: FinanceSectionProps) {
    const { data, isLoading, isFetching, error, refetch } = useQuery<FinanceStats>({
        queryKey: ['dashboard-finance', rtom],
        queryFn: async ({ signal }) => {
            const params = new URLSearchParams({ rtom });
            const controller = new AbortController();
            let timedOut = false;
            const timeoutId = setTimeout(() => {
                timedOut = true;
                controller.abort();
            }, FINANCE_REQUEST_TIMEOUT_MS);
            const abortFromQuery = () => controller.abort();
            signal.addEventListener('abort', abortFromQuery, { once: true });

            try {
                const resp = await fetch(`/api/dashboard/finance?${params}`, { signal: controller.signal });
                if (!resp.ok) {
                    const requestError = new Error(`Finance data request failed (${resp.status}).`) as Error & { status?: number };
                    requestError.status = resp.status;
                    throw requestError;
                }
                return resp.json() as Promise<FinanceStats>;
            } catch (requestError) {
                if (timedOut) throw new Error('Finance data is taking too long to respond. Check your connection and retry.');
                throw requestError;
            } finally {
                clearTimeout(timeoutId);
                signal.removeEventListener('abort', abortFromQuery);
            }
        },
        staleTime: 5 * 60 * 1000, // 5 mins
        gcTime: 30 * 60 * 1000,
        enabled,
        retry: (failureCount, requestError) => {
            const status = (requestError as Error & { status?: number }).status;
            if (status && status >= 400 && status < 500) return false;
            return failureCount < 1;
        },
        retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 4000),
        refetchOnWindowFocus: false,
        refetchOnReconnect: true,
    });

    if (!enabled) return null;

    if (isLoading) {
        return (
            <div className="space-y-6" role="status" aria-live="polite">
                <p className="px-1 text-sm font-semibold text-slate-900 dark:text-slate-100">Loading finance dashboard data…</p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <Skeleton className="h-32 rounded-xl" />
                    <Skeleton className="h-32 rounded-xl" />
                    <Skeleton className="h-32 rounded-xl" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <Skeleton className="h-56 rounded-xl" />
                    <Skeleton className="h-56 rounded-xl" />
                    <Skeleton className="h-56 rounded-xl" />
                </div>
            </div>
        );
    }

    if (error && !data) {
        return (
            <div className="flex flex-col gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900 dark:border-rose-800 dark:bg-rose-950/30 dark:text-rose-100" role="alert">
                <span>{(error as Error).message || 'Finance data could not be loaded.'}</span>
                <button type="button" onClick={() => void refetch()} disabled={isFetching} className="w-fit rounded-md bg-rose-700 px-3 py-2 font-semibold text-white hover:bg-rose-800 disabled:cursor-wait disabled:opacity-60 dark:bg-rose-600 dark:hover:bg-rose-500">
                    {isFetching ? 'Retrying…' : 'Retry'}
                </button>
            </div>
        );
    }
    if (!data) {
        return (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900 dark:border-rose-800 dark:bg-rose-950/30 dark:text-rose-100" role="alert">
                Finance data was not returned. Please retry.
                <button type="button" onClick={() => void refetch()} className="ml-3 font-semibold underline underline-offset-2">Retry</button>
            </div>
        );
    }

    const trend = data.revenueTrend || [];
    const hasTrend = trend.some(p => hasValue(p.revenue));
    const lastMonth = trend[trend.length - 1];
    const prevMonth = trend[trend.length - 2];
    const trendDelta =
        lastMonth && prevMonth && hasValue(prevMonth.revenue)
            ? ((Number(lastMonth.revenue || 0) - prevMonth.revenue) / prevMonth.revenue) * 100
            : null;
    const trendUp = trendDelta !== null && trendDelta >= 0;

    const aging = data.aging || { within30: 0, days31To60: 0, days61To90: 0, over90: 0 };
    const agingRows = [
        { label: '0–30 days', value: aging.within30, bar: 'bg-emerald-500' },
        { label: '31–60 days', value: aging.days31To60, bar: 'bg-blue-500' },
        { label: '61–90 days', value: aging.days61To90, bar: 'bg-amber-500' },
        { label: 'Over 90 days', value: aging.over90, bar: 'bg-red-500' },
    ];
    const hasAging = agingRows.some(r => hasValue(r.value));
    const maxAging = Math.max(...agingRows.map(r => Number(r.value || 0)), 1);

    const statusAEntries = Object.entries(data.invoiceStatusA || {});
    const statusBEntries = Object.entries(data.invoiceStatusB || {});
    const hasStatus = statusAEntries.length > 0 || statusBEntries.length > 0;
    const executive = data.executiveFinance ?? {
        outstandingInvoiceAmount: 0,
        outstandingInvoiceCount: 0,
        overdueInvoiceAmount: 0,
        overdueInvoiceCount: 0,
        pendingPaymentVoucherCount: 0,
        retentionHeld: 0,
        activePenalties: 0,
    };
    const managementActions = [
        executive.overdueInvoiceCount > 0
            ? { count: executive.overdueInvoiceCount, title: 'Review overdue invoices', detail: `${formatLKR(executive.overdueInvoiceAmount)} is past its invoice due date.`, href: '/finance/ap/aging' }
            : null,
        executive.pendingPaymentVoucherCount > 0
            ? { count: executive.pendingPaymentVoucherCount, title: 'Review payment approvals', detail: 'Payment vouchers are awaiting finance authorization.', href: '/finance/payments' }
            : null,
        (data.dataQuality?.invalidFinancialSnapshotCount ?? 0) > 0
            ? { count: data.dataQuality?.invalidFinancialSnapshotCount ?? 0, title: 'Fix financial snapshots', detail: 'Completed SOD financial data is incomplete and excluded from reliable WIP.', href: '/service-orders/invoicable' }
            : null,
        executive.retentionHeld > 0
            ? { count: executive.retentionHeld, title: 'Review retention releases', detail: 'Retention balances remain held against project closeout conditions.', href: '/finance/retention' }
            : null,
    ].filter((action): action is NonNullable<typeof action> => action !== null).slice(0, 3);

    const statusColor = (status: string) => {
        switch (status) {
            case 'PAID': return 'bg-emerald-500';
            case 'PENDING': return 'bg-amber-500';
            case 'HOLD': return 'bg-red-500';
            case 'APPROVED': case 'ELIGIBLE': return 'bg-blue-500';
            case 'CANCELLED': case 'REJECTED': return 'bg-slate-400';
            default: return 'bg-slate-300 dark:bg-slate-600';
        }
    };

    return (
        <div className="space-y-6">
            {error && (
                <div className="flex flex-col gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100 sm:flex-row sm:items-center sm:justify-between" role="status">
                    <span>Showing cached finance data. Refresh did not complete.</span>
                    <button type="button" onClick={() => void refetch()} disabled={isFetching} className="font-semibold underline underline-offset-2 disabled:cursor-wait disabled:opacity-60">{isFetching ? 'Retrying…' : 'Retry'}</button>
                </div>
            )}
            {isFetching && !error && <p className="text-xs font-medium text-slate-700 dark:text-slate-300" role="status">Refreshing finance data…</p>}
            {(data.dataQuality?.invalidFinancialSnapshotCount ?? 0) > 0 && (
                <div className="flex flex-col gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950 sm:flex-row sm:items-center sm:justify-between" role="status">
                    <div>
                        <p className="font-bold">Finance data validation warning</p>
                        <p className="mt-1">
                            {data.dataQuality?.invalidFinancialSnapshotCount.toLocaleString()} completed SODs have missing revenue or contractor cost snapshots.
                            They are excluded from WIP totals until corrected.
                        </p>
                        {(data.dataQuality?.invalidInvoicableSnapshotCount ?? 0) > 0 && (
                            <p className="mt-1 text-xs font-semibold text-amber-900">
                                {data.dataQuality?.invalidInvoicableSnapshotCount.toLocaleString()} are marked invoicable and need priority review.
                            </p>
                        )}
                    </div>
                    <Link href="/service-orders/invoicable" className="inline-flex min-h-10 shrink-0 items-center justify-center rounded-md bg-amber-800 px-3 py-2 text-xs font-bold text-white hover:bg-amber-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-800 focus-visible:ring-offset-2">
                        Review invoicable SODs
                    </Link>
                </div>
            )}
            {/* Row 1 — headline metrics */}
            <section aria-label="Executive financial snapshot" className="space-y-4">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                        <h2 className="text-lg font-black text-slate-900 dark:text-slate-100">Executive financial snapshot</h2>
                    </div>
                    <Link href="/finance/reports/pnl" className="text-xs font-bold text-primary hover:underline">Open full finance reports →</Link>
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    <Card className="border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950" aria-label="Outstanding contractor invoices">
                        <CardHeader className="pb-2"><CardTitle className="text-xs font-black uppercase tracking-wide text-slate-700 dark:text-slate-300">Outstanding invoices</CardTitle></CardHeader>
                        <CardContent>
                            <p className="text-2xl font-black text-slate-950 dark:text-slate-100"><Money value={executive.outstandingInvoiceAmount} /></p>
                            <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">{executive.outstandingInvoiceCount.toLocaleString()} invoice(s) awaiting settlement</p>
                            <Link href="/finance/invoices" className="mt-3 inline-flex min-h-9 items-center text-xs font-bold text-primary hover:underline">Open invoices →</Link>
                        </CardContent>
                    </Card>
                    <Card className="border-rose-200 bg-rose-50/60 dark:border-rose-900 dark:bg-rose-950/20" aria-label="Overdue contractor invoices">
                        <CardHeader className="pb-2"><CardTitle className="text-xs font-black uppercase tracking-wide text-rose-800 dark:text-rose-300">Overdue invoices</CardTitle></CardHeader>
                        <CardContent>
                            <p className="text-2xl font-black text-rose-900 dark:text-rose-200"><Money value={executive.overdueInvoiceAmount} /></p>
                            <p className="mt-1 text-xs text-rose-800 dark:text-rose-300">{executive.overdueInvoiceCount.toLocaleString()} invoice(s) past due date</p>
                            <Link href="/finance/ap/aging" className="mt-3 inline-flex min-h-9 items-center text-xs font-bold text-rose-800 hover:underline dark:text-rose-300">Review aging →</Link>
                        </CardContent>
                    </Card>
                    <Card className="border-blue-200 bg-blue-50/60 dark:border-blue-900 dark:bg-blue-950/20" aria-label="Pending payment approvals">
                        <CardHeader className="pb-2"><CardTitle className="text-xs font-black uppercase tracking-wide text-blue-800 dark:text-blue-300">Payment approvals</CardTitle></CardHeader>
                        <CardContent>
                            <p className="text-2xl font-black text-blue-950 dark:text-blue-100">{executive.pendingPaymentVoucherCount.toLocaleString()}</p>
                            <p className="mt-1 text-xs text-blue-800 dark:text-blue-300">Payment voucher(s) awaiting authorization</p>
                            <Link href="/finance/payments" className="mt-3 inline-flex min-h-9 items-center text-xs font-bold text-blue-800 hover:underline dark:text-blue-300">Open payments →</Link>
                        </CardContent>
                    </Card>
                    <Card className="border-emerald-200 bg-emerald-50/60 dark:border-emerald-900 dark:bg-emerald-950/20" aria-label="Retention and penalties">
                        <CardHeader className="pb-2"><CardTitle className="text-xs font-black uppercase tracking-wide text-emerald-800 dark:text-emerald-300">Retention & penalties</CardTitle></CardHeader>
                        <CardContent className="space-y-2">
                            <div className="flex items-center justify-between gap-2 text-xs"><span className="text-emerald-800 dark:text-emerald-300">Retention held</span><span className="font-black text-emerald-950 dark:text-emerald-100"><Money value={executive.retentionHeld} /></span></div>
                            <div className="flex items-center justify-between gap-2 text-xs"><span className="text-emerald-800 dark:text-emerald-300">Active LD penalties</span><span className="font-black text-emerald-950 dark:text-emerald-100"><Money value={executive.activePenalties} /></span></div>
                            <Link href="/finance/retention" className="inline-flex min-h-9 items-center text-xs font-bold text-emerald-800 hover:underline dark:text-emerald-300">Review controls →</Link>
                        </CardContent>
                    </Card>
                </div>
                {managementActions.length > 0 && (
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/60" aria-label="Finance management actions">
                        <div className="flex items-center justify-between gap-3">
                            <div>
                                <h3 className="text-sm font-black text-slate-900 dark:text-slate-100">What needs management attention</h3>
                            </div>
                            <span className="rounded-full bg-slate-900 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-white dark:bg-slate-100 dark:text-slate-900">{managementActions.length} action{managementActions.length === 1 ? '' : 's'}</span>
                        </div>
                        <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-3">
                            {managementActions.map(action => (
                                <Link key={action.title} href={action.href} className="rounded-xl border border-slate-200 bg-white p-3 transition hover:border-primary hover:shadow-sm dark:border-slate-700 dark:bg-slate-950">
                                    <p className="text-sm font-black text-slate-900 dark:text-slate-100">{action.title}</p>
                                    <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">{action.detail}</p>
                                    <span className="mt-2 inline-flex text-xs font-bold text-primary">Open action →</span>
                                </Link>
                            ))}
                        </div>
                    </div>
                )}
            </section>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 border-emerald-500/20 shadow-sm transition-all hover:shadow-md">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
                            Unbilled WIP Revenue
                        </CardTitle>
                        <DollarSign className="w-5 h-5 text-emerald-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-emerald-800 dark:text-emerald-300">
                            <Money value={data.unbilledRevenue} />
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                            Completed Service Orders not yet invoiced
                        </p>
                        <div className="flex justify-between text-xs mt-3 pt-2 border-t border-emerald-500/10">
                            <span className="text-muted-foreground">Total invoiced:</span>
                            <span className="font-semibold"><Money value={data.totalInvoiced} /></span>
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-blue-500/10 to-blue-500/5 border-blue-500/20 shadow-sm transition-all hover:shadow-md">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-blue-700 dark:text-blue-400">
                            Contractor obligations
                        </CardTitle>
                        <Clock className="w-5 h-5 text-blue-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-blue-800 dark:text-blue-300">
                            <Money value={data.totalPendingPayouts} />
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                            Pending invoices plus unbilled completed SOD cost
                        </p>
                        <div className="flex justify-between text-xs mt-3 pt-2 border-t border-blue-500/10">
                            <span className="text-muted-foreground">Over 90 days:</span>
                            <span className="font-semibold text-red-600 dark:text-red-400">
                                <Money value={aging.over90} />
                            </span>
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-amber-500/10 to-amber-500/5 border-amber-500/20 shadow-sm transition-all hover:shadow-md">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-amber-700 dark:text-amber-400">
                            Split Breakdown
                        </CardTitle>
                        <AlertCircle className="w-5 h-5 text-amber-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-1">
                            <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Amount A:</span>
                                <span className="font-semibold"><Money value={data.pendingPayoutA} /></span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Amount B:</span>
                                <span className="font-semibold"><Money value={data.pendingPayoutB} /></span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Unbilled WIP:</span>
                                <span className="font-semibold"><Money value={data.unbilledContractorPayout} /></span>
                            </div>
                            <div className="flex justify-between text-xs pt-2 mt-1 border-t border-amber-500/10">
                                <span className="text-muted-foreground">Avg invoice ({data.invoiceCount || 0} total):</span>
                                <span className="font-semibold"><Money value={data.averageInvoiceAmount} /></span>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Row 2 — detail metrics */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="shadow-sm transition-all hover:shadow-md">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                            <BarChart3 className="w-4 h-4 text-emerald-600" />
                            Monthly Revenue Trend
                        </CardTitle>
                        {trendDelta !== null ? (
                            <span className={`flex items-center gap-1 text-xs font-semibold ${trendUp ? 'text-emerald-600' : 'text-red-600'}`}>
                                {trendUp ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                                {Math.abs(trendDelta).toFixed(1)}%
                            </span>
                        ) : (
                            <Clock className="w-5 h-5 text-muted-foreground/40" />
                        )}
                    </CardHeader>
                    <CardContent>
                        {!hasTrend ? (
                            <div className="h-40 flex flex-col items-center justify-center text-center space-y-2">
                                <Inbox className="w-8 h-8 text-muted-foreground/40" />
                                <p className="text-xs font-semibold text-muted-foreground">No revenue data</p>
                            </div>
                        ) : (
                        <div className="relative w-full min-w-0 h-40 min-h-0">
                            <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1} initialDimension={{ width: 1, height: 1 }}>
                                <BarChart data={trend}>
                                    <XAxis dataKey="month" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                                    <YAxis hide />
                                    <Tooltip
                                        formatter={(value) => [formatLKR(Number(value)), 'Revenue']}
                                        labelFormatter={(label, payload) => {
                                            const p = payload?.[0]?.payload as RevenueTrendPoint | undefined;
                                            return p ? `${p.month} ${p.year}` : String(label);
                                        }}
                                        contentStyle={{ fontSize: 12, borderRadius: 8 }}
                                    />
                                    <Bar
                                        dataKey="revenue"
                                        radius={[4, 4, 0, 0]}
                                        fill="#10b981"
                                    />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                        )}
                        <p className="text-xs text-muted-foreground mt-2">
                            Completed Service Order revenue, last 6 months
                        </p>
                    </CardContent>
                </Card>

                <Card className="shadow-sm transition-all hover:shadow-md">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                            <Hourglass className="w-4 h-4 text-amber-600" />
                            Invoice Aging
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {!hasAging ? (
                            <div className="h-40 flex flex-col items-center justify-center text-center space-y-2">
                                <Inbox className="w-8 h-8 text-muted-foreground/40" />
                                <p className="text-xs font-semibold text-muted-foreground">No aging data</p>
                            </div>
                        ) : (
                        <div className="space-y-3">
                            {agingRows.filter(r => hasValue(r.value)).map(row => (
                                    <div key={row.label}>
                                        <div className="flex justify-between text-xs mb-1">
                                            <span className="text-muted-foreground">{row.label}</span>
                                            <span className="font-semibold">{formatLKR(row.value)}</span>
                                        </div>
                                        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                                            <div
                                                className={`h-full rounded-full ${row.bar}`}
                                                style={{ width: `${Math.max((Number(row.value) / maxAging) * 100, 4)}%` }}
                                            />
                                        </div>
                                    </div>
                                ))}
                        </div>
                        )}
                        <p className="text-xs text-muted-foreground mt-3">
                            Outstanding payout amounts by invoice age
                        </p>
                    </CardContent>
                </Card>

                <Card className="shadow-sm transition-all hover:shadow-md">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                            <AlertCircle className="w-4 h-4 text-blue-600" />
                            Invoice Status Summary
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {!hasStatus ? (
                            <div className="h-32 flex flex-col items-center justify-center text-center space-y-2">
                                <Inbox className="w-8 h-8 text-muted-foreground/40" />
                                <p className="text-xs font-semibold text-muted-foreground">No invoice data</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <p className="text-xs font-semibold text-muted-foreground mb-2">Status A</p>
                                    <div className="space-y-1.5">
                                        {statusAEntries.length > 0 ? statusAEntries.map(([status, count]) => (
                                            <div key={status} className="flex items-center justify-between text-xs">
                                                <span className="flex items-center gap-1.5">
                                                    <span className={`w-2 h-2 rounded-full ${statusColor(status)}`} />
                                                    <span className="text-muted-foreground">{status}</span>
                                                </span>
                                                <span className="font-semibold">{count}</span>
                                            </div>
                                        )) : (
                                            <p className="text-xs text-muted-foreground/60">No invoices</p>
                                        )}
                                    </div>
                                </div>
                                <div>
                                    <p className="text-xs font-semibold text-muted-foreground mb-2">Status B</p>
                                    <div className="space-y-1.5">
                                        {statusBEntries.length > 0 ? statusBEntries.map(([status, count]) => (
                                            <div key={status} className="flex items-center justify-between text-xs">
                                                <span className="flex items-center gap-1.5">
                                                    <span className={`w-2 h-2 rounded-full ${statusColor(status)}`} />
                                                    <span className="text-muted-foreground">{status}</span>
                                                </span>
                                                <span className="font-semibold">{count}</span>
                                            </div>
                                        )) : (
                                            <p className="text-xs text-muted-foreground/60">No invoices</p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}
                        <p className="text-xs text-muted-foreground mt-3">
                            Invoice counts by processing status
                        </p>
                    </CardContent>
                </Card>
            </div>
            <div className="flex flex-col gap-2 px-1 text-[11px] text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
                <span>{data.updatedAt ? `Finance data refreshed ${new Date(data.updatedAt).toLocaleString()}` : 'Finance refresh timestamp was not supplied by the API.'}</span>
                <Link href="/finance/reports/pnl" className="font-bold text-primary hover:underline">Open finance reports →</Link>
            </div>
        </div>
    );
}

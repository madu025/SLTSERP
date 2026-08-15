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
    updatedAt: string;
}

const hasValue = (val: number | null | undefined) => Number(val || 0) > 0;

function Money({ value, className = '' }: { value: number; className?: string }) {
    return <span className={className}>{formatLKR(value)}</span>;
}

export default function FinanceSection({ rtom = 'ALL' }: { rtom?: string }) {
    const { data, isLoading, error } = useQuery<FinanceStats>({
        queryKey: ['dashboard-finance', rtom],
        queryFn: async () => {
            const params = new URLSearchParams({ rtom });
            const resp = await fetch(`/api/dashboard/finance?${params}`);
            if (!resp.ok) throw new Error('Failed to fetch finance stats');
            return resp.json();
        },
        staleTime: 5 * 60 * 1000, // 5 mins
    });

    if (isLoading) {
        return (
            <div className="space-y-6">
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

    if (error || !data) {
        return <div className="text-red-500">Failed to load finance data.</div>;
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
            {/* Row 1 — headline metrics */}
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
                            Pending Payouts (A + B)
                        </CardTitle>
                        <Clock className="w-5 h-5 text-blue-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-blue-800 dark:text-blue-300">
                            <Money value={data.totalPendingPayouts} />
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                            Approved but unpaid contractor invoices
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
                        <div className="h-40">
                            <ResponsiveContainer width="100%" height="100%">
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
        </div>
    );
}

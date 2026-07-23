/**
 * StatsCardGrid – the two top KPI strips on the dashboard.
 *
 * Renders:
 *  1. Monthly KPI grid (4 × StatCard) – received, invoicable, completed
 *     (with completion-rate sub-label), and returns.
 *  2. Year-to-date strip (5 inline glass-panel cards) – brought forward,
 *     total received, total completed, PAT pass, PAT rejected.
 *
 * Extracted from `src/app/dashboard/page.tsx`. The monthly grid uses the
 * shared {@link StatCard} component; the YTD strip keeps its inline
 * glass-panel markup because the styling differs from StatCard.
 */

import { Inbox, Wallet, CheckCircle2, RotateCcw } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { StatCard } from './StatCard';
import type { Stats } from './types';

export interface StatsCardGridProps {
    isLoading: boolean;
    stats: Stats | undefined;
}

/** Small inline card used only by the YTD strip — not shared. */
function YtdCard({ label, value, valueClass }: { label: string; value: number; valueClass: string }) {
    return (
        <div className="glass-panel p-4 rounded-2xl border border-border/40 flex flex-col justify-between hover:scale-[1.03] transition-all duration-200 shadow-sm bg-card/40 hover:bg-card/70">
            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-tight">{label}</p>
            <p className={`text-xl font-black mt-1 font-mono ${valueClass}`}>{value.toLocaleString()}</p>
        </div>
    );
}

export function StatsCardGrid({ isLoading, stats }: StatsCardGridProps) {
    const total = stats?.monthly?.total || 0;
    const completed = stats?.monthly?.completed || 0;
    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

    const hasMonthlyData = total > 0 || completed > 0 || (stats?.monthly?.returned || 0) > 0 || (stats?.monthly?.invoicable || 0) > 0;
    const hasYtdData = !!stats?.allTime && ((stats.allTime.total ?? 0) > 0 || (stats.allTime.completed ?? 0) > 0 || (stats.allTime.broughtForward ?? 0) > 0);
    const hasAnyData = hasMonthlyData || hasYtdData;

    // ── Empty state ──────────────────────────────────────
    if (!isLoading && !hasAnyData) {
        return (
            <div className="glass-panel rounded-3xl border border-border/50 p-12 flex flex-col items-center justify-center text-center space-y-4">
                <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center shadow-lg">
                    <Inbox className="w-8 h-8 text-primary" />
                </div>
                <div>
                    <h3 className="font-extrabold text-foreground text-base">No operations metrics available</h3>
                    <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                        There is no monthly or year-to-date service order data for the selected region yet.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Monthly KPI Cards */}
            <section aria-label="Monthly KPIs">
                <div
                    className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
                    aria-busy={isLoading}
                >
                    {isLoading ? (
                        Array(4).fill(0).map((_, i) => <Skeleton key={i} className="h-32 rounded-3xl" />)
                    ) : (
                        <>
                            <StatCard label="Monthly Received" value={stats?.monthly?.total || 0} icon={<Inbox className="w-6 h-6" />} color="blue" />
                            <StatCard label="Monthly Invoicable" value={stats?.monthly?.invoicable || 0} icon={<Wallet className="w-6 h-6" />} color="indigo" />
                            <StatCard
                                label="Monthly Completed"
                                value={stats?.monthly?.completed || 0}
                                icon={<CheckCircle2 className="w-6 h-6" />}
                                color="emerald"
                                sub={`${completionRate}% completion rate`}
                            />
                            <StatCard label="Monthly Return" value={stats?.monthly?.returned || 0} icon={<RotateCcw className="w-6 h-6" />} color="rose" />
                        </>
                    )}
                </div>
            </section>

            {/* Financial & SLA Health Cockpit */}
            {stats?.financials && (
                <section aria-label="Executive Financials & SLA">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="glass-panel p-5 rounded-3xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-transparent shadow-sm hover:shadow-md transition-all">
                            <p className="text-[10px] font-black uppercase text-emerald-600 dark:text-emerald-400 tracking-wider">Recognized Revenue</p>
                            <p className="text-2xl font-black font-mono text-emerald-500 mt-1">Rs. {(stats.financials.totalRevenue || 0).toLocaleString()}</p>
                        </div>
                        <div className="glass-panel p-5 rounded-3xl border border-blue-500/20 bg-gradient-to-br from-blue-500/10 via-blue-500/5 to-transparent shadow-sm hover:shadow-md transition-all">
                            <p className="text-[10px] font-black uppercase text-blue-600 dark:text-blue-400 tracking-wider">Contractor Cost</p>
                            <p className="text-2xl font-black font-mono text-blue-400 mt-1">Rs. {(stats.financials.totalContractorCost || 0).toLocaleString()}</p>
                        </div>
                        <div className="glass-panel p-5 rounded-3xl border border-indigo-500/20 bg-gradient-to-br from-indigo-500/10 via-indigo-500/5 to-transparent shadow-sm hover:shadow-md transition-all">
                            <p className="text-[10px] font-black uppercase text-indigo-600 dark:text-indigo-400 tracking-wider">Net Profit Margin</p>
                            <div className="flex items-baseline justify-between mt-1">
                                <p className="text-2xl font-black font-mono text-indigo-500">Rs. {(stats.financials.netMargin || 0).toLocaleString()}</p>
                                <span className="text-xs font-extrabold px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">{stats.financials.marginPercentage}%</span>
                            </div>
                        </div>
                        <div className="glass-panel p-5 rounded-3xl border border-rose-500/20 bg-gradient-to-br from-rose-500/10 via-rose-500/5 to-transparent shadow-sm hover:shadow-md transition-all">
                            <p className="text-[10px] font-black uppercase text-rose-600 dark:text-rose-400 tracking-wider">Overdue SLA Pending (&gt;48h)</p>
                            <div className="flex items-baseline justify-between mt-1">
                                <p className="text-2xl font-black text-rose-500 font-mono">{(stats.sla?.slaBreachedCount || 0).toLocaleString()}</p>
                                <span className="text-[10px] font-extrabold text-rose-400 px-2 py-0.5 rounded-full bg-rose-500/10 border border-rose-500/20">Target: 95%</span>
                            </div>
                        </div>
                    </div>
                </section>
            )}

            {/* Cross-Functional Enterprise Module Summary */}
            {stats?.financeSummary && (
                <section aria-label="Enterprise Modules Summary">
                    <div className="flex items-center justify-between mb-2 px-1">
                        <h3 className="text-xs font-black uppercase tracking-wider text-muted-foreground">Enterprise ERP Module Overview (Finance, Fleet & Procurement)</h3>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="glass-panel p-4 rounded-2xl border border-sky-500/20 bg-sky-500/5 hover:border-sky-500/30 transition-all">
                            <p className="text-[10px] font-black uppercase text-sky-600 dark:text-sky-400 tracking-wider">Total Invoiced Billing</p>
                            <p className="text-xl font-black font-mono text-sky-500 mt-1">Rs. {(stats.financeSummary.invoicedTotal || 0).toLocaleString()}</p>
                            <p className="text-[10px] font-semibold text-muted-foreground mt-0.5">{stats.financeSummary.pendingInvoices} Pending Invoices (Rs. {stats.financeSummary.pendingInvoiceAmount.toLocaleString()})</p>
                        </div>
                        <div className="glass-panel p-4 rounded-2xl border border-purple-500/20 bg-purple-500/5 hover:border-purple-500/30 transition-all">
                            <p className="text-[10px] font-black uppercase text-purple-600 dark:text-purple-400 tracking-wider">Uninvoiced Work Pending</p>
                            <p className="text-xl font-black font-mono text-purple-400 mt-1">Rs. {(stats.financeSummary.uninvoicedCompletedAmount || 0).toLocaleString()}</p>
                            <p className="text-[10px] font-semibold text-muted-foreground mt-0.5">Ready for invoice batch generation</p>
                        </div>
                        <div className="glass-panel p-4 rounded-2xl border border-amber-500/20 bg-amber-500/5 hover:border-amber-500/30 transition-all">
                            <p className="text-[10px] font-black uppercase text-amber-600 dark:text-amber-400 tracking-wider">Fleet & Vehicle Logistics</p>
                            <p className="text-xl font-black font-mono text-amber-500 mt-1">{(stats.vehicleSummary?.activeVehicles || 0).toLocaleString()} Vehicles</p>
                            <p className="text-[10px] font-semibold text-muted-foreground mt-0.5">{(stats.vehicleSummary?.monthlyTrips || 0).toLocaleString()} Monthly Trips (Pending: Rs. {(stats.vehicleSummary?.pendingVehiclePayments || 0).toLocaleString()})</p>
                        </div>
                        <div className="glass-panel p-4 rounded-2xl border border-teal-500/20 bg-teal-500/5 hover:border-teal-500/30 transition-all">
                            <p className="text-[10px] font-black uppercase text-teal-600 dark:text-teal-400 tracking-wider">Procurement Approvals</p>
                            <p className="text-xl font-black font-mono text-teal-500 mt-1">{(stats.procurementSummary?.pendingApprovals || 0).toLocaleString()} Approvals</p>
                            <p className="text-[10px] font-semibold text-muted-foreground mt-0.5">{(stats.procurementSummary?.totalVendors || 0).toLocaleString()} Active Suppliers</p>
                        </div>
                    </div>
                </section>
            )}

            {/* Year-to-date strip */}
            <section aria-label="Year to date">
                <div className="flex items-center justify-between mb-2 px-1">
                    <h3 className="text-xs font-black uppercase tracking-wider text-muted-foreground">Year to Date Overview (2026)</h3>
                </div>
                <div
                    className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3"
                    aria-busy={isLoading}
                >
                    {isLoading ? (
                        Array(5).fill(0).map((_, i) => <Skeleton key={i} className="h-20 rounded-2xl" />)
                    ) : (
                        <>
                            <YtdCard label="Brought Forward (2025)" value={stats?.allTime?.broughtForward || 0} valueClass="text-primary" />
                            <YtdCard label="2026 Total Received" value={stats?.allTime?.total || 0} valueClass="text-foreground" />
                            <YtdCard label="2026 Total Completed" value={stats?.allTime?.completed || 0} valueClass="text-emerald-500" />
                            <YtdCard label="2026 PAT Pass" value={stats?.pat?.passed || 0} valueClass="text-sky-500" />
                            <YtdCard label="2026 PAT Rejected" value={stats?.pat?.rejected || 0} valueClass="text-rose-500" />
                        </>
                    )}
                </div>
            </section>
        </div>
    );
}

export default StatsCardGrid;

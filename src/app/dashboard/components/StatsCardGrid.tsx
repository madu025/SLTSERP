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
        <div className="glass-panel p-4 rounded-xl border border-border/40 flex flex-col justify-between hover:scale-[1.02] transition-transform duration-200">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-tight">{label}</p>
            <p className={`text-xl font-black mt-1 ${valueClass}`}>{value.toLocaleString()}</p>
        </div>
    );
}

export function StatsCardGrid({ isLoading, stats }: StatsCardGridProps) {
    // Derived KPI — kept inline (no hook needed) so this file can stay a
    // server component and is only opted into the client bundle by the
    // parent page.
    const total = stats?.monthly?.total || 0;
    const completed = stats?.monthly?.completed || 0;
    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

    const hasMonthlyData = total > 0 || completed > 0 || (stats?.monthly?.returned || 0) > 0 || (stats?.monthly?.invoicable || 0) > 0;
    const hasYtdData = !!stats?.allTime && ((stats.allTime.total ?? 0) > 0 || (stats.allTime.completed ?? 0) > 0 || (stats.allTime.broughtForward ?? 0) > 0);
    const hasAnyData = hasMonthlyData || hasYtdData;

    // ── Empty state ──────────────────────────────────────
    if (!isLoading && !hasAnyData) {
        return (
            <div className="glass-panel rounded-2xl border border-border/40 p-10 flex flex-col items-center justify-center text-center space-y-4">
                <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                    <Inbox className="w-7 h-7 text-primary" />
                </div>
                <div>
                    <h3 className="font-bold text-foreground">No statistics available</h3>
                    <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                        There is no monthly or year-to-date data to display yet. Check back once service orders are imported.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <>
            {/* Monthly KPI Cards */}
            <section aria-label="Monthly KPIs">
                <div
                    className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4"
                    aria-busy={isLoading}
                >
                    {isLoading ? (
                        Array(4).fill(0).map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)
                    ) : (
                        <>
                            <StatCard label="Monthly Received" value={stats?.monthly?.total || 0} icon={<Inbox className="w-5 h-5" />} color="blue" />
                            <StatCard label="Monthly Invoicable" value={stats?.monthly?.invoicable || 0} icon={<Wallet className="w-5 h-5" />} color="indigo" />
                            <StatCard
                                label="Monthly Completed"
                                value={stats?.monthly?.completed || 0}
                                icon={<CheckCircle2 className="w-5 h-5" />}
                                color="emerald"
                                sub={`${completionRate}% completion rate`}
                            />
                            <StatCard label="Monthly Return" value={stats?.monthly?.returned || 0} icon={<RotateCcw className="w-5 h-5" />} color="rose" />
                        </>
                    )}
                </div>
            </section>

            {/* Year-to-date strip */}
            <section aria-label="Year to date">
                <div
                    className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3"
                    aria-busy={isLoading}
                >
                    {isLoading ? (
                        Array(5).fill(0).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)
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
        </>
    );
}

export default StatsCardGrid;

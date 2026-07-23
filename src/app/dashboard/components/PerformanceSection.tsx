'use client';

/**
 * PerformanceSection – contractor performance + SOD aging chart.
 *
 * Contains:
 *  1. SOD Aging Report bar chart (Recharts BarChart) with a legend grid
 *     below — spans 2 columns on large screens.
 *  2. Contractor Performance progress bars — 1 column.
 *
 * Extracted from `src/app/dashboard/page.tsx`. The bar chart, legend
 * grid, and progress-bar markup are preserved verbatim.
 */

import type { ReactNode } from 'react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Cell, Tooltip, ResponsiveContainer,
} from 'recharts';
import { Skeleton } from '@/components/ui/skeleton';
import { Inbox } from 'lucide-react';
import type { Stats } from './types';
import { tooltipStyle } from './types';

export interface PerformanceSectionProps {
    isLoading: boolean;
    contractors?: Stats['contractors'];
    aging?: Stats['aging'];
}

/* ── Local ChartCard (same glass-panel wrapper as the original page) ── */
function ChartCard({ title, subtitle, accent, className, children }: {
    title: string;
    subtitle?: string;
    accent: string;
    className?: string;
    children: ReactNode;
}) {
    return (
        <div className={`glass-panel p-6 rounded-3xl border border-border/50 shadow-sm flex flex-col hover:border-primary/20 hover:shadow-lg transition-all duration-300 ${className || ''}`}>
            <div className="mb-5 flex items-center justify-between">
                <div>
                    <h3 className="font-extrabold text-foreground flex items-center gap-2 text-sm md:text-base">
                        <span className={`w-2 h-4 rounded-full ${accent}`}></span>
                        {title}
                    </h3>
                    {subtitle && <p className="text-[11px] font-semibold text-muted-foreground mt-0.5 ml-4">{subtitle}</p>}
                </div>
            </div>
            {children}
        </div>
    );
}

/* ── Centred "No data available" placeholder ── */
function NoDataPlaceholder({ height = 'h-56' }: { height?: string }) {
    return (
        <div className={`${height} flex flex-col items-center justify-center text-center space-y-2`}>
            <Inbox className="w-8 h-8 text-muted-foreground/40" />
            <p className="text-xs font-semibold text-muted-foreground">No data available</p>
        </div>
    );
}

export function PerformanceSection({ isLoading, contractors, aging }: PerformanceSectionProps) {
    const hasAging = !!aging && aging.length > 0;
    const hasContractors = !!contractors && contractors.length > 0;

    return (
        <section
            role="region"
            aria-label="Performance metrics"
            className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6"
        >
            {/* SOD Aging (KPI priority — spans 2) */}
            <ChartCard
                title="SOD Aging Report"
                subtitle="Pending KPI"
                accent="bg-amber-500"
                className="lg:col-span-2"
            >
                <div className="h-64 sm:h-72">
                    {isLoading ? (
                        <div className="h-full flex items-center justify-center"><Skeleton className="w-full h-full rounded-xl" /></div>
                    ) : !hasAging ? (
                        <NoDataPlaceholder height="h-64 sm:h-72" />
                    ) : (
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={aging || []} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border, #e2e8f0)" opacity={0.3} />
                                <XAxis
                                    dataKey="range"
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fill: 'var(--color-muted-foreground, #64748b)', fontSize: 12, fontWeight: 600 }}
                                />
                                <YAxis
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fill: 'var(--color-muted-foreground, #64748b)', fontSize: 12 }}
                                />
                                <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'var(--color-muted-foreground, #64748b)', opacity: 0.08 }} />
                                <Bar dataKey="count" fill="#f59e0b" radius={[6, 6, 0, 0]} barSize={40}>
                                    {aging?.map((entry, index) => (
                                        <Cell
                                            key={`cell-${index}`}
                                            fill={entry.range.includes('10+') ? '#ef4444' : entry.range.includes('7-10') ? '#f97316' : '#f59e0b'}
                                        />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    )}
                </div>
                {hasAging && (
                    <div className="mt-4 grid grid-cols-2 sm:grid-cols-5 gap-2">
                        {aging?.map((a, i) => (
                            <div key={i} className="p-2 rounded-lg bg-card/50 border border-border/40 text-center hover:scale-[1.03] transition-transform duration-200">
                                <p className="text-[10px] font-bold text-muted-foreground uppercase">{a.range}</p>
                                <p className={`text-sm font-black ${a.range.includes('10+') ? 'text-rose-500' : 'text-foreground'}`}>{a.count}</p>
                            </div>
                        ))}
                    </div>
                )}
            </ChartCard>

            {/* Contractor Performance */}
            <ChartCard title="Contractor Performance" subtitle="Completion rate" accent="bg-blue-500">
                <div className="space-y-4 overflow-y-auto max-h-[230px] pr-2">
                    {isLoading ? (
                        Array(5).fill(0).map((_, i) => <div key={i} className="space-y-2"><Skeleton className="h-3 w-24" /><Skeleton className="h-2 w-full" /></div>)
                    ) : !hasContractors ? (
                        <div className="flex flex-col items-center justify-center py-8 space-y-2">
                            <Inbox className="w-8 h-8 text-muted-foreground/40" />
                            <p className="text-xs font-semibold text-muted-foreground">No data available</p>
                        </div>
                    ) : (
                        contractors?.map((c, i) => (
                            <div key={i}>
                                <div className="flex justify-between text-xs mb-1">
                                    <span className="font-medium text-foreground truncate pr-2">{c.name}</span>
                                    <span className="text-muted-foreground shrink-0">{c.completed}/{c.total}</span>
                                </div>
                                <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                                    <div className="h-full bg-gradient-to-r from-blue-500 to-sky-400 rounded-full transition-all duration-1000" style={{ width: `${c.percentage}%` }} />
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </ChartCard>
        </section>
    );
}

export default PerformanceSection;

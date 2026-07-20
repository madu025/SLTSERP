'use client';

/**
 * ChartSection – the 3-column chart grid on the dashboard.
 *
 * Contains:
 *  1. Monthly Status donut (Recharts PieChart)
 *  2. PAT Distribution donut (Recharts PieChart)
 *  3. Completion Breakdown list (status → count)
 *
 * Extracted from `src/app/dashboard/page.tsx`. Chart config and styling
 * are preserved verbatim; only the grouping changed (these three charts
 * were previously split across two grid sections in the monolith).
 */

import type { ReactNode } from 'react';
import {
    PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { Skeleton } from '@/components/ui/skeleton';
import { Inbox } from 'lucide-react';
import type { Stats } from './types';
import { COLORS, PAT_COLORS, tooltipStyle } from './types';

export interface ChartSectionProps {
    isLoading: boolean;
    monthlyPieData: Array<{ name: string; value: number }>;
    patData: Array<{ name: string; value: number }>;
    statusBreakdown?: Stats['statusBreakdown'];
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
        <div className={`glass-panel p-5 md:p-6 rounded-2xl border border-border/40 shadow-sm flex flex-col hover:border-primary/10 transition-all duration-300 ${className || ''}`}>
            <div className="mb-5">
                <h3 className="font-bold text-foreground flex items-center gap-2">
                    <span className={`w-1.5 h-4 rounded-full ${accent}`}></span>
                    {title}
                </h3>
                {subtitle && <p className="text-[11px] text-muted-foreground mt-0.5 ml-3.5">{subtitle}</p>}
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

export function ChartSection({ isLoading, monthlyPieData, patData, statusBreakdown }: ChartSectionProps) {
    return (
        <section
            role="region"
            aria-label="Charts overview"
            className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6"
        >
            {/* Monthly Status donut */}
            <ChartCard title="Monthly Status" subtitle="Distribution" accent="bg-primary">
                <div className="h-64 sm:h-72">
                    {isLoading ? (
                        <div className="h-full flex items-center justify-center"><Skeleton className="w-40 h-40 rounded-full" /></div>
                    ) : monthlyPieData.length === 0 ? (
                        <NoDataPlaceholder height="h-64 sm:h-72" />
                    ) : (
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie data={monthlyPieData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                                    {monthlyPieData.map((_, index) => <Cell key={index} fill={COLORS[index % COLORS.length]} />)}
                                </Pie>
                                <Tooltip contentStyle={tooltipStyle} />
                                <Legend />
                            </PieChart>
                        </ResponsiveContainer>
                    )}
                </div>
            </ChartCard>

            {/* PAT Distribution donut */}
            <ChartCard title="PAT Distribution" subtitle="Test results" accent="bg-indigo-500">
                <div className="h-56">
                    {isLoading ? (
                        <div className="h-full flex items-center justify-center"><Skeleton className="w-36 h-36 rounded-full" /></div>
                    ) : patData.length === 0 ? (
                        <NoDataPlaceholder />
                    ) : (
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie data={patData} cx="50%" cy="50%" innerRadius={55} outerRadius={75} paddingAngle={5} dataKey="value">
                                    {patData.map((_, index) => <Cell key={index} fill={PAT_COLORS[index % PAT_COLORS.length]} />)}
                                </Pie>
                                <Tooltip contentStyle={tooltipStyle} />
                                <Legend />
                            </PieChart>
                        </ResponsiveContainer>
                    )}
                </div>
            </ChartCard>

            {/* Completion Breakdown list */}
            <ChartCard title="Completion Breakdown" subtitle="By status" accent="bg-emerald-500">
                <div className="space-y-2 overflow-y-auto max-h-[230px] pr-2">
                    {isLoading ? (
                        Array(5).fill(0).map((_, i) => <div key={i} className="flex justify-between py-1"><Skeleton className="h-4 w-24" /><Skeleton className="h-4 w-12" /></div>)
                    ) : !statusBreakdown || statusBreakdown.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-8 space-y-2">
                            <Inbox className="w-8 h-8 text-muted-foreground/40" />
                            <p className="text-xs font-semibold text-muted-foreground">No data available</p>
                        </div>
                    ) : (
                        statusBreakdown.map((s, i) => (
                            <div key={i} className="flex justify-between items-center p-2 hover:bg-primary/5 rounded-lg border-b border-border/10 last:border-0 transition-colors">
                                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-tight">{s.status.replace(/_/g, ' ')}</span>
                                <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-500 rounded-md text-[10px] font-black border border-emerald-500/20">{s.count.toLocaleString()}</span>
                            </div>
                        ))
                    )}
                </div>
            </ChartCard>
        </section>
    );
}

export default ChartSection;

/**
 * RTOMTables – RTOM Performance + RTOM PAT Summary tables.
 *
 * Two glass-panel tables shown side-by-side (xl:grid-cols-2) for higher
 * management roles. The parent page guards this component behind an
 * `isHigherManagement` check, so no role logic lives here.
 *
 * Extracted from `src/app/dashboard/page.tsx`.
 */

import Link from 'next/link';
import { BarChart3, Inbox } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import type { Stats } from './types';

export interface RTOMTablesProps {
    isLoading: boolean;
    sortedRtoms: Stats['rtoms'];
}

/* ── Centred empty-state row spanning all columns ── */
function EmptyRow({ colSpan }: { colSpan: number }) {
    return (
        <tr>
            <td colSpan={colSpan} className="px-6 py-10">
                <div className="flex flex-col items-center justify-center space-y-2">
                    <Inbox className="w-8 h-8 text-muted-foreground/40" />
                    <p className="text-xs font-semibold text-muted-foreground">No RTOM data available</p>
                </div>
            </td>
        </tr>
    );
}

export function RTOMTables({ isLoading, sortedRtoms }: RTOMTablesProps) {
    return (
        <section
            role="region"
            aria-label="RTOM comparison"
            className="grid grid-cols-1 xl:grid-cols-2 gap-4 md:gap-6"
        >
            {/* RTOM Performance table */}
            <div className="glass-panel rounded-2xl border border-border/40 shadow-sm overflow-hidden hover:border-primary/10 transition-all duration-300">
                <div className="p-5 border-b border-border/40 flex items-center justify-between">
                    <h3 className="font-bold text-foreground flex items-center gap-2">
                        <span className="w-1.5 h-4 bg-indigo-500 rounded-full"></span>
                        RTOM Performance
                    </h3>
                    <BarChart3 className="w-4 h-4 text-muted-foreground" />
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-card-foreground/[0.03]">
                            <tr className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                <th className="px-6 py-3">RTOM</th>
                                <th className="px-6 py-3">Comp</th>
                                <th className="px-6 py-3">Pend</th>
                                <th className="px-6 py-3">Ret</th>
                                <th className="px-6 py-3">Progress</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border/20 uppercase text-xs">
                            {isLoading ? (
                                Array(3).fill(0).map((_, i) => <tr key={i}><td colSpan={5} className="px-6 py-4"><Skeleton className="h-4 w-full" /></td></tr>)
                            ) : sortedRtoms.length === 0 ? (
                                <EmptyRow colSpan={5} />
                            ) : (
                                sortedRtoms.map((r, i) => (
                                    <tr key={i} className="hover:bg-card-foreground/[0.02] transition-colors">
                                        <td className="px-6 py-4 font-bold text-foreground">{r.name}</td>
                                        <td className="px-6 py-4 text-emerald-500 font-bold">{r.completed}</td>
                                        <td className="px-6 py-4 text-amber-500 font-bold">{r.pending}</td>
                                        <td className="px-6 py-4 text-orange-500 font-bold">{r.returned}</td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2">
                                                <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden max-w-[60px]">
                                                    <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${(r.completed / (r.total || 1)) * 100}%` }} />
                                                </div>
                                                <span className="text-[10px] font-bold text-muted-foreground">{Math.round((r.completed / (r.total || 1)) * 100)}%</span>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* RTOM PAT Summary table */}
            <div className="glass-panel rounded-2xl border border-border/40 shadow-sm overflow-hidden hover:border-primary/10 transition-all duration-300">
                <div className="p-5 border-b border-border/40 flex justify-between items-center">
                    <h3 className="font-bold text-foreground flex items-center gap-2">
                        <span className="w-1.5 h-4 bg-emerald-500 rounded-full"></span>
                        RTOM PAT Summary
                    </h3>
                    <Link href="/service-orders/pat" className="text-xs text-primary font-bold hover:underline">View All</Link>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-card-foreground/[0.03]">
                            <tr className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                <th className="px-6 py-3">RTOM</th>
                                <th className="px-6 py-3 text-emerald-500">Approved</th>
                                <th className="px-6 py-3 text-rose-500">Rejected</th>
                                <th className="px-6 py-3 text-orange-500">SLT Rej</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border/20 uppercase text-xs">
                            {isLoading ? (
                                Array(3).fill(0).map((_, i) => <tr key={i}><td colSpan={4} className="px-6 py-4"><Skeleton className="h-4 w-full" /></td></tr>)
                            ) : sortedRtoms.length === 0 ? (
                                <EmptyRow colSpan={4} />
                            ) : (
                                sortedRtoms.map((r, i) => (
                                    <tr key={i} className="hover:bg-card-foreground/[0.02] transition-colors">
                                        <td className="px-6 py-4 font-bold text-foreground">{r.name}</td>
                                        <td className="px-6 py-4 text-emerald-500 font-black">{r.patPassed || 0}</td>
                                        <td className="px-6 py-4 text-rose-500 font-black">{r.patRejected || 0}</td>
                                        <td className="px-6 py-4 text-orange-500 font-black">{r.sltsPatRejected || 0}</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </section>
    );
}

export default RTOMTables;

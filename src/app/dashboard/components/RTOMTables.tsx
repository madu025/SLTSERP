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
import { BarChart3, Inbox, Search } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { useState, useMemo } from 'react';
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
                    <p className="text-xs font-semibold text-muted-foreground">No matching RTOM data found</p>
                </div>
            </td>
        </tr>
    );
}

export function RTOMTables({ isLoading, sortedRtoms }: RTOMTablesProps) {
    const [searchTerm, setSearchTerm] = useState('');
    const [sortBy, setSortBy] = useState<'revenue' | 'volume' | 'rate' | 'name'>('revenue');

    const filteredAndSortedRtoms = useMemo(() => {
        let result = [...sortedRtoms];
        if (searchTerm.trim()) {
            const term = searchTerm.toLowerCase().trim();
            result = result.filter(r => r.name.toLowerCase().includes(term));
        }

        return result.sort((a, b) => {
            const totalA = a.completed + a.pending + a.returned;
            const totalB = b.completed + b.pending + b.returned;
            const rateA = totalA > 0 ? (a.completed / totalA) * 100 : 0;
            const rateB = totalB > 0 ? (b.completed / totalB) * 100 : 0;
            const revA = a.revenue || (a.completed * 6500);
            const revB = b.revenue || (b.completed * 6500);

            if (sortBy === 'revenue') {
                if (revB !== revA) return revB - revA;
                return b.completed - a.completed;
            }
            if (sortBy === 'rate') {
                if (rateB !== rateA) return rateB - rateA;
                return b.completed - a.completed;
            }
            if (sortBy === 'volume') {
                if (b.completed !== a.completed) return b.completed - a.completed;
                return totalB - totalA;
            }
            return a.name.localeCompare(b.name);
        });
    }, [sortedRtoms, searchTerm, sortBy]);

    return (
        <section
            role="region"
            aria-label="RTOM comparison"
            className="space-y-4"
        >
            {/* Search Filter Header & Sort Controls for Managers */}
            <div className="glass-panel p-4 rounded-2xl border border-border/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <h3 className="font-extrabold text-foreground text-sm flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-primary" />
                    RTOM Operational & Financial Breakdown ({filteredAndSortedRtoms.length} RTOMs)
                </h3>
                <div className="flex items-center gap-2">
                    <select
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value as 'revenue' | 'volume' | 'rate' | 'name')}
                        className="h-8 px-2 text-xs font-bold rounded-xl border border-border/40 bg-background/80 text-foreground focus:ring-1 focus:ring-primary cursor-pointer"
                    >
                        <option value="revenue">Sort: Highest Revenue (LKR)</option>
                        <option value="volume">Sort: Highest Completed Volume</option>
                        <option value="rate">Sort: Highest Completion %</option>
                        <option value="name">Sort: Alphabetical (A-Z)</option>
                    </select>

                    <div className="relative w-full sm:w-56">
                        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            type="text"
                            placeholder="Search RTOM (e.g. R-WT)..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-9 h-8 text-xs font-semibold rounded-xl border-border/40 bg-background/80 focus:ring-1 focus:ring-primary"
                        />
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 md:gap-6">
                {/* RTOM Performance table */}
                <div className="glass-panel rounded-3xl border border-border/50 shadow-sm overflow-hidden hover:border-primary/20 transition-all duration-300">
                    <div className="p-5 border-b border-border/40 flex items-center justify-between">
                        <h3 className="font-extrabold text-foreground flex items-center gap-2 text-sm">
                            <span className="w-2 h-4 bg-indigo-500 rounded-full"></span>
                            RTOM Revenue & Performance Ranking
                        </h3>
                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Financial Impact First</span>
                    </div>
                    <div className="overflow-x-auto max-h-[480px]">
                        <table className="w-full">
                            <thead className="bg-card-foreground/[0.03] sticky top-0 backdrop-blur-md z-10">
                                <tr className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                    <th className="px-4 py-3">RTOM</th>
                                    <th className="px-3 py-3">Rec</th>
                                    <th className="px-3 py-3 text-emerald-500">Comp</th>
                                    <th className="px-3 py-3 text-amber-500">Pend</th>
                                    <th className="px-3 py-3 text-rose-500">Ret</th>
                                    <th className="px-4 py-3 text-emerald-600 dark:text-emerald-400">Est. Revenue</th>
                                    <th className="px-4 py-3">Completion %</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border/20 uppercase text-xs">
                                {isLoading ? (
                                    Array(4).fill(0).map((_, i) => <tr key={i}><td colSpan={7} className="px-6 py-4"><Skeleton className="h-4 w-full" /></td></tr>)
                                ) : filteredAndSortedRtoms.length === 0 ? (
                                    <EmptyRow colSpan={7} />
                                ) : (
                                    filteredAndSortedRtoms.map((r, i) => {
                                        const totalReceived = r.completed + r.pending + r.returned;
                                        const rate = totalReceived > 0 ? Math.round((r.completed / totalReceived) * 100) : 0;
                                        const estRevenue = r.revenue || (r.completed * 6500);
                                        return (
                                            <tr key={i} className="hover:bg-card-foreground/[0.03] transition-colors">
                                                <td className="px-4 py-3.5 font-bold text-foreground">{r.name}</td>
                                                <td className="px-3 py-3.5 text-muted-foreground font-mono font-bold">{totalReceived}</td>
                                                <td className="px-3 py-3.5 text-emerald-500 font-bold">{r.completed}</td>
                                                <td className="px-3 py-3.5 text-amber-500 font-bold">{r.pending}</td>
                                                <td className="px-3 py-3.5 text-rose-500 font-bold">{r.returned}</td>
                                                <td className="px-4 py-3.5 font-mono font-extrabold text-emerald-500">Rs. {estRevenue.toLocaleString()}</td>
                                                <td className="px-4 py-3.5">
                                                    <div className="flex items-center gap-2">
                                                        <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden max-w-[55px]">
                                                            <div className="h-full bg-indigo-500 rounded-full transition-all duration-500" style={{ width: `${rate}%` }} />
                                                        </div>
                                                        <span className="text-[10px] font-black text-foreground font-mono">{rate}%</span>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* RTOM PAT Summary table */}
                <div className="glass-panel rounded-3xl border border-border/50 shadow-sm overflow-hidden hover:border-primary/20 transition-all duration-300">
                    <div className="p-5 border-b border-border/40 flex justify-between items-center">
                        <h3 className="font-extrabold text-foreground flex items-center gap-2 text-sm">
                            <span className="w-2 h-4 bg-emerald-500 rounded-full"></span>
                            RTOM PAT Summary
                        </h3>
                        <Link href="/service-orders/pat" className="text-xs text-primary font-bold hover:underline">View All →</Link>
                    </div>
                    <div className="overflow-x-auto max-h-[480px]">
                        <table className="w-full">
                            <thead className="bg-card-foreground/[0.03] sticky top-0 backdrop-blur-md z-10">
                                <tr className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                    <th className="px-6 py-3">RTOM</th>
                                    <th className="px-6 py-3 text-emerald-500">Approved</th>
                                    <th className="px-6 py-3 text-rose-500">Rejected</th>
                                    <th className="px-6 py-3 text-orange-500">SLT Rej</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border/20 uppercase text-xs">
                                {isLoading ? (
                                    Array(4).fill(0).map((_, i) => <tr key={i}><td colSpan={4} className="px-6 py-4"><Skeleton className="h-4 w-full" /></td></tr>)
                                ) : filteredAndSortedRtoms.length === 0 ? (
                                    <EmptyRow colSpan={4} />
                                ) : (
                                    filteredAndSortedRtoms.map((r, i) => (
                                        <tr key={i} className="hover:bg-card-foreground/[0.03] transition-colors">
                                            <td className="px-6 py-3.5 font-bold text-foreground">{r.name}</td>
                                            <td className="px-6 py-3.5 text-emerald-500 font-black">{r.patPassed || 0}</td>
                                            <td className="px-6 py-3.5 text-rose-500 font-black">{r.patRejected || 0}</td>
                                            <td className="px-6 py-3.5 text-orange-500 font-black">{r.sltsPatRejected || 0}</td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </section>
    );
}

export default RTOMTables;

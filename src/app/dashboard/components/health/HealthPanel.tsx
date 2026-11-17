'use client';

import Link from 'next/link';

export const compact = (v: number) => new Intl.NumberFormat('en-LK', { notation: 'compact', maximumFractionDigits: 1 }).format(v);

/** Card frame: a title, an optional link to the module, and the chart or table. No descriptive text. */
export function Panel({ title, href, children, className = '' }: { title: string; href?: string; children: React.ReactNode; className?: string }) {
    return (
        <section className={`rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950 ${className}`}>
            <div className="mb-3 flex items-center justify-between gap-2">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-slate-100">{title}</h3>
                {href && <Link href={href} className="text-[11px] font-bold text-indigo-700 hover:underline dark:text-indigo-300">Open →</Link>}
            </div>
            {children}
        </section>
    );
}

export function Empty({ label = 'No data yet' }: { label?: string }) {
    return <div className="flex h-44 items-center justify-center text-xs font-semibold text-slate-600 dark:text-slate-400">{label}</div>;
}

export function BudgetBar({ used, total }: { used: number; total: number }) {
    if (total <= 0) return <Empty label="No project budgets recorded" />;
    const pct = (used / total) * 100;
    const color = pct > 100 ? 'bg-rose-500' : pct > 85 ? 'bg-amber-500' : 'bg-emerald-500';
    return (
        <div className="space-y-3 py-4">
            <div className="flex items-end justify-between">
                <span className="text-3xl font-black text-slate-900 dark:text-white">{pct.toFixed(1)}%</span>
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">{compact(used)} of {compact(total)}</span>
            </div>
            <div className="h-3 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.min(100, pct)}%` }} />
            </div>
        </div>
    );
}

'use client';

import Link from 'next/link';
import {
    Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, ComposedChart, Legend, Line, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';

const AXIS = '#64748b';
const GRID = 'rgba(148,163,184,0.25)';
const TIP = { background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: 8, color: '#0f172a', fontSize: 12 };

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

export function Sparkline({ data, color = '#6366f1' }: { data: number[]; color?: string }) {
    if (data.length < 2) return null;
    const rows = data.map((v, i) => ({ i, v }));
    return (
        <div className="h-10 w-full">
            <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={rows} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
                    <defs>
                        <linearGradient id={`spark-${color.slice(1)}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={color} stopOpacity={0.35} />
                            <stop offset="100%" stopColor={color} stopOpacity={0} />
                        </linearGradient>
                    </defs>
                    <Area type="monotone" dataKey="v" stroke={color} strokeWidth={2} fill={`url(#spark-${color.slice(1)})`} isAnimationActive={false} />
                </AreaChart>
            </ResponsiveContainer>
        </div>
    );
}

export function FinanceTrend({ data }: { data: { label: string; revenue: number; expense: number; profit: number }[] }) {
    if (!data.some((d) => d.revenue || d.expense)) return <Empty label="No ledger activity in the last 6 months" />;
    return (
        <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                    <CartesianGrid stroke={GRID} vertical={false} />
                    <XAxis dataKey="label" tick={{ fill: AXIS, fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: AXIS, fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={compact} width={48} />
                    <Tooltip contentStyle={TIP} formatter={(v) => compact(Number(v))} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="revenue" name="Revenue" fill="#10b981" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="expense" name="Expense" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                    <Line dataKey="profit" name="Net profit" stroke="#6366f1" strokeWidth={2.5} dot={{ r: 3 }} />
                </ComposedChart>
            </ResponsiveContainer>
        </div>
    );
}

export function CompletedTrend({ data }: { data: { label: string; completed: number }[] }) {
    if (!data.some((d) => d.completed)) return <Empty label="No completed orders in the last 6 months" />;
    return (
        <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                    <defs>
                        <linearGradient id="completed-fill" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#06b6d4" stopOpacity={0.4} />
                            <stop offset="100%" stopColor="#06b6d4" stopOpacity={0.02} />
                        </linearGradient>
                    </defs>
                    <CartesianGrid stroke={GRID} vertical={false} />
                    <XAxis dataKey="label" tick={{ fill: AXIS, fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: AXIS, fontSize: 11 }} axisLine={false} tickLine={false} width={40} />
                    <Tooltip contentStyle={TIP} />
                    <Area type="monotone" dataKey="completed" name="Completed orders" stroke="#06b6d4" strokeWidth={2.5} fill="url(#completed-fill)" />
                </AreaChart>
            </ResponsiveContainer>
        </div>
    );
}

/** Horizontal-free simple column chart used for both ageing views; colours escalate with age. */
export function AgeingBars({ data, format = (v: number) => String(v), empty }: { data: { name: string; value: number }[]; format?: (v: number) => string; empty: string }) {
    if (!data.some((d) => d.value > 0)) return <Empty label={empty} />;
    const colors = ['#10b981', '#84cc16', '#f59e0b', '#f97316', '#ef4444'];
    return (
        <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                    <CartesianGrid stroke={GRID} vertical={false} />
                    <XAxis dataKey="name" tick={{ fill: AXIS, fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: AXIS, fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={format} width={48} />
                    <Tooltip contentStyle={TIP} formatter={(v) => format(Number(v))} />
                    <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                        {data.map((_, i) => <Cell key={i} fill={colors[Math.min(i, colors.length - 1)]} />)}
                    </Bar>
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
}

const HEALTH_COLORS = { onTrack: '#10b981', behind: '#f59e0b', critical: '#ef4444', untracked: '#94a3b8' } as const;
const HEALTH_LABELS = { onTrack: 'On track', behind: 'Behind schedule', critical: 'Late or over budget', untracked: 'Cannot be tracked' } as const;

export function ProjectHealthDonut({ health }: { health: { onTrack: number; behind: number; critical: number; untracked: number } }) {
    const rows = (Object.keys(HEALTH_COLORS) as (keyof typeof HEALTH_COLORS)[]).map((k) => ({ key: k, name: HEALTH_LABELS[k], value: health[k] }));
    const total = rows.reduce((a, r) => a + r.value, 0);
    if (total === 0) return <Empty label="No active projects" />;
    return (
        <div className="flex flex-col items-center gap-3 sm:flex-row">
            <div className="relative h-44 w-44 shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie data={rows.filter((r) => r.value > 0)} dataKey="value" nameKey="name" innerRadius={52} outerRadius={78} paddingAngle={2} stroke="none">
                            {rows.filter((r) => r.value > 0).map((r) => <Cell key={r.key} fill={HEALTH_COLORS[r.key]} />)}
                        </Pie>
                        <Tooltip contentStyle={TIP} />
                    </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-2xl font-black text-slate-900 dark:text-white">{total}</span>
                    <span className="text-[10px] font-bold uppercase text-slate-600 dark:text-slate-400">active</span>
                </div>
            </div>
            <ul className="w-full space-y-1.5 text-xs">
                {rows.map((r) => (
                    <li key={r.key} className="flex items-center justify-between gap-3 text-slate-900 dark:text-slate-100">
                        <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ background: HEALTH_COLORS[r.key] }} />{r.name}</span>
                        <span className="font-black">{r.value}</span>
                    </li>
                ))}
            </ul>
        </div>
    );
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

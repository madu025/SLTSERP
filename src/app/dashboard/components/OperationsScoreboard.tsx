'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Skeleton } from '@/components/ui/skeleton';
import ExportCsvButton from '@/components/ExportCsvButton';
import type { OpsScoreboard, ScoreboardRow } from '@/lib/ops-scoreboard-shared';

interface Props {
    userId: string;
    region?: string;
    rtom?: string;
    enabled?: boolean;
}

type SortKey = 'health' | 'open' | 'over14' | 'slaPct' | 'returnRatePct' | 'daysToClear' | 'delayedProjects';

const tone = (v: number | null, good: number, ok: number) => (v === null ? '' : v >= good ? 'bg-emerald-100 text-emerald-900' : v >= ok ? 'bg-amber-100 text-amber-900' : 'bg-red-100 text-red-900');
const fmt = (v: number | null, suffix = '') => (v === null ? '—' : `${v}${suffix}`);

export default function OperationsScoreboard({ userId, region = 'ALL', rtom = 'ALL', enabled = true }: Props) {
    const [sort, setSort] = useState<SortKey>('health');

    const { data, isLoading, error } = useQuery<OpsScoreboard>({
        queryKey: ['dashboard-ops-scoreboard', userId, region, rtom],
        queryFn: async ({ signal }) => {
            const params = new URLSearchParams({ region, rtom, days: '30' });
            const res = await fetch(`/api/dashboard/ops-scoreboard?${params}`, { signal });
            if (!res.ok) throw new Error(`Scoreboard request failed (${res.status})`);
            // apiHandler wraps the payload as { success, data }
            const json = await res.json();
            return (json.data ?? json) as OpsScoreboard;
        },
        enabled,
        staleTime: 60_000,
        refetchOnWindowFocus: false,
        retry: 1,
    });

    const rows = useMemo(() => {
        const list = [...(data?.rows ?? [])];
        const worstFirst = sort === 'health' || sort === 'slaPct';
        const val = (r: ScoreboardRow) => (r[sort] as number | null);
        return list.sort((a, b) => {
            const av = val(a), bv = val(b);
            if (av === null && bv === null) return 0;
            if (av === null) return 1;
            if (bv === null) return -1;
            return worstFirst ? av - bv : bv - av;
        });
    }, [data, sort]);

    if (isLoading) return <Skeleton className="h-72 rounded-2xl" />;
    if (error || !data) return <div className="rounded-2xl border border-rose-500/40 bg-rose-500/5 p-4 text-sm text-slate-900 dark:text-white">The RTOM scoreboard could not be loaded.</div>;

    const header = (key: SortKey, label: string) => (
        <th className="px-3 py-2 text-right">
            <button onClick={() => setSort(key)} className={`font-bold ${sort === key ? 'underline' : ''}`}>{label}</button>
        </th>
    );

    return (
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                    <h3 className="text-sm font-black uppercase tracking-wider text-slate-900 dark:text-white">RTOM scoreboard · last {data.windowDays} days</h3>
                    <p className="text-xs text-slate-700 dark:text-slate-300">
                        {data.totals.completed.toLocaleString()} completed · {data.totals.slaPct ?? '—'}% within {data.slaDays} days · {data.totals.open.toLocaleString()} open ({data.totals.over14} older than 14 days) · {data.totals.delayedProjects} delayed project(s)
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <ExportCsvButton filename="rtom-scoreboard.csv"
                        getRows={() => [['RTOM', 'Region', 'Health', 'Open', 'Over 14 days', 'Aged %', 'Completed', 'Within SLA %', 'Median days', 'Returned', 'Return %', 'Days to clear', 'Active projects', 'Delayed projects'],
                            ...rows.map((r) => [r.rtom, r.region, r.health, r.open, r.over14, r.agedPct, r.completed, r.slaPct, r.medianDays, r.returned, r.returnRatePct, r.daysToClear, r.activeProjects, r.delayedProjects])]} />
                    <Link href="/service-orders/performance" className="rounded-md bg-indigo-700 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-800">Full performance view</Link>
                </div>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-sm text-slate-900 dark:text-slate-100">
                    <thead>
                        <tr className="border-b border-slate-300 text-left dark:border-slate-700">
                            <th className="px-3 py-2">RTOM</th>
                            {header('health', 'Health')}{header('open', 'Open')}{header('over14', '> 14 d')}{header('slaPct', 'Within SLA')}
                            {header('returnRatePct', 'Returns')}{header('daysToClear', 'Days to clear')}{header('delayedProjects', 'Delayed projects')}
                        </tr>
                    </thead>
                    <tbody>
                        {rows.length === 0 && <tr><td colSpan={8} className="px-3 py-6 text-center text-slate-700 dark:text-slate-300">No RTOM data for the current filter.</td></tr>}
                        {rows.map((r) => (
                            <tr key={r.rtom} className="border-b border-slate-200 dark:border-slate-800">
                                <td className="px-3 py-2 font-semibold">{r.rtom}{r.region && <span className="ml-2 text-xs font-normal text-slate-600 dark:text-slate-400">{r.region}</span>}</td>
                                <td className="px-3 py-2 text-right"><span className={`rounded px-2 py-0.5 font-bold ${tone(r.health, 80, 60)}`}>{fmt(r.health)}</span></td>
                                <td className="px-3 py-2 text-right">{r.open}</td>
                                <td className={`px-3 py-2 text-right ${r.over14 > 0 ? 'font-bold text-red-700 dark:text-red-400' : ''}`}>{r.over14}</td>
                                <td className="px-3 py-2 text-right"><span className={`rounded px-2 py-0.5 font-semibold ${tone(r.slaPct, 90, 70)}`}>{fmt(r.slaPct, '%')}</span></td>
                                <td className="px-3 py-2 text-right">{fmt(r.returnRatePct, '%')}</td>
                                <td className="px-3 py-2 text-right">{r.daysToClear === null ? (r.open > 0 ? 'no output' : '—') : `${r.daysToClear} d`}</td>
                                <td className={`px-3 py-2 text-right ${r.delayedProjects > 0 ? 'font-bold text-red-700 dark:text-red-400' : ''}`}>{r.delayedProjects} / {r.activeProjects}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-slate-700 dark:text-slate-300">{data.notes.map((n) => <li key={n}>{n}</li>)}</ul>
        </section>
    );
}

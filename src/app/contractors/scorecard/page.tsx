"use client";

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import RoleGuard from '@/components/RoleGuard';
import ExportCsvButton from '@/components/ExportCsvButton';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, Trophy, ArrowUp, ArrowDown, Minus } from 'lucide-react';
import { SCORE_WEIGHTS, MIN_ORDERS_FOR_RANKING, type ContractorScorecardReport } from '@/lib/contractor-scorecard-shared';

const scoreTone = (s: number | null) => (s === null ? 'bg-slate-100 text-slate-800' : s >= 80 ? 'bg-emerald-100 text-emerald-900' : s >= 60 ? 'bg-amber-100 text-amber-900' : 'bg-red-100 text-red-900');
const fmt = (v: number | null, suffix = '') => (v === null ? '—' : `${v}${suffix}`);

function Spark({ points }: { points: { month: string; score: number | null }[] }) {
    const vals = points.map((p) => p.score);
    const w = 84, h = 24;
    const step = points.length > 1 ? w / (points.length - 1) : w;
    const coords = vals.map((v, i) => (v === null ? null : [i * step, h - (v / 100) * h] as const));
    const path = coords.filter(Boolean).map((c, i) => `${i === 0 ? 'M' : 'L'}${c![0].toFixed(1)},${c![1].toFixed(1)}`).join(' ');
    return (
        <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} role="img" aria-label="Score trend">
            <path d={path} fill="none" stroke="#4338ca" strokeWidth="2" />
            {coords.map((c, i) => c && <circle key={i} cx={c[0]} cy={c[1]} r="2" fill="#4338ca" />)}
        </svg>
    );
}

export default function ContractorScorecardPage() {
    const thisMonth = new Date().toISOString().slice(0, 7);
    const options = useMemo(() => Array.from({ length: 8 }, (_, i) => {
        const d = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth() - i, 1));
        return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
    }), []);
    const [month, setMonth] = useState(thisMonth);

    const { data, isLoading, error } = useQuery<ContractorScorecardReport>({
        queryKey: ['contractor-scorecard', month],
        queryFn: async ({ signal }) => {
            const res = await fetch(`/api/contractors/scorecard?month=${month}&months=6`, { cache: 'no-store', signal });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error?.message || 'Failed to load the scorecard');
            return json.data;
        },
        staleTime: 60_000,
        refetchOnWindowFocus: false,
    });

    const unassignedPct = data && data.totalCompleted > 0 ? Math.round((data.unassignedCompleted / data.totalCompleted) * 100) : 0;
    const ranked = data?.rows.filter((r) => !r.current.lowVolume) ?? [];

    return (
        <RoleGuard>
            <div className="flex h-screen bg-slate-50 overflow-hidden">
                <Sidebar />
                <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                    <Header />
                    <main className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                                <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
                                    <Trophy className="w-7 h-7 text-indigo-600" />Contractor scorecard
                                </h1>
                                <p className="text-sm text-slate-700 mt-1">Ranked from service-order outcomes: turnaround, PAT quality, returns and output per team-day.</p>
                            </div>
                            <div className="flex items-end gap-3">
                                <label className="text-xs font-semibold text-slate-900">Month
                                    <select value={month} onChange={(e) => setMonth(e.target.value)}
                                        className="mt-1 block rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900">
                                        {options.map((o) => <option key={o} value={o}>{o}</option>)}
                                    </select>
                                </label>
                                <ExportCsvButton filename={`contractor-scorecard-${month}.csv`} disabled={!data}
                                    getRows={() => [['Rank', 'Contractor', 'Score', 'Completed', 'Within SLA %', 'PAT pass %', 'Returns %', 'Per team-day', 'Returned', 'Change vs last month'],
                                        ...(data?.rows ?? []).map((r) => [r.current.lowVolume ? '' : ranked.indexOf(r) + 1, r.name, r.current.score, r.current.completed, r.current.slaPct, r.current.patPassPct, r.current.returnRatePct, r.current.perTeamDay, r.current.returned, r.change])]} />
                            </div>
                        </div>

                        {isLoading && <div className="flex h-40 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /></div>}
                        {error && <p className="text-sm text-red-700">{(error as Error).message}</p>}

                        {data && (
                            <>
                                {unassignedPct > 0 && (
                                    <div className="rounded-xl border border-amber-400 bg-amber-50 p-3 text-sm text-slate-900">
                                        {unassignedPct}% of the {data.totalCompleted.toLocaleString()} orders completed in {data.month} have no contractor recorded, so they are outside every scorecard below.
                                    </div>
                                )}
                                <Card className="shadow-sm"><CardContent className="p-5 overflow-x-auto">
                                    {data.rows.length === 0 ? <p className="text-sm text-slate-900">No contractor-assigned orders were completed in {data.month}.</p> : (
                                        <table className="w-full text-sm">
                                            <thead><tr className="border-b border-slate-300 text-left text-slate-900">
                                                <th className="py-2 pr-3">#</th><th className="py-2 pr-3">Contractor</th><th className="py-2 pr-3 text-right">Score</th>
                                                <th className="py-2 pr-3 text-right">Completed</th><th className="py-2 pr-3 text-right">Within SLA</th><th className="py-2 pr-3 text-right">PAT pass</th>
                                                <th className="py-2 pr-3 text-right">Returns</th><th className="py-2 pr-3 text-right">Per team-day</th><th className="py-2 pr-3 text-right">vs last month</th><th className="py-2">6-month trend</th>
                                            </tr></thead>
                                            <tbody>
                                                {data.rows.map((r) => {
                                                    const rank = r.current.lowVolume ? null : ranked.indexOf(r) + 1;
                                                    return (
                                                        <tr key={r.contractorId} className={`border-b border-slate-200 text-slate-900 ${r.current.lowVolume ? 'opacity-70' : ''}`}>
                                                            <td className="py-2 pr-3">{rank ?? '—'}</td>
                                                            <td className="py-2 pr-3 font-medium">{r.name}{r.current.lowVolume && <span className="ml-2 text-[10px] font-bold uppercase text-slate-700">low volume</span>}</td>
                                                            <td className="py-2 pr-3 text-right"><span className={`rounded px-2 py-0.5 font-bold ${scoreTone(r.current.score)}`}>{fmt(r.current.score)}</span></td>
                                                            <td className="py-2 pr-3 text-right">{r.current.completed}</td>
                                                            <td className="py-2 pr-3 text-right">{fmt(r.current.slaPct, '%')}</td>
                                                            <td className="py-2 pr-3 text-right">{fmt(r.current.patPassPct, '%')}</td>
                                                            <td className="py-2 pr-3 text-right">{fmt(r.current.returnRatePct, '%')}</td>
                                                            <td className="py-2 pr-3 text-right">{fmt(r.current.perTeamDay)}</td>
                                                            <td className="py-2 pr-3 text-right">
                                                                {r.change === null ? <Minus className="ml-auto h-4 w-4 text-slate-500" /> : (
                                                                    <span className={`inline-flex items-center gap-1 font-semibold ${r.change >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                                                                        {r.change >= 0 ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}{Math.abs(r.change)}
                                                                    </span>
                                                                )}
                                                            </td>
                                                            <td className="py-2"><Spark points={r.trend} /></td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    )}
                                </CardContent></Card>

                                <Card className="shadow-sm"><CardContent className="p-5">
                                    <h2 className="mb-2 font-bold text-slate-900">How the score works</h2>
                                    <p className="text-sm text-slate-900">Weights: SLA {SCORE_WEIGHTS.sla}% · PAT quality {SCORE_WEIGHTS.quality}% · returns {SCORE_WEIGHTS.returns}% · productivity {SCORE_WEIGHTS.productivity}%. Contractors under {MIN_ORDERS_FOR_RANKING} completed orders are not ranked.</p>
                                    <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-slate-700">{data.notes.map((n) => <li key={n}>{n}</li>)}</ul>
                                </CardContent></Card>
                            </>
                        )}
                    </main>
                </div>
            </div>
        </RoleGuard>
    );
}

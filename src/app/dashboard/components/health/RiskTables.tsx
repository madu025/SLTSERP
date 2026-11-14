'use client';

import Link from 'next/link';
import type { CompanyHealth } from '@/services/core/company-health.service';
import { Empty } from './HealthCharts';

type Rtom = NonNullable<CompanyHealth['operations']>['weakestRtoms'][number];
type Risk = NonNullable<CompanyHealth['projects']>['atRisk'][number];

const th = 'px-2 py-1.5 text-left text-[10px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-300';
const td = 'px-2 py-2 text-xs text-slate-900 dark:text-slate-100';

function heat(v: number | null, good: number, bad: number, higherIsBetter = true) {
    if (v === null) return 'text-slate-600 dark:text-slate-400';
    const ok = higherIsBetter ? v >= good : v <= good;
    const poor = higherIsBetter ? v < bad : v > bad;
    return ok ? 'text-emerald-700 dark:text-emerald-400 font-black' : poor ? 'text-rose-700 dark:text-rose-400 font-black' : 'text-amber-700 dark:text-amber-400 font-black';
}

export function WeakestRtomsTable({ rows }: { rows: Rtom[] }) {
    if (rows.length === 0) return <Empty label="No RTOM data" />;
    return (
        <div className="overflow-x-auto">
            <table className="w-full">
                <thead><tr className="border-b border-slate-200 bg-slate-100 dark:border-slate-800 dark:bg-slate-900">
                    <th className={th}>RTOM</th><th className={`${th} text-right`}>Open</th><th className={`${th} text-right`}>&gt;14 d</th><th className={`${th} text-right`}>SLA</th><th className={`${th} text-right`}>Health</th>
                </tr></thead>
                <tbody>
                    {rows.map((r) => (
                        <tr key={r.rtom} className="border-b border-slate-100 last:border-0 hover:bg-slate-50 dark:border-slate-900 dark:hover:bg-slate-900">
                            <td className={`${td} font-black`}><Link href="/service-orders/performance" className="hover:underline">{r.rtom}</Link></td>
                            <td className={`${td} text-right`}>{r.open.toLocaleString()}</td>
                            <td className={`${td} text-right ${heat(r.over14, 0, 10, false)}`}>{r.over14.toLocaleString()}</td>
                            <td className={`${td} text-right ${heat(r.slaPct, 90, 75)}`}>{r.slaPct === null ? '—' : `${r.slaPct}%`}</td>
                            <td className={`${td} text-right ${heat(r.health, 80, 60)}`}>{r.health ?? '—'}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

export function AtRiskProjectsTable({ rows }: { rows: Risk[] }) {
    if (rows.length === 0) return <Empty label="No projects flagged" />;
    return (
        <div className="overflow-x-auto">
            <table className="w-full">
                <thead><tr className="border-b border-slate-200 bg-slate-100 dark:border-slate-800 dark:bg-slate-900">
                    <th className={th}>Project</th><th className={`${th} text-right`}>Days late</th><th className={`${th} text-right`}>Over budget</th><th className={`${th} text-right`}>SPI</th>
                </tr></thead>
                <tbody>
                    {rows.map((r) => (
                        <tr key={r.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50 dark:border-slate-900 dark:hover:bg-slate-900">
                            <td className={td}>
                                <Link href={`/projects/${r.id}`} className="font-black hover:underline">{r.name}</Link>
                                <span className="block text-[10px] text-slate-600 dark:text-slate-400">{r.code}</span>
                            </td>
                            <td className={`${td} text-right ${r.daysLate ? 'font-black text-rose-700 dark:text-rose-400' : ''}`}>{r.daysLate ?? '—'}</td>
                            <td className={`${td} text-right ${r.overBudgetPct ? 'font-black text-rose-700 dark:text-rose-400' : ''}`}>{r.overBudgetPct === null ? '—' : `${r.overBudgetPct}%`}</td>
                            <td className={`${td} text-right ${heat(r.spi, 0.95, 0.85)}`}>{r.spi === null ? '—' : r.spi.toFixed(2)}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

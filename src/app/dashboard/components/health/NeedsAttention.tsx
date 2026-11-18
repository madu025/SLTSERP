'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, ArrowRight, CheckCircle2, Clock3, Info, Undo2, X } from 'lucide-react';
import type { HealthException } from '@/services/core/company-health.service';
import { headlineFigure } from './headline-figure';

interface Props {
    exceptions: HealthException[];
    /** already formatted "as of" time */
    asOf: string;
    asOfTitle?: string;
    /** acknowledgements are remembered per person in this browser */
    userId: string;
}

const PRIORITY_CARDS = 3;
const WATCH_ROWS = 6;

const storageKey = (userId: string) => `health-ack:${userId}`;
const readAck = (userId: string): Record<string, string> => {
    try { return JSON.parse(window.localStorage.getItem(storageKey(userId)) || '{}') as Record<string, string>; } catch { return {}; }
};
const writeAck = (userId: string, v: Record<string, string>) => {
    try { window.localStorage.setItem(storageKey(userId), JSON.stringify(v)); } catch { /* storage unavailable: acknowledgement lasts for this visit only */ }
};

const DOT: Record<HealthException['severity'], string> = { critical: 'bg-rose-600', warning: 'bg-amber-500', info: 'bg-slate-500' };

export default function NeedsAttention({ exceptions, asOf, asOfTitle, userId }: Props) {
    const [area, setArea] = useState<'all' | string>('all');
    const [showAll, setShowAll] = useState(false);
    const [showAcked, setShowAcked] = useState(false);
    const [ack, setAck] = useState<Record<string, string>>({});
    useEffect(() => { setAck(readAck(userId)); }, [userId]);

    // An acknowledged item comes back by itself when its sentence changes (the situation changed).
    const isAcked = (e: HealthException) => ack[e.id] === e.detail;
    const acknowledge = (e: HealthException) => { const next = { ...ack, [e.id]: e.detail }; setAck(next); writeAck(userId, next); };
    const restore = (e: HealthException) => { const next = { ...ack }; delete next[e.id]; setAck(next); writeAck(userId, next); };

    const areas = useMemo(() => {
        const counts = new Map<string, number>();
        exceptions.filter((e) => !isAcked(e)).forEach((e) => counts.set(e.area, (counts.get(e.area) ?? 0) + 1));
        return [...counts.entries()].sort((a, b) => b[1] - a[1]);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [exceptions, ack]);

    const open = exceptions.filter((e) => !isAcked(e) && (area === 'all' || e.area === area));
    const acked = exceptions.filter(isAcked);
    const critical = open.filter((e) => e.severity === 'critical');
    const cards = critical.slice(0, PRIORITY_CARDS);
    const cardIds = new Set(cards.map((c) => c.id));
    const watching = open.filter((e) => !cardIds.has(e.id));
    const shownWatching = showAll ? watching : watching.slice(0, WATCH_ROWS);
    const allCritical = exceptions.filter((e) => !isAcked(e) && e.severity === 'critical').length;
    const allOpen = exceptions.filter((e) => !isAcked(e)).length;

    const headline = allCritical > 0
        ? `${allCritical} thing${allCritical === 1 ? '' : 's'} need${allCritical === 1 ? 's' : ''} action today`
        : allOpen > 0 ? 'Nothing urgent' : 'All clear';

    return (
        <section className="space-y-3" aria-label="Needs attention">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="text-lg font-black text-slate-900 dark:text-white">{headline}</h3>
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-700 dark:text-slate-300" title={asOfTitle}>
                    <Clock3 className="h-3.5 w-3.5" />{asOf}{allOpen - allCritical > 0 ? ` · ${allOpen - allCritical} more being watched` : ''}
                </span>
            </div>

            {allOpen === 0 ? (
                <div className="flex items-center gap-2 rounded-2xl border border-emerald-500/40 bg-emerald-50 p-3 text-sm font-semibold text-slate-900 dark:bg-emerald-950/30 dark:text-white">
                    <CheckCircle2 className="h-4 w-4 text-emerald-700 dark:text-emerald-400" />Nothing needs attention right now.
                </div>
            ) : (
                <>
                    <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by area">
                        {[['all', allOpen] as const, ...areas].map(([key, n]) => {
                            const active = area === key;
                            return (
                                <button
                                    key={key}
                                    type="button"
                                    aria-pressed={active}
                                    onClick={() => { setArea(key); setShowAll(false); }}
                                    className={`rounded-full border px-3 py-1 text-xs font-bold transition ${active ? 'border-slate-900 bg-slate-900 text-white dark:border-white dark:bg-white dark:text-slate-900' : 'border-slate-300 bg-white text-slate-900 hover:border-slate-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white'}`}
                                >
                                    {key === 'all' ? 'All' : key} {n}
                                </button>
                            );
                        })}
                    </div>

                    {cards.length > 0 && (
                        <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                            {cards.map((e) => {
                                const figure = headlineFigure(e.detail);
                                return (
                                    <li key={e.id} className="flex flex-col rounded-2xl border border-rose-300 bg-white p-4 shadow-sm dark:border-rose-500/50 dark:bg-slate-950">
                                        <div className="flex items-start justify-between gap-2">
                                            <span className="inline-flex items-center gap-1 text-[11px] font-black uppercase tracking-wider text-rose-800 dark:text-rose-300">
                                                <AlertTriangle className="h-3.5 w-3.5" />{e.area}
                                            </span>
                                            <button type="button" onClick={() => acknowledge(e)} aria-label={`Acknowledge: ${e.title}`} title="Acknowledge (it comes back if it changes)" className="rounded-md p-1 text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800">
                                                <X className="h-4 w-4" />
                                            </button>
                                        </div>
                                        {figure && <p className="mt-1 text-3xl font-black text-slate-900 dark:text-white">{figure}</p>}
                                        <p className="mt-1 text-sm font-black text-slate-900 dark:text-white">{e.title}</p>
                                        <p className="mt-0.5 line-clamp-3 text-xs text-slate-700 dark:text-slate-300" title={e.detail}>{e.detail}</p>
                                        <Link href={e.href} className="mt-3 inline-flex items-center justify-center gap-1 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-bold text-slate-900 hover:bg-slate-50 dark:border-slate-600 dark:text-white dark:hover:bg-slate-900">
                                            Open details <ArrowRight className="h-3.5 w-3.5" />
                                        </Link>
                                    </li>
                                );
                            })}
                        </ul>
                    )}

                    {watching.length > 0 && (
                        <div>
                            <p className="mb-1 text-xs font-bold text-slate-700 dark:text-slate-300">{cards.length > 0 ? 'Being watched' : 'Open items'}</p>
                            <ul className="divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-950">
                                {shownWatching.map((e) => (
                                    <li key={e.id} className="flex items-center gap-2 px-3 py-2 text-xs">
                                        <span className={`h-2 w-2 shrink-0 rounded-full ${DOT[e.severity]}`} aria-label={e.severity} />
                                        <Link href={e.href} className="min-w-0 flex-1 truncate text-slate-900 hover:underline dark:text-white" title={e.detail}>
                                            <span className="font-bold">{e.title}</span><span className="text-slate-700 dark:text-slate-300"> · {e.detail}</span>
                                        </Link>
                                        <span className="hidden shrink-0 text-slate-700 sm:inline dark:text-slate-300">{e.area}</span>
                                        {e.severity === 'info' && <Info className="h-3.5 w-3.5 shrink-0 text-slate-600 dark:text-slate-400" aria-hidden="true" />}
                                        <button type="button" onClick={() => acknowledge(e)} aria-label={`Acknowledge: ${e.title}`} title="Acknowledge (it comes back if it changes)" className="shrink-0 rounded-md p-1 text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800">
                                            <X className="h-3.5 w-3.5" />
                                        </button>
                                    </li>
                                ))}
                            </ul>
                            {watching.length > WATCH_ROWS && (
                                <button type="button" onClick={() => setShowAll((v) => !v)} className="mt-1 text-xs font-bold text-indigo-800 hover:underline dark:text-indigo-300">
                                    {showAll ? 'Show fewer' : `Show all ${watching.length}`}
                                </button>
                            )}
                        </div>
                    )}
                </>
            )}

            {acked.length > 0 && (
                <div>
                    <button type="button" onClick={() => setShowAcked((v) => !v)} className="text-xs font-bold text-slate-800 hover:underline dark:text-slate-200">
                        {showAcked ? 'Hide' : 'Show'} {acked.length} acknowledged
                    </button>
                    {showAcked && (
                        <ul className="mt-1 divide-y divide-slate-200 rounded-xl border border-slate-200 bg-slate-50 dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
                            {acked.map((e) => (
                                <li key={e.id} className="flex items-center gap-2 px-3 py-2 text-xs text-slate-800 dark:text-slate-200">
                                    <span className="min-w-0 flex-1 truncate">{e.title} · {e.detail}</span>
                                    <button type="button" onClick={() => restore(e)} className="inline-flex items-center gap-1 font-bold text-indigo-800 hover:underline dark:text-indigo-300"><Undo2 className="h-3.5 w-3.5" />Undo</button>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            )}
        </section>
    );
}

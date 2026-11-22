"use client";

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { ClipboardCheck, Hourglass, ListChecks, MapPin } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

export interface PatWaiting { total: number; slts: number; opmc: number; ho: number; rejected: number }
export interface MyWorkSummary { stages: Array<{ key: string; label: string; count: number }>; awaitingPat: PatWaiting }

/** Reads what waits for the signed-in person at the SOD approval steps they hold. */
export function useMyWorkSummary(enabled: boolean, rtom = 'ALL') {
    return useQuery<MyWorkSummary>({
        queryKey: ['my-work-summary', rtom],
        enabled,
        staleTime: 30_000,
        retry: false,
        queryFn: async () => {
            const res = await fetch(`/api/service-orders/approvals/summary${rtom !== 'ALL' ? `?rtom=${encodeURIComponent(rtom)}` : ''}`, { cache: 'no-store' });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error?.message || 'Failed to load your work');
            return (json.data ?? json) as MyWorkSummary;
        },
    });
}

export interface AreaOverviewData {
    areas: Array<{ rtom: string; name: string }>;
    month: string; monthNumber: number; year: number; rtom: string;
    totals: { inHand: number; completedThisMonth: number; returnedThisMonth: number };
    returnReasons: Array<{ category: string; label: string; count: number; pct: number }>;
    slaDays: number;
    contractors: Array<{ contractorId: string; name: string; inHand: number; oldestInHandDays: number | null; completedThisMonth: number; returnedThisMonth: number; slaPct: number | null; returnRatePct: number | null; topReturnReason: string | null }>;
}

/** The person's own RTOMs: orders with contractors and each contractor's progress. */
export interface WorkFilters { month: number; year: number; rtom: string }

export function useAreaOverview(enabled: boolean, f: WorkFilters) {
    return useQuery<AreaOverviewData>({
        queryKey: ['area-overview', f.month, f.year, f.rtom],
        enabled,
        staleTime: 60_000,
        retry: false,
        queryFn: async () => {
            const res = await fetch(`/api/service-orders/area-overview?month=${f.month}&year=${f.year}${f.rtom !== 'ALL' ? `&rtom=${encodeURIComponent(f.rtom)}` : ''}`, { cache: 'no-store' });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error?.message || 'Failed to load your area');
            return (json.data ?? json) as AreaOverviewData;
        },
    });
}

const th = 'py-2 pr-3 text-left text-xs font-bold uppercase tracking-wide text-slate-900 dark:text-white';

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const selectCls = 'h-9 rounded-md border border-slate-400 bg-white px-2 text-sm font-semibold text-slate-900';

/** Month, year and RTOM of the figures: one bar for the whole work tab (an Engineer or Area Manager with several RTOMs picks one or all of them here). */
export function WorkFilterBar({ areas, filters, onFilters }: { areas: Array<{ rtom: string; name: string }>; filters: WorkFilters; onFilters: (f: WorkFilters) => void }) {
    const thisYear = new Date().getFullYear();
    return (
        <div className="flex flex-wrap items-center gap-2 px-1" role="group" aria-label="Show figures for">
            <span className="text-sm font-bold text-slate-900 dark:text-white">Show:</span>
            <select aria-label="Month" value={filters.month} onChange={(e) => onFilters({ ...filters, month: Number(e.target.value) })} className={selectCls}>
                {MONTH_NAMES.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
            </select>
            <select aria-label="Year" value={filters.year} onChange={(e) => onFilters({ ...filters, year: Number(e.target.value) })} className={selectCls}>
                {[thisYear - 1, thisYear].map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
            {areas.length > 1 && (
                <select aria-label="RTOM" value={filters.rtom} onChange={(e) => onFilters({ ...filters, rtom: e.target.value })} className={selectCls}>
                    <option value="ALL">All my RTOMs</option>
                    {areas.map((a) => <option key={a.rtom} value={a.rtom}>{a.rtom}</option>)}
                </select>
            )}
        </div>
    );
}

function AreaProgress({ data, isLoading, filters, onFilters, hideFilters }: { data?: AreaOverviewData; isLoading: boolean; filters: WorkFilters; onFilters: (f: WorkFilters) => void; hideFilters?: boolean }) {
    const filterBar = hideFilters ? null : <WorkFilterBar areas={data?.areas ?? []} filters={filters} onFilters={onFilters} />;
    if (isLoading && !data) return <div className="space-y-4">{filterBar}<Skeleton className="h-64 rounded-2xl" /></div>;
    if (!data) return null;
    return (
        <div className="space-y-4">
            {filterBar}
            <div className="flex flex-wrap items-center gap-2 px-1 text-sm text-slate-900 dark:text-white">
                <MapPin className="h-5 w-5 text-indigo-700 dark:text-indigo-300" />
                <span className="font-bold">Your RTOMs:</span>
                {data.areas.length === 0 ? <span>none assigned to you</span> : data.areas.map((a) => <span key={a.rtom} className="rounded-full border border-slate-400 bg-white px-3 py-0.5 text-xs font-bold text-slate-900">{a.rtom}</span>)}
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                {[
                    { label: 'With contractors now', value: data.totals.inHand, hint: 'Assigned, in progress or waiting to close', href: '/service-orders/work-order' },
                    { label: `Completed in ${data.month}`, value: data.totals.completedThisMonth, hint: 'Finished by the contractors of your RTOMs in this month', href: '/service-orders/work-order/completed' },
                    { label: `Returned in ${data.month}`, value: data.totals.returnedThisMonth, hint: 'Contractor orders cancelled or returned in this month', href: '/service-orders/work-order/return' },
                ].map((c) => (
                    <Link key={c.label} href={c.href} className="rounded-2xl border border-slate-300 bg-white p-4 shadow-sm hover:border-indigo-600 dark:border-slate-700 dark:bg-slate-900">
                        <div className="text-xs font-bold uppercase tracking-wide text-slate-900 dark:text-white">{c.label}</div>
                        <div className="mt-2 text-3xl font-black text-slate-900 dark:text-white">{c.value}</div>
                        <p className="mt-1 text-xs text-slate-800 dark:text-slate-200">{c.hint}</p>
                    </Link>
                ))}
            </div>
            <div className="rounded-2xl border border-slate-300 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h3 className="text-sm font-black text-slate-900 dark:text-white">Why orders were returned in {data.month}</h3>
                    <Link href="/service-orders/work-order/return" className="text-sm font-bold text-indigo-800 dark:text-indigo-300">Open Return SOD</Link>
                </div>
                {data.returnReasons.length === 0 ? <p className="mt-2 text-sm text-slate-900 dark:text-white">No orders were returned in this month.</p> : (
                    <ul className="mt-3 space-y-2">
                        {data.returnReasons.map((r) => (
                            <li key={r.category} className="text-sm text-slate-900 dark:text-white">
                                <div className="flex justify-between font-semibold"><span>{r.label}</span><span>{r.count} ({r.pct}%)</span></div>
                                <div className="mt-1 h-2 rounded bg-slate-200"><div className="h-2 rounded bg-rose-700" style={{ width: `${Math.max(3, r.pct)}%` }} /></div>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
            <div className="rounded-2xl border border-slate-300 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
                <h3 className="text-sm font-black text-slate-900 dark:text-white">Contractor progress in your RTOMs</h3>
                {data.contractors.length === 0 ? <p className="mt-2 text-sm text-slate-900 dark:text-white">No service orders with contractors in your RTOMs.</p> : (
                    <div className="mt-2 overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead><tr className="border-b border-slate-300">
                                <th className={th}>Contractor</th><th className={th}>In hand now</th><th className={th}>Oldest in hand</th><th className={th}>Completed in {data.month}</th><th className={th}>Within {data.slaDays} days</th><th className={th}>Returned in {data.month}</th><th className={th}>Return rate</th><th className={th}>Main return reason</th>
                            </tr></thead>
                            <tbody>
                                {data.contractors.map((c) => (
                                    <tr key={c.contractorId} className="border-b border-slate-200 text-slate-900 dark:text-white">
                                        <td className="py-2 pr-3 font-semibold">{c.name}</td>
                                        <td className="py-2 pr-3">{c.inHand}</td>
                                        <td className="py-2 pr-3 whitespace-nowrap">{c.oldestInHandDays === null ? '-' : `${c.oldestInHandDays} day${c.oldestInHandDays === 1 ? '' : 's'}`}</td>
                                        <td className="py-2 pr-3">{c.completedThisMonth}</td>
                                        <td className="py-2 pr-3 whitespace-nowrap">{c.slaPct === null ? '-' : `${c.slaPct}%`}</td>
                                        <td className="py-2 pr-3">{c.returnedThisMonth}</td>
                                        <td className={`py-2 pr-3 whitespace-nowrap ${c.returnRatePct !== null && c.returnRatePct >= 10 ? 'font-bold text-red-800' : ''}`}>{c.returnRatePct === null ? '-' : `${c.returnRatePct}%`}</td>
                                        <td className="py-2 pr-3">{c.topReturnReason ?? '-'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}

export default function MyWorkSection({ summary, isLoading, area, areaLoading, filters, onFilters, hideFilters }: { summary?: MyWorkSummary; isLoading: boolean; area?: AreaOverviewData; areaLoading?: boolean; filters: WorkFilters; onFilters: (f: WorkFilters) => void; hideFilters?: boolean }) {
    if (isLoading) return <div className="grid grid-cols-1 gap-4 md:grid-cols-3">{Array(3).fill(0).map((_, i) => <Skeleton key={i} className="h-32 rounded-2xl" />)}</div>;
    const stages = summary?.stages ?? [];
    const waiting = stages.reduce((a, s) => a + s.count, 0);
    return (
        <div className="space-y-5">
            <div className="flex items-baseline gap-2 px-1">
                <h2 className="text-base font-black text-slate-900 dark:text-white">Your service order work</h2>
                <span className="text-[10px] font-black uppercase tracking-[0.18em] text-indigo-700 dark:text-indigo-300">Waiting for you</span>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                {stages.map((s) => (
                    <Link key={s.key} href="/service-orders/work-order/completed?check=waiting" className="rounded-2xl border border-slate-300 bg-white p-5 shadow-sm hover:border-indigo-600 dark:border-slate-700 dark:bg-slate-900">
                        <div className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white"><ClipboardCheck className="h-5 w-5 text-indigo-700 dark:text-indigo-300" />Waiting at the {s.label} step</div>
                        <div className="mt-3 text-4xl font-black text-slate-900 dark:text-white">{s.count}</div>
                        <p className="mt-1 text-sm text-slate-800 dark:text-slate-200">{s.count === 0 ? 'Nothing is waiting for you.' : 'Completed orders of your area to check: connection, material and photos. Open Completed SOD.'}</p>
                    </Link>
                ))}
                <Link href="/service-orders/work-order/pat" className="rounded-2xl border border-amber-400 bg-amber-50 p-5 shadow-sm hover:border-amber-600">
                    <div className="flex items-center gap-2 text-sm font-bold text-slate-900"><Hourglass className="h-5 w-5 text-amber-800" />Waiting for their PAT</div>
                    <div className="mt-3 text-4xl font-black text-slate-900">{summary?.awaitingPat.total ?? 0}</div>
                    <p className="mt-1 text-sm text-slate-900">Completed orders{area && area.areas.length > 0 ? ` of ${area.areas.map((a) => a.rtom).join(', ')}` : ''} that join your list once their SLTS, OPMC and HO PAT approvals have passed.</p>
                    <ul className="mt-2 space-y-0.5 text-sm font-semibold text-slate-900">
                        <li>Waiting for the SLTS PAT: {summary?.awaitingPat.slts ?? 0}</li>
                        <li>Waiting for the OPMC PAT: {summary?.awaitingPat.opmc ?? 0}</li>
                        <li>Waiting for the HO PAT: {summary?.awaitingPat.ho ?? 0}</li>
                        <li>PAT rejected: {summary?.awaitingPat.rejected ?? 0}</li>
                    </ul>
                </Link>
                <Link href="/service-orders/work-order" className="rounded-2xl border border-slate-300 bg-white p-5 shadow-sm hover:border-indigo-600 dark:border-slate-700 dark:bg-slate-900">
                    <div className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white"><ListChecks className="h-5 w-5 text-indigo-700 dark:text-indigo-300" />Pending service orders</div>
                    <p className="mt-3 text-sm text-slate-800 dark:text-slate-200">Assign contractors and complete the orders of your area.</p>
                    <div className="mt-3 text-sm font-bold text-indigo-800 dark:text-indigo-300">Open Pending SOD</div>
                </Link>
            </div>
            <AreaProgress data={area} isLoading={!!areaLoading} filters={filters} onFilters={onFilters} hideFilters={hideFilters} />
            {waiting === 0 && stages.length > 0 && <p className="px-1 text-sm text-slate-800 dark:text-slate-200">You have no orders to pass right now.</p>}
        </div>
    );
}

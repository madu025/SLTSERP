"use client";

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { ClipboardCheck, Hourglass, ListChecks, MapPin } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

export interface MyWorkSummary { stages: Array<{ key: string; label: string; count: number }>; awaitingPat: number }

/** Reads what waits for the signed-in person at the SOD approval steps they hold. */
export function useMyWorkSummary(enabled: boolean) {
    return useQuery<MyWorkSummary>({
        queryKey: ['my-work-summary'],
        enabled,
        staleTime: 30_000,
        retry: false,
        queryFn: async () => {
            const res = await fetch('/api/service-orders/approvals/summary', { cache: 'no-store' });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error?.message || 'Failed to load your work');
            return (json.data ?? json) as MyWorkSummary;
        },
    });
}

export interface AreaOverviewData {
    areas: Array<{ rtom: string; name: string }>;
    month: string;
    totals: { notAssigned: number; inHand: number; completedThisMonth: number; returnedThisMonth: number };
    contractors: Array<{ contractorId: string | null; name: string; inHand: number; oldestInHandDays: number | null; completedThisMonth: number; returnedThisMonth: number }>;
}

/** The person's own RTOMs: orders with contractors and each contractor's progress. */
export function useAreaOverview(enabled: boolean) {
    return useQuery<AreaOverviewData>({
        queryKey: ['area-overview'],
        enabled,
        staleTime: 60_000,
        retry: false,
        queryFn: async () => {
            const res = await fetch('/api/service-orders/area-overview', { cache: 'no-store' });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error?.message || 'Failed to load your area');
            return (json.data ?? json) as AreaOverviewData;
        },
    });
}

const th = 'py-2 pr-3 text-left text-xs font-bold uppercase tracking-wide text-slate-900 dark:text-white';

function AreaProgress({ data, isLoading }: { data?: AreaOverviewData; isLoading: boolean }) {
    if (isLoading) return <Skeleton className="h-64 rounded-2xl" />;
    if (!data) return null;
    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2 px-1 text-sm text-slate-900 dark:text-white">
                <MapPin className="h-5 w-5 text-indigo-700 dark:text-indigo-300" />
                <span className="font-bold">Your RTOMs:</span>
                {data.areas.length === 0 ? <span>none assigned to you</span> : data.areas.map((a) => <span key={a.rtom} className="rounded-full border border-slate-400 bg-white px-3 py-0.5 text-xs font-bold text-slate-900">{a.rtom}</span>)}
            </div>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                {[
                    { label: 'With contractors now', value: data.totals.inHand, hint: 'Assigned, in progress or waiting to close' },
                    { label: 'Not given to a contractor', value: data.totals.notAssigned, hint: 'Open orders with no contractor yet' },
                    { label: `Completed in ${data.month}`, value: data.totals.completedThisMonth, hint: 'Finished by contractors this month' },
                    { label: `Returned in ${data.month}`, value: data.totals.returnedThisMonth, hint: 'Cancelled or returned this month' },
                ].map((c) => (
                    <div key={c.label} className="rounded-2xl border border-slate-300 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
                        <div className="text-xs font-bold uppercase tracking-wide text-slate-900 dark:text-white">{c.label}</div>
                        <div className="mt-2 text-3xl font-black text-slate-900 dark:text-white">{c.value}</div>
                        <p className="mt-1 text-xs text-slate-800 dark:text-slate-200">{c.hint}</p>
                    </div>
                ))}
            </div>
            <div className="rounded-2xl border border-slate-300 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
                <h3 className="text-sm font-black text-slate-900 dark:text-white">Contractor progress in your RTOMs</h3>
                {data.contractors.length === 0 ? <p className="mt-2 text-sm text-slate-900 dark:text-white">No service orders with contractors in your RTOMs.</p> : (
                    <div className="mt-2 overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead><tr className="border-b border-slate-300">
                                <th className={th}>Contractor</th><th className={th}>In hand now</th><th className={th}>Oldest in hand</th><th className={th}>Completed this month</th><th className={th}>Returned this month</th>
                            </tr></thead>
                            <tbody>
                                {data.contractors.map((c) => (
                                    <tr key={c.contractorId ?? 'none'} className="border-b border-slate-200 text-slate-900 dark:text-white">
                                        <td className="py-2 pr-3 font-semibold">{c.name}</td>
                                        <td className="py-2 pr-3">{c.inHand}</td>
                                        <td className="py-2 pr-3 whitespace-nowrap">{c.oldestInHandDays === null ? '-' : `${c.oldestInHandDays} day${c.oldestInHandDays === 1 ? '' : 's'}`}</td>
                                        <td className="py-2 pr-3">{c.completedThisMonth}</td>
                                        <td className="py-2 pr-3">{c.returnedThisMonth}</td>
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

export default function MyWorkSection({ summary, isLoading, area, areaLoading }: { summary?: MyWorkSummary; isLoading: boolean; area?: AreaOverviewData; areaLoading?: boolean }) {
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
                    <Link key={s.key} href="/service-orders/approvals" className="rounded-2xl border border-slate-300 bg-white p-5 shadow-sm hover:border-indigo-600 dark:border-slate-700 dark:bg-slate-900">
                        <div className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white"><ClipboardCheck className="h-5 w-5 text-indigo-700 dark:text-indigo-300" />Waiting at the {s.label} step</div>
                        <div className="mt-3 text-4xl font-black text-slate-900 dark:text-white">{s.count}</div>
                        <p className="mt-1 text-sm text-slate-800 dark:text-slate-200">{s.count === 0 ? 'Nothing is waiting for you.' : 'Completed orders of your area, ready for you to pass. Open SOD Approvals.'}</p>
                    </Link>
                ))}
                <Link href="/service-orders/approvals" className="rounded-2xl border border-amber-400 bg-amber-50 p-5 shadow-sm hover:border-amber-600">
                    <div className="flex items-center gap-2 text-sm font-bold text-slate-900"><Hourglass className="h-5 w-5 text-amber-800" />Waiting for their PAT</div>
                    <div className="mt-3 text-4xl font-black text-slate-900">{summary?.awaitingPat ?? 0}</div>
                    <p className="mt-1 text-sm text-slate-900">Completed orders that join your list once their SLTS, OPMC and HO PAT approvals have passed.</p>
                </Link>
                <Link href="/service-orders/work-order" className="rounded-2xl border border-slate-300 bg-white p-5 shadow-sm hover:border-indigo-600 dark:border-slate-700 dark:bg-slate-900">
                    <div className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white"><ListChecks className="h-5 w-5 text-indigo-700 dark:text-indigo-300" />Pending service orders</div>
                    <p className="mt-3 text-sm text-slate-800 dark:text-slate-200">Assign contractors and complete the orders of your area.</p>
                    <div className="mt-3 text-sm font-bold text-indigo-800 dark:text-indigo-300">Open Pending SOD</div>
                </Link>
            </div>
            <AreaProgress data={area} isLoading={!!areaLoading} />
            {waiting === 0 && stages.length > 0 && <p className="px-1 text-sm text-slate-800 dark:text-slate-200">You have no orders to pass right now.</p>}
        </div>
    );
}

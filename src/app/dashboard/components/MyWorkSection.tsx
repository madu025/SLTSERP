"use client";

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { ClipboardCheck, Hourglass, ListChecks } from 'lucide-react';
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

export default function MyWorkSection({ summary, isLoading }: { summary?: MyWorkSummary; isLoading: boolean }) {
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
            {waiting === 0 && stages.length > 0 && <p className="px-1 text-sm text-slate-800 dark:text-slate-200">You have no orders to pass right now.</p>}
        </div>
    );
}

"use client";

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { MapPin } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { DashFigure, DashHeading, RouteStrip } from './dash-ui';

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


const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const selectCls = 'dash-select';

/** Month, year and RTOM of the figures: one bar for the whole work tab (an Engineer or Area Manager with several RTOMs picks one or all of them here). */
export function WorkFilterBar({ areas, filters, onFilters }: { areas: Array<{ rtom: string; name: string }>; filters: WorkFilters; onFilters: (f: WorkFilters) => void }) {
    const thisYear = new Date().getFullYear();
    return (
        <div className="flex flex-wrap items-center gap-2 px-1" role="group" aria-label="Show figures for">
            <span className="text-sm font-semibold">Show figures for</span>
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
    if (isLoading && !data) return <div className="space-y-4">{filterBar}<Skeleton className="h-64 rounded-[10px]" /></div>;
    if (!data) return null;
    return (
        <div className="space-y-4">
            {filterBar}
            <div className="flex flex-wrap items-center gap-2 px-1 text-sm">
                <MapPin className="h-5 w-5" style={{ color: 'var(--dash-route)' }} aria-hidden="true" />
                <span className="font-semibold">Your RTOMs:</span>
                {data.areas.length === 0 ? <span>none assigned to you</span> : data.areas.map((a) => <span key={a.rtom} className="dash-chip">{a.rtom}</span>)}
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <DashFigure label="With contractors now" value={data.totals.inHand} hint="Assigned, in progress or waiting to close" href="/service-orders/work-order" />
                <DashFigure label={`Completed in ${data.month}`} value={data.totals.completedThisMonth} hint="Finished by the contractors of your RTOMs in this month" href="/service-orders/work-order/completed" tone="pass" />
                <DashFigure label={`Returned in ${data.month}`} value={data.totals.returnedThisMonth} hint="Contractor orders cancelled or returned in this month" href="/service-orders/work-order/return" tone={data.totals.returnedThisMonth > 0 ? 'wait' : 'neutral'} />
            </div>
            <div className="dash-panel">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h3>Why orders were returned in {data.month}</h3>
                    <Link href="/service-orders/work-order/return" className="dash-link">Open Return SOD</Link>
                </div>
                {data.returnReasons.length === 0 ? <p className="mt-2 text-sm">No orders were returned in this month.</p> : (
                    <ul className="mt-3 space-y-2">
                        {data.returnReasons.map((r) => (
                            <li key={r.category} className="text-sm">
                                <div className="flex justify-between font-semibold"><span>{r.label}</span><span>{r.count} ({r.pct}%)</span></div>
                                <div className="dash-bar" data-tone="fault"><span style={{ width: `${Math.max(3, r.pct)}%` }} /></div>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
            <div className="dash-panel">
                <h3>Contractor progress in your RTOMs</h3>
                {data.contractors.length === 0 ? <p className="mt-2 text-sm">No service orders with contractors in your RTOMs.</p> : (
                    <div className="mt-2 overflow-x-auto">
                        <table className="dash-table">
                            <thead><tr>
                                <th>Contractor</th><th>In hand now</th><th>Oldest in hand</th><th>Completed in {data.month}</th><th>Within {data.slaDays} days</th><th>Returned in {data.month}</th><th>Return rate</th><th>Main return reason</th>
                            </tr></thead>
                            <tbody>
                                {data.contractors.map((c) => (
                                    <tr key={c.contractorId}>
                                        <td className="font-semibold">{c.name}</td>
                                        <td>{c.inHand}</td>
                                        <td className="whitespace-nowrap">{c.oldestInHandDays === null ? '-' : `${c.oldestInHandDays} day${c.oldestInHandDays === 1 ? '' : 's'}`}</td>
                                        <td>{c.completedThisMonth}</td>
                                        <td className="whitespace-nowrap">{c.slaPct === null ? '-' : `${c.slaPct}%`}</td>
                                        <td>{c.returnedThisMonth}</td>
                                        <td className={`whitespace-nowrap ${c.returnRatePct !== null && c.returnRatePct >= 10 ? 'is-fault' : ''}`}>{c.returnRatePct === null ? '-' : `${c.returnRatePct}%`}</td>
                                        <td>{c.topReturnReason ?? '-'}</td>
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
    if (isLoading) return <Skeleton className="h-48 rounded-[10px]" />;
    const stages = summary?.stages ?? [];
    const pat = summary?.awaitingPat;
    const rtoms = area && area.areas.length > 0 ? ` of ${area.areas.map((a) => a.rtom).join(', ')}` : '';
    return (
        <div className="space-y-5">
            <DashHeading title="Your service order work" note="Completed orders reach your step once all their PAT approvals have passed." />
            <RouteStrip
                title="Completed orders on their way to you"
                note={<Link href="/service-orders/work-order" className="dash-link">Open Pending SOD to assign contractors</Link>}
                stations={[
                    {
                        label: 'Waiting for their PAT', value: pat?.total ?? 0, href: '/service-orders/work-order/pat', waiting: true,
                        hint: `Completed orders${rtoms}: SLTS ${pat?.slts ?? 0}, OPMC ${pat?.opmc ?? 0}, HO ${pat?.ho ?? 0}`,
                    },
                    ...stages.map((s) => ({
                        label: `Waiting at the ${s.label} step`, value: s.count, href: '/service-orders/work-order/completed?check=waiting', waiting: true,
                        hint: s.count === 0 ? 'Nothing is waiting for you.' : 'Check the connection, material and photos in Completed SOD.',
                    })),
                ]}
            />
            {(pat?.rejected ?? 0) > 0 && (
                <div className="dash-alert" role="status">
                    <span><strong>{pat?.rejected}</strong> completed order{pat?.rejected === 1 ? ' is' : 's are'} PAT rejected and need{pat?.rejected === 1 ? 's' : ''} a correction.</span>
                    <Link href="/service-orders/work-order/pat" className="dash-link">Open PAT Status Monitor</Link>
                </div>
            )}
            <AreaProgress data={area} isLoading={!!areaLoading} filters={filters} onFilters={onFilters} hideFilters={hideFilters} />
        </div>
    );
}

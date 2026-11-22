"use client";

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Users } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import type { WorkFilters } from './MyWorkSection';

interface Counts { waitingPat: number; noContractor: number; waitingCheck: number; waitingContractor: number; readyToInvoice: number; held: number; invoicedThisMonth: number; invoicesInApproval: number; returnedToCheck: number; oldestWaitingCheckDays: number | null }
interface Area extends Counts { rtom: string; name: string; team: Array<{ id: string; name: string; role: string }>; progressPct: number | null }
interface Person { id: string; name: string; role: string; rtoms: string[]; checkedThisMonth: number; waitingNow: number; returnedNow: number }
export interface PipelineData { month: string; monthNumber: number; year: number; rtom: string; areas: Area[]; people: Person[]; totals: Counts }

export function useAreaPipeline(enabled: boolean, f: WorkFilters) {
    return useQuery<PipelineData>({
        queryKey: ['area-pipeline', f.month, f.year, f.rtom],
        enabled,
        staleTime: 60_000,
        retry: false,
        queryFn: async () => {
            const res = await fetch(`/api/service-orders/area-pipeline?month=${f.month}&year=${f.year}${f.rtom !== 'ALL' ? `&rtom=${encodeURIComponent(f.rtom)}` : ''}`, { cache: 'no-store' });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error?.message || 'Failed to load the pipeline');
            return (json.data ?? json) as PipelineData;
        },
    });
}

const th = 'py-2 pr-3 text-left text-xs font-bold uppercase tracking-wide text-slate-900';
const ROLE: Record<string, string> = { AREA_COORDINATOR: 'Area Coordinator', QC_OFFICER: 'QC Officer' };
const card = 'rounded-2xl border border-slate-300 bg-white p-4 shadow-sm';

/** The engineer's month-end pipeline: where the finished orders of each RTOM stand, who works in it, and what each of them has done this month. */
export default function EngineerPipelineSection({ data, isLoading }: { data?: PipelineData; isLoading: boolean }) {
    if (isLoading && !data) return <Skeleton className="h-64 rounded-2xl" />;
    if (!data || data.areas.length === 0) return <p className="px-1 text-sm text-slate-900 dark:text-white">No RTOMs are assigned to you.</p>;
    const t = data.totals;
    const stages: Array<{ label: string; value: number; hint: string; href: string; tone: string }> = [
        { label: 'Waiting for PAT', value: t.waitingPat, hint: 'Finished, PAT not yet passed', href: '/service-orders/work-order/pat', tone: 'text-amber-900' },
        { label: 'Waiting for the check', value: t.waitingCheck, hint: 'Coordinator / QC to check', href: '/service-orders/work-order/completed?check=waiting', tone: 'text-indigo-900' },
        { label: 'Waiting for the contractor', value: t.waitingContractor, hint: 'Checked, contractor to verify', href: '/service-orders/work-order/completed?check=ready', tone: 'text-sky-900' },
        { label: 'Ready to invoice', value: t.readyToInvoice, hint: 'Verified: yours to invoice', href: '/service-orders/invoicing', tone: 'text-emerald-900' },
        { label: `Invoiced in ${data.month}`, value: t.invoicedThisMonth, hint: `${t.invoicesInApproval} invoice${t.invoicesInApproval === 1 ? '' : 's'} in approval`, href: '/service-orders/invoicing', tone: 'text-slate-900' },
    ];
    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-baseline gap-2 px-1">
                <h2 className="text-base font-black text-slate-900 dark:text-white">Month-end pipeline of your RTOMs</h2>
                <span className="text-[10px] font-black uppercase tracking-[0.18em] text-indigo-700 dark:text-indigo-300">Check, contractor, invoice</span>
            </div>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
                {stages.map((s) => (
                    <Link key={s.label} href={s.href} className={`${card} hover:border-indigo-600`}>
                        <div className="text-xs font-bold uppercase tracking-wide text-slate-900">{s.label}</div>
                        <div className={`mt-2 text-3xl font-black ${s.tone}`}>{s.value}</div>
                        <p className="mt-1 text-xs text-slate-800">{s.hint}</p>
                    </Link>
                ))}
            </div>
            {(t.noContractor > 0 || t.held > 0 || t.returnedToCheck > 0) && (
                <div className="flex flex-wrap gap-2 px-1 text-sm font-semibold text-slate-900 dark:text-white">
                    {t.noContractor > 0 && <Link href="/service-orders/work-order/completed?check=nocontractor" className="rounded-full border border-red-500 bg-red-50 px-3 py-0.5 text-red-900">{t.noContractor} finished without a contractor</Link>}
                    {t.returnedToCheck > 0 && <span className="rounded-full border border-red-400 bg-red-50 px-3 py-0.5 text-red-900">{t.returnedToCheck} sent back to the check</span>}
                    {t.held > 0 && <span className="rounded-full border border-amber-500 bg-amber-50 px-3 py-0.5 text-amber-950">{t.held} held back</span>}
                </div>
            )}
            <div className={card}>
                <h3 className="text-sm font-black text-slate-900">Progress by RTOM</h3>
                <p className="text-xs text-slate-800">Progress = orders past the check and the contractor, out of all finished orders still to be invoiced.</p>
                <div className="mt-2 overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead><tr className="border-b border-slate-300">
                            <th className={th}>RTOM</th><th className={th}>Team</th><th className={th}>PAT</th><th className={th}>Check</th><th className={th}>Contractor</th><th className={th}>Ready</th><th className={th}>Oldest in check</th><th className={th}>Progress</th>
                        </tr></thead>
                        <tbody>
                            {data.areas.map((a) => (
                                <tr key={a.rtom} className="border-b border-slate-200 align-top text-slate-900">
                                    <td className="py-2 pr-3 font-bold whitespace-nowrap">{a.rtom}</td>
                                    <td className="py-2 pr-3 text-xs">{a.team.length === 0 ? <span className="font-bold text-red-800">Nobody assigned</span> : a.team.map((p) => <div key={p.id}>{p.name} <span className="text-slate-700">({ROLE[p.role] ?? p.role})</span></div>)}</td>
                                    <td className="py-2 pr-3">{a.waitingPat}</td>
                                    <td className="py-2 pr-3 font-semibold">{a.waitingCheck}{a.returnedToCheck > 0 && <span className="ml-1 text-xs font-bold text-red-800">({a.returnedToCheck} returned)</span>}</td>
                                    <td className="py-2 pr-3">{a.waitingContractor}</td>
                                    <td className="py-2 pr-3 font-semibold text-emerald-900">{a.readyToInvoice}</td>
                                    <td className={`py-2 pr-3 whitespace-nowrap ${a.oldestWaitingCheckDays !== null && a.oldestWaitingCheckDays > 7 ? 'font-bold text-red-800' : ''}`}>{a.oldestWaitingCheckDays === null ? '-' : `${a.oldestWaitingCheckDays} days`}</td>
                                    <td className="py-2 pr-3 min-w-[8rem]">
                                        {a.progressPct === null ? '-' : (
                                            <div><div className="text-xs font-bold">{a.progressPct}%</div><div className="mt-1 h-2 rounded bg-slate-200"><div className="h-2 rounded bg-emerald-700" style={{ width: `${Math.max(3, a.progressPct)}%` }} /></div></div>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
            <div className={card}>
                <h3 className="flex items-center gap-2 text-sm font-black text-slate-900"><Users className="h-4 w-4 text-indigo-700" />Area Coordinators and QC Officers</h3>
                {data.people.length === 0 ? <p className="mt-2 text-sm text-slate-900">Nobody holds these roles in your RTOMs.</p> : (
                    <div className="mt-2 overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead><tr className="border-b border-slate-300"><th className={th}>Name</th><th className={th}>Role</th><th className={th}>RTOMs</th><th className={th}>Checked in {data.month}</th><th className={th}>Waiting now</th><th className={th}>Sent back</th></tr></thead>
                            <tbody>
                                {data.people.map((p) => (
                                    <tr key={p.id} className="border-b border-slate-200 text-slate-900">
                                        <td className="py-2 pr-3 font-semibold">{p.name}</td>
                                        <td className="py-2 pr-3">{ROLE[p.role] ?? p.role}</td>
                                        <td className="py-2 pr-3 text-xs">{p.rtoms.join(', ')}</td>
                                        <td className="py-2 pr-3 font-semibold">{p.checkedThisMonth}</td>
                                        <td className="py-2 pr-3">{p.waitingNow}</td>
                                        <td className={`py-2 pr-3 ${p.returnedNow > 0 ? 'font-bold text-red-800' : ''}`}>{p.returnedNow}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
                <p className="mt-2 text-xs text-slate-800">&quot;Waiting now&quot; is the orders waiting for the check in the person&apos;s RTOMs; an RTOM with two people shows the same orders for both, since either may pass them.</p>
            </div>
        </div>
    );
}

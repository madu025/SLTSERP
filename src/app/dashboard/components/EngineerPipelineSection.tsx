"use client";

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Skeleton } from '@/components/ui/skeleton';
import type { WorkFilters } from './MyWorkSection';
import { DashHeading, RouteStrip } from './dash-ui';

interface Counts { waitingPat: number; noContractor: number; waitingCheck: number; waitingContractor: number; readyToInvoice: number; held: number; invoicedThisMonth: number; invoicesInApproval: number; returnedToCheck: number; oldestWaitingCheckDays: number | null }
interface Area extends Counts { rtom: string; name: string; team: Array<{ id: string; name: string; role: string }>; progressPct: number | null }
interface Person { id: string; name: string; role: string; email: string | null; lastLoginAt: string | null; rtoms: string[]; checkedThisMonth: number; invoicedThisMonth: number; waitingNow: number; returnedNow: number }
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

const ROLE: Record<string, string> = { AREA_COORDINATOR: 'Area Coordinator', QC_OFFICER: 'QC Officer', ENGINEER: 'Engineer', ASSISTANT_ENGINEER: 'Assistant Engineer' };
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** The engineer's month-end pipeline: where the finished orders of each RTOM stand, who works in it, and what each of them has done this month. */
export default function EngineerPipelineSection({ data, isLoading }: { data?: PipelineData; isLoading: boolean }) {
    if (isLoading && !data) return <Skeleton className="h-64 rounded-[10px]" />;
    if (!data || data.areas.length === 0) return <div className="dash-panel"><h3>No RTOMs are assigned to you</h3><p className="dash-note mt-1">Ask an administrator to add your RTOMs to your user account.</p></div>;
    const t = data.totals;
    return (
        <div className="space-y-4">
            <DashHeading title="Month-end pipeline of your RTOMs" note={`Finished orders still to be invoiced, and the invoices of ${data.month}.`} />
            <RouteStrip
                title="Where the finished orders are"
                note="Open a station to see its orders."
                stations={[
                    { label: 'Waiting for PAT', value: t.waitingPat, hint: 'SLTS, OPMC and HO PAT not all passed', href: '/service-orders/work-order/pat', waiting: true },
                    { label: 'Waiting for the check', value: t.waitingCheck, hint: t.oldestWaitingCheckDays === null ? 'Area Coordinator or QC Officer to check' : `Oldest waiting ${plural(t.oldestWaitingCheckDays, 'day')}`, href: '/service-orders/work-order/completed?check=waiting', waiting: true },
                    { label: 'Waiting for the contractor', value: t.waitingContractor, hint: 'Checked; the contractor to verify', href: '/service-orders/work-order/completed?check=ready', waiting: true },
                    { label: 'Ready to invoice', value: t.readyToInvoice, hint: 'Verified: yours to invoice', href: '/service-orders/invoicing', tone: 'pass' },
                    { label: `Invoiced in ${data.month}`, value: t.invoicedThisMonth, hint: `${plural(t.invoicesInApproval, 'invoice')} in approval`, href: '/service-orders/invoicing', tone: 'pass' },
                ]}
            />
            {(t.noContractor > 0 || t.held > 0 || t.returnedToCheck > 0) && (
                <div className="flex flex-wrap gap-2 px-1">
                    {t.noContractor > 0 && <Link href="/service-orders/work-order/completed?check=nocontractor" className="dash-chip" data-tone="fault">{plural(t.noContractor, 'order')} finished without a contractor</Link>}
                    {t.returnedToCheck > 0 && <span className="dash-chip" data-tone="fault">{plural(t.returnedToCheck, 'order')} sent back to the check</span>}
                    {t.held > 0 && <span className="dash-chip" data-tone="wait">{plural(t.held, 'order')} held back from invoicing</span>}
                </div>
            )}
            <div className="dash-panel">
                <h3>Progress by RTOM</h3>
                <p className="dash-note">Progress is the share of finished orders past the check and the contractor, out of all finished orders still to be invoiced.</p>
                <div className="mt-2 overflow-x-auto">
                    <table className="dash-table">
                        <thead><tr><th>RTOM</th><th>Team</th><th>PAT</th><th>Check</th><th>Contractor</th><th>Ready</th><th>Oldest in check</th><th>Progress</th></tr></thead>
                        <tbody>
                            {data.areas.map((a) => (
                                <tr key={a.rtom}>
                                    <td className="whitespace-nowrap font-semibold">{a.rtom}</td>
                                    <td className="text-xs">{a.team.length === 0 ? <span className="is-fault">Nobody assigned</span> : a.team.map((p) => <div key={p.id}>{p.name} <span style={{ color: 'var(--dash-ink-2)' }}>({ROLE[p.role] ?? p.role})</span></div>)}</td>
                                    <td>{a.waitingPat}</td>
                                    <td className="font-semibold">{a.waitingCheck}{a.returnedToCheck > 0 && <span className="is-fault ml-1 text-xs">({a.returnedToCheck} returned)</span>}</td>
                                    <td>{a.waitingContractor}</td>
                                    <td className="is-pass">{a.readyToInvoice}</td>
                                    <td className={`whitespace-nowrap ${a.oldestWaitingCheckDays !== null && a.oldestWaitingCheckDays > 7 ? 'is-fault' : ''}`}>{a.oldestWaitingCheckDays === null ? '-' : plural(a.oldestWaitingCheckDays, 'day')}</td>
                                    <td className="min-w-[8rem]">
                                        {a.progressPct === null ? '-' : <div><div className="text-xs font-semibold">{a.progressPct}%</div><div className="dash-bar"><span style={{ width: `${Math.max(3, a.progressPct)}%` }} /></div></div>}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
            <div className="dash-panel">
                <h3>Team of your RTOMs</h3>
                {data.people.length === 0 ? <p className="mt-2 text-sm">Nobody works in your RTOMs yet.</p> : (
                    <div className="mt-2 overflow-x-auto">
                        <table className="dash-table">
                            <thead><tr><th>Name</th><th>Role</th><th>Contact</th><th>Last signed in</th><th>RTOMs</th><th>Checked in {data.month}</th><th>Orders invoiced in {data.month}</th><th>Waiting now</th><th>Sent back</th></tr></thead>
                            <tbody>
                                {data.people.map((p) => (
                                    <tr key={p.id}>
                                        <td className="font-semibold">{p.name}</td>
                                        <td>{ROLE[p.role] ?? p.role}</td>
                                        <td className="text-xs">{p.email ?? '-'}</td>
                                        <td className="whitespace-nowrap text-xs">{p.lastLoginAt ? new Date(p.lastLoginAt).toLocaleDateString('en-GB') : 'never'}</td>
                                        <td className="text-xs">{p.rtoms.join(', ')}</td>
                                        <td className="font-semibold">{p.checkedThisMonth}</td>
                                        <td className="font-semibold">{p.invoicedThisMonth}</td>
                                        <td>{p.waitingNow}</td>
                                        <td className={p.returnedNow > 0 ? 'is-fault' : ''}>{p.returnedNow}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
                <p className="dash-note mt-2">&quot;Waiting now&quot; is the orders waiting for the check in the person&apos;s RTOMs; an RTOM with two people shows the same orders for both, since either may pass them.</p>
            </div>
        </div>
    );
}

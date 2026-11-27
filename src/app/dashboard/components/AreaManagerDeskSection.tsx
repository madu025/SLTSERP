"use client";

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Skeleton } from '@/components/ui/skeleton';
import { DashFigure, DashHeading } from './dash-ui';
import type { WorkFilters } from './MyWorkSection';

interface DeskInvoice { id: string; invoiceNumber: string; contractor: string; area: string; orders: number; total: number; waitingDays: number | null }
export interface DeskData {
    month: string; monthNumber: number; year: number; rtom: string;
    invoices: { count: number; total: number; oldestDays: number | null; list: DeskInvoice[] };
    inApproval: Array<{ stage: string; count: number; stuck: number }>;
    stuckDays: number;
    contractorRegistrations: { count: number; list: Array<{ id: string; name: string; area: string; waitingDays: number | null }> };
    month_figures: { invoices: number; orders: number; contractorAmount: number; revenueAmount: number; marginPct: number | null; approvedByArea: number; approvedAmount: number };
}

export function useAreaManagerDesk(enabled: boolean, f: WorkFilters) {
    return useQuery<DeskData>({
        queryKey: ['area-manager-desk', f.month, f.year, f.rtom],
        enabled,
        staleTime: 60_000,
        retry: false,
        queryFn: async () => {
            const res = await fetch(`/api/service-orders/area-manager-desk?month=${f.month}&year=${f.year}${f.rtom !== 'ALL' ? `&rtom=${encodeURIComponent(f.rtom)}` : ''}`, { cache: 'no-store' });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error?.message || 'Failed to load your desk');
            return (json.data ?? json) as DeskData;
        },
    });
}

const money = (n: number) => `Rs. ${n.toLocaleString('en-LK', { maximumFractionDigits: 0 })}`;
const STAGE: Record<string, string> = { CONTRACTOR: 'the contractor', AREA_MANAGER: 'the Area Manager', ENGINEER: 'the Engineer', AREA_COORDINATOR: 'the Area Coordinator', QC_OFFICER: 'the QC Officer', IN_GATE: 'starting', STARTING: 'starting' };

/** The Area Manager's desk: invoices and contractors waiting for the decision, invoices stuck in the areas, and the money of the billing month. */
export default function AreaManagerDeskSection({ data, isLoading }: { data?: DeskData; isLoading: boolean }) {
    if (isLoading && !data) return <Skeleton className="h-56 rounded-[10px]" />;
    if (!data) return null;
    const inv = data.invoices, f = data.month_figures;
    const stuckTotal = data.inApproval.reduce((a, s) => a + s.stuck, 0);
    return (
        <div className="space-y-4">
            <DashHeading title="Your desk" note="Decisions waiting for you, and invoices held up in your areas." />
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <DashFigure label="Invoices to approve" value={inv.count} href="/invoices/confirmations" tone={inv.count > 0 ? 'route' : 'neutral'}
                    hint={inv.count === 0 ? 'Nothing is waiting for your approval.' : `${money(inv.total)}, oldest waiting ${inv.oldestDays ?? 0} day${inv.oldestDays === 1 ? '' : 's'}`} />
                <DashFigure label="Contractors to approve" value={data.contractorRegistrations.count} href="/contractors/management/approvals" tone={data.contractorRegistrations.count > 0 ? 'route' : 'neutral'}
                    hint={data.contractorRegistrations.count === 0 ? 'No registration is waiting for you.' : 'Registrations waiting for the Area Manager approval.'} />
                <DashFigure label="Invoices stuck in your areas" value={stuckTotal} tone={stuckTotal > 0 ? 'fault' : 'neutral'}
                    hint={`Waiting for more than ${data.stuckDays} days at any step.`} />
            </div>

            {inv.list.length > 0 && (
                <div className="dash-panel">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <h3>Waiting for your approval</h3>
                        <Link href="/invoices/confirmations" className="dash-link">Open Invoice Approvals</Link>
                    </div>
                    <div className="mt-2 overflow-x-auto">
                        <table className="dash-table">
                            <thead><tr><th>Invoice</th><th>Contractor</th><th>RTOM</th><th>Orders</th><th>Total</th><th>Waiting</th></tr></thead>
                            <tbody>
                                {inv.list.map((i) => (
                                    <tr key={i.id}>
                                        <td className="whitespace-nowrap font-semibold">{i.invoiceNumber}</td><td>{i.contractor}</td><td>{i.area}</td>
                                        <td>{i.orders}</td><td className="whitespace-nowrap">{money(i.total)}</td>
                                        <td className={`whitespace-nowrap ${(i.waitingDays ?? 0) > data.stuckDays ? 'is-fault' : ''}`}>{i.waitingDays ?? 0} day{i.waitingDays === 1 ? '' : 's'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="dash-panel">
                    <h3>Invoices in approval, by who they wait for</h3>
                    {data.inApproval.length === 0 ? <p className="mt-2 text-sm">No invoice is in approval in your areas.</p> : (
                        <table className="dash-table mt-2">
                            <tbody>
                                {data.inApproval.map((s) => (
                                    <tr key={s.stage}>
                                        <td>Waiting for {STAGE[s.stage] ?? s.stage}</td>
                                        <td className="text-right font-semibold">{s.count}{s.stuck > 0 && <span className="is-fault ml-2 text-xs">({s.stuck} stuck)</span>}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
                <div className="dash-panel">
                    <h3>Billing month: {data.month}</h3>
                    <table className="dash-table mt-2">
                        <tbody>
                            <tr><td>Invoices</td><td className="text-right font-semibold">{f.invoices} ({f.orders} orders)</td></tr>
                            <tr><td>Approved by the area</td><td className="text-right font-semibold">{f.approvedByArea}, {money(f.approvedAmount)}</td></tr>
                            <tr><td>Paid to contractors</td><td className="text-right font-semibold">{money(f.contractorAmount)}</td></tr>
                            <tr><td>Revenue of the orders</td><td className="text-right font-semibold">{money(f.revenueAmount)}</td></tr>
                            <tr><td>Margin</td><td className={`text-right font-semibold ${f.marginPct !== null && f.marginPct < 0 ? 'is-fault' : ''}`}>{f.marginPct === null ? '-' : `${f.marginPct}%`}</td></tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

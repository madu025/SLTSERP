"use client";

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Skeleton } from '@/components/ui/skeleton';
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
const th = 'py-2 pr-3 text-left text-xs font-bold uppercase tracking-wide text-slate-900';
const card = 'rounded-2xl border border-slate-300 bg-white p-4 shadow-sm';
const STAGE: Record<string, string> = { CONTRACTOR: 'the contractor', AREA_MANAGER: 'the Area Manager', ENGINEER: 'the Engineer', AREA_COORDINATOR: 'the Area Coordinator', QC_OFFICER: 'the QC Officer', IN_GATE: 'starting', STARTING: 'starting' };

/** The Area Manager's desk: invoices and contractors waiting for the decision, invoices stuck in the areas, and the money of the billing month. */
export default function AreaManagerDeskSection({ data, isLoading }: { data?: DeskData; isLoading: boolean }) {
    if (isLoading && !data) return <Skeleton className="h-56 rounded-2xl" />;
    if (!data) return null;
    const inv = data.invoices, f = data.month_figures;
    const stuckTotal = data.inApproval.reduce((a, s) => a + s.stuck, 0);
    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-baseline gap-2 px-1">
                <h2 className="text-base font-black text-slate-900 dark:text-white">Your desk</h2>
                <span className="text-[10px] font-black uppercase tracking-[0.18em] text-indigo-700 dark:text-indigo-300">Decisions waiting for you</span>
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <Link href="/invoices/confirmations" className={`${card} hover:border-indigo-600`}>
                    <div className="text-xs font-bold uppercase tracking-wide text-slate-900">Invoices to approve</div>
                    <div className="mt-2 text-4xl font-black text-indigo-900">{inv.count}</div>
                    <p className="mt-1 text-sm text-slate-800">{inv.count === 0 ? 'Nothing is waiting for your approval.' : `${money(inv.total)} · oldest waiting ${inv.oldestDays ?? 0} day${inv.oldestDays === 1 ? '' : 's'}`}</p>
                </Link>
                <Link href="/contractors/management/approvals" className={`${card} hover:border-indigo-600`}>
                    <div className="text-xs font-bold uppercase tracking-wide text-slate-900">Contractors to approve</div>
                    <div className="mt-2 text-4xl font-black text-indigo-900">{data.contractorRegistrations.count}</div>
                    <p className="mt-1 text-sm text-slate-800">{data.contractorRegistrations.count === 0 ? 'No registration is waiting for you.' : 'Registrations waiting for the Area Manager approval.'}</p>
                </Link>
                <div className={`${card} ${stuckTotal > 0 ? 'border-red-400 bg-red-50' : ''}`}>
                    <div className="text-xs font-bold uppercase tracking-wide text-slate-900">Invoices stuck in your areas</div>
                    <div className={`mt-2 text-4xl font-black ${stuckTotal > 0 ? 'text-red-900' : 'text-slate-900'}`}>{stuckTotal}</div>
                    <p className="mt-1 text-sm text-slate-800">Waiting for more than {data.stuckDays} days at any step.</p>
                </div>
            </div>

            {inv.list.length > 0 && (
                <div className={card}>
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <h3 className="text-sm font-black text-slate-900">Waiting for your approval</h3>
                        <Link href="/invoices/confirmations" className="text-sm font-bold text-indigo-800">Open Invoice Approvals</Link>
                    </div>
                    <div className="mt-2 overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead><tr className="border-b border-slate-300"><th className={th}>Invoice</th><th className={th}>Contractor</th><th className={th}>RTOM</th><th className={th}>Orders</th><th className={th}>Total</th><th className={th}>Waiting</th></tr></thead>
                            <tbody>
                                {inv.list.map((i) => (
                                    <tr key={i.id} className="border-b border-slate-200 text-slate-900">
                                        <td className="py-1.5 pr-3 font-semibold whitespace-nowrap">{i.invoiceNumber}</td><td className="py-1.5 pr-3">{i.contractor}</td><td className="py-1.5 pr-3">{i.area}</td>
                                        <td className="py-1.5 pr-3">{i.orders}</td><td className="py-1.5 pr-3 whitespace-nowrap">{money(i.total)}</td>
                                        <td className={`py-1.5 pr-3 whitespace-nowrap ${(i.waitingDays ?? 0) > data.stuckDays ? 'font-bold text-red-800' : ''}`}>{i.waitingDays ?? 0} day{i.waitingDays === 1 ? '' : 's'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className={card}>
                    <h3 className="text-sm font-black text-slate-900">Invoices in approval, by who they wait for</h3>
                    {data.inApproval.length === 0 ? <p className="mt-2 text-sm text-slate-900">No invoice is in approval in your areas.</p> : (
                        <ul className="mt-2 space-y-1 text-sm text-slate-900">
                            {data.inApproval.map((s) => (
                                <li key={s.stage} className="flex justify-between"><span>Waiting for {STAGE[s.stage] ?? s.stage}</span><span className="font-bold">{s.count}{s.stuck > 0 && <span className="ml-2 text-xs text-red-800">({s.stuck} stuck)</span>}</span></li>
                            ))}
                        </ul>
                    )}
                </div>
                <div className={card}>
                    <h3 className="text-sm font-black text-slate-900">Billing month: {data.month}</h3>
                    <dl className="mt-2 grid grid-cols-2 gap-y-1 text-sm text-slate-900">
                        <dt>Invoices</dt><dd className="text-right font-bold">{f.invoices} ({f.orders} orders)</dd>
                        <dt>Approved by the area</dt><dd className="text-right font-bold">{f.approvedByArea} · {money(f.approvedAmount)}</dd>
                        <dt>Paid to contractors</dt><dd className="text-right font-bold">{money(f.contractorAmount)}</dd>
                        <dt>Revenue of the orders</dt><dd className="text-right font-bold">{money(f.revenueAmount)}</dd>
                        <dt>Margin</dt><dd className="text-right font-bold">{f.marginPct === null ? '-' : `${f.marginPct}%`}</dd>
                    </dl>
                </div>
            </div>
        </div>
    );
}

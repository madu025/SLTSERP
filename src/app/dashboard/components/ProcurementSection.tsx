"use client";

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { Skeleton } from '@/components/ui/skeleton';
import { RouteStrip } from './dash-ui';

interface PendingRequest {
    id: string;
    requestNr: string;
    priority: string;
    createdAt: string;
    status: string;
    workflowStage: string;
    requestedBy?: { id: string; name: string } | null;
    toStore?: { id: string; name: string } | null;
    _count?: { items: number };
}

interface ActivePO {
    id: string;
    requestNr: string;
    poNumber?: string | null;
    vendor?: string | null;
    expectedDelivery?: string | null;
    procurementStatus?: string | null;
    createdAt: string;
    requestedBy?: { id: string; name: string } | null;
    _count?: { items: number };
}

/** One count per step of the purchase flow (DashboardService.getProcurementMetrics). */
interface ProcurementFlow {
    storesManager: number; ospManager: number; docsPending: number; waitingPo: number; partlyOrdered: number;
    waitingGrn: number; partlyReceived: number; waitingVoucher: number; waitingHo: number; paidThisMonth: number;
}

interface ProcurementTelemetry {
    flow: ProcurementFlow;
    /** purchase orders on record by status */
    purchaseOrders?: { open: number; received: number; cancelled: number };
    recentPendingRequests: PendingRequest[];
    recentActivePOs: ActivePO[];
    updatedAt?: string;
}

const PROCUREMENT_REQUEST_TIMEOUT_MS = 12_000;

interface ProcurementSectionProps {
    rtom?: string;
    enabled?: boolean;
}

export default function ProcurementSection({ rtom = 'ALL', enabled = true }: ProcurementSectionProps) {
    const { data, isLoading, isFetching, error, refetch } = useQuery<ProcurementTelemetry>({
        queryKey: ['dashboard-procurement-telemetry', rtom],
        queryFn: async ({ signal }) => {
            const controller = new AbortController();
            let timedOut = false;
            const timeoutId = setTimeout(() => {
                timedOut = true;
                controller.abort();
            }, PROCUREMENT_REQUEST_TIMEOUT_MS);
            const abortFromQuery = () => controller.abort();
            signal.addEventListener('abort', abortFromQuery, { once: true });

            try {
                const res = await fetch(`/api/dashboard/procurement?rtom=${encodeURIComponent(rtom)}`, { signal: controller.signal });
                if (!res.ok) {
                    const requestError = new Error(`Procurement telemetry request failed (${res.status})`) as Error & { status?: number };
                    requestError.status = res.status;
                    throw requestError;
                }
                return res.json() as Promise<ProcurementTelemetry>;
            } catch (requestError) {
                if (timedOut) throw new Error('Procurement data is taking too long to respond. Check your connection and retry.');
                throw requestError;
            } finally {
                clearTimeout(timeoutId);
                signal.removeEventListener('abort', abortFromQuery);
            }
        },
        staleTime: 2 * 60 * 1000,
        gcTime: 30 * 60 * 1000,
        enabled,
        retry: (failureCount, requestError) => {
            const status = (requestError as Error & { status?: number }).status;
            if (status && status >= 400 && status < 500) return false;
            return failureCount < 1;
        },
        retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 4000),
        refetchOnWindowFocus: false,
        refetchOnReconnect: true,
        refetchInterval: 30 * 1000,
        refetchIntervalInBackground: false,
    });

    if (!enabled) return null;

    if (isLoading) {
        return (
            <div className="space-y-6" role="status" aria-live="polite">
                <p className="px-1 text-sm font-semibold text-slate-900 dark:text-slate-100">Loading procurement dashboard data…</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {Array(4).fill(0).map((_, i) => (
                        <Skeleton key={i} className="h-28 rounded-2xl" />
                    ))}
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <Skeleton className="h-72 rounded-2xl lg:col-span-2" />
                    <Skeleton className="h-72 rounded-2xl" />
                </div>
            </div>
        );
    }

    if (error && !data) {
        return (
            <div className="flex flex-col gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-6 text-sm font-semibold text-rose-900 dark:border-rose-800 dark:bg-rose-950/30 dark:text-rose-100" role="alert">
                <span>{(error as Error).message || 'Procurement telemetry could not be loaded.'}</span>
                <button type="button" onClick={() => void refetch()} disabled={isFetching} className="w-fit rounded-md bg-rose-700 px-3 py-2 text-white hover:bg-rose-800 disabled:cursor-wait disabled:opacity-60 dark:bg-rose-600 dark:hover:bg-rose-500">
                    {isFetching ? 'Retrying…' : 'Retry'}
                </button>
            </div>
        );
    }
    if (!data) {
        return (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-sm font-semibold text-rose-900 dark:border-rose-800 dark:bg-rose-950/30 dark:text-rose-100" role="alert">
                Procurement telemetry was not returned. Please retry.
                <button type="button" onClick={() => void refetch()} className="ml-3 underline underline-offset-2">Retry</button>
            </div>
        );
    }

    const f = data.flow;
    const days = (iso: string) => Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000));
    const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? '' : 's'}`;

    return (
        <div className="space-y-4">
            {error && (
                <div className="dash-alert" role="status">
                    <span>These figures may be out of date: the last refresh failed.</span>
                    <button type="button" onClick={() => void refetch()} disabled={isFetching} className="dash-link">{isFetching ? 'Retrying' : 'Retry'}</button>
                </div>
            )}

            <RouteStrip
                title="Where the material requests are"
                note="Purchases through HO, from the request to the payment."
                stations={[
                    { label: 'Stores Manager review', value: f.storesManager, hint: 'Requests (MRN) to review', href: '/inventory/approvals', waiting: true },
                    { label: 'OSP Manager approval', value: f.ospManager, hint: 'Reviewed, waiting for approval', href: '/inventory/approvals', waiting: true },
                    { label: 'Documents to Procurement', value: f.docsPending, hint: 'Approved; the Stores Manager to submit the documents', href: '/inventory/requests', waiting: true },
                    { label: 'Waiting for the PO', value: f.waitingPo, hint: f.partlyOrdered > 0 ? `${f.partlyOrdered} partly ordered` : 'Procurement to record the HO-approved PO', href: '/procurement/orders?tab=PENDING', waiting: true },
                    { label: 'Waiting for the GRN', value: f.waitingGrn, hint: f.partlyReceived > 0 ? `${f.partlyReceived} partly received` : 'Ordered; the store to receive the goods', href: '/inventory/grn', waiting: true },
                    { label: 'Waiting for the voucher', value: f.waitingVoucher, hint: 'Vendor invoices without a payment voucher', href: '/procurement/payment-approvals', waiting: true },
                    { label: 'Waiting for HO payment', value: f.waitingHo, hint: 'Vouchers not yet paid in full', href: '/finance/ho-payments', waiting: true },
                    { label: 'Paid this month', value: f.paidThisMonth, hint: 'Vouchers paid by HO', href: '/finance/ho-payments', tone: 'pass' },
                ]}
            />

            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                <div className="dash-panel">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <h3>Documents with Procurement, waiting for a PO</h3>
                        <Link href="/procurement/orders?tab=PENDING" className="dash-link">Open Purchase Orders</Link>
                    </div>
                    {data.recentPendingRequests.length === 0 ? (
                        <p className="mt-2 text-sm">No request is waiting for a PO.</p>
                    ) : (
                        <table className="dash-table mt-2">
                            <thead><tr><th>Request</th><th>Store</th><th>Items</th><th>Waiting</th></tr></thead>
                            <tbody>
                                {data.recentPendingRequests.map((r) => (
                                    <tr key={r.id}>
                                        <td className="whitespace-nowrap font-semibold">{r.requestNr}{r.priority && r.priority !== 'NORMAL' && <span className="dash-chip ml-2" data-tone="wait">{r.priority.toLowerCase()}</span>}</td>
                                        <td>{r.toStore?.name ?? '-'}</td>
                                        <td>{r._count?.items ?? 0}</td>
                                        <td className={`whitespace-nowrap ${days(r.createdAt) > 7 ? 'is-fault' : ''}`}>{plural(days(r.createdAt), 'day')}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                    <p className="dash-note mt-2">The oldest five are shown.</p>
                </div>

                <div className="dash-panel">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <h3>Ordered, waiting for the goods</h3>
                        <Link href="/inventory/grn" className="dash-link">Open GRN</Link>
                    </div>
                    {data.recentActivePOs.length === 0 ? (
                        <p className="mt-2 text-sm">No ordered goods are waiting to be received.</p>
                    ) : (
                        <table className="dash-table mt-2">
                            <thead><tr><th>Request</th><th>PO</th><th>Vendor</th><th>Expected</th></tr></thead>
                            <tbody>
                                {data.recentActivePOs.map((po) => {
                                    const late = !!po.expectedDelivery && new Date(po.expectedDelivery).getTime() < Date.now();
                                    return (
                                        <tr key={po.id}>
                                            <td className="whitespace-nowrap font-semibold">{po.requestNr}</td>
                                            <td className="whitespace-nowrap">{po.poNumber || '-'}</td>
                                            <td>{po.vendor || '-'}</td>
                                            <td className={`whitespace-nowrap ${late ? 'is-fault' : ''}`}>{po.expectedDelivery ? `${new Date(po.expectedDelivery).toLocaleDateString('en-GB')}${late ? ' (late)' : ''}` : '-'}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                    <p className="dash-note mt-2">The oldest five are shown.</p>
                </div>
            </div>

            <p className="px-1 text-sm" style={{ color: 'var(--dash-ink-2)' }}>
                {data.purchaseOrders ? `Purchase orders on record: ${data.purchaseOrders.open} open, ${data.purchaseOrders.received} received, ${data.purchaseOrders.cancelled} cancelled. ` : ''}
                {data.updatedAt ? `Figures as of ${new Date(data.updatedAt).toLocaleString('en-GB')}.` : ''}
            </p>
        </div>
    );
}

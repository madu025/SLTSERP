import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Package, AlertTriangle, Truck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface LowStockItem {
    item: { name: string; code: string };
    store: { name: string };
    quantity: number;
}

interface InventoryStats {
    lowStockItems: LowStockItem[];
    pendingMRNs: number;
    pendingGRNs: number;
    dataQuality?: {
        negativeStockCount: number;
        materialUsageMissingCostCount: number;
    };
    updatedAt: string;
}

import Link from 'next/link';
import { ArrowUpRight, Warehouse } from 'lucide-react';

const INVENTORY_REQUEST_TIMEOUT_MS = 12_000;

interface InventorySectionProps {
    rtom?: string;
    enabled?: boolean;
}

export default function InventorySection({ rtom = 'ALL', enabled = true }: InventorySectionProps) {
    const { data, isLoading, isFetching, error, refetch } = useQuery<InventoryStats>({
        queryKey: ['dashboard-inventory', rtom],
        queryFn: async ({ signal }) => {
            const params = new URLSearchParams({ rtom });
            const controller = new AbortController();
            let timedOut = false;
            const timeoutId = setTimeout(() => {
                timedOut = true;
                controller.abort();
            }, INVENTORY_REQUEST_TIMEOUT_MS);
            const abortFromQuery = () => controller.abort();
            signal.addEventListener('abort', abortFromQuery, { once: true });

            try {
                const resp = await fetch(`/api/dashboard/inventory?${params}`, { signal: controller.signal });
                if (!resp.ok) {
                    const requestError = new Error(`Inventory data request failed (${resp.status}).`) as Error & { status?: number };
                    requestError.status = resp.status;
                    throw requestError;
                }
                return resp.json() as Promise<InventoryStats>;
            } catch (requestError) {
                if (timedOut) throw new Error('Inventory data is taking too long to respond. Check your connection and retry.');
                throw requestError;
            } finally {
                clearTimeout(timeoutId);
                signal.removeEventListener('abort', abortFromQuery);
            }
        },
        staleTime: 5 * 60 * 1000,
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
    });

    if (!enabled) return null;

    if (isLoading) {
        return (
            <div className="space-y-4" role="status" aria-live="polite">
                <p className="px-1 text-sm font-semibold text-slate-900 dark:text-slate-100">Loading inventory dashboard data…</p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Skeleton className="h-48 rounded-xl md:col-span-2" />
                <Skeleton className="h-48 rounded-xl" />
                </div>
            </div>
        );
    }

    if (error && !data) {
        return (
            <div className="flex flex-col gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900 dark:border-rose-800 dark:bg-rose-950/30 dark:text-rose-100" role="alert">
                <span>{(error as Error).message || 'Inventory data could not be loaded.'}</span>
                <button type="button" onClick={() => void refetch()} disabled={isFetching} className="w-fit rounded-md bg-rose-700 px-3 py-2 font-semibold text-white hover:bg-rose-800 disabled:cursor-wait disabled:opacity-60 dark:bg-rose-600 dark:hover:bg-rose-500">
                    {isFetching ? 'Retrying…' : 'Retry'}
                </button>
            </div>
        );
    }
    if (!data) {
        return (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900 dark:border-rose-800 dark:bg-rose-950/30 dark:text-rose-100" role="alert">
                Inventory data was not returned. Please retry.
                <button type="button" onClick={() => void refetch()} className="ml-3 font-semibold underline underline-offset-2">Retry</button>
            </div>
        );
    }

    const lowStockItems = data?.lowStockItems || [];
    const pendingMRNs = data?.pendingMRNs || 0;
    const pendingGRNs = data?.pendingGRNs || 0;

    return (
        <div className="space-y-4">
            {error && (
                <div className="flex flex-col gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100 sm:flex-row sm:items-center sm:justify-between" role="status">
                    <span>Showing cached inventory data. Refresh did not complete.</span>
                    <button type="button" onClick={() => void refetch()} disabled={isFetching} className="font-semibold underline underline-offset-2 disabled:cursor-wait disabled:opacity-60">{isFetching ? 'Retrying…' : 'Retry'}</button>
                </div>
            )}
            {isFetching && !error && <p className="text-xs font-medium text-slate-700 dark:text-slate-300" role="status">Refreshing inventory data…</p>}
            {(data.dataQuality?.negativeStockCount ?? 0) > 0 && (
                <div className="rounded-xl border border-rose-300 bg-rose-50 px-4 py-3 text-sm text-rose-950">
                    <p className="font-bold">Inventory data validation warning</p>
                    <p className="mt-1">
                        {data.dataQuality?.negativeStockCount.toLocaleString()} stock balance(s) are negative and need reconciliation.
                    </p>
                </div>
            )}
            {(data.dataQuality?.materialUsageMissingCostCount ?? 0) > 0 && (
                <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
                    <p className="font-bold">Material cost validation warning</p>
                    <p className="mt-1">
                        {data.dataQuality?.materialUsageMissingCostCount.toLocaleString()} material usage row(s) have no positive cost price and are excluded from reliable COGS totals.
                    </p>
                </div>
            )}
            {/* Direct Link Banner to Stores Command Center */}
            <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white p-4 rounded-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 shadow-md">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-blue-600/30 rounded-xl border border-blue-400/30">
                        <Warehouse className="w-5 h-5 text-blue-300" />
                    </div>
                    <div>
                        <h4 className="text-sm font-black">Stores Manager Operational Command Center</h4>
                        <p className="text-xs text-blue-200/80">Manage warehouse stock dispatches (MIN), GRN verification, and inventory valuation</p>
                    </div>
                </div>
                <Link
                    href="/inventory"
                    className="inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold px-4 py-2 rounded-xl transition-all shadow-sm flex-none"
                >
                    Open Command Center <ArrowUpRight className="w-4 h-4" />
                </Link>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="md:col-span-2 border-slate-200 dark:border-slate-800 shadow-sm transition-all hover:shadow-md">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium">Critical Stock Shortages</CardTitle>
                    <AlertTriangle className="w-5 h-5 text-rose-500" />
                </CardHeader>
                <CardContent>
                    {lowStockItems.length === 0 ? (
                        <div className="text-center text-muted-foreground py-8 text-sm">
                            No critical shortages found.
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {lowStockItems.map((stock, i) => (
                                <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800">
                                    <div className="flex flex-col">
                                        <span className="font-semibold text-sm">{stock.item?.name || 'Unknown Item'}</span>
                                        <span className="text-xs text-muted-foreground">{stock.store?.name || 'Unknown Store'}</span>
                                    </div>
                                    <Badge variant="destructive" className="px-2 py-0.5">
                                        {stock.quantity} left
                                    </Badge>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            <div className="space-y-6">
                <Card className="bg-gradient-to-br from-indigo-500/10 to-indigo-500/5 border-indigo-500/20 shadow-sm transition-all hover:shadow-md">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-indigo-700 dark:text-indigo-400">
                            Pending MRNs
                        </CardTitle>
                        <Package className="w-5 h-5 text-indigo-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-indigo-800 dark:text-indigo-300">
                            {pendingMRNs}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">Material Requests awaiting approval</p>
                    </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-violet-500/10 to-violet-500/5 border-violet-500/20 shadow-sm transition-all hover:shadow-md">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-violet-700 dark:text-violet-400">
                            Pending GRNs
                        </CardTitle>
                        <Truck className="w-5 h-5 text-violet-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-violet-800 dark:text-violet-300">
                            {pendingGRNs}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">Incoming stock receipts</p>
                    </CardContent>
                </Card>
            </div>
            <p className="px-1 text-[11px] text-muted-foreground">
                {data.updatedAt
                    ? `Inventory data refreshed ${new Date(data.updatedAt).toLocaleString()}`
                    : 'Inventory refresh timestamp was not supplied by the API.'}
            </p>
        </div>
    </div>
    );
}

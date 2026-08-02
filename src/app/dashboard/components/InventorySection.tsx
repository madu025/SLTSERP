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
    updatedAt: string;
}

import Link from 'next/link';
import { ArrowUpRight, Warehouse } from 'lucide-react';

export default function InventorySection({ rtom = 'ALL' }: { rtom?: string }) {
    const { data, isLoading, error } = useQuery<InventoryStats>({
        queryKey: ['dashboard-inventory', rtom],
        queryFn: async () => {
            const params = new URLSearchParams({ rtom });
            const resp = await fetch(`/api/dashboard/inventory?${params}`);
            if (!resp.ok) throw new Error('Failed to fetch inventory stats');
            return resp.json();
        },
        staleTime: 5 * 60 * 1000,
    });

    if (isLoading) {
        return (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Skeleton className="h-48 rounded-xl md:col-span-2" />
                <Skeleton className="h-48 rounded-xl" />
            </div>
        );
    }

    if (error || !data) {
        return <div className="text-red-500">Failed to load inventory data.</div>;
    }

    const lowStockItems = data?.lowStockItems || [];
    const pendingMRNs = data?.pendingMRNs || 0;
    const pendingGRNs = data?.pendingGRNs || 0;

    return (
        <div className="space-y-4">
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
        </div>
    </div>
    );
}

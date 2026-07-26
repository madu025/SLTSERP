import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { DollarSign, AlertCircle, Clock } from 'lucide-react';

interface FinanceStats {
    unbilledRevenue: number;
    unbilledContractorPayout: number;
    pendingPayoutA: number;
    pendingPayoutB: number;
    totalPendingPayouts: number;
    updatedAt: string;
}

export default function FinanceSection({ rtom = 'ALL' }: { rtom?: string }) {
    const { data, isLoading, error } = useQuery<FinanceStats>({
        queryKey: ['dashboard-finance', rtom],
        queryFn: async () => {
            const params = new URLSearchParams({ rtom });
            const resp = await fetch(`/api/dashboard/finance?${params}`);
            if (!resp.ok) throw new Error('Failed to fetch finance stats');
            return resp.json();
        },
        staleTime: 5 * 60 * 1000, // 5 mins
    });

    if (isLoading) {
        return (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Skeleton className="h-32 rounded-xl" />
                <Skeleton className="h-32 rounded-xl" />
                <Skeleton className="h-32 rounded-xl" />
            </div>
        );
    }

    if (error || !data) {
        return <div className="text-red-500">Failed to load finance data.</div>;
    }

    const formatLKR = (val: number) => `LKR ${(val || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 border-emerald-500/20 shadow-sm transition-all hover:shadow-md">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
                        Unbilled WIP Revenue
                    </CardTitle>
                    <DollarSign className="w-5 h-5 text-emerald-600" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold text-emerald-800 dark:text-emerald-300">
                        {formatLKR(data?.unbilledRevenue || 0)}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                        Completed Service Orders not yet invoiced
                    </p>
                </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-blue-500/10 to-blue-500/5 border-blue-500/20 shadow-sm transition-all hover:shadow-md">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium text-blue-700 dark:text-blue-400">
                        Pending Payouts (A + B)
                    </CardTitle>
                    <Clock className="w-5 h-5 text-blue-600" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold text-blue-800 dark:text-blue-300">
                        {formatLKR(data?.totalPendingPayouts || 0)}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                        Approved but unpaid contractor invoices
                    </p>
                </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-amber-500/10 to-amber-500/5 border-amber-500/20 shadow-sm transition-all hover:shadow-md">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium text-amber-700 dark:text-amber-400">
                        Split Breakdown
                    </CardTitle>
                    <AlertCircle className="w-5 h-5 text-amber-600" />
                </CardHeader>
                <CardContent>
                    <div className="space-y-1">
                        <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Amount A:</span>
                            <span className="font-semibold">{formatLKR(data?.pendingPayoutA || 0)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Amount B:</span>
                            <span className="font-semibold">{formatLKR(data?.pendingPayoutB || 0)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Unbilled WIP:</span>
                            <span className="font-semibold">{formatLKR(data?.unbilledContractorPayout || 0)}</span>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

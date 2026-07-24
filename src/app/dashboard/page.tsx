"use client";

import { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Skeleton } from '@/components/ui/skeleton';
import { DashboardFilters, StatsCardGrid, DashboardError } from './components';
import type { Stats } from './components';

/* ── Chart-heavy sections are dynamically imported (client-only) ── */
const ChartSection = dynamic(() => import('./components/ChartSection'), {
    ssr: false,
    loading: () => (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
            {Array(3).fill(0).map((_, i) => <Skeleton key={i} className="h-72 rounded-2xl" />)}
        </div>
    ),
});

const PerformanceSection = dynamic(() => import('./components/PerformanceSection'), {
    ssr: false,
    loading: () => (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
            {Array(2).fill(0).map((_, i) => <Skeleton key={i} className="h-80 rounded-2xl" />)}
        </div>
    ),
});

const RTOMTables = dynamic(() => import('./components/RTOMTables'), {
    ssr: false,
    loading: () => (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 mb-8">
            {Array(2).fill(0).map((_, i) => <Skeleton key={i} className="h-64 rounded-2xl" />)}
        </div>
    ),
});

export default function DashboardPage() {
    const router = useRouter();
    const [user] = useState<{ id: string; name: string; role: string } | null>(() => {
        if (typeof window !== 'undefined') {
            const storedUser = localStorage.getItem('user');
            return storedUser ? JSON.parse(storedUser) : null;
        }
        return null;
    });
    const [mounted, setMounted] = useState(false);
    const [selectedRegion, setSelectedRegion] = useState('ALL');
    const [selectedRtom, setSelectedRtom] = useState('ALL');

    useEffect(() => {
        Promise.resolve().then(() => setMounted(true));
        if (!user) {
            router.push("/login");
            return;
        }

        const isContractorRole = ['CONTRACTOR_SUPERVISOR', 'CONTRACTOR_TECHNICIAN', 'CONTRACTOR_FINANCE', 'CONTRACTOR'].includes(user.role);
        if (isContractorRole) {
            router.push("/contractor/dashboard");
        }
    }, [user, router]);

    const { data: stats, isLoading, error, refetch } = useQuery<Stats>({
        queryKey: ['dashboard-stats', user?.id || 'guest', selectedRegion, selectedRtom],
        queryFn: async () => {
            if (!user?.id) return null;
            const params = new URLSearchParams({ userId: user.id, region: selectedRegion, rtom: selectedRtom });
            const resp = await fetch(`/api/dashboard/stats?${params}`);
            if (!resp.ok) throw new Error('Failed to fetch stats');
            return resp.json();
        },
        enabled: !!user?.id,
        staleTime: 5 * 60 * 1000,
        gcTime: 30 * 60 * 1000,
        refetchInterval: 60 * 1000, // auto-refresh every minute
        refetchIntervalInBackground: false,
    });

    const isAreaCoordinator = user?.role === 'AREA_COORDINATOR';
    const isHigherManagement = !!user?.role && ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'SA_MANAGER', 'AREA_MANAGER'].includes(user.role);
    const canFilterGlobally = !!user?.role && ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'SA_MANAGER', 'OSP_MANAGER'].includes(user.role);

    const rtomRegionMap = stats?.rtomRegionMap;
    const userAccessibleRtoms = stats?.userAccessibleRtoms;

    // Compute available RTOMs based on selected region
    const availableRtoms = useMemo(() => {
        if (!rtomRegionMap) return [];
        let rtoms = Object.keys(rtomRegionMap).sort();
        if (selectedRegion !== 'ALL') {
            rtoms = rtoms.filter(r => rtomRegionMap[r] === selectedRegion);
        }
        if (!canFilterGlobally && userAccessibleRtoms) {
            rtoms = rtoms.filter(r => userAccessibleRtoms.includes(r));
        }
        return rtoms;
    }, [rtomRegionMap, selectedRegion, canFilterGlobally, userAccessibleRtoms]);

    // Sort RTOM tables by Highest Performance First (Completion Rate % desc, Completed Volume desc)
    const sortedRtoms = useMemo(() => {
        return [...(stats?.rtoms || [])].sort((a, b) => {
            const totalA = a.completed + a.pending + a.returned;
            const totalB = b.completed + b.pending + b.returned;
            const rateA = totalA > 0 ? (a.completed / totalA) * 100 : 0;
            const rateB = totalB > 0 ? (b.completed / totalB) * 100 : 0;

            if (rateB !== rateA) return rateB - rateA; // Primary: Highest Completion Rate %
            if (b.completed !== a.completed) return b.completed - a.completed; // Secondary: Highest Completed Volume
            if (totalB !== totalA) return totalB - totalA; // Tertiary: Total Received Volume
            return a.name.localeCompare(b.name); // Quaternary: A-Z Name
        });
    }, [stats?.rtoms]);

    // Pie-chart datasets (filtered to non-zero slices)
    const monthlyPieData = useMemo(() => [
        { name: 'Completed', value: stats?.monthly?.completed || 0 },
        { name: 'Pending', value: stats?.monthly?.pending || 0 },
        { name: 'Returned', value: stats?.monthly?.returned || 0 },
    ].filter(d => d.value > 0), [stats?.monthly]);

    const patData = useMemo(() => [
        { name: 'PAT Pass', value: stats?.pat?.passed || 0 },
        { name: 'PAT Rejected', value: stats?.pat?.rejected || 0 },
        { name: 'Pending', value: stats?.pat?.pending || 0 },
    ].filter(d => d.value > 0), [stats?.pat]);

    // Single unified auth/mount guard
    if (!mounted || !user) {
        return (
            <div className="min-h-screen flex bg-background text-foreground">
                <Sidebar />
                <main className="flex-1 flex items-center justify-center">
                    <div className="animate-spin w-10 h-10 border-4 border-primary border-t-transparent rounded-full"></div>
                </main>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen flex bg-background text-foreground">
                <Sidebar />
                <main className="flex-1 flex flex-col min-w-0 h-full">
                    <Header />
                    <div className="flex-1 flex items-center justify-center p-8">
                        <DashboardError error={error as Error} onRetry={() => refetch()} />
                    </div>
                </main>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex bg-background text-foreground">
            <Sidebar />
            <main className="flex-1 flex flex-col min-w-0 h-full">
                <Header />
                <div className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 space-y-6 md:space-y-8">
                    <div className="max-w-7xl mx-auto w-full">
                        <DashboardFilters
                            user={user}
                            selectedRegion={selectedRegion}
                            selectedRtom={selectedRtom}
                            onRegionChange={(val) => { setSelectedRegion(val); setSelectedRtom('ALL'); }}
                            onRtomChange={setSelectedRtom}
                            onClearFilters={() => { setSelectedRegion('ALL'); setSelectedRtom('ALL'); }}
                            canFilterGlobally={canFilterGlobally}
                            availableRegions={stats?.availableRegions}
                            availableRtoms={availableRtoms}
                            patRejectedCount={stats?.pat?.rejected || 0}
                            isAreaCoordinator={isAreaCoordinator}
                            isLoading={isLoading}
                        />
                        <StatsCardGrid isLoading={isLoading} stats={stats} />
                        <ChartSection
                            isLoading={isLoading}
                            monthlyPieData={monthlyPieData}
                            patData={patData}
                            statusBreakdown={stats?.statusBreakdown}
                        />
                        <PerformanceSection
                            isLoading={isLoading}
                            contractors={stats?.contractors}
                            aging={stats?.aging}
                        />
                        {isHigherManagement && (
                            <RTOMTables isLoading={isLoading} sortedRtoms={sortedRtoms} />
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
}

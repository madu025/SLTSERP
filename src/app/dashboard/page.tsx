"use client";

import React, { useEffect, useMemo, useState } from 'react';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import { useRouter } from 'next/navigation';
import {
    Tooltip, Legend, ResponsiveContainer,
    PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid
} from 'recharts';
import { useQuery } from '@tanstack/react-query';
import { Skeleton } from '@/components/ui/skeleton';
import Link from 'next/link';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';

interface Stats {
    monthly: {
        total: number;
        completed: number;
        pending: number;
        returned: number;
        invoicable: number;
    };
    allTime: {
        total: number;
        completed: number;
        returned: number;
        pending: number;
        invoicable: number;
        broughtForward?: number;
    };
    pat: {
        passed: number;
        rejected: number;
        pending: number;
    };
    contractors: Array<{
        name: string;
        completed: number;
        total: number;
        percentage: number;
    }>;
    rtoms: Array<{
        name: string;
        completed: number;
        pending: number;
        returned: number;
        total: number;
        patPassed?: number;
        patRejected?: number;
        sltsPatRejected?: number;
    }>;
    statusBreakdown: Array<{
        status: string;
        count: number;
    }>;
    aging: Array<{
        range: string;
        count: number;
    }>;
    availableRegions?: string[];
    rtomRegionMap?: Record<string, string>;
    userRole?: string;
    userAccessibleRtoms?: string[];
}

const COLORS = ['#10b981', '#f59e0b', '#ef4444', '#6366f1'];

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
        }
    }, [user, router]);


    const { data: stats, isLoading } = useQuery<Stats>({
        queryKey: ['dashboard-stats', user?.id || 'guest', selectedRegion, selectedRtom],
        queryFn: async () => {
            if (!user?.id) return null;
            const params = new URLSearchParams({ userId: user.id, region: selectedRegion, rtom: selectedRtom });
            const resp = await fetch(`/api/dashboard/stats?${params}`);
            if (!resp.ok) throw new Error('Failed to fetch stats');
            return resp.json();
        },
        enabled: !!user?.id,
        staleTime: 5 * 60 * 1000, // 5 minutes
        gcTime: 30 * 60 * 1000, // 30 minutes
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

    // Sort RTOM tables ascending
    const sortedRtoms = useMemo(() => {
        return [...(stats?.rtoms || [])].sort((a, b) => a.name.localeCompare(b.name));
    }, [stats?.rtoms]);

    if (!mounted || (!user && !isLoading)) {
        return (
            <div className="min-h-screen flex bg-background text-foreground">
                <Sidebar />
                <main className="flex-1 flex items-center justify-center">
                    <div className="animate-spin w-10 h-10 border-4 border-primary border-t-transparent rounded-full"></div>
                </main>
            </div>
        );
    }

    const monthlyPieData = [
        { name: 'Completed', value: stats?.monthly?.completed || 0 },
        { name: 'Pending', value: stats?.monthly?.pending || 0 },
        { name: 'Returned', value: stats?.monthly?.returned || 0 },
    ].filter(d => d.value > 0);

    const patData = [
        { name: 'PAT Pass', value: stats?.pat?.passed || 0 },
        { name: 'PAT Rejected', value: stats?.pat?.rejected || 0 },
        { name: 'Pending', value: stats?.pat?.pending || 0 },
    ].filter(d => d.value > 0);

    if (!mounted || !user) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
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
                        {/* Welcome Section */}
                        <div className="mb-6 md:mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div>
                                <h1 className="text-xl md:text-2xl font-bold text-foreground">Welcome, {user?.name}</h1>
                                <p className="text-muted-foreground text-xs md:text-sm mt-1">Here is the performance overview for {selectedRtom !== 'ALL' ? selectedRtom : selectedRegion !== 'ALL' ? selectedRegion : isAreaCoordinator ? 'your assigned areas' : 'all RTOMs'}.</p>
                            </div>
                            <div className="flex items-center gap-3 flex-wrap">
                                {/* Region/RTOM Filter Dropdowns */}
                                <div className="flex items-center gap-2 flex-wrap">
                                    {canFilterGlobally && (
                                        <Select
                                            value={selectedRegion}
                                            onValueChange={(val) => {
                                                setSelectedRegion(val);
                                                setSelectedRtom('ALL');
                                            }}
                                        >
                                            <SelectTrigger className="h-9 w-[150px] text-xs font-bold rounded-xl border border-border/40 bg-card/60 text-foreground hover:bg-card/85 transition-colors focus:ring-1 focus:ring-primary/45">
                                                <SelectValue placeholder="All Regions" />
                                            </SelectTrigger>
                                            <SelectContent className="border border-border/40 bg-card/95 text-foreground backdrop-blur-xl">
                                                <SelectItem value="ALL">All Regions</SelectItem>
                                                {stats?.availableRegions?.map(r => (
                                                    <SelectItem key={r} value={r}>{r}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    )}
                                    <Select
                                        value={selectedRtom}
                                        onValueChange={(val) => setSelectedRtom(val)}
                                    >
                                        <SelectTrigger className="h-9 w-[150px] text-xs font-bold rounded-xl border border-border/40 bg-card/60 text-foreground hover:bg-card/85 transition-colors focus:ring-1 focus:ring-primary/45">
                                            <SelectValue placeholder="All RTOMs" />
                                        </SelectTrigger>
                                        <SelectContent className="max-h-60 border border-border/40 bg-card/95 text-foreground backdrop-blur-xl">
                                            <SelectItem value="ALL">All RTOMs</SelectItem>
                                            {availableRtoms.map(r => (
                                                <SelectItem key={r} value={r}>{r}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    {(selectedRegion !== 'ALL' || selectedRtom !== 'ALL') && (
                                        <button
                                            onClick={() => { setSelectedRegion('ALL'); setSelectedRtom('ALL'); }}
                                            className="h-9 px-3 text-[10px] text-rose-400 hover:text-rose-300 font-bold uppercase tracking-wider bg-rose-500/10 border border-rose-500/20 hover:bg-rose-500/15 rounded-xl transition-all duration-200"
                                        >
                                            Clear Filters
                                        </button>
                                    )}
                                </div>
                                {(stats?.pat?.rejected || 0) > 0 && (
                                    <Link
                                        href="/service-orders/pat"
                                        className="flex items-center gap-2 px-4 py-2 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-sm font-bold animate-pulse hover:bg-rose-500/20 transition-colors"
                                    >
                                        <span className="relative flex h-2 w-2">
                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                                            <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
                                        </span>
                                        {stats?.pat?.rejected} PAT REJECTIONS NEED ATTENTION
                                    </Link>
                                )}
                            </div>
                        </div>

                        {/* Top Stats Cards */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-6 md:mb-8">
                            {isLoading ? (
                                Array(4).fill(0).map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)
                            ) : (
                                <>
                                    <StatCard label="Monthly Received" value={stats?.monthly?.total || 0} icon="📥" color="bg-blue-500" />
                                    <StatCard label="Monthly Invoicable" value={stats?.monthly?.invoicable || 0} icon="💰" color="bg-indigo-600" />
                                    <StatCard label="Monthly Completed" value={stats?.monthly?.completed || 0} icon="✅" color="bg-emerald-500" />
                                    <StatCard label="Monthly Return" value={stats?.monthly?.returned || 0} icon="🔄" color="bg-rose-500" />
                                </>
                            )}
                        </div>

                        {/* Overall Stats Cards */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 md:gap-4 mb-6 md:mb-8">
                            {isLoading ? (
                                Array(5).fill(0).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)
                            ) : (
                                <>
                                    <div className="glass-panel p-4 rounded-xl border border-border/40 flex flex-col justify-between hover:scale-[1.02] transition-transform duration-200">
                                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-tight">Brought Forward (2025)</p>
                                        <p className="text-xl font-black text-primary mt-1">{stats?.allTime?.broughtForward || 0}</p>
                                    </div>
                                    <div className="glass-panel p-4 rounded-xl border border-border/40 flex flex-col justify-between hover:scale-[1.02] transition-transform duration-200">
                                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-tight">2026 Total Received</p>
                                        <p className="text-xl font-black text-foreground mt-1">{stats?.allTime?.total || 0}</p>
                                    </div>
                                    <div className="glass-panel p-4 rounded-xl border border-border/40 flex flex-col justify-between hover:scale-[1.02] transition-transform duration-200">
                                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-tight">2026 Total Completed</p>
                                        <p className="text-xl font-black text-emerald-500 mt-1">{stats?.allTime?.completed || 0}</p>
                                    </div>
                                    <div className="glass-panel p-4 rounded-xl border border-border/40 flex flex-col justify-between hover:scale-[1.02] transition-transform duration-200">
                                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-tight">2026 PAT Pass</p>
                                        <p className="text-xl font-black text-sky-400 mt-1">{stats?.pat?.passed || 0}</p>
                                    </div>
                                    <div className="glass-panel p-4 rounded-xl border border-border/40 flex flex-col justify-between hover:scale-[1.02] transition-transform duration-200">
                                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-tight">2026 PAT Rejected</p>
                                        <p className="text-xl font-black text-rose-500 mt-1">{stats?.pat?.rejected || 0}</p>
                                    </div>
                                </>
                            )}
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
                            {/* Monthly Distribution */}
                            <div className="glass-panel p-6 rounded-2xl border border-border/40 shadow-sm flex flex-col hover:border-primary/10 transition-all duration-300">
                                <h3 className="font-bold text-foreground mb-6 flex items-center gap-2">
                                    <span className="w-1.5 h-4 bg-primary rounded-full"></span>
                                    Monthly Status
                                </h3>
                                <div className="h-64">
                                    {isLoading ? (
                                        <div className="h-full flex items-center justify-center"><Skeleton className="w-40 h-40 rounded-full" /></div>
                                    ) : (
                                        <ResponsiveContainer width="100%" height="100%">
                                            <PieChart>
                                                <Pie data={monthlyPieData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                                                    {monthlyPieData.map((_, index) => <Cell key={index} fill={COLORS[index % COLORS.length]} />)}
                                                </Pie>
                                                <Tooltip contentStyle={{ backgroundColor: 'var(--color-card)', borderRadius: '12px', border: '1px solid var(--color-border)', color: 'var(--color-foreground)' }} />
                                                <Legend />
                                            </PieChart>
                                        </ResponsiveContainer>
                                    )}
                                </div>
                            </div>

                            {/* PAT Status Distribution */}
                            <div className="glass-panel p-6 rounded-2xl border border-border/40 shadow-sm flex flex-col hover:border-primary/10 transition-all duration-300">
                                <h3 className="font-bold text-foreground mb-6 flex items-center gap-2">
                                    <span className="w-1.5 h-4 bg-indigo-500 rounded-full"></span>
                                    PAT Distribution
                                </h3>
                                <div className="h-64">
                                    {isLoading ? (
                                        <div className="h-full flex items-center justify-center"><Skeleton className="w-40 h-40 rounded-full" /></div>
                                    ) : (
                                        <ResponsiveContainer width="100%" height="100%">
                                            <PieChart>
                                                <Pie data={patData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                                                    <Cell fill="#10b981" /><Cell fill="#ef4444" /><Cell fill="#6366f1" />
                                                </Pie>
                                                <Tooltip contentStyle={{ backgroundColor: 'var(--color-card)', borderRadius: '12px', border: '1px solid var(--color-border)', color: 'var(--color-foreground)' }} />
                                                <Legend />
                                            </PieChart>
                                        </ResponsiveContainer>
                                    )}
                                </div>
                            </div>

                            {/* Completion Status Breakdown */}
                            <div className="glass-panel p-6 rounded-2xl border border-border/40 shadow-sm flex flex-col hover:border-primary/10 transition-all duration-300">
                                <h3 className="font-bold text-foreground mb-6 flex items-center gap-2">
                                    <span className="w-1.5 h-4 bg-emerald-500 rounded-full"></span>
                                    Completion Breakdown
                                </h3>
                                <div className="space-y-2 overflow-y-auto max-h-[250px] pr-2">
                                    {isLoading ? (
                                        Array(5).fill(0).map((_, i) => <div key={i} className="flex justify-between py-1"><Skeleton className="h-4 w-24" /><Skeleton className="h-4 w-12" /></div>)
                                    ) : (
                                        <>
                                            {stats?.statusBreakdown?.map((s, i) => (
                                                <div key={i} className="flex justify-between items-center p-2 hover:bg-primary/5 rounded-lg border-b border-border/10 last:border-0 transition-colors">
                                                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-tight">{s.status.replace(/_/g, ' ')}</span>
                                                    <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 rounded-md text-[10px] font-black border border-emerald-500/20">{s.count.toLocaleString()}</span>
                                                </div>
                                            ))}
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Lower Section Grid */}
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
                            {/* Contractor Performance */}
                            <div className="glass-panel p-6 rounded-2xl border border-border/40 shadow-sm flex flex-col lg:col-span-1 hover:border-primary/10 transition-all duration-300">
                                <h3 className="font-bold text-foreground mb-6 flex items-center gap-2">
                                    <span className="w-1.5 h-4 bg-blue-500 rounded-full"></span>
                                    Contractor Performance
                                </h3>
                                <div className="space-y-4 overflow-y-auto max-h-[300px] pr-2">
                                    {isLoading ? (
                                        Array(5).fill(0).map((_, i) => <div key={i} className="space-y-2"><Skeleton className="h-3 w-24" /><Skeleton className="h-2 w-full" /></div>)
                                    ) : (
                                        stats?.contractors?.map((c, i) => (
                                            <div key={i}>
                                                <div className="flex justify-between text-xs mb-1">
                                                    <span className="font-medium text-foreground">{c.name}</span>
                                                    <span className="text-muted-foreground">{c.completed}/{c.total} SODs</span>
                                                </div>
                                                <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                                                    <div className="h-full bg-gradient-to-r from-blue-500 to-sky-400 rounded-full transition-all duration-1000" style={{ width: `${c.percentage}%` }} />
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>

                            {/* Management Section placeholder or future module */}
                            <div className="glass-panel p-6 rounded-2xl border border-border/40 shadow-sm flex flex-col lg:col-span-2 hover:border-primary/10 transition-all duration-300">
                                <h3 className="font-bold text-foreground mb-6 flex items-center gap-2">
                                    <span className="w-1.5 h-4 bg-orange-500 rounded-full"></span>
                                    SOD Aging Report (Pending KPI)
                                </h3>
                                <div className="h-64 sm:h-80">
                                    {isLoading ? (
                                        <div className="h-full flex items-center justify-center"><Skeleton className="w-full h-full rounded-xl" /></div>
                                    ) : (
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={stats?.aging || []} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" opacity={0.3} />
                                                <XAxis
                                                    dataKey="range"
                                                    axisLine={false}
                                                    tickLine={false}
                                                    tick={{ fill: 'var(--color-muted-foreground)', fontSize: 12, fontWeight: 600 }}
                                                />
                                                <YAxis
                                                    axisLine={false}
                                                    tickLine={false}
                                                    tick={{ fill: 'var(--color-muted-foreground)', fontSize: 12 }}
                                                />
                                                <Tooltip
                                                    contentStyle={{ backgroundColor: 'var(--color-card)', borderRadius: '12px', border: '1px solid var(--color-border)', color: 'var(--color-foreground)', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.3)' }}
                                                    cursor={{ fill: 'var(--color-card)', opacity: 0.3 }}
                                                />
                                                <Bar
                                                    dataKey="count"
                                                    fill="#f59e0b"
                                                    radius={[6, 6, 0, 0]}
                                                    barSize={40}
                                                >
                                                    {stats?.aging?.map((entry, index) => (
                                                        <Cell
                                                            key={`cell-${index}`}
                                                            fill={entry.range.includes('10+') ? '#ef4444' : entry.range.includes('7-10') ? '#f97316' : '#f59e0b'}
                                                        />
                                                    ))}
                                                </Bar>
                                            </BarChart>
                                        </ResponsiveContainer>
                                    )}
                                </div>
                                <div className="mt-4 grid grid-cols-2 sm:grid-cols-5 gap-2">
                                    {stats?.aging?.map((a, i) => (
                                        <div key={i} className="p-2 rounded-lg bg-card/50 border border-border/40 text-center hover:scale-[1.02] transition-transform duration-200">
                                            <p className="text-[10px] font-bold text-muted-foreground uppercase">{a.range}</p>
                                            <p className={`text-sm font-black ${a.range.includes('10+') ? 'text-red-500' : 'text-foreground'}`}>{a.count}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* RTOM Comparison for Management */}
                        {isHigherManagement && (
                            <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 mb-8">
                                <div className="glass-panel rounded-2xl border border-border/40 shadow-sm overflow-hidden hover:border-primary/10 transition-all duration-300">
                                    <div className="p-6 border-b border-border/40 bg-card-foreground/[0.01]">
                                        <h3 className="font-bold text-foreground flex items-center gap-2">
                                            <span className="w-1.5 h-4 bg-indigo-500 rounded-full"></span>
                                            RTOM Performance
                                        </h3>
                                    </div>
                                    <div className="overflow-x-auto">
                                        <table className="w-full">
                                            <thead className="bg-card-foreground/[0.03]">
                                                <tr className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                                    <th className="px-6 py-3">RTOM</th>
                                                    <th className="px-6 py-3">Comp</th>
                                                    <th className="px-6 py-3">Pend</th>
                                                    <th className="px-6 py-3">Ret</th>
                                                    <th className="px-6 py-3">Progress</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-border/20 uppercase text-xs">
                                                {isLoading ? (
                                                    Array(3).fill(0).map((_, i) => <tr key={i} className="px-6 py-4"><td colSpan={5}><Skeleton className="h-4 w-full" /></td></tr>)
                                                ) : (
                                                    sortedRtoms.map((r, i) => (
                                                        <tr key={i} className="hover:bg-card-foreground/[0.02] transition-colors">
                                                            <td className="px-6 py-4 font-bold text-foreground">{r.name}</td>
                                                            <td className="px-6 py-4 text-emerald-500 font-bold">{r.completed}</td>
                                                            <td className="px-6 py-4 text-amber-500 font-bold">{r.pending}</td>
                                                            <td className="px-6 py-4 text-orange-500 font-bold">{r.returned}</td>
                                                            <td className="px-6 py-4">
                                                                 <div className="flex items-center gap-2">
                                                                    <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden max-w-[60px]">
                                                                        <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${(r.completed / (r.total || 1)) * 100}%` }} />
                                                                    </div>
                                                                    <span className="text-[10px] font-bold text-muted-foreground">{Math.round((r.completed / (r.total || 1)) * 100)}%</span>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    ))
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>

                                <div className="glass-panel rounded-2xl border border-border/40 shadow-sm overflow-hidden hover:border-primary/10 transition-all duration-300">
                                    <div className="p-6 border-b border-border/40 bg-card-foreground/[0.01] flex justify-between items-center">
                                        <h3 className="font-bold text-foreground flex items-center gap-2">
                                            <span className="w-1.5 h-4 bg-emerald-500 rounded-full"></span>
                                            RTOM PAT Summary
                                        </h3>
                                        <Link href="/service-orders/pat" className="text-xs text-primary font-bold hover:underline">View All</Link>
                                    </div>
                                    <div className="overflow-x-auto">
                                        <table className="w-full">
                                            <thead className="bg-card-foreground/[0.03]">
                                                <tr className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                                    <th className="px-6 py-3">RTOM</th>
                                                    <th className="px-6 py-3 text-emerald-500">Approved</th>
                                                    <th className="px-6 py-3 text-rose-500">Rejected</th>
                                                    <th className="px-6 py-3 text-orange-500">SLT Rej</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-border/20 uppercase text-xs">
                                                {isLoading ? (
                                                    Array(3).fill(0).map((_, i) => <tr key={i} className="px-6 py-4"><td colSpan={4}><Skeleton className="h-4 w-full" /></td></tr>)
                                                ) : (
                                                    sortedRtoms.map((r, i) => (
                                                        <tr key={i} className="hover:bg-card-foreground/[0.02] transition-colors">
                                                            <td className="px-6 py-4 font-bold text-foreground">{r.name}</td>
                                                            <td className="px-6 py-4 text-emerald-500 font-black">{r.patPassed || 0}</td>
                                                            <td className="px-6 py-4 text-rose-500 font-black">{r.patRejected || 0}</td>
                                                            <td className="px-6 py-4 text-orange-500 font-black">{r.sltsPatRejected || 0}</td>
                                                        </tr>
                                                    ))
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
}

function StatCard({ label, value, icon, color }: { label: string; value: number; icon: string; color: string }) {
    return (
        <div className="glass-panel p-4 md:p-5 rounded-2xl border border-border/40 shadow-sm flex items-center space-x-4 hover:-translate-y-1 hover:border-primary/20 hover:shadow-lg hover:shadow-primary/5 transition-all duration-300">
            <div className={`${color} w-10 h-10 md:w-12 md:h-12 rounded-xl flex items-center justify-center text-xl md:text-2xl shadow-lg shadow-inherit/25 text-white shrink-0`}>
                {icon}
            </div>
            <div className="min-w-0 flex-1">
                <p className="text-[10px] md:text-xs font-bold text-muted-foreground uppercase tracking-widest truncate">{label}</p>
                <p className="text-xl md:text-2xl font-black text-foreground mt-0.5">{value.toLocaleString()}</p>
            </div>
        </div>
    );
}


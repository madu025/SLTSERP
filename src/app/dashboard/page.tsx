"use client";

import React, { useEffect, useState } from 'react';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import {
    Tooltip, Legend, ResponsiveContainer,
    PieChart, Pie, Cell
} from 'recharts';
import { useQuery } from '@tanstack/react-query';
import { Skeleton } from '@/components/ui/skeleton';

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
}

const COLORS = ['#10b981', '#f59e0b', '#ef4444', '#6366f1'];

export default function DashboardPage() {
    const [user, setUser] = useState<{ id: string; name: string; role: string } | null>(() => {
        if (typeof window !== 'undefined') {
            const storedUser = localStorage.getItem('user');
            return storedUser ? JSON.parse(storedUser) : null;
        }
        return null;
    });
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);


    const { data: stats, isLoading } = useQuery<Stats>({
        queryKey: ['dashboard-stats', user?.id || 'guest'],
        queryFn: async () => {
            if (!user?.id) return null;
            const resp = await fetch(`/api/dashboard/stats?userId=${user.id}`);
            if (!resp.ok) throw new Error('Failed to fetch stats');
            return resp.json();
        },
        enabled: !!user?.id,
        staleTime: 5 * 60 * 1000, // 5 minutes
        gcTime: 30 * 60 * 1000, // 30 minutes
    });

    if (!mounted || (!user && !isLoading)) {
        return (
            <div className="min-h-screen flex bg-slate-50">
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

    const isAreaCoordinator = user?.role === 'AREA_COORDINATOR';
    const isHigherManagement = !!user?.role && ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'SA_MANAGER', 'AREA_MANAGER'].includes(user.role);

    return (
        <div className="min-h-screen flex bg-white">
            <Sidebar />
            <main className="flex-1 flex flex-col min-w-0 h-full">
                <Header />

                <div className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 space-y-6 md:space-y-8">
                    <div className="max-w-7xl mx-auto w-full">
                        {/* Welcome Section */}
                        <div className="mb-6 md:mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div>
                                <h1 className="text-xl md:text-2xl font-bold text-slate-900">Welcome, {user?.name}</h1>
                                <p className="text-slate-500 text-xs md:text-sm mt-1">Here is the performance overview for {isAreaCoordinator ? 'your assigned areas' : 'all RTOMs'}.</p>
                            </div>
                            {(stats?.pat?.rejected || 0) > 0 && (
                                <a
                                    href="/service-orders/pat"
                                    className="flex items-center gap-2 px-4 py-2 bg-red-50 border border-red-100 rounded-xl text-red-700 text-sm font-bold animate-pulse hover:bg-red-100 transition-colors"
                                >
                                    <span className="relative flex h-2 w-2">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                                    </span>
                                    {stats?.pat?.rejected} PAT REJECTIONS NEED ATTENTION
                                </a>
                            )}
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
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-6 md:mb-8">
                            {isLoading ? (
                                Array(4).fill(0).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)
                            ) : (
                                <>
                                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                                        <p className="text-xs font-semibold text-slate-500 uppercase">2026 Total Received</p>
                                        <p className="text-xl font-bold text-slate-900">{stats?.allTime?.total || 0}</p>
                                    </div>
                                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                                        <p className="text-xs font-semibold text-slate-500 uppercase">2026 Total Completed</p>
                                        <p className="text-xl font-bold text-slate-900">{stats?.allTime?.completed || 0}</p>
                                    </div>
                                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                                        <p className="text-xs font-semibold text-slate-500 uppercase">2026 PAT Pass</p>
                                        <p className="text-xl font-bold text-slate-900">{stats?.pat?.passed || 0}</p>
                                    </div>
                                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                                        <p className="text-xs font-semibold text-slate-500 uppercase">2026 PAT Rejected</p>
                                        <p className="text-xl font-bold text-red-600">{stats?.pat?.rejected || 0}</p>
                                    </div>
                                </>
                            )}
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
                            {/* Monthly Distribution */}
                            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col">
                                <h3 className="font-bold text-slate-800 mb-6 flex items-center gap-2">
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
                                                <Tooltip />
                                                <Legend />
                                            </PieChart>
                                        </ResponsiveContainer>
                                    )}
                                </div>
                            </div>

                            {/* PAT Status Distribution */}
                            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col">
                                <h3 className="font-bold text-slate-800 mb-6 flex items-center gap-2">
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
                                                <Tooltip />
                                                <Legend />
                                            </PieChart>
                                        </ResponsiveContainer>
                                    )}
                                </div>
                            </div>

                            {/* Completion Status Breakdown */}
                            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col">
                                <h3 className="font-bold text-slate-800 mb-6 flex items-center gap-2">
                                    <span className="w-1.5 h-4 bg-emerald-500 rounded-full"></span>
                                    Completion Breakdown
                                </h3>
                                <div className="space-y-2 overflow-y-auto max-h-[250px] pr-2">
                                    {isLoading ? (
                                        Array(5).fill(0).map((_, i) => <div key={i} className="flex justify-between py-1"><Skeleton className="h-4 w-24" /><Skeleton className="h-4 w-12" /></div>)
                                    ) : (
                                        <>
                                            {stats?.statusBreakdown?.map((s, i) => (
                                                <div key={i} className="flex justify-between items-center p-2 hover:bg-slate-50 rounded-lg border-b border-slate-50 last:border-0 transition-colors">
                                                    <span className="text-[10px] font-bold text-slate-600 uppercase tracking-tight">{s.status.replace(/_/g, ' ')}</span>
                                                    <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-md text-[10px] font-black border border-emerald-100">{s.count.toLocaleString()}</span>
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
                            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col lg:col-span-1">
                                <h3 className="font-bold text-slate-800 mb-6 flex items-center gap-2">
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
                                                    <span className="font-medium text-slate-700">{c.name}</span>
                                                    <span className="text-slate-500">{c.completed}/{c.total} SODs</span>
                                                </div>
                                                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                                                    <div className="h-full bg-blue-500 rounded-full transition-all duration-1000" style={{ width: `${c.percentage}%` }} />
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>

                            {/* Management Section placeholder or future module */}
                        </div>

                        {/* RTOM Comparison for Management */}
                        {isHigherManagement && (
                            <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 mb-8">
                                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                                    <div className="p-6 border-b border-slate-100">
                                        <h3 className="font-bold text-slate-800 flex items-center gap-2">
                                            <span className="w-1.5 h-4 bg-indigo-500 rounded-full"></span>
                                            RTOM Performance
                                        </h3>
                                    </div>
                                    <div className="overflow-x-auto">
                                        <table className="w-full">
                                            <thead className="bg-slate-50">
                                                <tr className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                                    <th className="px-6 py-3">RTOM</th>
                                                    <th className="px-6 py-3">Comp</th>
                                                    <th className="px-6 py-3">Pend</th>
                                                    <th className="px-6 py-3">Ret</th>
                                                    <th className="px-6 py-3">Progress</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100 uppercase text-xs">
                                                {isLoading ? (
                                                    Array(3).fill(0).map((_, i) => <tr key={i} className="px-6 py-4"><td colSpan={5}><Skeleton className="h-4 w-full" /></td></tr>)
                                                ) : (
                                                    stats?.rtoms?.map((r, i) => (
                                                        <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                                                            <td className="px-6 py-4 font-bold text-slate-900">{r.name}</td>
                                                            <td className="px-6 py-4 text-emerald-600 font-bold">{r.completed}</td>
                                                            <td className="px-6 py-4 text-amber-600 font-bold">{r.pending}</td>
                                                            <td className="px-6 py-4 text-orange-600 font-bold">{r.returned}</td>
                                                            <td className="px-6 py-4">
                                                                <div className="flex items-center gap-2">
                                                                    <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden max-w-[60px]">
                                                                        <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${(r.completed / (r.total || 1)) * 100}%` }} />
                                                                    </div>
                                                                    <span className="text-[10px] font-bold text-slate-600">{Math.round((r.completed / (r.total || 1)) * 100)}%</span>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    ))
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>

                                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                                    <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                                        <h3 className="font-bold text-slate-800 flex items-center gap-2">
                                            <span className="w-1.5 h-4 bg-emerald-500 rounded-full"></span>
                                            RTOM PAT Summary
                                        </h3>
                                        <a href="/service-orders/pat" className="text-xs text-primary font-bold hover:underline">View All</a>
                                    </div>
                                    <div className="overflow-x-auto">
                                        <table className="w-full">
                                            <thead className="bg-slate-50">
                                                <tr className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                                    <th className="px-6 py-3">RTOM</th>
                                                    <th className="px-6 py-3 text-emerald-600">Approved</th>
                                                    <th className="px-6 py-3 text-red-600">Rejected</th>
                                                    <th className="px-6 py-3 text-orange-600">SLT Rej</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100 uppercase text-xs">
                                                {isLoading ? (
                                                    Array(3).fill(0).map((_, i) => <tr key={i} className="px-6 py-4"><td colSpan={4}><Skeleton className="h-4 w-full" /></td></tr>)
                                                ) : (
                                                    stats?.rtoms?.map((r, i) => (
                                                        <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                                                            <td className="px-6 py-4 font-bold text-slate-900">{r.name}</td>
                                                            <td className="px-6 py-4 text-emerald-600 font-black">{r.patPassed || 0}</td>
                                                            <td className="px-6 py-4 text-red-600 font-black">{r.patRejected || 0}</td>
                                                            <td className="px-6 py-4 text-orange-600 font-black">{r.sltsPatRejected || 0}</td>
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
        <div className="bg-white p-3 md:p-5 rounded-xl md:rounded-2xl border border-slate-100 shadow-sm flex items-center space-x-3 md:space-x-4">
            <div className={`${color} w-10 h-10 md:w-12 md:h-12 rounded-lg md:rounded-xl flex items-center justify-center text-xl md:text-2xl shadow-lg shadow-inherit/20`}>
                {icon}
            </div>
            <div className="min-w-0 flex-1">
                <p className="text-[10px] md:text-xs font-medium text-slate-500 uppercase tracking-wider truncate">{label}</p>
                <p className="text-lg md:text-2xl font-bold text-slate-900">{value}</p>
            </div>
        </div>
    );
}


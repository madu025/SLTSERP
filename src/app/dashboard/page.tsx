"use client";

import React, { useEffect, useState } from 'react';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
    PieChart, Pie, Cell
} from 'recharts';
import { useQuery } from '@tanstack/react-query';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface Stats {
    monthly: {
        total: number;
        completed: number;
        pending: number;
        returned: number;
    };
    allTime: {
        total: number;
        completed: number;
        returned: number;
        pending: number;
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
    }>;
}

const COLORS = ['#10b981', '#f59e0b', '#ef4444', '#6366f1'];

export default function DashboardPage() {
    const [user, setUser] = useState<any>(null);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
        const storedUser = localStorage.getItem('user');
        if (storedUser) {
            setUser(JSON.parse(storedUser));
        }
    }, []);

    const { data: stats, isLoading, isError } = useQuery<Stats>({
        queryKey: ['dashboard-stats', user?.id],
        queryFn: async () => {
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
    const isHigherManagement = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'SA_MANAGER', 'AREA_MANAGER'].includes(user?.role);

    return (
        <div className="min-h-screen flex bg-white">
            <Sidebar />
            <main className="flex-1 flex flex-col min-w-0">
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
                                    <StatCard
                                        label="Monthly Received"
                                        value={stats?.monthly?.total || 0}
                                        icon="📥"
                                        color="bg-blue-500"
                                    />
                                    <StatCard
                                        label="Monthly Completed"
                                        value={stats?.monthly?.completed || 0}
                                        icon="✅"
                                        color="bg-emerald-500"
                                    />
                                    <StatCard
                                        label="Monthly Pending"
                                        value={stats?.monthly?.pending || 0}
                                        icon="⏳"
                                        color="bg-amber-500"
                                    />
                                    <StatCard
                                        label="Monthly Return"
                                        value={stats?.monthly?.returned || 0}
                                        icon="🔄"
                                        color="bg-rose-500"
                                    />
                                </>
                            )}
                        </div>

                        {/* Overall Stats Cards */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-6 md:mb-8">
                            {isLoading ? (
                                Array(4).fill(0).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)
                            ) : (
                                <>
                                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex flex-col justify-center">
                                        <p className="text-xs font-semibold text-slate-500 uppercase">{new Date().getFullYear()} Total Received</p>
                                        <p className="text-xl font-bold text-slate-900">{stats?.allTime?.total || 0}</p>
                                    </div>
                                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex flex-col justify-center">
                                        <p className="text-xs font-semibold text-slate-500 uppercase">{new Date().getFullYear()} Total Completed</p>
                                        <p className="text-xl font-bold text-slate-900">{stats?.allTime?.completed || 0}</p>
                                    </div>
                                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex flex-col justify-center">
                                        <p className="text-xs font-semibold text-slate-500 uppercase">{new Date().getFullYear()} PAT Pass</p>
                                        <p className="text-xl font-bold text-slate-900">{stats?.pat?.passed || 0}</p>
                                    </div>
                                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex flex-col justify-center">
                                        <p className="text-xs font-semibold text-slate-500 uppercase">{new Date().getFullYear()} PAT Rejected</p>
                                        <p className="text-xl font-bold text-slate-900 text-red-600">{stats?.pat?.rejected || 0}</p>
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
                                        <div className="h-full flex items-center justify-center">
                                            <Skeleton className="w-40 h-40 rounded-full" />
                                        </div>
                                    ) : (
                                        <ResponsiveContainer width="100%" height="100%">
                                            <PieChart>
                                                <Pie
                                                    data={monthlyPieData}
                                                    cx="50%"
                                                    cy="50%"
                                                    innerRadius={60}
                                                    outerRadius={80}
                                                    paddingAngle={5}
                                                    dataKey="value"
                                                >
                                                    {monthlyPieData.map((entry, index) => (
                                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                                    ))}
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
                                    <span className="w-1.5 h-4 bg-emerald-500 rounded-full"></span>
                                    PAT Distribution
                                </h3>
                                <div className="h-64">
                                    {isLoading ? (
                                        <div className="h-full flex items-center justify-center">
                                            <Skeleton className="w-40 h-40 rounded-full" />
                                        </div>
                                    ) : (
                                        <ResponsiveContainer width="100%" height="100%">
                                            <PieChart>
                                                <Pie
                                                    data={patData}
                                                    cx="50%"
                                                    cy="50%"
                                                    innerRadius={60}
                                                    outerRadius={80}
                                                    paddingAngle={5}
                                                    dataKey="value"
                                                >
                                                    <Cell fill="#10b981" />
                                                    <Cell fill="#ef4444" />
                                                    <Cell fill="#6366f1" />
                                                </Pie>
                                                <Tooltip />
                                                <Legend />
                                            </PieChart>
                                        </ResponsiveContainer>
                                    )}
                                </div>
                            </div>

                            {/* Contractor Performance */}
                            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col">
                                <h3 className="font-bold text-slate-800 mb-6 flex items-center gap-2">
                                    <span className="w-1.5 h-4 bg-blue-500 rounded-full"></span>
                                    Contractor Performance
                                </h3>
                                <div className="space-y-4 overflow-y-auto max-h-[250px] pr-2">
                                    {isLoading ? (
                                        Array(5).fill(0).map((_, i) => (
                                            <div key={i} className="space-y-2">
                                                <Skeleton className="h-3 w-24" />
                                                <Skeleton className="h-2 w-full" />
                                            </div>
                                        ))
                                    ) : (
                                        <>
                                            {stats?.contractors?.map((c, i) => (
                                                <div key={i}>
                                                    <div className="flex justify-between text-xs mb-1">
                                                        <span className="font-medium text-slate-700">{c.name}</span>
                                                        <span className="text-slate-500">{c.completed}/{c.total} SODs</span>
                                                    </div>
                                                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                                                        <div
                                                            className="h-full bg-blue-500 rounded-full transition-all duration-1000"
                                                            style={{ width: `${c.percentage}%` }}
                                                        />
                                                    </div>
                                                </div>
                                            ))}
                                            {(!stats?.contractors || stats?.contractors.length === 0) && (
                                                <p className="text-center text-slate-400 text-sm py-4">No contractor data found</p>
                                            )}
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* RTOM Comparison for Management */}
                        {isHigherManagement && (
                            <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 mb-8">
                                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                                    <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                                        <h3 className="font-bold text-slate-800 flex items-center gap-2">
                                            <span className="w-1.5 h-4 bg-indigo-500 rounded-full"></span>
                                            RTOM Performance
                                        </h3>
                                    </div>
                                    <div className="overflow-x-auto">
                                        <table className="w-full">
                                            <thead className="bg-slate-50">
                                                <tr>
                                                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">RTOM</th>
                                                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Comp</th>
                                                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Pend</th>
                                                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Progress</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100">
                                                {isLoading ? (
                                                    Array(3).fill(0).map((_, i) => (
                                                        <tr key={i}>
                                                            {Array(4).fill(0).map((_, j) => (
                                                                <td key={j} className="px-6 py-4"><Skeleton className="h-4 w-full" /></td>
                                                            ))}
                                                        </tr>
                                                    ))
                                                ) : (
                                                    stats?.rtoms?.map((r, i) => (
                                                        <tr key={i} className="hover:bg-slate-50/50 transition-colors text-sm">
                                                            <td className="px-6 py-4 font-semibold text-slate-900">{r.name}</td>
                                                            <td className="px-6 py-4 text-emerald-600 font-medium">{r.completed}</td>
                                                            <td className="px-6 py-4 text-amber-600 font-medium">{r.pending}</td>
                                                            <td className="px-6 py-4">
                                                                <div className="flex items-center gap-3">
                                                                    <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden max-w-[60px]">
                                                                        <div
                                                                            className="h-full bg-indigo-500 rounded-full"
                                                                            style={{ width: `${(r.completed / (r.total || 1)) * 100}%` }}
                                                                        />
                                                                    </div>
                                                                    <span className="text-[10px] font-medium text-slate-600">
                                                                        {Math.round((r.completed / (r.total || 1)) * 100)}%
                                                                    </span>
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
                                        <a href="/service-orders/pat" className="text-xs text-primary font-semibold hover:underline">View All</a>
                                    </div>
                                    <div className="overflow-x-auto">
                                        <table className="w-full">
                                            <thead className="bg-slate-50">
                                                <tr>
                                                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">RTOM</th>
                                                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider text-emerald-600">Approved</th>
                                                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider text-red-600">Rejected</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100">
                                                {isLoading ? (
                                                    Array(3).fill(0).map((_, i) => (
                                                        <tr key={i}>
                                                            {Array(3).fill(0).map((_, j) => (
                                                                <td key={j} className="px-6 py-4"><Skeleton className="h-4 w-full" /></td>
                                                            ))}
                                                        </tr>
                                                    ))
                                                ) : (
                                                    stats?.rtoms?.map((r: any, i) => (
                                                        <tr key={i} className="hover:bg-slate-50/50 transition-colors text-sm">
                                                            <td className="px-6 py-4 font-semibold text-slate-900">{r.name}</td>
                                                            <td className="px-6 py-4 text-emerald-600 font-bold">{r.patPassed || 0}</td>
                                                            <td className="px-6 py-4 text-red-600 font-bold">{r.patRejected || 0}</td>
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

function StatCard({ label, value, icon, color }: any) {
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


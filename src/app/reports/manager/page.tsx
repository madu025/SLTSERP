"use client";

import React, { useState } from 'react';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
    LineChart, Line, AreaChart, Area, ComposedChart
} from 'recharts';
import { Download, Filter, Calendar as CalendarIcon, ArrowUpRight, ArrowDownRight, Users, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const StatCard = ({ title, value, subtext, trend, trendValue, icon: Icon, colorClass }: any) => (
    <Card className="border-l-4" style={{ borderLeftColor: colorClass }}>
        <CardContent className="p-6">
            <div className="flex justify-between items-start">
                <div>
                    <p className="text-sm font-medium text-slate-500">{title}</p>
                    <h3 className="text-2xl font-bold mt-2 text-slate-900">{value}</h3>
                </div>
                <div className={`p-2 rounded-lg ${colorClass} bg-opacity-10`}>
                    <Icon className={`w-6 h-6 ${colorClass.replace('bg-', 'text-')}`} />
                </div>
            </div>
            <div className="mt-4 flex items-center text-sm">
                {trend === 'up' ? (
                    <ArrowUpRight className="w-4 h-4 text-emerald-600 mr-1" />
                ) : (
                    <ArrowDownRight className="w-4 h-4 text-rose-600 mr-1" />
                )}
                <span className={trend === 'up' ? 'text-emerald-600 font-medium' : 'text-rose-600 font-medium'}>
                    {trendValue}
                </span>
                <span className="text-slate-400 ml-2">{subtext}</span>
            </div>
        </CardContent>
    </Card>
);

export default function ManagerReportsPage() {
    // Data States - Moved inside component
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [period, setPeriod] = useState('6M'); // 1M, 3M, 6M, 1Y, CUSTOM
    const [customDateRange, setCustomDateRange] = useState<{ from?: Date, to?: Date }>({});

    React.useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                let url = '/api/reports/analytics?view=manager';

                // Add period parameters
                if (period === 'CUSTOM' && customDateRange.from && customDateRange.to) {
                    url += `&from=${customDateRange.from.toISOString()}&to=${customDateRange.to.toISOString()}`;
                } else {
                    url += `&period=${period}`;
                }

                const res = await fetch(url);
                if (res.ok) {
                    const json = await res.json();
                    setData(json);
                }
            } catch (error) {
                console.error("Failed to fetch report data");
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [period, customDateRange]);

    // Fallback Mock Data if API fails or no data (for demonstration continuity)
    const contractorPerformance = data?.contractorPerformance || [];
    const monthlyTrend = data?.monthlyTrend || [];
    const rtomPerformance = data?.rtomPerformance || [];
    const summary = data?.summary || { totalCompletion: 0, activeContractors: 0 };

    return (
        <div className="flex h-screen bg-slate-50 overflow-hidden">
            <Sidebar />
            <main className="flex-1 flex flex-col min-w-0 h-full overflow-y-auto">
                <Header />
                <div className="p-6 space-y-8 max-w-[1600px] mx-auto w-full">

                    {/* Page Header */}
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <div>
                            <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Executive Dashboard</h1>
                            <p className="text-slate-500 mt-1">Real-time insights for strategic decision making.</p>
                        </div>
                        <div className="flex gap-3 flex-wrap">
                            {/* Period Selector */}
                            <div className="flex gap-2 bg-white border border-slate-200 rounded-lg p-1">
                                {['Daily', 'Weekly', '1M', '3M', '6M', '1Y'].map((p) => (
                                    <button
                                        key={p}
                                        onClick={() => setPeriod(p)}
                                        className={`px-3 py-1.5 text-sm font-medium rounded transition-all ${period === p
                                            ? 'bg-blue-600 text-white shadow-sm'
                                            : 'text-slate-600 hover:bg-slate-100'
                                            }`}
                                    >
                                        {p}
                                    </button>
                                ))}
                                <button
                                    onClick={() => setPeriod('CUSTOM')}
                                    className={`px-3 py-1.5 text-sm font-medium rounded transition-all ${period === 'CUSTOM'
                                        ? 'bg-blue-600 text-white shadow-sm'
                                        : 'text-slate-600 hover:bg-slate-100'
                                        }`}
                                >
                                    <CalendarIcon className="w-4 h-4" />
                                </button>
                            </div>

                            {/* Custom Date Range Picker */}
                            {period === 'CUSTOM' && (
                                <div className="flex gap-2 items-center bg-white border border-slate-200 rounded-lg px-3 py-2">
                                    <input
                                        type="date"
                                        className="text-sm border-none focus:outline-none"
                                        onChange={(e) => setCustomDateRange(prev => ({ ...prev, from: new Date(e.target.value) }))}
                                    />
                                    <span className="text-slate-400">to</span>
                                    <input
                                        type="date"
                                        className="text-sm border-none focus:outline-none"
                                        onChange={(e) => setCustomDateRange(prev => ({ ...prev, to: new Date(e.target.value) }))}
                                    />
                                </div>
                            )}

                            <Button variant="outline" className="gap-2 bg-white">
                                <Filter className="w-4 h-4" /> Filter
                            </Button>
                            <Button className="gap-2 bg-slate-900 hover:bg-slate-800">
                                <Download className="w-4 h-4" /> Export Report
                            </Button>
                        </div>
                    </div>

                    {/* KPI Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        <StatCard
                            title="Total Completion"
                            value={summary.totalCompletion || 0}
                            subtext="Last 6 months"
                            trend="up"
                            trendValue="-"
                            icon={TrendingUp}
                            colorClass="text-emerald-600"
                        />
                        <StatCard
                            title="Pending Approvals"
                            value={data?.pendingApprovals || 0}
                            subtext="Requires attention"
                            trend="down"
                            trendValue="-"
                            icon={CalendarIcon}
                            colorClass="text-amber-500"
                        />
                        <StatCard
                            title="Active Contractors"
                            value={summary.activeContractors || 0}
                            subtext="Currently deployed"
                            trend="up"
                            trendValue="+2"
                            icon={Users}
                            colorClass="text-blue-500"
                        />
                        <StatCard
                            title="Material Efficiency"
                            value="94.2%"
                            subtext="Variance within limits"
                            trend="up"
                            trendValue="+1.2%"
                            icon={CalendarIcon}
                            colorClass="text-indigo-500"
                        />
                    </div>

                    {/* Main Charts Section */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                        {/* Completion Trend - Large Chart */}
                        <div className="lg:col-span-2 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                            <div className="mb-6">
                                <h3 className="text-lg font-bold text-slate-800">Monthly Completion Trend</h3>
                                <p className="text-sm text-slate-500">Actual completion vs Monthly Targets</p>
                            </div>
                            <div className="h-[350px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <ComposedChart data={monthlyTrend}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                                        <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: '#64748B' }} dy={10} />
                                        <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748B' }} />
                                        <Tooltip
                                            contentStyle={{ backgroundColor: '#1E293B', color: '#fff', borderRadius: '8px', border: 'none' }}
                                            itemStyle={{ color: '#fff' }}
                                        />
                                        <Legend />
                                        <Area type="monotone" dataKey="completed" fill="url(#colorCompleted)" stroke="#3B82F6" strokeWidth={3} fillOpacity={1} name="Actual Completed" />
                                        <Line type="monotone" dataKey="target" stroke="#94A3B8" strokeWidth={2} strokeDasharray="5 5" dot={false} name="Target" />
                                        <defs>
                                            <linearGradient id="colorCompleted" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.2} />
                                                <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                    </ComposedChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* RTOM Performance - Side Chart */}
                        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                            <div className="mb-6">
                                <h3 className="text-lg font-bold text-slate-800">Regional Performance</h3>
                                <p className="text-sm text-slate-500">Top performing RTOM areas</p>
                            </div>
                            <div className="h-[350px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart layout="vertical" data={rtomPerformance} barSize={20}>
                                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E2E8F0" />
                                        <XAxis type="number" hide />
                                        <YAxis dataKey="name" type="category" width={50} axisLine={false} tickLine={false} />
                                        <Tooltip cursor={{ fill: 'transparent' }} />
                                        <Bar dataKey="completion" fill="#10B981" radius={[0, 4, 4, 0] as any} name="Completion Rate %" background={{ fill: '#F1F5F9', radius: [0, 4, 4, 0] as any }} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </div>

                    {/* Contractor Performance Table/Chart */}
                    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                        <div className="flex justify-between items-center mb-6">
                            <div>
                                <h3 className="text-lg font-bold text-slate-800">Contractor Efficiency Analysis</h3>
                                <p className="text-sm text-slate-500">Breakdown of work distribution and status</p>
                            </div>
                            <Button variant="ghost" className="text-blue-600 text-sm">View Full Report</Button>
                        </div>
                        <div className="h-[300px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={contractorPerformance} barSize={40}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                                    <XAxis dataKey="name" axisLine={false} tickLine={false} />
                                    <YAxis axisLine={false} tickLine={false} />
                                    <Tooltip cursor={{ fill: '#F8FAFC' }} />
                                    <Legend />
                                    <Bar dataKey="completed" stackId="a" fill="#10B981" name="Completed" radius={[0, 0, 4, 4] as any} />
                                    <Bar dataKey="pending" stackId="a" fill="#F59E0B" name="Pending" />
                                    <Bar dataKey="returned" stackId="a" fill="#EF4444" name="Returned" radius={[4, 4, 0, 0] as any} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                </div>
            </main>
        </div>
    );
}

"use client";

import React, { useState } from 'react';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
    PieChart, Pie, Cell, LineChart, Line
} from 'recharts';
import {
    Users,
    AlertTriangle,
    CheckCircle2,
    Clock,
    Calendar as CalendarIcon,
    Filter,
    Download
} from "lucide-react";

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D'];

const StatCard = ({ title, value, icon: Icon, colorClass }: any) => (
    <Card className="border-l-4" style={{ borderLeftColor: colorClass }}>
        <CardContent className="p-6 flex items-center justify-between">
            <div>
                <p className="text-sm font-medium text-slate-500">{title}</p>
                <h3 className="text-2xl font-bold mt-1 text-slate-900">{value}</h3>
            </div>
            <div className={`p-3 rounded-full bg-slate-100`}>
                <Icon className={`w-6 h-6 text-slate-600`} />
            </div>
        </CardContent>
    </Card>
);

export default function AreaManagerReportsPage() {
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [period, setPeriod] = useState('6M');
    const [customDateRange, setCustomDateRange] = useState<{ from?: Date, to?: Date }>({});
    const [groupBy, setGroupBy] = useState('RTOM'); // REGION, ARM, RTOM, AREA_COORDINATOR

    React.useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                let url = '/api/reports/analytics?view=area';

                if (period === 'CUSTOM' && customDateRange.from && customDateRange.to) {
                    url += `&from=${customDateRange.from.toISOString()}&to=${customDateRange.to.toISOString()}`;
                } else {
                    url += `&period=${period}`;
                }

                url += `&groupBy=${groupBy}`;

                const res = await fetch(url);
                if (res.ok) {
                    const json = await res.json();
                    setData(json);
                }
            } catch (error) {
                console.error("Failed to fetch area report data");
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [period, customDateRange, groupBy]);

    const performanceData = data?.performanceData || [];
    const trendData = data?.trendData || [];
    const summary = data?.summary || { total: 0, completed: 0, pending: 0, returned: 0 };

    return (
        <div className="flex h-screen bg-slate-50 overflow-hidden">
            <Sidebar />
            <main className="flex-1 flex flex-col min-w-0 h-full overflow-y-auto">
                <Header />
                <div className="p-6 space-y-6 max-w-[1600px] mx-auto w-full">

                    {/* Header */}
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <div>
                            <h1 className="text-2xl font-bold text-slate-900">Area Performance Dashboard</h1>
                            <p className="text-slate-500">Operational insights for your assigned region</p>
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

                            {/* Custom Date Range */}
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

                            {/* Group By Selector */}
                            <div className="flex gap-2 bg-white border border-slate-200 rounded-lg p-1">
                                {[
                                    { key: 'REGION', label: 'Region' },
                                    { key: 'ARM', label: 'ARM' },
                                    { key: 'RTOM', label: 'RTOM' },
                                    { key: 'COORDINATOR', label: 'Coordinator' }
                                ].map((g) => (
                                    <button
                                        key={g.key}
                                        onClick={() => setGroupBy(g.key)}
                                        className={`px-3 py-1.5 text-sm font-medium rounded transition-all ${groupBy === g.key
                                            ? 'bg-emerald-600 text-white shadow-sm'
                                            : 'text-slate-600 hover:bg-slate-100'
                                            }`}
                                    >
                                        {g.label}
                                    </button>
                                ))}
                            </div>

                            <Button className="gap-2 bg-slate-900 hover:bg-slate-800">
                                <Download className="w-4 h-4" /> Export
                            </Button>
                        </div>
                    </div>

                    {/* Summary Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <StatCard title="Total Orders" value={summary.total} icon={Users} colorClass="#3B82F6" />
                        <StatCard title="Completed" value={summary.completed} icon={CheckCircle2} colorClass="#10B981" />
                        <StatCard title="Pending" value={summary.pending} icon={Clock} colorClass="#F59E0B" />
                        <StatCard title="Returned" value={summary.returned} icon={AlertTriangle} colorClass="#EF4444" />
                    </div>

                    {/* Charts */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                        {/* Performance by Group */}
                        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                            <h3 className="text-lg font-bold text-slate-800 mb-4">
                                Performance by {groupBy === 'COORDINATOR' ? 'Area Coordinator' : groupBy}
                            </h3>
                            <div className="h-[350px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={performanceData} layout="vertical">
                                        <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                                        <XAxis type="number" />
                                        <YAxis dataKey="name" type="category" width={100} />
                                        <Tooltip />
                                        <Legend />
                                        <Bar dataKey="completed" fill="#10B981" name="Completed" stackId="a" />
                                        <Bar dataKey="pending" fill="#F59E0B" name="Pending" stackId="a" />
                                        <Bar dataKey="returned" fill="#EF4444" name="Returned" stackId="a" />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* Trend Over Time */}
                        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                            <h3 className="text-lg font-bold text-slate-800 mb-4">Completion Trend</h3>
                            <div className="h-[350px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={trendData}>
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis dataKey="month" />
                                        <YAxis />
                                        <Tooltip />
                                        <Legend />
                                        <Line type="monotone" dataKey="completed" stroke="#10B981" strokeWidth={2} name="Completed" />
                                        <Line type="monotone" dataKey="pending" stroke="#F59E0B" strokeWidth={2} name="Pending" />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </div>

                    {/* Detailed Table */}
                    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                        <h3 className="text-lg font-bold text-slate-800 mb-4">Detailed Breakdown</h3>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-slate-100 border-b">
                                    <tr>
                                        <th className="px-4 py-3 text-left font-semibold text-slate-700">
                                            {groupBy === 'COORDINATOR' ? 'Area Coordinator' : groupBy}
                                        </th>
                                        <th className="px-4 py-3 text-right font-semibold text-slate-700">Total</th>
                                        <th className="px-4 py-3 text-right font-semibold text-slate-700">Completed</th>
                                        <th className="px-4 py-3 text-right font-semibold text-slate-700">Pending</th>
                                        <th className="px-4 py-3 text-right font-semibold text-slate-700">Returned</th>
                                        <th className="px-4 py-3 text-right font-semibold text-slate-700">Completion %</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    {performanceData.map((item: any, idx: number) => {
                                        const total = item.completed + item.pending + item.returned;
                                        const completionRate = total > 0 ? Math.round((item.completed / total) * 100) : 0;
                                        return (
                                            <tr key={idx} className="hover:bg-slate-50">
                                                <td className="px-4 py-3 font-medium text-slate-900">{item.name}</td>
                                                <td className="px-4 py-3 text-right text-slate-600">{total}</td>
                                                <td className="px-4 py-3 text-right text-emerald-600 font-medium">{item.completed}</td>
                                                <td className="px-4 py-3 text-right text-amber-600 font-medium">{item.pending}</td>
                                                <td className="px-4 py-3 text-right text-rose-600 font-medium">{item.returned}</td>
                                                <td className="px-4 py-3 text-right">
                                                    <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${completionRate >= 80 ? 'bg-emerald-100 text-emerald-700' :
                                                        completionRate >= 60 ? 'bg-amber-100 text-amber-700' :
                                                            'bg-rose-100 text-rose-700'
                                                        }`}>
                                                        {completionRate}%
                                                    </span>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>

                </div>
            </main>
        </div>
    );
}

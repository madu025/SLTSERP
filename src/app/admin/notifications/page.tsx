"use client";

import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Bell, Activity, CheckCircle, Clock, AlertTriangle } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import Header from "@/components/Header";
import Sidebar from "@/components/Sidebar";

const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#a855f7", "#ef4444"];

export default function NotificationAnalyticsPage() {
    const [period, setPeriod] = useState<"24h" | "7d" | "30d" | "all">("30d");

    const { data: analytics, isLoading } = useQuery({
        queryKey: ["notification-analytics", period],
        queryFn: async () => {
            const res = await fetch(`/api/notifications/analytics?period=${period}`);
            if (!res.ok) throw new Error("Failed to load analytics");
            const json = await res.json();
            return json.data;
        },
    });

    const typeData = analytics?.byType.map((t: any) => ({
        name: t.type,
        value: t.total,
        read: t.read
    })) || [];

    const priorityData = analytics?.byPriority.map((p: any) => ({
        name: p.priority,
        value: p.total
    })) || [];

    return (
        <div className="min-h-screen bg-[#060B19] text-white flex">
            <Sidebar />
            <div className="flex-1 flex flex-col min-w-0">
                <Header />
                <main className="flex-1 p-6 overflow-y-auto">
                    <div className="max-w-7xl mx-auto space-y-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-emerald-400">
                                    Notification Analytics
                                </h1>
                                <p className="text-white/60 text-sm mt-1">Track system engagement and alert effectiveness.</p>
                            </div>
                            <div className="bg-white/5 border border-white/10 rounded-lg p-1 flex">
                                {["24h", "7d", "30d", "all"].map((p) => (
                                    <button
                                        key={p}
                                        onClick={() => setPeriod(p as any)}
                                        className={`px-4 py-1.5 text-xs font-medium rounded-md transition-all ${period === p ? "bg-blue-500 text-white shadow-lg shadow-blue-500/20" : "text-white/60 hover:text-white hover:bg-white/5"}`}
                                    >
                                        {p.toUpperCase()}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {isLoading ? (
                            <div className="flex items-center justify-center h-64 text-white/40">Loading analytics...</div>
                        ) : (
                            <>
                                {/* KPIs */}
                                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                    <div className="bg-[#0D1B2A] border border-blue-500/20 rounded-xl p-5 shadow-[0_0_15px_rgba(0,174,239,0.05)]">
                                        <div className="flex items-center gap-3 text-blue-400 mb-2">
                                            <Bell className="w-5 h-5" />
                                            <h3 className="text-sm font-semibold">Total Sent</h3>
                                        </div>
                                        <p className="text-3xl font-black">{analytics?.totalSent.toLocaleString()}</p>
                                    </div>
                                    <div className="bg-[#0D1B2A] border border-emerald-500/20 rounded-xl p-5 shadow-[0_0_15px_rgba(16,185,129,0.05)]">
                                        <div className="flex items-center gap-3 text-emerald-400 mb-2">
                                            <CheckCircle className="w-5 h-5" />
                                            <h3 className="text-sm font-semibold">Overall Read Rate</h3>
                                        </div>
                                        <p className="text-3xl font-black">{analytics?.overallReadRate.toFixed(1)}%</p>
                                    </div>
                                    <div className="bg-[#0D1B2A] border border-purple-500/20 rounded-xl p-5 shadow-[0_0_15px_rgba(168,85,247,0.05)]">
                                        <div className="flex items-center gap-3 text-purple-400 mb-2">
                                            <Clock className="w-5 h-5" />
                                            <h3 className="text-sm font-semibold">Avg Read Time</h3>
                                        </div>
                                        <p className="text-3xl font-black">{analytics?.avgReadTimeMinutes.toFixed(1)} <span className="text-lg text-white/50 font-normal">min</span></p>
                                    </div>
                                    <div className="bg-[#0D1B2A] border border-red-500/20 rounded-xl p-5 shadow-[0_0_15px_rgba(239,68,68,0.05)]">
                                        <div className="flex items-center gap-3 text-red-400 mb-2">
                                            <AlertTriangle className="w-5 h-5" />
                                            <h3 className="text-sm font-semibold">Critical Ignored</h3>
                                        </div>
                                        <p className="text-3xl font-black">{analytics?.byPriority.find((p: any) => p.priority === 'CRITICAL')?.total - (analytics?.byPriority.find((p: any) => p.priority === 'CRITICAL')?.read || 0) || 0}</p>
                                    </div>
                                </div>

                                {/* Charts */}
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
                                    <div className="bg-[#0D1B2A] border border-white/5 rounded-xl p-6">
                                        <h3 className="text-sm font-semibold text-white/80 mb-6">Notifications by Type</h3>
                                        <div className="h-64">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <BarChart data={typeData}>
                                                    <XAxis dataKey="name" stroke="rgba(255,255,255,0.2)" fontSize={12} />
                                                    <YAxis stroke="rgba(255,255,255,0.2)" fontSize={12} />
                                                    <RechartsTooltip cursor={{ fill: 'rgba(255,255,255,0.05)' }} contentStyle={{ background: '#1e293b', border: 'none', borderRadius: '8px' }} />
                                                    <Bar dataKey="value" name="Total Sent" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                                                    <Bar dataKey="read" name="Read" fill="#10b981" radius={[4, 4, 0, 0]} />
                                                </BarChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </div>

                                    <div className="bg-[#0D1B2A] border border-white/5 rounded-xl p-6">
                                        <h3 className="text-sm font-semibold text-white/80 mb-6">Distribution by Priority</h3>
                                        <div className="h-64">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <PieChart>
                                                    <Pie
                                                        data={priorityData}
                                                        cx="50%"
                                                        cy="50%"
                                                        innerRadius={60}
                                                        outerRadius={80}
                                                        paddingAngle={5}
                                                        dataKey="value"
                                                    >
                                                        {priorityData.map((entry: any, index: number) => (
                                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                                        ))}
                                                    </Pie>
                                                    <RechartsTooltip contentStyle={{ background: '#1e293b', border: 'none', borderRadius: '8px' }} />
                                                </PieChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                </main>
            </div>
        </div>
    );
}

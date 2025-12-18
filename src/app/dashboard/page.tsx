"use client";

import React from 'react';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';

export default function DashboardPage() {
    return (
        <div className="min-h-screen flex bg-slate-50">
            <Sidebar />
            <main className="flex-1 flex flex-col min-w-0">
                <Header />

                {/* Dashboard Content */}
                <div className="flex-1 overflow-y-auto p-8">
                    <div className="max-w-7xl mx-auto">
                        <div className="mb-8">
                            <h1 className="text-2xl font-bold text-slate-900">Project Overview</h1>
                            <p className="text-slate-500">Real-time monitoring of all active construction projects.</p>
                        </div>

                        {/* Stats Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                            {[
                                { label: 'Active Projects', value: '12', icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4', color: 'bg-primary' },
                                { label: 'Staff Count', value: '400', icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 005.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z', color: 'bg-emerald-500' },
                                { label: 'Weekly Progress', value: '72%', icon: 'M13 10V3L4 14h7v7l9-11h-7z', color: 'bg-amber-500' },
                                { label: 'Open Invoices', value: '15', icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z', color: 'bg-rose-500' },
                            ].map((stat, i) => (
                                <div key={i} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center space-x-4 transition-transform hover:scale-[1.02] cursor-pointer">
                                    <div className={`${stat.color} p-3 rounded-xl text-white shadow-lg shadow-inherit/20`}>
                                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={stat.icon} />
                                        </svg>
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium text-slate-500">{stat.label}</p>
                                        <p className="text-2xl font-bold text-slate-900">{stat.value}</p>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                            {/* Material Visualization Placeholder */}
                            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-8">
                                <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center">
                                    <span className="w-2 h-6 bg-primary rounded-full mr-3"></span>
                                    Material Consumption
                                </h3>
                                <div className="aspect-[16/9] flex items-center justify-center bg-slate-50 rounded-xl border border-dashed border-slate-200 text-slate-400">
                                    [Recharts Pie Chart Placeholder]
                                </div>
                            </div>

                            {/* Progress Chart Placeholder */}
                            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-8">
                                <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center">
                                    <span className="w-2 h-6 bg-emerald-500 rounded-full mr-3"></span>
                                    Project Progress (Weekly)
                                </h3>
                                <div className="aspect-[16/9] flex items-center justify-center bg-slate-50 rounded-xl border border-dashed border-slate-200 text-slate-400">
                                    [Recharts Bar Chart Placeholder]
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}

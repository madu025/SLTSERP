"use client";

import React, { useState, useEffect } from 'react';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import Link from 'next/link';

export default function AdminPanel() {
    const [stats, setStats] = useState({
        totalUsers: 0,
        totalStaff: 0,
        totalOpmcs: 0,
        totalContractors: 0
    });

    useEffect(() => {
        fetchStats();
    }, []);

    const fetchStats = async () => {
        try {
            const [usersRes, staffRes, opmcsRes, contractorsRes] = await Promise.all([
                fetch('/api/users'),
                fetch('/api/staff'),
                fetch('/api/opmcs'),
                fetch('/api/contractors')
            ]);

            const users = await usersRes.json();
            const staff = await staffRes.json();
            const opmcs = await opmcsRes.json();
            const contractors = await contractorsRes.json();

            setStats({
                totalUsers: Array.isArray(users) ? users.length : 0,
                totalStaff: Array.isArray(staff) ? staff.length : 0,
                totalOpmcs: Array.isArray(opmcs) ? opmcs.length : 0,
                totalContractors: Array.isArray(contractors) ? contractors.length : 0
            });
        } catch (err) {
            console.error('Failed to fetch stats:', err);
        }
    };

    const modules = [
        {
            title: 'User Management',
            description: 'Manage system users, roles, and access permissions',
            href: '/admin/users',
            icon: (
                <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
            ),
            stat: stats.totalUsers,
            statLabel: 'Active Users',
            color: 'blue'
        },
        {
            title: 'Staff Hierarchy',
            description: 'Organize reporting structure and manage organizational chart',
            href: '/admin/staff',
            icon: (
                <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
            ),
            stat: stats.totalStaff,
            statLabel: 'Staff Members',
            color: 'indigo'
        },
        {
            title: 'OPMC Registration',
            description: 'Manage Outside Plant Maintenance Centers and locations',
            href: '/admin/opmcs',
            icon: (
                <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
            ),
            stat: stats.totalOpmcs,
            statLabel: 'OPMCs',
            color: 'emerald'
        },
        {
            title: 'Contractor Management',
            description: 'Register contractors, manage teams, and track agreements',
            href: '/admin/contractors',
            icon: (
                <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
            ),
            stat: stats.totalContractors,
            statLabel: 'Contractors',
            color: 'purple'
        }
    ];

    const colorClasses = {
        blue: {
            bg: 'bg-blue-50',
            icon: 'text-blue-600',
            border: 'border-blue-100',
            hover: 'hover:border-blue-300 hover:shadow-blue-100',
            stat: 'text-blue-600'
        },
        indigo: {
            bg: 'bg-indigo-50',
            icon: 'text-indigo-600',
            border: 'border-indigo-100',
            hover: 'hover:border-indigo-300 hover:shadow-indigo-100',
            stat: 'text-indigo-600'
        },
        emerald: {
            bg: 'bg-emerald-50',
            icon: 'text-emerald-600',
            border: 'border-emerald-100',
            hover: 'hover:border-emerald-300 hover:shadow-emerald-100',
            stat: 'text-emerald-600'
        },
        purple: {
            bg: 'bg-purple-50',
            icon: 'text-purple-600',
            border: 'border-purple-100',
            hover: 'hover:border-purple-300 hover:shadow-purple-100',
            stat: 'text-purple-600'
        }
    };

    return (
        <div className="min-h-screen flex bg-slate-50">
            <Sidebar />
            <main className="flex-1 flex flex-col min-w-0">
                <Header />

                <div className="flex-1 overflow-y-auto p-8">
                    <div className="max-w-7xl mx-auto">
                        {/* Header */}
                        <div className="mb-10">
                            <h1 className="text-4xl font-bold text-slate-900 tracking-tight">Administration Panel</h1>
                            <p className="text-slate-500 mt-2 text-lg">Manage users, organizational structure, and system configuration</p>
                        </div>

                        {/* Module Cards */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {modules.map((module) => {
                                const colors = colorClasses[module.color as keyof typeof colorClasses];
                                return (
                                    <Link
                                        key={module.href}
                                        href={module.href}
                                        className={`group relative bg-white rounded-3xl border-2 ${colors.border} ${colors.hover} transition-all duration-300 overflow-hidden`}
                                    >
                                        <div className="p-8">
                                            {/* Icon */}
                                            <div className={`${colors.bg} w-20 h-20 rounded-2xl flex items-center justify-center ${colors.icon} mb-6 group-hover:scale-110 transition-transform duration-300`}>
                                                {module.icon}
                                            </div>

                                            {/* Content */}
                                            <h3 className="text-2xl font-bold text-slate-900 mb-3 group-hover:text-blue-600 transition-colors">
                                                {module.title}
                                            </h3>
                                            <p className="text-slate-600 text-sm leading-relaxed mb-6">
                                                {module.description}
                                            </p>

                                            {/* Stats */}
                                            <div className="flex items-baseline space-x-2">
                                                <span className={`text-3xl font-bold ${colors.stat}`}>
                                                    {module.stat}
                                                </span>
                                                <span className="text-slate-500 text-sm font-medium">
                                                    {module.statLabel}
                                                </span>
                                            </div>

                                            {/* Arrow Icon */}
                                            <div className="absolute bottom-8 right-8 text-slate-300 group-hover:text-blue-600 group-hover:translate-x-1 transition-all duration-300">
                                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                                                </svg>
                                            </div>
                                        </div>

                                        {/* Decorative gradient */}
                                        <div className={`absolute top-0 right-0 w-32 h-32 ${colors.bg} rounded-full -mr-16 -mt-16 opacity-50 group-hover:opacity-70 transition-opacity`}></div>
                                    </Link>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}

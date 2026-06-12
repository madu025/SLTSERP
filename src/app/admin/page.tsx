"use client";

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import Link from 'next/link';
import {
    Users, Briefcase, Settings, Building2, HardHat, ChevronRight,
    Warehouse, Receipt, Shield, HistoryIcon, UserCog, Upload, Terminal,
    Network, ClipboardList, Layers
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

const modules = [
    {
        title: 'User Management',
        description: 'Manage system user accounts, roles and passwords',
        href: '/admin/users',
        icon: Users,
        color: 'text-blue-600', bgColor: 'bg-blue-50', borderColor: 'border-blue-100'
    },
    {
        title: 'Staff Hierarchy',
        description: 'Organize reporting structure and org chart',
        href: '/admin/staff',
        icon: Network,
        color: 'text-indigo-600', bgColor: 'bg-indigo-50', borderColor: 'border-indigo-100'
    },
    {
        title: 'RTOM Management',
        description: 'Manage Regional Telecom Offices and store assignments',
        href: '/admin/opmcs',
        icon: Building2,
        color: 'text-emerald-600', bgColor: 'bg-emerald-50', borderColor: 'border-emerald-100'
    },
    {
        title: 'Contractor Management',
        description: 'Register contractors, teams and agreements',
        href: '/admin/contractors',
        icon: HardHat,
        color: 'text-amber-600', bgColor: 'bg-amber-50', borderColor: 'border-amber-100'
    },
    {
        title: 'Store Management',
        description: 'Manage inventory stores and branch locations',
        href: '/admin/stores',
        icon: Warehouse,
        color: 'text-violet-600', bgColor: 'bg-violet-50', borderColor: 'border-violet-100'
    },
    {
        title: 'User Permissions',
        description: 'Configure role-based access and permission rules',
        href: '/admin/user-permissions',
        icon: Shield,
        color: 'text-rose-600', bgColor: 'bg-rose-50', borderColor: 'border-rose-100'
    },
    {
        title: 'Access Rules',
        description: 'Set access restrictions and override policies',
        href: '/admin/access-rules',
        icon: ClipboardList,
        color: 'text-cyan-600', bgColor: 'bg-cyan-50', borderColor: 'border-cyan-100'
    },
    {
        title: 'System Audit Log',
        description: 'View full system event log and user activity history',
        href: '/admin/audit-logs',
        icon: HistoryIcon,
        color: 'text-slate-600', bgColor: 'bg-slate-100', borderColor: 'border-slate-200'
    },
    {
        title: 'SOD Revenue Config',
        description: 'Configure revenue amounts per service order type',
        href: '/admin/sod-revenue',
        icon: Receipt,
        color: 'text-teal-600', bgColor: 'bg-teal-50', borderColor: 'border-teal-100'
    },
    {
        title: 'Contractor Pricing',
        description: 'Set contractor payment rates and billing schedules',
        href: '/admin/contractor-payment',
        icon: Briefcase,
        color: 'text-orange-600', bgColor: 'bg-orange-50', borderColor: 'border-orange-100'
    },
    {
        title: 'Table Settings',
        description: 'Configure column visibility and order for all tables',
        href: '/admin/settings',
        icon: Settings,
        color: 'text-slate-600', bgColor: 'bg-slate-100', borderColor: 'border-slate-200'
    },
    {
        title: 'SOD Bulk Import',
        description: 'Import historical service order data from spreadsheets',
        href: '/admin/sod-import',
        icon: Upload,
        color: 'text-blue-600', bgColor: 'bg-blue-50', borderColor: 'border-blue-100'
    },
    {
        title: 'Sections & Roles',
        description: 'Configure system sections and role definitions',
        href: '/admin/sections',
        icon: Layers,
        color: 'text-purple-600', bgColor: 'bg-purple-50', borderColor: 'border-purple-100'
    },
    {
        title: 'Phoenix Bridge',
        description: 'System bridge monitor and diagnostic terminal',
        href: '/admin/test-extension',
        icon: Terminal,
        color: 'text-slate-600', bgColor: 'bg-slate-100', borderColor: 'border-slate-200'
    },
];

export default function AdminPanel() {
    const { data: stats = { users: 0, staff: 0, opmcs: 0, contractors: 0 } } = useQuery({
        queryKey: ["admin-stats"],
        queryFn: async () => {
            const res = await fetch('/api/admin/stats');
            if (!res.ok) throw new Error('Failed to fetch stats');
            return res.json();
        },
        staleTime: 600000,
        refetchOnWindowFocus: false
    });

    const statCards = [
        { label: 'System Users', value: stats.users, icon: Users, color: 'text-blue-600', bg: 'bg-blue-50' },
        { label: 'Staff Members', value: stats.staff, icon: Network, color: 'text-indigo-600', bg: 'bg-indigo-50' },
        { label: 'RTOMs', value: stats.opmcs, icon: Building2, color: 'text-emerald-600', bg: 'bg-emerald-50' },
        { label: 'Contractors', value: stats.contractors, icon: HardHat, color: 'text-amber-600', bg: 'bg-amber-50' },
    ];

    return (
        <div className="h-screen flex bg-slate-50 overflow-hidden">
            <Sidebar />
            <main className="flex-1 flex flex-col min-w-0 h-full">
                <Header />
                <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">

                    {/* Page Header */}
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                                <UserCog className="w-5 h-5 text-slate-500" />
                                Administration Panel
                            </h1>
                            <p className="text-xs text-slate-500 mt-0.5">Manage users, organization, stores, and system configuration</p>
                        </div>
                    </div>

                    {/* Stats Grid */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                        {statCards.map((s) => (
                            <Card key={s.label} className="rounded-xl border border-slate-200 bg-white shadow-none">
                                <CardContent className="p-3 flex items-center justify-between">
                                    <div>
                                        <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">{s.label}</p>
                                        <p className="text-xl font-black text-slate-900 mt-0.5">{s.value}</p>
                                    </div>
                                    <div className={`h-9 w-9 rounded-lg ${s.bg} ${s.color} flex items-center justify-center`}>
                                        <s.icon className="w-4 h-4" />
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>

                    {/* Module Grid */}
                    <div>
                        <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider mb-3">Administration Modules</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                            {modules.map((module) => (
                                <Link key={module.href} href={module.href}>
                                    <div className={`group bg-white rounded-xl border ${module.borderColor} hover:border-slate-300 hover:shadow-md transition-all duration-200 p-4 flex items-start gap-3 cursor-pointer`}>
                                        <div className={`w-9 h-9 rounded-lg ${module.bgColor} ${module.color} flex items-center justify-center flex-shrink-0`}>
                                            <module.icon className="w-4 h-4" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between gap-1">
                                                <p className="text-sm font-bold text-slate-800 group-hover:text-blue-600 transition-colors leading-tight">{module.title}</p>
                                                <ChevronRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-blue-400 flex-shrink-0 transition-colors" />
                                            </div>
                                            <p className="text-[10px] text-slate-500 mt-0.5 leading-relaxed">{module.description}</p>
                                        </div>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}

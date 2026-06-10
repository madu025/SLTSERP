"use client";

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import Link from 'next/link';
import { Users, Briefcase, Settings, Network, HardHat, ChevronRight } from "lucide-react";
import InventoryAlerts from '@/components/dashboard/InventoryAlerts';

export default function AdminPanel() {

    // --- QUERIES ---
    const { data: stats = { users: 0, staff: 0, opmcs: 0, contractors: 0 } } = useQuery({
        queryKey: ["admin-stats"],
        queryFn: async () => {
            const res = await fetch('/api/admin/stats');
            if (!res.ok) throw new Error('Failed to fetch stats');
            return res.json();
        },
        staleTime: 600000, // 👈 Optimized: Keep stats fresh for 10 minutes
        refetchOnWindowFocus: false // 👈 Optimized: Don't refresh on tab Switch
    });


    const modules = [
        {
            title: 'User Management',
            description: 'Manage system users, roles, and access permissions',
            href: '/admin/users',
            icon: Users,
            stat: stats.users,
            statLabel: 'Active Users',
            color: 'text-blue-400',
            bgColor: 'bg-blue-500/10',
            borderColor: 'border-border/40 hover:border-blue-500/30'
        },
        {
            title: 'Staff Hierarchy',
            description: 'Organize reporting structure and org chart',
            href: '/admin/staff',
            icon: Network,
            stat: stats.staff,
            statLabel: 'Staff Members',
            color: 'text-indigo-400',
            bgColor: 'bg-indigo-500/10',
            borderColor: 'border-border/40 hover:border-indigo-500/30'
        },
        {
            title: 'RTOM Registration',
            description: 'Manage Regional Telecom Offices',
            href: '/admin/opmcs',
            icon: Briefcase,
            stat: stats.opmcs,
            statLabel: 'RTOMs',
            color: 'text-emerald-400',
            bgColor: 'bg-emerald-500/10',
            borderColor: 'border-border/40 hover:border-emerald-500/30'
        },
        {
            title: 'Contractor Management',
            description: 'Register contractors, teams & agreements',
            href: '/admin/contractors',
            icon: HardHat,
            stat: stats.contractors,
            statLabel: 'Contractors',
            color: 'text-amber-400',
            bgColor: 'bg-amber-500/10',
            borderColor: 'border-border/40 hover:border-amber-500/30'
        },
        {
            title: 'Table Settings',
            description: 'Configure column visibility and order for tables',
            href: '/admin/settings',
            icon: Settings,
            stat: 'Config',
            statLabel: 'Table Layouts',
            color: 'text-slate-400',
            bgColor: 'bg-slate-500/10',
            borderColor: 'border-border/40 hover:border-slate-500/30'
        }
    ];

    return (
        <div className="h-screen flex bg-background text-foreground overflow-hidden">
            <Sidebar />
            <main className="flex-1 flex flex-col min-w-0 h-full">
                <Header />
                <div className="flex-1 overflow-y-auto p-4 md:p-8">
                    <div className="max-w-7xl mx-auto space-y-8">
                        <div>
                            <h1 className="text-2xl font-bold text-foreground tracking-tight">Administration Panel</h1>
                            <p className="text-muted-foreground mt-1">Manage users, organizational structure, and system configuration</p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <InventoryAlerts />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {modules.map((module) => (
                                <Link key={module.href} href={module.href}>
                                    <div className={`group relative h-full bg-card/60 backdrop-blur-sm rounded-2xl border transition-all duration-300 hover:shadow-lg hover:-translate-y-1 ${module.borderColor}`}>
                                        <div className="p-6">
                                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${module.bgColor} ${module.color}`}>
                                                <module.icon className="w-6 h-6" />
                                            </div>

                                            <h3 className="text-lg font-bold text-foreground mb-2 group-hover:text-primary transition-colors">
                                                {module.title}
                                            </h3>
                                            <p className="text-sm text-muted-foreground mb-6">
                                                {module.description}
                                            </p>

                                            <div className="flex items-center justify-between mt-auto">
                                                <div>
                                                    <div className={`text-2xl font-bold ${module.color}`}>
                                                        {module.stat}
                                                    </div>
                                                    <div className="text-[10px] uppercase font-bold text-muted-foreground/60 tracking-wider">
                                                        {module.statLabel}
                                                    </div>
                                                </div>
                                                <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-muted-foreground group-hover:bg-primary group-hover:text-white transition-all">
                                                    <ChevronRight className="w-4 h-4" />
                                                </div>
                                            </div>
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

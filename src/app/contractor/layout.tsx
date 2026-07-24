"use client";

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import RoleGuard from '@/components/RoleGuard';
import Header from '@/components/Header';
import { 
    LayoutDashboard, 
    Package, 
    ClipboardList, 
    Banknote, 
    RefreshCw, 
    ShieldCheck, 
    Truck 
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface ContractorLayoutProps {
    children: React.ReactNode;
}

export default function ContractorLayout({ children }: ContractorLayoutProps) {
    const pathname = usePathname();

    const navItems = [
        {
            title: 'Overview',
            path: '/contractor/dashboard',
            icon: LayoutDashboard,
        },
        {
            title: 'My Van Stock',
            path: '/contractor/inventory',
            icon: Package,
        },
        {
            title: 'Field SODs',
            path: '/contractor/sods',
            icon: ClipboardList,
        },
        {
            title: 'Claims & Payments',
            path: '/contractor/finance',
            icon: Banknote,
        },
        {
            title: 'MRN Returns',
            path: '/contractor/mrns',
            icon: RefreshCw,
        },
    ];

    return (
        <RoleGuard allowedRoles={['SUPER_ADMIN', 'ADMIN', 'CONTRACTOR_SUPERVISOR', 'CONTRACTOR_TECHNICIAN', 'CONTRACTOR_FINANCE', 'STORES_MANAGER', 'OSP_MANAGER']}>
            <div className="flex flex-col min-h-screen bg-slate-950 text-slate-100 font-sans pb-16 md:pb-0">
                <Header />
                
                {/* Mobile Top Sub-Header */}
                <div className="bg-slate-900 border-b border-slate-800 px-4 py-2.5 flex items-center justify-between shadow-md">
                    <div className="flex items-center gap-2">
                        <Truck className="w-5 h-5 text-amber-400" />
                        <div>
                            <h2 className="text-xs font-black text-white uppercase tracking-wider">Contractor Field Portal</h2>
                            <p className="text-[10px] text-slate-400 font-mono">Live Inventory & Field Operations</p>
                        </div>
                    </div>
                    <span className="px-2 py-0.5 text-[9px] font-black uppercase rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                        ONLINE PWA
                    </span>
                </div>

                {/* Main Content Area */}
                <main className="flex-1 p-4 md:p-6 max-w-7xl mx-auto w-full">
                    {children}
                </main>

                {/* Mobile Bottom Fixed Navigation Bar */}
                <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-slate-900/95 backdrop-blur border-t border-slate-800 z-50 flex items-center justify-around h-14 px-2 shadow-2xl">
                    {navItems.map((item) => {
                        const Icon = item.icon;
                        const isActive = pathname === item.path || pathname.startsWith(`${item.path}/`);
                        return (
                            <Link
                                key={item.path}
                                href={item.path}
                                className={cn(
                                    "flex flex-col items-center justify-center w-full h-full text-[10px] font-bold transition-all gap-0.5",
                                    isActive 
                                        ? "text-amber-400 font-black scale-105" 
                                        : "text-slate-400 hover:text-slate-200"
                                )}
                            >
                                <Icon className={cn("w-4 h-4", isActive ? "text-amber-400" : "text-slate-400")} />
                                <span>{item.title}</span>
                            </Link>
                        );
                    })}
                </nav>
            </div>
        </RoleGuard>
    );
}

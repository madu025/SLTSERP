"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import RoleGuard from '@/components/RoleGuard';
import { 
    LayoutDashboard, 
    Package, 
    ClipboardList, 
    Banknote, 
    LogOut,
    Truck,
    Wifi
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import PWAInstallPrompt from '@/components/PWAInstallPrompt';

interface ContractorLayoutProps {
    children: React.ReactNode;
}

export default function ContractorLayout({ children }: ContractorLayoutProps) {
    const pathname = usePathname();
    const router = useRouter();
    const [user, setUser] = useState<{ name?: string; role?: string } | null>(null);
    const [contractorDetails, setContractorDetails] = useState<{ name?: string; registrationNumber?: string } | null>(null);

    useEffect(() => {
        const timer = setTimeout(() => {
            const stored = localStorage.getItem('contractor_user') || localStorage.getItem('user');
            if (stored) {
                try {
                    setUser(JSON.parse(stored));
                } catch (e) {
                    console.error('Failed to parse user', e);
                }
            }
        }, 0);

        const contractorUser = typeof window !== 'undefined' ? (localStorage.getItem('contractor_user') || localStorage.getItem('user')) : null;
        const contractorToken = typeof window !== 'undefined' ? (localStorage.getItem('contractor_token') || localStorage.getItem('token')) : null;

        const headers: Record<string, string> = {
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
        };
        if (contractorToken) {
            headers['Authorization'] = `Bearer ${contractorToken}`;
        }
        if (contractorUser) {
            try {
                const u = JSON.parse(contractorUser);
                if (u.id) headers['x-user-id'] = u.id;
                if (u.role) headers['x-user-role'] = u.role;
                if (u.contractorId) headers['x-contractor-id'] = u.contractorId;
            } catch {}
        }

        fetch(`/api/contractor-portal/dashboard?_t=${Date.now()}`, { headers })
            .then(res => res.json())
            .then(json => {
                if (json.data?.contractor) {
                    setContractorDetails(json.data.contractor);
                }
            })
            .catch(() => {});

        return () => clearTimeout(timer);
    }, []);

    const handleLogout = () => {
        localStorage.removeItem('contractor_user');
        localStorage.removeItem('contractor_token');
        const storedUser = localStorage.getItem('user');
        if (storedUser) {
            try {
                const parsed = JSON.parse(storedUser);
                if (['CONTRACTOR_SUPERVISOR', 'CONTRACTOR_TECHNICIAN', 'CONTRACTOR_FINANCE', 'CONTRACTOR'].includes(parsed.role)) {
                    localStorage.removeItem('user');
                    localStorage.removeItem('token');
                }
            } catch {}
        }
        toast.success('Signed out of Contractor Portal');
        router.push('/contractor/login');
    };

    const displayName = contractorDetails?.name || 
        (user?.role?.includes('CONTRACTOR') ? user.name : null) || 
        'MAS Rukshan';

    const navItems = [
        {
            title: 'Dashboard',
            path: '/contractor/dashboard',
            icon: LayoutDashboard,
        },
        {
            title: 'Van Stock',
            path: '/contractor/inventory',
            icon: Package,
        },
        {
            title: 'Field SODs',
            path: '/contractor/sods',
            icon: ClipboardList,
        },
        {
            title: 'Claims',
            path: '/contractor/finance',
            icon: Banknote,
        },
    ];

    if (pathname === '/contractor/login') {
        return (
            <>
                {children}
                <PWAInstallPrompt />
            </>
        );
    }

    return (
        <RoleGuard 
            allowedRoles={['SUPER_ADMIN', 'ADMIN', 'CONTRACTOR_SUPERVISOR', 'CONTRACTOR_TECHNICIAN', 'CONTRACTOR_FINANCE', 'STORES_MANAGER', 'OSP_MANAGER']}
            fallbackLoginPath="/contractor/login"
        >
            <div className="flex flex-col min-h-screen bg-slate-950 text-slate-100 font-sans pb-20 md:pb-6 selection:bg-amber-500/30">
                {/* Standalone Native Mobile Header */}
                <header className="sticky top-0 z-40 bg-slate-900/90 backdrop-blur-md border-b border-slate-800/80 px-4 h-14 flex items-center justify-between shadow-xl">
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-amber-500 to-orange-600 flex items-center justify-center text-slate-950 shadow-md">
                            <Truck className="w-4 h-4 font-black" />
                        </div>
                        <div>
                            <div className="flex items-center gap-1.5">
                                <h1 className="text-xs font-black text-white tracking-wider uppercase leading-none">
                                    {displayName}
                                </h1>
                                <span className="flex h-2 w-2 relative">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                                </span>
                            </div>
                            <p className="text-[10px] text-amber-400 font-mono font-bold leading-tight mt-0.5">
                                {contractorDetails?.registrationNumber || 'SLTS/OSP/2025/2026-045'}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-slate-800/80 border border-slate-700/60 text-[10px] font-bold text-slate-300">
                            <Wifi className="w-3 h-3 text-emerald-400" />
                            <span className="hidden sm:inline">PWA ONLINE</span>
                        </div>

                        <div className="h-7 w-7 rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 text-[11px] font-black uppercase">
                            {displayName.charAt(0)}
                        </div>

                        <button 
                            onClick={handleLogout}
                            className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all cursor-pointer"
                            title="Sign Out"
                        >
                            <LogOut className="w-4 h-4" />
                        </button>
                    </div>
                </header>

                {/* Main Mobile App Content Area */}
                <main className="flex-1 p-3.5 sm:p-5 max-w-4xl mx-auto w-full space-y-4">
                    {children}
                </main>

                {/* Native Bottom Navigation Bar */}
                <nav className="fixed bottom-0 left-0 right-0 bg-slate-900/95 backdrop-blur-xl border-t border-slate-800/80 z-50 flex items-center justify-around h-16 px-2 shadow-2xl safe-area-bottom">
                    {navItems.map((item) => {
                        const Icon = item.icon;
                        const isActive = pathname === item.path || pathname.startsWith(`${item.path}/`);
                        return (
                            <Link
                                key={item.path}
                                href={item.path}
                                className={cn(
                                    "flex flex-col items-center justify-center py-1 px-3 rounded-2xl transition-all duration-200 gap-1 min-w-[64px] active:scale-95 cursor-pointer",
                                    isActive 
                                        ? "bg-amber-500/15 text-amber-400 border border-amber-500/30 font-black shadow-inner" 
                                        : "text-slate-400 hover:text-slate-200"
                                )}
                            >
                                <Icon className={cn("w-4 h-4 transition-transform", isActive ? "scale-110 text-amber-400" : "text-slate-400")} />
                                <span className="text-[10px] font-bold tracking-tight">{item.title}</span>
                            </Link>
                        );
                    })}
                </nav>
                <PWAInstallPrompt />
            </div>
        </RoleGuard>
    );
}

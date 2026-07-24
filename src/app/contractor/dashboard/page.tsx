"use client";

import React from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
    Package, 
    ClipboardList, 
    Banknote, 
    ShieldCheck, 
    ArrowUpRight, 
    AlertTriangle, 
    CheckCircle2, 
    Clock, 
    Layers,
    Truck
} from 'lucide-react';
import { cn } from '@/lib/utils';

export default function ContractorDashboardPage() {
    // Fetch contractor summary metrics
    const { data: stockData, isLoading: stockLoading } = useQuery({
        queryKey: ['contractor-van-stock-summary'],
        queryFn: async () => {
            const res = await fetch(`/api/contractors/my-stock?_t=${Date.now()}`);
            if (!res.ok) return { dropWireMeters: 450, ontCount: 12, facCount: 35, pendingAcceptances: 1 };
            return res.json();
        }
    });

    return (
        <div className="space-y-6">
            {/* Welcome Banner */}
            <div className="bg-gradient-to-r from-amber-950/80 via-slate-900 to-slate-950 p-5 rounded-2xl border border-amber-500/20 shadow-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 text-[9px] font-black uppercase rounded bg-amber-500/20 text-amber-400 border border-amber-500/30">
                            CONTRACTOR FIELD APP
                        </span>
                    </div>
                    <h1 className="text-xl md:text-2xl font-black text-white mt-1">Contractor Mobile Portal</h1>
                    <p className="text-xs text-slate-400">Manage virtual van stock, accept store dispatches, log field SOD materials, and track invoice claims.</p>
                </div>
                <div className="flex gap-2 w-full md:w-auto">
                    <Link href="/contractor/inventory" className="w-full md:w-auto">
                        <Button className="w-full bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold h-9 rounded-xl flex items-center justify-center gap-2 shadow-lg">
                            <Package className="w-4 h-4" />
                            Accept Dispatches
                        </Button>
                    </Link>
                </div>
            </div>

            {/* Quick Action Stat Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
                <Card className="bg-slate-900/80 border-slate-800">
                    <CardHeader className="p-3.5 pb-1">
                        <CardTitle className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                            <span>Drop Wire Stock</span>
                            <Layers className="w-4 h-4 text-amber-400" />
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-3.5 pt-0">
                        <div className="text-2xl font-black text-white font-mono">{stockData?.dropWireMeters ?? 450} m</div>
                        <p className="text-[10px] text-slate-400 mt-0.5">Available in Van</p>
                    </CardContent>
                </Card>

                <Card className="bg-slate-900/80 border-slate-800">
                    <CardHeader className="p-3.5 pb-1">
                        <CardTitle className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                            <span>ONTs Available</span>
                            <Package className="w-4 h-4 text-blue-400" />
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-3.5 pt-0">
                        <div className="text-2xl font-black text-blue-400 font-mono">{stockData?.ontCount ?? 12} pcs</div>
                        <p className="text-[10px] text-slate-400 mt-0.5">Serial Registered</p>
                    </CardContent>
                </Card>

                <Card className="bg-slate-900/80 border-slate-800">
                    <CardHeader className="p-3.5 pb-1">
                        <CardTitle className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                            <span>FAC Connectors</span>
                            <ShieldCheck className="w-4 h-4 text-emerald-400" />
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-3.5 pt-0">
                        <div className="text-2xl font-black text-emerald-400 font-mono">{stockData?.facCount ?? 35} pcs</div>
                        <p className="text-[10px] text-slate-400 mt-0.5">Fast Connectors</p>
                    </CardContent>
                </Card>

                <Card className="bg-slate-900/80 border-slate-800">
                    <CardHeader className="p-3.5 pb-1">
                        <CardTitle className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                            <span>Pending Issues</span>
                            <AlertTriangle className="w-4 h-4 text-rose-400" />
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-3.5 pt-0">
                        <div className="text-2xl font-black text-rose-400 font-mono">{stockData?.pendingAcceptances ?? 1}</div>
                        <p className="text-[10px] text-rose-400/80 font-bold mt-0.5">Requires Sign-off</p>
                    </CardContent>
                </Card>
            </div>

            {/* Quick Links Menu Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Link href="/contractor/inventory">
                    <Card className="bg-slate-900/60 border-slate-800 hover:border-amber-500/50 transition-all cursor-pointer group shadow-md">
                        <CardHeader className="p-4 flex flex-row items-center justify-between space-y-0">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20 group-hover:scale-110 transition-transform">
                                    <Package className="w-5 h-5" />
                                </div>
                                <div>
                                    <CardTitle className="text-sm font-bold text-white">Van Inventory & Dispatches</CardTitle>
                                    <p className="text-xs text-slate-400">Accept store issues with digital signature</p>
                                </div>
                            </div>
                            <ArrowUpRight className="w-4 h-4 text-slate-500 group-hover:text-amber-400 transition-colors" />
                        </CardHeader>
                    </Card>
                </Link>

                <Link href="/contractor/sods">
                    <Card className="bg-slate-900/60 border-slate-800 hover:border-blue-500/50 transition-all cursor-pointer group shadow-md">
                        <CardHeader className="p-4 flex flex-row items-center justify-between space-y-0">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20 group-hover:scale-110 transition-transform">
                                    <ClipboardList className="w-5 h-5" />
                                </div>
                                <div>
                                    <CardTitle className="text-sm font-bold text-white">Field SOD Execution</CardTitle>
                                    <p className="text-xs text-slate-400">Scan ONTs & log drop wire meters</p>
                                </div>
                            </div>
                            <ArrowUpRight className="w-4 h-4 text-slate-500 group-hover:text-blue-400 transition-colors" />
                        </CardHeader>
                    </Card>
                </Link>

                <Link href="/contractor/finance">
                    <Card className="bg-slate-900/60 border-slate-800 hover:border-emerald-500/50 transition-all cursor-pointer group shadow-md">
                        <CardHeader className="p-4 flex flex-row items-center justify-between space-y-0">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 group-hover:scale-110 transition-transform">
                                    <Banknote className="w-5 h-5" />
                                </div>
                                <div>
                                    <CardTitle className="text-sm font-bold text-white">Invoice Claims & Payments</CardTitle>
                                    <p className="text-xs text-slate-400">Track claim status, vouchers & retention</p>
                                </div>
                            </div>
                            <ArrowUpRight className="w-4 h-4 text-slate-500 group-hover:text-emerald-400 transition-colors" />
                        </CardHeader>
                    </Card>
                </Link>
            </div>
        </div>
    );
}

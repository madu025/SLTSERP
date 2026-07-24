"use client";

import React from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
    Package, 
    ClipboardList, 
    Banknote, 
    ShieldCheck, 
    ArrowUpRight, 
    AlertTriangle, 
    Layers,
    Users,
    Building2,
    Store,
    UserCheck,
    Truck,
    Sparkles,
    CheckCircle2
} from 'lucide-react';

export default function ContractorDashboardPage() {
    // Fetch contractor profile, teams, and dynamic summary metrics
    const { data: dashboardPayload, isLoading } = useQuery({
        queryKey: ['contractor-my-dashboard'],
        queryFn: async () => {
            const res = await fetch(`/api/contractor-portal/dashboard?_t=${Date.now()}`, {
                headers: {
                    'Cache-Control': 'no-cache',
                    'Pragma': 'no-cache'
                }
            });
            if (!res.ok) throw new Error('Failed to load contractor dashboard');
            const json = await res.json();
            return json.data || json;
        },
        refetchInterval: 5000,
    });

    const contractor = dashboardPayload?.contractor;
    const teams = dashboardPayload?.teams || [];
    const stats = dashboardPayload?.stats || {};

    return (
        <div className="space-y-5 pb-6">
            {/* Quick Action Top Bar */}
            <div className="bg-gradient-to-r from-slate-900 via-slate-900/95 to-slate-950 p-4 md:p-5 rounded-2xl border border-slate-800 shadow-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 font-bold shrink-0">
                        <Truck className="w-5 h-5" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h2 className="text-sm font-black text-white uppercase tracking-wider">Field Operations Center</h2>
                            <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30 text-[9px] font-bold">
                                SYSTEM ONLINE
                            </Badge>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-0.5">Dual-custody van stock, material issue notes & field SODs</p>
                    </div>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                    <Link href="/contractor/inventory" className="flex-1 sm:flex-none">
                        <Button className="w-full bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white text-xs font-bold h-9 px-4 rounded-xl flex items-center justify-center gap-1.5 shadow-lg shadow-amber-950/40">
                            <Package className="w-3.5 h-3.5" />
                            Accept Dispatches
                        </Button>
                    </Link>
                    <Link href="/contractor/sods" className="flex-1 sm:flex-none">
                        <Button variant="outline" className="w-full bg-slate-800/80 hover:bg-slate-800 text-slate-200 border-slate-700 text-xs font-bold h-9 px-4 rounded-xl flex items-center justify-center gap-1.5">
                            <ClipboardList className="w-3.5 h-3.5 text-blue-400" />
                            Log Field SOD
                        </Button>
                    </Link>
                </div>
            </div>

            {/* 4 Performance Metrics Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Card className="bg-slate-900/90 border-slate-800/90 shadow-lg">
                    <CardHeader className="p-3 pb-1">
                        <CardTitle className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                            <span>Drop Wire Stock</span>
                            <Layers className="w-3.5 h-3.5 text-amber-400" />
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-3 pt-0">
                        <div className="text-xl font-black text-white font-mono">{isLoading ? '...' : (stats.dropWireMeters ?? 450)} m</div>
                        <p className="text-[10px] text-slate-400 mt-0.5">Available in Van</p>
                    </CardContent>
                </Card>

                <Card className="bg-slate-900/90 border-slate-800/90 shadow-lg">
                    <CardHeader className="p-3 pb-1">
                        <CardTitle className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                            <span>ONTs Available</span>
                            <Package className="w-3.5 h-3.5 text-blue-400" />
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-3 pt-0">
                        <div className="text-xl font-black text-blue-400 font-mono">{isLoading ? '...' : (stats.ontCount ?? 12)} pcs</div>
                        <p className="text-[10px] text-slate-400 mt-0.5">Serial Registered</p>
                    </CardContent>
                </Card>

                <Card className="bg-slate-900/90 border-slate-800/90 shadow-lg">
                    <CardHeader className="p-3 pb-1">
                        <CardTitle className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                            <span>FAC Connectors</span>
                            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-3 pt-0">
                        <div className="text-xl font-black text-emerald-400 font-mono">{isLoading ? '...' : (stats.facCount ?? 35)} pcs</div>
                        <p className="text-[10px] text-slate-400 mt-0.5">Fast Connectors</p>
                    </CardContent>
                </Card>

                <Card className="bg-slate-900/90 border-slate-800/90 shadow-lg">
                    <CardHeader className="p-3 pb-1">
                        <CardTitle className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                            <span>Pending Issues</span>
                            <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-3 pt-0">
                        <div className="text-xl font-black text-rose-400 font-mono">{isLoading ? '...' : (stats.pendingAcceptances ?? 0)}</div>
                        <p className="text-[10px] text-rose-400/90 font-bold mt-0.5">Requires Sign-off</p>
                    </CardContent>
                </Card>
            </div>

            {/* ASSIGNED CONTRACTOR TEAMS */}
            <div className="space-y-2.5">
                <div className="flex items-center justify-between px-1">
                    <h3 className="text-xs font-black uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5 text-amber-400" /> 
                        Assigned Field Teams 
                        <Badge variant="secondary" className="bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[10px] ml-1">
                            {teams.length} Teams Registered
                        </Badge>
                    </h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {teams.map((t: any) => (
                        <Card key={t.id} className="bg-slate-900/80 border-slate-800/80 hover:border-amber-500/40 transition-all shadow-md">
                            <CardHeader className="p-3.5 pb-2 border-b border-slate-800/60">
                                <div className="flex justify-between items-center">
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm font-black text-amber-400 font-mono">{t.name}</span>
                                        <Badge variant="outline" className="bg-slate-800 text-slate-300 border-slate-700 text-[9px] font-mono">
                                            {t.sltCode || t.name}
                                        </Badge>
                                    </div>
                                    <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20 flex items-center gap-1">
                                        <CheckCircle2 className="w-3 h-3" /> ACTIVE
                                    </span>
                                </div>
                            </CardHeader>

                            <CardContent className="p-3.5 pt-2.5 space-y-2 text-xs">
                                <div className="flex justify-between items-center bg-slate-950/50 p-2 rounded-lg border border-slate-800/60">
                                    <div className="flex items-center gap-1.5 text-slate-400">
                                        <Building2 className="w-3.5 h-3.5 text-slate-500" />
                                        <span>RTOM:</span>
                                        <span className="font-bold text-slate-200">{t.opmc?.name || 'OPMC R-KX'}</span>
                                    </div>
                                    <div className="flex items-center gap-1.5 text-slate-400">
                                        <Store className="w-3.5 h-3.5 text-amber-500" />
                                        <span className="font-semibold text-amber-300">{t.storeAssignments?.[0]?.store?.name || 'Colombo Central Main Store'}</span>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase shrink-0 flex items-center gap-1">
                                        <UserCheck className="w-3 h-3 text-blue-400" /> Technician:
                                    </span>
                                    <div className="flex flex-wrap gap-1">
                                        {t.members && t.members.length > 0 ? (
                                            t.members.map((m: any, mIdx: number) => (
                                                <span key={mIdx} className="text-[11px] font-medium text-slate-200 bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
                                                    {m.name}
                                                </span>
                                            ))
                                        ) : (
                                            <span className="text-[11px] text-slate-500 italic">No technician registered</span>
                                        )}
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </div>

            {/* Quick Access Action Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <Link href="/contractor/inventory">
                    <Card className="bg-slate-900/70 border-slate-800 hover:border-amber-500/50 transition-all cursor-pointer group shadow-md">
                        <CardHeader className="p-4 flex flex-row items-center justify-between space-y-0">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20 group-hover:scale-110 transition-transform">
                                    <Package className="w-5 h-5" />
                                </div>
                                <div>
                                    <CardTitle className="text-xs font-bold text-white uppercase tracking-wider">Van Stock & Dispatches</CardTitle>
                                    <p className="text-[11px] text-slate-400 mt-0.5">Accept store issues with digital signature</p>
                                </div>
                            </div>
                            <ArrowUpRight className="w-4 h-4 text-slate-500 group-hover:text-amber-400 transition-colors" />
                        </CardHeader>
                    </Card>
                </Link>

                <Link href="/contractor/sods">
                    <Card className="bg-slate-900/70 border-slate-800 hover:border-blue-500/50 transition-all cursor-pointer group shadow-md">
                        <CardHeader className="p-4 flex flex-row items-center justify-between space-y-0">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20 group-hover:scale-110 transition-transform">
                                    <ClipboardList className="w-5 h-5" />
                                </div>
                                <div>
                                    <CardTitle className="text-xs font-bold text-white uppercase tracking-wider">Field SOD Execution</CardTitle>
                                    <p className="text-[11px] text-slate-400 mt-0.5">Scan ONTs & log drop wire meters ({stats.activeSodsCount || 0} active)</p>
                                </div>
                            </div>
                            <ArrowUpRight className="w-4 h-4 text-slate-500 group-hover:text-blue-400 transition-colors" />
                        </CardHeader>
                    </Card>
                </Link>

                <Link href="/contractor/finance">
                    <Card className="bg-slate-900/70 border-slate-800 hover:border-emerald-500/50 transition-all cursor-pointer group shadow-md">
                        <CardHeader className="p-4 flex flex-row items-center justify-between space-y-0">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 group-hover:scale-110 transition-transform">
                                    <Banknote className="w-5 h-5" />
                                </div>
                                <div>
                                    <CardTitle className="text-xs font-bold text-white uppercase tracking-wider">Claims & Retention</CardTitle>
                                    <p className="text-[11px] text-slate-400 mt-0.5">Track monthly claim vouchers & payments</p>
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

"use client";

import React, { useState, useEffect } from 'react';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import RoleGuard from '@/components/RoleGuard';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    LayoutDashboard,
    AlertTriangle,
    Store,
    Receipt,
    ClipboardList,
    RefreshCw,
    ShieldCheck,
    History as HistoryIcon,
    ArrowUpRight,
    DollarSign,
    CheckCircle2,
    Truck,
    Lock
} from "lucide-react";
import Link from 'next/link';
import { cn } from "@/lib/utils";
import { hasRole, ROLE_GROUPS } from '@/config/roles';

interface User {
    id: string;
    name: string;
    role: string;
    storeId?: string;
}

interface StoreType {
    id: string;
    name: string;
    managerId?: string;
}

interface KpiData {
    summary: {
        totalStockValue: number;
        totalStockQuantity: number;
        totalUniqueItems: number;
        lowStockCount: number;
        pendingDispatchCount: number;
        pendingGrnCount: number;
        pendingMrnCount: number;
    };
    lowStockAlerts: Array<{ id: string; name: string; category: string | null; minLevel: number; currentQty: number }>;
    pendingDispatches: Array<{
        id: string;
        requestNr: string;
        status: string;
        workflowStage: string;
        createdAt: string;
        requester?: { name: string } | null;
        items: Array<{ id: string; requestedQty: number; item: { name: string } }>;
    }>;
    pendingGrns: Array<{
        id: string;
        grnNumber: string;
        supplier: string | null;
        createdAt: string;
        request?: { requestNr: string; poNumber?: string } | null;
        purchaseOrder?: { poNumber: string; vendor: string | null } | null;
    }>;
}

export default function StoresManagerDashboardPage() {
    const [user] = useState<User | null>(() => {
        if (typeof window !== 'undefined') {
            const stored = localStorage.getItem('user');
            return stored ? JSON.parse(stored) : null;
        }
        return null;
    });

    const [selectedStoreId, setSelectedStoreId] = useState<string>('all');

    const { data: stores = [] } = useQuery<StoreType[]>({
        queryKey: ['stores'],
        queryFn: async () => (await fetch('/api/inventory/stores')).json()
    });

    // Dynamic Role-based Store Scope Detection
    const isGlobalManager = hasRole(user?.role, [
        'SUPER_ADMIN', 'ADMIN', 'STORES_MANAGER', 'OSP_MANAGER', 'AREA_MANAGER', 'MANAGER'
    ]);

    useEffect(() => {
        if (user && stores.length > 0 && !isGlobalManager) {
            // Store Assistant / Site Staff: Dynamically lock to their assigned store
            const assignedStore = stores.find(s => s.id === user.storeId || s.managerId === user.id);
            if (assignedStore) {
                setSelectedStoreId(assignedStore.id);
            } else if (stores[0]) {
                setSelectedStoreId(stores[0].id);
            }
        }
    }, [user, stores, isGlobalManager]);

    const { data: kpiData, isLoading, refetch } = useQuery<KpiData>({
        queryKey: ['stores-dashboard-kpis', selectedStoreId],
        queryFn: async () => {
            const res = await fetch(`/api/inventory/dashboard-kpis?storeId=${selectedStoreId}&_t=${Date.now()}`);
            if (!res.ok) throw new Error('Failed to fetch Stores KPI data');
            return res.json();
        },
        enabled: !!user,
        refetchInterval: 30000,
    });

    const summary = kpiData?.summary || {
        totalStockValue: 0,
        totalStockQuantity: 0,
        totalUniqueItems: 0,
        lowStockCount: 0,
        pendingDispatchCount: 0,
        pendingGrnCount: 0,
        pendingMrnCount: 0,
    };

    return (
        <RoleGuard allowedRoles={['SUPER_ADMIN', 'ADMIN', 'STORES_MANAGER', 'STORES_ASSISTANT', 'SITE_OFFICE_STAFF', 'OSP_MANAGER', 'AREA_MANAGER']}>
            <div className="erp-page-wrapper flex-row overflow-hidden bg-slate-50 dark:bg-slate-950">
                <Sidebar />
                <main className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
                    <Header />
                    
                    <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
                        <div className="max-w-7xl mx-auto space-y-6">

                            {/* 1. Header & Dynamic Store Selector */}
                            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <div className="p-2 bg-blue-600 text-white rounded-xl shadow-md shadow-blue-500/20">
                                            <LayoutDashboard className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <h1 className="text-xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
                                                    Stores Operations Dashboard
                                                </h1>
                                                {!isGlobalManager && (
                                                    <Badge variant="outline" className="text-[10px] font-bold border-amber-300 bg-amber-50 text-amber-800 flex items-center gap-1">
                                                        <Lock className="w-3 h-3" /> Site Store Scope
                                                    </Badge>
                                                )}
                                            </div>
                                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                                {isGlobalManager 
                                                    ? 'Enterprise Multi-Store Command Center & Material Issue Tracking' 
                                                    : 'Site Store Dispatch Queue & Local Stock Inventory Controls'
                                                }
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-3 w-full md:w-auto">
                                    {/* Store Filter Dropdown (Locked for Site Assistants, Unlocked for Managers) */}
                                    <div className={cn(
                                        "flex items-center gap-2 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700",
                                        !isGlobalManager && "opacity-90 bg-amber-50/50 border-amber-200 dark:bg-slate-800"
                                    )}>
                                        <Store className="w-4 h-4 text-slate-500" />
                                        <select
                                            value={selectedStoreId}
                                            onChange={(e) => isGlobalManager && setSelectedStoreId(e.target.value)}
                                            disabled={!isGlobalManager}
                                            className="bg-transparent text-xs font-bold text-slate-800 dark:text-slate-200 outline-none cursor-pointer disabled:cursor-not-allowed"
                                        >
                                            {isGlobalManager && <option value="all">All Stores (Global View)</option>}
                                            {stores.map((s) => (
                                                <option key={s.id} value={s.id}>{s.name}</option>
                                            ))}
                                        </select>
                                    </div>

                                    <Button
                                        onClick={() => refetch()}
                                        variant="outline"
                                        size="sm"
                                        className="h-9 px-3 rounded-xl border-slate-200 text-xs font-bold gap-1.5"
                                    >
                                        <RefreshCw className="w-3.5 h-3.5" />
                                        Refresh
                                    </Button>
                                </div>
                            </div>

                            {/* 2. 1-Click Operational Action Bar */}
                            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                                <Link href="/inventory/grn" className="group">
                                    <div className="bg-gradient-to-br from-emerald-500 to-teal-600 text-white p-3.5 rounded-2xl shadow-sm hover:shadow-md hover:scale-[1.02] transition-all duration-200 flex items-center justify-between">
                                        <div className="flex items-center gap-2.5">
                                            <div className="p-2 bg-white/20 rounded-xl backdrop-blur-sm">
                                                <Receipt className="w-4 h-4" />
                                            </div>
                                            <span className="text-xs font-bold">GRN Entry</span>
                                        </div>
                                        <ArrowUpRight className="w-4 h-4 opacity-70 group-hover:opacity-100 transition-opacity" />
                                    </div>
                                </Link>

                                <Link href="/inventory/requests" className="group">
                                    <div className="bg-gradient-to-br from-blue-600 to-indigo-700 text-white p-3.5 rounded-2xl shadow-sm hover:shadow-md hover:scale-[1.02] transition-all duration-200 flex items-center justify-between">
                                        <div className="flex items-center gap-2.5">
                                            <div className="p-2 bg-white/20 rounded-xl backdrop-blur-sm">
                                                <ClipboardList className="w-4 h-4" />
                                            </div>
                                            <span className="text-xs font-bold">Material Issue</span>
                                        </div>
                                        <ArrowUpRight className="w-4 h-4 opacity-70 group-hover:opacity-100 transition-opacity" />
                                    </div>
                                </Link>

                                <Link href="/inventory/admin/mrns" className="group">
                                    <div className="bg-gradient-to-br from-purple-600 to-violet-700 text-white p-3.5 rounded-2xl shadow-sm hover:shadow-md hover:scale-[1.02] transition-all duration-200 flex items-center justify-between">
                                        <div className="flex items-center gap-2.5">
                                            <div className="p-2 bg-white/20 rounded-xl backdrop-blur-sm">
                                                <RefreshCw className="w-4 h-4" />
                                            </div>
                                            <span className="text-xs font-bold">MRN Returns</span>
                                        </div>
                                        <ArrowUpRight className="w-4 h-4 opacity-70 group-hover:opacity-100 transition-opacity" />
                                    </div>
                                </Link>

                                <Link href="/inventory/audit" className="group">
                                    <div className="bg-gradient-to-br from-amber-500 to-orange-600 text-white p-3.5 rounded-2xl shadow-sm hover:shadow-md hover:scale-[1.02] transition-all duration-200 flex items-center justify-between">
                                        <div className="flex items-center gap-2.5">
                                            <div className="p-2 bg-white/20 rounded-xl backdrop-blur-sm">
                                                <ShieldCheck className="w-4 h-4" />
                                            </div>
                                            <span className="text-xs font-bold">Audit Hub</span>
                                        </div>
                                        <ArrowUpRight className="w-4 h-4 opacity-70 group-hover:opacity-100 transition-opacity" />
                                    </div>
                                </Link>

                                <Link href="/inventory/reports/cardex" className="group">
                                    <div className="bg-gradient-to-br from-slate-700 to-slate-900 text-white p-3.5 rounded-2xl shadow-sm hover:shadow-md hover:scale-[1.02] transition-all duration-200 flex items-center justify-between col-span-2 sm:col-span-1">
                                        <div className="flex items-center gap-2.5">
                                            <div className="p-2 bg-white/20 rounded-xl backdrop-blur-sm">
                                                <HistoryIcon className="w-4 h-4" />
                                            </div>
                                            <span className="text-xs font-bold">Cardex Ledger</span>
                                        </div>
                                        <ArrowUpRight className="w-4 h-4 opacity-70 group-hover:opacity-100 transition-opacity" />
                                    </div>
                                </Link>
                            </div>

                            {/* 3. Top Key Operational Metric Cards */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                {/* Total Stock Value */}
                                <Card className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
                                    <CardContent className="p-4 flex items-center justify-between">
                                        <div className="space-y-1">
                                            <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Total Stock Value</p>
                                            <p className="text-lg font-black text-slate-900 dark:text-slate-100">
                                                LKR {summary.totalStockValue.toLocaleString()}
                                            </p>
                                            <div className="flex items-center gap-2 text-[11px] text-slate-500">
                                                <span className="font-semibold">{summary.totalUniqueItems} Unique Items</span>
                                                <span>•</span>
                                                <span>{summary.totalStockQuantity.toLocaleString()} Total Qty</span>
                                            </div>
                                        </div>
                                        <div className="h-10 w-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 flex items-center justify-center flex-none">
                                            <DollarSign className="w-5 h-5" />
                                        </div>
                                    </CardContent>
                                </Card>

                                {/* Pending Contractor Dispatches */}
                                <Card className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
                                    <CardContent className="p-4 flex items-center justify-between">
                                        <div className="space-y-1">
                                            <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Field Dispatch Queue</p>
                                            <p className="text-lg font-black text-blue-600 dark:text-blue-400">
                                                {summary.pendingDispatchCount} Requests
                                            </p>
                                            <p className="text-[11px] text-slate-500">Awaiting Warehouse MIN Issue</p>
                                        </div>
                                        <div className="h-10 w-10 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 flex items-center justify-center flex-none">
                                            <Truck className="w-5 h-5" />
                                        </div>
                                    </CardContent>
                                </Card>

                                {/* Inbound PO Deliveries */}
                                <Card className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
                                    <CardContent className="p-4 flex items-center justify-between">
                                        <div className="space-y-1">
                                            <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Inbound PO Deliveries</p>
                                            <p className="text-lg font-black text-purple-600 dark:text-purple-400">
                                                {summary.pendingGrnCount} Deliveries
                                            </p>
                                            <p className="text-[11px] text-slate-500">Awaiting GRN Physical Audit</p>
                                        </div>
                                        <div className="h-10 w-10 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-600 flex items-center justify-center flex-none">
                                            <Receipt className="w-5 h-5" />
                                        </div>
                                    </CardContent>
                                </Card>

                                {/* Critical Low Stock */}
                                <Card className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
                                    <CardContent className="p-4 flex items-center justify-between">
                                        <div className="space-y-1">
                                            <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Critical Stock Risk</p>
                                            <p className={cn(
                                                "text-lg font-black",
                                                summary.lowStockCount > 0 ? 'text-red-600 dark:text-red-400' : 'text-slate-900 dark:text-slate-100'
                                            )}>
                                                {summary.lowStockCount} Items Below Min
                                            </p>
                                            <p className="text-[11px] text-slate-500">Reorder Point Threshold</p>
                                        </div>
                                        <div className={cn(
                                            "h-10 w-10 rounded-xl flex items-center justify-center flex-none",
                                            summary.lowStockCount > 0 ? 'bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400' : 'bg-slate-50 text-slate-400'
                                        )}>
                                            <AlertTriangle className="w-5 h-5" />
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>

                            {/* 4. Operational Queue Tabs */}
                            <Tabs defaultValue="dispatch" className="w-full space-y-4">
                                <TabsList className="bg-white dark:bg-slate-900 p-1 rounded-xl border border-slate-200/80 dark:border-slate-800 grid grid-cols-2 md:grid-cols-4 gap-1 h-auto">
                                    <TabsTrigger value="dispatch" className="text-xs font-bold py-2 rounded-lg data-[state=active]:bg-blue-600 data-[state=active]:text-white">
                                        🚚 Field Dispatch Queue ({summary.pendingDispatchCount})
                                    </TabsTrigger>
                                    <TabsTrigger value="inbound" className="text-xs font-bold py-2 rounded-lg data-[state=active]:bg-purple-600 data-[state=active]:text-white">
                                        📦 Inbound POs ({summary.pendingGrnCount})
                                    </TabsTrigger>
                                    <TabsTrigger value="reorder" className="text-xs font-bold py-2 rounded-lg data-[state=active]:bg-red-600 data-[state=active]:text-white">
                                        ⚠️ Stockout Alerts ({summary.lowStockCount})
                                    </TabsTrigger>
                                    <TabsTrigger value="returns" className="text-xs font-bold py-2 rounded-lg data-[state=active]:bg-slate-800 data-[state=active]:text-white">
                                        🔄 MRN Returns ({summary.pendingMrnCount})
                                    </TabsTrigger>
                                </TabsList>

                                {/* Tab 1: Field Dispatch Queue */}
                                <TabsContent value="dispatch">
                                    <Card className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
                                        <CardHeader className="py-3 px-5 border-b border-slate-100 dark:border-slate-800 flex flex-row items-center justify-between">
                                            <CardTitle className="text-sm font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
                                                <Truck className="w-4 h-4 text-blue-600" />
                                                Pending Contractor Material Dispatches (MIN)
                                            </CardTitle>
                                            <Link href="/inventory/requests" className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center">
                                                View All Requests <ArrowUpRight className="w-3.5 h-3.5 ml-0.5" />
                                            </Link>
                                        </CardHeader>
                                        <CardContent className="p-0">
                                            {kpiData?.pendingDispatches?.length === 0 ? (
                                                <div className="p-8 text-center text-slate-500 text-xs">
                                                    No pending dispatches waiting for warehouse MIN issuance.
                                                </div>
                                            ) : (
                                                <div className="overflow-x-auto">
                                                    <table className="w-full text-left border-collapse text-xs">
                                                        <thead>
                                                            <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800">
                                                                <th className="px-4 py-2.5 font-black uppercase text-[10px] text-slate-400">Request #</th>
                                                                <th className="px-4 py-2.5 font-black uppercase text-[10px] text-slate-400">Requester / Contractor</th>
                                                                <th className="px-4 py-2.5 font-black uppercase text-[10px] text-slate-400">Items Requested</th>
                                                                <th className="px-4 py-2.5 font-black uppercase text-[10px] text-slate-400">Status</th>
                                                                <th className="px-4 py-2.5 font-black uppercase text-[10px] text-slate-400 text-right">Action</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                                            {kpiData?.pendingDispatches?.map((req) => (
                                                                <tr key={req.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                                                                    <td className="px-4 py-3 font-bold text-slate-900 dark:text-slate-100">{req.requestNr}</td>
                                                                    <td className="px-4 py-3 text-slate-700 dark:text-slate-300 font-semibold">{req.requester?.name || 'N/A'}</td>
                                                                    <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                                                                        {req.items?.length || 0} Items ({req.items?.slice(0, 2).map(i => i.item?.name).filter(Boolean).join(', ')})
                                                                    </td>
                                                                    <td className="px-4 py-3">
                                                                        <Badge variant="outline" className="text-[10px] font-bold border-blue-200 bg-blue-50 text-blue-700">
                                                                            {req.status}
                                                                        </Badge>
                                                                    </td>
                                                                    <td className="px-4 py-3 text-right">
                                                                        <Link href={`/inventory/requests?id=${req.id}`} className="inline-flex items-center text-[10px] font-bold bg-blue-600 text-white px-3 py-1 rounded-lg hover:bg-blue-700 transition-all">
                                                                            Issue MIN
                                                                        </Link>
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            )}
                                        </CardContent>
                                    </Card>
                                </TabsContent>

                                {/* Tab 2: Inbound POs */}
                                <TabsContent value="inbound">
                                    <Card className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
                                        <CardHeader className="py-3 px-5 border-b border-slate-100 dark:border-slate-800 flex flex-row items-center justify-between">
                                            <CardTitle className="text-sm font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
                                                <Receipt className="w-4 h-4 text-purple-600" />
                                                Inbound Deliveries Awaiting GRN
                                            </CardTitle>
                                            <Link href="/inventory/grn" className="text-xs font-bold text-purple-600 hover:text-purple-700 flex items-center">
                                                Go to GRN Module <ArrowUpRight className="w-3.5 h-3.5 ml-0.5" />
                                            </Link>
                                        </CardHeader>
                                        <CardContent className="p-0">
                                            {kpiData?.pendingGrns?.length === 0 ? (
                                                <div className="p-8 text-center text-slate-500 text-xs">
                                                    No pending GRN entries awaiting physical inspection.
                                                </div>
                                            ) : (
                                                <div className="overflow-x-auto">
                                                    <table className="w-full text-left border-collapse text-xs">
                                                        <thead>
                                                            <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800">
                                                                <th className="px-4 py-2.5 font-black uppercase text-[10px] text-slate-400">GRN #</th>
                                                                <th className="px-4 py-2.5 font-black uppercase text-[10px] text-slate-400">PO Ref</th>
                                                                <th className="px-4 py-2.5 font-black uppercase text-[10px] text-slate-400">Supplier</th>
                                                                <th className="px-4 py-2.5 font-black uppercase text-[10px] text-slate-400">Date Created</th>
                                                                <th className="px-4 py-2.5 font-black uppercase text-[10px] text-slate-400 text-right">Action</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                                            {kpiData?.pendingGrns?.map((grn) => (
                                                                <tr key={grn.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                                                                    <td className="px-4 py-3 font-bold text-slate-900 dark:text-slate-100">{grn.grnNumber}</td>
                                                                    <td className="px-4 py-3 text-slate-700 dark:text-slate-300 font-mono text-[11px]">
                                                                        {grn.purchaseOrder?.poNumber || grn.request?.poNumber || '-'}
                                                                    </td>
                                                                    <td className="px-4 py-3 text-slate-600 dark:text-slate-400 font-semibold">{grn.supplier || grn.purchaseOrder?.vendor || 'N/A'}</td>
                                                                    <td className="px-4 py-3 text-slate-500">{new Date(grn.createdAt).toLocaleDateString()}</td>
                                                                    <td className="px-4 py-3 text-right">
                                                                        <Link href={`/inventory/grn?id=${grn.id}`} className="inline-flex items-center text-[10px] font-bold bg-purple-600 text-white px-3 py-1 rounded-lg hover:bg-purple-700 transition-all">
                                                                            Verify GRN
                                                                        </Link>
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            )}
                                        </CardContent>
                                    </Card>
                                </TabsContent>

                                {/* Tab 3: Stockout Risk */}
                                <TabsContent value="reorder">
                                    <Card className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
                                        <CardHeader className="py-3 px-5 border-b border-slate-100 dark:border-slate-800 flex flex-row items-center justify-between">
                                            <CardTitle className="text-sm font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
                                                <AlertTriangle className="w-4 h-4 text-red-600" />
                                                Critical Safety Level Alerts
                                            </CardTitle>
                                            <Link href="/inventory/stock" className="text-xs font-bold text-red-600 hover:text-red-700 flex items-center">
                                                Stock Master List <ArrowUpRight className="w-3.5 h-3.5 ml-0.5" />
                                            </Link>
                                        </CardHeader>
                                        <CardContent className="p-0">
                                            {kpiData?.lowStockAlerts?.length === 0 ? (
                                                <div className="p-8 text-center text-slate-500 text-xs flex flex-col items-center">
                                                    <CheckCircle2 className="w-6 h-6 text-emerald-500 mb-1.5" />
                                                    All material stock levels are within safe operating limits.
                                                </div>
                                            ) : (
                                                <div className="overflow-x-auto">
                                                    <table className="w-full text-left border-collapse text-xs">
                                                        <thead>
                                                            <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800">
                                                                <th className="px-4 py-2.5 font-black uppercase text-[10px] text-slate-400">Item Name</th>
                                                                <th className="px-4 py-2.5 font-black uppercase text-[10px] text-slate-400">Category</th>
                                                                <th className="px-4 py-2.5 font-black uppercase text-[10px] text-slate-400 text-center">Safety Min</th>
                                                                <th className="px-4 py-2.5 font-black uppercase text-[10px] text-slate-400 text-right">Current Stock</th>
                                                                <th className="px-4 py-2.5 font-black uppercase text-[10px] text-slate-400 text-right">Action</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                                            {kpiData?.lowStockAlerts?.map((item) => (
                                                                <tr key={item.id} className="hover:bg-red-50/20 dark:hover:bg-red-950/20 transition-colors">
                                                                    <td className="px-4 py-3 font-bold text-slate-900 dark:text-slate-100">{item.name}</td>
                                                                    <td className="px-4 py-3 text-slate-500">{item.category || 'General'}</td>
                                                                    <td className="px-4 py-3 text-center font-semibold text-slate-600">{item.minLevel}</td>
                                                                    <td className="px-4 py-3 text-right font-black text-red-600 dark:text-red-400">{item.currentQty}</td>
                                                                    <td className="px-4 py-3 text-right">
                                                                        <Link href="/inventory/requests" className="inline-flex items-center text-[10px] font-bold bg-red-600 text-white px-3 py-1 rounded-lg hover:bg-red-700 transition-all">
                                                                            Order Material
                                                                        </Link>
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            )}
                                        </CardContent>
                                    </Card>
                                </TabsContent>

                                {/* Tab 4: MRN Returns */}
                                <TabsContent value="returns">
                                    <Card className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm p-6 text-center">
                                        <RefreshCw className="w-8 h-8 text-purple-500 mx-auto mb-2" />
                                        <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">Material Return Note (MRN) Processing</h3>
                                        <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                                            Manage unused material returns, faulty ONTs, and scrap items returned from field operations.
                                        </p>
                                        <div className="mt-4">
                                            <Link href="/inventory/admin/mrns" className="inline-flex items-center text-xs font-bold bg-slate-900 text-white px-4 py-2 rounded-xl hover:bg-slate-800 transition-all">
                                                Open MRN Return Hub
                                            </Link>
                                        </div>
                                    </Card>
                                </TabsContent>
                            </Tabs>

                        </div>
                    </div>
                </main>
            </div>
        </RoleGuard>
    );
}

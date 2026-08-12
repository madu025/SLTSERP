"use client";

import React from 'react';
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
    Package,
    Clock
} from "lucide-react";
import Link from 'next/link';
import { cn } from "@/lib/utils";
import { DashboardProps } from '@/types/inventory/dashboard.types';

export default function StoreManagerCommandCenter({
    user, stores, kpiData, isLoading, refetch, selectedStoreId, setSelectedStoreId
}: DashboardProps) {

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
        <div className="space-y-6">
            {/* 1. Header & Dynamic Store Selector */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm">
                <div>
                    <div className="flex items-center gap-2">
                        <div className="p-2 bg-blue-600 text-white rounded-xl shadow-md shadow-blue-500/20">
                            <LayoutDashboard className="w-5 h-5" />
                        </div>
                        <div>
                            <h1 className="text-xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
                                Stores Operations Dashboard
                            </h1>
                            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                                Enterprise Multi-Store Command Center & Material Issue Tracking
                            </p>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-3 w-full md:w-auto">
                    {/* Store Filter Dropdown */}
                    <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700">
                        <Store className="w-4 h-4 text-slate-500" />
                        <select
                            value={selectedStoreId}
                            onChange={(e) => setSelectedStoreId?.(e.target.value)}
                            className="bg-transparent text-xs font-bold text-slate-800 dark:text-slate-200 outline-none cursor-pointer"
                        >
                            <option value="all">All Stores (Global View)</option>
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
                                LKR {summary.totalStockValue?.toLocaleString() || '0'}
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
                <TabsList className="bg-white dark:bg-slate-900 p-1 rounded-xl border border-slate-200/80 dark:border-slate-800 flex flex-wrap gap-1 h-auto">
                    <TabsTrigger value="dispatch" className="text-xs font-bold py-2 px-3 rounded-lg data-[state=active]:bg-blue-600 data-[state=active]:text-white">
                        Field Dispatch ({summary.pendingDispatchCount})
                    </TabsTrigger>
                    <TabsTrigger value="inbound" className="text-xs font-bold py-2 px-3 rounded-lg data-[state=active]:bg-purple-600 data-[state=active]:text-white">
                        Inbound POs ({summary.pendingGrnCount})
                    </TabsTrigger>
                    <TabsTrigger value="reorder" className="text-xs font-bold py-2 px-3 rounded-lg data-[state=active]:bg-red-600 data-[state=active]:text-white">
                        Stockout ({summary.lowStockCount})
                    </TabsTrigger>
                    <TabsTrigger value="returns" className="text-xs font-bold py-2 px-3 rounded-lg data-[state=active]:bg-slate-800 data-[state=active]:text-white">
                        MRN ({summary.pendingMrnCount})
                    </TabsTrigger>
                    <TabsTrigger value="balance" className="text-xs font-bold py-2 px-3 rounded-lg data-[state=active]:bg-emerald-600 data-[state=active]:text-white">
                        Stock Balance
                    </TabsTrigger>
                    <TabsTrigger value="expiring" className="text-xs font-bold py-2 px-3 rounded-lg data-[state=active]:bg-amber-600 data-[state=active]:text-white">
                        Expiring ({kpiData?.expiringBatches?.length || 0})
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
                                <div className="p-8 text-center text-slate-500 text-xs font-medium">
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
                                <div className="p-8 text-center text-slate-500 text-xs font-medium">
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
                                                        {grn.purchaseOrder?.poNumber || grn.request?.requestNr || 'N/A'}
                                                    </td>
                                                    <td className="px-4 py-3 text-slate-700 dark:text-slate-300 font-semibold">{grn.supplier || grn.purchaseOrder?.vendor || 'N/A'}</td>
                                                    <td className="px-4 py-3 text-slate-600 dark:text-slate-400 font-medium">
                                                        {new Date(grn.createdAt).toLocaleDateString()}
                                                    </td>
                                                    <td className="px-4 py-3 text-right">
                                                        <Link href={`/inventory/grn?id=${grn.id}`} className="inline-flex items-center text-[10px] font-bold bg-purple-600 text-white px-3 py-1 rounded-lg hover:bg-purple-700 transition-all">
                                                            Perform Audit
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

                {/* Tab 3: Reorder Alerts */}
                <TabsContent value="reorder">
                    <Card className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
                        <CardHeader className="py-3 px-5 border-b border-slate-100 dark:border-slate-800 flex flex-row items-center justify-between">
                            <CardTitle className="text-sm font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
                                <AlertTriangle className="w-4 h-4 text-red-600" />
                                Items Below Reorder Point
                            </CardTitle>
                            <Link href="/inventory/stock" className="text-xs font-bold text-red-600 hover:text-red-700 flex items-center">
                                View Full Inventory <ArrowUpRight className="w-3.5 h-3.5 ml-0.5" />
                            </Link>
                        </CardHeader>
                        <CardContent className="p-0">
                            {kpiData?.lowStockAlerts?.length === 0 ? (
                                <div className="p-8 text-center text-slate-500 text-xs font-medium flex flex-col items-center gap-2">
                                    <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                                    All items are above their minimum stock levels.
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse text-xs">
                                        <thead>
                                            <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800">
                                                <th className="px-4 py-2.5 font-black uppercase text-[10px] text-slate-400">Item Name</th>
                                                <th className="px-4 py-2.5 font-black uppercase text-[10px] text-slate-400">Category</th>
                                                <th className="px-4 py-2.5 font-black uppercase text-[10px] text-slate-400 text-right">Current Qty</th>
                                                <th className="px-4 py-2.5 font-black uppercase text-[10px] text-slate-400 text-right">Min Level</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                            {kpiData?.lowStockAlerts?.map((item) => (
                                                <tr key={item.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                                                    <td className="px-4 py-3 font-bold text-slate-900 dark:text-slate-100">{item.name}</td>
                                                    <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{item.category || '-'}</td>
                                                    <td className="px-4 py-3 text-right">
                                                        <span className="font-black text-red-600 dark:text-red-400">{item.currentQty}</span>
                                                    </td>
                                                    <td className="px-4 py-3 text-right text-slate-500 font-semibold">{item.minLevel}</td>
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
                    <Card className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
                        <CardHeader className="py-3 px-5 border-b border-slate-100 dark:border-slate-800 flex flex-row items-center justify-between">
                            <CardTitle className="text-sm font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
                                <RefreshCw className="w-4 h-4 text-slate-600 dark:text-slate-400" />
                                Pending MRN (Returns) Approvals
                            </CardTitle>
                            <Link href="/inventory/admin/mrns" className="text-xs font-bold text-slate-600 hover:text-slate-700 flex items-center">
                                Manage Returns <ArrowUpRight className="w-3.5 h-3.5 ml-0.5" />
                            </Link>
                        </CardHeader>
                        <CardContent className="p-8 flex flex-col items-center justify-center gap-2 text-center text-slate-500">
                            {summary.pendingMrnCount > 0 ? (
                                <>
                                    <div className="h-12 w-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-2">
                                        <RefreshCw className="w-6 h-6 text-slate-600" />
                                    </div>
                                    <p className="text-sm font-bold text-slate-900 dark:text-slate-100">{summary.pendingMrnCount} Pending MRNs</p>
                                    <p className="text-xs max-w-[250px]">Returns are awaiting physical counting and manager approval before stock adjustment.</p>
                                    <Link href="/inventory/admin/mrns">
                                        <Button size="sm" className="mt-2 text-xs font-bold bg-slate-900 text-white hover:bg-slate-800">
                                            Review Returns
                                        </Button>
                                    </Link>
                                </>
                            ) : (
                                <div className="text-xs font-medium">No pending Material Return Notes (MRN) awaiting approval.</div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Tab 5: Material Balance (DB function fn_store_material_balance) */}
                <TabsContent value="balance">
                    <Card className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
                        <CardHeader className="py-3 px-5 border-b border-slate-100 dark:border-slate-800 flex flex-row items-center justify-between">
                            <CardTitle className="text-sm font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
                                <Package className="w-4 h-4 text-emerald-600" />
                                Store Material Balance
                            </CardTitle>
                            <Link href="/inventory/stock" className="text-xs font-bold text-emerald-600 hover:text-emerald-700 flex items-center">
                                Full Inventory <ArrowUpRight className="w-3.5 h-3.5 ml-0.5" />
                            </Link>
                        </CardHeader>
                        <CardContent className="p-0">
                            {!kpiData?.materialBalance || kpiData.materialBalance.length === 0 ? (
                                <div className="p-8 text-center text-slate-500 text-xs font-medium">
                                    No stock data available for this store.
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse text-xs">
                                        <thead>
                                            <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800">
                                                <th className="px-4 py-2.5 font-black uppercase text-[10px] text-slate-400">Item Code</th>
                                                <th className="px-4 py-2.5 font-black uppercase text-[10px] text-slate-400">Item Name</th>
                                                <th className="px-4 py-2.5 font-black uppercase text-[10px] text-slate-400 text-right">Current</th>
                                                <th className="px-4 py-2.5 font-black uppercase text-[10px] text-slate-400 text-right">Allocated</th>
                                                <th className="px-4 py-2.5 font-black uppercase text-[10px] text-slate-400 text-right">Available</th>
                                                <th className="px-4 py-2.5 font-black uppercase text-[10px] text-slate-400 text-right">Value (LKR)</th>
                                                <th className="px-4 py-2.5 font-black uppercase text-[10px] text-slate-400 text-center">Status</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                            {kpiData.materialBalance.slice(0, 20).map((row) => (
                                                <tr key={row.itemId} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                                                    <td className="px-4 py-3 font-mono font-bold text-slate-900 dark:text-slate-100">{row.itemCode}</td>
                                                    <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{row.itemName}</td>
                                                    <td className="px-4 py-3 text-right font-semibold text-slate-900 dark:text-slate-100">{row.currentStock.toFixed(2)}</td>
                                                    <td className="px-4 py-3 text-right text-slate-500">{row.allocatedStock.toFixed(2)}</td>
                                                    <td className="px-4 py-3 text-right font-bold text-blue-600 dark:text-blue-400">{row.availableStock.toFixed(2)}</td>
                                                    <td className="px-4 py-3 text-right font-semibold text-emerald-700 dark:text-emerald-400">{row.totalValue.toLocaleString()}</td>
                                                    <td className="px-4 py-3 text-center">
                                                        {row.reorderNeeded ? (
                                                            <Badge variant="outline" className="text-[10px] font-bold border-red-200 bg-red-50 text-red-700">REORDER</Badge>
                                                        ) : (
                                                            <Badge variant="outline" className="text-[10px] font-bold border-emerald-200 bg-emerald-50 text-emerald-700">OK</Badge>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                    {kpiData.materialBalance.length > 20 && (
                                        <div className="p-3 text-center border-t border-slate-100 dark:border-slate-800">
                                            <span className="text-[10px] font-bold text-slate-400">Showing 20 of {kpiData.materialBalance.length} items</span>
                                        </div>
                                    )}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Tab 6: Expiring Batches (DB function fn_expiring_batches) */}
                <TabsContent value="expiring">
                    <Card className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
                        <CardHeader className="py-3 px-5 border-b border-slate-100 dark:border-slate-800 flex flex-row items-center justify-between">
                            <CardTitle className="text-sm font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
                                <Clock className="w-4 h-4 text-amber-600" />
                                Batches Expiring Within 30 Days
                            </CardTitle>
                            <Link href="/inventory/stock" className="text-xs font-bold text-amber-600 hover:text-amber-700 flex items-center">
                                View All Batches <ArrowUpRight className="w-3.5 h-3.5 ml-0.5" />
                            </Link>
                        </CardHeader>
                        <CardContent className="p-0">
                            {!kpiData?.expiringBatches || kpiData.expiringBatches.length === 0 ? (
                                <div className="p-8 text-center text-slate-500 text-xs font-medium flex flex-col items-center gap-2">
                                    <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                                    No batches expiring in the next 30 days.
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse text-xs">
                                        <thead>
                                            <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800">
                                                <th className="px-4 py-2.5 font-black uppercase text-[10px] text-slate-400">Batch #</th>
                                                <th className="px-4 py-2.5 font-black uppercase text-[10px] text-slate-400">Item Code</th>
                                                <th className="px-4 py-2.5 font-black uppercase text-[10px] text-slate-400">Item Name</th>
                                                <th className="px-4 py-2.5 font-black uppercase text-[10px] text-slate-400 text-right">Qty</th>
                                                <th className="px-4 py-2.5 font-black uppercase text-[10px] text-slate-400">Expiry Date</th>
                                                <th className="px-4 py-2.5 font-black uppercase text-[10px] text-slate-400 text-center">Days Left</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                            {kpiData.expiringBatches.map((batch) => (
                                                <tr key={batch.batchId} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                                                    <td className="px-4 py-3 font-mono font-bold text-slate-900 dark:text-slate-100">{batch.batchNumber}</td>
                                                    <td className="px-4 py-3 font-mono text-slate-600 dark:text-slate-400">{batch.itemCode}</td>
                                                    <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{batch.itemName}</td>
                                                    <td className="px-4 py-3 text-right font-semibold text-slate-900 dark:text-slate-100">{batch.quantity.toFixed(2)}</td>
                                                    <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{new Date(batch.expiryDate).toLocaleDateString()}</td>
                                                    <td className="px-4 py-3 text-center">
                                                        <Badge variant="outline" className={cn(
                                                            "text-[10px] font-bold",
                                                            batch.daysUntilExpiry <= 7
                                                                ? 'border-red-200 bg-red-50 text-red-700'
                                                                : batch.daysUntilExpiry <= 14
                                                                    ? 'border-orange-200 bg-orange-50 text-orange-700'
                                                                    : 'border-amber-200 bg-amber-50 text-amber-700'
                                                        )}>
                                                            {batch.daysUntilExpiry} days
                                                        </Badge>
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
            </Tabs>
        </div>
    );
}

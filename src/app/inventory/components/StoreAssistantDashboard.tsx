"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    LayoutDashboard,
    Receipt,
    ClipboardList,
    RefreshCw,
    ArrowUpRight,
    Truck,
    CheckCircle2,
    Lock
} from "lucide-react";
import Link from 'next/link';
import { DashboardProps } from '@/types/inventory/dashboard.types';

export default function StoreAssistantDashboard({
    kpiData, isLoading, refetch, stores, selectedStoreId
}: DashboardProps) {

    const summary = kpiData?.summary || {
        totalStockQuantity: 0,
        totalUniqueItems: 0,
        lowStockCount: 0,
        pendingDispatchCount: 0,
        pendingGrnCount: 0,
        pendingMrnCount: 0,
    };

    const currentStoreName = stores.find(s => s.id === selectedStoreId)?.name || 'Assigned Store';

    return (
        <div className="space-y-6">
            {/* 1. Header & Store Lock */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm">
                <div>
                    <div className="flex items-center gap-2">
                        <div className="p-2 bg-slate-800 text-white rounded-xl shadow-md">
                            <LayoutDashboard className="w-5 h-5" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h1 className="text-xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
                                    Site Operations Dashboard
                                </h1>
                                <Badge variant="outline" className="text-[10px] font-bold border-amber-300 bg-amber-50 text-amber-800 flex items-center gap-1 shadow-sm">
                                    <Lock className="w-3 h-3" /> Locked to {currentStoreName}
                                </Badge>
                            </div>
                            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-0.5">
                                Site Store Dispatch Queue & Local Stock Receiving
                            </p>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-3 w-full md:w-auto">
                    <Button
                        onClick={() => refetch()}
                        variant="outline"
                        size="sm"
                        className="h-9 px-3 rounded-xl border-slate-200 text-xs font-bold gap-1.5"
                    >
                        <RefreshCw className="w-3.5 h-3.5" />
                        Refresh Queue
                    </Button>
                </div>
            </div>

            {/* 2. 1-Click Operational Action Bar */}
            <div className="grid grid-cols-2 gap-3">
                <Link href="/inventory/grn" className="group">
                    <div className="bg-gradient-to-br from-emerald-500 to-teal-600 text-white p-4 rounded-2xl shadow-sm hover:shadow-md hover:scale-[1.02] transition-all duration-200 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 bg-white/20 rounded-xl backdrop-blur-sm">
                                <Receipt className="w-5 h-5" />
                            </div>
                            <div className="flex flex-col">
                                <span className="text-sm font-black">Receive Deliveries</span>
                                <span className="text-[10px] font-medium text-emerald-100">Perform GRN on Inbound POs</span>
                            </div>
                        </div>
                        <ArrowUpRight className="w-5 h-5 opacity-70 group-hover:opacity-100 transition-opacity" />
                    </div>
                </Link>

                <Link href="/inventory/requests" className="group">
                    <div className="bg-gradient-to-br from-blue-600 to-indigo-700 text-white p-4 rounded-2xl shadow-sm hover:shadow-md hover:scale-[1.02] transition-all duration-200 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 bg-white/20 rounded-xl backdrop-blur-sm">
                                <ClipboardList className="w-5 h-5" />
                            </div>
                            <div className="flex flex-col">
                                <span className="text-sm font-black">Dispatch Materials</span>
                                <span className="text-[10px] font-medium text-blue-100">Issue MIN for Approved Requests</span>
                            </div>
                        </div>
                        <ArrowUpRight className="w-5 h-5 opacity-70 group-hover:opacity-100 transition-opacity" />
                    </div>
                </Link>
            </div>

            {/* 3. Operational Metrics */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Card className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
                    <CardContent className="p-4 flex items-center justify-between">
                        <div className="space-y-1">
                            <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Total Stock Qty</p>
                            <p className="text-lg font-black text-slate-900 dark:text-slate-100">
                                {summary.totalStockQuantity.toLocaleString()} Units
                            </p>
                            <p className="text-[11px] text-slate-500">{summary.totalUniqueItems} Unique Items</p>
                        </div>
                        <div className="h-10 w-10 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 flex items-center justify-center flex-none">
                            <ClipboardList className="w-5 h-5" />
                        </div>
                    </CardContent>
                </Card>

                <Card className="rounded-2xl border border-blue-100 dark:border-slate-800 bg-blue-50/50 dark:bg-slate-900 shadow-sm">
                    <CardContent className="p-4 flex items-center justify-between">
                        <div className="space-y-1">
                            <p className="text-[10px] font-black uppercase tracking-wider text-blue-600/70">To Dispatch</p>
                            <p className="text-lg font-black text-blue-600 dark:text-blue-400">
                                {summary.pendingDispatchCount} Requests
                            </p>
                            <p className="text-[11px] text-blue-600/70 font-medium">Awaiting MIN Issue</p>
                        </div>
                        <div className="h-10 w-10 rounded-xl bg-blue-100 dark:bg-blue-950/40 text-blue-600 flex items-center justify-center flex-none shadow-inner">
                            <Truck className="w-5 h-5" />
                        </div>
                    </CardContent>
                </Card>

                <Card className="rounded-2xl border border-purple-100 dark:border-slate-800 bg-purple-50/50 dark:bg-slate-900 shadow-sm">
                    <CardContent className="p-4 flex items-center justify-between">
                        <div className="space-y-1">
                            <p className="text-[10px] font-black uppercase tracking-wider text-purple-600/70">To Receive</p>
                            <p className="text-lg font-black text-purple-600 dark:text-purple-400">
                                {summary.pendingGrnCount} Deliveries
                            </p>
                            <p className="text-[11px] text-purple-600/70 font-medium">Awaiting GRN Count</p>
                        </div>
                        <div className="h-10 w-10 rounded-xl bg-purple-100 dark:bg-purple-950/40 text-purple-600 flex items-center justify-center flex-none shadow-inner">
                            <Receipt className="w-5 h-5" />
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* 4. To-Do Queues */}
            <Tabs defaultValue="dispatch" className="w-full space-y-4">
                <TabsList className="bg-white dark:bg-slate-900 p-1 rounded-xl border border-slate-200/80 dark:border-slate-800 grid grid-cols-2 gap-1 h-auto w-full md:w-[400px]">
                    <TabsTrigger value="dispatch" className="text-xs font-bold py-2 rounded-lg data-[state=active]:bg-blue-600 data-[state=active]:text-white">
                        🚚 Dispatches ({summary.pendingDispatchCount})
                    </TabsTrigger>
                    <TabsTrigger value="inbound" className="text-xs font-bold py-2 rounded-lg data-[state=active]:bg-purple-600 data-[state=active]:text-white">
                        📦 Deliveries ({summary.pendingGrnCount})
                    </TabsTrigger>
                </TabsList>

                {/* Tab 1: Dispatch Queue */}
                <TabsContent value="dispatch">
                    <Card className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
                        <CardHeader className="py-3 px-5 border-b border-slate-100 dark:border-slate-800 flex flex-row items-center justify-between">
                            <CardTitle className="text-sm font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
                                <Truck className="w-4 h-4 text-blue-600" />
                                Material Issue Queue
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                            {kpiData?.pendingDispatches?.length === 0 ? (
                                <div className="p-8 text-center text-slate-500 text-xs font-medium flex flex-col items-center gap-2">
                                    <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                                    No pending dispatches! Everything is cleared.
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse text-xs">
                                        <thead>
                                            <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800">
                                                <th className="px-4 py-3 font-black uppercase text-[10px] text-slate-400">Req #</th>
                                                <th className="px-4 py-3 font-black uppercase text-[10px] text-slate-400">Requester</th>
                                                <th className="px-4 py-3 font-black uppercase text-[10px] text-slate-400">Items</th>
                                                <th className="px-4 py-3 font-black uppercase text-[10px] text-slate-400 text-right">Action</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                            {kpiData?.pendingDispatches?.map((req) => (
                                                <tr key={req.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                                                    <td className="px-4 py-3 font-bold text-slate-900 dark:text-slate-100">{req.requestNr}</td>
                                                    <td className="px-4 py-3 text-slate-700 dark:text-slate-300 font-semibold">{req.requester?.name || 'N/A'}</td>
                                                    <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                                                        {req.items?.length || 0} Items
                                                    </td>
                                                    <td className="px-4 py-3 text-right">
                                                        <Link href={`/inventory/requests?id=${req.id}`} className="inline-flex items-center text-[10px] font-bold bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 transition-all shadow-sm">
                                                            Pick & Pack
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
                                Deliveries Awaiting GRN
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                            {kpiData?.pendingGrns?.length === 0 ? (
                                <div className="p-8 text-center text-slate-500 text-xs font-medium flex flex-col items-center gap-2">
                                    <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                                    No pending deliveries in the yard.
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse text-xs">
                                        <thead>
                                            <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800">
                                                <th className="px-4 py-3 font-black uppercase text-[10px] text-slate-400">GRN #</th>
                                                <th className="px-4 py-3 font-black uppercase text-[10px] text-slate-400">Supplier</th>
                                                <th className="px-4 py-3 font-black uppercase text-[10px] text-slate-400 text-right">Action</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                            {kpiData?.pendingGrns?.map((grn) => (
                                                <tr key={grn.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                                                    <td className="px-4 py-3 font-bold text-slate-900 dark:text-slate-100">{grn.grnNumber}</td>
                                                    <td className="px-4 py-3 text-slate-700 dark:text-slate-300 font-semibold">{grn.supplier || grn.purchaseOrder?.vendor || 'N/A'}</td>
                                                    <td className="px-4 py-3 text-right">
                                                        <Link href={`/inventory/grn?id=${grn.id}`} className="inline-flex items-center text-[10px] font-bold bg-purple-600 text-white px-3 py-1.5 rounded-lg hover:bg-purple-700 transition-all shadow-sm">
                                                            Start Count
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
            </Tabs>
        </div>
    );
}

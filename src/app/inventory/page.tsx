"use client";

import React, { useEffect, useState } from 'react';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    LayoutDashboard,
    Package,
    ArrowRightLeft,
    AlertTriangle,
    ChevronRight,
    TrendingUp,
    Clock,
    Store
} from "lucide-react";
import Link from 'next/link';
import { safeFormat } from '@/lib/utils';
import { cn } from "@/lib/utils";

interface User {
    id: string;
    name: string;
    role: string;
}

interface StoreType {
    id: string;
    name: string;
    managerId?: string;
}

interface Stock {
    id: string;
    itemId: string;
    storeId: string;
    quantity: number;
}

interface Item {
    id: string;
    name: string;
    minLevel: number;
}

interface Transaction {
    id: string;
    type: string;
    date: string;
    createdAt?: string;
    user?: { name: string };
    store: { name: string };
    items: Array<{ id: string; quantity: number; item: { name: string } }>;
}

export default function InventoryDashboardPage() {
    const [user] = useState<User | null>(() => {
        if (typeof window !== 'undefined') {
            const stored = localStorage.getItem('user');
            return stored ? JSON.parse(stored) : null;
        }
        return null;
    });
    const [myStore, setMyStore] = useState<StoreType | { id: 'unassigned'; name: string } | null>(null);

    const { data: stores = [] } = useQuery<StoreType[]>({
        queryKey: ['stores'],
        queryFn: async () => (await fetch('/api/inventory/stores')).json()
    });

    useEffect(() => {
        if (user && stores.length > 0) {
            const isGlobalViewer = ['SUPER_ADMIN', 'ADMIN', 'STORES_MANAGER'].includes(user.role);

            if (isGlobalViewer) {
                setTimeout(() => setMyStore(null), 0);
            } else {
                const managed = stores.find((s) => s.managerId === user.id);
                if (managed) {
                    setTimeout(() => setMyStore(managed), 0);
                } else {
                    setTimeout(() => setMyStore({ id: 'unassigned', name: 'No Assigned Store' }), 0);
                }
            }
        }
    }, [user, stores]);

    const isGlobal = !myStore || myStore.id === 'unassigned';
    const currentStoreId = myStore?.id;

    const { data: stockData = [] } = useQuery<Stock[]>({
        queryKey: ['stock-levels', currentStoreId],
        queryFn: async () => {
            const storeParam = (!currentStoreId || currentStoreId === 'unassigned') ? 'all' : currentStoreId;
            const res = await fetch(`/api/inventory/stock?storeId=${storeParam}`);
            return res.json();
        },
        enabled: !!user
    });

    const { data: items = [] } = useQuery<Item[]>({
        queryKey: ['items'],
        queryFn: async () => (await fetch('/api/inventory/items')).json()
    });

    const { data: recentTx = [] } = useQuery<Transaction[]>({
        queryKey: ['recent-tx', currentStoreId],
        queryFn: async () => {
            const params = new URLSearchParams();
            if (currentStoreId && currentStoreId !== 'unassigned') params.append('storeId', currentStoreId);
            const res = await fetch(`/api/inventory/transactions?${params.toString()}`);
            const data = await res.json();
            return Array.isArray(data) ? data.slice(0, 5) : [];
        },
        enabled: !!user
    });

    const { data: requests = [] } = useQuery<Array<{ status: string }>>({
        queryKey: ['requests-count', currentStoreId],
        queryFn: async () => {
            const params = new URLSearchParams();
            if (currentStoreId && currentStoreId !== 'unassigned') params.append('storeId', currentStoreId);
            const res = await fetch(`/api/inventory/requests?${params.toString()}`);
            return res.json();
        },
        enabled: !!user
    });

    const filteredStock = React.useMemo(() => {
        if (!Array.isArray(stockData)) return [];
        if (isGlobal || !currentStoreId || currentStoreId === 'unassigned') return stockData;
        return stockData.filter((s) => s.storeId === currentStoreId);
    }, [stockData, isGlobal, currentStoreId]);

    const lowStockAlerts = React.useMemo(() => {
        if (items.length === 0) return [];
        const alerts: Array<Item & { currentQty: number }> = [];

        items.forEach((item) => {
            if (item.minLevel > 0) {
                const relevantStock = filteredStock.filter((s) => s.itemId === item.id);
                const totalQty = relevantStock.reduce((acc: number, curr) => acc + curr.quantity, 0);

                if (totalQty <= item.minLevel) {
                    alerts.push({ ...item, currentQty: totalQty });
                }
            }
        });
        return alerts;
    }, [items, filteredStock]);

    const pendingRequestsCount = React.useMemo(() => {
        if (!Array.isArray(requests)) return 0;
        return requests.filter((r: { status: string }) => r.status === 'PENDING').length;
    }, [requests]);

    const totalStockCount = filteredStock.reduce((acc: number, curr) => acc + curr.quantity, 0);

    const displayTx = recentTx;

    return (
        <div className="erp-page-wrapper flex-row overflow-hidden">
            <Sidebar />
            <main className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
                <Header />
                <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
                    <div className="max-w-7xl mx-auto space-y-4">

                        {/* Page Header */}
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                            <div className="space-y-0.5">
                                <h1 className="text-xl font-black text-slate-900 tracking-tight">Inventory Overview</h1>
                                <p className="text-xs text-slate-500">
                                    {isGlobal ? 'Full Inventory Summary' : `Current Store: ${myStore?.name || 'Not Assigned'}`}
                                </p>
                            </div>
                            {!isGlobal && myStore && (
                                <div className="bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm flex items-center gap-1.5 flex-none">
                                    <Store className="w-4 h-4 text-blue-600" />
                                    <span className="font-bold text-xs text-slate-700">{myStore.name}</span>
                                </div>
                            )}
                        </div>

                        {/* Top Stats Cards */}
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                            <Card className="rounded-xl border border-slate-200 bg-white">
                                <CardContent className="p-3 flex items-center justify-between">
                                    <div>
                                        <p className="text-[10px] font-black uppercase text-slate-400">Material Items</p>
                                        <p className="text-base font-black text-slate-900">{items.length}</p>
                                    </div>
                                    <div className="h-8 w-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                                        <Package className="w-4 h-4" />
                                    </div>
                                </CardContent>
                            </Card>
                            <Card className="rounded-xl border border-slate-200 bg-white">
                                <CardContent className="p-3 flex items-center justify-between">
                                    <div>
                                        <p className="text-[10px] font-black uppercase text-slate-400">Total Stock on Hand</p>
                                        <p className="text-base font-black text-slate-900">{totalStockCount.toLocaleString()}</p>
                                    </div>
                                    <div className="h-8 w-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                                        <TrendingUp className="w-4 h-4" />
                                    </div>
                                </CardContent>
                            </Card>
                            <Card className="rounded-xl border border-slate-200 bg-white">
                                <CardContent className="p-3 flex items-center justify-between">
                                    <div>
                                        <p className="text-[10px] font-black uppercase text-slate-400">Awaiting Approval</p>
                                        <p className="text-base font-black text-purple-600">{pendingRequestsCount}</p>
                                    </div>
                                    <div className="h-8 w-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
                                        <Clock className="w-4 h-4" />
                                    </div>
                                </CardContent>
                            </Card>
                            <Card className="rounded-xl border border-slate-200 bg-white">
                                <CardContent className="p-3 flex items-center justify-between">
                                    <div>
                                        <p className="text-[10px] font-black uppercase text-slate-400">Critical Stock Levels</p>
                                        <p className={cn(
                                            "text-base font-black",
                                            lowStockAlerts.length > 0 ? 'text-red-600' : 'text-slate-900'
                                        )}>{lowStockAlerts.length}</p>
                                    </div>
                                    <div className={cn(
                                        "h-8 w-8 rounded-lg flex items-center justify-center",
                                        lowStockAlerts.length > 0 ? 'bg-red-50 text-red-600' : 'bg-slate-50 text-slate-400'
                                    )}>
                                        <AlertTriangle className="w-4 h-4" />
                                    </div>
                                </CardContent>
                            </Card>
                        </div>

                        {/* Two Columns Grid */}
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

                            {/* Left Column (Wide) - Low Stock & Transactions */}
                            <div className="lg:col-span-2 space-y-4">

                                {/* Reorder Alerts */}
                                <Card className={cn(
                                    "rounded-xl border bg-white shadow-sm overflow-hidden",
                                    lowStockAlerts.length > 0 ? 'border-red-200' : 'border-slate-200'
                                )}>
                                    <CardHeader className={cn(
                                        "py-2.5 px-4 border-b flex flex-row items-center justify-between space-y-0",
                                        lowStockAlerts.length > 0 ? 'bg-red-50/20' : 'bg-slate-50/20'
                                    )}>
                                        <div className="flex items-center gap-1.5">
                                            <AlertTriangle className={cn("w-4 h-4", lowStockAlerts.length > 0 ? 'text-red-500' : 'text-slate-400')} />
                                            <CardTitle className="text-xs font-black text-slate-900 uppercase tracking-wide">Reorder Alerts</CardTitle>
                                        </div>
                                        <Link href="/inventory/stock" className="text-[10px] font-bold text-blue-600 hover:text-blue-700 flex items-center">
                                            View Inventory <ChevronRight className="w-3 h-3 ml-0.5" />
                                        </Link>
                                    </CardHeader>
                                    <CardContent className="p-0">
                                        <div className="max-h-[200px] overflow-y-auto">
                                            {lowStockAlerts.length === 0 ? (
                                                <div className="p-8 text-center text-slate-500 text-xs flex flex-col items-center">
                                                    <CheckCircleIcon className="w-6 h-6 text-emerald-500 mb-1.5" />
                                                    All stock levels are within safe limits.
                                                </div>
                                            ) : (
                                                <table className="w-full text-left border-collapse">
                                                    <thead>
                                                        <tr>
                                                            <th className="px-3 py-1.5 text-[10px] font-black uppercase text-slate-400 tracking-wider">Item Name</th>
                                                            <th className="px-3 py-1.5 text-[10px] font-black uppercase text-slate-400 tracking-wider text-center">Min</th>
                                                            <th className="px-3 py-1.5 text-[10px] font-black uppercase text-slate-400 tracking-wider text-right">Current</th>
                                                            <th className="px-3 py-1.5 text-[10px] font-black uppercase text-slate-400 tracking-wider text-right pr-4">Action</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-slate-100 bg-white">
                                                        {lowStockAlerts.map((item) => (
                                                            <tr key={item.id} className="hover:bg-red-50/30 transition-colors">
                                                                <td className="px-3 py-2 text-xs font-bold text-slate-700 max-w-[180px] truncate">
                                                                    {item.name}
                                                                </td>
                                                                <td className="px-3 py-2 text-center text-slate-500 text-xs">{item.minLevel}</td>
                                                                <td className="px-3 py-2 text-right font-bold text-red-600 text-xs">{item.currentQty}</td>
                                                                <td className="px-3 py-2 text-right pr-4">
                                                                    <Link href="/inventory/requests" className="inline-flex items-center text-[9px] bg-blue-50 text-blue-700 font-bold px-2 py-0.5 rounded border border-blue-100 hover:bg-blue-100 transition-all">
                                                                        Order
                                                                    </Link>
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            )}
                                        </div>
                                    </CardContent>
                                </Card>

                                {/* Recent Movements */}
                                <Card className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                                    <CardHeader className="py-2.5 px-4 border-b bg-slate-50/20">
                                        <CardTitle className="text-xs font-black text-slate-900 uppercase tracking-wide">Recent Movements</CardTitle>
                                    </CardHeader>
                                    <CardContent className="p-0">
                                        <div className="max-h-[220px] overflow-y-auto">
                                            {displayTx.length === 0 ? (
                                                <div className="p-8 text-center text-slate-500 text-xs">No recent transactions.</div>
                                            ) : (
                                                <table className="w-full text-left border-collapse">
                                                    <tbody className="divide-y divide-slate-100">
                                                        {displayTx.map((tx) => (
                                                            <tr key={tx.id} className="hover:bg-slate-50/50 transition-colors">
                                                                <td className="px-3 py-2.5 w-6">
                                                                    <div className={cn(
                                                                        "w-1.5 h-1.5 rounded-full",
                                                                        ['GRN_IN'].includes(tx.type) ? 'bg-emerald-500' : 'bg-blue-500'
                                                                    )}></div>
                                                                </td>
                                                                <td className="px-2 py-2.5">
                                                                    <div className="font-bold text-slate-800 text-xs">
                                                                        {tx.type === 'GRN_IN' ? 'Goods Received' : tx.type === 'ISSUE_OUT' ? 'Stock Issued' : tx.type.replace('_', ' ')}
                                                                    </div>
                                                                    <div className="text-slate-400 text-[9px]">
                                                                        {safeFormat(tx.date || tx.createdAt, 'MMM dd, HH:mm')} by {tx.user?.name || 'System'}
                                                                    </div>
                                                                </td>
                                                                <td className="px-2 py-2.5 text-slate-600 text-xs">
                                                                    {isGlobal && <div className="text-[9px] font-black text-slate-400 uppercase leading-none">{tx.store.name}</div>}
                                                                    <div className="mt-0.5">{tx.items.length} items moved</div>
                                                                </td>
                                                                <td className="px-3 py-2.5 text-right pr-4">
                                                                    <Link href="/inventory/reports/cardex" className="text-[10px] font-bold text-blue-600 hover:text-blue-700">Details</Link>
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            )}
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>

                            {/* Right Column - Tasks & Status */}
                            <div className="space-y-4">
                                <Card className="bg-gradient-to-br from-blue-600 to-slate-800 text-white border-none rounded-xl shadow-sm overflow-hidden">
                                    <CardContent className="p-4">
                                        <h3 className="font-bold text-sm mb-0.5">Inventory Tasks</h3>
                                        <p className="text-blue-100 text-[10px] mb-3">Easily manage your daily warehouse operations.</p>

                                        <div className="space-y-1.5">
                                            <Link href="/inventory/requests" className="flex justify-between items-center bg-white/10 hover:bg-white/20 transition p-2 rounded-lg text-xs font-semibold">
                                                <span>Create Stock Request</span>
                                                <ArrowRightLeft className="w-3.5 h-3.5 text-blue-200" />
                                            </Link>
                                            <Link href="/inventory/grn" className="flex justify-between items-center bg-white/10 hover:bg-white/20 transition p-2 rounded-lg text-xs font-semibold">
                                                <span>Add Received Goods (GRN)</span>
                                                <Package className="w-3.5 h-3.5 text-emerald-200" />
                                            </Link>
                                            {isGlobal && (
                                                <Link href="/inventory/items/import" className="flex justify-between items-center bg-white/10 hover:bg-white/20 transition p-2 rounded-lg text-xs font-semibold">
                                                    <span>Import Multiple Items</span>
                                                    <LayoutDashboard className="w-3.5 h-3.5 text-purple-200" />
                                                </Link>
                                            )}
                                        </div>
                                    </CardContent>
                                </Card>

                                <Card className="rounded-xl border border-slate-200 bg-white shadow-sm">
                                    <CardHeader className="py-2.5 px-4 border-b bg-slate-50/20"><CardTitle className="text-xs font-black text-slate-900 uppercase tracking-wide">System Status</CardTitle></CardHeader>
                                    <CardContent className="p-3 text-[11px] space-y-2">
                                        <div className="flex justify-between py-1 border-b border-slate-100">
                                            <span className="text-slate-500">Module Status</span>
                                            <span className="text-emerald-600 font-bold">Active</span>
                                        </div>
                                        <div className="flex justify-between py-1 border-b border-slate-100">
                                            <span className="text-slate-500">Last Sync</span>
                                            <span className="text-slate-700">Just now</span>
                                        </div>
                                        <div className="flex justify-between py-1">
                                            <span className="text-slate-500">Your System Role</span>
                                            <span className="text-blue-600 font-bold uppercase">{user?.role || 'Guest'}</span>
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>

                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}

function CheckCircleIcon({ className }: { className?: string }) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
        </svg>
    );
}

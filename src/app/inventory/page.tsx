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
    TrendingUp, // For stock movement
    Clock, // For pending
    Store // For Store identifier
} from "lucide-react";
import Link from 'next/link';
import { format } from 'date-fns';

interface User {
    id: string;
    name: string;
    role: string;
}

interface Store {
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
    createdAt: string;
    user: { name: string };
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
    const [myStore, setMyStore] = useState<Store | { id: 'unassigned'; name: string } | null>(null);

    // --- 1. DETERMINE SCOPE (Role & Store) ---
    const { data: stores = [] } = useQuery<Store[]>({
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
    const currentStoreId = myStore?.id; // If null, global.

    // --- 2. FETCH DATA BASED ON SCOPE ---

    // Stats: Stock Levels
    const { data: stockData = [] } = useQuery<Stock[]>({
        queryKey: ['stock-levels', currentStoreId],
        queryFn: async () => {
            const res = await fetch('/api/inventory/stock');
            return res.json();
        },
        enabled: !!user
    });

    // Items (Global context needed for names etc)
    const { data: items = [] } = useQuery<Item[]>({
        queryKey: ['items'],
        queryFn: async () => (await fetch('/api/inventory/items')).json()
    });

    // Recent Transactions
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

    // Pending Requests Count
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


    // --- 3. CALCULATE WIDGET DATA ---

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
                // Calculate total qty for this item within the current scope
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

    // Filter recent TX to relevant ones if scope is global (API handles store filter)
    const displayTx = recentTx;

    return (
        <div className="h-screen flex bg-slate-50 overflow-hidden">
            <Sidebar />
            <main className="flex-1 flex flex-col min-w-0 h-full">
                <Header />
                <div className="flex-1 overflow-y-auto p-4 md:p-8">
                    <div className="max-w-6xl mx-auto space-y-6">

                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div>
                                <h1 className="text-2xl font-bold text-slate-900">Inventory Dashboard</h1>
                                <p className="text-slate-500">
                                    {isGlobal ? 'Company-wide Overview' : `Store View: ${myStore?.name || 'Unassigned'}`}
                                </p>
                            </div>
                            {!isGlobal && myStore && (
                                <div className="bg-white px-4 py-2 rounded-lg border shadow-sm flex items-center gap-2">
                                    <Store className="w-4 h-4 text-blue-600" />
                                    <span className="font-semibold text-sm text-slate-700">{myStore.name}</span>
                                </div>
                            )}
                        </div>

                        {/* Top Stats Cards */}
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <Card>
                                <CardContent className="p-6 flex items-center justify-between">
                                    <div>
                                        <p className="text-xs font-medium text-slate-500 uppercase">Total Items (Scope)</p>
                                        <h3 className="text-2xl font-bold text-slate-900">{items.length}</h3>
                                        {/* Shows global item types count, effectively */}
                                    </div>
                                    <div className="bg-blue-100 p-3 rounded-full"><Package className="w-6 h-6 text-blue-600" /></div>
                                </CardContent>
                            </Card>
                            <Card>
                                <CardContent className="p-6 flex items-center justify-between">
                                    <div>
                                        <p className="text-xs font-medium text-slate-500 uppercase">Total Stock Qty</p>
                                        <h3 className="text-2xl font-bold text-slate-900">{totalStockCount.toLocaleString()}</h3>
                                    </div>
                                    <div className="bg-emerald-100 p-3 rounded-full"><TrendingUp className="w-6 h-6 text-emerald-600" /></div>
                                </CardContent>
                            </Card>
                            <Card>
                                <CardContent className="p-6 flex items-center justify-between">
                                    <div>
                                        <p className="text-xs font-medium text-slate-500 uppercase">Pending Requests</p>
                                        <h3 className="text-2xl font-bold text-purple-600">{pendingRequestsCount}</h3>
                                    </div>
                                    <div className="bg-purple-100 p-3 rounded-full"><Clock className="w-6 h-6 text-purple-600" /></div>
                                </CardContent>
                            </Card>
                            <Card>
                                <CardContent className="p-6 flex items-center justify-between">
                                    <div>
                                        <p className="text-xs font-medium text-slate-500 uppercase">Low Stock Alerts</p>
                                        <h3 className={`text-2xl font-bold ${lowStockAlerts.length > 0 ? 'text-red-600' : 'text-slate-700'}`}>{lowStockAlerts.length}</h3>
                                    </div>
                                    <div className={`${lowStockAlerts.length > 0 ? 'bg-red-100' : 'bg-slate-100'} p-3 rounded-full`}>
                                        <AlertTriangle className={`w-6 h-6 ${lowStockAlerts.length > 0 ? 'text-red-600' : 'text-slate-400'}`} />
                                    </div>
                                </CardContent>
                            </Card>
                        </div>

                        {/* Two Columns */}
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                            {/* Left Column (Wide) - Low Stock & Transactions */}
                            <div className="lg:col-span-2 space-y-6">

                                {/* ALERTS WIDGET */}
                                <Card className={`shadow-sm ${lowStockAlerts.length > 0 ? 'border-red-200' : ''}`}>
                                    <CardHeader className={`${lowStockAlerts.length > 0 ? 'bg-red-50/50' : ''} border-b pb-3`}>
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <AlertTriangle className={`w-5 h-5 ${lowStockAlerts.length > 0 ? 'text-red-500' : 'text-slate-400'}`} />
                                                <CardTitle className="text-base text-slate-800">Critical Stock Alerts</CardTitle>
                                            </div>
                                            <Link href="/inventory/stock" className="text-xs text-blue-600 hover:underline flex items-center">
                                                View Stock <ChevronRight className="w-3 h-3 ml-1" />
                                            </Link>
                                        </div>
                                    </CardHeader>
                                    <CardContent className="p-0">
                                        <div className="max-h-[250px] overflow-y-auto">
                                            {lowStockAlerts.length === 0 ? (
                                                <div className="p-8 text-center text-slate-500 text-sm flex flex-col items-center">
                                                    <CheckCircleIcon className="w-8 h-8 text-emerald-400 mb-2" />
                                                    All monitored stock levels are healthy.
                                                </div>
                                            ) : (
                                                <table className="w-full text-sm text-left">
                                                    <thead className="bg-slate-50 text-slate-500 text-xs uppercase sticky top-0">
                                                        <tr>
                                                            <th className="px-4 py-2 font-medium">Item Name</th>
                                                            <th className="px-4 py-2 font-medium text-center">Min</th>
                                                            <th className="px-4 py-2 font-medium text-right">Current</th>
                                                            <th className="px-4 py-2 font-medium text-right">Action</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y">
                                                        {lowStockAlerts.map((item) => (
                                                            <tr key={item.id} className="hover:bg-red-50/30">
                                                                <td className="px-4 py-3 font-medium text-slate-700 max-w-[150px] truncate">
                                                                    {item.name}
                                                                </td>
                                                                <td className="px-4 py-3 text-center text-slate-500 text-xs">{item.minLevel}</td>
                                                                <td className="px-4 py-3 text-right font-bold text-red-600">{item.currentQty}</td>
                                                                <td className="px-4 py-3 text-right">
                                                                    <Link href="/inventory/requests" className="text-[10px] bg-blue-50 text-blue-600 px-2 py-1 rounded hover:bg-blue-100">
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

                                {/* RECENT ACTIVITY WIDGET */}
                                <Card>
                                    <CardHeader className="border-b pb-3">
                                        <CardTitle className="text-base text-slate-800">Recent Activity</CardTitle>
                                    </CardHeader>
                                    <CardContent className="p-0">
                                        <div className="max-h-[300px] overflow-y-auto">
                                            {displayTx.length === 0 ? (
                                                <div className="p-8 text-center text-slate-500 text-sm">No recent transactions.</div>
                                            ) : (
                                                <table className="w-full text-xs text-left">
                                                    <tbody className="divide-y">
                                                        {displayTx.map((tx) => (
                                                            <tr key={tx.id} className="hover:bg-slate-50">
                                                                <td className="px-4 py-3 w-10">
                                                                    <div className={`w-2 h-2 rounded-full ${['GRN_IN'].includes(tx.type) ? 'bg-emerald-500' : 'bg-blue-400'}`}></div>
                                                                </td>
                                                                <td className="px-2 py-3">
                                                                    <div className="font-semibold text-slate-700">{tx.type.replace('_', ' ')}</div>
                                                                    <div className="text-slate-400 text-[10px]">
                                                                        {format(new Date(tx.createdAt), 'MMM dd, HH:mm')} by {tx.user?.name}
                                                                    </div>
                                                                </td>
                                                                <td className="px-2 py-3 text-slate-600">
                                                                    {isGlobal && <div className="text-[10px] font-bold text-slate-500">{tx.store.name}</div>}
                                                                    {tx.items.length} items processed
                                                                </td>
                                                                <td className="px-4 py-3 text-right">
                                                                    <Link href="/inventory/reports/cardex" className="text-blue-500 hover:text-blue-700">View</Link>
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

                            {/* Right Column - Navigation & Quick Links */}
                            <div className="space-y-6">
                                <Card className="bg-gradient-to-br from-blue-600 to-slate-800 text-white border-none">
                                    <CardContent className="p-6">
                                        <h3 className="font-bold text-lg mb-1">Quick Actions</h3>
                                        <p className="text-blue-100 text-xs mb-4">Common inventory tasks</p>

                                        <div className="space-y-2">
                                            <Link href="/inventory/requests" className="block bg-white/10 hover:bg-white/20 transition p-2 rounded flex justify-between items-center text-sm font-medium">
                                                <span>New Stock Request</span>
                                                <ArrowRightLeft className="w-4 h-4 text-blue-200" />
                                            </Link>
                                            <Link href="/inventory/grn" className="block bg-white/10 hover:bg-white/20 transition p-2 rounded flex justify-between items-center text-sm font-medium">
                                                <span>GRN Entry</span>
                                                <Package className="w-4 h-4 text-emerald-200" />
                                            </Link>
                                            {isGlobal && (
                                                <Link href="/inventory/items/import" className="block bg-white/10 hover:bg-white/20 transition p-2 rounded flex justify-between items-center text-sm font-medium">
                                                    <span>Bulk Import Items</span>
                                                    <LayoutDashboard className="w-4 h-4 text-purple-200" />
                                                </Link>
                                            )}
                                        </div>
                                    </CardContent>
                                </Card>

                                <Card>
                                    <CardHeader className="pb-2"><CardTitle className="text-sm">System Status</CardTitle></CardHeader>
                                    <CardContent className="text-xs space-y-2">
                                        <div className="flex justify-between py-1 border-b">
                                            <span className="text-slate-500">Inventory Module</span>
                                            <span className="text-emerald-600 font-bold">Active</span>
                                        </div>
                                        <div className="flex justify-between py-1 border-b">
                                            <span className="text-slate-500">Last Sync</span>
                                            <span className="text-slate-700">Just now</span>
                                        </div>
                                        <div className="flex justify-between py-1 border-b">
                                            <span className="text-slate-500">Your Role</span>
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

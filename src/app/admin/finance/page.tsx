"use client";

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { 
    XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    AreaChart, Area
} from 'recharts';
import { Landmark, Receipt, ShieldAlert, TrendingUp, Users, AlertTriangle, Coins } from "lucide-react";

interface DashboardData {
    metrics: {
        outstandingInvoices: number;
        pendingPVs: number;
        totalRetentionHeld: number;
        activePenalties: number;
    };
    overdueInvoices: {
        id: string;
        invoiceNumber: string;
        contractorName: string;
        amount: number;
        dueDate: string;
    }[];
    topVendors: {
        name: string;
        totalSpend: number;
    }[];
    monthlyTrend: {
        month: string;
        total: number;
    }[];
}

export default function FinanceDashboardPage() {
    const { data, isLoading } = useQuery<DashboardData>({
        queryKey: ["finance-dashboard-metrics"],
        queryFn: async () => {
            const res = await fetch("/api/admin/finance/dashboard");
            if (!res.ok) throw new Error("Failed to fetch dashboard metrics");
            return res.json();
        }
    });

    const formatCurrency = (val: number) => {
        return new Intl.NumberFormat('en-LK', {
            style: 'currency',
            currency: 'LKR',
            maximumFractionDigits: 0
        }).format(val || 0);
    };

    if (isLoading || !data) {
        return (
            <div className="h-screen flex bg-slate-50 dark:bg-slate-950 overflow-hidden">
                <Sidebar />
                <main className="flex-1 flex flex-col min-w-0 h-full">
                    <Header />
                    <div className="flex-1 flex items-center justify-center">
                        <span className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></span>
                    </div>
                </main>
            </div>
        );
    }

    return (
        <div className="h-screen flex bg-slate-50 dark:bg-slate-950 overflow-hidden">
            <Sidebar />
            <main className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
                <Header />
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    
                    {/* Header title */}
                    <div className="flex justify-between items-center">
                        <div>
                            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">Financial Control Center</h1>
                            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                                Real-time executive dashboard for corporate accounts, payments, and penalties
                            </p>
                        </div>
                    </div>

                    {/* Summary Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        
                        <Card className="border-slate-200/60 dark:border-slate-800 bg-white dark:bg-slate-900/60 shadow-xs relative overflow-hidden group">
                            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                                <CardTitle className="text-xs font-bold text-slate-400 uppercase tracking-wider">Outstanding Payables</CardTitle>
                                <div className="p-2 bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 rounded-md">
                                    <Receipt className="w-4 h-4" />
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="text-xl font-black text-slate-900 dark:text-slate-50">
                                    {formatCurrency(data.metrics.outstandingInvoices)}
                                </div>
                                <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-1 font-semibold flex items-center gap-1">
                                    Pending settlement invoices
                                </p>
                            </CardContent>
                            <div className="absolute bottom-0 left-0 w-full h-[3px] bg-amber-500" />
                        </Card>

                        <Card className="border-slate-200/60 dark:border-slate-800 bg-white dark:bg-slate-900/60 shadow-xs relative overflow-hidden group">
                            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                                <CardTitle className="text-xs font-bold text-slate-400 uppercase tracking-wider">Pending Approvals</CardTitle>
                                <div className="p-2 bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 rounded-md">
                                    <Landmark className="w-4 h-4" />
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-black text-slate-900 dark:text-slate-50">
                                    {data.metrics.pendingPVs} <span className="text-xs font-medium text-slate-400">Vouchers</span>
                                </div>
                                <p className="text-[10px] text-blue-600 dark:text-blue-400 mt-1 font-semibold flex items-center gap-1">
                                    Awaiting authorization approvals
                                </p>
                            </CardContent>
                            <div className="absolute bottom-0 left-0 w-full h-[3px] bg-blue-500" />
                        </Card>

                        <Card className="border-slate-200/60 dark:border-slate-800 bg-white dark:bg-slate-900/60 shadow-xs relative overflow-hidden group">
                            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                                <CardTitle className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Retention Held</CardTitle>
                                <div className="p-2 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 rounded-md">
                                    <Coins className="w-4 h-4" />
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="text-xl font-black text-slate-900 dark:text-slate-50">
                                    {formatCurrency(data.metrics.totalRetentionHeld)}
                                </div>
                                <p className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-1 font-semibold flex items-center gap-1">
                                    DLP contract retention held
                                </p>
                            </CardContent>
                            <div className="absolute bottom-0 left-0 w-full h-[3px] bg-emerald-500" />
                        </Card>

                        <Card className="border-slate-200/60 dark:border-slate-800 bg-white dark:bg-slate-900/60 shadow-xs relative overflow-hidden group">
                            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                                <CardTitle className="text-xs font-bold text-slate-400 uppercase tracking-wider">Levied LD Penalties</CardTitle>
                                <div className="p-2 bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 rounded-md">
                                    <ShieldAlert className="w-4 h-4" />
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="text-xl font-black text-slate-900 dark:text-slate-50">
                                    {formatCurrency(data.metrics.activePenalties)}
                                </div>
                                <p className="text-[10px] text-red-600 dark:text-red-400 mt-1 font-semibold flex items-center gap-1">
                                    Deductions pending collections
                                </p>
                            </CardContent>
                            <div className="absolute bottom-0 left-0 w-full h-[3px] bg-red-500" />
                        </Card>

                    </div>

                    {/* Chart & Tables Layout */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        
                        {/* Trend Area Chart */}
                        <Card className="lg:col-span-2 border-slate-200/60 dark:border-slate-800 bg-white dark:bg-slate-900/60">
                            <CardHeader>
                                <CardTitle className="text-base font-bold flex items-center gap-2">
                                    <TrendingUp className="w-4 h-4 text-emerald-600" />
                                    6-Month Settlement Trend
                                </CardTitle>
                                <CardDescription>Monthly totals of settled (paid) Payment Vouchers (LKR)</CardDescription>
                            </CardHeader>
                            <CardContent className="h-72 w-full min-w-0">
                                <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                                    <AreaChart data={data.monthlyTrend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                        <defs>
                                            <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
                                                <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" className="dark:stroke-slate-800" />
                                        <XAxis dataKey="month" tickLine={false} axisLine={false} style={{ fontSize: '11px', fill: '#64748b' }} />
                                        <YAxis tickLine={false} axisLine={false} tickFormatter={v => `LKR ${v/1000}k`} style={{ fontSize: '11px', fill: '#64748b' }} />
                                        <Tooltip formatter={(value: unknown) => [formatCurrency(Number(value)), 'Paid Amount']} />
                                        <Area type="monotone" dataKey="total" stroke="#10b981" strokeWidth={2.5} fillOpacity={1} fill="url(#colorTotal)" />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </CardContent>
                        </Card>

                        {/* Top Spend Vendors */}
                        <Card className="border-slate-200/60 dark:border-slate-800 bg-white dark:bg-slate-900/60">
                            <CardHeader>
                                <CardTitle className="text-base font-bold flex items-center gap-2">
                                    <Users className="w-4 h-4 text-blue-600" />
                                    Top Vendors by Spend
                                </CardTitle>
                                <CardDescription>Consolidated vendor procurement totals</CardDescription>
                            </CardHeader>
                            <CardContent className="h-72 flex flex-col justify-between">
                                {data.topVendors.length === 0 ? (
                                    <div className="flex-1 flex items-center justify-center text-xs text-slate-400 italic">No procurement spend registered.</div>
                                ) : (
                                    <div className="space-y-4">
                                        {data.topVendors.map((vendor, idx) => (
                                            <div key={idx} className="space-y-1">
                                                <div className="flex justify-between text-xs font-semibold">
                                                    <span className="truncate max-w-[200px] text-slate-800 dark:text-slate-200">{vendor.name}</span>
                                                    <span className="text-slate-600 dark:text-slate-400">{formatCurrency(vendor.totalSpend)}</span>
                                                </div>
                                                <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                                                    <div 
                                                        className="bg-blue-600 h-full rounded-full" 
                                                        style={{ 
                                                            width: `${(vendor.totalSpend / Math.max(...data.topVendors.map(v => v.totalSpend))) * 100}%` 
                                                        }} 
                                                    />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                    </div>

                    {/* Overdue Invoices List */}
                    <Card className="border-slate-200/60 dark:border-slate-800 bg-white dark:bg-slate-900/60">
                        <CardHeader>
                            <CardTitle className="text-base font-bold flex items-center gap-2 text-red-600">
                                <AlertTriangle className="w-4 h-4" />
                                Overdue Contractor Invoices
                            </CardTitle>
                            <CardDescription>Payables currently past their payment due date</CardDescription>
                        </CardHeader>
                        <CardContent className="p-0">
                            <Table>
                                <TableHeader className="bg-slate-50 dark:bg-slate-800/40">
                                    <TableRow>
                                        <TableHead>Invoice Number</TableHead>
                                        <TableHead>Contractor</TableHead>
                                        <TableHead>Due Date</TableHead>
                                        <TableHead className="text-right">Outstanding Amount</TableHead>
                                        <TableHead className="w-[100px]"></TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {data.overdueInvoices.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={5} className="text-center py-6 text-slate-400 text-xs italic">
                                                No overdue contractor invoices!
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        data.overdueInvoices.map((inv) => (
                                            <TableRow key={inv.id}>
                                                <TableCell className="font-mono font-bold text-slate-900 dark:text-slate-100">{inv.invoiceNumber}</TableCell>
                                                <TableCell className="font-medium text-slate-700 dark:text-slate-300">{inv.contractorName}</TableCell>
                                                <TableCell className="text-xs text-red-600 font-semibold">{new Date(inv.dueDate).toLocaleDateString()}</TableCell>
                                                <TableCell className="text-right text-red-600 font-bold">LKR {inv.amount.toLocaleString()}</TableCell>
                                                <TableCell>
                                                    <Badge variant="outline" className="border-red-200 text-red-700 bg-red-50 text-[10px] font-bold">
                                                        OVERDUE
                                                    </Badge>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>

                </div>
            </main>
        </div>
    );
}

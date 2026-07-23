"use client";

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import RoleGuard from '@/components/RoleGuard';
import { ROLE_GROUPS } from '@/config/sidebar-menu';
import { TrendingUp, TrendingDown, FileText } from "lucide-react";

interface AccountBalanceSummary {
    code: string;
    name: string;
    type: string;
    netBalance: number;
}

interface PnlData {
    revenueAccounts: AccountBalanceSummary[];
    expenseAccounts: AccountBalanceSummary[];
    totalRevenue: number;
    totalExpense: number;
    netProfit: number;
}

export default function PnlPage() {
    const { data, isLoading } = useQuery<PnlData>({
        queryKey: ['pnl-report'],
        queryFn: async () => {
            const res = await fetch(`/api/finance/reports/pnl?_t=${Date.now()}`, { cache: 'no-store' });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error?.message || 'Failed to fetch Profit & Loss');
            return json.data;
        }
    });

    const isProfitable = (data?.netProfit || 0) >= 0;

    return (
        <RoleGuard allowedRoles={ROLE_GROUPS.FINANCE}>
            <div className="flex h-screen bg-slate-50 overflow-hidden">
                <Sidebar />
                <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                    <Header />
                    <main className="flex-1 overflow-y-auto p-6 space-y-6">
                        
                        {/* Title */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div>
                                <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
                                    <FileText className="w-7 h-7 text-indigo-600" />
                                    Profit & Loss Statement (Income Statement)
                                </h1>
                                <p className="text-sm text-slate-500 mt-1">
                                    Financial summary of operational revenues, cost of sales, and administrative expenses.
                                </p>
                            </div>

                            <div className={`p-4 rounded-xl border flex items-center gap-3 ${isProfitable ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-rose-50 border-rose-200 text-rose-900'}`}>
                                {isProfitable ? <TrendingUp className="w-6 h-6 text-emerald-600" /> : <TrendingDown className="w-6 h-6 text-rose-600" />}
                                <div>
                                    <div className="text-xs uppercase font-bold text-slate-500">Net Profit / (Loss)</div>
                                    <div className="text-xl font-bold font-mono">
                                        LKR {(data?.netProfit || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* P&L Layout */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            
                            {/* Revenue Section */}
                            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                                <div className="bg-blue-50/70 p-4 border-b border-slate-200 flex justify-between items-center">
                                    <h2 className="font-bold text-blue-900 uppercase text-xs tracking-wider">Revenues & Operating Income</h2>
                                    <span className="font-mono font-bold text-blue-900 text-sm">
                                        LKR {(data?.totalRevenue || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                    </span>
                                </div>
                                <div className="divide-y divide-slate-100">
                                    {isLoading ? (
                                        <div className="p-6 text-center text-slate-500">Loading Revenue accounts...</div>
                                    ) : (data?.revenueAccounts.length || 0) === 0 ? (
                                        <div className="p-6 text-center text-slate-500 text-sm">No revenue recorded for period.</div>
                                    ) : (
                                        data?.revenueAccounts.map(acc => (
                                            <div key={acc.code} className="p-3.5 flex justify-between items-center hover:bg-slate-50">
                                                <div>
                                                    <span className="font-mono font-bold text-slate-900 text-xs mr-2">{acc.code}</span>
                                                    <span className="text-sm font-medium text-slate-800">{acc.name}</span>
                                                </div>
                                                <span className="font-mono font-semibold text-slate-900 text-sm">
                                                    LKR {acc.netBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                                </span>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>

                            {/* Expense Section */}
                            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                                <div className="bg-rose-50/70 p-4 border-b border-slate-200 flex justify-between items-center">
                                    <h2 className="font-bold text-rose-900 uppercase text-xs tracking-wider">Expenses & Cost of Sales</h2>
                                    <span className="font-mono font-bold text-rose-900 text-sm">
                                        LKR {(data?.totalExpense || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                    </span>
                                </div>
                                <div className="divide-y divide-slate-100">
                                    {isLoading ? (
                                        <div className="p-6 text-center text-slate-500">Loading Expense accounts...</div>
                                    ) : (data?.expenseAccounts.length || 0) === 0 ? (
                                        <div className="p-6 text-center text-slate-500 text-sm">No expenses recorded for period.</div>
                                    ) : (
                                        data?.expenseAccounts.map(acc => (
                                            <div key={acc.code} className="p-3.5 flex justify-between items-center hover:bg-slate-50">
                                                <div>
                                                    <span className="font-mono font-bold text-slate-900 text-xs mr-2">{acc.code}</span>
                                                    <span className="text-sm font-medium text-slate-800">{acc.name}</span>
                                                </div>
                                                <span className="font-mono font-semibold text-slate-900 text-sm">
                                                    LKR {acc.netBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                                </span>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>

                        </div>

                    </main>
                </div>
            </div>
        </RoleGuard>
    );
}

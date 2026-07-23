"use client";

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import RoleGuard from '@/components/RoleGuard';
import { ROLE_GROUPS } from '@/config/sidebar-menu';
import { Badge } from "@/components/ui/badge";
import { Landmark, CheckCircle2, AlertTriangle } from "lucide-react";

interface AccountBalanceSummary {
    code: string;
    name: string;
    type: string;
    netBalance: number;
}

interface BalanceSheetData {
    assetAccounts: AccountBalanceSummary[];
    liabilityAccounts: AccountBalanceSummary[];
    equityAccounts: AccountBalanceSummary[];
    totalAssets: number;
    totalLiabilities: number;
    retainedEarnings: number;
    totalEquity: number;
    totalLiabilitiesAndEquity: number;
    isBalanced: boolean;
    difference: number;
}

export default function BalanceSheetPage() {
    const { data, isLoading } = useQuery<BalanceSheetData>({
        queryKey: ['balance-sheet-report'],
        queryFn: async () => {
            const res = await fetch(`/api/finance/reports/balance-sheet?_t=${Date.now()}`, { cache: 'no-store' });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error?.message || 'Failed to fetch Balance Sheet');
            return json.data;
        }
    });

    return (
        <RoleGuard allowedRoles={ROLE_GROUPS.FINANCE}>
            <div className="flex h-screen bg-slate-50 overflow-hidden">
                <Sidebar />
                <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                    <Header />
                    <main className="flex-1 overflow-y-auto p-6 space-y-6">
                        
                        {/* Header */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div>
                                <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
                                    <Landmark className="w-7 h-7 text-indigo-600" />
                                    Balance Sheet Statement
                                </h1>
                                <p className="text-sm text-slate-500 mt-1">
                                    Statement of Financial Position: Assets = Liabilities + Equity.
                                </p>
                            </div>

                            {data?.isBalanced ? (
                                <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 py-1.5 px-4 text-sm font-semibold flex items-center gap-1.5 self-start">
                                    <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Equation Balanced
                                </Badge>
                            ) : (
                                <Badge className="bg-rose-100 text-rose-800 border-rose-300 py-1.5 px-4 text-sm font-semibold flex items-center gap-1.5 self-start">
                                    <AlertTriangle className="w-4 h-4 text-rose-600" /> Imbalance Detected
                                </Badge>
                            )}
                        </div>

                        {/* Equation Summary Cards */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="bg-emerald-50 rounded-xl p-5 border border-emerald-200">
                                <div className="text-xs font-semibold uppercase text-emerald-700">Total Assets</div>
                                <div className="text-2xl font-bold text-emerald-950 mt-1 font-mono">
                                    LKR {(data?.totalAssets || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                </div>
                            </div>
                            <div className="bg-amber-50 rounded-xl p-5 border border-amber-200">
                                <div className="text-xs font-semibold uppercase text-amber-700">Total Liabilities</div>
                                <div className="text-2xl font-bold text-amber-950 mt-1 font-mono">
                                    LKR {(data?.totalLiabilities || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                </div>
                            </div>
                            <div className="bg-indigo-50 rounded-xl p-5 border border-indigo-200">
                                <div className="text-xs font-semibold uppercase text-indigo-700">Total Liabilities + Equity</div>
                                <div className="text-2xl font-bold text-indigo-950 mt-1 font-mono">
                                    LKR {(data?.totalLiabilitiesAndEquity || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                </div>
                            </div>
                        </div>

                        {/* Balance Sheet Layout */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            
                            {/* Assets Column */}
                            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                                <div className="bg-emerald-100/70 p-4 border-b border-emerald-200 flex justify-between items-center">
                                    <h2 className="font-bold text-emerald-900 uppercase text-xs tracking-wider">Assets</h2>
                                    <span className="font-mono font-bold text-emerald-950 text-sm">
                                        LKR {(data?.totalAssets || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                    </span>
                                </div>
                                <div className="divide-y divide-slate-100">
                                    {isLoading ? (
                                        <div className="p-6 text-center text-slate-500">Loading Asset accounts...</div>
                                    ) : (
                                        data?.assetAccounts.map(acc => (
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

                            {/* Liabilities & Equity Column */}
                            <div className="space-y-6">
                                {/* Liabilities */}
                                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                                    <div className="bg-amber-100/70 p-4 border-b border-amber-200 flex justify-between items-center">
                                        <h2 className="font-bold text-amber-900 uppercase text-xs tracking-wider">Liabilities</h2>
                                        <span className="font-mono font-bold text-amber-950 text-sm">
                                            LKR {(data?.totalLiabilities || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                        </span>
                                    </div>
                                    <div className="divide-y divide-slate-100">
                                        {isLoading ? (
                                            <div className="p-6 text-center text-slate-500">Loading Liabilities...</div>
                                        ) : (
                                            data?.liabilityAccounts.map(acc => (
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

                                {/* Equity */}
                                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                                    <div className="bg-indigo-100/70 p-4 border-b border-indigo-200 flex justify-between items-center">
                                        <h2 className="font-bold text-indigo-900 uppercase text-xs tracking-wider">Equity</h2>
                                        <span className="font-mono font-bold text-indigo-950 text-sm">
                                            LKR {(data?.totalEquity || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                        </span>
                                    </div>
                                    <div className="divide-y divide-slate-100">
                                        <div className="p-3.5 flex justify-between items-center bg-indigo-50/50">
                                            <div>
                                                <span className="font-mono font-bold text-indigo-900 text-xs mr-2">P&L-EARN</span>
                                                <span className="text-sm font-semibold text-indigo-900">Current Period Retained Earnings</span>
                                            </div>
                                            <span className="font-mono font-bold text-indigo-900 text-sm">
                                                LKR {(data?.retainedEarnings || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                            </span>
                                        </div>
                                        {data?.equityAccounts.map(acc => (
                                            <div key={acc.code} className="p-3.5 flex justify-between items-center hover:bg-slate-50">
                                                <div>
                                                    <span className="font-mono font-bold text-slate-900 text-xs mr-2">{acc.code}</span>
                                                    <span className="text-sm font-medium text-slate-800">{acc.name}</span>
                                                </div>
                                                <span className="font-mono font-semibold text-slate-900 text-sm">
                                                    LKR {acc.netBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                        </div>

                    </main>
                </div>
            </div>
        </RoleGuard>
    );
}

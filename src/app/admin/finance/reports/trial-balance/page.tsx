"use client";

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import RoleGuard from '@/components/RoleGuard';
import { ROLE_GROUPS } from '@/config/sidebar-menu';
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Scale, CheckCircle2, AlertTriangle, ArrowRight } from "lucide-react";
import Link from 'next/link';

interface AccountBalanceSummary {
    code: string;
    name: string;
    type: 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE';
    isPostable: boolean;
    totalDebit: number;
    totalCredit: number;
    netBalance: number;
}

interface TrialBalanceData {
    accounts: AccountBalanceSummary[];
    totalDebit: number;
    totalCredit: number;
    isBalanced: boolean;
    difference: number;
}

export default function TrialBalancePage() {
    const { data, isLoading } = useQuery<TrialBalanceData>({
        queryKey: ['trial-balance-report'],
        queryFn: async () => {
            const res = await fetch(`/api/finance/reports/trial-balance?_t=${Date.now()}`, { cache: 'no-store' });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error?.message || 'Failed to fetch Trial Balance');
            return json.data;
        }
    });

    const accounts = data?.accounts || [];
    const activeAccounts = accounts.filter(a => a.totalDebit > 0 || a.totalCredit > 0);

    return (
        <RoleGuard allowedRoles={ROLE_GROUPS.FINANCE}>
            <div className="flex h-screen bg-slate-50 overflow-hidden">
                <Sidebar />
                <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                    <Header />
                    <main className="flex-1 overflow-y-auto p-6 space-y-6">
                        
                        {/* Title & Status */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div>
                                <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
                                    <Scale className="w-7 h-7 text-indigo-600" />
                                    Trial Balance Statement
                                </h1>
                                <p className="text-sm text-slate-500 mt-1">
                                    Double-entry verification of total debits and credits across all General Ledger accounts.
                                </p>
                            </div>

                            {data?.isBalanced ? (
                                <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 py-1.5 px-4 text-sm font-semibold flex items-center gap-1.5 self-start">
                                    <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Balanced (DR === CR)
                                </Badge>
                            ) : (
                                <Badge className="bg-rose-100 text-rose-800 border-rose-300 py-1.5 px-4 text-sm font-semibold flex items-center gap-1.5 self-start">
                                    <AlertTriangle className="w-4 h-4 text-rose-600" /> Imbalance Detected
                                </Badge>
                            )}
                        </div>

                        {/* Summary Cards */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-200">
                                <div className="text-xs font-semibold uppercase text-slate-500">Total Debit Balance</div>
                                <div className="text-2xl font-bold text-slate-900 mt-1 font-mono">
                                    LKR {(data?.totalDebit || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                </div>
                            </div>
                            <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-200">
                                <div className="text-xs font-semibold uppercase text-slate-500">Total Credit Balance</div>
                                <div className="text-2xl font-bold text-slate-900 mt-1 font-mono">
                                    LKR {(data?.totalCredit || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                </div>
                            </div>
                            <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-200">
                                <div className="text-xs font-semibold uppercase text-slate-500">Variance / Difference</div>
                                <div className={`text-2xl font-bold mt-1 font-mono ${(data?.difference || 0) > 0.01 ? 'text-rose-600' : 'text-emerald-600'}`}>
                                    LKR {(data?.difference || 0).toFixed(2)}
                                </div>
                            </div>
                        </div>

                        {/* Trial Balance Table */}
                        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                            {isLoading ? (
                                <div className="p-8 text-center text-slate-500">Loading Trial Balance...</div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left text-sm border-collapse">
                                        <thead>
                                            <tr className="bg-slate-100/80 border-b border-slate-200 text-slate-700 font-semibold uppercase text-xs">
                                                <th className="py-3.5 px-4">Account Code</th>
                                                <th className="py-3.5 px-4">Account Name</th>
                                                <th className="py-3.5 px-4">Type</th>
                                                <th className="py-3.5 px-4 text-right">Debit (LKR)</th>
                                                <th className="py-3.5 px-4 text-right">Credit (LKR)</th>
                                                <th className="py-3.5 px-4 text-center">T-Account</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-200">
                                            {activeAccounts.map((acc) => (
                                                <tr key={acc.code} className="hover:bg-slate-50/80 transition-colors">
                                                    <td className="py-3.5 px-4 font-mono font-bold text-slate-900">{acc.code}</td>
                                                    <td className="py-3.5 px-4 font-medium text-slate-800">{acc.name}</td>
                                                    <td className="py-3.5 px-4">
                                                        <Badge variant="outline" className="text-xs">{acc.type}</Badge>
                                                    </td>
                                                    <td className="py-3.5 px-4 text-right font-mono font-medium text-slate-900">
                                                        {acc.totalDebit > 0 ? acc.totalDebit.toLocaleString('en-US', { minimumFractionDigits: 2 }) : '-'}
                                                    </td>
                                                    <td className="py-3.5 px-4 text-right font-mono font-medium text-slate-900">
                                                        {acc.totalCredit > 0 ? acc.totalCredit.toLocaleString('en-US', { minimumFractionDigits: 2 }) : '-'}
                                                    </td>
                                                    <td className="py-3.5 px-4 text-center">
                                                        <Link href={`/admin/finance/reports/gl-viewer?accountCode=${acc.code}`}>
                                                            <Button variant="ghost" size="sm" className="h-8 text-indigo-600 hover:text-indigo-800">
                                                                Drill-down <ArrowRight className="w-3.5 h-3.5 ml-1" />
                                                            </Button>
                                                        </Link>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                        <tfoot>
                                            <tr className="bg-slate-900 text-white font-bold font-mono text-sm">
                                                <td colSpan={3} className="py-4 px-4 uppercase tracking-wider">Total Footer Sum</td>
                                                <td className="py-4 px-4 text-right text-emerald-400">
                                                    LKR {(data?.totalDebit || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                                </td>
                                                <td className="py-4 px-4 text-right text-emerald-400">
                                                    LKR {(data?.totalCredit || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                                </td>
                                                <td></td>
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>
                            )}
                        </div>

                    </main>
                </div>
            </div>
        </RoleGuard>
    );
}

"use client";

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import RoleGuard from '@/components/RoleGuard';
import { ROLE_GROUPS } from '@/config/sidebar-menu';
import { Badge } from "@/components/ui/badge";
import { Landmark, ArrowUpRight, ArrowDownRight, History } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface CashBookRow {
    id: string;
    entryId: string;
    date: string;
    referenceType: string | null;
    referenceId: string | null;
    description: string;
    debit: number;
    credit: number;
    runningBalance: number;
}

interface CashBookData {
    glAccountCode: string;
    accountName: string;
    openingBalance: number;
    totalDebit: number;
    totalCredit: number;
    netMovement: number;
    closingBalance: number;
    rows: CashBookRow[];
}

export default function CashBookPage() {
    const [accountCode, setAccountCode] = useState<string>('BANK-1000');

    const { data, isLoading } = useQuery<CashBookData>({
        queryKey: ['cash-book-report', accountCode],
        queryFn: async () => {
            const res = await fetch(`/api/finance/bank/cash-book?accountCode=${accountCode}&_t=${Date.now()}`, { cache: 'no-store' });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error?.message || 'Failed to fetch Cash Book');
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
                        
                        {/* Title & Filter */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div>
                                <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
                                    <Landmark className="w-7 h-7 text-indigo-600" />
                                    Cash Book & Bank Ledger
                                </h1>
                                <p className="text-sm text-slate-500 mt-1">
                                    Itemized cash and bank journal entries with real-time running balance.
                                </p>
                            </div>

                            <Select value={accountCode} onValueChange={setAccountCode}>
                                <SelectTrigger className="w-64 bg-white border-slate-300">
                                    <SelectValue placeholder="Select Account" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="BANK-1000">BANK-1000 (Main Operating Bank)</SelectItem>
                                    <SelectItem value="PETTY-1020">PETTY-1020 (Petty Cash Account)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Summary Cards */}
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-200">
                                <div className="text-xs font-semibold uppercase text-slate-500">Opening Balance</div>
                                <div className="text-xl font-bold text-slate-900 mt-1 font-mono">
                                    LKR {(data?.openingBalance || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                </div>
                            </div>
                            <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-200">
                                <div className="text-xs font-semibold uppercase text-emerald-700">Total Deposits (Debits)</div>
                                <div className="text-xl font-bold text-emerald-900 mt-1 font-mono flex items-center gap-1">
                                    <ArrowUpRight className="w-5 h-5 text-emerald-600" />
                                    LKR {(data?.totalDebit || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                </div>
                            </div>
                            <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-200">
                                <div className="text-xs font-semibold uppercase text-rose-700">Total Withdrawals (Credits)</div>
                                <div className="text-xl font-bold text-rose-900 mt-1 font-mono flex items-center gap-1">
                                    <ArrowDownRight className="w-5 h-5 text-rose-600" />
                                    LKR {(data?.totalCredit || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                </div>
                            </div>
                            <div className="bg-indigo-900 text-white rounded-xl p-5 shadow-sm">
                                <div className="text-xs font-semibold uppercase text-indigo-300">Closing Ledger Balance</div>
                                <div className="text-xl font-bold text-indigo-100 mt-1 font-mono">
                                    LKR {(data?.closingBalance || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                </div>
                            </div>
                        </div>

                        {/* Cash Book Table */}
                        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                            {isLoading ? (
                                <div className="p-8 text-center text-slate-500">Loading Cash Book ledger...</div>
                            ) : (data?.rows.length || 0) === 0 ? (
                                <div className="p-8 text-center text-slate-500">No bank or cash entries recorded for account {accountCode}.</div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left text-sm border-collapse">
                                        <thead>
                                            <tr className="bg-slate-100/80 border-b border-slate-200 text-slate-700 font-semibold uppercase text-xs">
                                                <th className="py-3.5 px-4">Date</th>
                                                <th className="py-3.5 px-4">Ref Type / ID</th>
                                                <th className="py-3.5 px-4">Description</th>
                                                <th className="py-3.5 px-4 text-right">Deposit (DR)</th>
                                                <th className="py-3.5 px-4 text-right">Payment (CR)</th>
                                                <th className="py-3.5 px-4 text-right">Running Balance (LKR)</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-200">
                                            {data?.rows.map((row) => (
                                                <tr key={row.id} className="hover:bg-slate-50/80 transition-colors">
                                                    <td className="py-3.5 px-4 font-mono text-slate-600">
                                                        {new Date(row.date).toLocaleDateString()}
                                                    </td>
                                                    <td className="py-3.5 px-4 font-mono font-medium text-indigo-900">
                                                        {row.referenceType || 'GL'}: {row.referenceId || '-'}
                                                    </td>
                                                    <td className="py-3.5 px-4 font-medium text-slate-800">{row.description}</td>
                                                    <td className="py-3.5 px-4 text-right font-mono font-semibold text-emerald-700">
                                                        {row.debit > 0 ? `LKR ${row.debit.toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '-'}
                                                    </td>
                                                    <td className="py-3.5 px-4 text-right font-mono font-semibold text-rose-700">
                                                        {row.credit > 0 ? `LKR ${row.credit.toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '-'}
                                                    </td>
                                                    <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-900">
                                                        LKR {row.runningBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
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

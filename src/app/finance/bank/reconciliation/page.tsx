"use client";

import { useQuery } from '@tanstack/react-query';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import RoleGuard from '@/components/RoleGuard';
import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';
import { CheckCircle2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from 'react';

interface BankReconciliationSummary {
    bankAccountId: string;
    accountNumber: string;
    bankName: string;
    statementBalance: number;
    reconciledGlBalance: number;
    unreconciledStatementCount: number;
    unreconciledGlCount: number;
    variance: number;
    isReconciled: boolean;
}

export default function BankReconciliationPage() {
    const [bankAccountId, setBankAccountId] = useState('');
    const { data: accounts = [], isError: accountsError } = useQuery<Array<{ id: string; accountNumber: string; bankName: string }>>({
        queryKey: ['bank-accounts-for-reconciliation'],
        queryFn: async () => {
            const res = await fetch('/api/finance/bank/reconciliation', { cache: 'no-store' });
            if (!res.ok) throw new Error('Failed to load bank accounts');
            const json = await res.json();
            return json.data.accounts;
        },
    });
    const { data, refetch, isError, isLoading } = useQuery<BankReconciliationSummary>({
        queryKey: ['bank-reconciliation-summary', bankAccountId],
        enabled: Boolean(bankAccountId),
        queryFn: async () => {
            const res = await fetch(`/api/finance/bank/reconciliation?bankAccountId=${encodeURIComponent(bankAccountId)}`, { cache: 'no-store' });
            if (!res.ok) throw new Error('Failed to load bank reconciliation');
            const json = await res.json();
            return json.data;
        }
    });

    return (
        <RoleGuard allowedRoles={[]} permissionId={RBAC_PERMISSIONS.ADMIN_RBAC}>
            <div className="flex h-screen bg-slate-50 overflow-hidden">
                <Sidebar />
                <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                    <Header />
                    <main className="flex-1 overflow-y-auto p-6 space-y-6">
                        
                        {/* Header */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div>
                                <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
                                    <CheckCircle2 className="w-7 h-7 text-indigo-600" />
                                    Bank Statement Import & Reconciliation Engine
                                </h1>
                                <p className="text-sm text-slate-500 mt-1">
                                    Reconcile imported bank statement feeds against General Ledger bank entries.
                                </p>
                            </div>

                            <Button variant="outline" size="sm" onClick={() => refetch()} disabled={!bankAccountId} className="border-slate-300">
                                <RefreshCw className="w-4 h-4 mr-1.5" />
                                Refresh Status
                            </Button>
                        </div>

                        <div className="space-y-1">
                            <label htmlFor="reconciliation-bank-account" className="text-sm font-semibold text-slate-800">Bank account</label>
                            <select id="reconciliation-bank-account" value={bankAccountId} onChange={(event) => setBankAccountId(event.target.value)}
                                className="block w-full max-w-md rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-900">
                                <option value="">Select a bank account</option>
                                {accounts.map(account => <option key={account.id} value={account.id}>{account.bankName} · {account.accountNumber}</option>)}
                            </select>
                        </div>
                        {accountsError && <p role="alert" className="text-sm text-red-700">Bank accounts could not be loaded. Retry the page.</p>}
                        {bankAccountId && isLoading && <p className="text-sm text-slate-700">Loading reconciliation...</p>}
                        {isError && <p role="alert" className="text-sm text-red-700">Reconciliation could not be loaded. Select the account again or retry.</p>}

                        {/* Summary Cards */}
                        {data && !isError && <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-200">
                                <div className="text-xs font-semibold uppercase text-slate-500">Bank Statement Balance</div>
                                <div className="text-2xl font-bold text-slate-900 mt-1 font-mono">
                                    LKR {(data?.statementBalance || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                </div>
                            </div>
                            <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-200">
                                <div className="text-xs font-semibold uppercase text-slate-500">GL Bank Balance (BANK-1000)</div>
                                <div className="text-2xl font-bold text-slate-900 mt-1 font-mono">
                                    LKR {(data?.reconciledGlBalance || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                </div>
                            </div>
                            <div className={data?.isReconciled ? "bg-emerald-50 rounded-xl p-5 border border-emerald-200" : "bg-amber-50 rounded-xl p-5 border border-amber-200"}>
                                <div className="text-xs font-semibold uppercase text-slate-700">Reconciliation Variance</div>
                                <div className="text-2xl font-bold text-slate-950 mt-1 font-mono">
                                    LKR {(data?.variance || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                </div>
                            </div>
                        </div>}

                        {/* Reconciliation Status Panel */}
                        {data && !isError && <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200 flex flex-col items-center text-center space-y-3">
                            <div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600">
                                <CheckCircle2 className="w-6 h-6" />
                            </div>
                            <h2 className="text-lg font-bold text-slate-900">{data.isReconciled ? 'Balances and lines match' : data.variance > 0 ? 'Reconciliation variance remains' : 'Reconciliation not yet complete'}</h2>
                            <p className="text-sm text-slate-500 max-w-md">
                                {data.unreconciledStatementCount} statement line(s) remain unmatched. Review the variance and source transactions before closing the reconciliation.
                            </p>
                        </div>}

                    </main>
                </div>
            </div>
        </RoleGuard>
    );
}

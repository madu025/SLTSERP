"use client";

import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import RoleGuard from '@/components/RoleGuard';
import { ROLE_GROUPS } from '@/config/sidebar-menu';
import { Badge } from "@/components/ui/badge";
import { Users, Plus, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface PayrollExpenseRecord {
    id: string;
    period: string;
    opmcId: string | null;
    amount: number;
    referenceNumber: string | null;
    notes: string | null;
    status: string;
    createdAt: string;
}

interface PayrollData {
    totalAllocated: number;
    count: number;
    records: PayrollExpenseRecord[];
}

export default function PayrollExpensePage() {
    const queryClient = useQueryClient();
    const [period, setPeriod] = useState<string>('2026-01');
    const [amount, setAmount] = useState<string>('');
    const [notes, setNotes] = useState<string>('');
    const [isPosting, setIsPosting] = useState<boolean>(false);

    const { data, isLoading } = useQuery<PayrollData>({
        queryKey: ['payroll-expense-records'],
        queryFn: async () => {
            const res = await fetch(`/api/finance/payroll?_t=${Date.now()}`, { cache: 'no-store' });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error?.message || 'Failed to fetch Payroll Expenses');
            return json.data;
        }
    });

    const handleRecordAllocation = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!amount || Number(amount) <= 0) {
            toast.error('Please enter a valid allocation amount');
            return;
        }
        setIsPosting(true);
        try {
            const res = await fetch('/api/finance/payroll', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    period,
                    amount: Number(amount),
                    notes
                })
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error?.message || 'Failed to record allocation');
            toast.success(`Head Office Payroll allocation for period ${period} posted successfully!`);
            setAmount('');
            setNotes('');
            queryClient.invalidateQueries({ queryKey: ['payroll-expense-records'] });
        } catch (err: any) {
            toast.error(err.message || 'Failed to post payroll allocation');
        } finally {
            setIsPosting(false);
        }
    };

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
                                    <Users className="w-7 h-7 text-indigo-600" />
                                    Head Office Payroll Expense Allocation
                                </h1>
                                <p className="text-sm text-slate-500 mt-1">
                                    Record periodic staff cost allocations from Head Office and post to GL Staff Cost (EXP-STAFF-6020).
                                </p>
                            </div>

                            <Badge className="bg-indigo-100 text-indigo-800 border-indigo-300 py-1.5 px-4 text-sm font-semibold">
                                Scope: Expense Allocation Only
                            </Badge>
                        </div>

                        {/* Summary & Record Form */}
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            
                            {/* Record Form */}
                            <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-200 lg:col-span-1">
                                <h2 className="text-base font-bold text-slate-900 mb-4 flex items-center gap-2">
                                    <Plus className="w-5 h-5 text-indigo-600" />
                                    Record HO Payroll Allocation
                                </h2>
                                <form onSubmit={handleRecordAllocation} className="space-y-4">
                                    <div>
                                        <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">Target Period (YYYY-MM)</label>
                                        <input
                                            type="text"
                                            value={period}
                                            onChange={(e) => setPeriod(e.target.value)}
                                            placeholder="2026-01"
                                            className="w-full text-sm border border-slate-300 rounded-lg p-2.5 font-mono"
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">Allocated Staff Cost Amount (LKR)</label>
                                        <input
                                            type="number"
                                            value={amount}
                                            onChange={(e) => setAmount(e.target.value)}
                                            placeholder="850000"
                                            className="w-full text-sm border border-slate-300 rounded-lg p-2.5 font-mono"
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">Allocation Notes / Reference</label>
                                        <textarea
                                            value={notes}
                                            onChange={(e) => setNotes(e.target.value)}
                                            placeholder="Monthly staff cost allocation from Head Office..."
                                            className="w-full text-sm border border-slate-300 rounded-lg p-2.5 h-20"
                                        />
                                    </div>
                                    <Button type="submit" disabled={isPosting} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold">
                                        {isPosting ? 'Posting to GL...' : 'Post Allocation to GL'}
                                    </Button>
                                </form>
                            </div>

                            {/* Summary Cards + Table */}
                            <div className="lg:col-span-2 space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-200">
                                        <div className="text-xs font-semibold uppercase text-slate-500">Total Payroll Expense Allocated</div>
                                        <div className="text-2xl font-bold text-slate-900 mt-1 font-mono">
                                            LKR {(data?.totalAllocated || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                        </div>
                                    </div>
                                    <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-200">
                                        <div className="text-xs font-semibold uppercase text-slate-500">Recorded Allocations</div>
                                        <div className="text-2xl font-bold text-slate-900 mt-1 font-mono">
                                            {data?.count || 0} Periods
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                                    {isLoading ? (
                                        <div className="p-8 text-center text-slate-500">Loading Payroll allocations...</div>
                                    ) : (data?.records.length || 0) === 0 ? (
                                        <div className="p-8 text-center text-slate-500">No payroll expense allocations recorded.</div>
                                    ) : (
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-left text-sm border-collapse">
                                                <thead>
                                                    <tr className="bg-slate-100/80 border-b border-slate-200 text-slate-700 font-semibold uppercase text-xs">
                                                        <th className="py-3.5 px-4">Period</th>
                                                        <th className="py-3.5 px-4">Reference</th>
                                                        <th className="py-3.5 px-4">Notes</th>
                                                        <th className="py-3.5 px-4 text-right">Allocated Amount (LKR)</th>
                                                        <th className="py-3.5 px-4 text-center">GL Status</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-200">
                                                    {data?.records.map((rec) => (
                                                        <tr key={rec.id} className="hover:bg-slate-50/80 transition-colors">
                                                            <td className="py-3.5 px-4 font-mono font-bold text-indigo-900">{rec.period}</td>
                                                            <td className="py-3.5 px-4 font-mono text-slate-600">{rec.referenceNumber || '-'}</td>
                                                            <td className="py-3.5 px-4 text-slate-800">{rec.notes || 'HO Staff Cost Allocation'}</td>
                                                            <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-900">
                                                                LKR {rec.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                                            </td>
                                                            <td className="py-3.5 px-4 text-center">
                                                                <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300">POSTED</Badge>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
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

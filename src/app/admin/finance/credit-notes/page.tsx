"use client";

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import RoleGuard from '@/components/RoleGuard';
import { ROLE_GROUPS } from '@/config/sidebar-menu';
import { Badge } from "@/components/ui/badge";
import { FileText, ArrowRightLeft } from "lucide-react";

interface CreditDebitNote {
    id: string;
    noteNumber: string;
    type: string;
    invoiceId: string | null;
    amount: number;
    reason: string;
    status: string;
    createdAt: string;
}

export default function CreditNotesPage() {
    const { data: notes = [], isLoading } = useQuery<CreditDebitNote[]>({
        queryKey: ['credit-debit-notes'],
        queryFn: async () => {
            const res = await fetch(`/api/finance/credit-notes?_t=${Date.now()}`, { cache: 'no-store' });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error?.message || 'Failed to fetch Credit Notes');
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
                        
                        {/* Title */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div>
                                <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
                                    <ArrowRightLeft className="w-7 h-7 text-indigo-600" />
                                    Credit &amp; Debit Notes Register
                                </h1>
                                <p className="text-sm text-slate-500 mt-1">
                                    Adjustment notes posting reversing/adjusting GL journal entries against invoices.
                                </p>
                            </div>

                            <Badge className="bg-indigo-100 text-indigo-800 border-indigo-300 py-1.5 px-4 text-sm font-semibold">
                                Total Notes: {notes.length}
                            </Badge>
                        </div>

                        {/* Notes Register Table */}
                        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                            {isLoading ? (
                                <div className="p-8 text-center text-slate-500">Loading Credit/Debit Notes...</div>
                            ) : notes.length === 0 ? (
                                <div className="p-8 text-center text-slate-500">No Credit or Debit Notes issued.</div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left text-sm border-collapse">
                                        <thead>
                                            <tr className="bg-slate-100/80 border-b border-slate-200 text-slate-700 font-semibold uppercase text-xs">
                                                <th className="py-3.5 px-4">Note Number</th>
                                                <th className="py-3.5 px-4">Type</th>
                                                <th className="py-3.5 px-4">Invoice ID</th>
                                                <th className="py-3.5 px-4">Reason / Description</th>
                                                <th className="py-3.5 px-4 text-right">Adjustment Amount (LKR)</th>
                                                <th className="py-3.5 px-4 text-center">Status</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-200">
                                            {notes.map((n) => (
                                                <tr key={n.id} className="hover:bg-slate-50/80 transition-colors">
                                                    <td className="py-3.5 px-4 font-mono font-bold text-indigo-900">{n.noteNumber}</td>
                                                    <td className="py-3.5 px-4">
                                                        <Badge className={n.type === 'CREDIT_NOTE' ? 'bg-amber-100 text-amber-800 border-amber-300' : 'bg-blue-100 text-blue-800 border-blue-300'}>
                                                            {n.type}
                                                        </Badge>
                                                    </td>
                                                    <td className="py-3.5 px-4 font-mono text-slate-600">{n.invoiceId || '-'}</td>
                                                    <td className="py-3.5 px-4 text-slate-800">{n.reason}</td>
                                                    <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-900">
                                                        LKR {n.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
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

                    </main>
                </div>
            </div>
        </RoleGuard>
    );
}

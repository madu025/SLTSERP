"use client";

import React, { useState, Suspense } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import RoleGuard from '@/components/RoleGuard';
import { ROLE_GROUPS } from '@/config/sidebar-menu';
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Layers } from "lucide-react";
import Link from 'next/link';

interface DrilldownRow {
    id: string;
    entryId: string;
    date: string;
    referenceId: string | null;
    referenceType: string | null;
    description: string;
    debit: number;
    credit: number;
    runningBalance: number;
}

interface GlViewerData {
    account: {
        code: string;
        name: string;
        type: string;
    };
    totalRows: number;
    finalBalance: number;
    rows: DrilldownRow[];
}

function GlViewerPageInner() {
    const searchParams = useSearchParams();
    const accountCodeParam = searchParams.get('accountCode') || 'INV-1010';
    const [selectedCode, setSelectedCode] = useState(accountCodeParam);

    const { data, isLoading } = useQuery<GlViewerData>({
        queryKey: ['gl-drilldown', selectedCode],
        queryFn: async () => {
            const res = await fetch(`/api/finance/reports/gl-drilldown?accountCode=${selectedCode}&_t=${Date.now()}`, { cache: 'no-store' });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error?.message || 'Failed to fetch GL drill-down');
            return json.data;
        },
        enabled: !!selectedCode
    });

    return (
        <div className="space-y-6">
            {/* Top Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <Link href="/admin/finance/reports/trial-balance">
                        <Button variant="ghost" size="sm" className="mb-2 text-slate-500 hover:text-slate-900 pl-0">
                            <ArrowLeft className="w-4 h-4 mr-1" /> Back to Trial Balance
                        </Button>
                    </Link>
                    <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
                        <Layers className="w-7 h-7 text-indigo-600" />
                        GL T-Account Ledger Viewer
                    </h1>
                    <p className="text-sm text-slate-500 mt-1">
                        Chronological running balance ledger for target account.
                    </p>
                </div>

                {data?.account && (
                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
                        <div>
                            <div className="text-xs uppercase font-bold text-slate-400">Account Code & Name</div>
                            <div className="text-base font-bold text-slate-900">
                                {data.account.code} — {data.account.name}
                            </div>
                        </div>
                        <Badge variant="outline" className="font-mono">{data.account.type}</Badge>
                    </div>
                )}
            </div>

            {/* Account Selector Bar */}
            <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200 flex flex-col sm:flex-row items-center gap-4">
                <div className="flex-1 w-full flex items-center gap-2">
                    <label className="text-xs font-bold uppercase text-slate-500 whitespace-nowrap">Lookup Account Code:</label>
                    <Input
                        placeholder="Enter Account Code (e.g., INV-1010, AP-2010)"
                        value={selectedCode}
                        onChange={(e) => setSelectedCode(e.target.value.toUpperCase())}
                        className="font-mono uppercase bg-slate-50 border-slate-200"
                    />
                </div>
            </div>

            {/* Ledger T-Account Table */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                {isLoading ? (
                    <div className="p-8 text-center text-slate-500">Loading GL ledger lines...</div>
                ) : (data?.rows.length || 0) === 0 ? (
                    <div className="p-8 text-center text-slate-500">No transactions recorded for account {selectedCode}.</div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm border-collapse">
                            <thead>
                                <tr className="bg-slate-100/80 border-b border-slate-200 text-slate-700 font-semibold uppercase text-xs">
                                    <th className="py-3.5 px-4">Posting Date</th>
                                    <th className="py-3.5 px-4">Ref Type / ID</th>
                                    <th className="py-3.5 px-4">Description</th>
                                    <th className="py-3.5 px-4 text-right">Debit (DR)</th>
                                    <th className="py-3.5 px-4 text-right">Credit (CR)</th>
                                    <th className="py-3.5 px-4 text-right">Running Net Balance</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200">
                                {data?.rows.map((row) => (
                                    <tr key={row.id} className="hover:bg-slate-50/80 transition-colors">
                                        <td className="py-3.5 px-4 font-mono text-slate-600">
                                            {new Date(row.date).toLocaleDateString()}
                                        </td>
                                        <td className="py-3.5 px-4 font-mono font-medium text-indigo-900">
                                            {row.referenceType || 'JOURNAL'}: {row.referenceId || '-'}
                                        </td>
                                        <td className="py-3.5 px-4 font-medium text-slate-800">{row.description}</td>
                                        <td className="py-3.5 px-4 text-right font-mono font-semibold text-emerald-700">
                                            {row.debit > 0 ? `LKR ${row.debit.toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '-'}
                                        </td>
                                        <td className="py-3.5 px-4 text-right font-mono font-semibold text-rose-700">
                                            {row.credit > 0 ? `LKR ${row.credit.toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '-'}
                                        </td>
                                        <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-900 bg-slate-50/60">
                                            LKR {row.runningBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot>
                                <tr className="bg-slate-900 text-white font-bold font-mono text-sm">
                                    <td colSpan={5} className="py-4 px-4 uppercase tracking-wider">Closing Account Balance</td>
                                    <td className="py-4 px-4 text-right text-emerald-400">
                                        LKR {(data?.finalBalance || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                    </td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}

export default function GlViewerPage() {
    return (
        <RoleGuard allowedRoles={ROLE_GROUPS.FINANCE}>
            <div className="flex h-screen bg-slate-50 overflow-hidden">
                <Sidebar />
                <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                    <Header />
                    <main className="flex-1 overflow-y-auto p-6 space-y-6">
                        <Suspense fallback={<div className="p-8 text-center text-slate-500">Loading GL Viewer...</div>}>
                            <GlViewerPageInner />
                        </Suspense>
                    </main>
                </div>
            </div>
        </RoleGuard>
    );
}

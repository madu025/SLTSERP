"use client";

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import RoleGuard from '@/components/RoleGuard';
import { ROLE_GROUPS } from '@/config/sidebar-menu';
import { Badge } from "@/components/ui/badge";
import { Building2, AlertCircle } from "lucide-react";

interface AgingSummary {
    current: number;
    days31to60: number;
    days61to90: number;
    over90: number;
    total: number;
}

interface ApAgingVendorRow {
    vendorId: string;
    vendorName: string;
    current: number;
    days31to60: number;
    days61to90: number;
    over90: number;
    totalBalance: number;
}

interface ApAgingData {
    summary: AgingSummary;
    glControlBalance: number;
    isReconciled: boolean;
    vendors: ApAgingVendorRow[];
}

export default function ApAgingPage() {
    const { data, isLoading } = useQuery<ApAgingData>({
        queryKey: ['ap-aging-report'],
        queryFn: async () => {
            const res = await fetch(`/api/finance/ap/aging?_t=${Date.now()}`, { cache: 'no-store' });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error?.message || 'Failed to fetch AP Aging');
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
                                    <Building2 className="w-7 h-7 text-indigo-600" />
                                    Accounts Payable (AP) Aging & Vendor Payables
                                </h1>
                                <p className="text-sm text-slate-500 mt-1">
                                    Contractor & Vendor liabilities sub-ledger aging analysis (0-30, 31-60, 61-90, 90+ days).
                                </p>
                            </div>

                            <Badge className={data?.isReconciled ? "bg-emerald-100 text-emerald-800 border-emerald-300 py-1.5 px-4 text-sm font-semibold" : "bg-amber-100 text-amber-800 border-amber-300 py-1.5 px-4 text-sm font-semibold"}>
                                {data?.isReconciled ? "✓ Reconciled with GL Control AP-2010" : "⚠️ Variance against GL Control AP-2010"}
                            </Badge>
                        </div>

                        {/* Aging Summary Bucket Cards */}
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                            <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
                                <div className="text-xs font-semibold uppercase text-emerald-700">0 - 30 Days</div>
                                <div className="text-lg font-bold text-slate-900 mt-1 font-mono">
                                    LKR {(data?.summary.current || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                </div>
                            </div>
                            <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
                                <div className="text-xs font-semibold uppercase text-blue-700">31 - 60 Days</div>
                                <div className="text-lg font-bold text-slate-900 mt-1 font-mono">
                                    LKR {(data?.summary.days31to60 || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                </div>
                            </div>
                            <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
                                <div className="text-xs font-semibold uppercase text-amber-700">61 - 90 Days</div>
                                <div className="text-lg font-bold text-slate-900 mt-1 font-mono">
                                    LKR {(data?.summary.days61to90 || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                </div>
                            </div>
                            <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
                                <div className="text-xs font-semibold uppercase text-rose-700">Over 90 Days</div>
                                <div className="text-lg font-bold text-slate-900 mt-1 font-mono">
                                    LKR {(data?.summary.over90 || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                </div>
                            </div>
                            <div className="bg-slate-900 rounded-xl p-4 shadow-sm text-white col-span-2 md:col-span-1">
                                <div className="text-xs font-semibold uppercase text-slate-400">Total Payable Balance</div>
                                <div className="text-lg font-bold text-indigo-400 mt-1 font-mono">
                                    LKR {(data?.summary.total || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                </div>
                            </div>
                        </div>

                        {/* Vendor Aging Table */}
                        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                            {isLoading ? (
                                <div className="p-8 text-center text-slate-500">Loading AP Aging report...</div>
                            ) : (data?.vendors.length || 0) === 0 ? (
                                <div className="p-8 text-center text-slate-500">No outstanding contractor / vendor liabilities recorded.</div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left text-sm border-collapse">
                                        <thead>
                                            <tr className="bg-slate-100/80 border-b border-slate-200 text-slate-700 font-semibold uppercase text-xs">
                                                <th className="py-3.5 px-4">Contractor / Vendor</th>
                                                <th className="py-3.5 px-4 text-right">0 - 30 Days</th>
                                                <th className="py-3.5 px-4 text-right">31 - 60 Days</th>
                                                <th className="py-3.5 px-4 text-right">61 - 90 Days</th>
                                                <th className="py-3.5 px-4 text-right">90+ Days</th>
                                                <th className="py-3.5 px-4 text-right">Total Payable (LKR)</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-200">
                                            {data?.vendors.map((vendor) => (
                                                <tr key={vendor.vendorId} className="hover:bg-slate-50/80 transition-colors">
                                                    <td className="py-3.5 px-4 font-medium text-slate-900">{vendor.vendorName}</td>
                                                    <td className="py-3.5 px-4 text-right font-mono text-emerald-700">
                                                        LKR {vendor.current.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                                    </td>
                                                    <td className="py-3.5 px-4 text-right font-mono text-blue-700">
                                                        LKR {vendor.days31to60.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                                    </td>
                                                    <td className="py-3.5 px-4 text-right font-mono text-amber-700">
                                                        LKR {vendor.days61to90.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                                    </td>
                                                    <td className="py-3.5 px-4 text-right font-mono font-bold text-rose-700">
                                                        LKR {vendor.over90.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                                    </td>
                                                    <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-900">
                                                        LKR {vendor.totalBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
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

"use client";

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import RoleGuard from '@/components/RoleGuard';
import { ROLE_GROUPS } from '@/config/sidebar-menu';
import { Badge } from "@/components/ui/badge";
import { Receipt, CheckCircle2, DollarSign } from "lucide-react";

interface VatReturnItem {
    id: string;
    date: string;
    referenceType: string | null;
    referenceId: string | null;
    description: string;
    outputVat: number;
    inputVat: number;
}

interface VatReturnData {
    outputVatTotal: number;
    inputVatTotal: number;
    netVatPayable: number;
    lineItems: VatReturnItem[];
}

export default function VatReturnPage() {
    const { data, isLoading } = useQuery<VatReturnData>({
        queryKey: ['vat-return-report'],
        queryFn: async () => {
            const res = await fetch(`/api/finance/tax/vat-return?_t=${Date.now()}`, { cache: 'no-store' });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error?.message || 'Failed to fetch VAT Return');
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
                                    <Receipt className="w-7 h-7 text-indigo-600" />
                                    Statutory VAT Return & Tax Register (18% VAT)
                                </h1>
                                <p className="text-sm text-slate-500 mt-1">
                                    Sri Lankan Inland Revenue Department VAT return summary: Output VAT vs Input VAT.
                                </p>
                            </div>

                            <Badge className="bg-indigo-100 text-indigo-800 border-indigo-300 py-1.5 px-4 text-sm font-semibold flex items-center gap-1.5 self-start">
                                Standard Rate: 18.0%
                            </Badge>
                        </div>

                        {/* Summary KPI Cards */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-200">
                                <div className="text-xs font-semibold uppercase text-slate-500">Output VAT Collected (Sales)</div>
                                <div className="text-2xl font-bold text-slate-900 mt-1 font-mono">
                                    LKR {(data?.outputVatTotal || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                </div>
                            </div>
                            <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-200">
                                <div className="text-xs font-semibold uppercase text-slate-500">Input VAT Claimable (Purchases)</div>
                                <div className="text-2xl font-bold text-slate-900 mt-1 font-mono">
                                    LKR {(data?.inputVatTotal || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                </div>
                            </div>
                            <div className="bg-indigo-50 rounded-xl p-5 border border-indigo-200">
                                <div className="text-xs font-semibold uppercase text-indigo-700">Net VAT Payable / (Refundable)</div>
                                <div className="text-2xl font-bold text-indigo-950 mt-1 font-mono">
                                    LKR {(data?.netVatPayable || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                </div>
                            </div>
                        </div>

                        {/* VAT Line Items Table */}
                        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                            {isLoading ? (
                                <div className="p-8 text-center text-slate-500">Loading VAT Register line items...</div>
                            ) : (data?.lineItems.length || 0) === 0 ? (
                                <div className="p-8 text-center text-slate-500">No VAT transactions recorded for period.</div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left text-sm border-collapse">
                                        <thead>
                                            <tr className="bg-slate-100/80 border-b border-slate-200 text-slate-700 font-semibold uppercase text-xs">
                                                <th className="py-3.5 px-4">Posting Date</th>
                                                <th className="py-3.5 px-4">Ref Type / ID</th>
                                                <th className="py-3.5 px-4">Description</th>
                                                <th className="py-3.5 px-4 text-right">Output VAT (LKR)</th>
                                                <th className="py-3.5 px-4 text-right">Input VAT (LKR)</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-200">
                                            {data?.lineItems.map((item) => (
                                                <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                                                    <td className="py-3.5 px-4 font-mono text-slate-600">
                                                        {new Date(item.date).toLocaleDateString()}
                                                    </td>
                                                    <td className="py-3.5 px-4 font-mono font-medium text-indigo-900">
                                                        {item.referenceType || 'TAX'}: {item.referenceId || '-'}
                                                    </td>
                                                    <td className="py-3.5 px-4 font-medium text-slate-800">{item.description}</td>
                                                    <td className="py-3.5 px-4 text-right font-mono font-semibold text-emerald-700">
                                                        {item.outputVat > 0 ? `LKR ${item.outputVat.toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '-'}
                                                    </td>
                                                    <td className="py-3.5 px-4 text-right font-mono font-semibold text-indigo-700">
                                                        {item.inputVat > 0 ? `LKR ${item.inputVat.toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '-'}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                        <tfoot>
                                            <tr className="bg-slate-900 text-white font-bold font-mono text-sm">
                                                <td colSpan={3} className="py-4 px-4 uppercase tracking-wider">Total Tax Period Balances</td>
                                                <td className="py-4 px-4 text-right text-emerald-400">
                                                    LKR {(data?.outputVatTotal || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                                </td>
                                                <td className="py-4 px-4 text-right text-indigo-400">
                                                    LKR {(data?.inputVatTotal || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                                </td>
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

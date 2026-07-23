"use client";

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import RoleGuard from '@/components/RoleGuard';
import { ROLE_GROUPS } from '@/config/sidebar-menu';
import { Badge } from "@/components/ui/badge";
import { FileCheck2, Download } from "lucide-react";
import { Button } from "@/components/ui/button";

interface WhtCertificateItem {
    id: string;
    date: string;
    referenceType: string | null;
    referenceId: string | null;
    vendorOrCustomer: string;
    grossAmount: number;
    whtRatePct: number;
    whtAmount: number;
}

interface WhtRegisterData {
    totalWithheld: number;
    certificates: WhtCertificateItem[];
}

export default function WhtRegisterPage() {
    const { data, isLoading } = useQuery<WhtRegisterData>({
        queryKey: ['wht-register-report'],
        queryFn: async () => {
            const res = await fetch(`/api/finance/tax/wht-register?_t=${Date.now()}`, { cache: 'no-store' });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error?.message || 'Failed to fetch WHT Register');
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
                                    <FileCheck2 className="w-7 h-7 text-indigo-600" />
                                    Withholding Tax (WHT) Certificates & Register
                                </h1>
                                <p className="text-sm text-slate-500 mt-1">
                                    Statutory 5% WHT deductions across Payment Vouchers and Vendor Services.
                                </p>
                            </div>

                            <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 py-1.5 px-4 text-sm font-semibold flex items-center gap-1.5 self-start">
                                Standard WHT: 5.0%
                            </Badge>
                        </div>

                        {/* Summary KPI */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-200">
                                <div className="text-xs font-semibold uppercase text-slate-500">Total Certificates Issued</div>
                                <div className="text-2xl font-bold text-slate-900 mt-1 font-mono">
                                    {data?.certificates.length || 0}
                                </div>
                            </div>
                            <div className="bg-indigo-50 rounded-xl p-5 border border-indigo-200">
                                <div className="text-xs font-semibold uppercase text-indigo-700">Total WHT Tax Withheld</div>
                                <div className="text-2xl font-bold text-indigo-950 mt-1 font-mono">
                                    LKR {(data?.totalWithheld || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                </div>
                            </div>
                        </div>

                        {/* Certificate Register Table */}
                        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                            {isLoading ? (
                                <div className="p-8 text-center text-slate-500">Loading WHT certificates...</div>
                            ) : (data?.certificates.length || 0) === 0 ? (
                                <div className="p-8 text-center text-slate-500">No WHT certificates generated for period.</div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left text-sm border-collapse">
                                        <thead>
                                            <tr className="bg-slate-100/80 border-b border-slate-200 text-slate-700 font-semibold uppercase text-xs">
                                                <th className="py-3.5 px-4">Certificate Date</th>
                                                <th className="py-3.5 px-4">Ref Type / ID</th>
                                                <th className="py-3.5 px-4">Vendor / Party</th>
                                                <th className="py-3.5 px-4 text-right">Gross Amount (LKR)</th>
                                                <th className="py-3.5 px-4 text-center">WHT Rate</th>
                                                <th className="py-3.5 px-4 text-right">Withheld Amount (LKR)</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-200">
                                            {data?.certificates.map((cert) => (
                                                <tr key={cert.id} className="hover:bg-slate-50/80 transition-colors">
                                                    <td className="py-3.5 px-4 font-mono text-slate-600">
                                                        {new Date(cert.date).toLocaleDateString()}
                                                    </td>
                                                    <td className="py-3.5 px-4 font-mono font-medium text-indigo-900">
                                                        {cert.referenceType || 'PV'}: {cert.referenceId || '-'}
                                                    </td>
                                                    <td className="py-3.5 px-4 font-medium text-slate-800">{cert.vendorOrCustomer}</td>
                                                    <td className="py-3.5 px-4 text-right font-mono font-medium text-slate-900">
                                                        LKR {cert.grossAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                                    </td>
                                                    <td className="py-3.5 px-4 text-center">
                                                        <Badge variant="outline" className="font-mono text-xs">{cert.whtRatePct}%</Badge>
                                                    </td>
                                                    <td className="py-3.5 px-4 text-right font-mono font-bold text-indigo-700">
                                                        LKR {cert.whtAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                        <tfoot>
                                            <tr className="bg-slate-900 text-white font-bold font-mono text-sm">
                                                <td colSpan={5} className="py-4 px-4 uppercase tracking-wider">Total WHT Tax Withheld</td>
                                                <td className="py-4 px-4 text-right text-emerald-400">
                                                    LKR {(data?.totalWithheld || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
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

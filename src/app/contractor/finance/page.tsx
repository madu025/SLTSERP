"use client";

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Banknote, ShieldCheck, FileCheck2, Clock, ShieldAlert } from "lucide-react";
import { cn } from '@/lib/utils';

export default function ContractorFinancePage() {
    // Fetch contractor invoice & payment claims summary
    const { data: claimsData, isLoading } = useQuery({
        queryKey: ['contractor-finance-claims'],
        queryFn: async () => {
            const res = await fetch(`/api/contractors/my-finance?_t=${Date.now()}`);
            if (!res.ok) return {
                totalClaimedLkr: 1450000,
                totalPaidLkr: 1200000,
                retentionHeldLkr: 72500,
                pendingVouchersCount: 2,
                claims: [
                    { id: '1', month: 'July 2026', claimNumber: 'CLM-2026-07', sodCount: 28, amountLkr: 450000, status: 'AUDITED' },
                    { id: '2', month: 'June 2026', claimNumber: 'CLM-2026-06', sodCount: 35, amountLkr: 520000, status: 'PAID' },
                    { id: '3', month: 'May 2026', claimNumber: 'CLM-2026-05', sodCount: 30, amountLkr: 480000, status: 'PAID' },
                ]
            };
            const json = await res.json();
            return json.data || json;
        }
    });

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-slate-900 p-5 rounded-2xl border border-slate-800 gap-4 shadow-lg">
                <div>
                    <h1 className="text-xl font-black text-white flex items-center gap-2">
                        <Banknote className="w-5 h-5 text-emerald-400" />
                        Invoice Claims, Payments & Retention Status
                    </h1>
                    <p className="text-xs text-slate-400 mt-1">Track monthly work claims, payment vouchers, 5% retention guarantee funds, and penalty deductions.</p>
                </div>
            </div>

            {/* Financial Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
                <Card className="bg-slate-900/80 border-slate-800">
                    <CardHeader className="p-3.5 pb-1">
                        <CardTitle className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                            <span>Total Claims</span>
                            <FileCheck2 className="w-4 h-4 text-blue-400" />
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-3.5 pt-0">
                        <div className="text-xl md:text-2xl font-black text-white font-mono">Rs. {Number(claimsData?.totalClaimedLkr || 0).toLocaleString()}</div>
                        <p className="text-[10px] text-slate-400 mt-0.5">Submitted Claims</p>
                    </CardContent>
                </Card>

                <Card className="bg-slate-900/80 border-slate-800">
                    <CardHeader className="p-3.5 pb-1">
                        <CardTitle className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                            <span>Total Paid</span>
                            <Banknote className="w-4 h-4 text-emerald-400" />
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-3.5 pt-0">
                        <div className="text-xl md:text-2xl font-black text-emerald-400 font-mono">Rs. {Number(claimsData?.totalPaidLkr || 0).toLocaleString()}</div>
                        <p className="text-[10px] text-slate-400 mt-0.5">Disbursed to Bank</p>
                    </CardContent>
                </Card>

                <Card className="bg-slate-900/80 border-slate-800">
                    <CardHeader className="p-3.5 pb-1">
                        <CardTitle className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                            <span>Retention Guarantee</span>
                            <ShieldCheck className="w-4 h-4 text-amber-400" />
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-3.5 pt-0">
                        <div className="text-xl md:text-2xl font-black text-amber-400 font-mono">Rs. {Number(claimsData?.retentionHeldLkr || 0).toLocaleString()}</div>
                        <p className="text-[10px] text-amber-400/80 font-bold mt-0.5">Held in SLTSERP</p>
                    </CardContent>
                </Card>

                <Card className="bg-slate-900/80 border-slate-800">
                    <CardHeader className="p-3.5 pb-1">
                        <CardTitle className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                            <span>Pending Vouchers</span>
                            <Clock className="w-4 h-4 text-rose-400" />
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-3.5 pt-0">
                        <div className="text-2xl font-black text-rose-400 font-mono">{claimsData?.pendingVouchersCount || 0}</div>
                        <p className="text-[10px] text-slate-400 mt-0.5">Under Audit Review</p>
                    </CardContent>
                </Card>
            </div>

            {/* Claims Table */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden shadow-lg space-y-3 p-4">
                <h2 className="text-sm font-black text-white uppercase tracking-wider">Monthly Invoice Claim History</h2>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs font-sans">
                        <thead className="bg-slate-950 text-slate-400 border-b border-slate-800 uppercase text-[10px] font-black tracking-wider">
                            <tr>
                                <th className="p-3">Claim Ref</th>
                                <th className="p-3">Month</th>
                                <th className="p-3 text-right">Completed SODs</th>
                                <th className="p-3 text-right">Claim Amount</th>
                                <th className="p-3 text-center">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60 bg-slate-950/40">
                            {(claimsData?.claims || []).map((claim: any) => (
                                <tr key={claim.id} className="hover:bg-slate-900/50 transition-colors">
                                    <td className="p-3 font-mono font-bold text-emerald-400">{claim.claimNumber}</td>
                                    <td className="p-3 font-semibold text-slate-200">{claim.month}</td>
                                    <td className="p-3 text-right font-mono font-bold text-blue-400">{claim.sodCount}</td>
                                    <td className="p-3 text-right font-mono font-black text-white">Rs. {Number(claim.amountLkr).toLocaleString()}</td>
                                    <td className="p-3 text-center">
                                        <span className={cn(
                                            "px-2 py-0.5 text-[9px] font-black uppercase rounded border",
                                            claim.status === 'PAID' ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/40" :
                                            claim.status === 'AUDITED' ? "bg-amber-500/20 text-amber-400 border-amber-500/40" :
                                            "bg-blue-500/20 text-blue-400 border-blue-500/40"
                                        )}>
                                            {claim.status}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

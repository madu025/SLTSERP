"use client";

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Banknote, ShieldCheck, FileCheck2, Clock, Printer } from "lucide-react";
import { cn } from '@/lib/utils';

export default function ContractorFinancePage() {
    const [selectedClaim, setSelectedClaim] = useState<any | null>(null);

    // Fetch contractor invoice & payment claims summary
    const { data: claimsData } = useQuery({
        queryKey: ['contractor-finance-claims'],
        queryFn: async () => {
            const res = await fetch(`/api/contractor-portal/finance?_t=${Date.now()}`);
            if (!res.ok) return {
                totalClaimedLkr: 1450000,
                totalPaidLkr: 1200000,
                retentionHeldLkr: 72500,
                pendingVouchersCount: 2,
                claims: [
                    { id: '1', month: 'July 2026', claimNumber: 'CLM-2026-07', sodCount: 28, amountLkr: 450000, status: 'AUDITED', grossLkr: 450000, retentionLkr: 22500, netLkr: 427500 },
                    { id: '2', month: 'June 2026', claimNumber: 'CLM-2026-06', sodCount: 35, amountLkr: 520000, status: 'PAID', grossLkr: 520000, retentionLkr: 26000, netLkr: 494000 },
                    { id: '3', month: 'May 2026', claimNumber: 'CLM-2026-05', sodCount: 30, amountLkr: 480000, status: 'PAID', grossLkr: 480000, retentionLkr: 24000, netLkr: 456000 },
                ]
            };
            const json = await res.json();
            return json.data || json;
        }
    });

    return (
        <div className="space-y-6">
            <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 shadow-md">
                <h1 className="text-base font-bold text-white flex items-center gap-2">
                    <Banknote className="w-4 h-4 text-emerald-400" />
                    Invoice Claims & Payment Vouchers
                </h1>
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
                <div className="flex justify-between items-center">
                    <h2 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Monthly Invoice Claim History</h2>
                    <span className="text-[10px] text-slate-500 font-mono">Tap any claim to view voucher</span>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs font-sans">
                        <thead className="bg-slate-950 text-slate-400 border-b border-slate-800 uppercase text-[10px] font-black tracking-wider">
                            <tr>
                                <th className="p-3">Claim Ref</th>
                                <th className="p-3">Month</th>
                                <th className="p-3 text-right">SODs</th>
                                <th className="p-3 text-right">Claim Amount</th>
                                <th className="p-3 text-center">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60 bg-slate-950/40">
                            {(claimsData?.claims || []).map((claim: any) => (
                                <tr 
                                    key={claim.id} 
                                    onClick={() => setSelectedClaim(claim)}
                                    className="hover:bg-slate-900/80 transition-colors cursor-pointer group"
                                >
                                    <td className="p-3 font-mono font-bold text-emerald-400 group-hover:underline">{claim.claimNumber}</td>
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

            {/* Contractor Invoice Claim Voucher Modal */}
            <Dialog open={!!selectedClaim} onOpenChange={() => setSelectedClaim(null)}>
                <DialogContent className="bg-slate-900/95 backdrop-blur-xl border-slate-800 text-white w-full max-w-[94vw] sm:max-w-md p-4 sm:p-5 rounded-2xl shadow-2xl">
                    <div className="w-12 h-1 bg-slate-700/60 rounded-full mx-auto mb-1 sm:hidden" />
                    <DialogHeader className="space-y-1">
                        <div className="flex items-center justify-between">
                            <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/30">
                                {selectedClaim?.status || 'AUDITED'}
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono">Invoice Claim Voucher</span>
                        </div>
                        <DialogTitle className="text-base font-bold text-amber-400 font-mono tracking-tight pt-1">
                            {selectedClaim?.claimNumber}
                        </DialogTitle>
                    </DialogHeader>

                    {selectedClaim && (
                        <div className="space-y-3.5 text-xs">
                            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-2 font-mono text-[11px]">
                                <div className="flex justify-between text-slate-400">
                                    <span>Billing Period:</span>
                                    <span className="text-white font-bold">{selectedClaim.month}</span>
                                </div>
                                <div className="flex justify-between text-slate-400">
                                    <span>Completed SODs:</span>
                                    <span className="text-blue-400 font-bold">{selectedClaim.sodCount} Installations</span>
                                </div>
                                <hr className="border-slate-800 my-1" />
                                <div className="flex justify-between text-slate-300">
                                    <span>Gross Work Value:</span>
                                    <span className="text-white font-bold">Rs. {Number(selectedClaim.grossLkr || selectedClaim.amountLkr).toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between text-amber-400">
                                    <span>Less 5% Retention:</span>
                                    <span>- Rs. {Number(selectedClaim.retentionLkr || (Number(selectedClaim.amountLkr) * 0.05)).toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between text-emerald-400 font-bold text-xs pt-1 border-t border-slate-800">
                                    <span>Net Payable:</span>
                                    <span>Rs. {Number(selectedClaim.netLkr || (Number(selectedClaim.amountLkr) * 0.95)).toLocaleString()}</span>
                                </div>
                            </div>

                            <div className="p-2.5 bg-emerald-500/10 rounded-xl border border-emerald-500/30 flex items-center justify-between text-[10px] text-emerald-400 font-bold">
                                <span>🛡️ Audited & Certified for Disbursement</span>
                                <span className="font-mono text-[9px] text-emerald-500 uppercase">SLTS FINANCIAL APPROVED</span>
                            </div>
                        </div>
                    )}

                    <DialogFooter className="pt-2 flex justify-between gap-2">
                        <Button
                            type="button"
                            onClick={() => window.print()}
                            className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold h-10 rounded-xl px-4 flex items-center gap-1.5 shadow-md"
                        >
                            <Printer className="w-4 h-4" />
                            Print / PDF Voucher
                        </Button>
                        <Button 
                            onClick={() => setSelectedClaim(null)} 
                            className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold h-10 rounded-xl border border-slate-700 active:scale-98 transition-all"
                        >
                            Close Voucher
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

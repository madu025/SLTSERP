"use client";

import {  useState  } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Banknote, ShieldCheck, FileCheck2, Clock, Printer, CheckCircle2, AlertTriangle, TrendingUp } from "lucide-react";
import { cn } from '@/lib/utils';

interface ContractorClaim {
    id: string;
    month: string;
    claimNumber: string;
    sodCount: number;
    amountLkr: number;
    status: string;
    grossLkr?: number;
    retentionLkr?: number;
    netLkr?: number;
}

interface FinanceData {
    totalClaimedLkr: number;
    totalPaidLkr: number;
    retentionHeldLkr: number;
    pendingVouchersCount: number;
    claims: ContractorClaim[];
}

// Skeleton loader for KPI cards
function KpiSkeleton() {
    return (
        <Card className="bg-slate-900/80 border-slate-800">
            <CardHeader className="p-3.5 pb-1">
                <div className="h-3 w-20 bg-slate-800 rounded animate-pulse" />
            </CardHeader>
            <CardContent className="p-3.5 pt-1">
                <div className="h-7 w-28 bg-slate-800 rounded animate-pulse mb-1" />
                <div className="h-2.5 w-16 bg-slate-800/60 rounded animate-pulse" />
            </CardContent>
        </Card>
    );
}

// Status badge for claim row
function StatusBadge({ status }: { status: string }) {
    if (status === 'PAID') return (
        <span className="px-2 py-0.5 text-[9px] font-black uppercase rounded border bg-emerald-500/20 text-emerald-400 border-emerald-500/40 flex items-center gap-1 w-fit mx-auto">
            <CheckCircle2 className="w-2.5 h-2.5" /> PAID
        </span>
    );
    if (status === 'AUDITED') return (
        <span className="px-2 py-0.5 text-[9px] font-black uppercase rounded border bg-amber-500/20 text-amber-400 border-amber-500/40 flex items-center gap-1 w-fit mx-auto">
            <Clock className="w-2.5 h-2.5" /> AUDITED
        </span>
    );
    return (
        <span className="px-2 py-0.5 text-[9px] font-black uppercase rounded border bg-slate-500/20 text-slate-400 border-slate-500/40 flex items-center gap-1 w-fit mx-auto">
            <AlertTriangle className="w-2.5 h-2.5" /> {status}
        </span>
    );
}

export default function ContractorFinancePage() {
    const [selectedClaim, setSelectedClaim] = useState<ContractorClaim | null>(null);

    const getAuthHeaders = () => {
        const contractorUser = typeof window !== 'undefined' ? (localStorage.getItem('contractor_user') || localStorage.getItem('user')) : null;
        const contractorToken = typeof window !== 'undefined' ? (localStorage.getItem('contractor_token') || localStorage.getItem('token')) : null;
        const selectedContractorId = typeof window !== 'undefined' ? localStorage.getItem('selected_contractor_id') : null;

        const headers: Record<string, string> = {
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
        };
        if (contractorToken) {
            headers['Authorization'] = `Bearer ${contractorToken}`;
        }
        if (contractorUser) {
            try {
                const u = JSON.parse(contractorUser);
                if (u.id) headers['x-user-id'] = u.id;
                if (u.role) headers['x-user-role'] = u.role;
                if (u.contractorId) headers['x-contractor-id'] = u.contractorId;
            } catch {}
        }
        if (selectedContractorId) {
            headers['x-contractor-id'] = selectedContractorId;
        }
        return headers;
    };

    // Fetch contractor invoice & payment claims summary
    const { data: claimsData, isLoading, isError } = useQuery<FinanceData>({
        queryKey: ['contractor-finance-claims'],
        queryFn: async () => {
            const res = await fetch(`/api/contractor-portal/finance?_t=${Date.now()}`, {
                headers: getAuthHeaders()
            });
            if (!res.ok) throw new Error('Failed to load finance data');
            const json = await res.json();
            return json.data || json;
        },
        refetchInterval: 5000 // Real-time 5s live sync for financial claims & vouchers
    });

    const claims = claimsData?.claims || [];

    // Determine claim card border color by status
    const claimRowClass = (status: string) =>
        status === 'PAID' ? 'border-l-4 border-l-emerald-500' :
        status === 'AUDITED' ? 'border-l-4 border-l-amber-500' :
        'border-l-4 border-l-slate-700';

    return (
        <div className="space-y-6">
            {/* Page Header */}
            <div className="bg-gradient-to-r from-slate-900 via-slate-900/95 to-slate-950 p-4 rounded-xl border border-slate-800 shadow-md flex items-center justify-between">
                <div>
                    <h1 className="text-base font-bold text-white flex items-center gap-2">
                        <Banknote className="w-4 h-4 text-emerald-400" />
                        Invoice Claims & Payment Vouchers
                    </h1>
                    <p className="text-[10px] text-slate-400 mt-0.5">Monthly billing statements, payment splits & retention guarantee</p>
                </div>
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-[10px] font-bold text-emerald-400">
                    <TrendingUp className="w-3 h-3" />
                    <span>LIVE</span>
                </div>
            </div>

            {/* Financial Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
                {isLoading ? (
                    <>
                        <KpiSkeleton />
                        <KpiSkeleton />
                        <KpiSkeleton />
                        <KpiSkeleton />
                    </>
                ) : (
                    <>
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
                                    <span>Retention</span>
                                    <ShieldCheck className="w-4 h-4 text-amber-400" />
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-3.5 pt-0">
                                <div className="text-xl md:text-2xl font-black text-amber-400 font-mono">Rs. {Number(claimsData?.retentionHeldLkr || 0).toLocaleString()}</div>
                                <p className="text-[10px] text-amber-400/80 font-bold mt-0.5">Held by SLTSERP</p>
                            </CardContent>
                        </Card>

                        <Card className="bg-slate-900/80 border-slate-800">
                            <CardHeader className="p-3.5 pb-1">
                                <CardTitle className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                                    <span>Pending Audit</span>
                                    <Clock className="w-4 h-4 text-rose-400" />
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-3.5 pt-0">
                                <div className="text-2xl font-black text-rose-400 font-mono">{claimsData?.pendingVouchersCount || 0}</div>
                                <p className="text-[10px] text-slate-400 mt-0.5">Under Review</p>
                            </CardContent>
                        </Card>
                    </>
                )}
            </div>

            {/* Claims Table */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden shadow-lg space-y-3 p-4">
                <div className="flex justify-between items-center">
                    <h2 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Monthly Invoice Claim History</h2>
                    <span className="text-[10px] text-slate-500 font-mono">Tap any claim to view voucher</span>
                </div>

                {isLoading ? (
                    <div className="space-y-2 py-2">
                        {[1,2,3].map(i => <div key={i} className="h-12 bg-slate-800/60 rounded-xl animate-pulse" />)}
                    </div>
                ) : isError ? (
                    <div className="py-10 text-center space-y-2">
                        <AlertTriangle className="w-8 h-8 mx-auto text-rose-400 opacity-60" />
                        <p className="text-xs font-bold text-slate-300">Failed to load claims</p>
                        <p className="text-[11px] text-slate-500">Please check your connection and try again.</p>
                    </div>
                ) : claims.length === 0 ? (
                    <div className="py-10 text-center space-y-2">
                        <FileCheck2 className="w-8 h-8 mx-auto text-slate-600 opacity-60" />
                        <p className="text-xs font-bold text-slate-300">No Invoice Claims Yet</p>
                        <p className="text-[11px] text-slate-500">Claims will appear once your SODs are closed and invoiced.</p>
                    </div>
                ) : (
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
                                {claims.map((claim: ContractorClaim) => (
                                    <tr
                                        key={claim.id}
                                        onClick={() => setSelectedClaim(claim)}
                                        className={cn(
                                            "hover:bg-slate-900/80 transition-colors cursor-pointer group",
                                            claimRowClass(claim.status)
                                        )}
                                    >
                                        <td className="p-3 font-mono font-bold text-emerald-400 group-hover:underline">{claim.claimNumber}</td>
                                        <td className="p-3 font-semibold text-slate-200">{claim.month}</td>
                                        <td className="p-3 text-right font-mono font-bold text-blue-400">{claim.sodCount}</td>
                                        <td className="p-3 text-right font-mono font-black text-white">Rs. {Number(claim.amountLkr).toLocaleString()}</td>
                                        <td className="p-3 text-center">
                                            <StatusBadge status={claim.status} />
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Contractor Invoice Claim Voucher Modal */}
            <Dialog open={!!selectedClaim} onOpenChange={() => setSelectedClaim(null)}>
                <DialogContent className="bg-slate-900/95 backdrop-blur-xl border-slate-800 text-white w-full max-w-[94vw] sm:max-w-md p-4 sm:p-5 rounded-2xl shadow-2xl">
                    <div className="w-12 h-1 bg-slate-700/60 rounded-full mx-auto mb-1 sm:hidden" />
                    <DialogHeader className="space-y-1">
                        <div className="flex items-center justify-between">
                            <StatusBadge status={selectedClaim?.status || 'PENDING'} />
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
                                    <span>Less Retention:</span>
                                    <span>- Rs. {Number(selectedClaim.retentionLkr || (Number(selectedClaim.amountLkr) * 0.05)).toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between text-emerald-400 font-bold text-xs pt-1 border-t border-slate-800">
                                    <span>Net Payable:</span>
                                    <span>Rs. {Number(selectedClaim.netLkr || (Number(selectedClaim.amountLkr) * 0.95)).toLocaleString()}</span>
                                </div>
                            </div>

                            {/* Payment Status Timeline */}
                            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-2">
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Payment Timeline</p>
                                <div className="flex items-center gap-2">
                                    <div className={cn("w-5 h-5 rounded-full flex items-center justify-center shrink-0", selectedClaim.status !== 'PENDING' ? "bg-emerald-500/20 border border-emerald-500/40" : "bg-slate-800 border border-slate-700")}>
                                        <CheckCircle2 className={cn("w-3 h-3", selectedClaim.status !== 'PENDING' ? "text-emerald-400" : "text-slate-600")} />
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-[10px] font-bold text-slate-200">Audited & Approved</p>
                                        <p className="text-[9px] text-slate-500">SF Audit certification complete</p>
                                    </div>
                                </div>
                                <div className="ml-2.5 h-4 border-l border-dashed border-slate-700" />
                                <div className="flex items-center gap-2">
                                    <div className={cn("w-5 h-5 rounded-full flex items-center justify-center shrink-0", selectedClaim.status === 'PAID' ? "bg-emerald-500/20 border border-emerald-500/40" : "bg-slate-800 border border-slate-700")}>
                                        <Banknote className={cn("w-3 h-3", selectedClaim.status === 'PAID' ? "text-emerald-400" : "text-slate-600")} />
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-[10px] font-bold text-slate-200">Claim A — 80% Disbursed</p>
                                        <p className="text-[9px] text-slate-500">{selectedClaim.status === 'PAID' ? 'Paid to bank account' : 'Awaiting finance processing'}</p>
                                    </div>
                                </div>
                                <div className="ml-2.5 h-4 border-l border-dashed border-slate-700" />
                                <div className="flex items-center gap-2">
                                    <div className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 bg-amber-500/10 border border-amber-500/30">
                                        <ShieldCheck className="w-3 h-3 text-amber-400" />
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-[10px] font-bold text-amber-300">Claim B — 20% Retention Held</p>
                                        <p className="text-[9px] text-slate-500">Released after warranty period</p>
                                    </div>
                                </div>
                            </div>

                            <div className="p-2.5 bg-emerald-500/10 rounded-xl border border-emerald-500/30 flex items-center justify-between text-[10px] text-emerald-400 font-bold">
                                <span>🛡️ Audited & Certified for Disbursement</span>
                                <span className="font-mono text-[9px] text-emerald-500 uppercase">SLTS APPROVED</span>
                            </div>
                        </div>
                    )}

                    <DialogFooter className="pt-2 flex flex-col sm:flex-row justify-between gap-2">
                        <Button
                            type="button"
                            onClick={() => {
                                if (selectedClaim?.id && !selectedClaim.id.startsWith('claim-est')) {
                                    window.open(`/public/invoices/${selectedClaim.id}`, '_blank');
                                } else {
                                    window.print();
                                }
                            }}
                            className="bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold h-10 rounded-xl px-4 flex items-center justify-center gap-1.5 shadow-md cursor-pointer"
                        >
                            <FileCheck2 className="w-4 h-4" />
                            View Full Official Invoice
                        </Button>
                        <Button
                            type="button"
                            onClick={() => window.print()}
                            className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold h-10 rounded-xl px-4 flex items-center justify-center gap-1.5 shadow-md cursor-pointer"
                        >
                            <Printer className="w-4 h-4" />
                            Print / PDF
                        </Button>
                        <Button
                            onClick={() => setSelectedClaim(null)}
                            className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold h-10 rounded-xl border border-slate-700 active:scale-98 transition-all cursor-pointer"
                        >
                            Close
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

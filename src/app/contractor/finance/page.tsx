"use client";

import {  useState  } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Banknote, ShieldCheck, FileCheck2, Clock, Printer, CheckCircle2, AlertTriangle, TrendingUp } from "lucide-react";
import { cn } from '@/lib/utils';
import { approvalLine } from '@/lib/contractor-claim-display';

interface ContractorClaim {
    id: string;
    month: string;
    claimNumber: string;
    sodCount: number;
    amountLkr: number;
    status: string;
    grossLkr?: number;
    retentionLkr?: number;
    retentionPercent?: number;
    netLkr?: number;
    /** where the invoice is in the area approval: a role code while it waits, CONFIRMED when done */
    confirmStage?: string;
    orders?: Array<{ soNum: string; amount: number }>;
    paidDate?: string | null;
    hoReference?: string | null;
    tracker?: { headline: string; stepNumber: number; totalSteps: number; finished: boolean; cancelled: boolean; retentionHeld: boolean; steps: Array<{ key: string; label: string; state: 'done' | 'current' | 'waiting' | 'cancelled'; at: string | null; note?: string | null }> };
    removedSods?: Array<{ soNum: string; reason: string }>;
}

interface FinanceData {
    totalClaimedLkr: number;
    totalPaidLkr: number;
    retentionHeldLkr: number;
    pendingVouchersCount: number;
    awaitingYourConfirmationCount?: number;
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
function StatusBadge({ status, confirm }: { status: string; confirm?: string }) {
    if (confirm === 'CONTRACTOR') return (
        <span className="px-2 py-0.5 text-[9px] font-black uppercase rounded border bg-amber-500/20 text-amber-300 border-amber-500/50 flex items-center gap-1 w-fit mx-auto">
            <Clock className="w-2.5 h-2.5" /> Confirm needed
        </span>
    );
    if (confirm && confirm !== 'CONFIRMED' && confirm !== 'CANCELLED') return (
        <span className="px-2 py-0.5 text-[9px] font-black uppercase rounded border bg-sky-500/20 text-sky-200 border-sky-500/50 flex items-center gap-1 w-fit mx-auto">
            <Clock className="w-2.5 h-2.5" /> In approval
        </span>
    );
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
    const [claimView, setClaimView] = useState<'all' | 'open' | 'paid'>('all');
    const [claimSearch, setClaimSearch] = useState('');
    const [disputeNote, setDisputeNote] = useState('');
    const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
    const queryClient = useQueryClient();

    const getAuthHeaders = () => {
        const contractorToken = typeof window !== 'undefined' ? (localStorage.getItem('contractor_token') || localStorage.getItem('token')) : null;

        const headers: Record<string, string> = {
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
        };
        if (contractorToken) {
            headers['Authorization'] = `Bearer ${contractorToken}`;
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
        refetchInterval: 30000,
        refetchIntervalInBackground: false,
    });

    const claims = claimsData?.claims || [];

    // Confirm the invoice (it then goes on to OSP Quality automatically) or dispute it with a reason
    const respond = useMutation({
        mutationFn: async (v: { id: string; action: 'CONFIRM' | 'DISPUTE'; note?: string }) => {
            const res = await fetch('/api/contractor-portal/invoice-approvals', {
                method: 'POST',
                headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: v.action === 'CONFIRM' ? 'APPROVE' : 'RETURN', invoiceIds: [v.id], note: v.note }),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error?.message || 'Could not save your answer');
            return v.action;
        },
        onSuccess: (action) => {
            setMessage({ ok: true, text: action === 'CONFIRM' ? 'Invoice confirmed. It goes on to the next approval step.' : 'Your dispute was sent to the office.' });
            setDisputeNote('');
            setSelectedClaim(null);
            queryClient.invalidateQueries({ queryKey: ['contractor-finance-claims'] });
        },
        onError: (e: Error) => setMessage({ ok: false, text: e.message }),
    });
    const isCertified = (c: ContractorClaim | null) => !!c && ['SF_AUDIT_APPROVED', 'AUDITED', 'APPROVED', 'PAID'].includes(c.status);

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

            {(claimsData?.awaitingYourConfirmationCount ?? 0) > 0 && (
                <div className="rounded-xl border border-amber-500/50 bg-amber-500/15 p-3 text-xs font-bold text-amber-200" role="status">
                    {claimsData?.awaitingYourConfirmationCount} invoice{claimsData?.awaitingYourConfirmationCount === 1 ? '' : 's'} waiting for your confirmation. Open it, check it, then confirm or dispute.
                </div>
            )}
            {message && (
                <div className={cn('rounded-xl border p-3 text-xs font-bold', message.ok ? 'border-emerald-500/50 bg-emerald-500/15 text-emerald-200' : 'border-rose-500/50 bg-rose-500/15 text-rose-200')} role="status">{message.text}</div>
            )}

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
                    <span className="text-[10px] text-slate-400 font-mono">Tap any claim to see where it is</span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    {(['all', 'open', 'paid'] as const).map((v) => (
                        <button key={v} type="button" onClick={() => setClaimView(v)} className={cn('rounded-full border px-3 py-1 text-[11px] font-bold', claimView === v ? 'border-emerald-400 bg-emerald-500/20 text-emerald-200' : 'border-slate-600 bg-slate-900 text-slate-200')}>{v === 'all' ? 'All claims' : v === 'open' ? 'Not yet paid' : 'Paid'}</button>
                    ))}
                    <input value={claimSearch} onChange={(e) => setClaimSearch(e.target.value)} placeholder="Invoice number or month" aria-label="Search claims" className="h-8 w-48 rounded-md border border-slate-600 bg-slate-950 px-2 text-[11px] text-white placeholder:text-slate-400" />
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
                                    <th className="p-3">Where it is</th>
                                    <th className="p-3 text-center">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800/60 bg-slate-950/40">
                                {claims.filter((c: ContractorClaim) => (claimView === 'all' || (claimView === 'paid') === !!c.tracker?.finished) && (!claimSearch.trim() || `${c.claimNumber} ${c.month}`.toLowerCase().includes(claimSearch.trim().toLowerCase()))).map((claim: ContractorClaim) => (
                                    <tr
                                        key={claim.id}
                                        onClick={() => { setSelectedClaim(claim); setDisputeNote(''); setMessage(null); }}
                                        className={cn(
                                            "hover:bg-slate-900/80 transition-colors cursor-pointer group",
                                            claimRowClass(claim.status)
                                        )}
                                    >
                                        <td className="p-3 font-mono font-bold text-emerald-400 group-hover:underline">{claim.claimNumber}</td>
                                        <td className="p-3 font-semibold text-slate-200">{claim.month}</td>
                                        <td className="p-3 text-right font-mono font-bold text-blue-400">{claim.sodCount}</td>
                                        <td className="p-3 text-right font-mono font-black text-white">Rs. {Number(claim.amountLkr).toLocaleString()}</td>
                                        <td className="p-3 text-[11px] font-semibold text-slate-200">{claim.tracker?.headline ?? '-'}</td>
                                        <td className="p-3 text-center">
                                            <StatusBadge status={claim.status} confirm={claim.confirmStage} />
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
                            <StatusBadge status={selectedClaim?.status || 'PENDING'} confirm={selectedClaim?.confirmStage} />
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

                            {/* Where the invoice is on its way to payment */}
                            {selectedClaim.tracker ? (
                                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-2">
                                    <p className="text-[10px] font-bold text-slate-300 uppercase tracking-wider">Where your invoice is</p>
                                    <p className="text-xs font-bold text-white">{selectedClaim.tracker.headline}</p>
                                    <ol className="space-y-1.5 pt-1">
                                        {selectedClaim.tracker.steps.map((st, i) => (
                                            <li key={st.key} className="flex items-start gap-2">
                                                <span className={cn("mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border text-[9px] font-black",
                                                    st.state === 'done' ? "border-emerald-400 bg-emerald-500 text-slate-950" : st.state === 'current' ? "border-amber-300 bg-amber-400 text-slate-950" : st.state === 'cancelled' ? "border-red-400 bg-red-400 text-slate-950" : "border-slate-500 bg-slate-800 text-slate-200")}>{i + 1}</span>
                                                <div className="flex-1">
                                                    <p className={cn("text-[11px]", st.state === 'current' ? "font-bold text-amber-200" : st.state === 'done' ? "font-semibold text-emerald-200" : "text-slate-300")}>{st.label}{st.state === 'current' ? ' (now)' : ''}</p>
                                                    {st.note && <p className="text-[10px] font-semibold text-red-300">{st.note}</p>}
                                                    {st.state === 'done' && st.at && <p className="text-[10px] text-slate-400">{new Date(st.at).toLocaleDateString('en-GB')}</p>}
                                                </div>
                                            </li>
                                        ))}
                                    </ol>
                                    {selectedClaim.tracker.retentionHeld && !selectedClaim.tracker.cancelled && (
                                        <p className="text-[10px] text-amber-300">{selectedClaim.retentionPercent ?? 10}% retention is held back and released after the warranty period.</p>
                                    )}
                                </div>
                            ) : (
                                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                                    <p className="text-xs font-bold text-white">{approvalLine(selectedClaim.status, selectedClaim.confirmStage, isCertified(selectedClaim)).title}</p>
                                    <p className="text-[11px] text-slate-300">{approvalLine(selectedClaim.status, selectedClaim.confirmStage, isCertified(selectedClaim)).detail}</p>
                                </div>
                            )}

                            {selectedClaim.tracker?.finished && (selectedClaim.paidDate || selectedClaim.hoReference) && (
                                <div className="p-2.5 bg-emerald-500/10 rounded-xl border border-emerald-500/30 text-[11px] font-bold text-emerald-200">
                                    Paid{selectedClaim.paidDate ? ` on ${new Date(selectedClaim.paidDate).toLocaleDateString('en-GB')}` : ''}{selectedClaim.hoReference ? ` · Head Office reference ${selectedClaim.hoReference}` : ''}
                                </div>
                            )}
                            {(selectedClaim.orders?.length ?? 0) > 0 && (
                                <details className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                                    <summary className="cursor-pointer text-[11px] font-bold text-slate-200">Orders on this invoice ({selectedClaim.orders!.length})</summary>
                                    <ul className="mt-2 max-h-40 space-y-0.5 overflow-y-auto text-[11px] text-slate-200">
                                        {selectedClaim.orders!.map((o) => <li key={o.soNum} className="flex justify-between"><span className="font-mono">{o.soNum}</span><span>Rs. {o.amount.toLocaleString()}</span></li>)}
                                    </ul>
                                </details>
                            )}

                            {selectedClaim.confirmStage === 'CONTRACTOR' && (
                                <div className="p-3 bg-amber-500/10 rounded-xl border border-amber-500/40 space-y-2">
                                    <p className="text-[11px] font-bold text-amber-200">Check this invoice. If it is correct, accept it and it goes on to the Area Manager. If something is wrong, tell us what and it goes back to the check.</p>
                                    <textarea
                                        value={disputeNote}
                                        onChange={(e) => setDisputeNote(e.target.value)}
                                        placeholder="What is wrong? (needed only when you dispute)"
                                        aria-label="Reason for dispute"
                                        rows={2}
                                        className="w-full rounded-lg border border-slate-600 bg-slate-950 p-2 text-xs text-white placeholder:text-slate-400"
                                    />
                                    <div className="flex gap-2">
                                        <Button type="button" disabled={respond.isPending} onClick={() => respond.mutate({ id: selectedClaim.id, action: 'CONFIRM' })} className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold h-10 rounded-xl">
                                            {respond.isPending ? 'Saving...' : 'Confirm invoice'}
                                        </Button>
                                        <Button type="button" disabled={respond.isPending || disputeNote.trim().length < 3} onClick={() => respond.mutate({ id: selectedClaim.id, action: 'DISPUTE', note: disputeNote })} className="flex-1 bg-rose-700 hover:bg-rose-600 text-white text-xs font-bold h-10 rounded-xl disabled:opacity-50">
                                            Dispute
                                        </Button>
                                    </div>
                                </div>
                            )}
                            {(selectedClaim.removedSods?.length ?? 0) > 0 && (
                                <div className="p-2.5 bg-rose-500/10 rounded-xl border border-rose-500/40 text-[11px] text-rose-200 font-bold">
                                    Service orders taken out of this invoice:
                                    <ul className="mt-1 list-disc pl-4 font-normal">{selectedClaim.removedSods?.map((r) => <li key={r.soNum}><span className="font-bold">{r.soNum}</span>: {r.reason}</li>)}</ul>
                                </div>
                            )}
                            {isCertified(selectedClaim) && (
                                <div className="p-2.5 bg-emerald-500/10 rounded-xl border border-emerald-500/30 flex items-center justify-between text-[10px] text-emerald-400 font-bold">
                                    <span>🛡️ Audited & Certified for Disbursement</span>
                                    <span className="font-mono text-[9px] text-emerald-500 uppercase">SLTS APPROVED</span>
                                </div>
                            )}
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

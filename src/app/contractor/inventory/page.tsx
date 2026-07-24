"use client";

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Package, ShieldCheck, CheckCircle2, FileSignature, Check } from "lucide-react";
import { toast } from 'sonner';

interface MaterialIssue {
    id: string;
    issueNumber: string;
    issueDate: string;
    month: string;
    status: string;
    acceptedAt?: string;
    signatureUrl?: string;
    store: { name: string };
    items: {
        id: string;
        quantity: number;
        unit: string;
        item: { code: string; name: string };
    }[];
}

export default function ContractorInventoryPage() {
    const queryClient = useQueryClient();
    const [selectedIssue, setSelectedIssue] = useState<MaterialIssue | null>(null);
    const [viewVoucherIssue, setViewVoucherIssue] = useState<MaterialIssue | null>(null);
    const [signatureName, setSignatureName] = useState('');

    // Fetch Contractor Material Issues (Pending Dual-Custody Acceptances)
    const { data: issues = [], isLoading } = useQuery<MaterialIssue[]>({
        queryKey: ['contractor-material-issues'],
        queryFn: async () => {
            const res = await fetch(`/api/contractors/my-issues?_t=${Date.now()}`);
            if (!res.ok) return [];
            const json = await res.json();
            return Array.isArray(json) ? json : json.data || [];
        },
        refetchInterval: 5000,
    });

    // Dual Custody Acceptance Mutation
    const acceptIssueMutation = useMutation({
        mutationFn: async (issueId: string) => {
            const res = await fetch(`/api/contractors/my-issues/${issueId}/accept`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ signatureName })
            });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.message || 'Failed to accept dispatch');
            }
            return res.json();
        },
        onSuccess: () => {
            toast.success('Dispatch accepted! Stock added to virtual van balance.');
            queryClient.invalidateQueries({ queryKey: ['contractor-material-issues'] });
            setSelectedIssue(null);
            setSignatureName('');
        },
        onError: (err: Error) => {
            toast.error(err.message);
        }
    });

    return (
        <div className="space-y-6">
            <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 shadow-md">
                <h1 className="text-base font-bold text-white flex items-center gap-2">
                    <Package className="w-4 h-4 text-amber-400" />
                    Van Stock & Material Issues
                </h1>
            </div>

            {/* Pending Dual Custody Acceptance Section */}
            <div className="space-y-3">
                <h2 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-amber-400" />
                    Pending Dispatches
                </h2>

                {isLoading ? (
                    <div className="py-12 text-center text-xs text-slate-400">Loading store dispatches...</div>
                ) : issues.filter(i => i.status === 'PENDING_ACCEPTANCE').length === 0 ? (
                    <div className="p-8 text-center bg-slate-900/60 rounded-2xl border border-slate-800 text-slate-400 space-y-2">
                        <CheckCircle2 className="w-10 h-10 mx-auto text-emerald-500 opacity-80" />
                        <h4 className="text-sm font-bold text-slate-200">All Dispatches Accepted</h4>
                        <p className="text-xs text-slate-400">There are no pending dispatches awaiting your signature.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {issues.filter(i => i.status === 'PENDING_ACCEPTANCE').map((issue) => {
                            const minRef = issue.issueNumber || `MIN-2026-${issue.id.slice(-6).toUpperCase()}`;
                            return (
                                <Card key={issue.id} className="bg-slate-900/80 border-slate-800 shadow-md">
                                    <CardHeader className="p-4 pb-2 border-b border-slate-800 flex flex-row items-center justify-between space-y-0">
                                        <div>
                                            <div className="text-[10px] font-black text-amber-400 uppercase tracking-widest">Store Issue Note No</div>
                                            <CardTitle className="text-sm font-black text-white font-mono">{minRef}</CardTitle>
                                            <p className="text-xs text-slate-400 mt-0.5">From: {issue.store?.name || 'Main Store'}</p>
                                        </div>
                                        <span className="px-2 py-0.5 text-[9px] font-black uppercase rounded border bg-amber-500/20 text-amber-400 border-amber-500/40 animate-pulse">
                                            PENDING
                                        </span>
                                    </CardHeader>
                                    <CardContent className="p-4 space-y-3">
                                        <div className="space-y-1 text-xs">
                                            <span className="text-slate-400 font-bold">Issued Items:</span>
                                            <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 space-y-1">
                                                {issue.items.map((it) => (
                                                    <div key={it.id} className="flex justify-between font-mono text-[11px]">
                                                        <span className="text-slate-300">{it.item.name} ({it.item.code})</span>
                                                        <span className="font-bold text-amber-400">{it.quantity} {it.unit}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                        <Button
                                            onClick={() => setSelectedIssue(issue)}
                                            className="w-full bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold h-9 rounded-xl flex items-center justify-center gap-2 shadow-md cursor-pointer"
                                        >
                                            <FileSignature className="w-4 h-4" />
                                            Review & Sign Acceptance
                                        </Button>
                                    </CardContent>
                                </Card>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Accepted Dispatches History Section */}
            {issues.filter(i => i.status === 'ACCEPTED').length > 0 && (
                <div className="space-y-3 pt-4 border-t border-slate-800/80">
                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-wider flex items-center justify-between">
                        <span className="flex items-center gap-2">
                            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                            Accepted Dispatches History ({issues.filter(i => i.status === 'ACCEPTED').length})
                        </span>
                        <span className="text-[10px] text-slate-500 font-mono">Tap any card to view voucher</span>
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {issues.filter(i => i.status === 'ACCEPTED').map((accepted) => {
                            const minRef = accepted.issueNumber || `MIN-2026-${accepted.id.slice(-6).toUpperCase()}`;
                            return (
                                <div 
                                    key={accepted.id} 
                                    onClick={() => setViewVoucherIssue(accepted)}
                                    className="p-3.5 bg-slate-900/80 hover:bg-slate-900 border border-emerald-500/30 hover:border-emerald-500/60 rounded-xl space-y-2.5 transition-all cursor-pointer shadow-md group"
                                >
                                    <div className="flex justify-between items-center text-xs">
                                        <div>
                                            <span className="text-[10px] text-slate-400 font-bold uppercase block">Issue Note No</span>
                                            <span className="font-mono font-black text-amber-400 text-sm group-hover:underline">{minRef}</span>
                                        </div>
                                        <span className="font-bold text-emerald-400 flex items-center gap-1.5 text-[11px] bg-emerald-500/10 px-2 py-1 rounded-lg border border-emerald-500/30">
                                            <CheckCircle2 className="w-3.5 h-3.5" />
                                            Accepted & Stock Credited
                                        </span>
                                    </div>

                                    {/* Compact Item Summary Badge */}
                                    <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 flex items-center justify-between font-mono text-[11px]">
                                        <div className="flex items-center gap-2 truncate">
                                            <Package className="w-4 h-4 text-amber-400 shrink-0" />
                                            <span className="text-slate-300 font-medium truncate">
                                                {accepted.items.length} Items Issued ({accepted.items.map(it => `${it.quantity}${it.unit} ${it.item.name}`).join(', ')})
                                            </span>
                                        </div>
                                        <span className="text-amber-400 font-bold text-[10px] shrink-0 ml-2">View List →</span>
                                    </div>

                                    <div className="text-[11px] text-slate-300 font-mono bg-slate-950/60 p-2 rounded-lg border border-slate-800/80 flex justify-between items-center">
                                        <span>Signed by: <span className="text-white font-bold">{accepted.signatureUrl || 'Contractor Supervisor'}</span></span>
                                        <span className="text-[10px] text-slate-400 font-sans">
                                            {accepted.acceptedAt ? new Date(accepted.acceptedAt).toLocaleTimeString() : ''}
                                        </span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Mobile Dual-Custody Signature Modal */}
            <Dialog open={!!selectedIssue} onOpenChange={() => setSelectedIssue(null)}>
                <DialogContent className="bg-slate-900/95 backdrop-blur-xl border-slate-800 text-white w-full max-w-[94vw] sm:max-w-md p-4 sm:p-5 rounded-2xl shadow-2xl transition-all duration-300 max-h-[90vh] overflow-y-auto">
                    {/* Mobile Liquid Sheet Pull Handle */}
                    <div className="w-12 h-1 bg-slate-700/60 rounded-full mx-auto mb-1 sm:hidden" />
                    <DialogHeader>
                        <DialogTitle className="text-base font-bold text-white">Dual-Custody Acceptance Sign-Off</DialogTitle>
                        <DialogDescription className="text-slate-400 text-xs">
                            Confirm receipt of materials from Store. Custody transfers to contractor upon acceptance.
                        </DialogDescription>
                    </DialogHeader>

                    {selectedIssue && (
                        <div className="space-y-4 py-2 text-xs">
                            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-1 font-mono text-[11px]">
                                <div className="flex justify-between text-slate-400">
                                    <span>Dispatch No:</span>
                                    <span className="text-amber-400 font-bold">{selectedIssue.issueNumber || selectedIssue.id}</span>
                                </div>
                                <div className="flex justify-between text-slate-400">
                                    <span>From Store:</span>
                                    <span className="text-white">{selectedIssue.store?.name}</span>
                                </div>
                            </div>

                            <div>
                                <label className="block text-slate-300 font-bold mb-1">Receiver Name / Signature</label>
                                <input
                                    type="text"
                                    placeholder="Enter your full name"
                                    value={signatureName}
                                    onChange={(e) => setSignatureName(e.target.value)}
                                    className="w-full h-11 px-3 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 focus:outline-none focus:border-amber-500 text-xs"
                                />
                            </div>
                        </div>
                    )}

                    <DialogFooter className="flex-row gap-2 pt-2">
                        <Button variant="outline" onClick={() => setSelectedIssue(null)} className="w-1/2 border-slate-800 text-slate-300 text-xs h-10 rounded-xl">
                            Cancel
                        </Button>
                        <Button
                            onClick={() => selectedIssue && acceptIssueMutation.mutate(selectedIssue.id)}
                            disabled={!signatureName || acceptIssueMutation.isPending}
                            className="w-1/2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold h-10 rounded-xl shadow-lg"
                        >
                            <Check className="w-4 h-4 mr-1" />
                            Confirm
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Enterprise Auditable Store Material Issue Voucher Modal */}
            <Dialog open={!!viewVoucherIssue} onOpenChange={() => setViewVoucherIssue(null)}>
                <DialogContent className="bg-slate-900/95 backdrop-blur-xl border-slate-800 text-white w-full max-w-[94vw] sm:max-w-md p-4 sm:p-5 rounded-2xl shadow-2xl transition-all duration-300 max-h-[90vh] overflow-y-auto">
                    {/* Mobile Liquid Sheet Pull Handle */}
                    <div className="w-12 h-1 bg-slate-700/60 rounded-full mx-auto mb-1 sm:hidden" />
                    <DialogHeader className="space-y-1">
                        <div className="flex items-center justify-between">
                            <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/30">
                                TRANSFER ACCEPTED
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono">Store Issue Voucher</span>
                        </div>
                        <DialogTitle className="text-sm sm:text-base font-bold text-amber-400 font-mono tracking-tight pt-1">
                            {viewVoucherIssue?.issueNumber || `MIN-2026-${viewVoucherIssue?.id.slice(-6).toUpperCase()}`}
                        </DialogTitle>
                    </DialogHeader>

                    {viewVoucherIssue && (
                        <div className="space-y-3 text-xs">
                            {/* Meta Summary */}
                            <div className="grid grid-cols-2 gap-2 bg-slate-950 p-2.5 sm:p-3 rounded-xl border border-slate-800 font-mono text-[10px] sm:text-[11px]">
                                <div>
                                    <span className="text-slate-500 block text-[9px] uppercase font-sans">Issuing Store</span>
                                    <span className="text-slate-200 font-bold truncate block">{viewVoucherIssue.store?.name || 'Main Store'}</span>
                                </div>
                                <div>
                                    <span className="text-slate-500 block text-[9px] uppercase font-sans">Issue Date</span>
                                    <span className="text-slate-200">{new Date(viewVoucherIssue.issueDate).toLocaleDateString()}</span>
                                </div>
                                <div>
                                    <span className="text-slate-500 block text-[9px] uppercase font-sans">Signed By</span>
                                    <span className="text-emerald-400 font-bold truncate block">{viewVoucherIssue.signatureUrl || 'Contractor Supervisor'}</span>
                                </div>
                                <div>
                                    <span className="text-slate-500 block text-[9px] uppercase font-sans">Transfer Time</span>
                                    <span className="text-slate-200">{viewVoucherIssue.acceptedAt ? new Date(viewVoucherIssue.acceptedAt).toLocaleTimeString() : 'N/A'}</span>
                                </div>
                            </div>

                            {/* Itemized Materials Table */}
                            <div className="space-y-1">
                                <span className="text-slate-400 font-bold uppercase text-[10px] tracking-wider block">Issued Materials ({viewVoucherIssue.items.length})</span>
                                <div className="bg-slate-950 rounded-xl border border-slate-800 overflow-x-auto max-h-48 overflow-y-auto">
                                    <table className="w-full text-left font-mono text-[10px] sm:text-[11px]">
                                        <thead className="bg-slate-950 border-b border-slate-800 text-[9px] text-slate-400 uppercase tracking-wider font-semibold">
                                            <tr>
                                                <th className="p-2">Item Code</th>
                                                <th className="p-2">Description</th>
                                                <th className="p-2 text-right">Quantity</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-800/60">
                                            {viewVoucherIssue.items.map((it) => (
                                                <tr key={it.id} className="hover:bg-slate-900/50">
                                                    <td className="p-2 text-amber-400 font-bold whitespace-nowrap">{it.item.code}</td>
                                                    <td className="p-2 text-slate-200 max-w-[110px] truncate">{it.item.name}</td>
                                                    <td className="p-2 text-right font-bold text-emerald-400 whitespace-nowrap">{it.quantity} {it.unit}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* Friendly Custody Security Verification Badge */}
                            <div className="p-2 bg-emerald-500/10 rounded-xl border border-emerald-500/30 flex items-center justify-between text-[10px] text-emerald-400 font-bold">
                                <span>🛡️ Digital Custody Verified</span>
                                <span className="font-mono text-[9px] text-emerald-500 uppercase">AUDIT LEDGER SECURED</span>
                            </div>
                        </div>
                    )}

                    <DialogFooter className="pt-2">
                        <Button 
                            onClick={() => setViewVoucherIssue(null)} 
                            className="w-full bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold h-10 rounded-xl border border-slate-700 active:scale-98 transition-all"
                        >
                            Close
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

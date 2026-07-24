"use client";

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Package, ShieldCheck, CheckCircle2, AlertTriangle, Layers, FileSignature, Check } from "lucide-react";
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface MaterialIssue {
    id: string;
    issueNumber: string;
    issueDate: string;
    month: string;
    status: string;
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
    const [signatureName, setSignatureName] = useState('');

    // Fetch Contractor Material Issues (Pending Dual-Custody Acceptances)
    const { data: issues = [], isLoading } = useQuery<MaterialIssue[]>({
        queryKey: ['contractor-material-issues'],
        queryFn: async () => {
            const res = await fetch(`/api/contractors/my-issues?_t=${Date.now()}`);
            if (!res.ok) return [];
            return res.json();
        }
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
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-slate-900 p-5 rounded-2xl border border-slate-800 gap-4 shadow-lg">
                <div>
                    <h1 className="text-xl font-black text-white flex items-center gap-2">
                        <Package className="w-5 h-5 text-amber-400" />
                        Van Virtual Stock & Dual-Custody Dispatches
                    </h1>
                    <p className="text-xs text-slate-400 mt-1">Accept material issues from main store with digital sign-off and view team stock balances.</p>
                </div>
            </div>

            {/* Pending Dual Custody Acceptance Section */}
            <div className="space-y-4">
                <h2 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-amber-400" />
                    Pending Dispatches Requiring Acceptance
                </h2>

                {isLoading ? (
                    <div className="py-12 text-center text-xs text-slate-400">Loading store dispatches...</div>
                ) : issues.length === 0 ? (
                    <div className="p-8 text-center bg-slate-900/60 rounded-2xl border border-slate-800 text-slate-400 space-y-2">
                        <CheckCircle2 className="w-10 h-10 mx-auto text-emerald-500 opacity-60" />
                        <h4 className="text-sm font-bold text-slate-200">All Dispatches Accepted</h4>
                        <p className="text-xs text-slate-400">There are no pending dispatches awaiting your signature.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {issues.map((issue) => (
                            <Card key={issue.id} className="bg-slate-900/80 border-slate-800 shadow-md">
                                <CardHeader className="p-4 pb-2 border-b border-slate-800 flex flex-row items-center justify-between space-y-0">
                                    <div>
                                        <CardTitle className="text-sm font-bold text-white font-mono">{issue.issueNumber}</CardTitle>
                                        <p className="text-xs text-slate-400">From: {issue.store?.name || 'Main Store'}</p>
                                    </div>
                                    <span className={cn(
                                        "px-2 py-0.5 text-[9px] font-black uppercase rounded border",
                                        issue.status === 'PENDING_ACCEPTANCE' ? "bg-amber-500/20 text-amber-400 border-amber-500/40 animate-pulse" : "bg-emerald-500/20 text-emerald-400 border-emerald-500/40"
                                    )}>
                                        {issue.status}
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
                                        className="w-full bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold h-9 rounded-xl flex items-center justify-center gap-2 shadow-md"
                                    >
                                        <FileSignature className="w-4 h-4" />
                                        Review & Sign Acceptance
                                    </Button>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}
            </div>

            {/* Mobile Signature Modal */}
            <Dialog open={!!selectedIssue} onOpenChange={() => setSelectedIssue(null)}>
                <DialogContent className="bg-slate-900 border-slate-800 text-white max-w-md">
                    <DialogHeader>
                        <DialogTitle>Dual-Custody Acceptance Sign-Off</DialogTitle>
                        <DialogDescription className="text-slate-400 text-xs">
                            Confirm receipt of materials from Store. Legal custody transfers to contractor upon acceptance.
                        </DialogDescription>
                    </DialogHeader>

                    {selectedIssue && (
                        <div className="space-y-4 py-2 text-xs">
                            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-1 font-mono">
                                <div className="flex justify-between text-slate-400">
                                    <span>Dispatch No:</span>
                                    <span className="text-white font-bold">{selectedIssue.issueNumber}</span>
                                </div>
                                <div className="flex justify-between text-slate-400">
                                    <span>From Store:</span>
                                    <span className="text-white">{selectedIssue.store?.name}</span>
                                </div>
                            </div>

                            <div>
                                <label className="block text-slate-400 font-bold mb-1">Receiver Name / Signature</label>
                                <input
                                    type="text"
                                    placeholder="Enter your full name as Team Leader"
                                    value={signatureName}
                                    onChange={(e) => setSignatureName(e.target.value)}
                                    className="w-full h-10 px-3 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-amber-500 text-xs"
                                />
                            </div>
                        </div>
                    )}

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setSelectedIssue(null)} className="border-slate-800 text-slate-300 text-xs">
                            Cancel
                        </Button>
                        <Button
                            onClick={() => selectedIssue && acceptIssueMutation.mutate(selectedIssue.id)}
                            disabled={!signatureName || acceptIssueMutation.isPending}
                            className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold"
                        >
                            <Check className="w-4 h-4 mr-1" />
                            Confirm & Transfer Custody
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

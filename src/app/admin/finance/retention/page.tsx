"use client";

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Search, Landmark, ChevronDown, ChevronRight, CheckCircle, ExternalLink, Calendar, DollarSign, FileText } from "lucide-react";
import { toast } from 'sonner';

interface RetentionRelease {
    id: string;
    releaseAmount: number;
    releaseDate: string;
    approvedById: string | null;
    approvedAt: string | null;
    remarks: string | null;
}

interface ProjectRetention {
    id: string;
    projectId: string;
    invoiceId: string | null;
    title: string;
    description: string | null;
    retentionPercent: number;
    retentionAmount: number;
    releasedAmount: number;
    balanceAmount: number;
    status: string;
    releaseCondition: string | null;
    defectLiabilityPeriod: number | null;
    defectLiabilityEnd: string | null;
    createdAt: string;
    project: {
        name: string;
        projectCode: string;
        budget: number | null;
    };
    invoice: {
        invoiceNumber: string;
        totalAmount: number;
    } | null;
    releases: RetentionRelease[];
}

export default function RetentionManagementPage() {
    const queryClient = useQueryClient();
    const [searchTerm, setSearchTerm] = useState("");
    const [statusFilter, setStatusFilter] = useState("ALL");
    const [expandedRetentionId, setExpandedRetentionId] = useState<string | null>(null);

    // Dialog states
    const [showReleaseModal, setShowReleaseModal] = useState(false);
    const [selectedRetention, setSelectedRetention] = useState<ProjectRetention | null>(null);
    const [releaseAmount, setReleaseAmount] = useState(0);
    const [remarks, setRemarks] = useState("");

    // --- QUERIES ---
    const { data: retentions = [], isLoading } = useQuery<ProjectRetention[]>({
        queryKey: ["retentions", statusFilter],
        queryFn: async () => {
            const res = await fetch(`/api/finance/retention?status=${statusFilter}`);
            if (!res.ok) return [];
            return res.json();
        }
    });

    // --- MUTATIONS ---
    const releaseMutation = useMutation({
        mutationFn: async (data: { retentionId: string; releaseAmount: number; remarks: string }) => {
            const res = await fetch('/api/finance/retention', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...data,
                    approvedById: 'admin_user'
                })
            });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || 'Failed to release retention');
            }
            return res.json();
        },
        onSuccess: () => {
            toast.success('Retention released successfully');
            queryClient.invalidateQueries({ queryKey: ["retentions"] });
            setShowReleaseModal(false);
            setReleaseAmount(0);
            setRemarks("");
        },
        onError: (err: Error) => {
            toast.error(err.message);
        }
    });

    const handleOpenReleaseModal = (retention: ProjectRetention) => {
        setSelectedRetention(retention);
        setReleaseAmount(retention.balanceAmount);
        setShowReleaseModal(true);
    };

    const handleReleaseSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedRetention) return;
        
        if (releaseAmount <= 0) {
            toast.error("Release amount must be greater than zero");
            return;
        }
        if (releaseAmount > selectedRetention.balanceAmount) {
            toast.error("Release amount cannot exceed the remaining balance");
            return;
        }

        releaseMutation.mutate({
            retentionId: selectedRetention.id,
            releaseAmount,
            remarks
        });
    };

    const toggleExpand = (id: string) => {
        setExpandedRetentionId(expandedRetentionId === id ? null : id);
    };

    const filteredRetentions = retentions.filter(r => {
        const query = searchTerm.toLowerCase();
        return r.title.toLowerCase().includes(query) ||
            r.project.name.toLowerCase().includes(query) ||
            r.project.projectCode.toLowerCase().includes(query) ||
            (r.invoice && r.invoice.invoiceNumber.toLowerCase().includes(query));
    });

    const getStatusStyle = (status: string) => {
        const styles: Record<string, string> = {
            HELD: 'bg-amber-50 text-amber-700 border-amber-200',
            PARTIALLY_RELEASED: 'bg-blue-50 text-blue-700 border-blue-200',
            FULLY_RELEASED: 'bg-emerald-50 text-emerald-700 border-emerald-200'
        };
        return styles[status] || 'bg-slate-100';
    };

    return (
        <div className="h-screen flex bg-slate-50 dark:bg-slate-950 overflow-hidden">
            <Sidebar />
            <main className="flex-1 flex flex-col min-w-0 h-full">
                <Header />
                <div className="flex-1 flex flex-col min-h-0 overflow-hidden p-6 space-y-4">
                    
                    <div className="flex justify-between items-center">
                        <div>
                            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                                <Landmark className="w-6 h-6 text-blue-600" />
                                Retention Ledger
                            </h1>
                            <p className="text-sm text-muted-foreground mt-1">
                                Track project retention balances and DLP releases
                            </p>
                        </div>
                    </div>

                    {/* Filters & Search */}
                    <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center bg-white dark:bg-slate-900 p-3 rounded-lg border border-slate-200 dark:border-slate-800 shadow-sm">
                        <div className="flex items-center gap-2 flex-1 border rounded px-3 py-1 bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800">
                            <Search className="w-4 h-4 text-slate-400" />
                            <Input 
                                placeholder="Search by project code, name, or invoice..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className="border-0 shadow-none h-8 focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-slate-400"
                            />
                        </div>
                        <div className="flex gap-1.5 flex-wrap">
                            {['ALL', 'HELD', 'PARTIALLY_RELEASED', 'FULLY_RELEASED'].map(status => (
                                <button
                                    key={status}
                                    onClick={() => setStatusFilter(status)}
                                    className={`px-3 py-1 text-xs font-semibold rounded-full border transition-all ${
                                        statusFilter === status 
                                            ? 'bg-blue-600 text-white border-blue-600' 
                                            : 'bg-white dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700 hover:border-blue-300'
                                    }`}
                                >
                                    {status.replace(/_/g, ' ')}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Table View */}
                    <div className="flex-1 overflow-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-sm">
                        {isLoading ? (
                            <div className="flex items-center justify-center h-48">
                                <span className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></span>
                            </div>
                        ) : filteredRetentions.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-48 text-slate-500">
                                <FileText className="w-12 h-12 mb-2 opacity-50" />
                                No retention balances recorded.
                            </div>
                        ) : (
                            <div className="divide-y divide-slate-100 dark:divide-slate-800">
                                {filteredRetentions.map(retention => {
                                    const isExpanded = expandedRetentionId === retention.id;
                                    return (
                                        <div key={retention.id} className="flex flex-col border-b border-slate-100 dark:border-slate-800">
                                            
                                            {/* Retention Row */}
                                            <div className="flex flex-col md:flex-row md:items-center justify-between p-4 gap-4 hover:bg-slate-50/50 dark:hover:bg-slate-800/10">
                                                <div 
                                                    className="flex items-start gap-3 cursor-pointer flex-1"
                                                    onClick={() => toggleExpand(retention.id)}
                                                >
                                                    <div className="mt-1">
                                                        {isExpanded ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                                                    </div>
                                                    <div>
                                                        <div className="font-bold text-slate-900 dark:text-slate-100">{retention.project.projectCode} - {retention.project.name}</div>
                                                        <div className="text-xs text-slate-500 font-semibold mt-0.5">{retention.title}</div>
                                                        {retention.invoice && (
                                                            <span className="inline-flex text-[10px] bg-slate-100 text-slate-600 font-semibold px-2 py-0.5 rounded mt-1 border">
                                                                Invoice: {retention.invoice.invoiceNumber}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>

                                                <div className="grid grid-cols-3 gap-6 text-right md:w-1/3">
                                                    <div>
                                                        <div className="text-[10px] font-bold text-slate-400 uppercase">Retention ({retention.retentionPercent}%)</div>
                                                        <div className="text-sm font-semibold text-slate-800 dark:text-slate-200">LKR {retention.retentionAmount.toLocaleString()}</div>
                                                    </div>
                                                    <div>
                                                        <div className="text-[10px] font-bold text-slate-400 uppercase">Released</div>
                                                        <div className="text-sm font-semibold text-blue-600">LKR {retention.releasedAmount.toLocaleString()}</div>
                                                    </div>
                                                    <div>
                                                        <div className="text-[10px] font-bold text-slate-400 uppercase">Balance HELD</div>
                                                        <div className="text-sm font-bold text-emerald-600">LKR {retention.balanceAmount.toLocaleString()}</div>
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-3">
                                                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold border ${getStatusStyle(retention.status)}`}>
                                                        {retention.status.replace(/_/g, ' ')}
                                                    </span>
                                                    <Button 
                                                        size="sm" 
                                                        disabled={retention.balanceAmount <= 0}
                                                        onClick={() => handleOpenReleaseModal(retention)}
                                                        className="bg-blue-600 hover:bg-blue-700 text-white text-xs h-8"
                                                    >
                                                        Release Amount
                                                    </Button>
                                                </div>
                                            </div>

                                            {/* Expandable Release History */}
                                            {isExpanded && (
                                                <div className="bg-slate-50/50 dark:bg-slate-900/50 pl-12 pr-4 py-3 border-t border-slate-100 dark:border-slate-800">
                                                    <h4 className="text-xs font-bold text-slate-400 mb-2 uppercase flex items-center gap-1">
                                                        <Calendar className="w-3.5 h-3.5" /> Release History
                                                    </h4>
                                                    {retention.releases.length === 0 ? (
                                                        <div className="text-xs text-slate-400 italic py-1">No releases recorded yet.</div>
                                                    ) : (
                                                        <div className="space-y-1.5 max-w-2xl">
                                                            {retention.releases.map(release => (
                                                                <div 
                                                                    key={release.id} 
                                                                    className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded p-2.5 flex justify-between items-center text-xs"
                                                                >
                                                                    <div className="space-y-0.5">
                                                                        <div className="font-semibold text-slate-700 dark:text-slate-300">
                                                                            Released Date: {new Date(release.releaseDate).toLocaleDateString()}
                                                                        </div>
                                                                        {release.remarks && <div className="text-slate-500 font-medium">{release.remarks}</div>}
                                                                    </div>
                                                                    <div className="text-right">
                                                                        <div className="font-bold text-blue-600">LKR {release.releaseAmount.toLocaleString()}</div>
                                                                        <div className="text-[10px] text-slate-400">By: {release.approvedById || 'System'}</div>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            )}

                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>

                {/* Release Retention Dialog */}
                <Dialog open={showReleaseModal} onOpenChange={setShowReleaseModal}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Release Project Retention</DialogTitle>
                            <DialogDescription>
                                Set release amount for project <strong>{selectedRetention?.project.name}</strong>.
                            </DialogDescription>
                        </DialogHeader>
                        <form onSubmit={handleReleaseSubmit} className="space-y-4">
                            <div>
                                <label className="text-xs font-bold text-slate-500">Remaining Balance: LKR {selectedRetention?.balanceAmount.toLocaleString()}</label>
                                <div className="flex items-center gap-2 mt-1">
                                    <span className="font-semibold text-slate-500">LKR</span>
                                    <Input 
                                        type="number" 
                                        required 
                                        value={releaseAmount} 
                                        onChange={e => setReleaseAmount(Number(e.target.value))} 
                                        max={selectedRetention?.balanceAmount}
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-500">Remarks / Approval justification</label>
                                <Input 
                                    value={remarks} 
                                    onChange={e => setRemarks(e.target.value)} 
                                    placeholder="e.g. Defect liability period completed successfully"
                                />
                            </div>
                            <DialogFooter>
                                <Button type="button" variant="outline" onClick={() => setShowReleaseModal(false)}>Cancel</Button>
                                <Button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white">Confirm Release</Button>
                            </DialogFooter>
                        </form>
                    </DialogContent>
                </Dialog>

            </main>
        </div>
    );
}

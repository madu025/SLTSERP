"use client";

import React, { useEffect, useState, useMemo, useCallback, Suspense } from 'react';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Calculator, RefreshCw, Save, Check, MapPin, Search, AlertCircle, CheckCircle2, XCircle, FileText } from 'lucide-react';
import RoleGuard from '@/components/RoleGuard';

interface AmendmentRequest {
    id: string;
    invoiceId: string;
    originalAmount: number;
    requestedAmount: number;
    reason: string;
    status: string;
    requestedById: string;
    createdAt: string;
    invoice?: {
        invoiceNumber: string;
        contractor?: { name: string };
    };
    requestedBy?: {
        name: string;
    };
}

interface RateRule {
    id: string;
    workType: string;
    workDescription: string;
    minDistance: number;
    maxDistance: number;
    areaGroup: 'CEN' | 'HK' | 'OTHER';
    rateAmount: number;
    poleType?: string | null;
    poleMethod?: string | null;
    isActive: boolean;
}

interface GroupedWorkRow {
    workDescription: string;
    workType: string;
    cenRule?: RateRule;
    hkRule?: RateRule;
    otherRule?: RateRule;
}

interface ToastNotice {
    type: 'success' | 'error';
    message: string;
}

function SFAuditPricingAuditContent() {
    const [activeTab, setActiveTab] = useState<'matrix' | 'amendments'>('matrix');
    const [requests, setRequests] = useState<AmendmentRequest[]>([]);
    const [rules, setRules] = useState<RateRule[]>([]);
    const [loading, setLoading] = useState(true);
    const [rulesLoading, setRulesLoading] = useState(true);
    const [savingId, setSavingId] = useState<string | null>(null);
    const [savedId, setSavedId] = useState<string | null>(null);
    const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
    
    // Filtering states
    const [ruleSearch, setRuleSearch] = useState('');
    const [typeFilter, setTypeFilter] = useState<'ALL' | 'FTTH' | 'POLE'>('ALL');
    const [amendmentSearch, setAmendmentSearch] = useState('');

    // Rejection Modal state
    const [rejectingRequestId, setRejectingRequestId] = useState<string | null>(null);
    const [rejectionReasonInput, setRejectionReasonInput] = useState('');
    
    // Notification Toast state
    const [toastNotice, setToastNotice] = useState<ToastNotice | null>(null);

    const showToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
        setToastNotice({ message, type });
        setTimeout(() => setToastNotice(null), 3500);
    }, []);

    const fetchRequests = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/invoices/amendments/pending?_t=${Date.now()}`, {
                cache: 'no-store',
                headers: { 'Pragma': 'no-cache', 'Cache-Control': 'no-cache' }
            });
            if (res.ok) {
                const data = await res.json();
                setRequests(data.data?.requests || data.requests || []);
            }
        } catch (e) {
            console.error(e);
            showToast('Failed to load pricing audit amendment requests', 'error');
        } finally {
            setLoading(false);
        }
    }, [showToast]);

    const fetchRules = useCallback(async () => {
        setRulesLoading(true);
        try {
            const res = await fetch(`/api/admin/rate-matrix?_t=${Date.now()}`, {
                cache: 'no-store',
                headers: { 'Pragma': 'no-cache', 'Cache-Control': 'no-cache' }
            });
            if (res.ok) {
                const data = await res.json();
                setRules(data.data?.rules || data.rules || []);
            }
        } catch (e) {
            console.error(e);
            showToast('Failed to load contractor rate matrix rules', 'error');
        } finally {
            setRulesLoading(false);
        }
    }, [showToast]);

    const handleApproveAmendment = async (requestId: string) => {
        setActionLoadingId(requestId);
        try {
            const res = await fetch(`/api/invoices/amendments/${requestId}/approve`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: 'APPROVED' })
            });

            if (res.ok) {
                showToast('Invoice amendment approved successfully!', 'success');
                setRequests(prev => prev.filter(r => r.id !== requestId));
            } else {
                const err = await res.json();
                showToast(err.error || 'Failed to approve amendment request', 'error');
            }
        } catch (e) {
            console.error(e);
            showToast('Error approving amendment request', 'error');
        } finally {
            setActionLoadingId(null);
        }
    };

    const handleConfirmReject = async () => {
        if (!rejectingRequestId) return;
        const reason = rejectionReasonInput.trim() || 'Rejected by SF Audit Manager';
        setActionLoadingId(rejectingRequestId);
        try {
            const res = await fetch(`/api/invoices/amendments/${rejectingRequestId}/approve`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: 'REJECTED', rejectionReason: reason })
            });

            if (res.ok) {
                showToast('Amendment request rejected.', 'success');
                setRequests(prev => prev.filter(r => r.id !== rejectingRequestId));
                setRejectingRequestId(null);
                setRejectionReasonInput('');
            } else {
                const err = await res.json();
                showToast(err.error || 'Failed to reject amendment request', 'error');
            }
        } catch (e) {
            console.error(e);
            showToast('Error rejecting amendment request', 'error');
        } finally {
            setActionLoadingId(null);
        }
    };

    useEffect(() => {
        fetchRequests();
        fetchRules();
    }, [fetchRequests, fetchRules]);

    // Filtered Rules computation
    const filteredRules = useMemo(() => {
        return rules.filter(r => {
            const matchesSearch = r.workDescription.toLowerCase().includes(ruleSearch.toLowerCase());
            const matchesType = typeFilter === 'ALL' || r.workType === typeFilter;
            return matchesSearch && matchesType;
        });
    }, [rules, ruleSearch, typeFilter]);

    // Grouping rules into rows
    const groupedRows = useMemo(() => {
        const map = new Map<string, GroupedWorkRow>();
        for (const r of filteredRules) {
            let entry = map.get(r.workDescription);
            if (!entry) {
                entry = { workDescription: r.workDescription, workType: r.workType };
                map.set(r.workDescription, entry);
            }
            if (r.areaGroup === 'CEN') entry.cenRule = r;
            if (r.areaGroup === 'HK') entry.hkRule = r;
            if (r.areaGroup === 'OTHER') entry.otherRule = r;
        }
        return Array.from(map.values());
    }, [filteredRules]);

    // Filtered Amendment Requests
    const filteredRequests = useMemo(() => {
        return requests.filter(r => {
            const invNum = r.invoice?.invoiceNumber || '';
            const contractor = r.invoice?.contractor?.name || '';
            const q = amendmentSearch.toLowerCase();
            return invNum.toLowerCase().includes(q) || contractor.toLowerCase().includes(q) || r.reason.toLowerCase().includes(q);
        });
    }, [requests, amendmentSearch]);

    const handleRateChange = (ruleId: string, newAmount: number) => {
        setRules(prev => prev.map(r => r.id === ruleId ? { ...r, rateAmount: newAmount } : r));
    };

    const handleSaveRate = async (ruleId: string, rateAmount: number) => {
        setSavingId(ruleId);
        try {
            const res = await fetch('/api/admin/rate-matrix', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: ruleId, rateAmount })
            });

            if (res.ok) {
                setSavedId(ruleId);
                showToast('Rate amount updated successfully', 'success');
                setTimeout(() => setSavedId(null), 2000);
            } else {
                showToast('Failed to update rate amount', 'error');
            }
        } catch (e) {
            console.error(e);
            showToast('Error updating rate', 'error');
        } finally {
            setSavingId(null);
        }
    };

    const formatCurrency = (amt: number) => {
        return new Intl.NumberFormat('en-LK', { style: 'currency', currency: 'LKR' }).format(amt);
    };

    return (
        <RoleGuard allowedRoles={['SF_AUDIT', 'SF_AUDIT_OFFICER', 'SF_AUDIT_MANAGER', 'ADMIN', 'SUPER_ADMIN', 'FINANCE_MANAGER']}>
            <div className="flex h-screen bg-background text-foreground overflow-hidden font-sans">
                <Sidebar />
                <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
                    <Header />

                    <main className="flex-1 p-6 max-w-7xl mx-auto w-full space-y-6">
                        {/* Toast Alert */}
                        {toastNotice && (
                            <div className={`fixed top-5 right-5 z-50 flex items-center gap-2 px-4 py-3 rounded-lg shadow-xl border text-xs font-bold transition-all animate-in slide-in-from-top-2 ${toastNotice.type === 'success' ? 'bg-emerald-50 border-emerald-300 text-emerald-800 dark:bg-emerald-950 dark:border-emerald-700 dark:text-emerald-300' : 'bg-rose-50 border-rose-300 text-rose-800 dark:bg-rose-950 dark:border-rose-700 dark:text-rose-300'}`}>
                                {toastNotice.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" /> : <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400" />}
                                {toastNotice.message}
                            </div>
                        )}

                        <div className="flex flex-wrap items-center justify-between gap-4">
                            <div>
                                <div className="flex items-center gap-2 mb-1">
                                    <Badge variant="default" className="font-mono text-[10px] uppercase tracking-wider px-2 py-0.5">
                                        SF AUDIT DIVISION
                                    </Badge>
                                    <Badge variant="outline" className="text-[10px] px-2 py-0.5">
                                        PRICING AUDIT & RATE MATRIX
                                    </Badge>
                                </div>
                                <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
                                    <Calculator className="w-6 h-6 text-primary" />
                                    Contractor Rate Matrix & Pricing Audit
                                </h1>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                    Manage contractor rate matrix rules and review invoice amount amendment audit requests.
                                </p>
                            </div>

                            <div className="flex items-center gap-2">
                                <div className="bg-muted p-1 rounded-lg border border-border flex gap-1 text-xs">
                                    <button
                                        onClick={() => setActiveTab('matrix')}
                                        className={`px-3 py-1.5 rounded-md font-semibold transition-colors ${activeTab === 'matrix' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                                    >
                                        Rate Matrix ({rules.length})
                                    </button>
                                    <button
                                        onClick={() => setActiveTab('amendments')}
                                        className={`px-3 py-1.5 rounded-md font-semibold transition-colors ${activeTab === 'amendments' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                                    >
                                        Pending Amendments ({requests.length})
                                    </button>
                                </div>
                                <Button onClick={activeTab === 'matrix' ? fetchRules : fetchRequests} variant="outline" className="gap-2 text-xs h-9">
                                    <RefreshCw className={`w-3.5 h-3.5 ${loading || rulesLoading ? 'animate-spin' : ''}`} /> Refresh
                                </Button>
                            </div>
                        </div>

                        {/* TAB 1: ACTIVE RATE MATRIX */}
                        {activeTab === 'matrix' && (
                            <Card className="bg-card border-border/80 text-card-foreground p-6 shadow-sm space-y-4 rounded-xl">
                                <div className="flex flex-wrap items-center justify-between border-b border-border pb-4 gap-3">
                                    <div>
                                        <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
                                            <MapPin className="w-4 h-4 text-primary" /> Contractor Payout Rate Matrix
                                        </h2>
                                        <p className="text-xs text-muted-foreground mt-0.5">
                                            Configure active contractor rates by distance bracket and regional codes (R-MD / R-CEN, R-HK, OTHER).
                                        </p>
                                    </div>
                                    
                                    <div className="flex items-center gap-2">
                                        <div className="relative">
                                            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
                                            <Input
                                                type="text"
                                                placeholder="Search work description..."
                                                value={ruleSearch}
                                                onChange={(e) => setRuleSearch(e.target.value)}
                                                className="pl-8 bg-background border-input text-xs h-8 w-52 text-foreground focus:border-primary"
                                            />
                                        </div>
                                        <div className="bg-muted border border-border rounded-md p-0.5 flex gap-1 text-[11px]">
                                            {(['ALL', 'FTTH', 'POLE'] as const).map(t => (
                                                <button
                                                    key={t}
                                                    onClick={() => setTypeFilter(t)}
                                                    className={`px-2.5 py-1 rounded font-semibold transition-colors ${typeFilter === t ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                                                >
                                                    {t}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                <div className="overflow-x-auto border border-border rounded-lg">
                                    <table className="w-full text-left text-xs border-collapse">
                                        <thead className="bg-muted/70 text-muted-foreground font-semibold tracking-wider uppercase text-[10px]">
                                            <tr>
                                                <th className="p-3 border-r border-border/60">Work Description / Distance Bracket</th>
                                                <th className="p-3 border-r border-border/60 w-44 text-center text-primary font-bold">R-MD / R-CEN</th>
                                                <th className="p-3 border-r border-border/60 w-44 text-center text-primary font-bold">R-HK</th>
                                                <th className="p-3 w-44 text-center text-primary font-bold">OTHER</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-border/60 bg-card">
                                            {rulesLoading ? (
                                                <tr>
                                                    <td colSpan={4} className="py-12 text-center text-muted-foreground font-medium">
                                                        Loading contractor rate matrix...
                                                    </td>
                                                </tr>
                                            ) : groupedRows.length === 0 ? (
                                                <tr>
                                                    <td colSpan={4} className="py-8 text-center text-muted-foreground">
                                                        No rate rules match the search criteria.
                                                    </td>
                                                </tr>
                                            ) : groupedRows.map((row, idx) => (
                                                <tr key={idx} className="hover:bg-muted/30 font-mono transition-colors">
                                                    <td className="p-3 border-r border-border/60 font-bold text-foreground font-sans">
                                                        <div className="flex items-center gap-2">
                                                            <Badge variant="secondary" className="text-[9px] font-mono px-1.5 py-0">
                                                                {row.workType}
                                                            </Badge>
                                                            <span>{row.workDescription}</span>
                                                        </div>
                                                    </td>

                                                    {/* CEN */}
                                                    <td className="p-2 border-r border-border/60 text-center">
                                                        {row.cenRule ? (
                                                            <div className="flex items-center justify-center gap-1">
                                                                <span className="text-[10px] text-muted-foreground">Rs.</span>
                                                                <Input
                                                                    type="number"
                                                                    value={row.cenRule.rateAmount}
                                                                    onChange={(e) => handleRateChange(row.cenRule!.id, parseFloat(e.target.value) || 0)}
                                                                    className="w-24 bg-background border-input text-foreground font-mono font-bold text-xs h-7 text-right focus:border-primary"
                                                                />
                                                                <Button
                                                                    size="sm"
                                                                    variant="default"
                                                                    onClick={() => handleSaveRate(row.cenRule!.id, row.cenRule!.rateAmount)}
                                                                    disabled={savingId === row.cenRule.id}
                                                                    className="h-7 w-7 p-0 shadow-sm"
                                                                >
                                                                    {savedId === row.cenRule.id ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Save className="w-3.5 h-3.5" />}
                                                                </Button>
                                                            </div>
                                                        ) : <span className="text-muted-foreground/50">-</span>}
                                                    </td>

                                                    {/* HK */}
                                                    <td className="p-2 border-r border-border/60 text-center">
                                                        {row.hkRule ? (
                                                            <div className="flex items-center justify-center gap-1">
                                                                <span className="text-[10px] text-muted-foreground">Rs.</span>
                                                                <Input
                                                                    type="number"
                                                                    value={row.hkRule.rateAmount}
                                                                    onChange={(e) => handleRateChange(row.hkRule!.id, parseFloat(e.target.value) || 0)}
                                                                    className="w-24 bg-background border-input text-foreground font-mono font-bold text-xs h-7 text-right focus:border-primary"
                                                                />
                                                                <Button
                                                                    size="sm"
                                                                    variant="default"
                                                                    onClick={() => handleSaveRate(row.hkRule!.id, row.hkRule!.rateAmount)}
                                                                    disabled={savingId === row.hkRule.id}
                                                                    className="h-7 w-7 p-0 shadow-sm"
                                                                >
                                                                    {savedId === row.hkRule.id ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Save className="w-3.5 h-3.5" />}
                                                                </Button>
                                                            </div>
                                                        ) : <span className="text-muted-foreground/50">-</span>}
                                                    </td>

                                                    {/* OTHER */}
                                                    <td className="p-2 text-center">
                                                        {row.otherRule ? (
                                                            <div className="flex items-center justify-center gap-1">
                                                                <span className="text-[10px] text-muted-foreground">Rs.</span>
                                                                <Input
                                                                    type="number"
                                                                    value={row.otherRule.rateAmount}
                                                                    onChange={(e) => handleRateChange(row.otherRule!.id, parseFloat(e.target.value) || 0)}
                                                                    className="w-24 bg-background border-input text-foreground font-mono font-bold text-xs h-7 text-right focus:border-primary"
                                                                />
                                                                <Button
                                                                    size="sm"
                                                                    variant="default"
                                                                    onClick={() => handleSaveRate(row.otherRule!.id, row.otherRule!.rateAmount)}
                                                                    disabled={savingId === row.otherRule.id}
                                                                    className="h-7 w-7 p-0 shadow-sm"
                                                                >
                                                                    {savedId === row.otherRule.id ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Save className="w-3.5 h-3.5" />}
                                                                </Button>
                                                            </div>
                                                        ) : <span className="text-muted-foreground/50">-</span>}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </Card>
                        )}

                        {/* TAB 2: INVOICE AMOUNT AMENDMENTS */}
                        {activeTab === 'amendments' && (
                            <Card className="bg-card border-border/80 text-card-foreground rounded-xl overflow-hidden shadow-sm">
                                <div className="p-4 border-b border-border bg-muted/30 flex items-center justify-between flex-wrap gap-3">
                                    <div>
                                        <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
                                            <FileText className="w-4 h-4 text-primary" /> Invoice Pricing Amendment Audit Queue
                                        </h2>
                                        <span className="text-xs text-muted-foreground mt-0.5">{filteredRequests.length} Pending Amendment Audit Requests</span>
                                    </div>
                                    <div className="relative">
                                        <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
                                        <Input
                                            type="text"
                                            placeholder="Filter by invoice #, contractor..."
                                            value={amendmentSearch}
                                            onChange={(e) => setAmendmentSearch(e.target.value)}
                                            className="pl-8 bg-background border-input text-xs h-8 w-64 text-foreground focus:border-primary"
                                        />
                                    </div>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left text-xs border-collapse">
                                        <thead className="bg-muted/70 text-muted-foreground font-semibold tracking-wider uppercase text-[10px]">
                                            <tr>
                                                <th className="py-3 px-4">Invoice #</th>
                                                <th className="py-3 px-4">Contractor</th>
                                                <th className="py-3 px-4 text-right">System Calculated</th>
                                                <th className="py-3 px-4 text-right text-primary font-bold">Audited Amount</th>
                                                <th className="py-3 px-4">Audit Justification</th>
                                                <th className="py-3 px-4">Officer</th>
                                                <th className="py-3 px-4 text-center">Status</th>
                                                <th className="py-3 px-4 text-center">Audit Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-border/60 bg-card">
                                            {loading ? (
                                                <tr>
                                                    <td colSpan={8} className="py-12 text-center text-muted-foreground font-medium">
                                                        Loading pricing audit queue...
                                                    </td>
                                                </tr>
                                            ) : filteredRequests.length === 0 ? (
                                                <tr>
                                                    <td colSpan={8} className="py-12 text-center text-muted-foreground">
                                                        No pending contractor invoice pricing amendments requiring audit review.
                                                    </td>
                                                </tr>
                                            ) : (
                                                filteredRequests.map((req) => (
                                                    <tr key={req.id} className="hover:bg-muted/30 transition-colors">
                                                        <td className="py-3 px-4 font-mono font-bold text-foreground">{req.invoice?.invoiceNumber || 'INV-REF'}</td>
                                                        <td className="py-3 px-4 font-medium text-foreground">{req.invoice?.contractor?.name || 'Contractor'}</td>
                                                        <td className="py-3 px-4 text-right font-mono text-muted-foreground line-through">{formatCurrency(req.originalAmount)}</td>
                                                        <td className="py-3 px-4 text-right font-mono font-black text-primary text-sm">{formatCurrency(req.requestedAmount)}</td>
                                                        <td className="py-3 px-4 text-foreground max-w-xs truncate">{req.reason}</td>
                                                        <td className="py-3 px-4 font-mono text-muted-foreground">{req.requestedBy?.name || 'SF Auditor'}</td>
                                                        <td className="py-3 px-4 text-center">
                                                            <Badge variant="secondary" className="text-[9px] px-2 py-0.5 font-mono">
                                                                {req.status}
                                                            </Badge>
                                                        </td>
                                                        <td className="py-3 px-4 text-center">
                                                            <div className="flex items-center justify-center gap-1.5">
                                                                <Button
                                                                    size="sm"
                                                                    onClick={() => handleApproveAmendment(req.id)}
                                                                    disabled={actionLoadingId === req.id}
                                                                    className="h-7 px-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold shadow-sm"
                                                                >
                                                                    Approve
                                                                </Button>
                                                                <Button
                                                                    size="sm"
                                                                    variant="outline"
                                                                    onClick={() => {
                                                                        setRejectingRequestId(req.id);
                                                                        setRejectionReasonInput('');
                                                                    }}
                                                                    disabled={actionLoadingId === req.id}
                                                                    className="h-7 px-2.5 border-destructive/40 text-destructive hover:bg-destructive/10 text-[11px] font-bold"
                                                                >
                                                                    Reject
                                                                </Button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </Card>
                        )}

                        {/* Rejection Reason Modal */}
                        <Dialog open={!!rejectingRequestId} onOpenChange={(open) => !open && setRejectingRequestId(null)}>
                            <DialogContent className="bg-card border-border text-card-foreground">
                                <DialogHeader>
                                    <DialogTitle className="text-base font-bold text-destructive flex items-center gap-2">
                                        <XCircle className="w-5 h-5 text-destructive" /> Reject Invoice Amendment Request
                                    </DialogTitle>
                                </DialogHeader>
                                <div className="space-y-3 py-2 text-xs">
                                    <p className="text-muted-foreground">
                                        Please provide an audit justification or reason for rejecting this contractor invoice pricing amendment:
                                    </p>
                                    <Textarea
                                        value={rejectionReasonInput}
                                        onChange={(e) => setRejectionReasonInput(e.target.value)}
                                        placeholder="Reason for audit rejection..."
                                        className="bg-background border-input text-foreground text-xs min-h-[90px] focus:border-primary"
                                    />
                                </div>
                                <DialogFooter className="gap-2">
                                    <Button variant="outline" onClick={() => setRejectingRequestId(null)} className="text-xs">
                                        Cancel
                                    </Button>
                                    <Button onClick={handleConfirmReject} variant="destructive" className="text-xs font-bold">
                                        Confirm Rejection
                                    </Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>

                    </main>
                </div>
            </div>
        </RoleGuard>
    );
}

export default function SFAuditPricingAuditPage() {
    return (
        <Suspense fallback={
            <div className="flex h-screen bg-background text-foreground items-center justify-center font-sans">
                <RefreshCw className="w-6 h-6 animate-spin text-primary" />
            </div>
        }>
            <SFAuditPricingAuditContent />
        </Suspense>
    );
}

"use client";

import React, { useEffect, useState } from 'react';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { ShieldCheck, Check, X, AlertTriangle, RefreshCw } from 'lucide-react';
import RoleGuard from '@/components/RoleGuard';

interface AmendmentRequest {
    id: string;
    invoiceId: string;
    originalAmount: number;
    requestedAmount: number;
    originalAmountA: number;
    requestedAmountA: number;
    originalAmountB: number;
    requestedAmountB: number;
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
        email: string;
    };
}

interface MappingColumn {
    key: string;
    label: string;
    description: string;
    terms: string[];
}

export default function SFAuditGovernancePage() {
    const [activeTab, setActiveTab] = useState<'pending' | 'mapping'>('pending');
    const [requests, setRequests] = useState<AmendmentRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
    const [selectedReq, setSelectedReq] = useState<AmendmentRequest | null>(null);
    const [rejectionReason, setRejectionReason] = useState('');

    // Material Mapping State
    const [mappingColumns, setMappingColumns] = useState<MappingColumn[]>([]);
    const [mappingLoading, setMappingLoading] = useState(false);
    const [savingMapping, setSavingMapping] = useState(false);
    const [newColLabel, setNewColLabel] = useState('');
    const [newColDesc, setNewColDesc] = useState('');

    const fetchRequests = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/invoices/amendments/pending');
            if (res.ok) {
                const data = await res.json();
                setRequests(data.requests || []);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const fetchMappingConfig = async () => {
        setMappingLoading(true);
        try {
            const res = await fetch('/api/finance/sf-audit/mapping-config');
            if (res.ok) {
                const data = await res.json();
                setMappingColumns(data.columns || []);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setMappingLoading(false);
        }
    };

    useEffect(() => {
        fetchRequests();
        fetchMappingConfig();
    }, []);

    const handleSaveMapping = async () => {
        setSavingMapping(true);
        try {
            const res = await fetch('/api/finance/sf-audit/mapping-config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ columns: mappingColumns })
            });
            if (res.ok) {
                alert('SF Audit Material Header & Column Mapping saved successfully!');
            } else {
                const err = await res.json();
                alert(err.error || 'Failed to save mapping');
            }
        } catch (e) {
            console.error(e);
            alert('Error saving mapping config');
        } finally {
            setSavingMapping(false);
        }
    };

    const handleAddTerm = (colIdx: number, newTerm: string) => {
        if (!newTerm.trim()) return;
        const updated = [...mappingColumns];
        const termUpper = newTerm.trim().toUpperCase();
        if (!updated[colIdx].terms.includes(termUpper)) {
            updated[colIdx].terms.push(termUpper);
            setMappingColumns(updated);
        }
    };

    const handleRemoveTerm = (colIdx: number, termIdx: number) => {
        const updated = [...mappingColumns];
        updated[colIdx].terms.splice(termIdx, 1);
        setMappingColumns(updated);
    };

    const handleAddColumn = () => {
        if (!newColLabel.trim()) return;
        const key = newColLabel.trim().toUpperCase().replace(/\s+/g, '-');
        setMappingColumns([
            ...mappingColumns,
            { key, label: newColLabel.trim().toUpperCase(), description: newColDesc.trim() || newColLabel.trim(), terms: [key] }
        ]);
        setNewColLabel('');
        setNewColDesc('');
    };

    const handleApprove = async (id: string) => {
        setActionLoading(id);
        try {
            const res = await fetch(`/api/invoices/amendments/${id}/approve`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: 'APPROVED' })
            });

            if (res.ok) {
                alert('Amendment Request APPROVED. Invoice amount updated successfully.');
                fetchRequests();
            } else {
                const err = await res.json();
                alert(err.error || 'Failed to approve request');
            }
        } catch (e) {
            console.error(e);
            alert('Error processing approval');
        } finally {
            setActionLoading(null);
        }
    };

    const handleRejectSubmit = async () => {
        if (!selectedReq) return;
        setActionLoading(selectedReq.id);
        try {
            const res = await fetch(`/api/invoices/amendments/${selectedReq.id}/approve`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: 'REJECTED', rejectionReason })
            });

            if (res.ok) {
                alert('Amendment Request REJECTED.');
                setRejectDialogOpen(false);
                fetchRequests();
            } else {
                const err = await res.json();
                alert(err.error || 'Failed to reject request');
            }
        } catch (e) {
            console.error(e);
            alert('Error processing rejection');
        } finally {
            setActionLoading(null);
        }
    };

    const formatCurrency = (amt: number) => {
        return new Intl.NumberFormat('en-LK', { style: 'currency', currency: 'LKR' }).format(amt);
    };

    return (
        <RoleGuard allowedRoles={['SF_AUDIT', 'SF_AUDIT_OFFICER', 'SF_AUDIT_MANAGER', 'ADMIN', 'SUPER_ADMIN', 'FINANCE_MANAGER']}>
            <div className="flex h-screen bg-slate-900 text-slate-100 overflow-hidden font-sans">
                <Sidebar />
                <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
                    <Header />

                    <main className="flex-1 p-6 max-w-7xl mx-auto w-full">
                        {/* Header */}
                        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
                            <div>
                                <div className="flex items-center gap-2 mb-1">
                                    <Badge className="bg-purple-600 text-white font-mono text-[10px] uppercase">
                                        STANDALONE DIVISION
                                    </Badge>
                                    <Badge variant="outline" className="border-purple-700 text-purple-300 text-[10px]">
                                        SPECIAL FORENSIC AUDIT GOVERNANCE
                                    </Badge>
                                </div>
                                <h1 className="text-2xl font-black tracking-tight text-white flex items-center gap-2">
                                    <ShieldCheck className="w-6 h-6 text-purple-400" />
                                    SF Audit Invoice Pricing Pre-Approval & Governance
                                </h1>
                                <p className="text-xs text-slate-400">
                                    Independent SF Audit Division for pre-approving contractor invoice pricing amendments and managing material header mapping rules.
                                </p>
                            </div>

                            <div className="flex items-center gap-2">
                                <div className="bg-slate-800 p-1 rounded-lg border border-slate-700 flex gap-1 text-xs">
                                    <button
                                        onClick={() => setActiveTab('pending')}
                                        className={`px-3 py-1.5 rounded-md font-bold transition-colors ${activeTab === 'pending' ? 'bg-purple-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
                                    >
                                        Pending Pre-Approvals ({requests.length})
                                    </button>
                                    <button
                                        onClick={() => setActiveTab('mapping')}
                                        className={`px-3 py-1.5 rounded-md font-bold transition-colors ${activeTab === 'mapping' ? 'bg-purple-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
                                    >
                                        Header & Material Column Mapping Config
                                    </button>
                                </div>
                                <Button onClick={activeTab === 'pending' ? fetchRequests : fetchMappingConfig} variant="outline" className="border-slate-700 text-slate-300 hover:bg-slate-800 gap-2 text-xs">
                                    <RefreshCw className={`w-3.5 h-3.5 ${loading || mappingLoading ? 'animate-spin' : ''}`} /> Refresh
                                </Button>
                            </div>
                        </div>

                        {/* TAB 1: PENDING PRE-APPROVALS */}
                        {activeTab === 'pending' && (
                            <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden shadow-2xl">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left text-xs border-collapse">
                                        <thead className="bg-slate-900 text-slate-400 font-bold uppercase tracking-wider text-[11px] border-b border-slate-700">
                                            <tr>
                                                <th className="py-3 px-4">Invoice #</th>
                                                <th className="py-3 px-4">Contractor</th>
                                                <th className="py-3 px-4 text-right">Original Amount</th>
                                                <th className="py-3 px-4 text-right text-purple-400">Requested Amount</th>
                                                <th className="py-3 px-4">Audit Reason</th>
                                                <th className="py-3 px-4">Requested By</th>
                                                <th className="py-3 px-4 text-center">Status</th>
                                                <th className="py-3 px-4 text-right pr-6">Action</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-700/60 bg-slate-800/50">
                                            {loading ? (
                                                <tr>
                                                    <td colSpan={8} className="py-12 text-center text-slate-400 font-medium">
                                                        <div className="h-6 w-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                                                        Loading SF Audit Requests...
                                                    </td>
                                                </tr>
                                            ) : requests.length === 0 ? (
                                                <tr>
                                                    <td colSpan={8} className="py-12 text-center text-slate-400">
                                                        No pending invoice amount amendment requests.
                                                    </td>
                                                </tr>
                                            ) : (
                                                requests.map((req) => (
                                                    <tr key={req.id} className="hover:bg-slate-700/40 transition-colors">
                                                        <td className="py-3 px-4 font-mono font-bold text-white">
                                                            {req.invoice?.invoiceNumber || 'INV-REF'}
                                                        </td>
                                                        <td className="py-3 px-4 font-medium text-slate-300">
                                                            {req.invoice?.contractor?.name || 'Contractor'}
                                                        </td>
                                                        <td className="py-3 px-4 text-right font-mono text-slate-400 line-through">
                                                            {formatCurrency(req.originalAmount)}
                                                        </td>
                                                        <td className="py-3 px-4 text-right font-mono font-black text-purple-300 text-sm">
                                                            {formatCurrency(req.requestedAmount)}
                                                        </td>
                                                        <td className="py-3 px-4 font-medium text-slate-300 max-w-xs truncate" title={req.reason}>
                                                            {req.reason}
                                                        </td>
                                                        <td className="py-3 px-4 text-slate-400 font-mono">
                                                            {req.requestedBy?.name || 'SF Audit Officer'}
                                                        </td>
                                                        <td className="py-3 px-4 text-center">
                                                            <Badge className="bg-purple-950 text-purple-300 border-purple-800 font-mono text-[9px] px-2 py-0.5">
                                                                {req.status}
                                                            </Badge>
                                                        </td>
                                                        <td className="py-3 px-4 text-right pr-6">
                                                            <div className="flex items-center justify-end gap-2">
                                                                <Button
                                                                    size="sm"
                                                                    onClick={() => handleApprove(req.id)}
                                                                    disabled={actionLoading === req.id}
                                                                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs gap-1 h-7"
                                                                >
                                                                    <Check className="w-3.5 h-3.5" /> Approve
                                                                </Button>
                                                                <Button
                                                                    size="sm"
                                                                    variant="outline"
                                                                    onClick={() => { setSelectedReq(req); setRejectDialogOpen(true); }}
                                                                    disabled={actionLoading === req.id}
                                                                    className="border-red-900 text-red-400 hover:bg-red-950 text-xs gap-1 h-7"
                                                                >
                                                                    <X className="w-3.5 h-3.5" /> Reject
                                                                </Button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {/* TAB 2: HEADER & MATERIAL COLUMN MAPPING CONFIGURATOR */}
                        {activeTab === 'mapping' && (
                            <div className="space-y-6">
                                <Card className="bg-slate-800 border-slate-700 text-white p-6 shadow-2xl">
                                    <div className="flex items-center justify-between mb-4 border-b border-slate-700 pb-4">
                                        <div>
                                            <h2 className="text-lg font-bold text-purple-300 flex items-center gap-2">
                                                <ShieldCheck className="w-5 h-5" /> SF Audit Invoice Material Header & Column Mapping Rules
                                            </h2>
                                            <p className="text-xs text-slate-400">
                                                Configure exact column headers and material alias terms matched during contractor invoice generation.
                                            </p>
                                        </div>
                                        <Button
                                            onClick={handleSaveMapping}
                                            disabled={savingMapping}
                                            className="bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs px-4"
                                        >
                                            {savingMapping ? 'Saving Mapping...' : 'Save Mapping Configuration'}
                                        </Button>
                                    </div>

                                    {/* Column Add Bar */}
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6 bg-slate-900/60 p-4 rounded-lg border border-slate-700/80">
                                        <div>
                                            <label className="text-[11px] font-bold text-slate-400 uppercase">New Column Label</label>
                                            <Input
                                                value={newColLabel}
                                                onChange={(e) => setNewColLabel(e.target.value)}
                                                placeholder="e.g. SPLITTER 1:8"
                                                className="bg-slate-800 border-slate-700 text-white text-xs mt-1"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-[11px] font-bold text-slate-400 uppercase">Description</label>
                                            <Input
                                                value={newColDesc}
                                                onChange={(e) => setNewColDesc(e.target.value)}
                                                placeholder="e.g. Optical Splitter 1x8 Unit"
                                                className="bg-slate-800 border-slate-700 text-white text-xs mt-1"
                                            />
                                        </div>
                                        <div className="flex items-end">
                                            <Button onClick={handleAddColumn} className="w-full bg-slate-700 hover:bg-slate-600 text-white text-xs font-bold">
                                                + Add Custom Column Header
                                            </Button>
                                        </div>
                                    </div>

                                    {/* Mappings Table */}
                                    <div className="overflow-x-auto border border-slate-700 rounded-lg">
                                        <table className="w-full text-left text-xs border-collapse">
                                            <thead className="bg-slate-900 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                                                <tr>
                                                    <th className="p-3 border-r border-slate-700 w-32">Column Header</th>
                                                    <th className="p-3 border-r border-slate-700 w-48">Description</th>
                                                    <th className="p-3">Matched i-Shamp Item Aliases & Terms</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-700 bg-slate-800/80">
                                                {mappingColumns.map((col, cIdx) => (
                                                    <tr key={col.key} className="hover:bg-slate-700/30">
                                                        <td className="p-3 border-r border-slate-700 font-mono font-bold text-purple-300">{col.label}</td>
                                                        <td className="p-3 border-r border-slate-700 text-slate-300">{col.description}</td>
                                                        <td className="p-3">
                                                            <div className="flex flex-wrap items-center gap-1.5">
                                                                {col.terms.map((term, tIdx) => (
                                                                    <Badge key={tIdx} variant="secondary" className="bg-slate-900 text-slate-200 border-slate-700 text-[10px] font-mono gap-1">
                                                                        {term}
                                                                        <button onClick={() => handleRemoveTerm(cIdx, tIdx)} className="text-red-400 hover:text-red-300 font-bold ml-1">×</button>
                                                                    </Badge>
                                                                ))}
                                                                <Input
                                                                    onKeyDown={(e) => {
                                                                        if (e.key === 'Enter') {
                                                                            handleAddTerm(cIdx, (e.target as HTMLInputElement).value);
                                                                            (e.target as HTMLInputElement).value = '';
                                                                        }
                                                                    }}
                                                                    placeholder="+ Add alias term & Enter"
                                                                    className="bg-slate-900 border-slate-700 text-white text-[10px] h-6 w-44 inline-block font-mono"
                                                                />
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </Card>
                            </div>
                        )}

                        {/* Rejection Dialog */}
                        <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
                            <DialogContent className="bg-slate-900 border-slate-800 text-white max-w-md font-sans">
                                <DialogHeader>
                                    <DialogTitle className="text-lg font-bold text-red-400 flex items-center gap-2">
                                        <AlertTriangle className="w-5 h-5" /> Reject Amendment Request
                                    </DialogTitle>
                                </DialogHeader>
                                <div className="space-y-4 py-2">
                                    <p className="text-xs text-slate-400">
                                        Please state the reason for rejecting the invoice amount change request for <strong>{selectedReq?.invoice?.invoiceNumber}</strong>.
                                    </p>
                                    <Input
                                        value={rejectionReason}
                                        onChange={(e) => setRejectionReason(e.target.value)}
                                        placeholder="Reason for rejection..."
                                        className="bg-slate-800 border-slate-700 text-white text-xs"
                                    />
                                </div>
                                <DialogFooter>
                                    <Button variant="ghost" onClick={() => setRejectDialogOpen(false)} className="text-slate-400 text-xs">
                                        Cancel
                                    </Button>
                                    <Button onClick={handleRejectSubmit} className="bg-red-600 hover:bg-red-700 text-white font-bold text-xs">
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

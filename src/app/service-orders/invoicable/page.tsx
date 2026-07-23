"use client";

import React, { useState, useEffect, useCallback, Suspense } from 'react';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import RoleGuard from '@/components/RoleGuard';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Receipt, CheckCircle2, ShieldCheck, RefreshCw, AlertCircle, ArrowRight, FileText, Building2 } from 'lucide-react';
import Link from 'next/link';

interface InvoicableSOD {
    id: string;
    soNum: string;
    rtom: string;
    serviceType: string;
    voiceNumber?: string;
    completedDate?: string;
    contractorId?: string;
    contractorName?: string;
    isInvoicable: boolean;
    invoiced: boolean;
    dropWireLength?: number;
    materialUsage?: Array<{ quantity: number; item?: { name: string; code: string } }>;
}

interface ContractorOption {
    id: string;
    name: string;
    registrationNumber?: string;
    invoicableCount: number;
}

interface RawServiceOrderResponse {
    id: string;
    soNum: string;
    rtom: string;
    serviceType?: string;
    voiceNumber?: string;
    completedDate?: string;
    contractorId?: string;
    contractor?: { id?: string; name?: string };
    isInvoicable?: boolean;
    invoiced?: boolean;
    dropWireLength?: number;
}

function InvoicableServiceOrdersContent() {
    const [sods, setSods] = useState<InvoicableSOD[]>([]);
    const [contractors, setContractors] = useState<ContractorOption[]>([]);
    const [selectedContractorId, setSelectedContractorId] = useState<string>('');
    const [loading, setLoading] = useState<boolean>(true);
    const [generating, setGenerating] = useState<boolean>(false);
    const [verifying, setVerifying] = useState<boolean>(false);
    const [notice, setNotice] = useState<{ type: 'success' | 'error'; message: string; link?: string } | null>(null);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/service-orders?status=COMPLETED&limit=200');
            if (res.ok) {
                const json = await res.json();
                const rawItems = (json.data || json.serviceOrders || []) as RawServiceOrderResponse[];
                const list: InvoicableSOD[] = rawItems.map((s) => ({
                    id: s.id,
                    soNum: s.soNum,
                    rtom: s.rtom,
                    serviceType: s.serviceType || 'FTTH',
                    voiceNumber: s.voiceNumber,
                    completedDate: s.completedDate,
                    contractorId: s.contractorId || s.contractor?.id,
                    contractorName: s.contractor?.name || 'Assigned Contractor',
                    isInvoicable: s.isInvoicable ?? true,
                    invoiced: s.invoiced ?? false,
                    dropWireLength: s.dropWireLength || 150
                }));

                const uninvoiced = list.filter(s => !s.invoiced);
                setSods(uninvoiced);

                const contractorMap = new Map<string, { id: string; name: string; count: number }>();
                for (const sod of uninvoiced) {
                    const cId = sod.contractorId || 'c-default';
                    const cName = sod.contractorName || 'Default Contractor';
                    const existing = contractorMap.get(cId);
                    if (existing) {
                        existing.count += 1;
                    } else {
                        contractorMap.set(cId, { id: cId, name: cName, count: 1 });
                    }
                }

                const contractorList = Array.from(contractorMap.values()).map(c => ({
                    id: c.id,
                    name: c.name,
                    invoicableCount: c.count
                }));

                setContractors(contractorList);
                if (contractorList.length > 0 && !selectedContractorId) {
                    setSelectedContractorId(contractorList[0].id);
                }
            }
        } catch (err) {
            console.error(err);
            setNotice({ type: 'error', message: 'Failed to load invoicable service orders' });
        } finally {
            setLoading(false);
        }
    }, [selectedContractorId]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleVerifyCompletedSODs = async () => {
        const targetIds = sods.filter(s => !s.isInvoicable).map(s => s.id);
        if (targetIds.length === 0) {
            setNotice({ type: 'success', message: 'All displayed completed SODs are already verified and invoicable.' });
            return;
        }

        setVerifying(true);
        setNotice(null);

        try {
            const res = await fetch('/api/sod/verify-invoicable', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sodIds: targetIds, notes: 'Batch Engineer Approval Verification' })
            });

            const json = await res.json();
            if (res.ok && json.success) {
                setNotice({ type: 'success', message: `Successfully verified ${json.count} SODs by Engineer / SF Audit!` });
                fetchData();
            } else {
                throw new Error(json.error || 'Failed to verify SODs');
            }
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Failed to verify SODs';
            setNotice({ type: 'error', message: msg });
        } finally {
            setVerifying(false);
        }
    };

    const handleGenerateInvoice = async () => {
        if (!selectedContractorId) {
            setNotice({ type: 'error', message: 'Please select a contractor to generate invoice.' });
            return;
        }

        const contractorSods = sods.filter(s => (s.contractorId === selectedContractorId || selectedContractorId === 'c-default') && s.isInvoicable);
        if (contractorSods.length === 0) {
            setNotice({ type: 'error', message: 'No verified invoicable SODs found for the selected contractor.' });
            return;
        }

        setGenerating(true);
        setNotice(null);

        try {
            const res = await fetch('/api/invoices/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contractorId: selectedContractorId === 'c-default' ? contractorSods[0].contractorId : selectedContractorId,
                    sodIds: contractorSods.map(s => s.id)
                })
            });

            const json = await res.json();
            if (res.ok && json.success && json.invoice) {
                setNotice({
                    type: 'success',
                    message: `Invoice ${json.invoice.invoiceNumber} generated successfully for LKR ${json.invoice.totalAmount.toLocaleString()} (${json.invoice.sodCount} SODs)!`,
                    link: json.invoice.publicUrl
                });
                fetchData();
            } else {
                throw new Error(json.error || 'Failed to generate invoice');
            }
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Failed to generate invoice';
            setNotice({ type: 'error', message: msg });
        } finally {
            setGenerating(false);
        }
    };

    const filteredSods = sods.filter(s => !selectedContractorId || s.contractorId === selectedContractorId || selectedContractorId === 'c-default');

    return (
        <RoleGuard allowedRoles={['SUPER_ADMIN', 'ADMIN', 'OSP_MANAGER', 'AREA_MANAGER', 'FINANCE_MANAGER', 'FIELD_ENGINEER', 'MANAGER']}>
            <div className="flex h-screen bg-slate-50 overflow-hidden">
                <Sidebar />
                <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                    <Header />
                    <main className="flex-1 overflow-y-auto">
                        <div className="p-6 md:p-10 max-w-6xl mx-auto space-y-6">
                            {/* Header */}
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-4">
                                <div>
                                    <div className="flex items-center gap-2 mb-1">
                                        <Badge className="bg-emerald-600 text-white font-mono text-xs">INVOICABLE PIPELINE</Badge>
                                        <Badge variant="outline" className="text-slate-600 border-slate-300">ENGINEER VERIFIED</Badge>
                                    </div>
                                    <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">
                                        Invoicable Service Orders & Invoice Generator
                                    </h1>
                                    <p className="text-sm text-slate-500 mt-1">
                                        Review Engineer-verified SODs and bundle them into official Contractor Monthly Invoices with full Audit Log tracking.
                                    </p>
                                </div>

                                <div className="flex items-center gap-2">
                                    <Button onClick={fetchData} variant="outline" size="sm" className="gap-2">
                                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh List
                                    </Button>
                                </div>
                            </div>

                            {/* Notice Alert */}
                            {notice && (
                                <div className={`p-4 rounded-xl flex items-center justify-between gap-3 text-sm font-medium border ${notice.type === 'success' ? 'bg-emerald-50 text-emerald-900 border-emerald-300' : 'bg-rose-50 text-rose-900 border-rose-300'}`}>
                                    <div className="flex items-center gap-2">
                                        {notice.type === 'success' ? <CheckCircle2 className="w-5 h-5 text-emerald-600" /> : <AlertCircle className="w-5 h-5 text-rose-600" />}
                                        <span>{notice.message}</span>
                                    </div>
                                    {notice.link && (
                                        <Link href={notice.link} target="_blank" className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold gap-1 flex items-center shadow">
                                            View Official Invoice <ArrowRight className="w-3.5 h-3.5" />
                                        </Link>
                                    )}
                                </div>
                            )}

                            {/* Contractor Selection & Action Controls */}
                            <Card className="border border-slate-200 shadow-sm">
                                <CardHeader>
                                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                        <div>
                                            <CardTitle className="text-lg font-bold flex items-center gap-2">
                                                <Building2 className="w-5 h-5 text-blue-600" /> Select Contractor for Billing Batch
                                            </CardTitle>
                                            <CardDescription className="text-xs">
                                                Pick a contractor to bundle their verified completed SODs into an Invoice.
                                            </CardDescription>
                                        </div>

                                        <div className="flex flex-wrap items-center gap-3">
                                            <Select value={selectedContractorId} onValueChange={setSelectedContractorId}>
                                                <SelectTrigger className="w-64 bg-white font-medium text-xs">
                                                    <SelectValue placeholder="Choose Contractor..." />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {contractors.map(c => (
                                                        <SelectItem key={c.id} value={c.id}>
                                                            {c.name} ({c.invoicableCount} SODs)
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>

                                            <Button
                                                onClick={handleVerifyCompletedSODs}
                                                disabled={verifying}
                                                variant="outline"
                                                className="border-blue-300 text-blue-800 hover:bg-blue-50 font-bold gap-2 text-xs"
                                            >
                                                <ShieldCheck className="w-4 h-4 text-blue-600" />
                                                {verifying ? 'Verifying...' : 'Verify Completed SODs'}
                                            </Button>

                                            <Button
                                                onClick={handleGenerateInvoice}
                                                disabled={generating || filteredSods.length === 0}
                                                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold gap-2 text-xs px-5 shadow"
                                            >
                                                <Receipt className="w-4 h-4" />
                                                {generating ? 'Generating Invoice...' : 'Generate Monthly Invoice'}
                                            </Button>
                                        </div>
                                    </div>
                                </CardHeader>
                            </Card>

                            {/* Invoicable SOD Table */}
                            <Card className="border border-slate-200 shadow-sm">
                                <CardHeader className="pb-2">
                                    <div className="flex items-center justify-between">
                                        <CardTitle className="text-base font-bold flex items-center gap-2">
                                            <FileText className="w-4 h-4 text-slate-600" /> Invoicable SOD Queue ({filteredSods.length})
                                        </CardTitle>
                                        <Badge className="bg-slate-100 text-slate-800 font-mono text-xs border border-slate-300">
                                            {filteredSods.filter(s => s.isInvoicable).length} Verified for Invoice
                                        </Badge>
                                    </div>
                                </CardHeader>

                                <CardContent className="p-0">
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-xs text-left border-collapse">
                                            <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 uppercase font-bold">
                                                <tr>
                                                    <th className="p-3">SO Number</th>
                                                    <th className="p-3">RTOM</th>
                                                    <th className="p-3">Service Type</th>
                                                    <th className="p-3">Contractor</th>
                                                    <th className="p-3">Drop Cable</th>
                                                    <th className="p-3">Audit / Engineer Status</th>
                                                    <th className="p-3">Action</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-200">
                                                {loading ? (
                                                    <tr>
                                                        <td colSpan={7} className="p-8 text-center text-slate-500 font-medium">
                                                            Loading invoicable service orders...
                                                        </td>
                                                    </tr>
                                                ) : filteredSods.length === 0 ? (
                                                    <tr>
                                                        <td colSpan={7} className="p-8 text-center text-slate-500 font-medium">
                                                            No uninvoiced SODs found. Perform Engineer verification to add SODs to this billing queue.
                                                        </td>
                                                    </tr>
                                                ) : (
                                                    filteredSods.map((sod) => (
                                                        <tr key={sod.id} className="hover:bg-slate-50/80 transition-colors">
                                                            <td className="p-3 font-mono font-bold text-slate-900">{sod.soNum}</td>
                                                            <td className="p-3 font-bold text-blue-700">{sod.rtom}</td>
                                                            <td className="p-3 font-medium text-slate-700">{sod.serviceType}</td>
                                                            <td className="p-3 font-medium text-slate-800">{sod.contractorName}</td>
                                                            <td className="p-3 font-mono">{sod.dropWireLength} m</td>
                                                            <td className="p-3">
                                                                {sod.isInvoicable ? (
                                                                    <Badge className="bg-emerald-100 text-emerald-800 border border-emerald-300 font-mono text-[10px] gap-1">
                                                                        <ShieldCheck className="w-3 h-3 text-emerald-600" /> INVOICABLE & VERIFIED
                                                                    </Badge>
                                                                ) : (
                                                                    <Badge className="bg-amber-100 text-amber-800 border border-amber-300 font-mono text-[10px] gap-1">
                                                                        <AlertCircle className="w-3 h-3 text-amber-600" /> PENDING ENGINEER APPROVAL
                                                                    </Badge>
                                                                )}
                                                            </td>
                                                            <td className="p-3">
                                                                <Button size="sm" variant="ghost" className="h-7 text-xs text-blue-600 hover:text-blue-800 hover:bg-blue-50 font-semibold" asChild>
                                                                    <Link href={`/service-orders?search=${sod.soNum}`}>
                                                                        View SOD Details
                                                                    </Link>
                                                                </Button>
                                                            </td>
                                                        </tr>
                                                    ))
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    </main>
                </div>
            </div>
        </RoleGuard>
    );
}

export default function InvoicableServiceOrdersPage() {
    return (
        <Suspense fallback={
            <div className="flex h-screen bg-slate-50 items-center justify-center font-sans">
                <RefreshCw className="w-6 h-6 animate-spin text-blue-600" />
            </div>
        }>
            <InvoicableServiceOrdersContent />
        </Suspense>
    );
}

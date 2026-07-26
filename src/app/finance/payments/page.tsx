"use client";

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Search, Plus, Trash2, Edit2, ShieldAlert, CheckCircle, FileText, XCircle, Landmark, ExternalLink, Printer } from "lucide-react";
import { toast } from 'sonner';

interface Project {
    id: string;
    projectCode: string;
    name: string;
}

interface ProjectInvoice {
    id: string;
    invoiceNumber: string;
    title: string;
    totalAmount: number;
}

interface PaymentVoucher {
    id: string;
    pvNumber: string;
    projectId: string;
    title: string;
    description: string | null;
    status: string;
    type: string;
    payeeName: string;
    payeeId: string | null;
    invoiceId: string | null;
    amount: number;
    paymentDate: string | null;
    paymentMethod: string | null;
    bankName: string | null;
    bankBranch: string | null;
    accountNumber: string | null;
    chequeNumber: string | null;
    referenceNumber: string | null;
    taxWithheld: number;
    netAmount: number;
    retentionAmount: number;
    notes: string | null;
    createdAt: string;
    project: {
        name: string;
        projectCode: string;
    };
    invoice: {
        invoiceNumber: string;
        status: string;
    } | null;
}

export default function PaymentVoucherManagementPage() {
    const queryClient = useQueryClient();
    const [searchTerm, setSearchTerm] = useState("");
    const [statusFilter, setStatusFilter] = useState("ALL");
    
    // Dialog / Modal states
    const [showFormModal, setShowFormModal] = useState(false);
    const [showViewModal, setShowViewModal] = useState(false);
    const [showRejectModal, setShowRejectModal] = useState(false);
    const [selectedPV, setSelectedPV] = useState<PaymentVoucher | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<PaymentVoucher | null>(null);
    
    // Form Inputs
    const [formData, setFormData] = useState({
        projectId: '',
        title: '',
        description: '',
        type: 'CONTRACTOR',
        payeeName: '',
        invoiceId: '',
        amount: 0,
        taxWithheld: 0,
        retentionAmount: 0,
        paymentMethod: 'BANK_TRANSFER',
        bankName: '',
        bankBranch: '',
        accountNumber: '',
        chequeNumber: '',
        referenceNumber: '',
        notes: ''
    });

    const [rejectionReason, setRejectionReason] = useState("");

    // --- QUERIES ---
    const { data: vouchers = [], isLoading: vouchersLoading } = useQuery<PaymentVoucher[]>({
        queryKey: ["payment-vouchers", statusFilter],
        queryFn: async () => {
            const res = await fetch(`/api/finance/payment-vouchers?status=${statusFilter}`);
            if (!res.ok) return [];
            return res.json();
        }
    });

    const { data: projectsData = [] } = useQuery<any>({
        queryKey: ["projects"],
        queryFn: async () => {
            const res = await fetch("/api/projects?limit=1000");
            if (!res.ok) return [];
            return res.json();
        }
    });

    const projects: Project[] = Array.isArray(projectsData) 
        ? projectsData 
        : (projectsData.projects || []);

    const { data: invoices = [] } = useQuery<ProjectInvoice[]>({
        queryKey: ["invoices", formData.projectId],
        queryFn: async () => {
            if (!formData.projectId) return [];
            const res = await fetch(`/api/projects/invoices?projectId=${formData.projectId}`);
            if (!res.ok) return [];
            return res.json();
        },
        enabled: !!formData.projectId
    });

    // --- MUTATIONS ---
    const createMutation = useMutation({
        mutationFn: async (data: typeof formData) => {
            const payload = {
                ...data,
                invoiceId: data.invoiceId || null,
                amount: Number(data.amount),
                taxWithheld: Number(data.taxWithheld),
                retentionAmount: Number(data.retentionAmount)
            };
            const res = await fetch('/api/finance/payment-vouchers', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || 'Failed to create payment voucher');
            }
            return res.json();
        },
        onSuccess: () => {
            toast.success('Payment voucher created successfully');
            queryClient.invalidateQueries({ queryKey: ["payment-vouchers"] });
            setShowFormModal(false);
        },
        onError: (err: Error) => {
            toast.error(err.message);
        }
    });

    const updateMutation = useMutation({
        mutationFn: async ({ id, data }: { id: string, data: typeof formData }) => {
            const payload = {
                ...data,
                invoiceId: data.invoiceId || null,
                amount: Number(data.amount),
                taxWithheld: Number(data.taxWithheld),
                retentionAmount: Number(data.retentionAmount)
            };
            const res = await fetch(`/api/finance/payment-vouchers/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || 'Failed to update payment voucher');
            }
            return res.json();
        },
        onSuccess: () => {
            toast.success('Payment voucher updated successfully');
            queryClient.invalidateQueries({ queryKey: ["payment-vouchers"] });
            setShowFormModal(false);
        },
        onError: (err: Error) => {
            toast.error(err.message);
        }
    });

    const deleteMutation = useMutation({
        mutationFn: async (id: string) => {
            const res = await fetch(`/api/finance/payment-vouchers/${id}`, { method: 'DELETE' });
            if (!res.ok) throw new Error('Failed to delete voucher');
            return res.json();
        },
        onSuccess: () => {
            toast.success('Payment voucher deleted successfully');
            queryClient.invalidateQueries({ queryKey: ["payment-vouchers"] });
            setDeleteTarget(null);
        },
        onError: () => {
            toast.error('Failed to delete voucher');
        }
    });

    const statusMutation = useMutation({
        mutationFn: async ({ id, status, rejectReason }: { id: string, status: string, rejectReason?: string }) => {
            const res = await fetch(`/api/finance/payment-vouchers/${id}/status`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    status,
                    userId: 'admin_user',
                    rejectionReason: rejectReason
                })
            });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || 'Failed to update status');
            }
            return res.json();
        },
        onSuccess: (data) => {
            toast.success(`Voucher status updated to ${data.status}`);
            queryClient.invalidateQueries({ queryKey: ["payment-vouchers"] });
            setShowRejectModal(false);
            setRejectionReason("");
            if (showViewModal) {
                setSelectedPV(prev => prev ? { ...prev, status: data.status } : null);
            }
        },
        onError: (err: Error) => {
            toast.error(err.message);
        }
    });

    const handleOpenFormModal = (pv?: PaymentVoucher) => {
        if (pv) {
            setSelectedPV(pv);
            setFormData({
                projectId: pv.projectId,
                title: pv.title,
                description: pv.description || '',
                type: pv.type || 'CONTRACTOR',
                payeeName: pv.payeeName,
                invoiceId: pv.invoiceId || '',
                amount: pv.amount,
                taxWithheld: pv.taxWithheld,
                retentionAmount: pv.retentionAmount,
                paymentMethod: pv.paymentMethod || 'BANK_TRANSFER',
                bankName: pv.bankName || '',
                bankBranch: pv.bankBranch || '',
                accountNumber: pv.accountNumber || '',
                chequeNumber: pv.chequeNumber || '',
                referenceNumber: pv.referenceNumber || '',
                notes: pv.notes || ''
            });
        } else {
            setSelectedPV(null);
            setFormData({
                projectId: '',
                title: '',
                description: '',
                type: 'CONTRACTOR',
                payeeName: '',
                invoiceId: '',
                amount: 0,
                taxWithheld: 0,
                retentionAmount: 0,
                paymentMethod: 'BANK_TRANSFER',
                bankName: '',
                bankBranch: '',
                accountNumber: '',
                chequeNumber: '',
                referenceNumber: '',
                notes: ''
            });
        }
        setShowFormModal(true);
    };

    const handleFormSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (selectedPV) {
            updateMutation.mutate({ id: selectedPV.id, data: formData });
        } else {
            createMutation.mutate(formData);
        }
    };

    const handleInvoiceChange = (invoiceId: string) => {
        const selected = invoices.find(i => i.id === invoiceId);
        if (selected) {
            setFormData({
                ...formData,
                invoiceId,
                amount: selected.totalAmount,
                title: `Payment for Invoice ${selected.invoiceNumber}`
            });
        } else {
            setFormData({
                ...formData,
                invoiceId: ''
            });
        }
    };

    const printVoucher = (pv: PaymentVoucher) => {
        const printWindow = window.open('', '_blank');
        if (!printWindow) return;

        const netAmountFormatted = (pv.amount - pv.taxWithheld - pv.retentionAmount).toLocaleString('en-LK', { minimumFractionDigits: 2 });

        printWindow.document.write(`
            <html>
            <head>
                <title>Payment Voucher - ${pv.pvNumber}</title>
                <style>
                    body { font-family: sans-serif; padding: 40px; color: #333; }
                    .header { text-align: center; border-bottom: 2px solid #333; padding-bottom: 20px; }
                    .title { font-size: 24px; font-weight: bold; margin-top: 10px; }
                    .section { margin-top: 30px; }
                    .grid { display: grid; grid-template-cols: 1fr 1fr; gap: 20px; }
                    .label { font-weight: bold; color: #666; font-size: 14px; }
                    .value { font-size: 16px; margin-top: 4px; }
                    .table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                    .table th, .table td { border: 1px solid #ddd; padding: 12px; text-align: left; }
                    .table th { bg-color: #f5f5f5; }
                    .total-box { margin-top: 30px; border-top: 2px solid #333; padding-top: 15px; text-align: right; }
                    .total-amount { font-size: 20px; font-weight: bold; }
                    .signatures { margin-top: 60px; display: grid; grid-template-cols: 1fr 1fr 1fr; gap: 40px; text-align: center; }
                    .signature-line { border-top: 1px solid #333; margin-top: 50px; font-size: 14px; color: #666; }
                </style>
            </head>
            <body>
                <div class="header">
                    <h2>SLTS ERP</h2>
                    <div class="title">PAYMENT VOUCHER</div>
                    <p style="margin-top: 5px;">Voucher No: <strong>${pv.pvNumber}</strong> | Date: ${new Date(pv.createdAt).toLocaleDateString()}</p>
                </div>

                <div class="section grid">
                    <div>
                        <div class="label">Project Details</div>
                        <div class="value">${pv.project.projectCode} - ${pv.project.name}</div>
                    </div>
                    <div>
                        <div class="label">Payee Details</div>
                        <div class="value">${pv.payeeName}</div>
                    </div>
                </div>

                <div class="section">
                    <div class="label">Description / Title</div>
                    <div class="value">${pv.title}</div>
                    ${pv.description ? `<p style="margin-top: 10px; font-size: 14px; color: #555;">${pv.description}</p>` : ''}
                </div>

                <div class="section">
                    <div class="label">Payment Details</div>
                    <table class="table">
                        <thead>
                            <tr>
                                <th>Method</th>
                                <th>Bank / Branch</th>
                                <th>Account Number</th>
                                <th>Cheque / Ref No.</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td>${pv.paymentMethod?.replace(/_/g, ' ') || 'N/A'}</td>
                                <td>${pv.bankName || 'N/A'} ${pv.bankBranch ? `(${pv.bankBranch})` : ''}</td>
                                <td>${pv.accountNumber || 'N/A'}</td>
                                <td>${pv.chequeNumber || pv.referenceNumber || 'N/A'}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                <div class="section">
                    <div class="label">Financial Breakup</div>
                    <table class="table">
                        <thead>
                            <tr>
                                <th>Voucher Gross Amount</th>
                                <th>Tax Withheld</th>
                                <th>Retention Deducted</th>
                                <th>Net Payable Amount</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td>LKR ${pv.amount.toLocaleString('en-LK', { minimumFractionDigits: 2 })}</td>
                                <td>LKR ${pv.taxWithheld.toLocaleString('en-LK', { minimumFractionDigits: 2 })}</td>
                                <td>LKR ${pv.retentionAmount.toLocaleString('en-LK', { minimumFractionDigits: 2 })}</td>
                                <td style="font-weight: bold; color: #10b981;">LKR ${netAmountFormatted}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                <div class="signatures">
                    <div>
                        <div class="signature-line">Prepared By</div>
                    </div>
                    <div>
                        <div class="signature-line">Checked By (Finance)</div>
                    </div>
                    <div>
                        <div class="signature-line">Authorized Approval</div>
                    </div>
                </div>

                <script>window.print();</script>
            </body>
            </html>
        `);
        printWindow.document.close();
    };

    const getStatusStyle = (status: string) => {
        const styles: Record<string, string> = {
            DRAFT: 'bg-slate-100 text-slate-700 border-slate-200',
            PENDING_APPROVAL: 'bg-amber-50 text-amber-700 border-amber-200 animate-pulse',
            APPROVED: 'bg-blue-50 text-blue-700 border-blue-200',
            PAID: 'bg-emerald-50 text-emerald-700 border-emerald-200',
            REJECTED: 'bg-red-50 text-red-700 border-red-200',
            CANCELLED: 'bg-gray-100 text-gray-500 border-gray-200'
        };
        return styles[status] || 'bg-slate-100';
    };

    const filteredVouchers = vouchers.filter(v => {
        const query = searchTerm.toLowerCase();
        return v.pvNumber.toLowerCase().includes(query) ||
            v.title.toLowerCase().includes(query) ||
            v.payeeName.toLowerCase().includes(query) ||
            v.project.projectCode.toLowerCase().includes(query);
    });

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
                                Payment Vouchers
                            </h1>
                            <p className="text-sm text-muted-foreground mt-1">
                                Create and approve corporate transaction settlement vouchers
                            </p>
                        </div>
                        <Button onClick={() => handleOpenFormModal()} className="bg-blue-600 hover:bg-blue-700 text-white">
                            <Plus className="w-4 h-4 mr-2" />
                            New Voucher
                        </Button>
                    </div>

                    {/* Filter / Search Bar */}
                    <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center bg-white dark:bg-slate-900 p-3 rounded-lg border border-slate-200 dark:border-slate-800 shadow-sm">
                        <div className="flex items-center gap-2 flex-1 border rounded px-3 py-1 bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800">
                            <Search className="w-4 h-4 text-slate-400" />
                            <Input 
                                placeholder="Search by PV number, payee, title, or project..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className="border-0 shadow-none h-8 focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-slate-400"
                            />
                        </div>
                        <div className="flex gap-1.5 flex-wrap">
                            {['ALL', 'DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'PAID', 'REJECTED'].map(status => (
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

                    {/* Content Table */}
                    <div className="flex-1 overflow-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-sm">
                        {vouchersLoading ? (
                            <div className="flex items-center justify-center h-48">
                                <span className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></span>
                            </div>
                        ) : filteredVouchers.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-48 text-slate-500">
                                <FileText className="w-12 h-12 mb-2 opacity-50" />
                                No vouchers found.
                            </div>
                        ) : (
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                        <th className="p-4">PV Number</th>
                                        <th className="p-4">Payee & Project</th>
                                        <th className="p-4">Description</th>
                                        <th className="p-4 text-right">Net Amount</th>
                                        <th className="p-4">Status</th>
                                        <th className="p-4 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
                                    {filteredVouchers.map(pv => (
                                        <tr key={pv.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                                            <td className="p-4 font-mono font-bold text-blue-600">{pv.pvNumber}</td>
                                            <td className="p-4">
                                                <div className="font-semibold text-slate-900 dark:text-slate-100">{pv.payeeName}</div>
                                                <div className="text-xs text-slate-500 mt-0.5">{pv.project.projectCode} - {pv.project.name}</div>
                                            </td>
                                            <td className="p-4 max-w-xs truncate">
                                                <div className="font-medium">{pv.title}</div>
                                                {pv.invoice && (
                                                    <span className="inline-flex items-center text-[10px] bg-slate-100 text-slate-600 font-semibold px-2 py-0.5 rounded mt-1 border">
                                                        Invoice: {pv.invoice.invoiceNumber}
                                                    </span>
                                                )}
                                            </td>
                                            <td className="p-4 text-right font-bold text-slate-900 dark:text-slate-100">
                                                LKR {pv.netAmount.toLocaleString('en-LK', { minimumFractionDigits: 2 })}
                                            </td>
                                            <td className="p-4">
                                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold border ${getStatusStyle(pv.status)}`}>
                                                    {pv.status.replace(/_/g, ' ')}
                                                </span>
                                            </td>
                                            <td className="p-4 text-right">
                                                <div className="flex justify-end gap-2">
                                                    <Button variant="ghost" size="sm" onClick={() => { setSelectedPV(pv); setShowViewModal(true); }}>
                                                        <ExternalLink className="w-4 h-4" />
                                                    </Button>
                                                    {pv.status === 'DRAFT' && (
                                                        <>
                                                            <Button variant="ghost" size="sm" onClick={() => handleOpenFormModal(pv)}>
                                                                <Edit2 className="w-4 h-4 text-slate-500" />
                                                            </Button>
                                                            <Button variant="ghost" size="sm" onClick={() => setDeleteTarget(pv)}>
                                                                <Trash2 className="w-4 h-4 text-red-500" />
                                                            </Button>
                                                        </>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>

                {/* Form Dialog */}
                <Dialog open={showFormModal} onOpenChange={setShowFormModal}>
                    <DialogContent className="max-w-lg overflow-y-auto max-h-[90vh]">
                        <DialogHeader>
                            <DialogTitle>{selectedPV ? 'Edit Payment Voucher' : 'Create Payment Voucher'}</DialogTitle>
                            <DialogDescription>
                                Input payment info, settle invoices, and detail taxes.
                            </DialogDescription>
                        </DialogHeader>
                        <form onSubmit={handleFormSubmit} className="space-y-4">
                            <div className="grid grid-cols-2 gap-3">
                                <div className="col-span-2">
                                    <label className="text-xs font-bold text-slate-500">Link to Project</label>
                                    <select 
                                        required
                                        value={formData.projectId} 
                                        onChange={e => setFormData({...formData, projectId: e.target.value, invoiceId: ''})}
                                        className="w-full h-10 px-3 border border-slate-200 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                                    >
                                        <option value="">-- Select Project --</option>
                                        {projects.map(p => (
                                            <option key={p.id} value={p.id}>{p.projectCode} - {p.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="col-span-2">
                                    <label className="text-xs font-bold text-slate-500">Settle Invoice (Optional)</label>
                                    <select 
                                        value={formData.invoiceId} 
                                        onChange={e => handleInvoiceChange(e.target.value)}
                                        disabled={!formData.projectId}
                                        className="w-full h-10 px-3 border border-slate-200 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                                    >
                                        <option value="">-- Select Project Invoice --</option>
                                        {invoices.map(i => (
                                            <option key={i.id} value={i.id}>{i.invoiceNumber} - LKR {i.totalAmount.toLocaleString()}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="col-span-2">
                                    <label className="text-xs font-bold text-slate-500">Voucher Title</label>
                                    <Input required value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} placeholder="e.g. Settle subcontractor civil work invoice" />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-500">Payee Name</label>
                                    <Input required value={formData.payeeName} onChange={e => setFormData({...formData, payeeName: e.target.value})} placeholder="e.g. ABC Civil Co" />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-500">Voucher Type</label>
                                    <select 
                                        value={formData.type} 
                                        onChange={e => setFormData({...formData, type: e.target.value})}
                                        className="w-full h-10 px-3 border border-slate-200 rounded-md text-sm focus:outline-none"
                                    >
                                        <option value="CONTRACTOR">CONTRACTOR</option>
                                        <option value="VENDOR">VENDOR</option>
                                        <option value="STAFF">STAFF</option>
                                        <option value="MISC">MISC</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-500">Gross Amount (LKR)</label>
                                    <Input required type="number" value={formData.amount} onChange={e => setFormData({...formData, amount: Number(e.target.value)})} />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-500">WHT / Tax Withheld (LKR)</label>
                                    <Input type="number" value={formData.taxWithheld} onChange={e => setFormData({...formData, taxWithheld: Number(e.target.value)})} />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-500">Retention Deducted (LKR)</label>
                                    <Input type="number" value={formData.retentionAmount} onChange={e => setFormData({...formData, retentionAmount: Number(e.target.value)})} />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-500">Payment Method</label>
                                    <select 
                                        value={formData.paymentMethod} 
                                        onChange={e => setFormData({...formData, paymentMethod: e.target.value})}
                                        className="w-full h-10 px-3 border border-slate-200 rounded-md text-sm focus:outline-none"
                                    >
                                        <option value="BANK_TRANSFER">BANK TRANSFER</option>
                                        <option value="CHEQUE">CHEQUE</option>
                                        <option value="CASH">CASH</option>
                                    </select>
                                </div>
                                <div className="col-span-2 border-t pt-2 mt-2">
                                    <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">Bank Settlement Details</h4>
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-500">Bank Name</label>
                                    <Input value={formData.bankName} onChange={e => setFormData({...formData, bankName: e.target.value})} />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-500">Branch Name</label>
                                    <Input value={formData.bankBranch} onChange={e => setFormData({...formData, bankBranch: e.target.value})} />
                                </div>
                                <div className="col-span-2">
                                    <label className="text-xs font-bold text-slate-500">Account Number</label>
                                    <Input value={formData.accountNumber} onChange={e => setFormData({...formData, accountNumber: e.target.value})} />
                                </div>
                            </div>
                            <DialogFooter>
                                <Button type="button" variant="outline" onClick={() => setShowFormModal(false)}>Cancel</Button>
                                <Button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white">Save Voucher</Button>
                            </DialogFooter>
                        </form>
                    </DialogContent>
                </Dialog>

                {/* View/Action Dialog */}
                <Dialog open={showViewModal} onOpenChange={setShowViewModal}>
                    <DialogContent className="max-w-xl">
                        <DialogHeader>
                            <DialogTitle className="flex justify-between items-center pr-6">
                                <span>Voucher Details - {selectedPV?.pvNumber}</span>
                                <Button size="sm" variant="outline" onClick={() => selectedPV && printVoucher(selectedPV)}>
                                    <Printer className="w-4 h-4 mr-2" /> Print PV
                                </Button>
                            </DialogTitle>
                        </DialogHeader>
                        {selectedPV && (
                            <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-4 border-b pb-4">
                                    <div>
                                        <div className="text-xs font-bold text-slate-400">PROJECT</div>
                                        <div className="text-sm font-semibold">{selectedPV.project.projectCode} - {selectedPV.project.name}</div>
                                    </div>
                                    <div>
                                        <div className="text-xs font-bold text-slate-400">PAYEE</div>
                                        <div className="text-sm font-semibold">{selectedPV.payeeName}</div>
                                    </div>
                                    <div>
                                        <div className="text-xs font-bold text-slate-400">TITLE</div>
                                        <div className="text-sm font-semibold">{selectedPV.title}</div>
                                    </div>
                                    <div>
                                        <div className="text-xs font-bold text-slate-400">STATUS</div>
                                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold border mt-1 ${getStatusStyle(selectedPV.status)}`}>
                                            {selectedPV.status.replace(/_/g, ' ')}
                                        </span>
                                    </div>
                                </div>

                                <div className="space-y-2 border-b pb-4">
                                    <h4 className="font-bold text-sm text-slate-800 dark:text-slate-200">Financial breakdown</h4>
                                    <div className="grid grid-cols-2 gap-2 text-sm">
                                        <div className="text-slate-500">Gross Amount:</div>
                                        <div className="text-right font-semibold">LKR {selectedPV.amount.toLocaleString()}</div>
                                        <div className="text-slate-500">Tax Withheld:</div>
                                        <div className="text-right font-semibold text-red-600">- LKR {selectedPV.taxWithheld.toLocaleString()}</div>
                                        <div className="text-slate-500">Retention Deducted:</div>
                                        <div className="text-right font-semibold text-red-600">- LKR {selectedPV.retentionAmount.toLocaleString()}</div>
                                        <div className="text-slate-800 dark:text-slate-200 font-bold border-t pt-1">Net Settlement:</div>
                                        <div className="text-right font-bold text-emerald-600 border-t pt-1">LKR {selectedPV.netAmount.toLocaleString()}</div>
                                    </div>
                                </div>

                                <div className="space-y-1">
                                    <div className="text-xs font-bold text-slate-400">PAYMENT INFORMATION</div>
                                    <div className="text-sm grid grid-cols-2 gap-2">
                                        <div>Method: {selectedPV.paymentMethod}</div>
                                        {selectedPV.bankName && <div>Bank: {selectedPV.bankName} ({selectedPV.bankBranch})</div>}
                                        {selectedPV.accountNumber && <div>Acc: {selectedPV.accountNumber}</div>}
                                    </div>
                                </div>

                                {/* Flow Control Approvals */}
                                <div className="border-t pt-4 flex justify-end gap-2">
                                    {selectedPV.status === 'DRAFT' && (
                                        <Button 
                                            onClick={() => statusMutation.mutate({ id: selectedPV.id, status: 'PENDING_APPROVAL' })}
                                            className="bg-amber-600 hover:bg-amber-700 text-white"
                                        >
                                            Submit for Approval
                                        </Button>
                                    )}
                                    {selectedPV.status === 'PENDING_APPROVAL' && (
                                        <>
                                            <Button 
                                                onClick={() => setShowRejectModal(true)}
                                                variant="outline"
                                                className="border-red-200 text-red-600 hover:bg-red-50"
                                            >
                                                <XCircle className="w-4 h-4 mr-2" /> Reject
                                            </Button>
                                            <Button 
                                                onClick={() => statusMutation.mutate({ id: selectedPV.id, status: 'APPROVED' })}
                                                className="bg-blue-600 hover:bg-blue-700 text-white"
                                            >
                                                <CheckCircle className="w-4 h-4 mr-2" /> Approve Voucher
                                            </Button>
                                        </>
                                    )}
                                    {selectedPV.status === 'APPROVED' && (
                                        <Button 
                                            onClick={() => statusMutation.mutate({ id: selectedPV.id, status: 'PAID' })}
                                            className="bg-emerald-600 hover:bg-emerald-700 text-white"
                                        >
                                            <CheckCircle className="w-4 h-4 mr-2" /> Mark as Paid
                                        </Button>
                                    )}
                                </div>
                            </div>
                        )}
                    </DialogContent>
                </Dialog>

                {/* Reject Dialog */}
                <Dialog open={showRejectModal} onOpenChange={setShowRejectModal}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Reject Payment Voucher</DialogTitle>
                            <DialogDescription>Specify the reason for rejecting this payment voucher.</DialogDescription>
                        </DialogHeader>
                        <div className="space-y-3">
                            <Input 
                                placeholder="Rejection reason..." 
                                value={rejectionReason} 
                                onChange={e => setRejectionReason(e.target.value)} 
                            />
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setShowRejectModal(false)}>Cancel</Button>
                            <Button 
                                onClick={() => selectedPV && statusMutation.mutate({ id: selectedPV.id, status: 'REJECTED', rejectReason: rejectionReason })}
                                className="bg-red-600 hover:bg-red-700 text-white"
                            >
                                Confirm Reject
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                {/* Delete Alert */}
                <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle className="flex items-center gap-2 text-red-600">
                                <ShieldAlert className="w-5 h-5" />
                                Delete Payment Voucher?
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                                Are you sure you want to permanently delete draft voucher <strong>{deleteTarget?.pvNumber}</strong>?
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction 
                                onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
                                className="bg-red-600 hover:bg-red-700 text-white"
                            >
                                Delete
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>

            </main>
        </div>
    );
}

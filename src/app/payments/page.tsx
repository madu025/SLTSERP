"use client";

import React, { useEffect, useState, useCallback } from 'react';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import ResponsiveTable from '@/components/ResponsiveTable';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Banknote, CheckCircle, Clock, AlertTriangle, Receipt } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Payment {
    id: string;
    invoice_id: string;
    payment_type: string;
    reference_id: string;
    base_amount: number;
    tax_amount: number;
    total_amount: number;
    payment_method: string;
    payment_ref_number: string | null;
    status: string;
    due_date: string;
    payment_received_date: string | null;
    createdAt: string;
    invoice: { id: string; invoice_number: string; total_amount: number } | null;
}

interface Invoice {
    id: string;
    invoice_number: string;
    total_amount: number;
}

const STATUS_COLORS: Record<string, string> = {
    COMPLETED: 'bg-emerald-50 text-emerald-700',
    PENDING: 'bg-amber-50 text-amber-700',
    OVERDUE: 'bg-red-50 text-red-700',
    PARTIAL: 'bg-blue-50 text-blue-700',
    CANCELLED: 'bg-slate-50 text-slate-700',
};

const PAYMENT_TYPES = [
    { value: 'RENTAL', label: 'Rental' },
    { value: 'MAINTENANCE', label: 'Maintenance' },
    { value: 'INSURANCE_PREMIUM', label: 'Insurance Premium' },
    { value: 'FUEL', label: 'Fuel' },
    { value: 'DRIVER_OT_SALARY', label: 'Driver OT / Salary' },
    { value: 'TOLL', label: 'Toll' },
    { value: 'PARKING', label: 'Parking' },
    { value: 'FINE', label: 'Fine' },
    { value: 'REGISTRATION', label: 'Registration' },
    { value: 'OTHER', label: 'Other' },
];

const PAYMENT_METHODS = [
    { value: 'CASH', label: 'Cash' },
    { value: 'CREDIT_CARD', label: 'Credit Card' },
    { value: 'BANK_TRANSFER', label: 'Bank Transfer' },
    { value: 'CHEQUE', label: 'Cheque' },
];

export default function PaymentsPage() {
    const [payments, setPayments] = useState<Payment[]>([]);
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [loading, setLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState('ALL');
    const [paymentTypeFilter, setPaymentTypeFilter] = useState('ALL');
    const [createDialogOpen, setCreateDialogOpen] = useState(false);
    const [newPayment, setNewPayment] = useState({ invoice_id: '', payment_type: '', reference_id: '', base_amount: '', payment_method: '', due_date: '' });
    const [receiptDialogOpen, setReceiptDialogOpen] = useState(false);
    const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
    const [receiptData, setReceiptData] = useState({ payment_received_date: '', payment_ref_number: '' });

    const fetchPayments = useCallback(async () => {
        try {
            setLoading(true);
            const params = new URLSearchParams();
            if (statusFilter !== 'ALL') params.append('status', statusFilter);
            if (paymentTypeFilter !== 'ALL') params.append('payment_type', paymentTypeFilter);
            params.append('limit', '100');
            const res = await fetch(`/api/payments?${params}`);
            if (!res.ok) throw new Error('Failed');
            const json = await res.json();
            setPayments(json.data || []);
        } catch (e) { console.error(e); } finally { setLoading(false); }
    }, [statusFilter, paymentTypeFilter]);

    const fetchInvoices = async () => {
        try {
            const res = await fetch('/api/invoices?limit=1000');
            if (res.ok) { const d = await res.json(); setInvoices(Array.isArray(d) ? d : []); }
        } catch (e) { console.error(e); }
    };

    useEffect(() => { fetchPayments(); fetchInvoices(); }, [fetchPayments]);

    const totalPayments = payments.reduce((s, p) => s + p.total_amount, 0);
    const completedPayments = payments.filter(p => p.status === 'COMPLETED').reduce((s, p) => s + p.total_amount, 0);
    const pendingPayments = payments.filter(p => p.status === 'PENDING').reduce((s, p) => s + p.total_amount, 0);
    const overduePayments = payments.filter(p => p.status === 'OVERDUE').reduce((s, p) => s + p.total_amount, 0);

    const getStatusBadge = (status: string) => {
        const colorClass = STATUS_COLORS[status] || 'bg-slate-50 text-slate-700';
        return (<Badge className={cn('border-none px-1.5 py-0.2 text-[9px] font-black leading-none', colorClass)}>{status?.replace('_', ' ')}</Badge>);
    };

    const formatCurrency = (amount: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'LKR' }).format(amount || 0);

    const handleCreatePayment = async () => {
        try {
            setLoading(true);
            const res = await fetch('/api/payments', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    invoice_id: newPayment.invoice_id,
                    payment_type: newPayment.payment_type,
                    reference_id: newPayment.reference_id,
                    base_amount: parseFloat(newPayment.base_amount),
                    payment_method: newPayment.payment_method,
                    due_date: newPayment.due_date,
                }),
            });
            if (!res.ok) { const err = await res.json(); alert(err.error?.message || 'Failed'); return; }
            alert('Payment created!');
            setCreateDialogOpen(false);
            setNewPayment({ invoice_id: '', payment_type: '', reference_id: '', base_amount: '', payment_method: '', due_date: '' });
            fetchPayments();
        } catch (e) { console.error(e); alert('Error'); } finally { setLoading(false); }
    };

    const handleRecordReceipt = async () => {
        if (!selectedPayment) return;
        try {
            setLoading(true);
            const res = await fetch(`/api/payments/${selectedPayment.id}/receipt`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    payment_received_date: receiptData.payment_received_date,
                    payment_ref_number: receiptData.payment_ref_number || undefined,
                }),
            });
            if (!res.ok) { const err = await res.json(); alert(err.error?.message || 'Failed'); return; }
            alert('Receipt recorded!');
            setReceiptDialogOpen(false);
            setSelectedPayment(null);
            setReceiptData({ payment_received_date: '', payment_ref_number: '' });
            fetchPayments();
        } catch (e) { console.error(e); alert('Error'); } finally { setLoading(false); }
    };

    const openReceiptDialog = (payment: Payment) => {
        setSelectedPayment(payment);
        setReceiptData({ payment_received_date: new Date().toISOString().split('T')[0], payment_ref_number: '' });
        setReceiptDialogOpen(true);
    };

    return (
        <div className="erp-page-wrapper flex-row overflow-hidden">
            <Sidebar />
            <main className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
                <Header />
                <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
                    <div className="max-w-7xl mx-auto space-y-4">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                            <div className="space-y-0.5">
                                <h1 className="text-xl font-black text-slate-900 tracking-tight">Payments</h1>
                                <p className="text-xs text-slate-500">Track and manage vehicle-related payments and receipts.</p>
                            </div>
                            <div className="flex gap-2 w-full sm:w-auto">
                                <Button onClick={() => setCreateDialogOpen(true)} className="flex-1 sm:flex-none h-8 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-xs transition-all shadow-sm">
                                    <Plus className="w-4 h-4 mr-1.5" /> New Payment
                                </Button>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                            <Card className="rounded-xl border border-slate-200 bg-white">
                                <CardContent className="p-3 flex items-center justify-between">
                                    <div><p className="text-[10px] font-black uppercase text-slate-400">Total Payments</p><p className="text-base font-black text-slate-900">{formatCurrency(totalPayments)}</p></div>
                                    <div className="h-8 w-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center"><Banknote className="w-4 h-4" /></div>
                                </CardContent>
                            </Card>
                            <Card className="rounded-xl border border-slate-200 bg-white">
                                <CardContent className="p-3 flex items-center justify-between">
                                    <div><p className="text-[10px] font-black uppercase text-slate-400">Completed</p><p className="text-base font-black text-emerald-600">{formatCurrency(completedPayments)}</p></div>
                                    <div className="h-8 w-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center"><CheckCircle className="w-4 h-4" /></div>
                                </CardContent>
                            </Card>
                            <Card className="rounded-xl border border-slate-200 bg-white">
                                <CardContent className="p-3 flex items-center justify-between">
                                    <div><p className="text-[10px] font-black uppercase text-slate-400">Pending</p><p className="text-base font-black text-amber-600">{formatCurrency(pendingPayments)}</p></div>
                                    <div className="h-8 w-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center"><Clock className="w-4 h-4" /></div>
                                </CardContent>
                            </Card>
                            <Card className="rounded-xl border border-slate-200 bg-white">
                                <CardContent className="p-3 flex items-center justify-between">
                                    <div><p className="text-[10px] font-black uppercase text-slate-400">Overdue</p><p className="text-base font-black text-red-600">{formatCurrency(overduePayments)}</p></div>
                                    <div className="h-8 w-8 rounded-lg bg-red-50 text-red-600 flex items-center justify-center"><AlertTriangle className="w-4 h-4" /></div>
                                </CardContent>
                            </Card>
                        </div>
                        <div className="flex flex-wrap items-center gap-3">
                            <div className="w-40">
                                <Select value={statusFilter} onValueChange={setStatusFilter}>
                                    <SelectTrigger className="h-9 text-xs rounded-lg bg-white border-slate-200"><SelectValue placeholder="Status" /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="ALL">All Status</SelectItem>
                                        <SelectItem value="PENDING">Pending</SelectItem>
                                        <SelectItem value="COMPLETED">Completed</SelectItem>
                                        <SelectItem value="OVERDUE">Overdue</SelectItem>
                                        <SelectItem value="PARTIAL">Partial</SelectItem>
                                        <SelectItem value="CANCELLED">Cancelled</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="w-48">
                                <Select value={paymentTypeFilter} onValueChange={setPaymentTypeFilter}>
                                    <SelectTrigger className="h-9 text-xs rounded-lg bg-white border-slate-200"><SelectValue placeholder="Payment Type" /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="ALL">All Types</SelectItem>
                                        {PAYMENT_TYPES.map(pt => (<SelectItem key={pt.value} value={pt.value}>{pt.label}</SelectItem>))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div className="erp-table-container">
                            {loading ? (
                                <div className="py-20 flex flex-col items-center justify-center text-slate-400 gap-4">
                                    <div className="h-8 w-8 border-3 border-blue-100 border-t-blue-600 rounded-full animate-spin" />
                                    <p className="text-[10px] font-black uppercase tracking-wider animate-pulse">Loading...</p>
                                </div>
                            ) : payments.length === 0 ? (
                                <div className="py-20 flex flex-col items-center justify-center bg-white rounded-xl border border-dashed border-slate-200 text-slate-400">
                                    <Banknote className="w-10 h-10 opacity-20 mb-3" />
                                    <p className="text-xs font-bold">No payments found.</p>
                                </div>
                            ) : (
                                <ResponsiveTable>
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr>
                                                <th className="px-3 py-2 text-xs font-semibold text-slate-500 uppercase">Invoice #</th>
                                                <th className="px-3 py-2 text-xs font-semibold text-slate-500 uppercase">Payment Type</th>
                                                <th className="px-3 py-2 text-xs font-semibold text-slate-500 uppercase">Base Amount</th>
                                                <th className="px-3 py-2 text-xs font-semibold text-slate-500 uppercase">Tax</th>
                                                <th className="px-3 py-2 text-xs font-semibold text-slate-500 uppercase">Total Amount</th>
                                                <th className="px-3 py-2 text-xs font-semibold text-slate-500 uppercase">Status</th>
                                                <th className="px-3 py-2 text-xs font-semibold text-slate-500 uppercase">Due Date</th>
                                                <th className="px-3 py-2 text-right pr-6 w-24">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 bg-white">
                                            {payments.map((p) => (
                                                <tr key={p.id} className="hover:bg-slate-50/50 transition-colors">
                                                    <td className="font-mono font-bold text-slate-900">{p.invoice?.invoice_number || p.invoice_id?.slice(0,8) || '-'}</td>
                                                    <td className="text-slate-600 font-medium">{p.payment_type?.replace(/_/g, ' ')}</td>
                                                    <td className="font-semibold text-slate-800">{formatCurrency(p.base_amount)}</td>
                                                    <td className="text-slate-500">{formatCurrency(p.tax_amount)}</td>
                                                    <td className="font-bold text-slate-900">{formatCurrency(p.total_amount)}</td>
                                                    <td>{getStatusBadge(p.status)}</td>
                                                    <td className="text-slate-500 text-xs">{p.due_date ? new Date(p.due_date).toLocaleDateString() : '-'}</td>
                                                    <td className="text-right pr-6">
                                                        <div className="inline-flex items-center gap-1.5">
                                                            {p.status === 'COMPLETED' && (
                                                                <Button size="sm" variant="ghost" onClick={() => openReceiptDialog(p)}
                                                                    className="h-7 w-7 p-0 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-all" title="Record Receipt">
                                                                    <Receipt className="w-3.5 h-3.5" />
                                                                </Button>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </ResponsiveTable>
                            )}
                        </div>
                    </div>
                </div>
            </main>
            <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>                <DialogContent className="max-w-md rounded-2xl">
                    <DialogHeader><DialogTitle className="text-lg font-black text-slate-900">New Payment</DialogTitle><DialogDescription className="text-xs text-slate-500">Create a new vehicle-related payment record.</DialogDescription></DialogHeader>
                    <div className="space-y-4 py-3">
                        <div className="space-y-1.5">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Invoice</Label>
                            <Select onValueChange={(v) => setNewPayment({...newPayment, invoice_id: v})}>
                                <SelectTrigger className="h-10 rounded-lg bg-slate-50 border-none"><SelectValue placeholder="Select Invoice" /></SelectTrigger>
                                <SelectContent>{invoices.map(i => (<SelectItem key={i.id} value={i.id}>{i.invoice_number} ({formatCurrency(i.total_amount)})</SelectItem>))}</SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Payment Type</Label>
                            <Select onValueChange={(v) => setNewPayment({...newPayment, payment_type: v})}>
                                <SelectTrigger className="h-10 rounded-lg bg-slate-50 border-none"><SelectValue placeholder="Select Type" /></SelectTrigger>
                                <SelectContent>{PAYMENT_TYPES.map(pt => (<SelectItem key={pt.value} value={pt.value}>{pt.label}</SelectItem>))}</SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Reference ID</Label>
                            <Input value={newPayment.reference_id} onChange={(e) => setNewPayment({...newPayment, reference_id: e.target.value})} className="h-10 rounded-lg bg-slate-50 border-none" placeholder="Enter reference ID" />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Base Amount (LKR)</Label>
                            <Input type="number" step="0.01" value={newPayment.base_amount} onChange={(e) => setNewPayment({...newPayment, base_amount: e.target.value})} className="h-10 rounded-lg bg-slate-50 border-none" placeholder="0.00" />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Payment Method</Label>
                            <Select onValueChange={(v) => setNewPayment({...newPayment, payment_method: v})}>
                                <SelectTrigger className="h-10 rounded-lg bg-slate-50 border-none"><SelectValue placeholder="Select Method" /></SelectTrigger>
                                <SelectContent>{PAYMENT_METHODS.map(pm => (<SelectItem key={pm.value} value={pm.value}>{pm.label}</SelectItem>))}</SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Due Date</Label>
                            <Input type="date" value={newPayment.due_date} onChange={(e) => setNewPayment({...newPayment, due_date: e.target.value})} className="h-10 rounded-lg bg-slate-50 border-none" />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button onClick={handleCreatePayment} disabled={loading || !newPayment.invoice_id || !newPayment.payment_type || !newPayment.reference_id || !newPayment.base_amount || !newPayment.payment_method || !newPayment.due_date} className="w-full bg-slate-900 hover:bg-slate-800 text-white h-11 rounded-lg font-bold text-xs uppercase tracking-wider">{loading ? 'Creating...' : 'Create Payment'}</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            <Dialog open={receiptDialogOpen} onOpenChange={setReceiptDialogOpen}>
                <DialogContent className="max-w-md rounded-2xl">
                    <DialogHeader><DialogTitle className="text-lg font-black text-slate-900">Record Receipt</DialogTitle><DialogDescription className="text-xs text-slate-500">Record payment receipt for invoice #{selectedPayment?.invoice?.invoice_number || ''}</DialogDescription></DialogHeader>
                    <div className="space-y-4 py-3">
                        <div className="space-y-1.5">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Payment Received Date</Label>
                            <Input type="date" value={receiptData.payment_received_date} onChange={(e) => setReceiptData({...receiptData, payment_received_date: e.target.value})} className="h-10 rounded-lg bg-slate-50 border-none" />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Payment Reference Number</Label>
                            <Input value={receiptData.payment_ref_number} onChange={(e) => setReceiptData({...receiptData, payment_ref_number: e.target.value})} className="h-10 rounded-lg bg-slate-50 border-none" placeholder="Optional reference number" />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button onClick={handleRecordReceipt} disabled={loading || !receiptData.payment_received_date} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white h-11 rounded-lg font-bold text-xs uppercase tracking-wider">{loading ? 'Recording...' : 'Record Receipt'}</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            </div>
    );
}

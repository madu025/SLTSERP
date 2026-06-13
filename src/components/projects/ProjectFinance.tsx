'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
    DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
    ReceiptText, Wallet, Gavel, Lock, Plus, Eye, CheckCircle, XCircle,
    Loader2, Banknote, ArrowUpDown,
} from 'lucide-react';

interface Project {
    id: string;
    projectCode: string;
    name: string;
    status: string;
}

interface InvoiceItem {
    id?: string;
    description: string;
    quantity: number;
    unitPrice: number;
    totalPrice?: number;
    itemType: string;
}

interface Invoice {
    id: string;
    invoiceNumber: string;
    title: string;
    description?: string;
    status: string;
    dueDate: string;
    totalAmount: number;
    paidAmount: number;
    balanceAmount: number;
    items?: InvoiceItem[];
    referenceNumber?: string;
    invoiceDate: string;
    subtotal?: number;
    taxAmount?: number;
    discountAmount?: number;
}

interface PaymentVoucher {
    id: string;
    pvNumber: string;
    title: string;
    payeeName: string;
    amount: number;
    netAmount: number;
    type: string;
    status: string;
    paymentDate?: string;
    invoice?: {
        invoiceNumber: string;
    };
}

interface LDPenalty {
    id: string;
    type: string;
    status: string;
    category: string;
    title: string;
    description?: string;
    amount: number;
    waivedAmount: number;
    netAmount: number;
    percentage?: number;
    appliedDate?: string;
}

interface RetentionRelease {
    id: string;
    releaseAmount: number;
    releaseDate: string;
    remarks?: string;
}

interface Retention {
    id: string;
    title: string;
    description?: string;
    retentionPercent: number;
    retentionAmount: number;
    releasedAmount: number;
    balanceAmount: number;
    status: string;
    releaseCondition?: string;
    defectLiabilityPeriod?: number;
    defectLiabilityEnd?: string;
    invoice?: {
        invoiceNumber: string;
        title: string;
        totalAmount: number;
    };
    releases?: RetentionRelease[];
}

interface InvoiceForm {
    title: string;
    type: string;
    invoiceDate: string;
    dueDate: string;
    referenceNumber?: string;
    notes?: string;
    items: InvoiceItem[];
    taxAmount: number;
    discountAmount: number;
}

interface PVForm {
    title?: string;
    type?: string;
    payeeName?: string;
    amount?: number;
    paymentDate?: string;
    paymentMethod?: string;
    invoiceId?: string;
    taxWithheld?: number;
    retentionAmount?: number;
    notes?: string;
}

interface LDForm {
    title?: string;
    type?: string;
    category?: string;
    amount?: number;
    percentage?: number;
    description?: string;
}

interface RetForm {
    title?: string;
    invoiceId?: string;
    retentionPercent?: number;
    retentionAmount?: number;
    releaseCondition?: string;
    defectLiabilityPeriod?: number;
    description?: string;
}

interface ReleaseForm {
    releaseAmount?: number;
    releaseDate?: string;
    remarks?: string;
}

interface ProjectFinanceProps {
    project: Project;
    refreshProject: () => void;
}

export default function ProjectFinance({ project, refreshProject }: ProjectFinanceProps) {
    const [activeTab, setActiveTab] = useState('invoices');
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [paymentVouchers, setPaymentVouchers] = useState<PaymentVoucher[]>([]);
    const [ldPenalties, setLdPenalties] = useState<LDPenalty[]>([]);
    const [retentions, setRetentions] = useState<Retention[]>([]);
    const [loading, setLoading] = useState(true);

    // Dialog states
    const [showInvDialog, setShowInvDialog] = useState(false);
    const [showPVDialog, setShowPVDialog] = useState(false);
    const [showLDDialog, setShowLDDialog] = useState(false);
    const [showRetDialog, setShowRetDialog] = useState(false);
    const [showReleaseDialog, setShowReleaseDialog] = useState(false);
    const [selectedRetention, setSelectedRetention] = useState<Retention | null>(null);
    const [submitting, setSubmitting] = useState(false);

    // Form states
    const [invForm, setInvForm] = useState<InvoiceForm>({
        title: '',
        type: 'CLIENT',
        invoiceDate: new Date().toISOString().split('T')[0],
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        items: [{ description: '', quantity: 1, unitPrice: 0, itemType: 'SERVICE' }],
        taxAmount: 0,
        discountAmount: 0
    });
    const [pvForm, setPvForm] = useState<PVForm>({});
    const [ldForm, setLdForm] = useState<LDForm>({});
    const [retForm, setRetForm] = useState<RetForm>({});
    const [releaseForm, setReleaseForm] = useState<ReleaseForm>({});

    const fetchInvoices = useCallback(async () => {
        try {
            const res = await fetch(`/api/projects/invoices?projectId=${project.id}`);
            if (res.ok) setInvoices(await res.json());
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    }, [project.id]);

    const fetchPaymentVouchers = useCallback(async () => {
        try {
            const res = await fetch(`/api/projects/payment-vouchers?projectId=${project.id}`);
            if (res.ok) setPaymentVouchers(await res.json());
        } catch (e) { console.error(e); }
    }, [project.id]);

    const fetchLdPenalties = useCallback(async () => {
        try {
            const res = await fetch(`/api/projects/ld-penalties?projectId=${project.id}`);
            if (res.ok) setLdPenalties(await res.json());
        } catch (e) { console.error(e); }
    }, [project.id]);

    const fetchRetentions = useCallback(async () => {
        try {
            const res = await fetch(`/api/projects/retentions?projectId=${project.id}`);
            if (res.ok) setRetentions(await res.json());
        } catch (e) { console.error(e); }
    }, [project.id]);

    useEffect(() => {
        if (project?.id) {
            fetchInvoices();
            fetchPaymentVouchers();
            fetchLdPenalties();
            fetchRetentions();
        }
    }, [project?.id, fetchInvoices, fetchPaymentVouchers, fetchLdPenalties, fetchRetentions]);

    const handleCreateInvoice = async () => {
        setSubmitting(true);
        try {
            const res = await fetch('/api/projects/invoices', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ projectId: project.id, ...invForm }),
            });
            if (res.ok) {
                setShowInvDialog(false);
                setInvForm({
                    title: '',
                    type: 'CLIENT',
                    invoiceDate: new Date().toISOString().split('T')[0],
                    dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                    items: [{ description: '', quantity: 1, unitPrice: 0, itemType: 'SERVICE' }],
                    taxAmount: 0,
                    discountAmount: 0
                });
                fetchInvoices();
                refreshProject();
            }
        } catch (e) { console.error(e); }
        finally { setSubmitting(false); }
    };

    const handleCreatePV = async () => {
        setSubmitting(true);
        try {
            const res = await fetch('/api/projects/payment-vouchers', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ projectId: project.id, ...pvForm }),
            });
            if (res.ok) {
                setShowPVDialog(false);
                setPvForm({});
                fetchPaymentVouchers();
                refreshProject();
            }
        } catch (e) { console.error(e); }
        finally { setSubmitting(false); }
    };

    const handleCreateLD = async () => {
        setSubmitting(true);
        try {
            const res = await fetch('/api/projects/ld-penalties', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ projectId: project.id, ...ldForm }),
            });
            if (res.ok) {
                setShowLDDialog(false);
                setLdForm({});
                fetchLdPenalties();
            }
        } catch (e) { console.error(e); }
        finally { setSubmitting(false); }
    };

    const handleCreateRetention = async () => {
        setSubmitting(true);
        try {
            const res = await fetch('/api/projects/retentions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ projectId: project.id, ...retForm }),
            });
            if (res.ok) {
                setShowRetDialog(false);
                setRetForm({});
                fetchRetentions();
            }
        } catch (e) { console.error(e); }
        finally { setSubmitting(false); }
    };

    const handleReleaseRetention = async () => {
        if (!selectedRetention) return;
        setSubmitting(true);
        try {
            const res = await fetch('/api/projects/retentions', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: selectedRetention.id,
                    action: 'RELEASE',
                    ...releaseForm,
                }),
            });
            if (res.ok) {
                setShowReleaseDialog(false);
                setSelectedRetention(null);
                setReleaseForm({});
                fetchRetentions();
            }
        } catch (e) { console.error(e); }
        finally { setSubmitting(false); }
    };

    const handleStatusUpdate = async (
        endpoint: string,
        id: string,
        status: string,
        extra: { paidAmount?: number; rejectionReason?: string } = {}
    ) => {
        await fetch(endpoint, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, status, approvedById: 'system', ...extra }),
        });
        fetchInvoices();
        fetchPaymentVouchers();
        fetchLdPenalties();
    };

    const statusBadge = (status: string, colorMap?: Record<string, string>) => {
        const colors: Record<string, string> = colorMap || {
            DRAFT: 'bg-slate-100 text-slate-600',
            PENDING: 'bg-yellow-100 text-yellow-700',
            PROPOSED: 'bg-orange-100 text-orange-700',
            APPROVED: 'bg-green-100 text-green-700',
            REJECTED: 'bg-red-100 text-red-700',
            CANCELLED: 'bg-slate-100 text-slate-500',
            ISSUED: 'bg-blue-100 text-blue-700',
            PAID: 'bg-emerald-100 text-emerald-700',
            PARTIALLY_PAID: 'bg-amber-100 text-amber-700',
            FULLY_PAID: 'bg-green-100 text-green-700',
            OVERDUE: 'bg-red-100 text-red-700',
            COLLECTED: 'bg-emerald-100 text-emerald-700',
            WAIVED: 'bg-purple-100 text-purple-700',
            HELD: 'bg-slate-100 text-slate-600',
            PARTIALLY_RELEASED: 'bg-amber-100 text-amber-700',
            FULLY_RELEASED: 'bg-green-100 text-green-700',
            PENDING_APPROVAL: 'bg-yellow-100 text-yellow-700',
        };
        return <Badge className={colors[status] || 'bg-slate-100'}>{status.replace(/_/g, ' ')}</Badge>;
    };

    const totalFor = <T,>(arr: T[], field: keyof T): number =>
        arr.reduce((sum: number, item: T) => sum + Number(item[field] || 0), 0);

    return (
        <div className="space-y-6">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="bg-white border border-slate-200 p-1">
                    <TabsTrigger value="invoices" className="flex items-center gap-2">
                        <ReceiptText className="w-4 h-4" /> Invoices
                    </TabsTrigger>
                    <TabsTrigger value="payments" className="flex items-center gap-2">
                        <Wallet className="w-4 h-4" /> Payments
                    </TabsTrigger>
                    <TabsTrigger value="ld-penalties" className="flex items-center gap-2">
                        <Gavel className="w-4 h-4" /> LD & Penalties
                    </TabsTrigger>
                    <TabsTrigger value="retentions" className="flex items-center gap-2">
                        <Lock className="w-4 h-4" /> Retentions
                    </TabsTrigger>
                </TabsList>

                {/* INVOICES TAB */}
                <TabsContent value="invoices" className="space-y-4 mt-4">
                    <div className="flex justify-between items-center">
                        <div>
                            <h3 className="text-lg font-semibold">Client Invoices</h3>
                            <p className="text-sm text-slate-500">
                                Total: LKR {totalFor(invoices, 'totalAmount').toLocaleString()} |
                                Paid: LKR {totalFor(invoices, 'paidAmount').toLocaleString()} |
                                Balance: LKR {totalFor(invoices, 'balanceAmount').toLocaleString()}
                            </p>
                        </div>
                        <Dialog open={showInvDialog} onOpenChange={setShowInvDialog}>
                            <DialogTrigger asChild>
                                <Button size="sm"><Plus className="w-4 h-4 mr-1" /> New Invoice</Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-2xl">
                                <DialogHeader><DialogTitle>Create Invoice</DialogTitle></DialogHeader>
                                <div className="space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <Label>Title</Label>
                                            <Input value={invForm.title || ''} onChange={e => setInvForm({ ...invForm, title: e.target.value })} placeholder="Invoice title" />
                                        </div>
                                        <div>
                                            <Label>Type</Label>
                                            <Select value={invForm.type || 'CLIENT'} onValueChange={v => setInvForm({ ...invForm, type: v })}>
                                                <SelectTrigger><SelectValue /></SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="CLIENT">Client Invoice</SelectItem>
                                                    <SelectItem value="CONTRACTOR">Contractor Invoice</SelectItem>
                                                    <SelectItem value="INTERNAL">Internal</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <Label>Invoice Date</Label>
                                            <Input type="date" value={invForm.invoiceDate?.split('T')[0] || ''} onChange={e => setInvForm({ ...invForm, invoiceDate: e.target.value })} />
                                        </div>
                                        <div>
                                            <Label>Due Date</Label>
                                            <Input type="date" value={invForm.dueDate?.split('T')[0] || ''} onChange={e => setInvForm({ ...invForm, dueDate: e.target.value })} />
                                        </div>
                                    </div>
                                    <div>
                                        <Label>Reference No (Client PO/SO)</Label>
                                        <Input value={invForm.referenceNumber || ''} onChange={e => setInvForm({ ...invForm, referenceNumber: e.target.value })} />
                                    </div>
                                    <div>
                                        <Label>Items</Label>
                                        {invForm.items?.map((item: InvoiceItem, i: number) => (
                                            <div key={i} className="grid grid-cols-5 gap-2 mt-2">
                                                <Input placeholder="Description" value={item.description} onChange={e => {
                                                    const items = [...invForm.items]; items[i].description = e.target.value;
                                                    setInvForm({ ...invForm, items });
                                                }} />
                                                <Input type="number" placeholder="Qty" value={item.quantity} onChange={e => {
                                                    const items = [...invForm.items]; items[i].quantity = +e.target.value;
                                                    setInvForm({ ...invForm, items });
                                                }} />
                                                <Input type="number" placeholder="Unit Price" value={item.unitPrice} onChange={e => {
                                                    const items = [...invForm.items]; items[i].unitPrice = +e.target.value;
                                                    setInvForm({ ...invForm, items });
                                                }} />
                                                <Select value={item.itemType || 'SERVICE'} onValueChange={v => {
                                                    const items = [...invForm.items]; items[i].itemType = v;
                                                    setInvForm({ ...invForm, items });
                                                }}>
                                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="SERVICE">Service</SelectItem>
                                                        <SelectItem value="MATERIAL">Material</SelectItem>
                                                        <SelectItem value="EQUIPMENT">Equipment</SelectItem>
                                                        <SelectItem value="MISC">Misc</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                                <Button variant="ghost" size="sm" onClick={() =>
                                                    setInvForm({ ...invForm, items: invForm.items.filter((_item: InvoiceItem, j: number) => j !== i) })
                                                }><XCircle className="w-4 h-4 text-red-500" /></Button>
                                            </div>
                                        ))}
                                        <Button variant="outline" size="sm" className="mt-2" onClick={() =>
                                            setInvForm({ ...invForm, items: [...invForm.items, { description: '', quantity: 1, unitPrice: 0, itemType: 'SERVICE' }] })
                                        }><Plus className="w-4 h-4 mr-1" /> Add Item</Button>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <Label>Tax Amount</Label>
                                            <Input type="number" value={invForm.taxAmount || 0} onChange={e => setInvForm({ ...invForm, taxAmount: +e.target.value })} />
                                        </div>
                                        <div>
                                            <Label>Discount Amount</Label>
                                            <Input type="number" value={invForm.discountAmount || 0} onChange={e => setInvForm({ ...invForm, discountAmount: +e.target.value })} />
                                        </div>
                                    </div>
                                    <div>
                                        <Label>Notes</Label>
                                        <Textarea value={invForm.notes || ''} onChange={e => setInvForm({ ...invForm, notes: e.target.value })} />
                                    </div>
                                </div>
                                <DialogFooter>
                                    <Button variant="outline" onClick={() => setShowInvDialog(false)}>Cancel</Button>
                                    <Button onClick={handleCreateInvoice} disabled={submitting}>
                                        {submitting && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
                                        Create Invoice
                                    </Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>
                    </div>

                    {loading ? (
                        <div className="flex justify-center py-8"><Loader2 className="w-8 h-8 animate-spin text-slate-400" /></div>
                    ) : invoices.length === 0 ? (
                        <div className="text-center py-12 text-slate-400">
                            <ReceiptText className="w-12 h-12 mx-auto mb-2 opacity-50" />
                            <p>No invoices yet. Create one to bill the client.</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {invoices.map((inv: Invoice) => (
                                <div key={inv.id} className="bg-white rounded-lg border border-slate-200 p-4">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <span className="font-semibold text-sm text-blue-600">{inv.invoiceNumber}</span>
                                                {statusBadge(inv.status)}
                                                {new Date(inv.dueDate) < new Date() && inv.status === 'ISSUED' && (
                                                    <Badge className="bg-red-100 text-red-700">OVERDUE</Badge>
                                                )}
                                            </div>
                                            <h4 className="font-medium mt-1">{inv.title}</h4>
                                            <div className="flex gap-4 mt-2 text-sm text-slate-500">
                                                <span>Items: {inv.items?.length || 0}</span>
                                                <span>Total: LKR {inv.totalAmount?.toLocaleString()}</span>
                                                <span>Paid: LKR {inv.paidAmount?.toLocaleString()}</span>
                                                <span>Balance: LKR {inv.balanceAmount?.toLocaleString()}</span>
                                                <span>Due: {inv.dueDate ? new Date(inv.dueDate).toLocaleDateString() : 'N/A'}</span>
                                            </div>
                                            {inv.referenceNumber && (
                                                <p className="text-xs text-slate-400 mt-1">Ref: {inv.referenceNumber}</p>
                                            )}
                                        </div>
                                        <div className="flex gap-2">
                                            {inv.status === 'DRAFT' && (
                                                <Button size="sm" variant="outline" onClick={() => handleStatusUpdate('/api/projects/invoices', inv.id, 'ISSUED')}>
                                                    <CheckCircle className="w-4 h-4 mr-1" /> Issue
                                                </Button>
                                            )}
                                            {(inv.status === 'ISSUED' || inv.status === 'PARTIALLY_PAID') && (
                                                <Button size="sm" variant="outline" onClick={() => handleStatusUpdate('/api/projects/invoices', inv.id, '', { paidAmount: inv.balanceAmount })}>
                                                    <Banknote className="w-4 h-4 mr-1" /> Mark Paid
                                                </Button>
                                            )}
                                            <Dialog>
                                                <DialogTrigger asChild>
                                                    <Button size="sm" variant="ghost"><Eye className="w-4 h-4" /></Button>
                                                </DialogTrigger>
                                                <DialogContent className="max-w-lg">
                                                    <DialogHeader><DialogTitle>{inv.invoiceNumber} - {inv.title}</DialogTitle></DialogHeader>
                                                    <div className="space-y-2">
                                                        <div className="flex justify-between text-sm text-slate-500">
                                                            <span>Date: {new Date(inv.invoiceDate).toLocaleDateString()}</span>
                                                            <span>Due: {inv.dueDate ? new Date(inv.dueDate).toLocaleDateString() : 'N/A'}</span>
                                                        </div>
                                                        {inv.items?.map((item: InvoiceItem, i: number) => (
                                                            <div key={i} className="flex justify-between text-sm py-2 border-b">
                                                                <span>{item.description}</span>
                                                                <span>{item.quantity} x LKR {item.unitPrice} = LKR {item.totalPrice?.toLocaleString()}</span>
                                                            </div>
                                                        ))}
                                                        <div className="space-y-1 pt-2 border-t">
                                                            <div className="flex justify-between text-sm"><span>Subtotal</span><span>LKR {inv.subtotal?.toLocaleString()}</span></div>
                                                            {inv.taxAmount && inv.taxAmount > 0 && <div className="flex justify-between text-sm"><span>Tax</span><span>LKR {inv.taxAmount?.toLocaleString()}</span></div>}
                                                            {inv.discountAmount && inv.discountAmount > 0 && <div className="flex justify-between text-sm"><span>Discount</span><span>-LKR {inv.discountAmount?.toLocaleString()}</span></div>}
                                                            <div className="flex justify-between font-semibold"><span>Total</span><span>LKR {inv.totalAmount?.toLocaleString()}</span></div>
                                                            <div className="flex justify-between text-sm text-green-600"><span>Paid</span><span>LKR {inv.paidAmount?.toLocaleString()}</span></div>
                                                            <div className="flex justify-between text-sm text-red-600"><span>Balance</span><span>LKR {inv.balanceAmount?.toLocaleString()}</span></div>
                                                        </div>
                                                    </div>
                                                </DialogContent>
                                            </Dialog>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </TabsContent>

                {/* PAYMENTS TAB */}
                <TabsContent value="payments" className="space-y-4 mt-4">
                    <div className="flex justify-between items-center">
                        <div>
                            <h3 className="text-lg font-semibold">Payment Vouchers</h3>
                            <p className="text-sm text-slate-500">
                                Total: LKR {totalFor(paymentVouchers, 'amount').toLocaleString()} |
                                Net: LKR {totalFor(paymentVouchers, 'netAmount').toLocaleString()}
                            </p>
                        </div>
                        <Dialog open={showPVDialog} onOpenChange={setShowPVDialog}>
                            <DialogTrigger asChild>
                                <Button size="sm"><Plus className="w-4 h-4 mr-1" /> New Payment</Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-2xl">
                                <DialogHeader><DialogTitle>Create Payment Voucher</DialogTitle></DialogHeader>
                                <div className="space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <Label>Title</Label>
                                            <Input value={pvForm.title || ''} onChange={e => setPvForm({ ...pvForm, title: e.target.value })} />
                                        </div>
                                        <div>
                                            <Label>Type</Label>
                                            <Select value={pvForm.type || 'CONTRACTOR'} onValueChange={v => setPvForm({ ...pvForm, type: v })}>
                                                <SelectTrigger><SelectValue /></SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="CONTRACTOR">Contractor</SelectItem>
                                                    <SelectItem value="VENDOR">Vendor</SelectItem>
                                                    <SelectItem value="STAFF">Staff</SelectItem>
                                                    <SelectItem value="CLIENT_REFUND">Client Refund</SelectItem>
                                                    <SelectItem value="MISC">Misc</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                    <div>
                                        <Label>Payee Name</Label>
                                        <Input value={pvForm.payeeName || ''} onChange={e => setPvForm({ ...pvForm, payeeName: e.target.value })} />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <Label>Amount</Label>
                                            <Input type="number" value={pvForm.amount || ''} onChange={e => setPvForm({ ...pvForm, amount: +e.target.value })} />
                                        </div>
                                        <div>
                                            <Label>Payment Date</Label>
                                            <Input type="date" value={pvForm.paymentDate?.split('T')[0] || ''} onChange={e => setPvForm({ ...pvForm, paymentDate: e.target.value })} />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <Label>Payment Method</Label>
                                            <Select value={pvForm.paymentMethod || ''} onValueChange={v => setPvForm({ ...pvForm, paymentMethod: v })}>
                                                <SelectTrigger><SelectValue placeholder="Select method" /></SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="BANK_TRANSFER">Bank Transfer</SelectItem>
                                                    <SelectItem value="CHEQUE">Cheque</SelectItem>
                                                    <SelectItem value="CASH">Cash</SelectItem>
                                                    <SelectItem value="CARD">Card</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div>
                                            <Label>Invoice (optional)</Label>
                                            <Select value={pvForm.invoiceId || ''} onValueChange={v => setPvForm({ ...pvForm, invoiceId: v })}>
                                                <SelectTrigger><SelectValue placeholder="Link to invoice" /></SelectTrigger>
                                                <SelectContent>
                                                    {invoices.filter(i => i.status !== 'CANCELLED' && i.status !== 'FULLY_PAID').map((inv: Invoice) => (
                                                        <SelectItem key={inv.id} value={inv.id}>
                                                            {inv.invoiceNumber} - LKR {inv.balanceAmount?.toLocaleString()}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <Label>Tax Withheld</Label>
                                            <Input type="number" value={pvForm.taxWithheld || 0} onChange={e => setPvForm({ ...pvForm, taxWithheld: +e.target.value })} />
                                        </div>
                                        <div>
                                            <Label>Retention Amount</Label>
                                            <Input type="number" value={pvForm.retentionAmount || 0} onChange={e => setPvForm({ ...pvForm, retentionAmount: +e.target.value })} />
                                        </div>
                                    </div>
                                    <div>
                                        <Label>Notes</Label>
                                        <Textarea value={pvForm.notes || ''} onChange={e => setPvForm({ ...pvForm, notes: e.target.value })} />
                                    </div>
                                </div>
                                <DialogFooter>
                                    <Button variant="outline" onClick={() => setShowPVDialog(false)}>Cancel</Button>
                                    <Button onClick={handleCreatePV} disabled={submitting}>
                                        {submitting && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
                                        Create Voucher
                                    </Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>
                    </div>

                    {paymentVouchers.length === 0 ? (
                        <div className="text-center py-12 text-slate-400">
                            <Wallet className="w-12 h-12 mx-auto mb-2 opacity-50" />
                            <p>No payment vouchers yet.</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {paymentVouchers.map((pv: PaymentVoucher) => (
                                <div key={pv.id} className="bg-white rounded-lg border border-slate-200 p-4">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <span className="font-semibold text-sm text-purple-600">{pv.pvNumber}</span>
                                                {statusBadge(pv.status)}
                                            </div>
                                            <h4 className="font-medium mt-1">{pv.title}</h4>
                                            <p className="text-sm text-slate-500">Payee: {pv.payeeName}</p>
                                            <div className="flex gap-4 mt-2 text-sm text-slate-500">
                                                <span>Amount: LKR {pv.amount?.toLocaleString()}</span>
                                                <span>Net: LKR {pv.netAmount?.toLocaleString()}</span>
                                                <span>Type: {pv.type}</span>
                                                {pv.invoice && <span>Invoice: {pv.invoice.invoiceNumber}</span>}
                                                {pv.paymentDate && <span>Date: {new Date(pv.paymentDate).toLocaleDateString()}</span>}
                                            </div>
                                        </div>
                                        <div className="flex gap-2">
                                            {pv.status === 'DRAFT' && (
                                                <Button size="sm" variant="outline" onClick={() => handleStatusUpdate('/api/projects/payment-vouchers', pv.id, 'PENDING_APPROVAL')}>
                                                    <ArrowUpDown className="w-4 h-4 mr-1" /> Submit
                                                </Button>
                                            )}
                                            {pv.status === 'PENDING_APPROVAL' && (
                                                <>
                                                    <Button size="sm" variant="outline" className="text-green-600" onClick={() => handleStatusUpdate('/api/projects/payment-vouchers', pv.id, 'APPROVED')}>
                                                        <CheckCircle className="w-4 h-4 mr-1" /> Approve
                                                    </Button>
                                                    <Button size="sm" variant="outline" className="text-red-600" onClick={() => handleStatusUpdate('/api/projects/payment-vouchers', pv.id, 'REJECTED', { rejectionReason: 'Rejected' })}>
                                                        <XCircle className="w-4 h-4 mr-1" /> Reject
                                                    </Button>
                                                </>
                                            )}
                                            {pv.status === 'APPROVED' && (
                                                <Button size="sm" variant="outline" className="text-emerald-600" onClick={() => handleStatusUpdate('/api/projects/payment-vouchers', pv.id, 'PAID')}>
                                                    <Banknote className="w-4 h-4 mr-1" /> Mark Paid
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </TabsContent>

                {/* LD & PENALTIES TAB */}
                <TabsContent value="ld-penalties" className="space-y-4 mt-4">
                    <div className="flex justify-between items-center">
                        <div>
                            <h3 className="text-lg font-semibold">LD & Penalties</h3>
                            <p className="text-sm text-slate-500">
                                Total: LKR {totalFor(ldPenalties, 'amount').toLocaleString()} |
                                Net: LKR {totalFor(ldPenalties, 'netAmount').toLocaleString()}
                            </p>
                        </div>
                        <Dialog open={showLDDialog} onOpenChange={setShowLDDialog}>
                            <DialogTrigger asChild>
                                <Button size="sm"><Plus className="w-4 h-4 mr-1" /> New LD/Penalty</Button>
                            </DialogTrigger>
                            <DialogContent>
                                <DialogHeader><DialogTitle>Add LD / Penalty</DialogTitle></DialogHeader>
                                <div className="space-y-4">
                                    <div>
                                        <Label>Title</Label>
                                        <Input value={ldForm.title || ''} onChange={e => setLdForm({ ...ldForm, title: e.target.value })} />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <Label>Type</Label>
                                            <Select value={ldForm.type || 'LD'} onValueChange={v => setLdForm({ ...ldForm, type: v })}>
                                                <SelectTrigger><SelectValue /></SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="LD">Liquidated Damages</SelectItem>
                                                    <SelectItem value="PENALTY">Penalty</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div>
                                            <Label>Category</Label>
                                            <Select value={ldForm.category || 'DELAY'} onValueChange={v => setLdForm({ ...ldForm, category: v })}>
                                                <SelectTrigger><SelectValue /></SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="DELAY">Delay</SelectItem>
                                                    <SelectItem value="QUALITY">Quality</SelectItem>
                                                    <SelectItem value="SAFETY">Safety</SelectItem>
                                                    <SelectItem value="PERFORMANCE">Performance</SelectItem>
                                                    <SelectItem value="OTHER">Other</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                    <div>
                                        <Label>Amount (LKR)</Label>
                                        <Input type="number" value={ldForm.amount || ''} onChange={e => setLdForm({ ...ldForm, amount: +e.target.value })} />
                                    </div>
                                    <div>
                                        <Label>Percentage (e.g., 0.5% per week)</Label>
                                        <Input type="number" step="0.01" value={ldForm.percentage || ''} onChange={e => setLdForm({ ...ldForm, percentage: +e.target.value })} />
                                    </div>
                                    <div>
                                        <Label>Description</Label>
                                        <Textarea value={ldForm.description || ''} onChange={e => setLdForm({ ...ldForm, description: e.target.value })} />
                                    </div>
                                </div>
                                <DialogFooter>
                                    <Button variant="outline" onClick={() => setShowLDDialog(false)}>Cancel</Button>
                                    <Button onClick={handleCreateLD} disabled={submitting}>
                                        {submitting && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
                                        Create
                                    </Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>
                    </div>

                    {ldPenalties.length === 0 ? (
                        <div className="text-center py-12 text-slate-400">
                            <Gavel className="w-12 h-12 mx-auto mb-2 opacity-50" />
                            <p>No LD or penalties recorded.</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {ldPenalties.map((ld: LDPenalty) => (
                                <div key={ld.id} className="bg-white rounded-lg border border-slate-200 p-4">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <Badge className={ld.type === 'LD' ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'}>
                                                    {ld.type}
                                                </Badge>
                                                {statusBadge(ld.status)}
                                                <span className="text-xs text-slate-400">{ld.category}</span>
                                            </div>
                                            <h4 className="font-medium mt-1">{ld.title}</h4>
                                            <p className="text-sm text-slate-500 mt-1">{ld.description}</p>
                                            <div className="flex gap-4 mt-2 text-sm text-slate-500">
                                                <span>Amount: LKR {ld.amount?.toLocaleString()}</span>
                                                {ld.waivedAmount > 0 && <span>Waived: LKR {ld.waivedAmount?.toLocaleString()}</span>}
                                                <span>Net: LKR {ld.netAmount?.toLocaleString()}</span>
                                                {ld.percentage && <span>({ld.percentage}%)</span>}
                                                {ld.appliedDate && <span>Applied: {new Date(ld.appliedDate).toLocaleDateString()}</span>}
                                            </div>
                                        </div>
                                        <div className="flex gap-2">
                                            {ld.status === 'PROPOSED' && (
                                                <>
                                                    <Button size="sm" variant="outline" className="text-green-600" onClick={() => handleStatusUpdate('/api/projects/ld-penalties', ld.id, 'APPROVED')}>
                                                        <CheckCircle className="w-4 h-4 mr-1" /> Approve
                                                    </Button>
                                                    <Button size="sm" variant="outline" className="text-purple-600" onClick={() => handleStatusUpdate('/api/projects/ld-penalties', ld.id, 'WAIVED')}>
                                                        <XCircle className="w-4 h-4 mr-1" /> Waive
                                                    </Button>
                                                </>
                                            )}
                                            {ld.status === 'APPROVED' && (
                                                <Button size="sm" variant="outline" className="text-emerald-600" onClick={() => handleStatusUpdate('/api/projects/ld-penalties', ld.id, 'COLLECTED')}>
                                                    <Banknote className="w-4 h-4 mr-1" /> Collect
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </TabsContent>

                {/* RETENTIONS TAB */}
                <TabsContent value="retentions" className="space-y-4 mt-4">
                    <div className="flex justify-between items-center">
                        <div>
                            <h3 className="text-lg font-semibold">Retention Money</h3>
                            <p className="text-sm text-slate-500">
                                Held: LKR {totalFor(retentions, 'retentionAmount').toLocaleString()} |
                                Released: LKR {totalFor(retentions, 'releasedAmount').toLocaleString()} |
                                Balance: LKR {totalFor(retentions, 'balanceAmount').toLocaleString()}
                            </p>
                        </div>
                        <Dialog open={showRetDialog} onOpenChange={setShowRetDialog}>
                            <DialogTrigger asChild>
                                <Button size="sm"><Plus className="w-4 h-4 mr-1" /> New Retention</Button>
                            </DialogTrigger>
                            <DialogContent>
                                <DialogHeader><DialogTitle>Create Retention Entry</DialogTitle></DialogHeader>
                                <div className="space-y-4">
                                    <div>
                                        <Label>Title</Label>
                                        <Input value={retForm.title || ''} onChange={e => setRetForm({ ...retForm, title: e.target.value })} />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <Label>Retention %</Label>
                                            <Input type="number" value={retForm.retentionPercent || 10} onChange={e => setRetForm({ ...retForm, retentionPercent: +e.target.value })} />
                                        </div>
                                        <div>
                                            <Label>Amount (LKR)</Label>
                                            <Input type="number" value={retForm.retentionAmount || ''} onChange={e => setRetForm({ ...retForm, retentionAmount: +e.target.value })} />
                                        </div>
                                    </div>
                                    <div>
                                        <Label>Release Condition</Label>
                                        <Select value={retForm.releaseCondition || ''} onValueChange={v => setRetForm({ ...retForm, releaseCondition: v })}>
                                            <SelectTrigger><SelectValue placeholder="Select condition" /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="DEFECT_LIABILITY_PERIOD">Defect Liability Period</SelectItem>
                                                <SelectItem value="COMPLETION_CERTIFICATE">Completion Certificate</SelectItem>
                                                <SelectItem value="HANDOVER">Handover</SelectItem>
                                                <SelectItem value="OTHER">Other</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div>
                                        <Label>Defect Liability Period (days)</Label>
                                        <Input type="number" value={retForm.defectLiabilityPeriod || ''} onChange={e => setRetForm({ ...retForm, defectLiabilityPeriod: +e.target.value })} />
                                    </div>
                                </div>
                                <DialogFooter>
                                    <Button variant="outline" onClick={() => setShowRetDialog(false)}>Cancel</Button>
                                    <Button onClick={handleCreateRetention} disabled={submitting}>
                                        {submitting && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
                                        Create
                                    </Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>
                    </div>

                    {retentions.length === 0 ? (
                        <div className="text-center py-12 text-slate-400">
                            <Lock className="w-12 h-12 mx-auto mb-2 opacity-50" />
                            <p>No retention entries yet.</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {retentions.map((ret: Retention) => (
                                <div key={ret.id} className="bg-white rounded-lg border border-slate-200 p-4">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <div className="flex items-center gap-2">
                                                {statusBadge(ret.status)}
                                                <span className="text-xs text-slate-400">{ret.retentionPercent}%</span>
                                            </div>
                                            <h4 className="font-medium mt-1">{ret.title}</h4>
                                            <div className="flex gap-4 mt-2 text-sm text-slate-500">
                                                <span>Held: LKR {ret.retentionAmount?.toLocaleString()}</span>
                                                <span>Released: LKR {ret.releasedAmount?.toLocaleString()}</span>
                                                <span>Balance: LKR {ret.balanceAmount?.toLocaleString()}</span>
                                            </div>
                                            {ret.releaseCondition && (
                                                <p className="text-xs text-slate-400 mt-1">Condition: {ret.releaseCondition.replace(/_/g, ' ')}</p>
                                            )}
                                            {ret.releases && ret.releases.length > 0 && (
                                                <details className="mt-2">
                                                    <summary className="text-xs text-blue-500 cursor-pointer">View Release History ({ret.releases.length})</summary>
                                                    <div className="mt-2 space-y-1">
                                                        {ret.releases.map((rel: RetentionRelease) => (
                                                            <div key={rel.id} className="flex justify-between text-xs text-slate-500 bg-slate-50 p-2 rounded">
                                                                <span>LKR {rel.releaseAmount?.toLocaleString()}</span>
                                                                <span>{new Date(rel.releaseDate).toLocaleDateString()}</span>
                                                                {rel.remarks && <span>{rel.remarks}</span>}
                                                            </div>
                                                        ))}
                                                    </div>
                                                </details>
                                            )}
                                        </div>
                                        <div className="flex gap-2">
                                            {ret.status !== 'FULLY_RELEASED' && (
                                                <Button size="sm" variant="outline" onClick={() => {
                                                    setSelectedRetention(ret);
                                                    setReleaseForm({});
                                                    setShowReleaseDialog(true);
                                                }}>
                                                    <Banknote className="w-4 h-4 mr-1" /> Release
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Release Dialog */}
                    <Dialog open={showReleaseDialog} onOpenChange={setShowReleaseDialog}>
                        <DialogContent>
                            <DialogHeader><DialogTitle>Release Retention</DialogTitle></DialogHeader>
                            <div className="space-y-4">
                                <p className="text-sm text-slate-500">
                                    Retention: <strong>LKR {selectedRetention?.balanceAmount?.toLocaleString()}</strong> remaining
                                </p>
                                <div>
                                    <Label>Release Amount</Label>
                                    <Input type="number" value={releaseForm.releaseAmount || ''} onChange={e => setReleaseForm({ ...releaseForm, releaseAmount: +e.target.value })} max={selectedRetention?.balanceAmount} />
                                </div>
                                <div>
                                    <Label>Release Date</Label>
                                    <Input type="date" value={releaseForm.releaseDate?.split('T')[0] || new Date().toISOString().split('T')[0]} onChange={e => setReleaseForm({ ...releaseForm, releaseDate: e.target.value })} />
                                </div>
                                <div>
                                    <Label>Remarks</Label>
                                    <Textarea value={releaseForm.remarks || ''} onChange={e => setReleaseForm({ ...releaseForm, remarks: e.target.value })} />
                                </div>
                            </div>
                            <DialogFooter>
                                <Button variant="outline" onClick={() => setShowReleaseDialog(false)}>Cancel</Button>
                                <Button onClick={handleReleaseRetention} disabled={submitting}>
                                    {submitting && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
                                    Release
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </TabsContent>
            </Tabs>
        </div>
    );
}

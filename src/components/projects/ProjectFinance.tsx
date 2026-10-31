'use client';

import { useState, useEffect, useCallback } from 'react';
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
import { toast } from 'sonner';
import ProjectFinanceAssignments from '@/components/projects/ProjectFinanceAssignments';
import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';

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
    type: string;
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
    contractorId?: string | null;
    submissionStatus?: string;
    paymentStatus?: string;
    submittedAt?: string | null;
    submissionReference?: string | null;
    paymentReceivedAt?: string | null;
    paymentReference?: string | null;
    customerReceipts?: { receiptNumber: string; amount: number; paymentMethod: string; referenceNumber?: string | null; receiptDate: string }[];
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
    contractorId?: string;
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

interface ReceiptForm {
    invoiceId?: string;
    amount?: number;
    paymentMethod?: string;
    referenceNumber?: string;
    receiptDate?: string;
    notes?: string;
}

interface ProjectFinanceProps {
    project: Project;
    refreshProject: () => void;
}

async function getResponseError(response: Response, fallback: string) {
    try {
        const body: unknown = await response.json();
        if (body && typeof body === 'object') {
            const message = (body as { error?: unknown; message?: unknown }).error
                ?? (body as { message?: unknown }).message;
            if (typeof message === 'string' && message.trim()) return message;
        }
    } catch {
        // Fall back to a clear operation-specific message for non-JSON errors.
    }
    return fallback;
}

function getErrorMessage(error: unknown, fallback: string) {
    return error instanceof Error && error.message ? error.message : fallback;
}

export default function ProjectFinance({ project, refreshProject }: ProjectFinanceProps) {
    return <ProjectFinanceContent key={project.id} project={project} refreshProject={refreshProject} />;
}

function ProjectFinanceContent({ project, refreshProject }: ProjectFinanceProps) {
    const [permissions, setPermissions] = useState<string[]>([]);
    useEffect(() => {
        const update = () => {
            try {
                const user = JSON.parse(localStorage.getItem('user') || 'null');
                setPermissions(Array.isArray(user?.permissions) ? user.permissions : []);
            } catch { setPermissions([]); }
        };
        update();
        window.addEventListener('storage', update);
        return () => window.removeEventListener('storage', update);
    }, []);
    const canWrite = permissions.includes(RBAC_PERMISSIONS.PROJECT_FINANCE_WRITE);
    const canApprove = permissions.includes(RBAC_PERMISSIONS.PROJECT_FINANCE_APPROVE);
    const [voucherLoading, setVoucherLoading] = useState(true);
    const [voucherError, setVoucherError] = useState<string | null>(null);
    const [ldLoading, setLdLoading] = useState(true);
    const [ldError, setLdError] = useState<string | null>(null);
    const [retentionLoading, setRetentionLoading] = useState(true);
    const [retentionError, setRetentionError] = useState<string | null>(null);
    const [invoiceError, setInvoiceError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState('invoices');
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [paymentVouchers, setPaymentVouchers] = useState<PaymentVoucher[]>([]);
    const [ldPenalties, setLdPenalties] = useState<LDPenalty[]>([]);
    const [retentions, setRetentions] = useState<Retention[]>([]);
    const [contractorAssignments, setContractorAssignments] = useState<{ contractorId: string; role: string; contractor: { id: string; name: string } }[]>([]);
    const [loading, setLoading] = useState(true);

    // Dialog states
    const [showInvDialog, setShowInvDialog] = useState(false);
    const [showPVDialog, setShowPVDialog] = useState(false);
    const [showLDDialog, setShowLDDialog] = useState(false);
    const [showRetDialog, setShowRetDialog] = useState(false);
    const [showReleaseDialog, setShowReleaseDialog] = useState(false);
    const [showReceiptDialog, setShowReceiptDialog] = useState(false);
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
    const [receiptForm, setReceiptForm] = useState<ReceiptForm>({});

    const fetchInvoices = useCallback(async () => {
        setLoading(true);
        setInvoiceError(null);
        try {
            const res = await fetch(`/api/projects/invoices?projectId=${project.id}`);
            if (!res.ok) throw new Error(await getResponseError(res, 'Unable to load invoices.'));
            setInvoices(await res.json());
        } catch (error) {
            setInvoices([]);
            setInvoiceError(getErrorMessage(error, 'Unable to load invoices.'));
        }
        finally { setLoading(false); }
    }, [project.id]);

    const fetchPaymentVouchers = useCallback(async () => {
        setVoucherLoading(true);
        setVoucherError(null);
        try {
            const res = await fetch(`/api/projects/payment-vouchers?projectId=${project.id}`);
            if (!res.ok) throw new Error(await getResponseError(res, 'Unable to load payment vouchers.'));
            setPaymentVouchers(await res.json());
        } catch (error) {
            setPaymentVouchers([]);
            setVoucherError(getErrorMessage(error, 'Unable to load payment vouchers.'));
        } finally { setVoucherLoading(false); }
    }, [project.id]);

    const fetchLdPenalties = useCallback(async () => {
        setLdLoading(true);
        setLdError(null);
        try {
            const res = await fetch(`/api/projects/ld-penalties?projectId=${project.id}`);
            if (!res.ok) throw new Error(await getResponseError(res, 'Unable to load LD and penalties.'));
            setLdPenalties(await res.json());
        } catch (error) {
            setLdPenalties([]);
            setLdError(getErrorMessage(error, 'Unable to load LD and penalties.'));
        } finally { setLdLoading(false); }
    }, [project.id]);

    const fetchRetentions = useCallback(async () => {
        setRetentionLoading(true);
        setRetentionError(null);
        try {
            const res = await fetch(`/api/projects/retentions?projectId=${project.id}`);
            if (!res.ok) throw new Error(await getResponseError(res, 'Unable to load retentions.'));
            setRetentions(await res.json());
        } catch (error) {
            setRetentions([]);
            setRetentionError(getErrorMessage(error, 'Unable to load retentions.'));
        } finally { setRetentionLoading(false); }
    }, [project.id]);

    const fetchContractorAssignments = useCallback(async () => {
        try {
            const res = await fetch(`/api/projects/contractor-assignments?projectId=${project.id}`);
            if (res.ok) setContractorAssignments(await res.json());
        } catch {
            toast.error('Unable to load contractor work packages.');
        }
    }, [project.id]);

    useEffect(() => {
        if (project?.id) {
            fetchInvoices();
            fetchPaymentVouchers();
            fetchLdPenalties();
            fetchRetentions();
            fetchContractorAssignments();
        }
    }, [project?.id, fetchInvoices, fetchPaymentVouchers, fetchLdPenalties, fetchRetentions, fetchContractorAssignments]);

    const handleCreateInvoice = async () => {
        if (!canWrite) return;
        if (!window.confirm('Create this invoice? Review the dates, line items, and totals before continuing.')) return;
        setSubmitting(true);
        try {
            const res = await fetch('/api/projects/invoices', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ projectId: project.id, ...invForm }),
            });
            if (!res.ok) throw new Error(await getResponseError(res, 'Unable to create the invoice.'));
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
            toast.success('Invoice created.');
            await fetchInvoices();
            refreshProject();
        } catch (error) {
            toast.error(getErrorMessage(error, 'Unable to create the invoice.'));
        }
        finally { setSubmitting(false); }
    };

    const handleCreatePV = async () => {
        if (!canWrite) return;
        if (!window.confirm('Create this payment voucher? Verify the payee, amount, and linked invoice before continuing.')) return;
        setSubmitting(true);
        try {
            const res = await fetch('/api/projects/payment-vouchers', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ projectId: project.id, ...pvForm }),
            });
            if (!res.ok) throw new Error(await getResponseError(res, 'Unable to create the payment voucher.'));
            setShowPVDialog(false);
            setPvForm({});
            toast.success('Payment voucher created.');
            await fetchPaymentVouchers();
            refreshProject();
        } catch (error) {
            toast.error(getErrorMessage(error, 'Unable to create the payment voucher.'));
        }
        finally { setSubmitting(false); }
    };

    const handleCreateLD = async () => {
        if (!canWrite) return;
        if (!window.confirm('Create this LD or penalty entry? This creates a financial record.')) return;
        setSubmitting(true);
        try {
            const res = await fetch('/api/projects/ld-penalties', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ projectId: project.id, ...ldForm }),
            });
            if (!res.ok) throw new Error(await getResponseError(res, 'Unable to create the LD or penalty entry.'));
            setShowLDDialog(false);
            setLdForm({});
            toast.success('LD or penalty entry created.');
            await fetchLdPenalties();
        } catch (error) {
            toast.error(getErrorMessage(error, 'Unable to create the LD or penalty entry.'));
        }
        finally { setSubmitting(false); }
    };

    const handleCreateRetention = async () => {
        if (!canWrite) return;
        if (!window.confirm('Create this retention entry? Verify the amount and release conditions before continuing.')) return;
        setSubmitting(true);
        try {
            const res = await fetch('/api/projects/retentions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ projectId: project.id, ...retForm }),
            });
            if (!res.ok) throw new Error(await getResponseError(res, 'Unable to create the retention entry.'));
            setShowRetDialog(false);
            setRetForm({});
            toast.success('Retention entry created.');
            await fetchRetentions();
        } catch (error) {
            toast.error(getErrorMessage(error, 'Unable to create the retention entry.'));
        }
        finally { setSubmitting(false); }
    };

    const handleReleaseRetention = async () => {
        if (!canApprove) return;
        if (!selectedRetention) return;
        if (!window.confirm(`Release LKR ${(releaseForm.releaseAmount || 0).toLocaleString()} from this retention?`)) return;
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
            if (!res.ok) throw new Error(await getResponseError(res, 'Unable to release retention.'));
            setShowReleaseDialog(false);
            setSelectedRetention(null);
            setReleaseForm({});
            toast.success('Retention released.');
            await fetchRetentions();
        } catch (error) {
            toast.error(getErrorMessage(error, 'Unable to release retention.'));
        }
        finally { setSubmitting(false); }
    };

    const handleStatusUpdate = async (
        endpoint: string,
        id: string,
        status: string,
        confirmation: string,
        successMessage: string,
        extra: { rejectionReason?: string } = {}
    ) => {
        const isVoucherSubmission = endpoint === '/api/projects/payment-vouchers'
            && status === 'PENDING_APPROVAL'
            && paymentVouchers.some(voucher => voucher.id === id && voucher.status === 'DRAFT');
        if (isVoucherSubmission ? !canWrite : !canApprove) return;
        if (submitting || !window.confirm(confirmation)) return;
        setSubmitting(true);
        try {
            const res = await fetch(endpoint, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, status, ...extra }),
            });
            if (!res.ok) throw new Error(await getResponseError(res, 'Unable to update the financial record.'));
            toast.success(successMessage);
            await Promise.all([fetchInvoices(), fetchPaymentVouchers(), fetchLdPenalties()]);
        } catch (error) {
            toast.error(getErrorMessage(error, 'Unable to update the financial record.'));
        } finally {
            setSubmitting(false);
        }
    };

    const openPaymentWorkflow = (invoice: Invoice) => {
        if (invoice.type === 'CLIENT' ? !canApprove : !canWrite) return;
        if (invoice.type === 'CLIENT') {
            if (invoice.submissionStatus !== 'SUBMITTED_TO_SLT') {
                toast.error('Submit the invoice to SLT before recording a receipt.');
                return;
            }
            setReceiptForm({
                invoiceId: invoice.id,
                amount: invoice.balanceAmount,
                paymentMethod: 'BANK_TRANSFER',
                receiptDate: new Date().toISOString().split('T')[0],
            });
            setShowReceiptDialog(true);
            return;
        }
        setPvForm({
            title: `Payment for invoice ${invoice.invoiceNumber}`,
            amount: invoice.balanceAmount,
            invoiceId: invoice.id,
            paymentDate: new Date().toISOString().split('T')[0],
        });
        setActiveTab('payments');
        setShowPVDialog(true);
        toast.info('Complete the payment voucher to record payment against this invoice.');
    };

    const handleRecordReceipt = async () => {
        if (!receiptForm.referenceNumber?.trim()) {
            toast.error('Enter a unique bank or receipt reference to prevent duplicate recording.');
            return;
        }
        if (!canApprove) return;
        const selectedInvoice = invoices.find((invoice) => invoice.id === receiptForm.invoiceId);
        const invoiceId = receiptForm.invoiceId;
        if (!invoiceId || !receiptForm.amount || receiptForm.amount <= 0) {
            toast.error('Receipt amount is required.');
            return;
        }
        if (selectedInvoice && receiptForm.amount > selectedInvoice.balanceAmount) {
            toast.error('Receipt amount cannot exceed the invoice balance.');
            return;
        }
        setSubmitting(true);
        try {
            const res = await fetch('/api/projects/invoice-receipts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    invoiceId,
                    amount: receiptForm.amount,
                    paymentMethod: receiptForm.paymentMethod || 'BANK_TRANSFER',
                    referenceNumber: receiptForm.referenceNumber?.trim() || undefined,
                    receiptDate: receiptForm.receiptDate ? new Date(`${receiptForm.receiptDate}T00:00:00.000Z`).toISOString() : undefined,
                    notes: receiptForm.notes?.trim() || undefined,
                }),
            });
            if (!res.ok) throw new Error(await getResponseError(res, 'Unable to record the SLT payment receipt.'));
            toast.success('SLT payment receipt recorded.');
            setShowReceiptDialog(false);
            setReceiptForm({});
            await fetchInvoices();
            refreshProject();
        } catch (error) {
            toast.error(getErrorMessage(error, 'Unable to record the SLT payment receipt.'));
        } finally {
            setSubmitting(false);
        }
    };

    const statusBadge = (status: string, colorMap?: Record<string, string>) => {
        const colors: Record<string, string> = colorMap || {
            DRAFT: 'bg-slate-100 text-slate-800',
            PENDING: 'bg-yellow-100 text-yellow-800',
            PROPOSED: 'bg-orange-100 text-orange-800',
            APPROVED: 'bg-green-100 text-green-800',
            REJECTED: 'bg-red-100 text-red-800',
            CANCELLED: 'bg-slate-100 text-slate-700',
            ISSUED: 'bg-blue-100 text-blue-800',
            PAID: 'bg-emerald-100 text-emerald-800',
            PARTIALLY_PAID: 'bg-amber-100 text-amber-800',
            FULLY_PAID: 'bg-green-100 text-green-800',
            OVERDUE: 'bg-red-100 text-red-800',
            COLLECTED: 'bg-emerald-100 text-emerald-800',
            WAIVED: 'bg-purple-100 text-purple-800',
            HELD: 'bg-slate-100 text-slate-800',
            PARTIALLY_RELEASED: 'bg-amber-100 text-amber-800',
            FULLY_RELEASED: 'bg-green-100 text-green-800',
            PENDING_APPROVAL: 'bg-yellow-100 text-yellow-800',
            NOT_SUBMITTED: 'bg-slate-100 text-slate-800',
            SUBMITTED_TO_SLT: 'bg-blue-100 text-blue-900',
            NOT_DUE: 'bg-slate-100 text-slate-800',
            PENDING_PAYMENT: 'bg-yellow-100 text-yellow-900',
        };
        return <Badge className={colors[status] || 'bg-slate-100'}>{status.replace(/_/g, ' ')}</Badge>;
    };

    const totalFor = <T,>(arr: T[], field: keyof T): number =>
        arr.reduce((sum: number, item: T) => sum + Number(item[field] || 0), 0);

    return (
        <div className="space-y-6">
            <ProjectFinanceAssignments projectId={project.id} />
            <Tabs value={activeTab} onValueChange={setActiveTab}>
                <div className="max-w-full overflow-x-auto pb-1">
                <TabsList className="w-max min-w-full bg-white text-slate-800 border border-slate-200 p-1">
                    <TabsTrigger value="invoices" className="flex items-center gap-2 text-slate-700 data-[state=active]:bg-slate-100 data-[state=active]:text-slate-900">
                        <ReceiptText className="w-4 h-4" /> Invoices
                    </TabsTrigger>
                    <TabsTrigger value="payments" className="flex items-center gap-2 text-slate-700 data-[state=active]:bg-slate-100 data-[state=active]:text-slate-900">
                        <Wallet className="w-4 h-4" /> Payments
                    </TabsTrigger>
                    <TabsTrigger value="ld-penalties" className="flex items-center gap-2 text-slate-700 data-[state=active]:bg-slate-100 data-[state=active]:text-slate-900">
                        <Gavel className="w-4 h-4" /> LD & Penalties
                    </TabsTrigger>
                    <TabsTrigger value="retentions" className="flex items-center gap-2 text-slate-700 data-[state=active]:bg-slate-100 data-[state=active]:text-slate-900">
                        <Lock className="w-4 h-4" /> Retentions
                    </TabsTrigger>
                </TabsList>
                </div>

                {/* INVOICES TAB */}
                <TabsContent value="invoices" className="space-y-4 mt-4">
                    <div className="flex justify-between items-center">
                        <div>
                            <h3 className="text-lg font-semibold text-slate-900">Client Invoices</h3>
                            <p className="text-sm text-slate-600">
                                {loading ? 'Loading totals...' : invoiceError ? 'Totals unavailable until records are reloaded.' : <>
                                Total: LKR {totalFor(invoices, 'totalAmount').toLocaleString()} |
                                Paid: LKR {totalFor(invoices, 'paidAmount').toLocaleString()} |
                                Balance: LKR {totalFor(invoices, 'balanceAmount').toLocaleString()}
                                </>}
                            </p>
                        </div>
                        <Dialog open={showInvDialog} onOpenChange={setShowInvDialog}>
                            {canWrite && <DialogTrigger asChild>
                                <Button size="sm"><Plus className="w-4 h-4 mr-1" /> New Invoice</Button>
                            </DialogTrigger>}
                            <DialogContent className="max-w-2xl max-h-[90dvh] overflow-y-auto bg-white text-slate-900">
                                <DialogHeader><DialogTitle>Create Invoice</DialogTitle></DialogHeader>
                                <div className="space-y-4">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div>
                                            <Label htmlFor="project-finance-field-1" className="text-slate-800">Title</Label>
                                            <Input id="project-finance-field-1" value={invForm.title || ''} onChange={e => setInvForm({ ...invForm, title: e.target.value })} placeholder="Invoice title" />
                                        </div>
                                        <div>
                                            <Label htmlFor="project-finance-field-2" className="text-slate-800">Type</Label>
                                            <Select value={invForm.type || 'CLIENT'} onValueChange={v => setInvForm({ ...invForm, type: v })}>
                                                <SelectTrigger id="project-finance-field-2"><SelectValue /></SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="CLIENT">Client Invoice</SelectItem>
                                                    <SelectItem value="CONTRACTOR">Contractor Invoice</SelectItem>
                                                    <SelectItem value="INTERNAL">Internal</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                    {invForm.type === 'CONTRACTOR' && (
                                        <div>
                                            <Label htmlFor="project-finance-field-3" className="text-slate-800">Contractor Work Package</Label>
                                            <Select value={invForm.contractorId || ''} onValueChange={v => setInvForm({ ...invForm, contractorId: v })}>
                                                <SelectTrigger id="project-finance-field-3"><SelectValue placeholder="Select assigned contractor" /></SelectTrigger>
                                                <SelectContent>
                                                    {contractorAssignments.map((assignment) => <SelectItem key={assignment.contractorId} value={assignment.contractorId}>{assignment.contractor.name} · {assignment.role.replace(/_/g, ' ')}</SelectItem>)}
                                                </SelectContent>
                                            </Select>
                                            {contractorAssignments.length === 0 && <p className="text-xs text-red-700 mt-1">Assign a contractor work package before creating a contractor invoice.</p>}
                                        </div>
                                    )}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div>
                                            <Label htmlFor="project-finance-field-4" className="text-slate-800">Invoice Date</Label>
                                            <Input id="project-finance-field-4" type="date" value={invForm.invoiceDate?.split('T')[0] || ''} onChange={e => setInvForm({ ...invForm, invoiceDate: e.target.value })} />
                                        </div>
                                        <div>
                                            <Label htmlFor="project-finance-field-5" className="text-slate-800">Due Date</Label>
                                            <Input id="project-finance-field-5" type="date" value={invForm.dueDate?.split('T')[0] || ''} onChange={e => setInvForm({ ...invForm, dueDate: e.target.value })} />
                                        </div>
                                    </div>
                                    <div>
                                        <Label htmlFor="project-finance-field-6" className="text-slate-800">Reference No (Client PO/SO)</Label>
                                        <Input id="project-finance-field-6" value={invForm.referenceNumber || ''} onChange={e => setInvForm({ ...invForm, referenceNumber: e.target.value })} />
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium text-slate-800">Invoice items</p>
                                        {invForm.items?.map((item: InvoiceItem, i: number) => (
                                            <div key={i} className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-2 mt-2 rounded-lg border border-slate-200 p-3">
                                                <Input aria-label={`Item ${i + 1} description`} placeholder="Description" value={item.description} onChange={e => {
                                                    const items = [...invForm.items]; items[i].description = e.target.value;
                                                    setInvForm({ ...invForm, items });
                                                }} />
                                                <Input aria-label={`Item ${i + 1} quantity`} type="number" placeholder="Qty" value={item.quantity} onChange={e => {
                                                    const items = [...invForm.items]; items[i].quantity = +e.target.value;
                                                    setInvForm({ ...invForm, items });
                                                }} />
                                                <Input aria-label={`Item ${i + 1} unit price`} type="number" placeholder="Unit Price" value={item.unitPrice} onChange={e => {
                                                    const items = [...invForm.items]; items[i].unitPrice = +e.target.value;
                                                    setInvForm({ ...invForm, items });
                                                }} />
                                                <Select value={item.itemType || 'SERVICE'} onValueChange={v => {
                                                    const items = [...invForm.items]; items[i].itemType = v;
                                                    setInvForm({ ...invForm, items });
                                                }}>
                                                    <SelectTrigger aria-label={`Item ${i + 1} type`}><SelectValue /></SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="SERVICE">Service</SelectItem>
                                                        <SelectItem value="MATERIAL">Material</SelectItem>
                                                        <SelectItem value="EQUIPMENT">Equipment</SelectItem>
                                                        <SelectItem value="MISC">Misc</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                                <Button variant="ghost" size="sm" onClick={() =>
                                                    setInvForm({ ...invForm, items: invForm.items.filter((_item: InvoiceItem, j: number) => j !== i) })
                                                } aria-label={`Remove invoice item ${i + 1}`}>
                                                    <XCircle className="w-4 h-4 text-red-700" />
                                                </Button>
                                            </div>
                                        ))}
                                        <Button variant="outline" size="sm" className="mt-2" onClick={() =>
                                            setInvForm({ ...invForm, items: [...invForm.items, { description: '', quantity: 1, unitPrice: 0, itemType: 'SERVICE' }] })
                                        }><Plus className="w-4 h-4 mr-1" /> Add Item</Button>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div>
                                            <Label htmlFor="project-finance-field-8" className="text-slate-800">Tax Amount</Label>
                                            <Input id="project-finance-field-8" type="number" value={invForm.taxAmount || 0} onChange={e => setInvForm({ ...invForm, taxAmount: +e.target.value })} />
                                        </div>
                                        <div>
                                            <Label htmlFor="project-finance-field-9" className="text-slate-800">Discount Amount</Label>
                                            <Input id="project-finance-field-9" type="number" value={invForm.discountAmount || 0} onChange={e => setInvForm({ ...invForm, discountAmount: +e.target.value })} />
                                        </div>
                                    </div>
                                    <div>
                                        <Label htmlFor="project-finance-field-10" className="text-slate-800">Notes</Label>
                                        <Textarea id="project-finance-field-10" value={invForm.notes || ''} onChange={e => setInvForm({ ...invForm, notes: e.target.value })} />
                                    </div>
                                </div>
                                <DialogFooter>
                                    <Button variant="outline" onClick={() => setShowInvDialog(false)}>Cancel</Button>
                                    <Button onClick={handleCreateInvoice} disabled={submitting || !canWrite}>
                                        {submitting && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
                                        Create Invoice
                                    </Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>
                    </div>

                    <Dialog open={showReceiptDialog} onOpenChange={setShowReceiptDialog}>
                        <DialogContent className="max-w-lg max-h-[90dvh] overflow-y-auto bg-white text-slate-900">
                            <DialogHeader><DialogTitle>Record SLT Payment Receipt</DialogTitle></DialogHeader>
                            <div className="space-y-4">
                                <p className="rounded-lg bg-blue-50 p-3 text-sm text-blue-950">
                                    This records money received from SLT against the submitted project invoice. It is not a contractor payment voucher.
                                </p>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <Label htmlFor="project-finance-field-11" className="text-slate-800">Received Amount</Label>
                                        <Input id="project-finance-field-11" type="number" min="0.01" value={receiptForm.amount || ''} onChange={e => setReceiptForm({ ...receiptForm, amount: +e.target.value })} />
                                    </div>
                                    <div>
                                        <Label htmlFor="project-finance-field-12" className="text-slate-800">Payment Method</Label>
                                        <Select value={receiptForm.paymentMethod || 'BANK_TRANSFER'} onValueChange={v => setReceiptForm({ ...receiptForm, paymentMethod: v })}>
                                            <SelectTrigger id="project-finance-field-12"><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="BANK_TRANSFER">Bank transfer</SelectItem>
                                                <SelectItem value="CHEQUE">Cheque</SelectItem>
                                                <SelectItem value="CASH">Cash</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <Label htmlFor="project-finance-field-13" className="text-slate-800">Receipt Date</Label>
                                        <Input id="project-finance-field-13" type="date" value={receiptForm.receiptDate || ''} onChange={e => setReceiptForm({ ...receiptForm, receiptDate: e.target.value })} />
                                    </div>
                                    <div>
                                        <Label htmlFor="project-finance-field-14" className="text-slate-800">Bank / Receipt Reference (required)</Label>
                                        <Input id="project-finance-field-14" value={receiptForm.referenceNumber || ''} onChange={e => setReceiptForm({ ...receiptForm, referenceNumber: e.target.value })} placeholder="Unique payment reference" required />
                                    </div>
                                </div>
                                <div>
                                    <Label htmlFor="project-finance-field-15" className="text-slate-800">Notes</Label>
                                    <Textarea id="project-finance-field-15" value={receiptForm.notes || ''} onChange={e => setReceiptForm({ ...receiptForm, notes: e.target.value })} placeholder="Receipt or reconciliation note" />
                                </div>
                            </div>
                            <DialogFooter>
                                <Button variant="outline" onClick={() => setShowReceiptDialog(false)}>Cancel</Button>
                                <Button onClick={handleRecordReceipt} disabled={submitting || !canApprove || !receiptForm.amount}>
                                    {submitting && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
                                    Record Receipt
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>

                    {loading ? (
                        <div className="flex justify-center py-8"><Loader2 className="w-8 h-8 animate-spin text-slate-400" /></div>
                    ) : invoiceError ? (
                        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-900">
                            <p>{invoiceError}</p>
                            <Button variant="outline" className="mt-2" onClick={() => void fetchInvoices()}>Retry loading invoices</Button>
                        </div>
                    ) : invoices.length === 0 ? (
                        <div className="text-center py-12 text-slate-600">
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
                                                <span className="font-semibold text-sm text-blue-800">{inv.invoiceNumber}</span>
                                                {statusBadge(inv.status)}
                                                {inv.submissionStatus === 'SUBMITTED_TO_SLT' && statusBadge('SUBMITTED_TO_SLT')}
                                                {inv.paymentStatus && (inv.type === 'CLIENT' && inv.paymentStatus === 'PENDING'
                                                    ? <Badge className="bg-yellow-100 text-yellow-900">SLT payment pending</Badge>
                                                    : statusBadge(inv.paymentStatus))}
                                            </div>
                                            <h4 className="font-medium mt-1 text-slate-900">{inv.title}</h4>
                                            <div className="flex gap-4 mt-2 text-sm text-slate-600">
                                                <span>Items: {inv.items?.length || 0}</span>
                                                <span>Total: LKR {inv.totalAmount?.toLocaleString()}</span>
                                                <span>Paid: LKR {inv.paidAmount?.toLocaleString()}</span>
                                                <span>Balance: LKR {inv.balanceAmount?.toLocaleString()}</span>
                                                <span>Due: {inv.dueDate ? new Date(inv.dueDate).toLocaleDateString() : 'N/A'}</span>
                                            </div>
                                            {inv.referenceNumber && (
                                                <p className="text-xs text-slate-600 mt-1">Ref: {inv.referenceNumber}</p>
                                            )}
                                        </div>
                                        <div className="flex gap-2">
                                            {canApprove && inv.status === 'DRAFT' && (
                                                <Button size="sm" variant="outline" disabled={submitting} onClick={() => handleStatusUpdate(
                                                    '/api/projects/invoices',
                                                    inv.id,
                                                    'ISSUED',
                                                    `Issue invoice ${inv.invoiceNumber}? This makes it available for payment processing.`,
                                                    'Invoice issued.'
                                                )}>
                                                    <CheckCircle className="w-4 h-4 mr-1" /> Issue
                                                </Button>
                                            )}
                                            {canApprove && inv.type === 'CLIENT' && inv.status === 'ISSUED' && inv.submissionStatus !== 'SUBMITTED_TO_SLT' && (
                                                <Button size="sm" variant="outline" disabled={submitting} onClick={() => handleStatusUpdate(
                                                    '/api/projects/invoices',
                                                    inv.id,
                                                    'SUBMIT_TO_SLT',
                                                    `Submit invoice ${inv.invoiceNumber} to SLT?`,
                                                    'Invoice submitted to SLT and moved to payment pending.'
                                                )}>
                                                    <ReceiptText className="w-4 h-4 mr-1" /> Submit to SLT
                                                </Button>
                                            )}
                                            {canApprove && inv.type === 'CLIENT' && inv.submissionStatus === 'SUBMITTED_TO_SLT' && ['PENDING', 'PARTIALLY_PAID', 'OVERDUE'].includes(inv.paymentStatus || '') && (
                                                <Button size="sm" variant="outline" onClick={() => openPaymentWorkflow(inv)}>
                                                    <Banknote className="w-4 h-4 mr-1" /> Record SLT Receipt
                                                </Button>
                                            )}
                                            {canWrite && inv.type !== 'CLIENT' && (inv.status === 'ISSUED' || inv.status === 'PARTIALLY_PAID') && (
                                                <Button size="sm" variant="outline" onClick={() => openPaymentWorkflow(inv)}>
                                                    <Banknote className="w-4 h-4 mr-1" /> Record Payment
                                                </Button>
                                            )}
                                            {canApprove && ((inv.type === 'CLIENT' && inv.submissionStatus === 'SUBMITTED_TO_SLT' && ['PENDING', 'PARTIALLY_PAID', 'OVERDUE'].includes(inv.paymentStatus || ''))
                                                || (inv.type !== 'CLIENT' && (inv.status === 'ISSUED' || inv.status === 'PARTIALLY_PAID'))) && (
                                                <Button size="sm" variant="outline" onClick={() => handleStatusUpdate('/api/projects/invoices', inv.id, 'FOLLOW_UP', `Move ${inv.invoiceNumber} to follow-up?`, 'Invoice moved to follow-up.')}>Follow-up</Button>
                                            )}
                                            {canApprove && inv.status !== 'COMPLETED' && (inv.paymentStatus === 'PAID' || inv.status === 'FULLY_PAID' || inv.status === 'PAID') && inv.balanceAmount <= 0 && (
                                                <Button size="sm" variant="outline" onClick={() => handleStatusUpdate('/api/projects/invoices', inv.id, 'COMPLETED', `Mark ${inv.invoiceNumber} completed?`, 'Invoice completed.')}>Complete</Button>
                                            )}
                                            <Dialog>
                                                <DialogTrigger asChild>
                                                    <Button size="sm" variant="ghost" aria-label={`View invoice ${inv.invoiceNumber}`}>
                                                        <Eye className="w-4 h-4" />
                                                    </Button>
                                                </DialogTrigger>
                                                <DialogContent className="max-w-lg max-h-[90dvh] overflow-y-auto bg-white text-slate-900">
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
                            <h3 className="text-lg font-semibold text-slate-900">Payment Vouchers</h3>
                            <p className="text-sm text-slate-600">
                                {voucherLoading ? 'Loading totals...' : voucherError ? 'Totals unavailable until records are reloaded.' : <>
                                Total: LKR {totalFor(paymentVouchers, 'amount').toLocaleString()} |
                                Net: LKR {totalFor(paymentVouchers, 'netAmount').toLocaleString()}
                                </>}
                            </p>
                        </div>
                        <Dialog open={showPVDialog} onOpenChange={setShowPVDialog}>
                            {canWrite && <DialogTrigger asChild>
                                <Button size="sm"><Plus className="w-4 h-4 mr-1" /> New Payment</Button>
                            </DialogTrigger>}
                            <DialogContent className="max-w-2xl max-h-[90dvh] overflow-y-auto bg-white text-slate-900">
                                <DialogHeader><DialogTitle>Create Payment Voucher</DialogTitle></DialogHeader>
                                <div className="space-y-4">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div>
                                            <Label htmlFor="project-finance-field-16" className="text-slate-800">Title</Label>
                                            <Input id="project-finance-field-16" value={pvForm.title || ''} onChange={e => setPvForm({ ...pvForm, title: e.target.value })} />
                                        </div>
                                        <div>
                                            <Label htmlFor="project-finance-field-17" className="text-slate-800">Type</Label>
                                            <Select value={pvForm.type || 'CONTRACTOR'} onValueChange={v => setPvForm({ ...pvForm, type: v })}>
                                                <SelectTrigger id="project-finance-field-17"><SelectValue /></SelectTrigger>
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
                                        <Label htmlFor="project-finance-field-18" className="text-slate-800">Payee Name</Label>
                                        <Input id="project-finance-field-18" value={pvForm.payeeName || ''} onChange={e => setPvForm({ ...pvForm, payeeName: e.target.value })} />
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div>
                                            <Label htmlFor="project-finance-field-19" className="text-slate-800">Amount</Label>
                                            <Input id="project-finance-field-19" type="number" value={pvForm.amount || ''} onChange={e => setPvForm({ ...pvForm, amount: +e.target.value })} />
                                        </div>
                                        <div>
                                            <Label htmlFor="project-finance-field-20" className="text-slate-800">Payment Date</Label>
                                            <Input id="project-finance-field-20" type="date" value={pvForm.paymentDate?.split('T')[0] || ''} onChange={e => setPvForm({ ...pvForm, paymentDate: e.target.value })} />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div>
                                            <Label htmlFor="project-finance-field-21" className="text-slate-800">Payment Method</Label>
                                            <Select value={pvForm.paymentMethod || ''} onValueChange={v => setPvForm({ ...pvForm, paymentMethod: v })}>
                                                <SelectTrigger id="project-finance-field-21"><SelectValue placeholder="Select method" /></SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="BANK_TRANSFER">Bank Transfer</SelectItem>
                                                    <SelectItem value="CHEQUE">Cheque</SelectItem>
                                                    <SelectItem value="CASH">Cash</SelectItem>
                                                    <SelectItem value="CARD">Card</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div>
                                            <Label htmlFor="project-finance-field-22" className="text-slate-800">Invoice (optional)</Label>
                                            <Select value={pvForm.invoiceId || ''} onValueChange={v => setPvForm({ ...pvForm, invoiceId: v })}>
                                                <SelectTrigger id="project-finance-field-22"><SelectValue placeholder="Link to invoice" /></SelectTrigger>
                                                <SelectContent>
                                                    {invoices.filter(i => i.type !== 'CLIENT' && i.status !== 'CANCELLED' && i.status !== 'FULLY_PAID').map((inv: Invoice) => (
                                                        <SelectItem key={inv.id} value={inv.id}>
                                                            {inv.invoiceNumber} - LKR {inv.balanceAmount?.toLocaleString()}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div>
                                            <Label htmlFor="project-finance-field-23" className="text-slate-800">Tax Withheld</Label>
                                            <Input id="project-finance-field-23" type="number" value={pvForm.taxWithheld || 0} onChange={e => setPvForm({ ...pvForm, taxWithheld: +e.target.value })} />
                                        </div>
                                        <div>
                                            <Label htmlFor="project-finance-field-24" className="text-slate-800">Retention Amount</Label>
                                            <Input id="project-finance-field-24" type="number" value={pvForm.retentionAmount || 0} onChange={e => setPvForm({ ...pvForm, retentionAmount: +e.target.value })} />
                                        </div>
                                    </div>
                                    <div>
                                        <Label htmlFor="project-finance-field-25" className="text-slate-800">Notes</Label>
                                        <Textarea id="project-finance-field-25" value={pvForm.notes || ''} onChange={e => setPvForm({ ...pvForm, notes: e.target.value })} />
                                    </div>
                                </div>
                                <DialogFooter>
                                    <Button variant="outline" onClick={() => setShowPVDialog(false)}>Cancel</Button>
                                    <Button onClick={handleCreatePV} disabled={submitting || !canWrite}>
                                        {submitting && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
                                        Create Voucher
                                    </Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>
                    </div>

                    {voucherLoading ? (
                        <div role="status" className="p-6 text-slate-700">Loading payment vouchers...</div>
                    ) : voucherError ? (
                        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-900">
                            <p>{voucherError}</p>
                            <Button variant="outline" className="mt-2 bg-white text-slate-900" onClick={() => void fetchPaymentVouchers()}>Retry loading payment vouchers</Button>
                        </div>
                    ) : paymentVouchers.length === 0 ? (
                        <div className="text-center py-12 text-slate-600">
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
                                                <span className="font-semibold text-sm text-purple-800">{pv.pvNumber}</span>
                                                {statusBadge(pv.status)}
                                            </div>
                                            <h4 className="font-medium mt-1 text-slate-900">{pv.title}</h4>
                                            <p className="text-sm text-slate-600">Payee: {pv.payeeName}</p>
                                            <div className="flex gap-4 mt-2 text-sm text-slate-600">
                                                <span>Amount: LKR {pv.amount?.toLocaleString()}</span>
                                                <span>Net: LKR {pv.netAmount?.toLocaleString()}</span>
                                                <span>Type: {pv.type}</span>
                                                {pv.invoice && <span>Invoice: {pv.invoice.invoiceNumber}</span>}
                                                {pv.paymentDate && <span>Date: {new Date(pv.paymentDate).toLocaleDateString()}</span>}
                                            </div>
                                        </div>
                                        <div className="flex gap-2">
                                            {canWrite && pv.status === 'DRAFT' && (
                                                <Button size="sm" variant="outline" disabled={submitting} onClick={() => handleStatusUpdate(
                                                    '/api/projects/payment-vouchers',
                                                    pv.id,
                                                    'PENDING_APPROVAL',
                                                    `Submit payment voucher ${pv.pvNumber} for approval?`,
                                                    'Payment voucher submitted for approval.'
                                                )}>
                                                    <ArrowUpDown className="w-4 h-4 mr-1" /> Submit
                                                </Button>
                                            )}
                                            {canApprove && pv.status === 'PENDING_APPROVAL' && (
                                                <>
                                                    <Button size="sm" variant="outline" className="text-green-800" disabled={submitting} onClick={() => handleStatusUpdate(
                                                        '/api/projects/payment-vouchers',
                                                        pv.id,
                                                        'APPROVED',
                                                        `Approve payment voucher ${pv.pvNumber}?`,
                                                        'Payment voucher approved.'
                                                    )}>
                                                        <CheckCircle className="w-4 h-4 mr-1" /> Approve
                                                    </Button>
                                                    <Button size="sm" variant="outline" className="text-red-800" disabled={submitting} onClick={() => handleStatusUpdate(
                                                        '/api/projects/payment-vouchers',
                                                        pv.id,
                                                        'REJECTED',
                                                        `Reject payment voucher ${pv.pvNumber}?`,
                                                        'Payment voucher rejected.',
                                                        { rejectionReason: 'Rejected' }
                                                    )}>
                                                        <XCircle className="w-4 h-4 mr-1" /> Reject
                                                    </Button>
                                                </>
                                            )}
                                            {canApprove && pv.status === 'APPROVED' && (
                                                <Button size="sm" variant="outline" className="text-emerald-800" disabled={submitting} onClick={() => handleStatusUpdate(
                                                    '/api/projects/payment-vouchers',
                                                    pv.id,
                                                    'PAID',
                                                    `Mark payment voucher ${pv.pvNumber} as paid? This finalizes the voucher payment.`,
                                                    'Payment voucher marked as paid.'
                                                )}>
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
                            <h3 className="text-lg font-semibold text-slate-900">LD & Penalties</h3>
                            <p className="text-sm text-slate-600">
                                {ldLoading ? 'Loading totals...' : ldError ? 'Totals unavailable until records are reloaded.' : <>
                                Total: LKR {totalFor(ldPenalties, 'amount').toLocaleString()} |
                                Net: LKR {totalFor(ldPenalties, 'netAmount').toLocaleString()}
                                </>}
                            </p>
                        </div>
                        <Dialog open={showLDDialog} onOpenChange={setShowLDDialog}>
                            {canWrite && <DialogTrigger asChild>
                                <Button size="sm"><Plus className="w-4 h-4 mr-1" /> New LD/Penalty</Button>
                            </DialogTrigger>}
                            <DialogContent className="max-h-[90dvh] overflow-y-auto bg-white text-slate-900">
                                <DialogHeader><DialogTitle>Add LD / Penalty</DialogTitle></DialogHeader>
                                <div className="space-y-4">
                                    <div>
                                        <Label htmlFor="project-finance-field-26" className="text-slate-800">Title</Label>
                                        <Input id="project-finance-field-26" value={ldForm.title || ''} onChange={e => setLdForm({ ...ldForm, title: e.target.value })} />
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div>
                                            <Label htmlFor="project-finance-field-27" className="text-slate-800">Type</Label>
                                            <Select value={ldForm.type || 'LD'} onValueChange={v => setLdForm({ ...ldForm, type: v })}>
                                                <SelectTrigger id="project-finance-field-27"><SelectValue /></SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="LD">Liquidated Damages</SelectItem>
                                                    <SelectItem value="PENALTY">Penalty</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div>
                                            <Label htmlFor="project-finance-field-28" className="text-slate-800">Category</Label>
                                            <Select value={ldForm.category || 'DELAY'} onValueChange={v => setLdForm({ ...ldForm, category: v })}>
                                                <SelectTrigger id="project-finance-field-28"><SelectValue /></SelectTrigger>
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
                                        <Label htmlFor="project-finance-field-29" className="text-slate-800">Amount (LKR)</Label>
                                        <Input id="project-finance-field-29" type="number" value={ldForm.amount || ''} onChange={e => setLdForm({ ...ldForm, amount: +e.target.value })} />
                                    </div>
                                    <div>
                                        <Label htmlFor="project-finance-field-30" className="text-slate-800">Percentage (e.g., 0.5% per week)</Label>
                                        <Input id="project-finance-field-30" type="number" step="0.01" value={ldForm.percentage || ''} onChange={e => setLdForm({ ...ldForm, percentage: +e.target.value })} />
                                    </div>
                                    <div>
                                        <Label htmlFor="project-finance-field-31" className="text-slate-800">Description</Label>
                                        <Textarea id="project-finance-field-31" value={ldForm.description || ''} onChange={e => setLdForm({ ...ldForm, description: e.target.value })} />
                                    </div>
                                </div>
                                <DialogFooter>
                                    <Button variant="outline" onClick={() => setShowLDDialog(false)}>Cancel</Button>
                                    <Button onClick={handleCreateLD} disabled={submitting || !canWrite}>
                                        {submitting && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
                                        Create
                                    </Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>
                    </div>

                    {ldLoading ? (
                        <div role="status" className="p-6 text-slate-700">Loading LD and penalties...</div>
                    ) : ldError ? (
                        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-900">
                            <p>{ldError}</p>
                            <Button variant="outline" className="mt-2 bg-white text-slate-900" onClick={() => void fetchLdPenalties()}>Retry loading LD and penalties</Button>
                        </div>
                    ) : ldPenalties.length === 0 ? (
                        <div className="text-center py-12 text-slate-600">
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
                                                <Badge className={ld.type === 'LD' ? 'bg-red-100 text-red-800' : 'bg-orange-100 text-orange-800'}>
                                                    {ld.type}
                                                </Badge>
                                                {statusBadge(ld.status)}
                                                <span className="text-xs text-slate-600">{ld.category}</span>
                                            </div>
                                            <h4 className="font-medium mt-1 text-slate-900">{ld.title}</h4>
                                            <p className="text-sm text-slate-600 mt-1">{ld.description}</p>
                                            <div className="flex gap-4 mt-2 text-sm text-slate-600">
                                                <span>Amount: LKR {ld.amount?.toLocaleString()}</span>
                                                {ld.waivedAmount > 0 && <span>Waived: LKR {ld.waivedAmount?.toLocaleString()}</span>}
                                                <span>Net: LKR {ld.netAmount?.toLocaleString()}</span>
                                                {ld.percentage && <span>({ld.percentage}%)</span>}
                                                {ld.appliedDate && <span>Applied: {new Date(ld.appliedDate).toLocaleDateString()}</span>}
                                            </div>
                                        </div>
                                        <div className="flex gap-2">
                                            {canApprove && ld.status === 'PROPOSED' && (
                                                <>
                                                    <Button size="sm" variant="outline" className="text-green-800" disabled={submitting} onClick={() => handleStatusUpdate(
                                                        '/api/projects/ld-penalties',
                                                        ld.id,
                                                        'APPROVED',
                                                        `Approve LD or penalty "${ld.title}"?`,
                                                        'LD or penalty approved.'
                                                    )}>
                                                        <CheckCircle className="w-4 h-4 mr-1" /> Approve
                                                    </Button>
                                                    <Button size="sm" variant="outline" className="text-purple-800" disabled={submitting} onClick={() => handleStatusUpdate(
                                                        '/api/projects/ld-penalties',
                                                        ld.id,
                                                        'WAIVED',
                                                        `Waive LD or penalty "${ld.title}"?`,
                                                        'LD or penalty waived.'
                                                    )}>
                                                        <XCircle className="w-4 h-4 mr-1" /> Waive
                                                    </Button>
                                                </>
                                            )}
                                            {ld.status === 'APPROVED' && (
                                                <p className="max-w-sm text-sm text-slate-700">Collection recording is not supported here. Approval does not confirm payment or collection.</p>
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
                            <h3 className="text-lg font-semibold text-slate-900">Retention Money</h3>
                            <p className="text-sm text-slate-600">
                                {retentionLoading ? 'Loading totals...' : retentionError ? 'Totals unavailable until records are reloaded.' : <>
                                Held: LKR {totalFor(retentions, 'retentionAmount').toLocaleString()} |
                                Released: LKR {totalFor(retentions, 'releasedAmount').toLocaleString()} |
                                Balance: LKR {totalFor(retentions, 'balanceAmount').toLocaleString()}
                                </>}
                            </p>
                        </div>
                        <Dialog open={showRetDialog} onOpenChange={setShowRetDialog}>
                            {canWrite && <DialogTrigger asChild>
                                <Button size="sm"><Plus className="w-4 h-4 mr-1" /> New Retention</Button>
                            </DialogTrigger>}
                            <DialogContent className="max-h-[90dvh] overflow-y-auto bg-white text-slate-900">
                                <DialogHeader><DialogTitle>Create Retention Entry</DialogTitle></DialogHeader>
                                <div className="space-y-4">
                                    <div>
                                        <Label htmlFor="project-finance-field-32" className="text-slate-800">Title</Label>
                                        <Input id="project-finance-field-32" value={retForm.title || ''} onChange={e => setRetForm({ ...retForm, title: e.target.value })} />
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div>
                                            <Label htmlFor="project-finance-field-33" className="text-slate-800">Retention %</Label>
                                            <Input id="project-finance-field-33" type="number" value={retForm.retentionPercent || 10} onChange={e => setRetForm({ ...retForm, retentionPercent: +e.target.value })} />
                                        </div>
                                        <div>
                                            <Label htmlFor="project-finance-field-34" className="text-slate-800">Amount (LKR)</Label>
                                            <Input id="project-finance-field-34" type="number" value={retForm.retentionAmount || ''} onChange={e => setRetForm({ ...retForm, retentionAmount: +e.target.value })} />
                                        </div>
                                    </div>
                                    <div>
                                        <Label htmlFor="project-finance-field-35" className="text-slate-800">Release Condition</Label>
                                        <Select value={retForm.releaseCondition || ''} onValueChange={v => setRetForm({ ...retForm, releaseCondition: v })}>
                                            <SelectTrigger id="project-finance-field-35"><SelectValue placeholder="Select condition" /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="DEFECT_LIABILITY_PERIOD">Defect Liability Period</SelectItem>
                                                <SelectItem value="COMPLETION_CERTIFICATE">Completion Certificate</SelectItem>
                                                <SelectItem value="HANDOVER">Handover</SelectItem>
                                                <SelectItem value="OTHER">Other</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div>
                                        <Label htmlFor="project-finance-field-36" className="text-slate-800">Defect Liability Period (days)</Label>
                                        <Input id="project-finance-field-36" type="number" value={retForm.defectLiabilityPeriod || ''} onChange={e => setRetForm({ ...retForm, defectLiabilityPeriod: +e.target.value })} />
                                    </div>
                                </div>
                                <DialogFooter>
                                    <Button variant="outline" onClick={() => setShowRetDialog(false)}>Cancel</Button>
                                    <Button onClick={handleCreateRetention} disabled={submitting || !canWrite}>
                                        {submitting && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
                                        Create
                                    </Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>
                    </div>

                    {retentionLoading ? (
                        <div role="status" className="p-6 text-slate-700">Loading retentions...</div>
                    ) : retentionError ? (
                        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-900">
                            <p>{retentionError}</p>
                            <Button variant="outline" className="mt-2 bg-white text-slate-900" onClick={() => void fetchRetentions()}>Retry loading retentions</Button>
                        </div>
                    ) : retentions.length === 0 ? (
                        <div className="text-center py-12 text-slate-600">
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
                                                <span className="text-xs text-slate-600">{ret.retentionPercent}%</span>
                                            </div>
                                            <h4 className="font-medium mt-1 text-slate-900">{ret.title}</h4>
                                            <div className="flex gap-4 mt-2 text-sm text-slate-600">
                                                <span>Held: LKR {ret.retentionAmount?.toLocaleString()}</span>
                                                <span>Released: LKR {ret.releasedAmount?.toLocaleString()}</span>
                                                <span>Balance: LKR {ret.balanceAmount?.toLocaleString()}</span>
                                            </div>
                                            {ret.releaseCondition && (
                                                <p className="text-xs text-slate-600 mt-1">Condition: {ret.releaseCondition.replace(/_/g, ' ')}</p>
                                            )}
                                            {ret.releases && ret.releases.length > 0 && (
                                                <details className="mt-2">
                                                    <summary className="text-xs text-blue-800 cursor-pointer">View Release History ({ret.releases.length})</summary>
                                                    <div className="mt-2 space-y-1">
                                                        {ret.releases.map((rel: RetentionRelease) => (
                                                            <div key={rel.id} className="flex justify-between text-xs text-slate-700 bg-slate-50 p-2 rounded">
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
                                            {canApprove && ret.status !== 'FULLY_RELEASED' && (
                                                <Button size="sm" variant="outline" disabled={submitting} onClick={() => {
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
                        <DialogContent className="max-h-[90dvh] overflow-y-auto bg-white text-slate-900">
                            <DialogHeader><DialogTitle>Release Retention</DialogTitle></DialogHeader>
                            <div className="space-y-4">
                                <p className="text-sm text-slate-600">
                                    Retention: <strong>LKR {selectedRetention?.balanceAmount?.toLocaleString()}</strong> remaining
                                </p>
                                <div>
                                    <Label htmlFor="project-finance-field-37" className="text-slate-800">Release Amount</Label>
                                    <Input id="project-finance-field-37" type="number" value={releaseForm.releaseAmount || ''} onChange={e => setReleaseForm({ ...releaseForm, releaseAmount: +e.target.value })} max={selectedRetention?.balanceAmount} />
                                </div>
                                <div>
                                    <Label htmlFor="project-finance-field-38" className="text-slate-800">Release Date</Label>
                                    <Input id="project-finance-field-38" type="date" value={releaseForm.releaseDate?.split('T')[0] || new Date().toISOString().split('T')[0]} onChange={e => setReleaseForm({ ...releaseForm, releaseDate: e.target.value })} />
                                </div>
                                <div>
                                    <Label htmlFor="project-finance-field-39" className="text-slate-800">Remarks</Label>
                                    <Textarea id="project-finance-field-39" value={releaseForm.remarks || ''} onChange={e => setReleaseForm({ ...releaseForm, remarks: e.target.value })} />
                                </div>
                            </div>
                            <DialogFooter>
                                <Button variant="outline" onClick={() => setShowReleaseDialog(false)}>Cancel</Button>
                                <Button onClick={handleReleaseRetention} disabled={submitting || !canApprove}>
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

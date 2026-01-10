"use client";

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import ResponsiveTable from '@/components/ResponsiveTable';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, FileText, Check, X, Trash2, Eye } from 'lucide-react';

interface Invoice {
    id: string;
    invoiceNumber: string;
    contractor: {
        id: string;
        name: string;
    };
    project?: {
        id: string;
        name: string;
    };
    amount: number;
    status: string;
    description?: string;
    dueDate?: string;
    date: string;
    createdAt: string;
}

interface Contractor {
    id: string;
    name: string;
}

export default function InvoicesPage() {
    const router = useRouter();
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [contractors, setContractors] = useState<Contractor[]>([]);
    const [loading, setLoading] = useState(true);
    const [createDialogOpen, setCreateDialogOpen] = useState(false);
    const [statusFilter, setStatusFilter] = useState('ALL');

    const [newInvoice, setNewInvoice] = useState({
        invoiceNumber: '',
        contractorId: '',
        amount: '',
        description: '',
        dueDate: ''
    });

    useEffect(() => {
        fetchInvoices();
        fetchContractors();
    }, [statusFilter]);

    const fetchInvoices = async () => {
        try {
            const params = new URLSearchParams();
            if (statusFilter !== 'ALL') params.append('status', statusFilter);

            const res = await fetch(`/api/invoices?${params}`);
            if (!res.ok) throw new Error('Failed to fetch');
            const data = await res.json();
            setInvoices(data);
        } catch (error) {
            console.error('Error fetching invoices:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchContractors = async () => {
        try {
            const res = await fetch('/api/contractors?page=1&limit=1000');
            if (res.ok) {
                const data = await res.json();
                setContractors(Array.isArray(data.contractors) ? data.contractors : []);
            }
        } catch (error) {
            console.error('Error fetching contractors:', error);
        }
    };

    const handleCreate = async () => {
        try {
            const res = await fetch('/api/invoices', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newInvoice)
            });

            if (!res.ok) {
                const error = await res.json();
                alert(error.error || 'Failed to create invoice');
                return;
            }

            setCreateDialogOpen(false);
            setNewInvoice({
                invoiceNumber: '',
                contractorId: '',
                amount: '',
                description: '',
                dueDate: ''
            });
            fetchInvoices();
        } catch (error) {
            console.error('Error creating invoice:', error);
            alert('Failed to create invoice');
        }
    };

    const handleStatusChange = async (id: string, newStatus: string) => {
        try {
            const res = await fetch('/api/invoices', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, status: newStatus })
            });

            if (!res.ok) throw new Error('Failed to update');
            fetchInvoices();
        } catch (error) {
            console.error('Error updating invoice:', error);
            alert('Failed to update invoice status');
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this invoice?')) return;

        try {
            const res = await fetch(`/api/invoices?id=${id}`, {
                method: 'DELETE'
            });

            if (!res.ok) {
                const error = await res.json();
                alert(error.error || 'Failed to delete invoice');
                return;
            }

            fetchInvoices();
        } catch (error) {
            console.error('Error deleting invoice:', error);
            alert('Failed to delete invoice');
        }
    };

    const getStatusBadge = (status: string) => {
        const variants: Record<string, { variant: any; className: string }> = {
            PENDING: { variant: 'outline', className: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
            APPROVED: { variant: 'outline', className: 'bg-blue-50 text-blue-700 border-blue-200' },
            PAID: { variant: 'outline', className: 'bg-green-50 text-green-700 border-green-200' }
        };

        const config = variants[status] || variants.PENDING;
        return (
            <Badge variant={config.variant} className={config.className}>
                {status}
            </Badge>
        );
    };

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'LKR'
        }).format(amount);
    };

    const totalAmount = invoices.reduce((sum, inv) => sum + inv.amount, 0);
    const paidAmount = invoices.filter(i => i.status === 'PAID').reduce((sum, inv) => sum + inv.amount, 0);
    const pendingAmount = invoices.filter(i => i.status === 'PENDING').reduce((sum, inv) => sum + inv.amount, 0);

    if (loading) {
        return (
            <div className="min-h-screen flex bg-slate-50">
                <Sidebar />
                <main className="flex-1 flex items-center justify-center">
                    <div className="animate-spin w-10 h-10 border-4 border-primary border-t-transparent rounded-full"></div>
                </main>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex bg-white">
            <Sidebar />
            <main className="flex-1 flex flex-col min-w-0">
                <Header />
                <div className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
                    <div className="max-w-7xl mx-auto space-y-6">
                        {/* Header */}
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                            <div>
                                <h1 className="text-xl md:text-2xl font-bold text-slate-900">Invoice Management</h1>
                                <p className="text-sm text-slate-500 mt-1">Manage contractor invoices and payments</p>
                            </div>
                            <Button onClick={() => setCreateDialogOpen(true)} className="gap-2">
                                <Plus className="w-4 h-4" />
                                New Invoice
                            </Button>
                        </div>

                        {/* Stats */}
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
                            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                                <p className="text-xs font-medium text-slate-500 uppercase">Total Amount</p>
                                <p className="text-lg md:text-2xl font-bold text-slate-900 mt-1">{formatCurrency(totalAmount)}</p>
                            </div>
                            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                                <p className="text-xs font-medium text-slate-500 uppercase">Paid</p>
                                <p className="text-lg md:text-2xl font-bold text-green-600 mt-1">{formatCurrency(paidAmount)}</p>
                            </div>
                            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                                <p className="text-xs font-medium text-slate-500 uppercase">Pending</p>
                                <p className="text-lg md:text-2xl font-bold text-yellow-600 mt-1">{formatCurrency(pendingAmount)}</p>
                            </div>
                            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                                <p className="text-xs font-medium text-slate-500 uppercase">Total Invoices</p>
                                <p className="text-lg md:text-2xl font-bold text-slate-900 mt-1">{invoices.length}</p>
                            </div>
                        </div>

                        {/* Filters */}
                        <div className="flex flex-wrap gap-2">
                            {['ALL', 'PENDING', 'APPROVED', 'PAID'].map((status) => (
                                <Button
                                    key={status}
                                    variant={statusFilter === status ? 'default' : 'outline'}
                                    size="sm"
                                    onClick={() => setStatusFilter(status)}
                                >
                                    {status}
                                </Button>
                            ))}
                        </div>

                        {/* Table */}
                        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                            <ResponsiveTable>
                                <table className="min-w-full divide-y divide-slate-200">
                                    <thead className="bg-slate-50">
                                        <tr>
                                            <th className="px-4 md:px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Invoice #</th>
                                            <th className="px-4 md:px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Contractor</th>
                                            <th className="px-4 md:px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Amount</th>
                                            <th className="px-4 md:px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Status</th>
                                            <th className="px-4 md:px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Date</th>
                                            <th className="px-4 md:px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-200">
                                        {invoices.map((invoice) => (
                                            <tr key={invoice.id} className="hover:bg-slate-50">
                                                <td className="px-4 md:px-6 py-4 text-sm font-medium text-slate-900">
                                                    {invoice.invoiceNumber}
                                                </td>
                                                <td className="px-4 md:px-6 py-4 text-sm text-slate-600">
                                                    {invoice.contractor.name}
                                                </td>
                                                <td className="px-4 md:px-6 py-4 text-sm font-semibold text-slate-900">
                                                    {formatCurrency(invoice.amount)}
                                                </td>
                                                <td className="px-4 md:px-6 py-4">
                                                    {getStatusBadge(invoice.status)}
                                                </td>
                                                <td className="px-4 md:px-6 py-4 text-sm text-slate-600">
                                                    {new Date(invoice.date).toLocaleDateString()}
                                                </td>
                                                <td className="px-4 md:px-6 py-4">
                                                    <div className="flex items-center gap-2">
                                                        {invoice.status === 'PENDING' && (
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                onClick={() => handleStatusChange(invoice.id, 'APPROVED')}
                                                                className="gap-1"
                                                            >
                                                                <Check className="w-3 h-3" />
                                                                Approve
                                                            </Button>
                                                        )}
                                                        {invoice.status === 'APPROVED' && (
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                onClick={() => handleStatusChange(invoice.id, 'PAID')}
                                                                className="gap-1 text-green-600"
                                                            >
                                                                <Check className="w-3 h-3" />
                                                                Pay
                                                            </Button>
                                                        )}
                                                        {invoice.status !== 'PAID' && (
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                onClick={() => handleDelete(invoice.id)}
                                                                className="gap-1 text-red-600"
                                                            >
                                                                <Trash2 className="w-3 h-3" />
                                                            </Button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </ResponsiveTable>

                            {invoices.length === 0 && (
                                <div className="text-center py-12">
                                    <FileText className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                                    <p className="text-slate-500">No invoices found</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </main>

            {/* Create Invoice Dialog */}
            <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Create New Invoice</DialogTitle>
                        <DialogDescription>Enter invoice details below.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="invoiceNumber">Invoice Number *</Label>
                            <Input
                                id="invoiceNumber"
                                value={newInvoice.invoiceNumber}
                                onChange={(e) => setNewInvoice({ ...newInvoice, invoiceNumber: e.target.value })}
                                placeholder="INV-2026-001"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="contractor">Contractor *</Label>
                            <Select
                                value={newInvoice.contractorId}
                                onValueChange={(value) => setNewInvoice({ ...newInvoice, contractorId: value })}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select contractor" />
                                </SelectTrigger>
                                <SelectContent>
                                    {contractors.map((contractor) => (
                                        <SelectItem key={contractor.id} value={contractor.id}>
                                            {contractor.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="amount">Amount (LKR) *</Label>
                            <Input
                                id="amount"
                                type="number"
                                value={newInvoice.amount}
                                onChange={(e) => setNewInvoice({ ...newInvoice, amount: e.target.value })}
                                placeholder="0.00"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="dueDate">Due Date</Label>
                            <Input
                                id="dueDate"
                                type="date"
                                value={newInvoice.dueDate}
                                onChange={(e) => setNewInvoice({ ...newInvoice, dueDate: e.target.value })}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="description">Description</Label>
                            <Textarea
                                id="description"
                                value={newInvoice.description}
                                onChange={(e) => setNewInvoice({ ...newInvoice, description: e.target.value })}
                                placeholder="Invoice description..."
                                rows={3}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                            Cancel
                        </Button>
                        <Button onClick={handleCreate}>
                            Create Invoice
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

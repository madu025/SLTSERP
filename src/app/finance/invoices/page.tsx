'use client';

import React, { useState, useEffect } from 'react';
import RoleGuard from '@/components/RoleGuard';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Loader2, FileCheck, Search, ShieldAlert } from 'lucide-react';
import { Input } from '@/components/ui/input';


const formatCurrency = (amount: number) => new Intl.NumberFormat('en-LK', { style: 'currency', currency: 'LKR' }).format(amount);

export default function InvoiceApprovalPage() {
    const userRole = typeof window !== 'undefined' ? localStorage.getItem('role') : null;
    
    const [invoices, setInvoices] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [actionId, setActionId] = useState<string | null>(null);

    const fetchInvoices = () => {
        setIsLoading(true);
        fetch(`/api/finance/invoices?search=${search}&_t=${Date.now()}`, {
            headers: { 'Cache-Control': 'no-cache' }
        })
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    setInvoices(data.data.invoices);
                }
            })
            .catch(err => console.error(err))
            .finally(() => setIsLoading(false));
    };

    useEffect(() => {
        const timer = setTimeout(() => fetchInvoices(), 500);
        return () => clearTimeout(timer);
    }, [search]);

    const handleApprove = async (id: string, amount: number) => {
        if (amount > 1000000 && userRole !== 'SUPER_ADMIN') {
            toast.error('Invoices over 1,000,000 LKR require SUPER_ADMIN approval.');
            return;
        }

        setActionId(id);
        try {
            const res = await fetch(`/api/finance/invoices/${id}/approve`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'APPROVE' })
            });
            const data = await res.json();
            if (data.success) {
                toast.success('Invoice has been approved and ledger updated.');
                fetchInvoices();
            } else {
                toast.error(data.error?.message || 'Approval Failed');
            }
        } catch (error: any) {
            toast.error(error.message);
        } finally {
            setActionId(null);
        }
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'DRAFT': return <Badge variant="outline" className="bg-slate-100 text-slate-700">DRAFT</Badge>;
            case 'PENDING_CHECKER': return <Badge variant="outline" className="bg-amber-100 text-amber-700">AWAITING CHECKER</Badge>;
            case 'APPROVED': return <Badge className="bg-emerald-500 hover:bg-emerald-600">APPROVED</Badge>;
            case 'REJECTED': return <Badge variant="destructive">REJECTED</Badge>;
            case 'PAID': return <Badge className="bg-indigo-500">PAID</Badge>;
            default: return <Badge variant="secondary">{status}</Badge>;
        }
    };

    return (
        <RoleGuard allowedRoles={['SUPER_ADMIN', 'FINANCE_MANAGER']}>
            <div className="flex h-screen bg-slate-50 overflow-hidden font-sans">
                <Sidebar />
                <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                    <Header />
                    <main className="flex-1 overflow-y-auto p-6 lg:p-8">
                        <div className="max-w-7xl mx-auto space-y-6">
                            
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                <div>
                                    <h1 className="text-3xl font-bold tracking-tight text-slate-900">Invoice Approvals</h1>
                                    <p className="text-slate-500 mt-1">Maker-Checker workflow for contractor invoices.</p>
                                </div>
                                <div className="relative w-full md:w-72">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                    <Input 
                                        placeholder="Search invoice number..." 
                                        value={search}
                                        onChange={(e) => setSearch(e.target.value)}
                                        className="pl-9 bg-white"
                                    />
                                </div>
                            </div>

                            <Card className="shadow-sm border-slate-200">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm text-left">
                                        <thead className="text-xs text-slate-500 uppercase bg-slate-50/80 border-b border-slate-200">
                                            <tr>
                                                <th className="px-6 py-4 font-semibold">Invoice No</th>
                                                <th className="px-6 py-4 font-semibold">Contractor</th>
                                                <th className="px-6 py-4 font-semibold text-right">Gross Amount</th>
                                                <th className="px-6 py-4 font-semibold text-right">Net Payable</th>
                                                <th className="px-6 py-4 font-semibold text-center">Status</th>
                                                <th className="px-6 py-4 font-semibold text-right">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 bg-white">
                                            {isLoading ? (
                                                <tr>
                                                    <td colSpan={6} className="px-6 py-12 text-center">
                                                        <Loader2 className="h-8 w-8 animate-spin mx-auto text-slate-300" />
                                                    </td>
                                                </tr>
                                            ) : invoices.length === 0 ? (
                                                <tr>
                                                    <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                                                        No invoices found.
                                                    </td>
                                                </tr>
                                            ) : (
                                                invoices.map(invoice => (
                                                    <tr key={invoice.id} className="hover:bg-slate-50/50 transition-colors">
                                                        <td className="px-6 py-4 font-medium text-indigo-600">{invoice.invoiceNumber}</td>
                                                        <td className="px-6 py-4 font-medium text-slate-900">{invoice.contractor?.name}</td>
                                                        <td className="px-6 py-4 text-right text-slate-500">{formatCurrency(invoice.amount)}</td>
                                                        <td className="px-6 py-4 text-right font-semibold text-slate-900">{formatCurrency(invoice.totalAmount)}</td>
                                                        <td className="px-6 py-4 text-center">{getStatusBadge(invoice.approvalStatus)}</td>
                                                        <td className="px-6 py-4 text-right">
                                                            {invoice.approvalStatus === 'DRAFT' && (
                                                                <Button 
                                                                    size="sm" 
                                                                    onClick={() => handleApprove(invoice.id, invoice.totalAmount)}
                                                                    disabled={actionId === invoice.id || (invoice.totalAmount > 1000000 && userRole !== 'SUPER_ADMIN')}
                                                                    className={invoice.totalAmount > 1000000 && userRole !== 'SUPER_ADMIN' ? 'bg-slate-300' : 'bg-indigo-600 hover:bg-indigo-700'}
                                                                >
                                                                    {actionId === invoice.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileCheck className="h-4 w-4 mr-2" />}
                                                                    {invoice.totalAmount > 1000000 && userRole !== 'SUPER_ADMIN' ? 'Requires Super Admin' : 'Approve'}
                                                                </Button>
                                                            )}
                                                            {invoice.approvalStatus === 'APPROVED' && (
                                                                <span className="text-xs text-emerald-600 font-medium flex items-center justify-end gap-1">
                                                                    <ShieldAlert className="h-3 w-3" /> Ledger Posted
                                                                </span>
                                                            )}
                                                        </td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </Card>

                        </div>
                    </main>
                </div>
            </div>
        </RoleGuard>
    );
}

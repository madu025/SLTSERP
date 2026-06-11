"use client";

import React, { useEffect, useState } from 'react';
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
import { Plus, Check, Trash2, Printer, Search, Banknote, ShieldCheck, Users, FileText } from 'lucide-react';
import { cn } from "@/lib/utils";

interface Invoice {
    id: string;
    invoiceNumber: string;
    contractor: {
        id: string;
        name: string;
        registrationNumber?: string;
        address?: string;
        contactNumber?: string;
        bankName?: string;
        bankBranch?: string;
        bankAccountNumber?: string;
    };
    totalAmount: number;
    amountA: number;
    statusA: string;
    amountB: number;
    statusB: string;
    date: string;
    status: string;
}

interface Contractor {
    id: string;
    name: string;
}

interface InvoiceMaterialUsage {
    itemId: string;
    quantity: number;
    item?: {
        name: string;
    };
}

interface InvoiceSOD {
    serviceOrderId: string;
    rtom: string;
    completedAt?: string;
    materialUsage: InvoiceMaterialUsage[];
}

interface InvoiceDetailResponse {
    id: string;
    invoiceNumber: string;
    date: string;
    totalAmount: number;
    amountA: number;
    contractor: {
        name: string;
        address?: string;
        contactNumber?: string;
        registrationNumber?: string;
        bankAccountNumber?: string;
        bankName?: string;
        bankBranch?: string;
    };
    sods: InvoiceSOD[];
}

export default function InvoicesPage() {
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [contractors, setContractors] = useState<Contractor[]>([]);
    const [loading, setLoading] = useState(true);
    const [createDialogOpen, setCreateDialogOpen] = useState(false);
    const [statusFilter] = useState('ALL');

    const [generateParams, setGenerateParams] = useState({
        contractorId: '',
        month: new Date().getMonth() + 1,
        year: new Date().getFullYear()
    });
    const [userRole, setUserRole] = useState<string | null>(null);

    useEffect(() => {
        fetchInvoices();
        fetchContractors();

        const userStr = localStorage.getItem('user');
        if (userStr) {
            try {
                const u = JSON.parse(userStr);
                setUserRole(u.role);
            } catch (e) {
                console.error(e);
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
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
                const json = await res.json();
                const actualData = json?.success && json?.data ? json.data : json;
                setContractors(Array.isArray(actualData?.contractors) ? actualData.contractors : []);
            }
        } catch (error) {
            console.error('Error fetching contractors:', error);
        }
    };

    const handleGenerate = async () => {
        try {
            setLoading(true);
            const res = await fetch('/api/invoices/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(generateParams)
            });

            if (!res.ok) {
                const error = await res.json();
                alert(error.message || 'Generation Failed');
                return;
            }

            alert('Invoice Generated Successfully!');
            setCreateDialogOpen(false);
            fetchInvoices();
        } catch (e) {
            console.error(e);
            alert('Error generating invoice');
        } finally {
            setLoading(false);
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

    const handlePrint = async (baseInvoice: Invoice) => {
        const printWindow = window.open('', '', 'width=1200,height=900');
        if (!printWindow) {
            alert('Please allow popups to print');
            return;
        }

        printWindow.document.write('<html><body><h3>Loading Invoice Details...</h3></body></html>');

        try {
            const res = await fetch(`/api/invoices/${baseInvoice.id}/details`);
            if (!res.ok) throw new Error('Failed to fetch details');
            const invoice: InvoiceDetailResponse = await res.json();

            const invDate = new Date(invoice.date);
            const jobMonth = invDate.toLocaleString('default', { month: 'short', year: '2-digit' }).replace(' ', '-');
            const displayDate = invDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' }).replace(/ /g, '-');
            const fmt = (amt: number) => new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amt);

            const allMaterials = new Set<string>();
            invoice.sods.forEach((sod: InvoiceSOD) => {
                sod.materialUsage.forEach((usage: InvoiceMaterialUsage) => {
                    if (usage.item && usage.item.name) allMaterials.add(usage.item.name);
                });
            });
            const materialCols = Array.from(allMaterials).sort();

            const preferredOrder = ['F-1', 'G-1', 'DW-LH', 'DW-CH', 'DW-RT', 'IW-N', 'CAT 5', 'FAC', 'F ROSSETTE', 'TOP BOLT', 'CONDUITS', 'CASING'];
            const sortedMaterialCols = materialCols.sort((a, b) => {
                const idxA = preferredOrder.indexOf(a);
                const idxB = preferredOrder.indexOf(b);
                if (idxA !== -1 && idxB !== -1) return idxA - idxB;
                if (idxA !== -1) return -1;
                if (idxB !== -1) return 1;
                return a.localeCompare(b);
            });

            const ITEMS_PER_PAGE = 25;
            const pages = [];
            for (let i = 0; i < invoice.sods.length; i += ITEMS_PER_PAGE) {
                pages.push(invoice.sods.slice(i, i + ITEMS_PER_PAGE));
            }

            const materialTotals: Record<string, number> = {};
            sortedMaterialCols.forEach(col => materialTotals[col] = 0);

            invoice.sods.forEach((sod: InvoiceSOD) => {
                sod.materialUsage.forEach((usage: InvoiceMaterialUsage) => {
                    const name = usage.item?.name;
                    if (name && materialTotals[name] !== undefined) {
                        materialTotals[name] += (usage.quantity || 0);
                    }
                });
            });

            const html = `
                <!DOCTYPE html>
                <html>
                <head>
                    <title>Invoice - ${invoice.invoiceNumber}</title>
                    <style>
                        @page { size: A4 portrait; margin: 10mm; }
                        @page landscape { size: A4 landscape; margin: 5mm; }
                        
                        body { font-family: 'Times New Roman', Times, serif; padding: 0; margin: 0; color: #000; font-size: 14px; }
                        
                        .portrait-page { page: auto; break-after: page; width: 190mm; margin: 0 auto; }
                        .landscape-page { page: landscape; break-after: page; width: 280mm; margin: 0 auto; }
                        .landscape-page:last-child { break-after: auto; }

                        .text-center { text-align: center; }
                        .text-right { text-align: right; }
                        .font-bold { font-weight: bold; }
                        .uppercase { text-transform: uppercase; }

                        .header { text-align: center; margin-bottom: 20px; }
                        .header h1 { margin: 0; font-size: 24px; text-transform: uppercase; font-weight: bold; }
                        .header p { margin: 2px 0; font-size: 14px; }
                        .header-line { border-bottom: 1px solid #000; margin-bottom: 15px; }
                        .info-section { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px; }
                        .bill-to { width: 45%; }
                        .invoice-meta { width: 50%; text-align: right; }
                        .meta-row { display: flex; justify-content: flex-end; align-items: center; margin-bottom: 4px; }
                        .meta-label { font-weight: bold; margin-right: 10px; text-align: right; width: 140px; }
                        .meta-value { text-align: left; width: 150px; font-weight: bold; color: #000; }
                        .meta-value-box { border: 1px solid #000; text-align: center; width: 150px; padding: 2px 0; font-weight: bold; }
                        
                        table.std-table { width: 100%; border-collapse: collapse; margin-top: 10px; }
                        .std-table th { border: 1px solid #000; padding: 4px; text-align: center; background-color: #fff; font-weight: bold; font-size: 13px; }
                        .std-table td { border: 1px solid #000; padding: 4px 8px; font-size: 13px; vertical-align: top; }
                        
                        .totals-section { margin-top: 10px; text-align: right; }
                        .total-row { display: flex; justify-content: flex-end; margin-bottom: 2px; }
                        .total-label { width: 150px; font-weight: bold; padding-right: 10px; }
                        .total-value { width: 120px; text-align: right; border-bottom: 1px solid #000; font-weight: bold; }
                        .double-border { border-bottom: 3px double #000; }
                        
                        .cert-section { display: flex; justify-content: space-between; margin-top: 40px; }
                        .cert-left { width: 45%; }
                        .cert-right { width: 45%; text-align: center; }
                        .dots { display: block; margin: 10px 0; border-bottom: 1px dotted #000; width: 200px; }
                        
                        .bank-section { margin-top: 20px; }
                        .bank-title { font-weight: bold; margin-bottom: 5px; }
                        .bank-row { display: flex; margin-bottom: 2px; }
                        .bank-label { width: 100px; }
                        
                        .footer-grid-table { width: 100%; border-collapse: collapse; border: 1px solid #000; margin-top: 20px; }
                        .footer-grid-table td { border: 1px solid #000; padding: 5px; vertical-align: middle; }
                        .footer-header { font-weight: bold; text-align: center; background-color: #f0f0f0; }
                        .sig-box { height: 60px; }

                        table.details-table { width: 100%; border-collapse: collapse; font-size: 11px; }
                        .details-table th { border: 1px solid #ccc; padding: 4px; background-color: #eee; text-align: center; writing-mode: vertical-rl; transform: rotate(180deg); height: 100px; white-space: nowrap; }
                        .details-table th.fixed-header { writing-mode: horizontal-tb; transform: none; height: auto; }
                        .details-table td { border: 1px solid #ccc; padding: 4px; text-align: center; }
                        
                        .page-header { display: flex; justify-content: space-between; margin-bottom: 10px; align-items: center; border-bottom: 1px solid #000; padding-bottom: 5px; }
                    </style>
                </head>
                <body>
                    <div class="portrait-page">
                        <div class="header">
                            <h1>${invoice.contractor.name.toUpperCase()}</h1>
                            <p>${invoice.contractor.address || 'Address Not Provided'}</p>
                            <p>${invoice.contractor.contactNumber || ''}</p>
                            <div class="header-line" style="margin-top: 5px;"></div>
                        </div>

                        <div class="info-section">
                            <div class="bill-to">
                                <strong>Bill To:</strong><br>
                                <div style="margin-left: 50px; margin-top: -15px;">
                                    Sri Lanka Telecom (Services) Limited<br>
                                    OSP Division, 148/2/A, New Kandy Road,<br>
                                    Bandarawatta, Biyagama.
                                </div>
                            </div>
                            <div class="invoice-meta">
                                <div class="meta-row">
                                    <span class="meta-label">Invoice Number :</span>
                                    <span class="meta-value">${invoice.invoiceNumber}</span>
                                </div>
                                <div class="meta-row">
                                    <span class="meta-label">Registered Number :</span>
                                    <span class="meta-value">${invoice.contractor.registrationNumber || '-'}</span>
                                </div>
                                <div class="meta-row">
                                    <span class="meta-label">Invoice Date :</span>
                                    <span class="meta-value">${displayDate}</span>
                                </div>
                                <div class="meta-row">
                                    <span class="meta-label">Job Related Month :</span>
                                    <span class="meta-value" style="color: #a00;">${jobMonth}</span>
                                </div>
                                <div class="meta-row">
                                    <span class="meta-label">Invoice :</span>
                                    <div class="meta-value-box">A</div>
                                </div>
                            </div>
                        </div>

                        <table class="std-table">
                            <thead>
                                <tr>
                                    <th style="width: 50px;">Ser.No</th>
                                    <th>Description</th>
                                    <th style="width: 60px;">RTOM</th>
                                    <th style="width: 40px;">Qty</th>
                                    <th style="width: 100px;">Unit Rate</th>
                                    <th style="width: 120px;">Amount</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td class="text-center">1</td>
                                    <td>FTTH Services - Total Work Done</td>
                                    <td class="text-center">-</td>
                                    <td class="text-center">1</td>
                                    <td class="text-right">${fmt(invoice.totalAmount)}</td>
                                    <td class="text-right">${fmt(invoice.totalAmount)}</td>
                                </tr>
                                ${[...Array(3)].map(() => '<tr><td>&nbsp;</td><td></td><td></td><td></td><td></td><td></td></tr>').join('')}
                            </tbody>
                        </table>

                        <div class="totals-section">
                            <div class="total-row">
                                <span class="total-label">Grand Total (Rs.)</span>
                                <span class="total-value">${fmt(invoice.totalAmount)}</span>
                            </div>
                            <div class="total-row">
                                <span class="total-label">90%</span>
                                <span class="total-value double-border">${fmt(invoice.amountA)}</span>
                            </div>
                        </div>

                        <div class="cert-section">
                            <div class="cert-left">
                                <p>I do here by certify that the above details are true and correct.</p>
                                <br>
                                <span class="dots" style="margin-left: 50px;"></span>
                                <p style="margin-left: 80px;">Prepared By:<br><strong>${invoice.contractor.name}</strong></p>
                            </div>
                            <div class="cert-right">
                                <br><br>
                                <span class="dots" style="margin: 0 auto; width: 220px;"></span>
                                <p>Received By: (Sign / Date)<br>Should be Sign by SLTS officer</p>
                            </div>
                        </div>

                        <div class="bank-section">
                            <p class="bank-title">Cheque should be drawn in favour of "${invoice.contractor.name}"</p>
                            <div class="bank-row">
                                <span class="bank-label">Account No:</span>
                                <span>${invoice.contractor.bankAccountNumber || '-'}</span>
                            </div>
                            <div class="bank-row">
                                <span class="bank-label">Bank:</span>
                                <span>${invoice.contractor.bankName || '-'}</span>
                            </div>
                            <div class="bank-row">
                                <span class="bank-label">Branch:</span>
                                <span>${invoice.contractor.bankBranch || '-'}</span>
                            </div>
                        </div>

                        <div style="margin-top: 10px; font-weight: bold; border-top: 1px solid #000; margin-bottom: 5px;">SLTS Use Only:</div>
                        <table class="footer-grid-table" style="margin-top: 0;">
                            <tr>
                                <td style="width: 15%; border: none;"></td>
                                <td class="footer-header" style="width: 35%;">Regional Signature</td>
                                <td class="footer-header" style="width: 25%;">Head Office Signature</td>
                                <td class="footer-header" style="width: 25%;">Finance</td>
                            </tr>
                            <tr>
                                <td style="text-align: left; font-weight: bold; padding-left: 5px;">Checked By:</td>
                                <td class="sig-box"></td>
                                <td class="sig-box"></td>
                                <td class="sig-box" rowspan="3"></td>
                            </tr>
                            <tr>
                                <td style="text-align: left; font-weight: bold; padding-left: 5px;">Certified by: By:</td>
                                <td class="sig-box"></td>
                                <td class="sig-box"></td>
                            </tr>
                            <tr>
                                <td style="text-align: left; font-weight: bold; padding-left: 5px;">Approved By:</td>
                                <td class="sig-box"></td>
                                <td class="sig-box"></td>
                            </tr>
                            <tr>
                                <td style="text-align: left; padding: 5px;">Office Use Only:</td>
                                <td colspan="2" style="padding: 0;">Yes / Sign / Date...</td>
                                <td style="vertical-align: bottom; text-align: left; padding: 5px; font-size: 11px;">Recommended By:</td>
                            </tr>
                        </table>
                    </div>

                    ${pages.map((pageSods, pageIndex) => `
                        <div class="landscape-page">
                            <div class="page-header">
                                <div><strong>Contractor Name:</strong> ${invoice.contractor.name.toUpperCase()}</div>
                                <div class="font-bold">FTTH - WT</div>
                                <div><strong>Invoice No:</strong> ${invoice.invoiceNumber}</div>
                            </div>
                            
                            <table class="details-table">
                                <thead>
                                    <tr>
                                        <th class="fixed-header">NO</th>
                                        <th class="fixed-header">TP Number</th>
                                        <th class="fixed-header">Configs</th>
                                        <th class="fixed-header">RTOM</th>
                                        <th class="fixed-header">Complete<br>Date</th>
                                        ${sortedMaterialCols.map(col => `<th>${col}</th>`).join('')}
                                        <th class="fixed-header">Pole details &<br>Remarks</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${pageSods.map((sod: InvoiceSOD, idx: number) => {
                                        const usageMap: Record<string, number> = {};
                                        sod.materialUsage.forEach((u: InvoiceMaterialUsage) => {
                                            if (u.item?.name) usageMap[u.item.name] = u.quantity;
                                        });

                                        return `
                                            <tr>
                                                <td>${pageIndex * ITEMS_PER_PAGE + idx + 1}</td>
                                                <td>${sod.serviceOrderId || '-'}</td>
                                                <td>OK</td>
                                                <td>${sod.rtom || '-'}</td>
                                                <td>${sod.completedAt ? new Date(sod.completedAt).toISOString().split('T')[0] : '-'}</td>
                                                ${sortedMaterialCols.map(col => `<td>${usageMap[col] || ''}</td>`).join('')}
                                                <td></td>
                                            </tr>
                                        `;
                                    }).join('')}
                                    ${pageIndex === pages.length - 1 ? `
                                        <tr style="font-weight: bold; background-color: #eee;">
                                            <td colspan="5" class="text-right">Material Totals</td>
                                            ${sortedMaterialCols.map(col => `<td>${materialTotals[col] || 0}</td>`).join('')}
                                            <td></td>
                                        </tr>
                                    ` : ''}
                                </tbody>
                            </table>
                            <div style="font-size: 11px; margin-top: 5px; text-align: right;">Page ${pageIndex + 2} of ${pages.length + 1}</div>
                        </div>
                    `).join('')}

                    <script>
                        window.onload = function() { window.print(); }
                    </script>
                </body>
                </html>
            `;

            printWindow.document.open();
            printWindow.document.write(html);
            printWindow.document.close();

        } catch (error) {
            console.error(error);
            printWindow.document.body.innerHTML = '<h3>Error loading invoice details.</h3>';
        }
    };

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'LKR'
        }).format(amount || 0);
    };

    const totalAmount = invoices.reduce((sum, inv) => sum + inv.totalAmount, 0);
    const paidAmount = invoices.reduce((sum, inv) => {
        let paid = 0;
        if (inv.statusA === 'PAID') paid += inv.amountA;
        if (inv.statusB === 'PAID') paid += inv.amountB;
        return sum + paid;
    }, 0);
    const pendingAmount = invoices.reduce((sum, inv) => {
        let pending = 0;
        if (inv.statusA !== 'PAID') pending += inv.amountA;
        if (inv.statusB !== 'PAID') pending += inv.amountB;
        return sum + pending;
    }, 0);

    return (
        <div className="erp-page-wrapper flex-row overflow-hidden">
            <Sidebar />
            <main className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
                <Header />
                <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
                    <div className="max-w-7xl mx-auto space-y-4">
                        
                        {/* Page Header */}
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                            <div className="space-y-0.5">
                                <h1 className="text-xl font-black text-slate-900 tracking-tight">Contractor Invoices</h1>
                                <p className="text-xs text-slate-500">Generate and manage 90/10 split invoices.</p>
                            </div>
                            <div className="flex gap-2 w-full sm:w-auto">
                                {userRole !== 'AREA_COORDINATOR' && userRole !== 'QC_OFFICER' && (
                                    <Button onClick={() => setCreateDialogOpen(true)} className="flex-1 sm:flex-none h-8 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-xs transition-all shadow-sm">
                                        <Plus className="w-4 h-4 mr-1.5" /> Generate Monthly Invoice
                                    </Button>
                                )}
                            </div>
                        </div>

                        {/* Top Stats Cards */}
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                            <Card className="rounded-xl border border-slate-200 bg-white">
                                <CardContent className="p-3 flex items-center justify-between">
                                    <div>
                                        <p className="text-[10px] font-black uppercase text-slate-400">Total Amount</p>
                                        <p className="text-base font-black text-slate-900">{formatCurrency(totalAmount)}</p>
                                    </div>
                                    <div className="h-8 w-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                                        <Banknote className="w-4 h-4" />
                                    </div>
                                </CardContent>
                            </Card>
                            <Card className="rounded-xl border border-slate-200 bg-white">
                                <CardContent className="p-3 flex items-center justify-between">
                                    <div>
                                        <p className="text-[10px] font-black uppercase text-slate-400">Paid (A+B)</p>
                                        <p className="text-base font-black text-emerald-600">{formatCurrency(paidAmount)}</p>
                                    </div>
                                    <div className="h-8 w-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                                        <ShieldCheck className="w-4 h-4" />
                                    </div>
                                </CardContent>
                            </Card>
                            <Card className="rounded-xl border border-slate-200 bg-white">
                                <CardContent className="p-3 flex items-center justify-between">
                                    <div>
                                        <p className="text-[10px] font-black uppercase text-slate-400">Pending (A+B)</p>
                                        <p className="text-base font-black text-amber-600">{formatCurrency(pendingAmount)}</p>
                                    </div>
                                    <div className="h-8 w-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                                        <Users className="w-4 h-4" />
                                    </div>
                                </CardContent>
                            </Card>
                            <Card className="rounded-xl border border-slate-200 bg-white">
                                <CardContent className="p-3 flex items-center justify-between">
                                    <div>
                                        <p className="text-[10px] font-black uppercase text-slate-400">Total Invoices</p>
                                        <p className="text-base font-black text-slate-900">{invoices.length}</p>
                                    </div>
                                    <div className="h-8 w-8 rounded-lg bg-slate-50 text-slate-600 flex items-center justify-center">
                                        <FileText className="w-4 h-4" />
                                    </div>
                                </CardContent>
                            </Card>
                        </div>

                        {/* Dense Invoices Table */}
                        <div className="erp-table-container">
                            {loading ? (
                                <div className="py-20 flex flex-col items-center justify-center text-slate-400 gap-4">
                                    <div className="h-8 w-8 border-3 border-blue-100 border-t-blue-600 rounded-full animate-spin" />
                                    <p className="text-[10px] font-black uppercase tracking-wider animate-pulse">Loading Invoices...</p>
                                </div>
                            ) : invoices.length === 0 ? (
                                <div className="py-20 flex flex-col items-center justify-center bg-white rounded-xl border border-dashed border-slate-200 text-slate-400">
                                    <FileText className="w-10 h-10 opacity-20 mb-3" />
                                    <p className="text-xs font-bold">No invoices generated yet.</p>
                                </div>
                            ) : (
                                <ResponsiveTable>
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr>
                                                <th className="px-3 py-2 text-xs font-semibold text-slate-500 uppercase">Invoice #</th>
                                                <th className="px-3 py-2 text-xs font-semibold text-slate-500 uppercase">Contractor</th>
                                                <th className="px-3 py-2 text-xs font-semibold text-slate-500 uppercase">Total (LKR)</th>
                                                <th className="px-3 py-2 text-xs font-semibold text-slate-500 uppercase">90% Payment (A)</th>
                                                <th className="px-3 py-2 text-xs font-semibold text-slate-500 uppercase">10% Retention (B)</th>
                                                <th className="px-3 py-2 text-xs font-semibold text-slate-500 uppercase">Date</th>
                                                <th className="px-3 py-2 text-right pr-6 w-36">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 bg-white">
                                            {invoices.map((inv) => (
                                                <tr key={inv.id} className="hover:bg-slate-50/50 transition-colors">
                                                    <td className="font-mono font-bold text-slate-900">{inv.invoiceNumber}</td>
                                                    <td className="text-slate-600 font-medium">{inv.contractor?.name}</td>
                                                    <td className="font-bold text-slate-900">{formatCurrency(inv.totalAmount)}</td>

                                                    {/* Part A Status */}
                                                    <td>
                                                        <div className="flex flex-col gap-0.5 items-start">
                                                            <span className="font-semibold text-slate-800">{formatCurrency(inv.amountA)}</span>
                                                            <Badge className={cn(
                                                                "border-none px-1.5 py-0.2 text-[9px] font-black leading-none",
                                                                inv.statusA === 'PAID' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                                                            )}>
                                                                {inv.statusA}
                                                            </Badge>
                                                        </div>
                                                    </td>

                                                    {/* Part B Status */}
                                                    <td>
                                                        <div className="flex flex-col gap-0.5 items-start">
                                                            <span className="font-semibold text-slate-800">{formatCurrency(inv.amountB)}</span>
                                                            <Badge className={cn(
                                                                "border-none px-1.5 py-0.2 text-[9px] font-black leading-none",
                                                                inv.statusB === 'PAID' ? 'bg-emerald-50 text-emerald-700' :
                                                                inv.statusB === 'ELIGIBLE' ? 'bg-blue-50 text-blue-700' :
                                                                'bg-red-50 text-red-700'
                                                            )}>
                                                                {inv.statusB}
                                                            </Badge>
                                                        </div>
                                                    </td>

                                                    <td className="text-slate-500 font-medium">
                                                        {new Date(inv.date).toLocaleDateString()}
                                                    </td>
                                                    <td className="text-right pr-6">
                                                        <div className="inline-flex items-center gap-1.5">
                                                            <Button
                                                                size="sm"
                                                                variant="ghost"
                                                                onClick={() => handlePrint(inv)}
                                                                className="h-7 w-7 p-0 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                                                                title="Print Invoice"
                                                            >
                                                                <Printer className="w-3.5 h-3.5" />
                                                            </Button>
                                                            {inv.status === 'PENDING' && (
                                                                <Button
                                                                    size="sm"
                                                                    variant="ghost"
                                                                    onClick={() => handleStatusChange(inv.id, 'APPROVED')}
                                                                    className="h-7 w-7 p-0 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-all"
                                                                    title="Approve Invoice"
                                                                >
                                                                    <Check className="w-3.5 h-3.5" />
                                                                </Button>
                                                            )}
                                                            {inv.status === 'APPROVED' && (
                                                                <Button
                                                                    size="sm"
                                                                    variant="ghost"
                                                                    onClick={() => handleStatusChange(inv.id, 'PAID')}
                                                                    className="h-7 w-7 p-0 text-green-600 hover:text-green-700 hover:bg-green-50 rounded-lg transition-all"
                                                                    title="Mark Paid"
                                                                >
                                                                    <Check className="w-3.5 h-3.5" />
                                                                </Button>
                                                            )}
                                                            {inv.status !== 'PAID' && (
                                                                <Button
                                                                    size="sm"
                                                                    variant="ghost"
                                                                    onClick={() => handleDelete(inv.id)}
                                                                    className="h-7 w-7 p-0 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                                                                    title="Delete Invoice"
                                                                >
                                                                    <Trash2 className="w-3.5 h-3.5" />
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

            {/* Generate Dialog */}
            <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
                <DialogContent className="max-w-md rounded-2xl">
                    <DialogHeader>
                        <DialogTitle className="text-lg font-black text-slate-900">Generate Monthly Invoice</DialogTitle>
                        <DialogDescription className="text-xs text-slate-500">Select contractor and billing period.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-3">
                        <div className="space-y-1.5">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Contractor</Label>
                            <Select onValueChange={(v) => setGenerateParams({ ...generateParams, contractorId: v })}>
                                <SelectTrigger className="h-10 rounded-lg bg-slate-50 border-none"><SelectValue placeholder="Select Contractor" /></SelectTrigger>
                                <SelectContent>
                                    {contractors.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Month</Label>
                                <Input type="number" min={1} max={12} value={generateParams.month} onChange={(e) => setGenerateParams({ ...generateParams, month: parseInt(e.target.value) })} className="h-10 rounded-lg bg-slate-50 border-none" />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Year</Label>
                                <Input type="number" min={2020} max={2030} value={generateParams.year} onChange={(e) => setGenerateParams({ ...generateParams, year: parseInt(e.target.value) })} className="h-10 rounded-lg bg-slate-50 border-none" />
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button onClick={handleGenerate} disabled={loading} className="w-full bg-slate-900 hover:bg-slate-800 text-white h-11 rounded-lg font-bold text-xs uppercase tracking-wider">{loading ? 'Generating...' : 'Generate Invoice'}</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

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
import { Plus, FileText, Check, X, Trash2, Eye, Printer } from 'lucide-react';

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

export default function InvoicesPage() {
    const router = useRouter();
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [contractors, setContractors] = useState<Contractor[]>([]);
    const [loading, setLoading] = useState(true);
    const [createDialogOpen, setCreateDialogOpen] = useState(false);
    const [statusFilter, setStatusFilter] = useState('ALL');

    const [generateParams, setGenerateParams] = useState({
        contractorId: '',
        month: new Date().getMonth() + 1,
        year: new Date().getFullYear()
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
            // Fetch Full Details
            const res = await fetch(`/api/invoices/${baseInvoice.id}/details`);
            if (!res.ok) throw new Error('Failed to fetch details');
            const invoice = await res.json();

            // Extract Month/Year
            const invDate = new Date(invoice.date);
            const jobMonth = invDate.toLocaleString('default', { month: 'short', year: '2-digit' }).replace(' ', '-');
            const displayDate = invDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' }).replace(/ /g, '-');
            const fmt = (amt: number) => new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amt);

            // prepare Materials
            const allMaterials = new Set<string>();
            invoice.sods.forEach((sod: any) => {
                sod.materialUsage.forEach((usage: any) => {
                    if (usage.item && usage.item.name) allMaterials.add(usage.item.name);
                });
            });
            const materialCols = Array.from(allMaterials).sort(); // Alphabetical or define custom order

            // Custom Order based on image
            const preferredOrder = ['F-1', 'G-1', 'DW-LH', 'DW-CH', 'DW-RT', 'IW-N', 'CAT 5', 'FAC', 'F ROSSETTE', 'TOP BOLT', 'CONDUITS', 'CASING'];
            const sortedMaterialCols = materialCols.sort((a, b) => {
                const idxA = preferredOrder.indexOf(a);
                const idxB = preferredOrder.indexOf(b);
                if (idxA !== -1 && idxB !== -1) return idxA - idxB;
                if (idxA !== -1) return -1;
                if (idxB !== -1) return 1;
                return a.localeCompare(b);
            });

            // Pagination Logic
            const ITEMS_PER_PAGE = 25;
            const pages = [];
            for (let i = 0; i < invoice.sods.length; i += ITEMS_PER_PAGE) {
                pages.push(invoice.sods.slice(i, i + ITEMS_PER_PAGE));
            }

            // Calculations for Material Totals
            const materialTotals: Record<string, number> = {};
            sortedMaterialCols.forEach(col => materialTotals[col] = 0);

            invoice.sods.forEach((sod: any) => {
                sod.materialUsage.forEach((usage: any) => {
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

                        /* Common Utilities */
                        .text-center { text-align: center; }
                        .text-right { text-align: right; }
                        .font-bold { font-weight: bold; }
                        .uppercase { text-transform: uppercase; }

                        /* Invoice Summary Styles (Portrait) */
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
                        
                        /* Standard Table */
                         table.std-table { width: 100%; border-collapse: collapse; margin-top: 10px; }
                        .std-table th { border: 1px solid #000; padding: 4px; text-align: center; background-color: #fff; font-weight: bold; font-size: 13px; }
                        .std-table td { border: 1px solid #000; padding: 4px 8px; font-size: 13px; vertical-align: top; }
                        
                        /* Totals */
                        .totals-section { margin-top: 10px; text-align: right; }
                        .total-row { display: flex; justify-content: flex-end; margin-bottom: 2px; }
                        .total-label { width: 150px; font-weight: bold; padding-right: 10px; }
                        .total-value { width: 120px; text-align: right; border-bottom: 1px solid #000; font-weight: bold; }
                        .double-border { border-bottom: 3px double #000; }
                        
                         /* Certification */
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

                        /* Landscape Details Table */
                        table.details-table { width: 100%; border-collapse: collapse; font-size: 11px; }
                        .details-table th { border: 1px solid #ccc; padding: 4px; background-color: #eee; text-align: center; writing-mode: vertical-rl; transform: rotate(180deg); height: 100px; white-space: nowrap; }
                        .details-table th.fixed-header { writing-mode: horizontal-tb; transform: none; height: auto; }
                        .details-table td { border: 1px solid #ccc; padding: 4px; text-align: center; }
                        
                        .page-header { display: flex; justify-content: space-between; margin-bottom: 10px; align-items: center; border-bottom: 1px solid #000; padding-bottom: 5px; }

                    </style>
                </head>
                <body>
                    <!-- PAGE 1: PORTRAIT SUMMARY -->
                    <div class="portrait-page">
                         <!-- Header -->
                        <div class="header">
                            <h1>${invoice.contractor.name.toUpperCase()}</h1>
                            <p>${invoice.contractor.address || 'Address Not Provided'}</p>
                            <p>${invoice.contractor.contactNumber || ''}</p>
                            <div class="header-line" style="margin-top: 5px;"></div>
                        </div>

                        <!-- Meta Section -->
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
                                    <td class="col-center">1</td>
                                    <td>FTTH Services - Total Work Done</td>
                                    <td class="col-center">-</td>
                                    <td class="col-center">1</td>
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

                    <!-- PAGES 2+: LANDSCAPE DETAILS -->
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
                                    ${pageSods.map((sod: any, idx: number) => {
                // Build material mapping for this row
                const usageMap: any = {};
                sod.materialUsage.forEach((u: any) => {
                    if (u.item?.name) usageMap[u.item.name] = u.quantity;
                });

                return `
                                            <tr>
                                                <td>${pageIndex * ITEMS_PER_PAGE + idx + 1}</td>
                                                <td>${sod.serviceOrderId || '-'}</td>
                                                <td>OK</td> <!-- Configs status assumed OK if completed -->
                                                <td>${sod.rtom || '-'}</td>
                                                <td>${sod.completedAt ? new Date(sod.completedAt).toISOString().split('T')[0] : '-'}</td>
                                                ${sortedMaterialCols.map(col => `<td>${usageMap[col] || ''}</td>`).join('')}
                                                <td></td>
                                            </tr>
                                        `;
            }).join('')}
                                    ${pageIndex === pages.length - 1 ? `
                                        <!-- Totals Row on Last Page -->
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

    const getStatusBadge = (status: string) => {
        const variants: Record<string, { variant: any; className: string }> = {
            PENDING: { variant: 'outline', className: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
            APPROVED: { variant: 'outline', className: 'bg-blue-50 text-blue-700 border-blue-200' },
            PAID: { variant: 'outline', className: 'bg-green-50 text-green-700 border-green-200' },
            HOLD: { variant: 'outline', className: 'bg-orange-50 text-orange-700 border-orange-200' },
            ELIGIBLE: { variant: 'outline', className: 'bg-purple-50 text-purple-700 border-purple-200' }
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
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                            <div>
                                <h1 className="text-xl md:text-2xl font-bold text-slate-900">Contractor Invoices</h1>
                                <p className="text-sm text-slate-500 mt-1">Generate and manage 90/10 split invoices.</p>
                            </div>
                            <div className="flex gap-2">
                                <Button onClick={() => setCreateDialogOpen(true)} className="gap-2">
                                    <Plus className="w-4 h-4" />
                                    Generate Monthly Invoice
                                </Button>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
                            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                                <p className="text-xs font-medium text-slate-500 uppercase">Total Amount</p>
                                <p className="text-lg md:text-2xl font-bold text-slate-900 mt-1">{formatCurrency(totalAmount)}</p>
                            </div>
                            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                                <p className="text-xs font-medium text-slate-500 uppercase">Paid (A+B)</p>
                                <p className="text-lg md:text-2xl font-bold text-green-600 mt-1">{formatCurrency(paidAmount)}</p>
                            </div>
                            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                                <p className="text-xs font-medium text-slate-500 uppercase">Pending (A+B)</p>
                                <p className="text-lg md:text-2xl font-bold text-yellow-600 mt-1">{formatCurrency(pendingAmount)}</p>
                            </div>
                            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                                <p className="text-xs font-medium text-slate-500 uppercase">Total Invoices</p>
                                <p className="text-lg md:text-2xl font-bold text-slate-900 mt-1">{invoices.length}</p>
                            </div>
                        </div>

                        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                            <ResponsiveTable>
                                <table className="min-w-full divide-y divide-slate-200">
                                    <thead className="bg-slate-50">
                                        <tr>
                                            <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Invoice #</th>
                                            <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Contractor</th>
                                            <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Total (LKR)</th>
                                            <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase">90% Payment (A)</th>
                                            <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase">10% Retention (B)</th>
                                            <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Date</th>
                                            <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-200">
                                        {invoices.map((inv) => (
                                            <tr key={inv.id} className="hover:bg-slate-50">
                                                <td className="px-6 py-4 text-sm font-medium text-slate-900">{inv.invoiceNumber}</td>
                                                <td className="px-6 py-4 text-sm text-slate-600">{inv.contractor?.name}</td>
                                                <td className="px-6 py-4 text-sm font-bold text-slate-900">{formatCurrency(inv.totalAmount)}</td>

                                                {/* Part A Status */}
                                                <td className="px-6 py-4">
                                                    <div className="flex flex-col gap-1">
                                                        <span className="text-sm font-medium">{formatCurrency(inv.amountA)}</span>
                                                        <Badge variant="outline" className={inv.statusA === 'PAID' ? 'bg-green-50 text-green-700 w-fit' : 'bg-yellow-50 text-yellow-700 w-fit'}>
                                                            {inv.statusA}
                                                        </Badge>
                                                    </div>
                                                </td>

                                                {/* Part B Status */}
                                                <td className="px-6 py-4">
                                                    <div className="flex flex-col gap-1">
                                                        <span className="text-sm font-medium">{formatCurrency(inv.amountB)}</span>
                                                        <Badge variant="outline" className={
                                                            inv.statusB === 'PAID' ? 'bg-green-50 text-green-700 w-fit' :
                                                                inv.statusB === 'ELIGIBLE' ? 'bg-blue-50 text-blue-700 w-fit' :
                                                                    'bg-red-50 text-red-700 w-fit'
                                                        }>
                                                            {inv.statusB}
                                                        </Badge>
                                                    </div>
                                                </td>

                                                <td className="px-6 py-4 text-sm text-slate-500">
                                                    {new Date(inv.date).toLocaleDateString()}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-2">
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            onClick={() => handlePrint(inv)}
                                                            className="gap-1 text-slate-600"
                                                            title="Print Invoice"
                                                        >
                                                            <Printer className="w-3 h-3" />
                                                        </Button>
                                                        {inv.status === 'PENDING' && (
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                onClick={() => handleStatusChange(inv.id, 'APPROVED')}
                                                                className="gap-1"
                                                            >
                                                                <Check className="w-3 h-3" />
                                                                Approve
                                                            </Button>
                                                        )}
                                                        {inv.status === 'APPROVED' && (
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                onClick={() => handleStatusChange(inv.id, 'PAID')}
                                                                className="gap-1 text-green-600"
                                                            >
                                                                <Check className="w-3 h-3" />
                                                                Pay
                                                            </Button>
                                                        )}
                                                        {inv.status !== 'PAID' && (
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                onClick={() => handleDelete(inv.id)}
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
                        </div>
                    </div>
                </div>
            </main>

            <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Generate Monthly Invoice</DialogTitle>
                        <DialogDescription>Select contractor and billing period.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>Contractor</Label>
                            <Select onValueChange={(v) => setGenerateParams({ ...generateParams, contractorId: v })}>
                                <SelectTrigger><SelectValue placeholder="Select Contractor" /></SelectTrigger>
                                <SelectContent>
                                    {contractors.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Month</Label>
                                <Input type="number" min={1} max={12} value={generateParams.month} onChange={(e) => setGenerateParams({ ...generateParams, month: parseInt(e.target.value) })} />
                            </div>
                            <div className="space-y-2">
                                <Label>Year</Label>
                                <Input type="number" min={2020} max={2030} value={generateParams.year} onChange={(e) => setGenerateParams({ ...generateParams, year: parseInt(e.target.value) })} />
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button onClick={handleGenerate} disabled={loading}>{loading ? 'Generating...' : 'Generate Invoice'}</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

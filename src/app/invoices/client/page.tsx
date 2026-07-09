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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Check, Trash2, Printer, Banknote, ShieldCheck, Users, FileText, Upload, RefreshCw } from 'lucide-react';
import { cn } from "@/lib/utils";

interface ProjectInvoiceItem {
    id: string;
    description: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
}

interface ClientInvoice {
    id: string;
    invoiceNumber: string;
    title: string;
    description: string | null;
    status: string;
    totalAmount: number;
    paidAmount: number;
    balanceAmount: number;
    invoiceDate: string;
    createdAt: string;
    items: ProjectInvoiceItem[];
    referenceNumber: string | null;
    project: {
        projectCode: string;
        name: string;
    };
}

interface SLTBOM {
    bomRef: string;
    rtom: string;
    contractor: string;
    path: string;
}

export default function ClientInvoicesPage() {
    const [invoices, setInvoices] = useState<ClientInvoice[]>([]);
    const [loading, setLoading] = useState(true);
    const [bomImportDialogOpen, setBomImportDialogOpen] = useState(false);
    const [bomFile, setBomFile] = useState<File | null>(null);
    const [importing, setImporting] = useState(false);
    const [selectedInvoice, setSelectedInvoice] = useState<ClientInvoice | null>(null);
    const [detailsOpen, setDetailsOpen] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const pageSize = 10;

    // SLT BOM Registry States
    const [sltBoms, setSltBoms] = useState<SLTBOM[]>([]);
    const [sltLoading, setSltLoading] = useState(false);
    const [activeTab, setActiveTab] = useState<'invoices' | 'slt-boms'>('invoices');
    const [targetBOM, setTargetBOM] = useState<SLTBOM | null>(null);
    const [syncDialogOpen, setSyncDialogOpen] = useState(false);

    const fetchSltRegistry = async () => {
        setSltLoading(true);
        try {
            const res = await fetch(`/api/invoices/slt-registry?_t=${Date.now()}`);
            const data = await res.json();
            if (data.success) {
                setSltBoms(data.boms || []);
            }
        } catch (err) {
            console.error('Failed to fetch slt registry:', err);
        } finally {
            setSltLoading(false);
        }
    };

    // Metrics
    const [totalBilled, setTotalBilled] = useState(0);
    const [totalConnections, setTotalConnections] = useState(0);
    const [pendingAmount, setPendingAmount] = useState(0);

    const fetchInvoices = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/projects/invoices?allClient=true&_t=${Date.now()}`, {
                cache: 'no-store',
                headers: {
                    'Pragma': 'no-cache',
                    'Cache-Control': 'no-cache'
                }
            });
            if (!res.ok) throw new Error('Failed to fetch invoices');
            const data = await res.json();
            setInvoices(data);

            // Calculate metrics
            let billed = 0;
            let conns = 0;
            let pending = 0;

            data.forEach((inv: ClientInvoice) => {
                billed += inv.totalAmount;
                if (inv.status !== 'FULLY_PAID' && inv.status !== 'CANCELLED') {
                    pending += inv.balanceAmount;
                }
                inv.items.forEach(item => {
                    conns += item.quantity;
                });
            });

            setTotalBilled(billed);
            setTotalConnections(conns);
            setPendingAmount(pending);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchInvoices();
        fetchSltRegistry();
    }, []);

    const handleBOMImport = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!bomFile) return;

        setImporting(true);
        try {
            const reader = new FileReader();

            // Extract BOM path from file name if it matches standard format
            let bomPath = bomFile.name.replace(/\.[^/.]+$/, ""); // strip extension
            if (bomPath.toUpperCase().startsWith("BOM")) {
                bomPath = bomPath.replace(/-/g, "/"); // restore slashes
            }

            if (bomFile.name.toLowerCase().endsWith('.csv')) {
                reader.onload = async (evt) => {
                    try {
                        const csvText = evt.target?.result as string;
                        const res = await fetch('/api/invoices/import-bom/csv', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ csvText, bomPath })
                        });

                        const json = await res.json();
                        if (!res.ok) {
                            throw new Error(json.error || json.message || 'Import failed');
                        }

                        if (json.success) {
                            let msg = `Successfully parsed SLT BOM CSV Sheet!\n\n`;
                            msg += `- Matched connections (PAT Passed): ${json.matchedCount}\n`;
                            msg += `- Generated Client Invoice: ${json.clientInvoiceNumber}\n`;
                            msg += `- Total Recognized Project Revenue: ${json.totalRevenue.toLocaleString()} LKR\n`;
                            
                            if (json.warnings && json.warnings.length > 0) {
                                msg += `\nWarnings (${json.warnings.length} unmatched connection SOs):\n`;
                                msg += json.warnings.slice(0, 10).join('\n');
                                if (json.warnings.length > 10) {
                                    msg += `\n...and ${json.warnings.length - 10} more.`;
                                }
                            }
                            alert(msg);
                        } else {
                            alert(`BOM Import Warning: ${json.warnings?.join('\n')}`);
                        }
                        setBomImportDialogOpen(false);
                        setBomFile(null);
                        fetchInvoices();
                    } catch (err: any) {
                        console.error(err);
                        alert(`Error parsing/uploading BOM CSV: ${err.message}`);
                    } finally {
                        setImporting(false);
                    }
                };
                reader.readAsText(bomFile);
            } else {
                const XLSX = await import('xlsx');
                reader.onload = async (evt) => {
                    try {
                        const bstr = evt.target?.result;
                        const wb = XLSX.read(bstr, { type: 'binary' });
                        const wsname = wb.SheetNames[0];
                        const ws = wb.Sheets[wsname];
                        const data = XLSX.utils.sheet_to_json(ws);
                        
                        if (data.length === 0) {
                            alert('No rows found in sheet');
                            setImporting(false);
                            return;
                        }

                        const res = await fetch('/api/invoices/import-bom', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ rows: data, bomPath })
                        });

                        const json = await res.json();
                        if (!res.ok) {
                            throw new Error(json.error || json.message || 'Import failed');
                        }

                        if (json.success) {
                            let msg = `Successfully parsed SLT BOM Sheet!\n\n`;
                            msg += `- Matched connections (PAT Passed): ${json.matchedCount}\n`;
                            msg += `- Generated Client Invoice: ${json.clientInvoiceNumber}\n`;
                            msg += `- Total Recognized Project Revenue: ${json.totalRevenue.toLocaleString()} LKR\n`;
                            
                            if (json.warnings && json.warnings.length > 0) {
                                msg += `\nWarnings (${json.warnings.length} unmatched connection SOs):\n`;
                                msg += json.warnings.slice(0, 10).join('\n');
                                if (json.warnings.length > 10) {
                                    msg += `\n...and ${json.warnings.length - 10} more.`;
                                }
                            }
                            alert(msg);
                        } else {
                            alert(`BOM Import Warning: ${json.warnings?.join('\n')}`);
                        }
                        setBomImportDialogOpen(false);
                        setBomFile(null);
                        fetchInvoices();
                    } catch (err: any) {
                        console.error(err);
                        alert(`Error parsing/uploading BOM: ${err.message}`);
                    } finally {
                        setImporting(false);
                    }
                };
                reader.readAsBinaryString(bomFile);
            }
        } catch (err: any) {
            console.error(err);
            alert(`Error loading excel parser: ${err.message}`);
            setImporting(false);
        }
    };

    const handleUpdateStatus = async (id: string, newStatus: string) => {
        if (!confirm(`Are you sure you want to change status to ${newStatus}?`)) return;

        try {
            const res = await fetch('/api/projects/invoices', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, status: newStatus })
            });

            if (!res.ok) {
                const json = await res.json();
                throw new Error(json.error || 'Failed to update invoice');
            }

            alert(`Invoice status updated successfully to ${newStatus}!`);
            fetchInvoices();
        } catch (err: any) {
            alert(`Error: ${err.message}`);
        }
    };

    const handleRecordPayment = async (id: string, amount: number) => {
        if (!confirm(`Record a client payment of ${amount.toLocaleString()} LKR?`)) return;

        try {
            const res = await fetch('/api/projects/invoices', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, paidAmount: amount })
            });

            if (!res.ok) {
                const json = await res.json();
                throw new Error(json.error || 'Failed to record payment');
            }

            alert('Payment recorded successfully!');
            fetchInvoices();
        } catch (err: any) {
            alert(`Error: ${err.message}`);
        }
    };

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'LKR'
        }).format(amount || 0);
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'DRAFT':
                return <Badge className="bg-slate-100 text-slate-700 border-none font-bold text-[9px] px-1.5 py-0.2">DRAFT</Badge>;
            case 'ISSUED':
                return <Badge className="bg-blue-50 text-blue-700 border-none font-bold text-[9px] px-1.5 py-0.2">ISSUED / ACCRUED</Badge>;
            case 'FULLY_PAID':
                return <Badge className="bg-emerald-50 text-emerald-700 border-none font-bold text-[9px] px-1.5 py-0.2">FULLY PAID</Badge>;
            case 'CANCELLED':
                return <Badge className="bg-rose-50 text-rose-700 border-none font-bold text-[9px] px-1.5 py-0.2">CANCELLED</Badge>;
            default:
                return <Badge className="bg-slate-100 text-slate-700 border-none font-bold text-[9px] px-1.5 py-0.2">{status}</Badge>;
        }
    };

    const paginatedInvoices = invoices.slice((currentPage - 1) * pageSize, currentPage * pageSize);

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
                                <h1 className="text-xl font-black text-slate-900 tracking-tight">Client Invoices & BOM Sync</h1>
                                <p className="text-xs text-slate-500">Revenue Recognition from SLT PAT-Passed BOM sheets.</p>
                            </div>
                            <div className="flex gap-2 w-full sm:w-auto">
                                <Button 
                                    onClick={fetchInvoices} 
                                    className="h-8 px-3 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 font-bold text-xs"
                                >
                                    <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                                    Refresh
                                </Button>
                                <Button
                                    onClick={() => setBomImportDialogOpen(true)}
                                    className="h-8 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition-all shadow-sm"
                                >
                                    <Upload className="w-3.5 h-3.5 mr-1.5" />
                                    Sync SLT BOM Sheet
                                </Button>
                            </div>
                        </div>

                        {/* Top Stats Cards */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <Card className="rounded-xl border border-slate-200 bg-white">
                                <CardContent className="p-3 flex items-center justify-between">
                                    <div>
                                        <p className="text-[10px] font-black uppercase text-slate-400">Total Billed to SLT</p>
                                        <p className="text-base font-black text-slate-900">{formatCurrency(totalBilled)}</p>
                                    </div>
                                    <div className="h-8 w-8 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center">
                                        <Banknote className="w-4 h-4" />
                                    </div>
                                </CardContent>
                            </Card>
                            <Card className="rounded-xl border border-slate-200 bg-white">
                                <CardContent className="p-3 flex items-center justify-between">
                                    <div>
                                        <p className="text-[10px] font-black uppercase text-slate-400">PAT-Passed Syncs</p>
                                        <p className="text-base font-black text-slate-900">{totalConnections.toLocaleString()} Connections</p>
                                    </div>
                                    <div className="h-8 w-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                                        <ShieldCheck className="w-4 h-4" />
                                    </div>
                                </CardContent>
                            </Card>
                            <Card className="rounded-xl border border-slate-200 bg-white">
                                <CardContent className="p-3 flex items-center justify-between">
                                    <div>
                                        <p className="text-[10px] font-black uppercase text-slate-400">Outstanding Receivables</p>
                                        <p className="text-base font-black text-amber-600">{formatCurrency(pendingAmount)}</p>
                                    </div>
                                    <div className="h-8 w-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                                        <Users className="w-4 h-4" />
                                    </div>
                                </CardContent>
                            </Card>
                        </div>

                        {/* Double Tabs for ERP Invoices vs SLT Portal BOM Registry */}
                        <Tabs value={activeTab} onValueChange={(val) => setActiveTab(val as any)} className="w-full">
                            <TabsList className="bg-slate-100 p-1 rounded-xl w-full max-w-[400px] mb-4 flex border border-slate-200">
                                <TabsTrigger value="invoices" className="flex-1 rounded-lg text-xs font-bold py-2 data-[state=active]:bg-white data-[state=active]:text-slate-900 transition-all">
                                    ERP Invoices
                                </TabsTrigger>
                                <TabsTrigger value="slt-boms" className="flex-1 rounded-lg text-xs font-bold py-2 data-[state=active]:bg-white data-[state=active]:text-slate-900 transition-all">
                                    SLT Portal BOM List
                                </TabsTrigger>
                            </TabsList>

                            <TabsContent value="invoices" className="mt-0">
                                <div className="erp-table-container">
                                    {loading ? (
                                        <div className="py-20 flex flex-col items-center justify-center text-slate-400 gap-4">
                                            <div className="h-8 w-8 border-3 border-blue-100 border-t-blue-600 rounded-full animate-spin" />
                                            <p className="text-[10px] font-black uppercase tracking-wider animate-pulse">Loading Invoices...</p>
                                        </div>
                                    ) : invoices.length === 0 ? (
                                        <div className="py-20 flex flex-col items-center justify-center bg-white rounded-xl border border-dashed border-slate-200 text-slate-400">
                                            <FileText className="w-10 h-10 opacity-20 mb-3" />
                                            <p className="text-xs font-bold">No client invoices found.</p>
                                        </div>
                                    ) : (
                                        <>
                                            <ResponsiveTable>
                                                <table className="w-full text-left border-collapse">
                                                    <thead>
                                                        <tr>
                                                            <th className="px-3 py-2 text-xs font-semibold text-slate-500 uppercase">Invoice #</th>
                                                            <th className="px-3 py-2 text-xs font-semibold text-slate-500 uppercase">Invoice Title</th>
                                                            <th className="px-3 py-2 text-xs font-semibold text-slate-500 uppercase">Project Code</th>
                                                            <th className="px-3 py-2 text-xs font-semibold text-slate-500 uppercase">Date</th>
                                                            <th className="px-3 py-2 text-xs font-semibold text-slate-500 uppercase">Billing Amount</th>
                                                            <th className="px-3 py-2 text-xs font-semibold text-slate-500 uppercase">Status</th>
                                                            <th className="px-3 py-2 text-right pr-6 w-36">Actions</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-slate-100 bg-white">
                                                        {paginatedInvoices.map((inv) => (
                                                            <tr key={inv.id} className="hover:bg-slate-50/50 transition-colors">
                                                                <td className="font-mono font-bold text-slate-900">{inv.invoiceNumber}</td>
                                                                <td className="text-slate-600 font-medium">
                                                                    <div className="flex flex-col">
                                                                        <span className="font-semibold text-slate-950 text-xs">{inv.title}</span>
                                                                        <span className="text-[10px] text-slate-500 mt-0.5">{inv.description || 'No description'}</span>
                                                                    </div>
                                                                </td>
                                                                <td>
                                                                    <Badge className="bg-slate-100 text-slate-700 border-none text-[9px] font-mono">{inv.project.projectCode}</Badge>
                                                                </td>
                                                                <td className="text-slate-500 font-medium">
                                                                    {new Date(inv.invoiceDate).toLocaleDateString()}
                                                                </td>
                                                                <td className="font-bold text-slate-900">
                                                                    {formatCurrency(inv.totalAmount)}
                                                                </td>
                                                                <td>
                                                                    {getStatusBadge(inv.status)}
                                                                </td>
                                                                <td className="text-right pr-6">
                                                                    <div className="inline-flex items-center gap-1.5">
                                                                        <Button
                                                                            size="sm"
                                                                            onClick={() => {
                                                                                setSelectedInvoice(inv);
                                                                                setDetailsOpen(true);
                                                                            }}
                                                                            className="h-7 px-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-[10px] uppercase font-bold rounded-lg"
                                                                        >
                                                                            View
                                                                        </Button>
                                                                        {inv.referenceNumber && inv.referenceNumber.toUpperCase().startsWith("BOM") && (
                                                                            <a
                                                                                href={`https://serviceportal.slt.lk/iShamp/files/${inv.referenceNumber.trim().replace(/\//g, '-')}.csv`}
                                                                                target="_blank"
                                                                                rel="noopener noreferrer"
                                                                                className="inline-flex items-center justify-center h-7 px-2.5 bg-sky-50 hover:bg-sky-100 text-sky-700 text-[10px] uppercase font-black rounded-lg transition-colors"
                                                                                title="Download original BOM CSV from SLT portal"
                                                                            >
                                                                                Download BOM
                                                                            </a>
                                                                        )}
                                                                        {inv.status === 'DRAFT' && (
                                                                            <Button
                                                                                size="sm"
                                                                                onClick={() => handleUpdateStatus(inv.id, 'ISSUED')}
                                                                                className="h-7 px-2.5 bg-blue-600 hover:bg-blue-700 text-white text-[10px] uppercase font-bold rounded-lg"
                                                                            >
                                                                                Approve
                                                                            </Button>
                                                                        )}
                                                                        {inv.status === 'ISSUED' && (
                                                                            <Button
                                                                                size="sm"
                                                                                onClick={() => handleRecordPayment(inv.id, inv.balanceAmount)}
                                                                                className="h-7 px-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] uppercase font-bold rounded-lg"
                                                                            >
                                                                                Pay
                                                                            </Button>
                                                                        )}
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </ResponsiveTable>

                                            {/* Pagination Footer Controls */}
                                            <div className="flex items-center justify-between border-t border-slate-100 bg-white px-4 py-3 sm:px-6 mt-4 rounded-xl">
                                                <div className="flex flex-1 justify-between sm:hidden">
                                                    <Button
                                                        onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                                                        disabled={currentPage === 1}
                                                        className="h-8 px-3 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 font-bold text-xs"
                                                    >
                                                        Previous
                                                    </Button>
                                                    <Button
                                                        onClick={() => setCurrentPage(prev => Math.min(prev + 1, Math.ceil(invoices.length / pageSize)))}
                                                        disabled={currentPage >= Math.ceil(invoices.length / pageSize) || invoices.length === 0}
                                                        className="h-8 px-3 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 font-bold text-xs"
                                                    >
                                                        Next
                                                    </Button>
                                                </div>
                                                <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
                                                    <div>
                                                        <p className="text-xs text-slate-500">
                                                            Showing <span className="font-bold text-slate-900">{invoices.length > 0 ? (currentPage - 1) * pageSize + 1 : 0}</span> to <span className="font-bold text-slate-900">{Math.min(currentPage * pageSize, invoices.length)}</span> of{' '}
                                                            <span className="font-bold text-slate-900">{invoices.length}</span> results
                                                        </p>
                                                    </div>
                                                    <div className="flex gap-2">
                                                        <Button
                                                            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                                                            disabled={currentPage === 1}
                                                            className="h-8 px-3 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 font-bold text-xs"
                                                        >
                                                            Previous
                                                        </Button>
                                                        <Button
                                                            onClick={() => setCurrentPage(prev => Math.min(prev + 1, Math.ceil(invoices.length / pageSize)))}
                                                            disabled={currentPage >= Math.ceil(invoices.length / pageSize) || invoices.length === 0}
                                                            className="h-8 px-3 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 font-bold text-xs"
                                                        >
                                                            Next
                                                        </Button>
                                                    </div>
                                                </div>
                                            </div>
                                        </>
                                    )}
                                </div>
                            </TabsContent>

                            <TabsContent value="slt-boms" className="mt-0">
                                <div className="erp-table-container bg-white rounded-xl border border-slate-200 p-4">
                                    {sltLoading ? (
                                        <div className="py-20 flex flex-col items-center justify-center text-slate-400 gap-4">
                                            <div className="h-8 w-8 border-3 border-blue-100 border-t-blue-600 rounded-full animate-spin" />
                                            <p className="text-[10px] font-black uppercase tracking-wider animate-pulse">Loading SLT BOMs...</p>
                                        </div>
                                    ) : sltBoms.length === 0 ? (
                                        <div className="py-16 flex flex-col items-center justify-center bg-white text-slate-400 p-8 text-center max-w-xl mx-auto">
                                            <FileText className="w-12 h-12 opacity-20 mb-4" />
                                            <h3 className="text-sm font-black uppercase tracking-wider text-slate-800 mb-1">SLT Portal Registry Empty</h3>
                                            <p className="text-xs text-slate-500 leading-relaxed mb-4">
                                                No SLT portal BOM sheets have been synced to the local ERP registry yet. Use the bookmarklet below to scrape the table from the SLT portal.
                                            </p>
                                            <div className="p-3 bg-slate-50 rounded-lg text-[10px] text-left text-slate-600 border border-slate-100 space-y-2 mb-4">
                                                <p className="font-bold text-slate-800">Bookmarklet Instructions:</p>
                                                <ol className="list-decimal list-inside space-y-1">
                                                    <li>Drag the <b>"Sync BOM Registry"</b> button to your bookmarks bar.</li>
                                                    <li>Open the SLT Portal BOM list page.</li>
                                                    <li>Click the bookmarklet to load this registry dynamically!</li>
                                                </ol>
                                            </div>
                                            <a
                                                href={`javascript:(async()=>{alert('Scraping SLT BOM list...');const rows=[];document.querySelectorAll('table tbody tr').forEach(tr=>{const tds=tr.querySelectorAll('td');if(tds.length>=4){const bomRef=tds[0].innerText.trim();const rtom=tds[1].innerText.trim();const contractor=tds[2].innerText.trim();const btn=tds[3].querySelector('button');const onclick=btn?btn.getAttribute('onclick'):'';const match=onclick.match(/bomDwnload\\(\\'([^\\']+)\\'\\)/);const path=match?match[1]:bomRef;rows.push({bomRef,rtom,contractor,path});}});if(rows.length===0){alert('No BOM rows found. Make sure you are on the SLT BOM portal page.');return;}try{const res=await fetch('${typeof window !== 'undefined' ? window.location.origin : ''}/api/invoices/slt-registry',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({boms:rows})});const json=await res.json();if(!res.ok)throw new Error(json.message||'Failed');alert('Successfully synced '+rows.length+' BOM sheets to ERP!');window.location.reload();}catch(err){alert('Sync Error: '+err.message);}})();`}
                                                className="inline-flex items-center justify-center h-9 px-6 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-black text-xs uppercase tracking-wider transition-all select-none shadow-sm cursor-grab border-none"
                                                onClick={(e) => e.preventDefault()}
                                            >
                                                Sync BOM Registry
                                            </a>
                                        </div>
                                    ) : (
                                        <>
                                            <div className="mb-3 flex flex-col sm:flex-row justify-between items-start sm:items-center bg-slate-50 p-3 rounded-xl border border-slate-100 gap-2">
                                                <div className="flex flex-wrap gap-2">
                                                    <a
                                                        href={`javascript:(async()=>{alert('Scraping SLT BOM list...');const rows=[];document.querySelectorAll('table tbody tr').forEach(tr=>{const tds=tr.querySelectorAll('td');if(tds.length>=4){const bomRef=tds[0].innerText.trim();const rtom=tds[1].innerText.trim();const contractor=tds[2].innerText.trim();const btn=tds[3].querySelector('button');const onclick=btn?btn.getAttribute('onclick'):'';const match=onclick.match(/bomDwnload\\(\\'([^\\']+)\\'\\)/);const path=match?match[1]:bomRef;rows.push({bomRef,rtom,contractor,path});}});if(rows.length===0){alert('No BOM rows found. Make sure you are on the SLT BOM portal page.');return;}try{const res=await fetch('${typeof window !== 'undefined' ? window.location.origin : ''}/api/invoices/slt-registry',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({boms:rows})});const json=await res.json();if(!res.ok)throw new Error(json.message||'Failed');alert('Successfully synced '+rows.length+' BOM sheets to ERP!');window.location.reload();}catch(err){alert('Sync Error: '+err.message);}})();`}
                                                        className="inline-flex items-center justify-center h-8 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-black text-[11px] uppercase tracking-wider cursor-grab select-none shadow-sm"
                                                        onClick={(e) => e.preventDefault()}
                                                        title="Drag to bookmarks bar"
                                                    >
                                                        Sync BOM Registry Bookmarklet
                                                    </a>
                                                    <Button
                                                        onClick={fetchSltRegistry}
                                                        size="sm"
                                                        className="h-8 px-3 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 font-bold text-xs"
                                                    >
                                                        <RefreshCw className="w-3.5 h-3.5 mr-1" />
                                                        Refresh List
                                                    </Button>
                                                </div>
                                                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                                                    Latest Scraped BOMs: <span className="text-slate-900 font-extrabold">{sltBoms.length} Sheets</span>
                                                </p>
                                            </div>
                                            <ResponsiveTable>
                                                <table className="w-full text-left border-collapse">
                                                    <thead>
                                                        <tr>
                                                            <th className="px-3 py-2 text-xs font-semibold text-slate-500 uppercase">BOM Ref</th>
                                                            <th className="px-3 py-2 text-xs font-semibold text-slate-500 uppercase">RTOM</th>
                                                            <th className="px-3 py-2 text-xs font-semibold text-slate-500 uppercase">Contractor</th>
                                                            <th className="px-3 py-2 text-xs font-semibold text-slate-500 uppercase">Sync Status</th>
                                                            <th className="px-3 py-2 text-right pr-6 w-56">Action</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-slate-100 bg-white">
                                                        {sltBoms.map((bom, idx) => {
                                                            const matchedInvoice = invoices.find(inv => inv.referenceNumber === bom.path || inv.referenceNumber === bom.bomRef);
                                                            return (
                                                                <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                                                                    <td className="font-mono font-bold text-slate-900 text-xs">{bom.bomRef}</td>
                                                                    <td className="text-slate-600 font-bold text-xs">{bom.rtom}</td>
                                                                    <td className="text-slate-600 font-medium text-xs">{bom.contractor}</td>
                                                                    <td>
                                                                        {matchedInvoice ? (
                                                                            <Badge className="bg-emerald-50 text-emerald-700 border-none font-bold text-[9px] px-1.5 py-0.2">
                                                                                SYNCED ({matchedInvoice.invoiceNumber})
                                                                            </Badge>
                                                                        ) : (
                                                                            <Badge className="bg-amber-50 text-amber-700 border-none font-bold text-[9px] px-1.5 py-0.2">
                                                                                NOT SYNCED
                                                                            </Badge>
                                                                        )}
                                                                    </td>
                                                                    <td className="text-right pr-6">
                                                                        <div className="inline-flex items-center gap-1.5">
                                                                            {matchedInvoice ? (
                                                                                <Button
                                                                                    size="sm"
                                                                                    onClick={() => {
                                                                                        setSelectedInvoice(matchedInvoice);
                                                                                        setDetailsOpen(true);
                                                                                    }}
                                                                                    className="h-7 px-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-[10px] uppercase font-bold rounded-lg"
                                                                                >
                                                                                    View Invoice
                                                                                </Button>
                                                                            ) : (
                                                                                <Button
                                                                                    size="sm"
                                                                                    onClick={() => {
                                                                                        setTargetBOM(bom);
                                                                                        setSyncDialogOpen(true);
                                                                                    }}
                                                                                    className="h-7 px-2.5 bg-blue-600 hover:bg-blue-700 text-white text-[10px] uppercase font-bold rounded-lg"
                                                                                >
                                                                                    Sync & Generate
                                                                                </Button>
                                                                            )}
                                                                            <a
                                                                                href={`https://serviceportal.slt.lk/iShamp/files/${bom.path.trim().replace(/\//g, '-')}.csv`}
                                                                                target="_blank"
                                                                                rel="noopener noreferrer"
                                                                                className="inline-flex items-center justify-center h-7 px-2.5 bg-sky-50 hover:bg-sky-100 text-sky-700 text-[10px] uppercase font-black rounded-lg transition-colors"
                                                                                title="Download original BOM CSV from SLT portal"
                                                                            >
                                                                                Download BOM
                                                                            </a>
                                                                        </div>
                                                                    </td>
                                                                </tr>
                                                            );
                                                        })}
                                                    </tbody>
                                                </table>
                                            </ResponsiveTable>
                                        </>
                                    )}
                                </div>
                            </TabsContent>
                        </Tabs>

                    </div>
                </div>
            </main>

            {/* DETAILS DIALOG */}
            <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
                <DialogContent className="sm:max-w-[500px] rounded-2xl bg-white text-slate-900">
                    <DialogHeader>
                        <DialogTitle className="text-sm font-black uppercase tracking-wider text-slate-900">
                            Client Billing Invoice Details
                        </DialogTitle>
                        <DialogDescription className="text-xs text-slate-500">
                            Line items and breakdown for invoice {selectedInvoice?.invoiceNumber}.
                        </DialogDescription>
                    </DialogHeader>

                    {selectedInvoice && (
                        <div className="space-y-4 py-2">
                            <div className="grid grid-cols-2 gap-4 text-xs bg-slate-50 p-4 rounded-xl border border-slate-100">
                                <div>
                                    <span className="text-[10px] font-black uppercase text-slate-400">Invoice Number</span>
                                    <p className="font-bold text-slate-900 mt-0.5">{selectedInvoice.invoiceNumber}</p>
                                </div>
                                <div>
                                    <span className="text-[10px] font-black uppercase text-slate-400">Project / Code</span>
                                    <p className="font-bold text-slate-900 mt-0.5">{selectedInvoice.project.name} ({selectedInvoice.project.projectCode})</p>
                                </div>
                                <div>
                                    <span className="text-[10px] font-black uppercase text-slate-400">Invoice Date</span>
                                    <p className="font-bold text-slate-900 mt-0.5">{new Date(selectedInvoice.invoiceDate).toLocaleDateString()}</p>
                                </div>
                                <div>
                                    <span className="text-[10px] font-black uppercase text-slate-400">Total Billed Amount</span>
                                    <p className="font-bold text-blue-600 mt-0.5">{formatCurrency(selectedInvoice.totalAmount)}</p>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Billing Items</Label>
                                <div className="space-y-2 max-h-[200px] overflow-y-auto pr-1">
                                    {selectedInvoice.items.map((item) => (
                                        <div key={item.id} className="flex justify-between items-center bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                                            <div className="flex flex-col">
                                                <span className="text-xs font-bold text-slate-800">{item.description}</span>
                                                <span className="text-[10px] text-slate-400 mt-0.5">Qty: {item.quantity} | Unit Price: {formatCurrency(item.unitPrice)}</span>
                                            </div>
                                            <span className="text-xs font-bold text-slate-950">{formatCurrency(item.quantity * item.unitPrice)}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                    <DialogFooter>
                        <Button onClick={() => setDetailsOpen(false)} className="w-full bg-slate-900 hover:bg-slate-800 text-white h-9 font-bold text-xs uppercase rounded-lg">
                            Close
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* BOM Import Dialog */}
            <Dialog open={bomImportDialogOpen} onOpenChange={setBomImportDialogOpen}>
                <DialogContent className="sm:max-w-[450px] rounded-2xl bg-white text-slate-900">
                    <DialogHeader>
                        <DialogTitle className="text-sm font-black uppercase tracking-wider text-slate-900">
                            Import SLT BOM Sheet (Client Billing & PAT Sync)
                        </DialogTitle>
                        <DialogDescription className="text-xs text-slate-500">
                            Process SLT BOM CSV/Excel sheets to mark matched connections as PAT-passed and generate Client Invoices.
                        </DialogDescription>
                    </DialogHeader>
                    
                    <Tabs defaultValue="file" className="w-full">
                        <TabsList className="grid w-full grid-cols-2 bg-slate-100 rounded-xl p-1 mb-4">
                            <TabsTrigger value="file" className="rounded-lg text-xs font-bold py-1.5 data-[state=active]:bg-white data-[state=active]:text-slate-900">Upload File</TabsTrigger>
                            <TabsTrigger value="sync" className="rounded-lg text-xs font-bold py-1.5 data-[state=active]:bg-white data-[state=active]:text-slate-900">Browser Sync</TabsTrigger>
                        </TabsList>

                        <TabsContent value="file">
                            <form onSubmit={handleBOMImport} className="space-y-4">
                                <div className="space-y-1.5">
                                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Select BOM File (.csv, .xlsx, .xls)</Label>
                                    <Input 
                                        type="file" 
                                        accept=".csv, .xlsx, .xls" 
                                        required 
                                        onChange={(e) => setBomFile(e.target.files?.[0] || null)}
                                        className="h-10 rounded-lg bg-slate-50 border-none file:mr-4 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-slate-200 file:text-slate-700 hover:file:bg-slate-350 cursor-pointer" 
                                    />
                                </div>
                                <DialogFooter className="pt-2">
                                    <Button 
                                        type="submit" 
                                        disabled={importing || !bomFile} 
                                        className="w-full bg-blue-600 hover:bg-blue-700 text-white h-11 rounded-lg font-bold text-xs uppercase tracking-wider"
                                    >
                                        {importing ? 'Processing BOM...' : 'Import & Generate'}
                                    </Button>
                                </DialogFooter>
                            </form>
                        </TabsContent>

                        <TabsContent value="sync" className="space-y-4">
                            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                                <h4 className="text-xs font-black uppercase tracking-wider text-slate-800">SLT Portal Auto-Sync Bookmarklet</h4>
                                <p className="text-[11px] text-slate-600 leading-relaxed">
                                    To sync BOM data directly from the SLT Service Portal without downloading and uploading CSV files manually:
                                </p>
                                <ol className="list-decimal list-inside text-[10px] text-slate-500 space-y-1.5">
                                    <li>Drag the button below to your browser Bookmarks Bar.</li>
                                    <li>Go to the SLT Service Portal page containing the BOM download link.</li>
                                    <li>Click the <b>"Sync to ERP"</b> bookmark in your bookmarks bar.</li>
                                    <li>Enter the BOM Path (e.g. <code className="bg-slate-200 text-slate-700 px-1 rounded">BOM/R-AD/2023-09-09-24030409</code>) when prompted.</li>
                                </ol>
                                
                                <div className="pt-2 flex justify-center">
                                    <a
                                        href={`javascript:(async()=>{const path=prompt('Enter BOM Path (e.g. BOM/R-AD/2023-09-09-24030409):');if(!path)return;const cleanPath=path.trim().replace(/\\//g,'-');const url=\`/iShamp/files/\${cleanPath}.csv\`;alert('Fetching BOM CSV from SLT Portal...');try{const res=await fetch(url);if(!res.ok)throw new Error('Failed to fetch CSV from SLT portal. Make sure you are logged in.');const csvText=await res.text();alert('BOM CSV fetched successfully! Sending to SLTSERP...');const erpRes=await fetch('${typeof window !== 'undefined' ? window.location.origin : ''}/api/invoices/import-bom/csv',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({csvText})});const json=await erpRes.json();if(!erpRes.ok)throw new Error(json.error||json.message||'Import failed');alert('BOM sync successful!\\n- Matched connections: '+json.matchedCount+'\\n- Generated Client Invoice: '+json.clientInvoiceNumber+'\\n- Revenue: '+json.totalRevenue.toLocaleString()+' LKR');}catch(err){alert('Sync Error: '+err.message);}})();`}
                                        className="inline-flex items-center justify-center h-10 px-6 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-black text-xs uppercase tracking-wider transition-all select-none shadow-sm cursor-grab border-none"
                                        onClick={(e) => e.preventDefault()}
                                    >
                                        Sync to ERP
                                    </a>
                                </div>
                            </div>
                        </TabsContent>
                    </Tabs>
                    </DialogContent>
                </Dialog>
            {/* Target BOM Sync Dialog */}
            <Dialog open={syncDialogOpen} onOpenChange={setSyncDialogOpen}>
                <DialogContent className="sm:max-w-[450px] rounded-2xl bg-white text-slate-900">
                    <DialogHeader>
                        <DialogTitle className="text-sm font-black uppercase tracking-wider text-slate-900">
                            Sync BOM: {targetBOM?.bomRef}
                        </DialogTitle>
                        <DialogDescription className="text-xs text-slate-500">
                            Import connection data for BOM reference {targetBOM?.bomRef} to generate Client Billing Invoice.
                        </DialogDescription>
                    </DialogHeader>

                    <Tabs defaultValue="file" className="w-full">
                        <TabsList className="grid w-full grid-cols-2 bg-slate-100 rounded-xl p-1 mb-4">
                            <TabsTrigger value="file" className="rounded-lg text-xs font-bold py-1.5 data-[state=active]:bg-white data-[state=active]:text-slate-900">Upload File</TabsTrigger>
                            <TabsTrigger value="paste" className="rounded-lg text-xs font-bold py-1.5 data-[state=active]:bg-white data-[state=active]:text-slate-900">Paste CSV Text</TabsTrigger>
                        </TabsList>

                        <TabsContent value="file">
                            <form onSubmit={async (e) => {
                                e.preventDefault();
                                if (!bomFile || !targetBOM) return;
                                setImporting(true);
                                try {
                                    const reader = new FileReader();
                                    reader.onload = async (evt) => {
                                        try {
                                            const csvText = evt.target?.result as string;
                                            const res = await fetch('/api/invoices/import-bom/csv', {
                                                method: 'POST',
                                                headers: { 'Content-Type': 'application/json' },
                                                body: JSON.stringify({ csvText, bomPath: targetBOM.path })
                                            });
                                            const json = await res.json();
                                            if (!res.ok) throw new Error(json.error || json.message || 'Import failed');
                                            
                                            alert(`BOM Synced successfully!\n- Connections matched: ${json.matchedCount}\n- Invoice number: ${json.clientInvoiceNumber}\n- Total revenue: ${json.totalRevenue.toLocaleString()} LKR`);
                                            setSyncDialogOpen(false);
                                            setBomFile(null);
                                            fetchInvoices();
                                            fetchSltRegistry();
                                        } catch (err: any) {
                                            alert(`Sync Error: ${err.message}`);
                                        } finally {
                                            setImporting(false);
                                        }
                                    };
                                    reader.readAsText(bomFile);
                                } catch (err: any) {
                                    alert(`Error: ${err.message}`);
                                    setImporting(false);
                                }
                            }} className="space-y-4">
                                <div className="space-y-1.5">
                                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Select BOM CSV File</Label>
                                    <Input 
                                        type="file" 
                                        accept=".csv" 
                                        required 
                                        onChange={(e) => setBomFile(e.target.files?.[0] || null)}
                                        className="h-10 rounded-lg bg-slate-50 border-none file:mr-4 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-slate-200 file:text-slate-700 hover:file:bg-slate-350 cursor-pointer" 
                                    />
                                </div>
                                <DialogFooter className="pt-2">
                                    <Button 
                                        type="submit" 
                                        disabled={importing || !bomFile} 
                                        className="w-full bg-blue-600 hover:bg-blue-700 text-white h-11 rounded-lg font-bold text-xs uppercase tracking-wider"
                                    >
                                        {importing ? 'Syncing...' : 'Upload & Sync'}
                                    </Button>
                                </DialogFooter>
                            </form>
                        </TabsContent>

                        <TabsContent value="paste">
                            <form onSubmit={async (e) => {
                                e.preventDefault();
                                const form = e.currentTarget;
                                const csvText = (form.elements.namedItem('csvText') as HTMLTextAreaElement).value.trim();
                                if (!csvText || !targetBOM) return;
                                setImporting(true);
                                try {
                                    const res = await fetch('/api/invoices/import-bom/csv', {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ csvText, bomPath: targetBOM.path })
                                    });
                                    const json = await res.json();
                                    if (!res.ok) throw new Error(json.error || json.message || 'Import failed');
                                    
                                    alert(`BOM Synced successfully!\n- Connections matched: ${json.matchedCount}\n- Invoice number: ${json.clientInvoiceNumber}\n- Total revenue: ${json.totalRevenue.toLocaleString()} LKR`);
                                    setSyncDialogOpen(false);
                                    fetchInvoices();
                                    fetchSltRegistry();
                                } catch (err: any) {
                                    alert(`Sync Error: ${err.message}`);
                                } finally {
                                    setImporting(false);
                                }
                            }} className="space-y-4">
                                <div className="space-y-1.5">
                                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Paste CSV Plain Text</Label>
                                    <textarea
                                        name="csvText"
                                        required
                                        placeholder="Paste raw CSV text here..."
                                        className="w-full h-32 rounded-lg bg-slate-50 border border-slate-200 p-2.5 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-650"
                                    />
                                </div>
                                <DialogFooter className="pt-2">
                                    <Button 
                                        type="submit" 
                                        disabled={importing} 
                                        className="w-full bg-blue-600 hover:bg-blue-700 text-white h-11 rounded-lg font-bold text-xs uppercase tracking-wider"
                                    >
                                        {importing ? 'Syncing...' : 'Paste & Sync'}
                                    </Button>
                                </DialogFooter>
                            </form>
                        </TabsContent>
                    </Tabs>
                </DialogContent>
            </Dialog>
        </div>
    );
}

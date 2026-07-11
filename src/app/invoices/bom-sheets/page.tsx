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
import { Banknote, ShieldCheck, Users, FileText, Upload, RefreshCw } from 'lucide-react';
import { downloadExcelInvoice } from '@/lib/excel-invoice';

interface ClientInvoiceMaterialUsage {
    id: string;
    quantity: number;
    item?: {
        name?: string;
    };
}

interface ClientInvoiceSOD {
    id: string;
    soNum: string;
    voiceNumber?: string | null;
    techContact?: string | null;
    rtom: string;
    customerName?: string | null;
    address?: string | null;
    lea?: string | null;
    orderType?: string | null;
    serviceType?: string | null;
    receivedDate?: string | null;
    completedDate?: string | null;
    dp?: string | null;
    comments?: string | null;
    dropWireDistance?: number | null;
    materialUsage?: ClientInvoiceMaterialUsage[];
    isMismatched?: boolean;
    reconciliation?: any[];
    discrepancies?: any[];
}

interface ClientInvoice {
    id: string;
    invoiceNumber: string;
    description: string | null;
    status: string;
    totalAmount: number;
    amountA: number;
    amountB: number;
    date: string;
    createdAt: string;
    bomNumber: string | null;
    rtomArea: string | null;
    sods?: ClientInvoiceSOD[];
    contractor?: {
        name: string;
    };
    items?: any[];
    mismatchedSodsCount?: number;
    totalSodsCount?: number;
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

    const [loadingDetails, setLoadingDetails] = useState(false);
    const [activeTab, setActiveTab] = useState<'summary' | 'bom' | 'allocation' | 'poles' | 'reconciliation'>('summary');

    const [editKeyDataOpen, setEditKeyDataOpen] = useState(false);
    const [projects, setProjects] = useState<any[]>([]);
    const [keyDataForm, setKeyDataForm] = useState({
        id: '',
        connectionTitle: '',
        agreementNumber: '',
        projectNumber: '',
        bomNumber: '',
        rtomArea: '',
        projectId: ''
    });

    const handleOpenKeyData = async (invoice: ClientInvoice) => {
        setSelectedInvoice(invoice);
        setEditKeyDataOpen(true);
        setKeyDataForm({
            id: invoice.id,
            connectionTitle: '',
            agreementNumber: '',
            projectNumber: '',
            bomNumber: '',
            rtomArea: '',
            projectId: ''
        });
        try {
            const res = await fetch(`/api/invoices/${invoice.id}/details?_t=${Date.now()}`);
            if (res.ok) {
                const data = await res.json();
                setKeyDataForm({
                    id: invoice.id,
                    connectionTitle: data.connectionTitle || '',
                    agreementNumber: data.agreementNumber || '',
                    projectNumber: data.projectNumber ? String(data.projectNumber) : '',
                    bomNumber: data.bomNumber || '',
                    rtomArea: data.rtomArea || '',
                    projectId: data.projectId || ''
                });
            }
        } catch (err) {
            console.error('Error fetching invoice details for editing:', err);
        }
    };

    const handleProjectChange = (projId: string) => {
        const selectedProj = projects.find(p => p.id === projId);
        if (selectedProj) {
            const digits = selectedProj.projectCode.match(/\d+/);
            const projNum = digits ? digits[0] : '';
            
            setKeyDataForm(prev => ({
                ...prev,
                projectId: projId,
                projectNumber: projNum,
                connectionTitle: `${selectedProj.name} - connections`
            }));
        } else {
            setKeyDataForm(prev => ({
                ...prev,
                projectId: '',
                projectNumber: '',
                connectionTitle: ''
            }));
        }
    };

    const handleSaveKeyData = async () => {
        if (!selectedInvoice) return;
        try {
            setLoading(true);
            const res = await fetch('/api/invoices', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: selectedInvoice.id,
                    connectionTitle: keyDataForm.connectionTitle || null,
                    agreementNumber: keyDataForm.agreementNumber || null,
                    projectNumber: keyDataForm.projectNumber ? parseInt(keyDataForm.projectNumber) : null,
                    bomNumber: keyDataForm.bomNumber || null,
                    rtomArea: keyDataForm.rtomArea || null,
                    projectId: keyDataForm.projectId || null
                })
            });

            if (!res.ok) throw new Error('Failed to save key data');
            alert('Key data saved successfully!');
            setEditKeyDataOpen(false);
            fetchInvoices();
        } catch (error) {
            console.error('Error saving key data:', error);
            alert('Failed to save key data');
        } finally {
            setLoading(false);
        }
    };

    const handleOpenDetails = async (id: string) => {
        setLoadingDetails(true);
        setActiveTab('summary');
        setDetailsOpen(true);
        try {
            const res = await fetch(`/api/invoices/${id}/details?_t=${Date.now()}`);
            if (!res.ok) throw new Error('Failed to fetch details');
            const data = await res.json();
            setSelectedInvoice(data);
        } catch (err) {
            console.error(err);
            alert('Failed to load invoice details');
            setDetailsOpen(false);
        } finally {
            setLoadingDetails(false);
        }
    };

    // Metrics
    const [totalBilled, setTotalBilled] = useState(0);
    const [totalConnections, setTotalConnections] = useState(0);
    const [pendingAmount, setPendingAmount] = useState(0);

    const fetchInvoices = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/invoices?_t=${Date.now()}`, {
                cache: 'no-store',
                headers: {
                    'Pragma': 'no-cache',
                    'Cache-Control': 'no-cache'
                }
            });
            if (!res.ok) throw new Error('Failed to fetch invoices');
            const json = await res.json();
            const allData = json?.success && Array.isArray(json?.data) ? json.data : (Array.isArray(json) ? json : []);
            
            // Filter to only show BOM-imported invoices
            const data = allData.filter((inv: ClientInvoice) => inv.bomNumber);
            setInvoices(data);

            let billed = 0;
            let pending = 0;
            let conns = 0;

            data.forEach((inv: ClientInvoice & { _count?: { sods: number } }) => {
                billed += inv.totalAmount;
                if (inv.status !== 'FULLY_PAID' && inv.status !== 'CANCELLED') {
                    pending += inv.amountB || inv.totalAmount; // Ensure pending computes reasonably if amountB is 0
                }
                conns += inv._count?.sods || 0;
            });

            setTotalBilled(billed);
            setPendingAmount(pending);
            setTotalConnections(conns);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const fetchProjects = async () => {
        try {
            const res = await fetch('/api/projects');
            if (res.ok) {
                const data = await res.json();
                const list = data?.success && Array.isArray(data?.data) ? data.data : (Array.isArray(data) ? data : []);
                setProjects(list);
            }
        } catch (err) {
            console.error('Error fetching projects:', err);
        }
    };

    useEffect(() => {
        fetchInvoices();
        fetchProjects();
    }, []);

    const handleBOMImport = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!bomFile) return;

        setImporting(true);
        try {
            const reader = new FileReader();

            // Extract BOM path from file name and clean copy indicators like (1) or _1
            let bomPath = bomFile.name.replace(/\.[^/.]+$/, ""); // strip extension
            bomPath = bomPath.replace(/\s*\(\d+\)$/, "").replace(/_\d+$/, "").trim();

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

                            // Auto-open Details Dialog for the newly created invoice
                            if (json.invoiceId) {
                                handleOpenDetails(json.invoiceId);
                            }
                        } else {
                            alert(`BOM Import Warning: ${json.warnings?.join('\n')}`);
                        }
                        setBomImportDialogOpen(false);
                        setBomFile(null);
                        fetchInvoices();
                    } catch (err) {
                        const error = err as Error;
                        console.error(error);
                        alert(`Error parsing/uploading BOM CSV: ${error.message}`);
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
                        
                        // Prioritize sheet named "BOM" or containing "BOM"
                        let wsname = wb.SheetNames.find(name => name.toUpperCase() === 'BOM');
                        if (!wsname) {
                            wsname = wb.SheetNames.find(name => name.toUpperCase().includes('BOM'));
                        }
                        if (!wsname) {
                            wsname = wb.SheetNames[0];
                        }
                        const ws = wb.Sheets[wsname];

                        // Find header row containing SOD/SO Number indicators
                        let headerRowIndex = 0;
                        const range = XLSX.utils.decode_range(ws['!ref'] || 'A1:A1');
                        for (let r = range.s.r; r <= range.e.r; r++) {
                            for (let c = range.s.c; c <= range.e.c; c++) {
                                const addr = XLSX.utils.encode_cell({ r, c });
                                const cell = ws[addr];
                                if (cell && cell.v) {
                                    const val = String(cell.v).trim().toUpperCase();
                                    if (val === 'SOD' || val === 'SO NUMBER' || val === 'SERVICE ORDER' || val === 'SO_NUM') {
                                        headerRowIndex = r;
                                        break;
                                    }
                                }
                            }
                            if (headerRowIndex > 0) break;
                        }

                        const data = XLSX.utils.sheet_to_json(ws, { range: headerRowIndex });
                        
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

                            // Auto-open Details Dialog for the newly created invoice
                            if (json.invoiceId) {
                                handleOpenDetails(json.invoiceId);
                            }
                        } else {
                            alert(`BOM Import Warning: ${json.warnings?.join('\n')}`);
                        }
                        setBomImportDialogOpen(false);
                        setBomFile(null);
                        fetchInvoices();
                    } catch (err) {
                        const error = err as Error;
                        console.error(error);
                        alert(`Error parsing/uploading BOM: ${error.message}`);
                    } finally {
                        setImporting(false);
                    }
                };
                reader.readAsBinaryString(bomFile);
            }
        } catch (err) {
            const error = err as Error;
            console.error(error);
            alert(`Error loading excel parser: ${error.message}`);
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
        } catch (err) {
            const error = err as Error;
            alert(`Error: ${error.message}`);
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
        } catch (err) {
            const error = err as Error;
            alert(`Error: ${error.message}`);
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
                                <h1 className="text-xl font-black text-slate-900 tracking-tight">BOM Sheets</h1>
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
                                                                        <span className="font-semibold text-slate-950 text-xs">BOM Reference: {inv.bomNumber || 'N/A'}</span>
                                                                        <span className="text-[10px] text-slate-500 mt-0.5">{inv.description || 'SLT Claim Generated via BOM'}</span>
                                                                    </div>
                                                                </td>
                                                                <td>
                                                                    <Badge className="bg-slate-100 text-slate-700 border-none text-[9px] font-mono">{inv.rtomArea || 'GLOBAL'}</Badge>
                                                                </td>
                                                                <td className="text-slate-500 font-medium">
                                                                    {new Date(inv.date || inv.createdAt).toLocaleDateString()}
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
                                                                            onClick={() => handleOpenDetails(inv.id)}
                                                                            className="h-7 px-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-[10px] uppercase font-bold rounded-lg"
                                                                        >
                                                                            View
                                                                        </Button>
                                                                        <Button
                                                                            size="sm"
                                                                            onClick={() => handleOpenKeyData(inv)}
                                                                            className="h-7 px-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] uppercase font-bold rounded-lg"
                                                                        >
                                                                            Key Data
                                                                        </Button>
                                                                        <Button
                                                                            size="sm"
                                                                            onClick={async () => {
                                                                                await downloadExcelInvoice(inv.id, inv.invoiceNumber);
                                                                            }}
                                                                            className="h-7 px-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] uppercase font-bold rounded-lg"
                                                                        >
                                                                            Excel
                                                                        </Button>
                                                                        {inv.bomNumber && inv.bomNumber.toUpperCase().startsWith("BOM") && (
                                                                            <a
                                                                                href={`https://serviceportal.slt.lk/iShamp/files/${inv.bomNumber.trim().replace(/\//g, '-')}.csv`}
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
                                                                                onClick={() => handleRecordPayment(inv.id, inv.amountB)}
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

                    </div>
                </div>
            </main>

            {/* DETAILS DIALOG */}
            <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
                <DialogContent className="sm:max-w-[900px] w-[95vw] rounded-2xl bg-white text-slate-900 overflow-hidden flex flex-col max-h-[85vh]">
                    <DialogHeader>
                        <DialogTitle className="text-sm font-black uppercase tracking-wider text-slate-900">
                            Client Billing Invoice Details
                        </DialogTitle>
                        <DialogDescription className="text-xs text-slate-500">
                            Line items and breakdown for invoice {selectedInvoice?.invoiceNumber}.
                        </DialogDescription>
                    </DialogHeader>

                    {loadingDetails ? (
                        <div className="py-20 flex flex-col items-center justify-center text-slate-400 gap-4 flex-1">
                            <div className="h-8 w-8 border-3 border-blue-100 border-t-blue-600 rounded-full animate-spin" />
                            <p className="text-[10px] font-black uppercase tracking-wider animate-pulse">Loading Invoice Details...</p>
                        </div>
                    ) : selectedInvoice && (
                        (() => {
                            const uniqueMaterials = Array.from(new Set(selectedInvoice.sods?.flatMap((sod: ClientInvoiceSOD) => sod.materialUsage?.map((mu: ClientInvoiceMaterialUsage) => mu.item?.name).filter(Boolean)) || [])) as string[];
                            return (
                                <div className="space-y-4 py-2 flex-1 overflow-hidden flex flex-col min-h-0">
                                    {/* Tab Buttons */}
                                    <div className="flex border-b border-slate-100 pb-1 gap-2 overflow-x-auto scrollbar-none">
                                        <Button 
                                            variant="ghost" 
                                            onClick={() => setActiveTab('summary')}
                                            className={`h-8 px-3 text-xs uppercase font-bold rounded-lg transition-colors whitespace-nowrap ${activeTab === 'summary' ? 'bg-slate-100 text-slate-900 font-black' : 'text-slate-500 hover:bg-slate-50'}`}
                                        >
                                            Summary
                                        </Button>
                                        <Button 
                                            variant="ghost" 
                                            onClick={() => setActiveTab('bom')}
                                            className={`h-8 px-3 text-xs uppercase font-bold rounded-lg transition-colors whitespace-nowrap ${activeTab === 'bom' ? 'bg-slate-100 text-slate-900 font-black' : 'text-slate-500 hover:bg-slate-50'}`}
                                        >
                                            BOM Sheet
                                        </Button>
                                        <Button 
                                            variant="ghost" 
                                            onClick={() => setActiveTab('allocation')}
                                            className={`h-8 px-3 text-xs uppercase font-bold rounded-lg transition-colors whitespace-nowrap ${activeTab === 'allocation' ? 'bg-slate-100 text-slate-900 font-black' : 'text-slate-500 hover:bg-slate-50'}`}
                                        >
                                            Allocations
                                        </Button>
                                        <Button 
                                            variant="ghost" 
                                            onClick={() => setActiveTab('poles')}
                                            className={`h-8 px-3 text-xs uppercase font-bold rounded-lg transition-colors whitespace-nowrap ${activeTab === 'poles' ? 'bg-slate-100 text-slate-900 font-black' : 'text-slate-500 hover:bg-slate-50'}`}
                                        >
                                            Poles
                                        </Button>
                                        <Button 
                                            variant="ghost" 
                                            onClick={() => setActiveTab('reconciliation')}
                                            className={`h-8 px-3 text-xs uppercase font-bold rounded-lg transition-colors whitespace-nowrap flex items-center gap-1.5 ${activeTab === 'reconciliation' ? 'bg-slate-100 text-slate-900 font-black' : 'text-slate-500 hover:bg-slate-50'}`}
                                        >
                                            <span>Reconciliation</span>
                                            {selectedInvoice.mismatchedSodsCount !== undefined && selectedInvoice.mismatchedSodsCount > 0 && (
                                                <Badge variant="destructive" className="px-1.5 py-0 h-4 min-w-4 text-[9px] flex items-center justify-center rounded-full font-bold">
                                                    {selectedInvoice.mismatchedSodsCount}
                                                </Badge>
                                            )}
                                        </Button>
                                    </div>

                                    {/* Tab Contents */}
                                    <div className="flex-1 overflow-y-auto min-h-0 pr-1 space-y-4">
                                        {activeTab === 'summary' && (
                                            <div className="space-y-4">
                                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs bg-slate-50 p-4 rounded-xl border border-slate-100">
                                                    <div>
                                                        <span className="text-[10px] font-black uppercase text-slate-400">Invoice Number</span>
                                                        <p className="font-bold text-slate-900 mt-0.5">{selectedInvoice.invoiceNumber}</p>
                                                    </div>
                                                    <div>
                                                        <span className="text-[10px] font-black uppercase text-slate-400">Contractor</span>
                                                        <p className="font-bold text-slate-900 mt-0.5">{selectedInvoice.contractor?.name || 'N/A'}</p>
                                                    </div>
                                                    <div>
                                                        <span className="text-[10px] font-black uppercase text-slate-400">Invoice Date</span>
                                                        <p className="font-bold text-slate-900 mt-0.5">{new Date(selectedInvoice.date || selectedInvoice.createdAt).toLocaleDateString()}</p>
                                                    </div>
                                                    <div>
                                                        <span className="text-[10px] font-black uppercase text-slate-400">Total Billed Amount</span>
                                                        <p className="font-bold text-blue-600 mt-0.5">{formatCurrency(selectedInvoice.totalAmount)}</p>
                                                    </div>
                                                </div>

                                                <div className="space-y-2">
                                                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Billing Items</Label>
                                                    <div className="space-y-2">
                                                        {(selectedInvoice.items || []).map((item) => (
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

                                        {activeTab === 'bom' && (
                                            <div className="space-y-2">
                                                <div className="flex justify-between items-center mb-1">
                                                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Excel BOM Sheet Preview</Label>
                                                    <span className="text-[10px] bg-slate-100 px-2 py-0.5 rounded font-bold text-slate-600">Total: {selectedInvoice.sods?.length || 0} Connections</span>
                                                </div>
                                                <div className="border border-slate-200 rounded-xl overflow-auto max-h-[350px] bg-slate-50">
                                                    <table className="w-full text-left border-collapse text-xs">
                                                        <thead className="bg-slate-100 sticky top-0 shadow-sm z-10">
                                                            <tr className="border-b border-slate-200">
                                                                <th className="p-2 font-black text-slate-700">S/N</th>
                                                                <th className="p-2 font-black text-slate-700">SOD</th>
                                                                <th className="p-2 font-black text-slate-700">Circuit (T.P)</th>
                                                                <th className="p-2 font-black text-slate-700">RTOM</th>
                                                                <th className="p-2 font-black text-slate-700">Drop Wire (m)</th>
                                                                {uniqueMaterials.map((mat) => (
                                                                    <th key={mat} className="p-2 font-black text-slate-700 whitespace-nowrap">{mat}</th>
                                                                ))}
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-slate-100 bg-white font-mono">
                                                            {(selectedInvoice.sods || []).map((sod: ClientInvoiceSOD, idx: number) => (
                                                                <tr key={sod.id} className="hover:bg-slate-50/50">
                                                                    <td className="p-2 font-bold text-slate-400">{idx + 1}</td>
                                                                    <td className="p-2 font-bold text-slate-900">{sod.soNum}</td>
                                                                    <td className="p-2 text-slate-600">{sod.voiceNumber || sod.techContact || '-'}</td>
                                                                    <td className="p-2 text-slate-600">{sod.rtom}</td>
                                                                    <td className="p-2 text-slate-900 font-bold">{sod.dropWireDistance || 0}m</td>
                                                                    {uniqueMaterials.map((mat) => {
                                                                        const use = sod.materialUsage?.find((mu: ClientInvoiceMaterialUsage) => mu.item?.name === mat);
                                                                        return (
                                                                            <td key={mat} className="p-2 text-slate-800 font-semibold text-center">
                                                                                {use ? use.quantity : '-'}
                                                                            </td>
                                                                        );
                                                                    })}
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </div>
                                        )}

                                        {activeTab === 'allocation' && (
                                            <div className="space-y-2">
                                                <div className="flex justify-between items-center mb-1">
                                                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Excel Resource Allocation Sheet Preview</Label>
                                                    <span className="text-[10px] bg-slate-100 px-2 py-0.5 rounded font-bold text-slate-600">Total: {selectedInvoice.sods?.length || 0} Records</span>
                                                </div>
                                                <div className="border border-slate-200 rounded-xl overflow-auto max-h-[350px] bg-slate-50">
                                                    <table className="w-full text-left border-collapse text-xs">
                                                        <thead className="bg-slate-100 sticky top-0 shadow-sm z-10">
                                                            <tr className="border-b border-slate-200">
                                                                <th className="p-2 font-black text-slate-700">S/N</th>
                                                                <th className="p-2 font-black text-slate-700">Name</th>
                                                                <th className="p-2 font-black text-slate-700">Address</th>
                                                                <th className="p-2 font-black text-slate-700">RTOM</th>
                                                                <th className="p-2 font-black text-slate-700">EX Area</th>
                                                                <th className="p-2 font-black text-slate-700">T.P</th>
                                                                <th className="p-2 font-black text-slate-700">Type</th>
                                                                <th className="p-2 font-black text-slate-700">DP No</th>
                                                                <th className="p-2 font-black text-slate-700">Wired Date</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-slate-100 bg-white text-slate-600">
                                                            {(selectedInvoice.sods || []).map((sod: ClientInvoiceSOD, idx: number) => (
                                                                <tr key={sod.id} className="hover:bg-slate-50/50">
                                                                    <td className="p-2 font-bold text-slate-400 font-mono">{idx + 1}</td>
                                                                    <td className="p-2 font-bold text-slate-900">{sod.customerName || '-'}</td>
                                                                    <td className="p-2 max-w-[200px] truncate" title={sod.address || undefined}>{sod.address || '-'}</td>
                                                                    <td className="p-2 font-mono">{sod.rtom}</td>
                                                                    <td className="p-2 font-mono">{sod.lea || '-'}</td>
                                                                    <td className="p-2 font-mono">{sod.voiceNumber || sod.techContact || '-'}</td>
                                                                    <td className="p-2">{sod.orderType || sod.serviceType || 'FTTH New'}</td>
                                                                    <td className="p-2 font-mono">{sod.dp || '-'}</td>
                                                                    <td className="p-2 font-mono">{sod.completedDate ? new Date(sod.completedDate).toLocaleDateString() : '-'}</td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </div>
                                        )}

                                        {activeTab === 'poles' && (
                                            <div className="space-y-2">
                                                <div className="flex justify-between items-center mb-1">
                                                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Excel Pole Sheet Preview</Label>
                                                </div>
                                                <div className="border border-slate-200 rounded-xl overflow-auto max-h-[350px] bg-slate-50">
                                                    <table className="w-full text-left border-collapse text-xs">
                                                        <thead className="bg-slate-100 sticky top-0 shadow-sm z-10">
                                                            <tr className="border-b border-slate-200">
                                                                <th className="p-2 font-black text-slate-700">S/N</th>
                                                                <th className="p-2 font-black text-slate-700">TP No</th>
                                                                <th className="p-2 font-black text-slate-700">DP No</th>
                                                                <th className="p-2 font-black text-slate-700">Exchange (LEA)</th>
                                                                <th className="p-2 font-black text-slate-700 text-center">5.6CE Poles</th>
                                                                <th className="p-2 font-black text-slate-700 text-center">6.7CE Poles</th>
                                                                <th className="p-2 font-black text-slate-700 text-center">8.0m Poles</th>
                                                                <th className="p-2 font-black text-slate-700 text-center">PLC-CON</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-slate-100 bg-white text-slate-600 font-mono">
                                                            {(selectedInvoice.sods || []).map((sod: ClientInvoiceSOD, idx: number) => {
                                                                let pole56 = 0;
                                                                let pole67 = 0;
                                                                let pole80 = 0;
                                                                let poleCon = 0;

                                                                sod.materialUsage?.forEach((usage: ClientInvoiceMaterialUsage) => {
                                                                    if (usage.item && usage.item.name) {
                                                                        const name = usage.item.name.toUpperCase();
                                                                        if (name.includes('5.6')) pole56 += (usage.quantity || 0);
                                                                        else if (name.includes('6.7')) pole67 += (usage.quantity || 0);
                                                                        else if (name.includes('8.0') || name.includes('8.M') || name.includes('8M') || name === 'PLC-8') pole80 += (usage.quantity || 0);
                                                                        else if (name.includes('CON')) poleCon += (usage.quantity || 0);
                                                                    }
                                                                });

                                                                return (
                                                                    <tr key={sod.id} className="hover:bg-slate-50/50">
                                                                        <td className="p-2 font-bold text-slate-400">{idx + 1}</td>
                                                                        <td className="p-2 font-bold text-slate-900">{sod.voiceNumber || sod.techContact || '-'}</td>
                                                                        <td className="p-2">{sod.dp || '-'}</td>
                                                                        <td className="p-2">{sod.lea || '-'}</td>
                                                                        <td className="p-2 text-center font-bold text-slate-800">{pole56 || '-'}</td>
                                                                        <td className="p-2 text-center font-bold text-slate-800">{pole67 || '-'}</td>
                                                                        <td className="p-2 text-center font-bold text-slate-800">{pole80 || '-'}</td>
                                                                        <td className="p-2 text-center font-bold text-slate-800">{poleCon || '-'}</td>
                                                                    </tr>
                                                                );
                                                            })}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </div>
                                        )}

                                        {activeTab === 'reconciliation' && (
                                            <div className="space-y-4">
                                                <div className="flex justify-between items-center mb-1">
                                                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Material Reconciliation (Local Entries vs. BOM Claim)</Label>
                                                    <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${selectedInvoice.mismatchedSodsCount && selectedInvoice.mismatchedSodsCount > 0 ? "bg-red-50 border border-red-100 text-red-600" : "bg-green-50 border border-green-100 text-green-600"}`}>
                                                        {selectedInvoice.mismatchedSodsCount || 0} Unbalanced SODs Found
                                                    </span>
                                                </div>
                                                
                                                {!selectedInvoice.mismatchedSodsCount || selectedInvoice.mismatchedSodsCount === 0 ? (
                                                    <div className="py-10 text-center bg-green-50/50 border border-green-100 rounded-xl">
                                                        <p className="text-xs text-green-700 font-bold">🎉 All connections are fully balanced! Local entries match SLT's BOM sheet exactly.</p>
                                                    </div>
                                                ) : (
                                                    <div className="space-y-4 max-h-[350px] overflow-y-auto pr-1">
                                                        {(selectedInvoice.sods || [])
                                                            .filter((sod: any) => sod.isMismatched)
                                                            .map((sod: any) => (
                                                                <div key={sod.id} className="border border-slate-200 rounded-xl p-3 bg-white shadow-sm space-y-2">
                                                                    <div className="flex justify-between items-center border-b border-slate-100 pb-1.5">
                                                                        <span className="font-mono font-bold text-slate-900 text-xs">{sod.soNum}</span>
                                                                        <span className="text-[10px] bg-slate-100 px-2 py-0.5 rounded text-slate-600 font-medium">
                                                                            RTOM: {sod.rtom} | Circuit: {sod.voiceNumber || sod.techContact || 'N/A'}
                                                                        </span>
                                                                    </div>
                                                                    
                                                                    <table className="w-full text-left text-xs border-collapse">
                                                                        <thead>
                                                                            <tr className="text-[10px] uppercase font-black tracking-wider text-slate-400 border-b border-slate-100">
                                                                                <th className="py-1 text-left">Material Name (Code)</th>
                                                                                <th className="py-1 text-center">Local Entered</th>
                                                                                <th className="py-1 text-center">BOM Claim</th>
                                                                                <th className="py-1 text-right">Difference</th>
                                                                            </tr>
                                                                        </thead>
                                                                        <tbody className="divide-y divide-slate-50 font-medium">
                                                                            {(sod.reconciliation || []).map((recon: any) => {
                                                                                const diff = (recon.localQty || 0) - (recon.bomQty || 0);
                                                                                const hasDiff = Math.abs(diff) > 0.001;
                                                                                return (
                                                                                    <tr key={recon.itemCode} className={hasDiff ? "text-red-600 bg-red-50/10 font-bold" : "text-slate-600"}>
                                                                                        <td className="py-1.5 text-left">{recon.itemName} <span className="text-[10px] text-slate-400 font-mono">[{recon.itemCode}]</span></td>
                                                                                        <td className="py-1.5 text-center font-mono">{recon.localQty || 0} {recon.unit}</td>
                                                                                        <td className="py-1.5 text-center font-mono">{recon.bomQty || 0} {recon.unit}</td>
                                                                                        <td className={`py-1.5 text-right font-mono font-bold ${diff > 0 ? "text-blue-600" : diff < 0 ? "text-red-600" : "text-slate-400"}`}>
                                                                                            {diff > 0 ? `+${diff}` : diff < 0 ? `${diff}` : 'Balanced'}
                                                                                        </td>
                                                                                    </tr>
                                                                                );
                                                                            })}
                                                                        </tbody>
                                                                    </table>
                                                                </div>
                                                            ))
                                                        }
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })()
                    )}
                    <DialogFooter className="flex gap-2 w-full pt-3 border-t border-slate-100">
                        <Button 
                            disabled={loadingDetails}
                            onClick={async () => {
                                if (selectedInvoice) {
                                    await downloadExcelInvoice(selectedInvoice.id, selectedInvoice.invoiceNumber);
                                }
                            }}
                            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white h-9 font-bold text-xs uppercase rounded-lg"
                        >
                            Download Excel
                        </Button>
                        <Button 
                            onClick={() => setDetailsOpen(false)} 
                            className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-800 h-9 font-bold text-xs uppercase rounded-lg border border-slate-200"
                        >
                            Close
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Key Data Editor Dialog */}
            <Dialog open={editKeyDataOpen} onOpenChange={setEditKeyDataOpen}>
                <DialogContent className="sm:max-w-[450px] rounded-2xl bg-white text-slate-900">
                    <DialogHeader>
                        <DialogTitle className="text-sm font-black uppercase tracking-wider text-slate-900">
                            Edit Invoice Key Data
                        </DialogTitle>
                        <DialogDescription className="text-xs text-slate-500">
                            Customize the metadata reference numbers, codes, and projects associated with this invoice.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-2">
                        {/* Project Dropdown Selectable */}
                        <div className="space-y-1.5">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Project Code (SLT Project)</Label>
                            <select
                                value={keyDataForm.projectId}
                                onChange={(e) => handleProjectChange(e.target.value)}
                                className="w-full h-10 px-3 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-800 font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                                <option value="">-- Select Project --</option>
                                {projects.map((p) => (
                                    <option key={p.id} value={p.id}>
                                        {p.projectCode} - {p.name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Connection Title */}
                        <div className="space-y-1.5">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Connection Title (Cover page)</Label>
                            <Input
                                type="text"
                                value={keyDataForm.connectionTitle}
                                onChange={(e) => setKeyDataForm({ ...keyDataForm, connectionTitle: e.target.value })}
                                className="h-10 rounded-lg bg-slate-50 border border-slate-200 text-xs focus:ring-2 focus:ring-blue-500"
                            />
                        </div>

                        {/* Agreement Number */}
                        <div className="space-y-1.5">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Agreement Number</Label>
                            <Input
                                type="text"
                                value={keyDataForm.agreementNumber}
                                onChange={(e) => setKeyDataForm({ ...keyDataForm, agreementNumber: e.target.value })}
                                className="h-10 rounded-lg bg-slate-50 border border-slate-200 text-xs focus:ring-2 focus:ring-blue-500"
                            />
                        </div>

                        {/* Project Number */}
                        <div className="space-y-1.5">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Project Number</Label>
                            <Input
                                type="number"
                                value={keyDataForm.projectNumber}
                                onChange={(e) => setKeyDataForm({ ...keyDataForm, projectNumber: e.target.value })}
                                className="h-10 rounded-lg bg-slate-50 border border-slate-200 text-xs focus:ring-2 focus:ring-blue-500"
                            />
                        </div>

                        {/* RTOM Area */}
                        <div className="space-y-1.5">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">RTOM Area</Label>
                            <Input
                                type="text"
                                value={keyDataForm.rtomArea}
                                onChange={(e) => setKeyDataForm({ ...keyDataForm, rtomArea: e.target.value })}
                                className="h-10 rounded-lg bg-slate-50 border border-slate-200 text-xs focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                    </div>

                    <DialogFooter className="pt-2">
                        <Button
                            onClick={handleSaveKeyData}
                            className="w-full bg-blue-600 hover:bg-blue-700 text-white h-11 rounded-lg font-bold text-xs uppercase tracking-wider"
                        >
                            Save Changes
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
                </DialogContent>
            </Dialog>
        </div>
    );
}

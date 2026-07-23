"use client";

import React, { useEffect, useState, use } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Printer, Share2 } from 'lucide-react';

interface BalanceSheetItem {
    itemId: string;
    code: string;
    name: string;
    unit: string;
    openingBalance: number;
    issuedQty: number;
    consumedQty: number;
    wastageQty: number;
    returnedQty: number;
    closingBalance: number;
}

interface PublicInvoiceData {
    id: string;
    invoiceNumber: string;
    date: string;
    totalAmount: number;
    amountA: number;
    amountB: number;
    status: string;
    statusA: string;
    statusB: string;
    paidDateA?: string | null;
    paidDateB?: string | null;
    splitConfig?: {
        splitMode: 'SINGLE_FULL' | 'SPLIT_AB' | 'SPLIT_ABC';
        claimAPercent: number;
        claimBPercent: number;
        claimCPercent: number;
    };
    agreementNumber?: string;
    projectNumber?: number;
    bomNumber?: string;
    rtomArea?: string;
    connectionTitle?: string;
    contractor: {
        name: string;
        registrationNumber?: string;
        contactNumber?: string;
        address?: string;
        bankName?: string;
        bankBranch?: string;
        bankAccountNumber?: string;
        brNumber?: string;
    };
    sods: Array<{
        serviceOrderId: string;
        soNum: string;
        rtom: string;
        serviceType?: string;
        voiceNumber?: string;
        circuitNumber?: string;
        package?: string;
        comments?: string;
        directTeam?: string;
        completedAt?: string;
        erectedPoles?: Array<{ poleType: string; poleNumber: string }>;
        materialUsage: Array<{
            itemId: string;
            quantity: number;
            usageType: string;
            item?: { name: string; code: string };
        }>;
    }>;
    penalties?: Array<{
        id: string;
        amount: number;
        reason: string;
    }>;
    workItems?: Array<{
        sn: number;
        description: string;
        rtom: string;
        qty: number;
        unitRate: number;
        amount: number;
    }>;
    balanceSheet: BalanceSheetItem[];
}

export default function PublicInvoicePage({ params }: { params: Promise<{ id: string }> }) {
    const resolvedParams = use(params);
    const invoiceId = resolvedParams.id;

    const [data, setData] = useState<PublicInvoiceData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [claimViewMode, setClaimViewMode] = useState<'ALL' | 'CLAIM_A' | 'CLAIM_B'>('ALL');

    useEffect(() => {
        const fetchPublicInvoice = async () => {
            try {
                const res = await fetch(`/api/public/invoices/${invoiceId}`);
                if (!res.ok) {
                    const err = await res.json();
                    throw new Error(err.error || 'Failed to load invoice');
                }
                const json = await res.json();
                setData(json.data);
            } catch (err: unknown) {
                console.error(err);
                const message = err instanceof Error ? err.message : 'Failed to load invoice';
                setError(message);
            } finally {
                setLoading(false);
            }
        };

        fetchPublicInvoice();
    }, [invoiceId]);

    const handlePrint = () => {
        window.print();
    };

    const handleShareWhatsApp = () => {
        if (!data) return;
        const currentUrl = window.location.href;
        const text = `Hello *${data.contractor.name}*,\n\nHere is your official Monthly Invoice *${data.invoiceNumber}* for LKR *${data.totalAmount.toLocaleString()}*.\n\nView Invoice & Material Balance Sheet:\n${currentUrl}`;
        window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
    };

    const SOD_CHUNK_SIZE = 20;
    const sodChunks = React.useMemo(() => {
        if (!data?.sods || data.sods.length === 0) {
            return [[]];
        }
        const chunks = [];
        for (let i = 0; i < data.sods.length; i += SOD_CHUNK_SIZE) {
            chunks.push(data.sods.slice(i, i + SOD_CHUNK_SIZE));
        }
        return chunks;
    }, [data?.sods]);

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-4">
                <div className="h-10 w-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4" />
                <p className="text-sm font-bold tracking-wider animate-pulse">LOADING CONTRACTOR INVOICE & BALANCE SHEET...</p>
            </div>
        );
    }

    if (error || !data) {
        return (
            <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-4 font-sans">
                <Card className="max-w-md w-full bg-slate-800 border-slate-700 text-white p-6 text-center shadow-2xl">
                    <div className="w-12 h-12 rounded-full bg-red-500/10 text-red-400 flex items-center justify-center mx-auto mb-3">
                        <span className="text-xl font-bold">!</span>
                    </div>
                    <h3 className="text-lg font-bold text-white mb-1">Invoice Not Found or Expired</h3>
                    <p className="text-xs text-slate-400 mb-6">{error || 'The requested invoice link is invalid, expired, or unavailable.'}</p>
                    <div className="flex flex-col gap-2">
                        <Button onClick={() => window.location.reload()} className="w-full bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold py-2">
                            Try Reloading Page
                        </Button>
                        <Button variant="outline" onClick={() => window.location.href = '/public/invoices/cmrwskay6000lsi34c0pjn478'} className="w-full border-slate-600 text-slate-300 hover:bg-slate-700 text-xs">
                            Open Active Test Invoice
                        </Button>
                    </div>
                </Card>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-100 text-slate-900 p-4 md:p-8 print:p-0 print:bg-white">
            {/* Global Print Style: Cover & Balance Sheet in Portrait A4, Details Sheets in Landscape A4 */}
            <style dangerouslySetInnerHTML={{ __html: `
                @media print {
                    @page {
                        size: A4 portrait !important;
                        margin: 10mm 10mm 10mm 10mm !important;
                    }
                    @page page-landscape {
                        size: A4 landscape !important;
                        margin: 8mm 6mm 8mm 6mm !important;
                    }
                    body {
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                        background: #ffffff !important;
                    }
                    .print\\:hidden {
                        display: none !important;
                    }
                    .landscape-section {
                        page: page-landscape !important;
                        break-before: page !important;
                        page-break-before: always !important;
                    }
                    .print\\:break-before-page {
                        break-before: page !important;
                        page-break-before: always !important;
                    }
                }
            ` }} />

            {/* Header Controls (Screen Only) */}
            {(() => {
                const pctA = data.splitConfig?.claimAPercent ?? 90;
                const pctB = data.splitConfig?.claimBPercent ?? 10;
                const splitMode = data.splitConfig?.splitMode ?? 'SPLIT_AB';

                return (
                    <div className="max-w-5xl mx-auto mb-6 flex flex-wrap items-center justify-between gap-4 print:hidden">
                        <div className="flex items-center gap-2">
                            <Badge className="bg-blue-600 text-white font-mono text-xs px-2.5 py-1">
                                OFFICIAL INVOICE & BALANCE SHEET
                            </Badge>
                        </div>

                        {/* Claim View Mode Switcher (ALL / CLAIM A / CLAIM B) */}
                        <div className="flex items-center bg-slate-200 p-1 rounded-lg border border-slate-300 font-sans text-xs shadow-inner">
                            <button
                                onClick={() => setClaimViewMode('ALL')}
                                className={`px-3 py-1.5 rounded-md font-bold transition-colors ${claimViewMode === 'ALL' ? 'bg-blue-600 text-white shadow' : 'text-slate-700 hover:text-slate-900'}`}
                            >
                                FULL INVOICE (100%)
                            </button>
                            {splitMode !== 'SINGLE_FULL' && (
                                <>
                                    <button
                                        onClick={() => setClaimViewMode('CLAIM_A')}
                                        className={`px-3 py-1.5 rounded-md font-bold transition-colors ${claimViewMode === 'CLAIM_A' ? 'bg-emerald-600 text-white shadow' : 'text-slate-700 hover:text-slate-900'}`}
                                    >
                                        CLAIM A ({pctA}%)
                                    </button>
                                    <button
                                        onClick={() => setClaimViewMode('CLAIM_B')}
                                        className={`px-3 py-1.5 rounded-md font-bold transition-colors ${claimViewMode === 'CLAIM_B' ? 'bg-amber-600 text-white shadow' : 'text-slate-700 hover:text-slate-900'}`}
                                    >
                                        CLAIM B ({pctB}%)
                                    </button>
                                </>
                            )}
                        </div>

                        <div className="flex items-center gap-2">
                            <Button onClick={handleShareWhatsApp} className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 font-bold text-xs">
                                <Share2 className="w-4 h-4" /> Share via WhatsApp
                            </Button>
                            <Button onClick={handlePrint} variant="outline" className="bg-white text-slate-800 border-slate-300 hover:bg-slate-50 gap-2 font-bold text-xs">
                                <Printer className="w-4 h-4" /> Print / Save PDF
                            </Button>
                        </div>
                    </div>
                );
            })()}

            {/* Printable Document Container */}
            <div className="max-w-5xl mx-auto bg-white border border-slate-200 rounded-xl shadow-xl p-6 md:p-10 print:shadow-none print:border-none print:rounded-none print:p-0">
                
                {/* ------------------------------------------------------------- */}
                {/* INVOICE PAGE 1: FORMAL CONTRACTOR MONTHLY INVOICE */}
                {/* ------------------------------------------------------------- */}
                <div className="font-serif text-black print:text-black mb-8">
                    {/* Header */}
                    <div className="text-center mb-2">
                        <h1 className="text-2xl font-bold tracking-tight text-black">{data.contractor.name}</h1>
                        <p className="text-xs text-slate-800">{data.contractor.address || 'Telecom OSP Contractor Division'}</p>
                        <p className="text-xs text-slate-800">Contact Numbers:- {data.contractor.contactNumber || 'N/A'}</p>
                    </div>

                    <div className="border-t-2 border-black mb-3" />

                    {/* Bill To & Invoice Meta Box */}
                    {(() => {
                        const pctA = data.splitConfig?.claimAPercent ?? 90;
                        const pctB = data.splitConfig?.claimBPercent ?? 10;
                        const splitMode = data.splitConfig?.splitMode ?? 'SPLIT_AB';

                        const modeText = splitMode === 'SINGLE_FULL' 
                            ? '100% Full Payment' 
                            : claimViewMode === 'CLAIM_A' 
                            ? `A (${pctA}% Direct Claim)` 
                            : claimViewMode === 'CLAIM_B' 
                            ? `B (${pctB}% Supply Claim)` 
                            : `Full Invoice (A: ${pctA}% / B: ${pctB}%)`;

                        return (
                            <div className="border border-black mb-4 grid grid-cols-12 text-xs">
                                <div className="col-span-7 p-2 border-r border-black font-sans leading-tight">
                                    <p className="font-bold">Bill To:</p>
                                    <p className="font-bold text-sm">Sri Lanka Telecom (Services) Limited</p>
                                    <p>OSP Division, 148/2/A, New Kandy Road,</p>
                                    <p>Bandarawatta,Biyagama.</p>
                                </div>

                                <div className="col-span-5 p-2 font-sans text-xs space-y-1">
                                    <div className="flex justify-between">
                                        <span className="font-bold">Invoice Number :</span>
                                        <span className="font-bold font-mono">{data.invoiceNumber}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="font-bold">Registered Number :</span>
                                        <span className="font-mono">{data.contractor.registrationNumber || data.contractor.brNumber || 'PV-98273'}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="font-bold">Invoice Date :</span>
                                        <span>{new Date(data.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' })}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="font-bold">Job Related Month :</span>
                                        <span>{new Date(data.date).toLocaleDateString('en-GB', { month: 'short', year: '2-digit' })}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="font-bold">Invoice Claim Mode :</span>
                                        <span className="font-bold">{modeText}</span>
                                    </div>
                                </div>
                            </div>
                        );
                    })()}

                    {/* Line Items Table */}
                    <div className="border border-black mb-2">
                        <table className="w-full text-xs border-collapse font-sans">
                            <thead>
                                <tr className="border-b border-black font-bold text-center bg-slate-50">
                                    <th className="border-r border-black p-1 w-10">Sn</th>
                                    <th className="border-r border-black p-1 text-left">Description</th>
                                    <th className="border-r border-black p-1 w-16">RTOM</th>
                                    <th className="border-r border-black p-1 w-12">Qty</th>
                                    <th className="border-r border-black p-1 text-right w-24">Unit Rate</th>
                                    <th className="p-1 text-right w-28">Amount</th>
                                </tr>
                            </thead>
                            <tbody>
                                {(data.workItems || []).map((item, idx) => (
                                    <tr key={idx} className="border-b border-black">
                                        <td className="border-r border-black p-1 text-center font-mono">{item.sn}</td>
                                        <td className="border-r border-black p-1 text-left font-medium">{item.description}</td>
                                        <td className="border-r border-black p-1 text-center font-bold">{item.rtom}</td>
                                        <td className="border-r border-black p-1 text-center font-mono">{item.qty}</td>
                                        <td className="border-r border-black p-1 text-right font-mono">{item.unitRate.toFixed(2)}</td>
                                        <td className="p-1 text-right font-mono font-bold">{item.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                    </tr>
                                ))}
                                
                                {Array.from({ length: Math.max(0, 8 - (data.workItems?.length || 0)) }).map((_, i) => (
                                    <tr key={`empty-${i}`} className="border-b border-black h-6">
                                        <td className="border-r border-black p-1"></td>
                                        <td className="border-r border-black p-1"></td>
                                        <td className="border-r border-black p-1"></td>
                                        <td className="border-r border-black p-1"></td>
                                        <td className="border-r border-black p-1"></td>
                                        <td className="p-1"></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Totals Block */}
                    {(() => {
                        const pctA = data.splitConfig?.claimAPercent ?? 90;
                        const pctB = data.splitConfig?.claimBPercent ?? 10;
                        const splitMode = data.splitConfig?.splitMode ?? 'SPLIT_AB';

                        const activeAmount = claimViewMode === 'CLAIM_A' ? data.amountA : claimViewMode === 'CLAIM_B' ? data.amountB : data.totalAmount;
                        const activeLabel = splitMode === 'SINGLE_FULL' 
                            ? 'Full 100% Payment' 
                            : claimViewMode === 'CLAIM_A' 
                            ? `Claim A (${pctA}%)` 
                            : claimViewMode === 'CLAIM_B' 
                            ? `Claim B (${pctB}%)` 
                            : 'Net Total Claim';
                        
                        return (
                            <div className="flex justify-between font-sans text-xs mb-4 items-start">
                                {/* Claim Status Box */}
                                <div className="border border-black p-2 rounded w-64 text-[10px] space-y-1">
                                    <p className="font-bold border-b border-black pb-0.5 uppercase tracking-wider text-slate-800">SF Audit Allocation Rule</p>
                                    {splitMode === 'SINGLE_FULL' ? (
                                        <div className="flex justify-between items-center py-1">
                                            <span>Full Payment (100%):</span>
                                            <span className="font-bold px-1.5 py-0.2 rounded font-mono bg-emerald-100 text-emerald-800 border border-emerald-400">
                                                Rs. {data.totalAmount.toLocaleString()} ({data.status || 'PENDING'})
                                            </span>
                                        </div>
                                    ) : (
                                        <>
                                            <div className="flex justify-between items-center">
                                                <span>Claim A ({pctA}% Direct):</span>
                                                <span className={`font-bold px-1.5 py-0.2 rounded font-mono ${data.statusA === 'PAID' ? 'bg-emerald-100 text-emerald-800 border border-emerald-400' : 'bg-amber-100 text-amber-800 border border-amber-400'}`}>
                                                    Rs. {data.amountA.toLocaleString()} ({data.statusA || 'PENDING'})
                                                </span>
                                            </div>
                                            <div className="flex justify-between items-center">
                                                <span>Claim B ({pctB}% Supply):</span>
                                                <span className={`font-bold px-1.5 py-0.2 rounded font-mono ${data.statusB === 'PAID' ? 'bg-emerald-100 text-emerald-800 border border-emerald-400' : 'bg-amber-100 text-amber-800 border border-amber-400'}`}>
                                                    Rs. {data.amountB.toLocaleString()} ({data.statusB || 'PENDING'})
                                                </span>
                                            </div>
                                        </>
                                    )}
                                </div>

                                <div className="w-72 space-y-1">
                                    <div className="flex justify-between items-center py-1">
                                        <span className="font-bold">Gross SOD Claim (Rs.)</span>
                                        <span className="font-mono font-bold text-sm border-b border-black px-2 py-0.5">
                                            {data.totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-center py-1">
                                        <span className="font-bold font-mono">{activeLabel}</span>
                                        <span className="font-mono font-black text-sm border-b-4 border-double border-black px-2 py-0.5">
                                            {activeAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        );
                    })()}

                    {/* Certification & Signatures */}
                    <div className="mb-4 font-sans text-xs">
                        <p className="mb-8">I do here by certify that the above details are true and correct.</p>
                        <div className="grid grid-cols-2 gap-8 text-center">
                            <div>
                                <p className="border-b border-dotted border-black mb-1 mx-4"></p>
                                <p className="font-bold">Prepared By:</p>
                                <p>&quot;{data.contractor.name}&quot;</p>
                            </div>
                            <div>
                                <p className="border-b border-dotted border-black mb-1 mx-4"></p>
                                <p className="font-bold">Received By:</p>
                                <p>Should be Sign by SLTS officer</p>
                            </div>
                        </div>
                    </div>

                    {/* Cheque & Bank Details Box */}
                    <div className="border border-black p-2 mb-4 font-sans text-xs space-y-1">
                        <p>Cheque should be drawn in favour of &quot;.............................................&quot;</p>
                        <div className="grid grid-cols-12 gap-1 pt-1">
                            <div className="col-span-3 font-bold">Account No:</div>
                            <div className="col-span-9 font-mono font-bold">{data.contractor.bankAccountNumber || 'Contractor\'s Account Number'}</div>
                            
                            <div className="col-span-3 font-bold">Bank</div>
                            <div className="col-span-9">{data.contractor.bankName || 'Name of the Bank'}</div>

                            <div className="col-span-3 font-bold">Branch</div>
                            <div className="col-span-9">{data.contractor.bankBranch || 'Branch and Branch code'}</div>
                        </div>
                    </div>

                    {/* SLTS Use Only Box */}
                    <div className="border border-black font-sans text-xs">
                        <div className="bg-slate-50 text-center font-bold italic py-1 border-b border-black">
                            SLTS Use Only:
                        </div>
                        <table className="w-full border-collapse text-xs">
                            <thead>
                                <tr className="border-b border-black text-center font-bold">
                                    <th className="border-r border-black p-1 w-1/4 italic font-serif">Regional Signature</th>
                                    <th className="border-r border-black p-1 w-1/3 italic font-serif">Head Office Signature</th>
                                    <th className="p-1 italic font-serif">Finanace</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr className="border-b border-black">
                                    <td className="border-r border-black p-2 font-bold align-top">Checked By:</td>
                                    <td className="border-r border-black p-2 h-10"></td>
                                    <td className="p-2 align-middle text-center font-bold italic" rowSpan={3}>
                                        Recommended By:
                                    </td>
                                </tr>
                                <tr className="border-b border-black">
                                    <td className="border-r border-black p-2 font-bold align-top">Certified by: By:</td>
                                    <td className="border-r border-black p-2 h-10"></td>
                                </tr>
                                <tr className="border-b border-black">
                                    <td className="border-r border-black p-2 font-bold align-top">Approved By:</td>
                                    <td className="border-r border-black p-2 h-10"></td>
                                </tr>
                            </tbody>
                        </table>

                        <table className="w-full border-collapse text-xs text-center border-t border-black">
                            <thead>
                                <tr className="font-bold italic border-b border-black bg-slate-50">
                                    <td className="border-r border-black p-1 text-left w-1/2">Office Use Only;</td>
                                    <td className="border-r border-black p-1 w-1/4">YES/NO</td>
                                    <td className="p-1">SIGN/DATE</td>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td className="border-r border-black p-2 text-left italic">Material Balance Sheet&apos;s received</td>
                                    <td className="border-r border-black p-2 font-bold">Yes</td>
                                    <td className="p-2"></td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* ------------------------------------------------------------- */}
                {/* SECTION 2: LANDSCAPE SOD JOB DETAILS SHEETS (10 ITEMS PER SHEET - A4 LANDSCAPE) */}
                {/* ------------------------------------------------------------- */}
                {sodChunks.map((chunk, chunkIdx) => (
                    <div key={`sod-chunk-sheet-${chunkIdx}`} className="landscape-section print:break-before-page pt-6 border-t-2 border-slate-900 mt-8 font-sans text-xs text-black print:text-black">
                        <div className="landscape-page">
                            {/* Top Header Row */}
                            <div className="flex justify-between items-center font-bold text-xs mb-2 border-b border-black pb-1">
                                <div>
                                    <span>Contractor Name: </span>
                                    <span className="font-bold">{data.contractor.name}</span>
                                </div>
                                <div>
                                    <span>Invoice No </span>
                                    <span className="font-bold font-mono">{data.invoiceNumber}</span>
                                </div>
                            </div>

                            {/* Sub-Header Row */}
                            <div className="flex justify-between items-center font-bold text-xs mb-3">
                                <div>
                                    <span>Team 1 - i-Shamp Mobile Team No - </span>
                                    <span>{chunk[0]?.directTeam || data.sods[0]?.directTeam || 'Team 01'}</span>
                                </div>
                                <div className="flex items-center gap-4">
                                    <div>
                                        <span>RTOM - </span>
                                        <span>{chunk[0]?.rtom ? (chunk[0].rtom.startsWith('R-') ? chunk[0].rtom : `R-${chunk[0].rtom}`) : 'R-GP'}</span>
                                    </div>
                                    <span className="text-[10px] text-slate-500 font-mono">Sheet {chunkIdx + 1} of {sodChunks.length}</span>
                                </div>
                            </div>

                            {/* 18-Column Grid Table */}
                            <div className="overflow-x-auto border border-black mb-4">
                                <table className="w-full text-[10px] border-collapse font-sans text-center">
                                    <thead>
                                        <tr className="border-b border-black font-bold bg-slate-50">
                                            <th className="border-r border-black p-1 w-7">NO</th>
                                            <th className="border-r border-black p-1 w-16">Complete Date</th>
                                            <th className="border-r border-black p-1 w-24">TP Number</th>
                                            <th className="border-r border-black p-1 w-16">Configs</th>
                                            <th className="border-r border-black p-1 w-14">RTOM</th>
                                            <th className="border-r border-black p-1 w-10">F-1</th>
                                            <th className="border-r border-black p-1 w-10">G-1</th>
                                            <th className="border-r border-black p-1 w-10">DW-LH</th>
                                            <th className="border-r border-black p-1 w-10">DW-CH</th>
                                            <th className="border-r border-black p-1 w-10">DW-RT</th>
                                            <th className="border-r border-black p-1 w-10">IW-N</th>
                                            <th className="border-r border-black p-1 w-10">CAT 5</th>
                                            <th className="border-r border-black p-1 w-10">FAC</th>
                                            <th className="border-r border-black p-1 w-14">F ROSSETTE</th>
                                            <th className="border-r border-black p-1 w-12">TOP BOLT</th>
                                            <th className="border-r border-black p-1 w-12">CONDUITS</th>
                                            <th className="border-r border-black p-1 w-12">CASING</th>
                                            <th className="p-1 text-left min-w-[120px]">Pole details & Remarks</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {chunk.map((sod, idx) => {
                                            const rowNumber = chunkIdx * SOD_CHUNK_SIZE + idx + 1;
                                            const getF1Qty = () => {
                                                const found = sod.materialUsage.find(m => {
                                                    const itemCode = (m.item?.code || '').toUpperCase();
                                                    const itemName = (m.item?.name || '').toUpperCase();
                                                    const usageType = (m.usageType || '').toUpperCase();
                                                    const isRetainer = itemName.includes('RETAINER') || itemCode.includes('RETNER') || itemName.includes('CLAMP');
                                                    return !isRetainer && (usageType === 'PORTAL_SYNC' || usageType === 'USED_F1' || itemCode === 'OSP-HC-CBL-DW' || itemName.includes('DROP CABLE') || itemName.includes('DROP WIRE'));
                                                });
                                                return found ? found.quantity : '';
                                            };

                                            const getG1Qty = () => {
                                                const found = sod.materialUsage.find(m => {
                                                    const itemCode = (m.item?.code || '').toUpperCase();
                                                    const itemName = (m.item?.name || '').toUpperCase();
                                                    const usageType = (m.usageType || '').toUpperCase();
                                                    return usageType === 'USED_G1' || itemCode === 'OSPFTA003' || itemName.includes('INDOOR') || (itemName.includes('G1') && !itemName.includes('HOOK'));
                                                });
                                                return found ? found.quantity : '';
                                            };

                                            const getLHookQty = () => {
                                                const found = sod.materialUsage.find(m => {
                                                    const itemCode = (m.item?.code || '').toUpperCase();
                                                    const itemName = (m.item?.name || '').toUpperCase();
                                                    return itemCode === 'OSP-NC-MM-LHOOK' || itemName.includes('HOOK L') || itemName.includes('L HOOK') || itemName.includes('L-HOOK');
                                                });
                                                return found ? found.quantity : '';
                                            };

                                            const getCHookQty = () => {
                                                const found = sod.materialUsage.find(m => {
                                                    const itemCode = (m.item?.code || '').toUpperCase();
                                                    const itemName = (m.item?.name || '').toUpperCase();
                                                    return itemCode === 'OSP-NC-MM-CHOOK' || itemName.includes('HOOK C') || itemName.includes('C HOOK') || itemName.includes('C-HOOK');
                                                });
                                                return found ? found.quantity : '';
                                            };

                                            const getRetainerQty = () => {
                                                const found = sod.materialUsage.find(m => {
                                                    const itemCode = (m.item?.code || '').toUpperCase();
                                                    const itemName = (m.item?.name || '').toUpperCase();
                                                    return itemCode === 'OSP-NC-ACC-DWRETNER' || itemName.includes('RETAINER') || itemName.includes('RETNER');
                                                });
                                                return found ? found.quantity : '';
                                            };

                                            const getIWQty = () => {
                                                const found = sod.materialUsage.find(m => {
                                                    const itemName = (m.item?.name || '').toUpperCase();
                                                    return itemName.includes('INTERNAL WIRE') || itemName.includes('IW-N');
                                                });
                                                return found ? found.quantity : '';
                                            };

                                            const getCat5Qty = () => {
                                                const found = sod.materialUsage.find(m => {
                                                    const itemName = (m.item?.name || '').toUpperCase();
                                                    return itemName.includes('CAT 5') || itemName.includes('CAT5') || itemName.includes('UTP');
                                                });
                                                return found ? found.quantity : '';
                                            };

                                            const getFACQty = () => {
                                                const found = sod.materialUsage.find(m => {
                                                    const itemCode = (m.item?.code || '').toUpperCase();
                                                    const itemName = (m.item?.name || '').toUpperCase();
                                                    return itemCode === 'OSP-HC-ACC-FAC' || itemName.includes('FAC') || itemName.includes('FAST CONNECTOR');
                                                });
                                                return found ? found.quantity : '';
                                            };

                                            const getRosetteQty = () => {
                                                const found = sod.materialUsage.find(m => {
                                                    const itemCode = (m.item?.code || '').toUpperCase();
                                                    const itemName = (m.item?.name || '').toUpperCase();
                                                    return itemCode === 'OSPFTA007' || itemName.includes('ROSETTE') || itemName.includes('ROSSETTE');
                                                });
                                                return found ? found.quantity : '';
                                            };

                                            const getBoltQty = () => {
                                                const found = sod.materialUsage.find(m => {
                                                    const itemCode = (m.item?.code || '').toUpperCase();
                                                    const itemName = (m.item?.name || '').toUpperCase();
                                                    return itemCode === 'OSPACC011' || itemName.includes('BOLT');
                                                });
                                                return found ? found.quantity : '';
                                            };

                                            const getConduitQty = () => {
                                                const found = sod.materialUsage.find(m => {
                                                    const itemName = (m.item?.name || '').toUpperCase();
                                                    return itemName.includes('CONDUIT');
                                                });
                                                return found ? found.quantity : '';
                                            };

                                            const getCasingQty = () => {
                                                const found = sod.materialUsage.find(m => {
                                                    const itemName = (m.item?.name || '').toUpperCase();
                                                    return itemName.includes('CASING') || itemName.includes('TRUNKING');
                                                });
                                                return found ? found.quantity : '';
                                            };

                                            const polesText = (sod.erectedPoles || []).map(p => p.poleType).join(', ');
                                            const remarksText = [polesText, sod.comments].filter(Boolean).join(' | ');
                                            const formattedRtom = sod.rtom ? (sod.rtom.startsWith('R-') ? sod.rtom : `R-${sod.rtom}`) : 'R-GP';

                                            return (
                                                <tr key={sod.serviceOrderId} className="border-b border-black h-6 font-medium">
                                                    <td className="border-r border-black p-1 font-mono">{rowNumber}</td>
                                                    <td className="border-r border-black p-1 font-mono text-[9px]">
                                                        {sod.completedAt ? new Date(sod.completedAt).toLocaleDateString('en-GB') : ''}
                                                    </td>
                                                    <td className="border-r border-black p-1 font-mono font-bold">{sod.circuitNumber || sod.voiceNumber || sod.soNum}</td>
                                                    <td className="border-r border-black p-1 font-mono">{sod.serviceType || sod.package || 'FTTH'}</td>
                                                    <td className="border-r border-black p-1 font-bold">{formattedRtom}</td>
                                                    <td className="border-r border-black p-1 font-mono font-bold">{getF1Qty()}</td>
                                                    <td className="border-r border-black p-1 font-mono font-bold">{getG1Qty()}</td>
                                                    <td className="border-r border-black p-1 font-mono">{getLHookQty()}</td>
                                                    <td className="border-r border-black p-1 font-mono">{getCHookQty()}</td>
                                                    <td className="border-r border-black p-1 font-mono">{getRetainerQty()}</td>
                                                    <td className="border-r border-black p-1 font-mono">{getIWQty()}</td>
                                                    <td className="border-r border-black p-1 font-mono">{getCat5Qty()}</td>
                                                    <td className="border-r border-black p-1 font-mono">{getFACQty()}</td>
                                                    <td className="border-r border-black p-1 font-mono">{getRosetteQty()}</td>
                                                    <td className="border-r border-black p-1 font-mono">{getBoltQty()}</td>
                                                    <td className="border-r border-black p-1 font-mono">{getConduitQty()}</td>
                                                    <td className="border-r border-black p-1 font-mono">{getCasingQty()}</td>
                                                    <td className="p-1 text-left truncate max-w-[150px]" title={remarksText}>{remarksText}</td>
                                                </tr>
                                            );
                                        })}

                                        {/* Fill to 10 rows on each chunk sheet */}
                                        {Array.from({ length: Math.max(0, SOD_CHUNK_SIZE - chunk.length) }).map((_, i) => (
                                            <tr key={`blank-chunk-${chunkIdx}-${i}`} className="border-b border-black h-6">
                                                <td className="border-r border-black p-1 font-mono">{chunkIdx * SOD_CHUNK_SIZE + chunk.length + i + 1}</td>
                                                <td className="border-r border-black p-1"></td>
                                                <td className="border-r border-black p-1"></td>
                                                <td className="border-r border-black p-1"></td>
                                                <td className="border-r border-black p-1"></td>
                                                <td className="border-r border-black p-1"></td>
                                                <td className="border-r border-black p-1"></td>
                                                <td className="border-r border-black p-1"></td>
                                                <td className="border-r border-black p-1"></td>
                                                <td className="border-r border-black p-1"></td>
                                                <td className="border-r border-black p-1"></td>
                                                <td className="border-r border-black p-1"></td>
                                                <td className="border-r border-black p-1"></td>
                                                <td className="border-r border-black p-1"></td>
                                                <td className="border-r border-black p-1"></td>
                                                <td className="border-r border-black p-1"></td>
                                                <td className="border-r border-black p-1"></td>
                                                <td className="p-1"></td>
                                            </tr>
                                        ))}
                                    </tbody>

                                    {/* Material Totals Footer Row */}
                                    {(() => {
                                        const chunkTotals = chunk.reduce((acc, sod) => {
                                            sod.materialUsage.forEach(m => {
                                                const itemCode = (m.item?.code || '').toUpperCase();
                                                const itemName = (m.item?.name || '').toUpperCase();
                                                const usageType = (m.usageType || '').toUpperCase();
                                                const qty = Number(m.quantity) || 0;
                                                const isRetainer = itemName.includes('RETAINER') || itemCode.includes('RETNER') || itemName.includes('CLAMP');

                                                if (!isRetainer && (usageType === 'PORTAL_SYNC' || usageType === 'USED_F1' || itemCode === 'OSP-HC-CBL-DW' || itemName.includes('DROP CABLE') || itemName.includes('DROP WIRE'))) {
                                                    acc.f1 += qty;
                                                } else if (usageType === 'USED_G1' || itemCode === 'OSPFTA003' || itemName.includes('INDOOR') || (itemName.includes('G1') && !itemName.includes('HOOK'))) {
                                                    acc.g1 += qty;
                                                } else if (itemCode === 'OSP-NC-MM-LHOOK' || itemName.includes('HOOK L') || itemName.includes('L HOOK') || itemName.includes('L-HOOK')) {
                                                    acc.lHook += qty;
                                                } else if (itemCode === 'OSP-NC-MM-CHOOK' || itemName.includes('HOOK C') || itemName.includes('C HOOK') || itemName.includes('C-HOOK')) {
                                                    acc.cHook += qty;
                                                } else if (itemCode === 'OSP-NC-ACC-DWRETNER' || itemName.includes('RETAINER') || itemName.includes('RETNER')) {
                                                    acc.retainer += qty;
                                                } else if (itemName.includes('INTERNAL WIRE') || itemName.includes('IW-N')) {
                                                    acc.iw += qty;
                                                } else if (itemName.includes('CAT 5') || itemName.includes('CAT5') || itemName.includes('UTP')) {
                                                    acc.cat5 += qty;
                                                } else if (itemCode === 'OSP-HC-ACC-FAC' || itemName.includes('FAC') || itemName.includes('FAST CONNECTOR')) {
                                                    acc.fac += qty;
                                                } else if (itemCode === 'OSPFTA007' || itemName.includes('ROSETTE') || itemName.includes('ROSSETTE')) {
                                                    acc.rosette += qty;
                                                } else if (itemCode === 'OSPACC011' || itemName.includes('BOLT')) {
                                                    acc.bolt += qty;
                                                } else if (itemName.includes('CONDUIT')) {
                                                    acc.conduit += qty;
                                                } else if (itemName.includes('CASING') || itemName.includes('TRUNKING')) {
                                                    acc.casing += qty;
                                                }
                                            });
                                            return acc;
                                        }, {
                                            f1: 0, g1: 0, lHook: 0, cHook: 0, retainer: 0, iw: 0, cat5: 0, fac: 0, rosette: 0, bolt: 0, conduit: 0, casing: 0
                                        });

                                        return (
                                            <tfoot>
                                                <tr className="border-t-2 border-b border-black font-bold bg-slate-50 text-center">
                                                    <td colSpan={5} className="border-r border-black p-1 text-left pl-2 font-serif font-bold text-xs">
                                                        Material Totals
                                                    </td>
                                                    <td className="border-r border-black p-1 font-mono font-bold text-xs">{chunkTotals.f1 || 0}</td>
                                                    <td className="border-r border-black p-1 font-mono font-bold text-xs">{chunkTotals.g1 || 0}</td>
                                                    <td className="border-r border-black p-1 font-mono font-bold">{chunkTotals.lHook || 0}</td>
                                                    <td className="border-r border-black p-1 font-mono font-bold">{chunkTotals.cHook || 0}</td>
                                                    <td className="border-r border-black p-1 font-mono font-bold">{chunkTotals.retainer || 0}</td>
                                                    <td className="border-r border-black p-1 font-mono font-bold">{chunkTotals.iw || 0}</td>
                                                    <td className="border-r border-black p-1 font-mono font-bold">{chunkTotals.cat5 || 0}</td>
                                                    <td className="border-r border-black p-1 font-mono font-bold">{chunkTotals.fac || 0}</td>
                                                    <td className="border-r border-black p-1 font-mono font-bold">{chunkTotals.rosette || 0}</td>
                                                    <td className="border-r border-black p-1 font-mono font-bold">{chunkTotals.bolt || 0}</td>
                                                    <td className="border-r border-black p-1 font-mono font-bold">{chunkTotals.conduit || 0}</td>
                                                    <td className="border-r border-black p-1 font-mono font-bold">{chunkTotals.casing || 0}</td>
                                                    <td className="p-1"></td>
                                                </tr>
                                            </tfoot>
                                        );
                                    })()}
                                </table>
                            </div>

                            {/* Signatures Block for Details Sheet */}
                            <div className="mt-8 pt-2 grid grid-cols-2 gap-16 font-sans text-xs">
                                <div>
                                    <p className="border-b border-dotted border-black mb-1.5 w-52"></p>
                                    <p className="font-bold text-slate-900">Prepared By:</p>
                                </div>
                                <div>
                                    <p className="border-b border-dotted border-black mb-1.5 w-52"></p>
                                    <p className="font-bold text-slate-900">Checked By:</p>
                                    <p className="text-[10px] text-slate-600 font-medium">(With rubber stamp)</p>
                                </div>
                            </div>
                        </div>
                    </div>
                ))}

                {/* ------------------------------------------------------------- */}
                {/* SECTION 3: FINAL CLOSING PAGE - CONTRACTOR MATERIAL BALANCE SHEET */}
                {/* ------------------------------------------------------------- */}
                <div className="print:break-before-page pt-6 border-t-2 border-black mt-8 font-sans text-xs text-black print:text-black">
                    {/* Header Title Box */}
                    <div className="text-center border-b-2 border-black pb-2 mb-4">
                        <h2 className="text-base font-bold uppercase tracking-wider text-black font-serif">
                            CONTRACTOR MONTHLY MATERIAL BALANCE SHEET
                        </h2>
                        <div className="flex justify-between items-center text-xs mt-2 font-medium">
                            <p><strong>Contractor Name:</strong> {data.contractor.name}</p>
                            <p><strong>Invoice No:</strong> <span className="font-mono font-bold">{data.invoiceNumber}</span></p>
                            <p><strong>Period:</strong> {new Date(data.date).toLocaleString('default', { month: 'long', year: 'numeric' })}</p>
                        </div>
                    </div>

                    {/* Standard Table */}
                    <div className="border border-black mb-8">
                        <table className="w-full text-xs border-collapse">
                            <thead>
                                <tr className="border-b border-black font-bold bg-slate-100 text-black text-center">
                                    <th className="p-2 border-r border-black w-28 text-left">ITEM CODE</th>
                                    <th className="p-2 border-r border-black text-left">MATERIAL DESCRIPTION</th>
                                    <th className="p-2 border-r border-black w-14">UNIT</th>
                                    <th className="p-2 border-r border-black w-20 text-right">OPENING</th>
                                    <th className="p-2 border-r border-black w-20 text-right">+ ISSUED</th>
                                    <th className="p-2 border-r border-black w-20 text-right">- CONSUMED</th>
                                    <th className="p-2 border-r border-black w-20 text-right">- WASTAGE</th>
                                    <th className="p-2 border-r border-black w-20 text-right">+ RETURNED</th>
                                    <th className="p-2 text-right w-24 font-bold bg-slate-200">= CLOSING</th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.balanceSheet.length === 0 ? (
                                    <tr>
                                        <td colSpan={9} className="p-4 text-center text-slate-500 font-medium">
                                            No material activity recorded for this monthly billing period.
                                        </td>
                                    </tr>
                                ) : (
                                    data.balanceSheet.map((item) => (
                                        <tr key={item.itemId} className="border-b border-black h-7">
                                            <td className="p-2 border-r border-black font-mono font-bold">{item.code}</td>
                                            <td className="p-2 border-r border-black font-medium">{item.name}</td>
                                            <td className="p-2 border-r border-black text-center font-bold">{item.unit}</td>
                                            <td className="p-2 border-r border-black text-right font-mono">{item.openingBalance.toLocaleString()}</td>
                                            <td className="p-2 border-r border-black text-right font-mono font-bold">+{item.issuedQty.toLocaleString()}</td>
                                            <td className="p-2 border-r border-black text-right font-mono font-bold">-{item.consumedQty.toLocaleString()}</td>
                                            <td className="p-2 border-r border-black text-right font-mono">-{item.wastageQty.toLocaleString()}</td>
                                            <td className="p-2 border-r border-black text-right font-mono">+{item.returnedQty.toLocaleString()}</td>
                                            <td className="p-2 text-right font-mono font-bold bg-slate-50">{item.closingBalance.toLocaleString()}</td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Standard Signatures Section */}
                    <div className="grid grid-cols-3 gap-8 pt-8 font-sans text-xs text-center">
                        <div>
                            <p className="border-b border-dotted border-black mb-2 mx-4"></p>
                            <p className="font-bold">Prepared By:</p>
                            <p className="text-[10px] text-slate-600">Contractor Representative</p>
                        </div>
                        <div>
                            <p className="border-b border-dotted border-black mb-2 mx-4"></p>
                            <p className="font-bold">Checked By:</p>
                            <p className="text-[10px] text-slate-600">Stores Officer / OPMC (With Stamp)</p>
                        </div>
                        <div>
                            <p className="border-b border-dotted border-black mb-2 mx-4"></p>
                            <p className="font-bold">Approved By:</p>
                            <p className="text-[10px] text-slate-600">Regional Executive / Finance Manager</p>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
}

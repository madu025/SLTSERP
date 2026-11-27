"use client";

import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Package, Eye, Info, Calendar, Building2, AlertCircle, Tag, TrendingUp, X, Clock, ClipboardList, CheckCircle2, XCircle } from "lucide-react";
import { grnGateChecks, poValueOfAccepted, GRN_REJECT_REASON_MIN } from "@/lib/grn-gate";
import { RBAC_PERMISSIONS } from "@/config/rbac-permissions";
import "./grn.css";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { createGRN } from "@/actions/inventory-actions";
import { toErrorText } from '@/lib/error-text';

interface GRNItem {
    itemId: string;
    itemName: string;
    requestedQty: number;
    receivedQty: number;
    remarks: string;
    unit?: string;
    serials?: string[];
    hasSerial?: boolean;
    expiryDate?: string;
    /** Delivered but rejected by the Stores Manager (not taken into stock, not paid) */
    rejectedQty?: number;
    rejectReason?: string;
    /** Still open on the chosen PO line (ordered - received); null when receiving the whole request */
    open?: number | null;
    /** PO unit price, for the PO value of the accepted goods */
    unitPrice?: number | null;
    prevReceivedQty?: number;
    remainingQty?: number;
}

interface PORefItem {
    id?: string;
    poNumber?: string;
    vendor?: string | { name?: string };
    status?: string;
    createdById?: string | null;
    paymentBasis?: string | null;
    hoApprovalRef?: string | null;
    items?: Array<{
        receivedQty?: number | string;
        unitPrice?: number | string;
        id?: string;
        requisitionItemId?: string;
        stockRequestItemId?: string;
        itemCode?: string;
        description?: string;
        quantity?: number;
    }>;
}

interface GRNHistoryItem {
    id: string;
    grnNumber: string;
    createdAt: string;
    receivedBy?: { name?: string };
    items?: Array<{
        itemId: string;
        quantity: number;
        item?: { name: string };
    }>;
}

interface InventoryRequest {
    status?: string;
    workflowStage?: string;
    purchaseOrders?: PORefItem[];
    grns?: GRNHistoryItem[];
    id: string;
    requestNr: string;
    poNumber?: string;
    vendor?: string;
    sourceType: string;
    fromStoreId: string;
    irNumber?: string;
    reference?: string | null;
    items: Array<{
        id: string;
        itemId: string;
        item?: {
            name: string;
            code: string;
            unit: string;
            hasSerial?: boolean;
        };
        requestedQty: number;
        approvedQty?: number;
        receivedQty?: number;
        batch?: {
            batchNumber: string;
        };
    }>;
    expectedDelivery?: string;
}

interface CompletedGRN {
    id: string;
    grnNumber: string;
    storeId: string;
    sourceType: string;
    supplier: string | null;
    createdAt: string;
    request?: {
        requestNr: string;
        poNumber?: string;
        vendor?: string;
        purchaseOrders?: {
            poNumber: string;
            vendor: string | null;
        }[];
    } | null;
    purchaseOrder?: {
        poNumber: string;
        vendor: string | null;
    } | null;
    reference?: string | null;
    items: Array<{
        id: string;
        itemId: string;
        item?: {
            name: string;
            code: string;
            unit: string;
        } | null;
        quantity: number;
        batch?: {
            batchNumber: string;
        } | null;
    }>;
}

export default function GRNPage() {
    const queryClient = useQueryClient();
    const [activeTab, setActiveTab] = useState<'READY' | 'COMPLETED'>('READY');
    const [selectedRequest, setSelectedRequest] = useState<InventoryRequest | null>(null);
    const [showGRNDialog, setShowGRNDialog] = useState(false);
    const [showDetailsDialog, setShowDetailsDialog] = useState(false);

    // GRN Form State
    const [grnNumber, setGRNNumber] = useState('');
    const [receivedDate, setReceivedDate] = useState(new Date().toISOString().split('T')[0]);
    const [invoiceNumber, setInvoiceNumber] = useState('');
    // HO orders: the Oracle GRN number and the vendor's invoice for this delivery (one invoice per GRN)
    const [oracleNo, setOracleNo] = useState('');
    const [invDate, setInvDate] = useState('');
    const [invGoods, setInvGoods] = useState('');
    const [invTax, setInvTax] = useState('');
    const [receivedItems, setReceivedItems] = useState<GRNItem[]>([]);
    const [grnRemarks, setGRNRemarks] = useState('');
    const [selectedPOId, setSelectedPOId] = useState<string>('ALL');
    const [documentUrl, setDocumentUrl] = useState('');
    const [isUploading, setIsUploading] = useState(false);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);

    const handleFileSelection = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setSelectedFile(file);
            setDocumentUrl(''); // reset URL for new file
        } else {
            setSelectedFile(null);
        }
    };

    // Auto-generate GRN Number when dialog opens
    useEffect(() => {
        if (showGRNDialog && !grnNumber) {
            const now = new Date();
            const dateStr = now.toISOString().slice(0,10).replace(/-/g,'');
            const seq = Math.floor(Math.random() * 900) + 100;
            setTimeout(() => setGRNNumber(`GRN-${dateStr}-${seq}`), 0);
        }
    }, [showGRNDialog, grnNumber]);

    // Fetch requests ready for GRN
    const { data: requests = [], isLoading: isLoadingRequests } = useQuery<InventoryRequest[]>({
        queryKey: ['grn-requests'],
        queryFn: async () => {
            const res = await fetch(`/api/inventory/requests?workflowStage=GRN_PENDING&_t=${Date.now()}`, {
                cache: 'no-store',
                headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' }
            });
            const json = await res.json();
            const rawData = json.success ? json.data : json;
            return Array.isArray(rawData) ? rawData : [];
        },
        enabled: activeTab === 'READY'
    });

    // Fetch completed GRNs
    const { data: completedGrns = [], isLoading: isLoadingCompleted } = useQuery<CompletedGRN[]>({
        queryKey: ['completed-generals'],
        queryFn: async () => {
            const res = await fetch(`/api/inventory/grn?_t=${Date.now()}`, {
                cache: 'no-store',
                headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' }
            });
            const json = await res.json();
            const rawData = json.success ? json.data : json;
            return Array.isArray(rawData) ? rawData : [];
        },
        enabled: activeTab === 'COMPLETED'
    });

    const safeRequests = Array.isArray(requests) ? requests : [];
    const safeCompletedGrns = Array.isArray(completedGrns) ? completedGrns : [];
    const isLoading = activeTab === 'READY' ? isLoadingRequests : isLoadingCompleted;

    const createGRNMutation = useMutation({
        mutationFn: async (data: {
            storeId: string;
            sourceType: string;
            supplier?: string;
            receivedById: string;
            requestId: string;
            purchaseOrderId?: string;
            sltReferenceId: string | null;
            reference?: string;
            documentUrl?: string;
            oracleGrnNumber?: string;
            vendorInvoiceNumber?: string;
            vendorInvoiceDate?: string;
            vendorInvoiceGoods?: number;
            vendorInvoiceTax?: number;
            vendorInvoiceUrl?: string;
            items: Array<{ itemId: string; quantity: number; serials?: string[]; rejectedQty?: number; rejectReason?: string }>;
        }) => {
            return await createGRN(data);
        },
        onSuccess: (result) => {
            if (result.success) {
                toast.success('GRN created successfully! Stock updated.');
                queryClient.invalidateQueries({ queryKey: ['grn-requests'] });
                queryClient.invalidateQueries({ queryKey: ['completed-grns'] });
                handleCloseGRNDialog();
            } else {
                toast.error(toErrorText(result.error) || 'Failed to create GRN');
            }
        },
        onError: () => toast.error('Failed to create GRN')
    });

    const handleSelectPO = (poNumber: string, requestOverride?: InventoryRequest) => {
        const req = requestOverride || selectedRequest;
        setSelectedPOId(poNumber);
        if (!req) return;
        if (!poNumber) { setReceivedItems([]); return; }

        const allItems: GRNItem[] = req.items.map((item) => {
            const reqQty = item.approvedQty && item.approvedQty > 0 ? item.approvedQty : (item.requestedQty || 0);
            const prevReceived = item.receivedQty || 0;
            const remaining = Math.max(0, reqQty - prevReceived);

            return {
                itemId: item.itemId,
                itemName: item.item?.name || 'Unknown Item',
                requestedQty: reqQty,
                prevReceivedQty: prevReceived,
                remainingQty: remaining,
                receivedQty: remaining,
                remarks: '',
                unit: item.item?.unit || '',
                hasSerial: item.item?.hasSerial || false,
                serials: Array(Math.ceil(remaining)).fill(''),
                expiryDate: ''
            };
        }).filter(i => i.remainingQty > 0);

        if (poNumber === 'ALL') {
            setReceivedItems(allItems);
            return;
        }

        const targetPO = req.purchaseOrders?.find(p => p.poNumber === poNumber || p.id === poNumber);

        // a PO line that names its request line gives the open quantity and price of this delivery
        if (targetPO && Array.isArray(targetPO.items) && targetPO.items.length > 0 && targetPO.items.every((pi) => pi.stockRequestItemId)) {
            const lines: GRNItem[] = [];
            for (const pi of targetPO.items) {
                const ri = req.items.find((x) => x.id === pi.stockRequestItemId);
                if (!ri) continue;
                const open = Math.max(0, Number(pi.quantity ?? 0) - Number(pi.receivedQty ?? 0));
                if (open <= 0) continue;
                lines.push({
                    itemId: ri.itemId, itemName: ri.item?.name || 'Unknown Item', requestedQty: Number(pi.quantity ?? 0), receivedQty: open, open,
                    unitPrice: Number(pi.unitPrice ?? 0), remarks: '', unit: ri.item?.unit || '', hasSerial: ri.item?.hasSerial || false,
                    serials: Array(Math.ceil(open)).fill(''), expiryDate: '',
                });
            }
            setReceivedItems(lines);
            return;
        }

        if (targetPO && Array.isArray(targetPO.items) && targetPO.items.length > 0) {
            const poItemsList = targetPO.items;

            const matchingReqItemIds = new Set(poItemsList.map(pi => pi.stockRequestItemId || pi.requisitionItemId).filter((id): id is string => Boolean(id)));
            const matchingCodes = new Set(poItemsList.map(pi => pi.itemCode).filter((code): code is string => Boolean(code)));
            const matchingNames = new Set(poItemsList.map(pi => pi.description?.toLowerCase().trim()).filter((name): name is string => Boolean(name)));

            const filtered = allItems.filter(item => {
                const reqItemObj = req.items.find(ri => ri.itemId === item.itemId);
                const reqItemId = reqItemObj?.id;
                const itemCode = reqItemObj?.item?.code;
                const itemNameLower = item.itemName.toLowerCase().trim();

                if (reqItemId && matchingReqItemIds.has(reqItemId)) return true;
                if (itemCode && matchingCodes.has(itemCode)) return true;
                if (matchingCodes.has(item.itemId)) return true;
                if (matchingNames.has(itemNameLower)) return true;
                for (const name of Array.from(matchingNames)) {
                    if (name && (itemNameLower.includes(name) || name.includes(itemNameLower))) return true;
                }

                return false;
            });

            setReceivedItems(filtered);
        } else {
            setReceivedItems(allItems);
        }
    };

    const handleOpenGRNDialog = (request: InventoryRequest) => {
        setSelectedRequest(request);
        const hoPos = (request.purchaseOrders ?? []).some((p) => p.paymentBasis || p.hoApprovalRef);
        if (hoPos) { setSelectedPOId(''); setReceivedItems([]); } else handleSelectPO('ALL', request);
        setShowGRNDialog(true);
    };

    const handleCloseGRNDialog = () => {
        setShowGRNDialog(false);
        setSelectedRequest(null);
        setReceivedItems([]);
        setGRNRemarks('');
        setGRNNumber(''); // Reset GRN number
        setDocumentUrl('');
        setInvoiceNumber('');
        setOracleNo('');
        setInvDate('');
        setInvGoods('');
        setInvTax('');
    };

    const handleCreateGRN = async () => {
        if (!grnNumber) {
            toast.error('GRN Number is required');
            return;
        }

        // Get user from localStorage
        const user = JSON.parse(localStorage.getItem('user') || '{}');

        if (!selectedRequest) return;

        // Validate serials for serialized items
        for (const item of receivedItems) {
            if (item.hasSerial) {
                const serialsCount = (item.serials || []).filter(s => s && s.trim() !== '').length;
                const expectedCount = Math.ceil(item.receivedQty);
                if (serialsCount !== expectedCount) {
                    toast.error(`Please enter exactly ${expectedCount} serial numbers for item: ${item.itemName} (Entered: ${serialsCount})`);
                    return;
                }
            }
        }

        let finalDocumentUrl = documentUrl;

        if (selectedFile && !documentUrl) {
            setIsUploading(true);
            const formData = new FormData();
            formData.append('file', selectedFile);
            formData.append('bucket', 'grn-documents');

            try {
                const res = await fetch('/api/upload', { method: 'POST', body: formData });
                const data = await res.json();
                if (res.ok && data.url) {
                    finalDocumentUrl = data.url;
                    setDocumentUrl(data.url);
                } else {
                    const errorMsg = typeof data.error === 'string' ? data.error : data.error?.message || 'Failed to upload document';
                    toast.error(errorMsg);
                    setIsUploading(false);
                    return; // Abort GRN creation if upload fails
                }
            } catch (error) {
                console.error('Failed to upload document:', error);
                toast.error('Error uploading document');
                setIsUploading(false);
                return; // Abort GRN creation if upload fails
            }
            setIsUploading(false);
        }

        const payload = {
            storeId: selectedRequest.fromStoreId,
            sourceType: selectedRequest.sourceType,
            supplier: selectedRequest.vendor,
            receivedById: user.id,
            requestId: selectedRequest.id,
            // The select holds the PO number; the server needs the PO id (and uses it to enforce the PO balance and price)
            purchaseOrderId: selectedPOId !== 'ALL' ? (selectedRequest.purchaseOrders?.find((p) => p.poNumber === selectedPOId || p.id === selectedPOId)?.id ?? undefined) : undefined,
            sltReferenceId: selectedRequest.irNumber || null,
            reference: invoiceNumber,
            documentUrl: finalDocumentUrl || undefined,
            // the vendor's invoice for this delivery and the Oracle GRN number (required by the server for orders approved in the HO system)
            ...(oracleNo.trim() ? { oracleGrnNumber: oracleNo.trim() } : {}),
            ...(invDate ? { vendorInvoiceNumber: invoiceNumber, vendorInvoiceDate: invDate, vendorInvoiceGoods: Number(invGoods || 0), vendorInvoiceTax: Number(invTax || 0), vendorInvoiceUrl: finalDocumentUrl || undefined } : {}),
            items: receivedItems.map(item => ({
                itemId: item.itemId,
                quantity: parseFloat(item.receivedQty.toString()),
                serials: item.hasSerial ? (item.serials || []).filter(s => s && s.trim() !== '') : undefined,
                expiryDate: item.expiryDate || undefined,
                ...(Number(item.rejectedQty || 0) > 0 ? { rejectedQty: Number(item.rejectedQty), rejectReason: item.rejectReason || '' } : {})
            }))
        };

        createGRNMutation.mutate(payload);
    };

    const updateReceivedQty = (index: number, value: string) => {
        const updated = [...receivedItems];
        const val = parseFloat(value) || 0;
        updated[index].receivedQty = val;
        // Adjust the size of the serial number input slots dynamically if quantity changes
        if (updated[index].hasSerial) {
            const currentSize = updated[index].serials?.length || 0;
            const newSize = Math.ceil(val);
            if (newSize > currentSize) {
                updated[index].serials = [
                    ...(updated[index].serials || []),
                    ...Array(newSize - currentSize).fill('')
                ];
            } else if (newSize < currentSize) {
                updated[index].serials = (updated[index].serials || []).slice(0, newSize);
            }
        }
        setReceivedItems(updated);
    };

    // who is receiving (segregation of duties is shown before saving, and checked again by the server)
    const [me] = useState<{ id: string | null; isAdmin: boolean }>(() => {
        if (typeof window === 'undefined') return { id: null, isAdmin: false };
        try {
            const u = JSON.parse(localStorage.getItem('user') || '{}');
            return { id: u.id ?? null, isAdmin: Array.isArray(u.permissions) && u.permissions.includes(RBAC_PERMISSIONS.ADMIN_RBAC) };
        } catch { return { id: null, isAdmin: false }; /* the server decides */ }
    });
    const poList: PORefItem[] = useMemo(() => (selectedRequest?.purchaseOrders && selectedRequest.purchaseOrders.length > 0)
        ? selectedRequest.purchaseOrders.filter((p) => String(p.status ?? '').toUpperCase() !== 'CANCELLED')
        : (selectedRequest?.poNumber && selectedRequest.poNumber !== 'N/A' && selectedRequest.poNumber !== '-')
            ? [{ id: selectedRequest.poNumber, poNumber: selectedRequest.poNumber, vendor: selectedRequest.vendor }]
            : [], [selectedRequest]);
    const gate = useMemo(() => {
        const chosen = poList.find((p) => p.poNumber === selectedPOId || p.id === selectedPOId) ?? null;
        const poRequired = poList.some((p) => p.paymentBasis || p.hoApprovalRef);
        const lines = receivedItems.map((i) => ({
            name: i.itemName, unit: i.unit, open: i.open ?? null, unitPrice: i.unitPrice ?? null,
            accepted: Number(i.receivedQty) || 0, rejected: Number(i.rejectedQty) || 0, rejectReason: i.rejectReason ?? '',
            serialsNeeded: i.hasSerial ? Math.ceil(Number(i.receivedQty) || 0) : 0,
            serialsGiven: i.hasSerial ? (i.serials || []).filter((x) => x && x.trim() !== '').length : 0,
        }));
        const checks = grnGateChecks({
            poRequired, poChosen: !!chosen, hoOrder: !!(chosen && (chosen.paymentBasis || chosen.hoApprovalRef)),
            receiverId: me.id, poRecordedById: chosen?.createdById ?? null, isAdmin: me.isAdmin, lines,
            oracleGrnNumber: oracleNo, invoiceNumber, invoiceDate: invDate,
            invoiceGoods: invGoods === '' ? null : Number(invGoods), invoiceTax: invTax === '' ? null : Number(invTax),
            scanAttached: !!(selectedFile || documentUrl),
        });
        const left = checks.filter((c) => !c.ok).length;
        return {
            checks, left, ok: left === 0, poRequired, poChosen: !!chosen, hoOrder: !!(chosen && (chosen.paymentBasis || chosen.hoApprovalRef)),
            poValue: poValueOfAccepted(lines), accepted: lines.reduce((a, l) => a + l.accepted, 0), rejected: lines.reduce((a, l) => a + l.rejected, 0),
        };
    }, [poList, selectedPOId, receivedItems, me, oracleNo, invoiceNumber, invDate, invGoods, invTax, selectedFile, documentUrl]);


    return (
        <div className="erp-page-wrapper flex-row overflow-hidden">
            <Sidebar />
            <main className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
                <Header />
                <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
                    <div className="max-w-7xl mx-auto space-y-4">
                        {/* Header */}
                        <div className="space-y-0.5">
                            <h1 className="text-xl font-black text-slate-900 tracking-tight">Goods Receipt Note (GRN)</h1>
                            <p className="text-xs text-slate-500">Receive goods and update stock levels</p>
                        </div>

                        {/* Tabs */}
                        <div className="flex gap-2 border-b border-slate-200">
                            <button
                                onClick={() => setActiveTab('READY')}
                                className={`px-3 py-1.5 font-bold text-xs transition-colors ${activeTab === 'READY'
                                    ? 'border-b-2 border-blue-600 text-blue-600'
                                    : 'text-slate-500 hover:text-slate-700'
                                    }`}
                            >
                                Ready for GRN
                                {requests.length > 0 && activeTab === 'READY' && (
                                    <span className="ml-1.5 px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-blue-100 text-blue-800 border border-blue-200">{requests.length}</span>
                                )}
                            </button>
                            <button
                                onClick={() => setActiveTab('COMPLETED')}
                                className={`px-3 py-1.5 font-bold text-xs transition-colors ${activeTab === 'COMPLETED'
                                    ? 'border-b-2 border-blue-600 text-blue-600'
                                    : 'text-slate-500 hover:text-slate-700'
                                    }`}
                            >
                                Completed GRNs
                            </button>
                        </div>

                        {/* Requests List */}
                        <div className="erp-table-container flex flex-col bg-white overflow-hidden">
                            <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/40 flex justify-between items-center">
                                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                                    {activeTab === 'READY' ? 'Awaiting GRN' : 'Completed GRNs'}
                                </span>
                            </div>
                            {isLoading ? (
                                <div className="text-center p-8 text-slate-400 text-xs font-semibold">Loading...</div>
                            ) : (activeTab === 'READY' ? requests.length : completedGrns.length) === 0 ? (
                                <div className="text-center p-8 text-slate-400 text-xs font-semibold">
                                    {activeTab === 'READY' ? 'No pending GRNs' : 'No completed GRNs'}
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-xs text-left border-collapse">
                                        <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                                            <tr>
                                                <th className="px-4 py-2 font-semibold">{activeTab === 'READY' ? 'Request No' : 'GRN No'}</th>
                                                <th className="px-3 py-2 font-semibold">PO Number</th>
                                                <th className="px-3 py-2 font-semibold">{activeTab === 'READY' ? 'Vendor' : 'Supplier'}</th>
                                                <th className="px-3 py-2 font-semibold text-center">Items</th>
                                                <th className="px-3 py-2 font-semibold">{activeTab === 'READY' ? 'Expected Delivery' : 'Received Date'}</th>
                                                <th className="px-4 py-2 font-semibold text-right">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {activeTab === 'READY' ? (
                                                safeRequests.map((req) => (
                                                    <tr key={req.id} className="hover:bg-slate-50/50 transition-colors duration-150">
                                                        <td className="px-4 py-1.5 font-bold text-slate-800">{req.requestNr}</td>
                                                        <td className="px-3 py-1.5">
                                                            <Badge variant="outline" className="text-[10px] font-mono px-1.5 py-0 border-slate-200 text-slate-600 bg-white">
                                                                {(req.poNumber && req.poNumber !== 'N/A' && req.poNumber !== '-') ? req.poNumber : (req.purchaseOrders?.length === 1 ? req.purchaseOrders[0].poNumber : (req.purchaseOrders && req.purchaseOrders.length > 1 ? req.purchaseOrders.map(p => p.poNumber).filter(Boolean).join(', ') : '-'))}
                                                            </Badge>
                                                        </td>
                                                        <td className="px-3 py-1.5 text-slate-700 truncate max-w-[150px]">
                                                            {(req.vendor && req.vendor !== 'N/A' && req.vendor !== '-') ? String(req.vendor) : (req.purchaseOrders?.length ? Array.from(new Set(req.purchaseOrders.map(p => (typeof p.vendor === 'object' && p.vendor !== null) ? (p.vendor as unknown as { name?: string }).name : p.vendor).filter(Boolean))).join(', ') || '-' : '-')}
                                                        </td>
                                                        <td className="px-3 py-1.5 min-w-[120px]">
                                                            <div className="flex flex-col gap-1 w-full max-w-[140px]">
                                                                <div className="flex justify-between items-center text-[9px] font-bold">
                                                                    <span className="text-slate-500">{req.items?.reduce((acc, item) => acc + (Number(item.receivedQty) || 0), 0) || 0} / {req.items?.reduce((acc, item) => acc + (Number(item.requestedQty) || 0), 0) || 0} Items</span>
                                                                    <span className="text-blue-600">
                                                                        {Math.round(((req.items?.reduce((acc, item) => acc + (Number(item.receivedQty) || 0), 0) || 0) / (req.items?.reduce((acc, item) => acc + (Number(item.requestedQty) || 0), 0) || 1)) * 100)}%
                                                                    </span>
                                                                </div>
                                                                <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                                                                    <div 
                                                                        className="h-full bg-blue-500 rounded-full" 
                                                                        style={{ width: `${Math.min(100, Math.round(((req.items?.reduce((acc, item) => acc + (Number(item.receivedQty) || 0), 0) || 0) / (req.items?.reduce((acc, item) => acc + (Number(item.requestedQty) || 0), 0) || 1)) * 100))}%` }}
                                                                    />
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="px-3 py-1.5 text-slate-500">
                                                            {req.expectedDelivery
                                                                ? new Date(req.expectedDelivery).toLocaleDateString()
                                                                : '-'
                                                            }
                                                        </td>
                                                        <td className="px-4 py-1.5 text-right">
                                                            <div className="flex justify-end gap-1.5">
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    className="h-7 w-7 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-md"
                                                                    onClick={() => {
                                                                        setSelectedRequest(req);
                                                                        setShowDetailsDialog(true);
                                                                    }}
                                                                >
                                                                    <Eye className="w-3.5 h-3.5" />
                                                                </Button>
                                                                {activeTab === 'READY' && (
                                                                    <Button
                                                                        size="sm"
                                                                        className="h-7 px-2.5 bg-green-600 hover:bg-green-700 text-white font-bold text-xs rounded-md shadow-sm"
                                                                        onClick={() => handleOpenGRNDialog(req)}
                                                                    >
                                                                        <Package className="w-3 h-3 mr-1" />
                                                                        Create GRN
                                                                    </Button>
                                                                )}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))
                                            ) : (
                                                safeCompletedGrns.map((grn) => (
                                                    <tr key={grn.id} className="hover:bg-slate-50/50 transition-colors duration-150">
                                                        <td className="px-4 py-1.5 font-bold text-slate-800">{grn.grnNumber}</td>
                                                        <td className="px-3 py-1.5">
                                                            <Badge variant="outline" className="text-[10px] font-mono px-1.5 py-0 border-slate-200 text-slate-600 bg-white">
                                                                {grn.purchaseOrder?.poNumber || (grn.request ? ((grn.request.poNumber && grn.request.poNumber !== 'N/A' && grn.request.poNumber !== '-') ? grn.request.poNumber : (grn.request.purchaseOrders?.length === 1 ? grn.request.purchaseOrders[0].poNumber : (grn.request.purchaseOrders && grn.request.purchaseOrders.length > 1 ? grn.request.purchaseOrders.map(p => p.poNumber).filter(Boolean).join(', ') : '-'))) : '-')}
                                                            </Badge>
                                                        </td>
                                                        <td className="px-3 py-1.5 text-slate-700 truncate max-w-[150px]">
                                                            {grn.supplier && grn.supplier !== 'N/A' && grn.supplier !== '-' ? grn.supplier : (grn.purchaseOrder?.vendor ? ((typeof grn.purchaseOrder.vendor === 'object' && grn.purchaseOrder.vendor !== null) ? (grn.purchaseOrder.vendor as unknown as { name?: string }).name : String(grn.purchaseOrder.vendor)) : (grn.request ? ((grn.request.vendor && grn.request.vendor !== 'N/A' && grn.request.vendor !== '-') ? String(grn.request.vendor) : (grn.request.purchaseOrders?.length ? Array.from(new Set(grn.request.purchaseOrders.map(p => (typeof p.vendor === 'object' && p.vendor !== null) ? (p.vendor as unknown as { name?: string }).name : p.vendor).filter(Boolean))).join(', ') || '-' : '-')) : '-'))}
                                                        </td>
                                                        <td className="px-3 py-1.5 text-center font-semibold text-slate-700">
                                                            <div className="flex items-center justify-center gap-1.5 text-[10px]">
                                                                <span className="bg-slate-100 text-slate-600 px-1.5 rounded-sm">{grn.items?.length || 0} Items</span>
                                                            </div>
                                                        </td>
                                                        <td className="px-3 py-1.5 text-slate-500">
                                                            {new Date(grn.createdAt).toLocaleDateString()}
                                                        </td>
                                                        <td className="px-4 py-1.5 text-right">
                                                            <div className="flex justify-end gap-1.5">
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    className="h-7 w-7 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-md"
                                                                    onClick={() => {
                                                                        // Construct a mock Request detail so the details modal works
                                                                        const mockRequest: InventoryRequest = {
                                                                            id: grn.id,
                                                                            requestNr: grn.request?.requestNr || 'N/A',
                                                                            poNumber: grn.request?.poNumber || 'N/A',
                                                                            vendor: grn.supplier || grn.request?.vendor || 'N/A',
                                                                            sourceType: grn.sourceType,
                                                                            fromStoreId: grn.storeId,
                                                                            reference: grn.reference,
                                                                            items: grn.items.map((i) => ({
                                                                                id: i.id,
                                                                                itemId: i.itemId,
                                                                                item: {
                                                                                    name: i.item?.name || 'Unknown',
                                                                                    code: i.item?.code || '',
                                                                                    unit: i.item?.unit || ''
                                                                                },
                                                                                requestedQty: i.quantity,
                                                                                batch: i.batch ? { batchNumber: i.batch.batchNumber } : undefined
                                                                            }))
                                                                        };
                                                                        setSelectedRequest(mockRequest);
                                                                        setShowDetailsDialog(true);
                                                                    }}
                                                                >
                                                                    <Eye className="w-3.5 h-3.5" />
                                                                </Button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </main>

            {/* Create GRN Form Drawer */}
            <Dialog open={showGRNDialog} onOpenChange={setShowGRNDialog}>
                <DialogContent 
                    showCloseButton={false}
                    className="fixed !inset-y-0 !right-0 !top-0 !left-auto !translate-x-0 !translate-y-0 !h-full w-[min(1180px,94vw)] !max-w-none flex flex-col !p-0 !gap-0 overflow-hidden bg-white dark:bg-slate-950 border-l border-slate-200 dark:border-slate-800 shadow-2xl z-50 duration-300 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right !rounded-none"
                >
                    {selectedRequest && (
                        <div className="grn flex h-full min-h-0 flex-col">
                            <div className="grn-head relative">
                                <button onClick={handleCloseGRNDialog} aria-label="Close" className="absolute right-4 top-4 rounded-full p-2 text-slate-600 hover:bg-slate-100">
                                    <X className="h-4 w-4" />
                                </button>
                                <h2>Receive goods (GRN)</h2>
                                <p>{selectedRequest.requestNr} &middot; {grnNumber || 'GRN number assigned when saved'}</p>
                            </div>

                            <div className="grn-body">
                                <div className="grn-form">
                                    {/* 1. the purchase order this delivery is for */}
                                    <section className="grn-step" aria-labelledby="grn-step-po">
                                        <div className="grn-step-title" id="grn-step-po"><b>1</b>Purchase order</div>
                                        <p className="grn-step-note">{gate.poRequired ? 'Each delivery is received against its own PO, with that vendor\'s invoice.' : 'Choose the PO, or receive everything still open on the request.'}</p>
                                        <div className="grn-grid">
                                            <div className="grn-field">
                                                <label htmlFor="grn-po">Purchase order</label>
                                                <select id="grn-po" className="grn-input" value={selectedPOId} aria-invalid={gate.poRequired && !gate.poChosen} onChange={(e) => handleSelectPO(e.target.value)}>
                                                    {gate.poRequired ? <option value="">Choose the purchase order...</option> : <option value="ALL">All open items of the request</option>}
                                                    {poList.map((po) => (
                                                        <option key={po.id || po.poNumber} value={po.poNumber}>
                                                            {po.poNumber} &middot; {typeof po.vendor === 'object' ? po.vendor?.name : (po.vendor || 'Vendor')}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div className="grn-field">
                                                <label htmlFor="grn-date">Received date</label>
                                                <input id="grn-date" type="date" className="grn-input" value={receivedDate} onChange={(e) => setReceivedDate(e.target.value)} />
                                            </div>
                                        </div>
                                    </section>

                                    {/* 2. what arrived: accepted into stock and rejected */}
                                    <section className="grn-step" aria-labelledby="grn-step-lines">
                                        <div className="grn-step-title" id="grn-step-lines"><b>2</b>Delivery</div>
                                        <p className="grn-step-note">Only the accepted quantity enters the stock and is paid. Rejected goods go back to the vendor, with the reason.</p>
                                        {receivedItems.length === 0 ? (
                                            <p className="text-sm" style={{ color: 'var(--g-ink-2)' }}>{gate.poRequired && !gate.poChosen ? 'Choose the purchase order to see its items.' : 'Nothing is open to receive on this request.'}</p>
                                        ) : (
                                            <div className="overflow-x-auto">
                                                <table className="grn-lines">
                                                    <thead><tr><th>Item</th><th className="num">Ordered</th><th className="num">Open</th><th>Accepted</th><th>Rejected</th><th>Reason</th><th>Expiry</th></tr></thead>
                                                    <tbody>
                                                        {receivedItems.map((item, idx) => {
                                                            const over = item.open !== null && item.open !== undefined && item.receivedQty > item.open + 1e-9;
                                                            const needsReason = Number(item.rejectedQty || 0) > 0 && (item.rejectReason ?? '').trim().length < GRN_REJECT_REASON_MIN;
                                                            return (
                                                                <tr key={idx}>
                                                                    <td className="font-semibold">{item.itemName}</td>
                                                                    <td className="num">{item.requestedQty}<span className="grn-unit">{item.unit || 'Nos'}</span></td>
                                                                    <td className="num">{item.open ?? item.remainingQty ?? '-'}</td>
                                                                    <td>
                                                                        <input type="number" min={0} step="any" aria-label={`Accepted ${item.itemName}`} aria-invalid={over} className="grn-input grn-qty" value={item.receivedQty} onChange={(e) => updateReceivedQty(idx, e.target.value)} />
                                                                    </td>
                                                                    <td>
                                                                        <input type="number" min={0} step="any" data-testid="grn-rejected" aria-label="Rejected quantity" className="grn-input grn-qty" value={item.rejectedQty ?? ''} onChange={(e) => { const u = [...receivedItems]; u[idx] = { ...u[idx], rejectedQty: parseFloat(e.target.value) || 0 }; setReceivedItems(u); }} />
                                                                    </td>
                                                                    <td>
                                                                        {Number(item.rejectedQty || 0) > 0 ? (
                                                                            <input data-testid="grn-reject-reason" aria-label="Reason for rejecting" aria-invalid={needsReason} placeholder="Why rejected" className="grn-input" value={item.rejectReason ?? ''} onChange={(e) => { const u = [...receivedItems]; u[idx] = { ...u[idx], rejectReason: e.target.value }; setReceivedItems(u); }} />
                                                                        ) : <span style={{ color: 'var(--g-ink-2)' }}>-</span>}
                                                                    </td>
                                                                    <td>
                                                                        <input type="date" aria-label={`Expiry ${item.itemName}`} className="grn-input" value={item.expiryDate || ''} onChange={(e) => { const u = [...receivedItems]; u[idx] = { ...u[idx], expiryDate: e.target.value }; setReceivedItems(u); }} />
                                                                        {item.hasSerial && (
                                                                            <div className="mt-2 flex flex-col gap-1">
                                                                                {Array.from({ length: Math.ceil(item.receivedQty) || 0 }).map((_, sIdx) => (
                                                                                    <input key={sIdx} className="grn-input" placeholder={`Serial ${sIdx + 1}`} value={item.serials?.[sIdx] || ''} onChange={(e) => { const serials = [...(item.serials || [])]; serials[sIdx] = e.target.value; const u = [...receivedItems]; u[idx] = { ...u[idx], serials }; setReceivedItems(u); }} />
                                                                                ))}
                                                                            </div>
                                                                        )}
                                                                    </td>
                                                                </tr>
                                                            );
                                                        })}
                                                    </tbody>
                                                </table>
                                            </div>
                                        )}
                                    </section>

                                    {/* 3. the vendor's invoice for this delivery */}
                                    <section className="grn-step" aria-labelledby="grn-step-invoice">
                                        <div className="grn-step-title" id="grn-step-invoice"><b>3</b>Vendor invoice and Oracle GRN</div>
                                        <p className="grn-step-note">{gate.hoOrder ? 'Required for an order approved in HO: the invoice is created with this GRN for the payment voucher. Its goods value cannot be above the PO price.' : 'The delivery note or invoice of this delivery.'}</p>
                                        <div className="grn-grid" data-testid="grn-ho-fields">
                                            <div className="grn-field">
                                                <label htmlFor="grn-inv-no">Vendor invoice number</label>
                                                <input id="grn-inv-no" className="grn-input" placeholder="E.g. INV-2024-001" value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} />
                                            </div>
                                            <div className="grn-field">
                                                <label htmlFor="grn-inv-date">Vendor invoice date</label>
                                                <input id="grn-inv-date" data-testid="grn-inv-date" type="date" className="grn-input" value={invDate} onChange={(e) => setInvDate(e.target.value)} />
                                            </div>
                                            <div className="grn-field">
                                                <label htmlFor="grn-inv-goods">Goods value, without tax (Rs.)</label>
                                                <input id="grn-inv-goods" data-testid="grn-inv-goods" type="number" min={0} step="0.01" className="grn-input" aria-invalid={gate.checks.some((c) => c.key === 'price' && !c.ok)} value={invGoods} onChange={(e) => setInvGoods(e.target.value)} />
                                                <span className="grn-hint">PO value of the accepted goods: Rs. {gate.poValue.toLocaleString('en-LK', { minimumFractionDigits: 2 })}</span>
                                            </div>
                                            <div className="grn-field">
                                                <label htmlFor="grn-inv-tax">Tax (Rs.)</label>
                                                <input id="grn-inv-tax" data-testid="grn-inv-tax" type="number" min={0} step="0.01" className="grn-input" value={invTax} onChange={(e) => setInvTax(e.target.value)} />
                                            </div>
                                            <div className="grn-field">
                                                <label htmlFor="grn-oracle">Oracle GRN number</label>
                                                <input id="grn-oracle" data-testid="grn-oracle" className="grn-input" value={oracleNo} onChange={(e) => setOracleNo(e.target.value)} />
                                            </div>
                                            <div className="grn-field">
                                                <label htmlFor="grn-scan">Scanned vendor invoice</label>
                                                <input id="grn-scan" type="file" accept=".pdf,image/*" className="grn-input py-1" onChange={handleFileSelection} disabled={isUploading || createGRNMutation.isPending} />
                                                {isUploading && <span className="grn-hint">Uploading...</span>}
                                            </div>
                                        </div>
                                        <div className="grn-field mt-3">
                                            <label htmlFor="grn-notes">Notes on the delivery (optional)</label>
                                            <textarea id="grn-notes" rows={2} className="grn-input py-2" style={{ height: 'auto' }} value={grnRemarks} onChange={(e) => setGRNRemarks(e.target.value)} />
                                        </div>
                                    </section>
                                </div>

                                {/* the Gate: what the server checks, live */}
                                <aside className="grn-gate" aria-label="Checks before saving">
                                    <h3>Before you confirm</h3>
                                    <p>The same checks the system makes when you save.</p>
                                    <ul className="grn-checks" aria-live="polite">
                                        {gate.checks.map((c) => (
                                            <li key={c.key} className="grn-check" data-ok={c.ok}>
                                                {c.ok ? <CheckCircle2 aria-hidden="true" /> : <XCircle aria-hidden="true" />}
                                                <span>{c.text}</span>
                                            </li>
                                        ))}
                                    </ul>
                                    <dl className="grn-sum">
                                        <dt>Accepted</dt><dd>{gate.accepted.toLocaleString('en-LK')}</dd>
                                        <dt>Rejected</dt><dd>{gate.rejected.toLocaleString('en-LK')}</dd>
                                        <dt>PO value accepted</dt><dd>Rs. {gate.poValue.toLocaleString('en-LK', { minimumFractionDigits: 2 })}</dd>
                                        {invGoods !== '' && <><dt>Invoice goods</dt><dd>Rs. {Number(invGoods || 0).toLocaleString('en-LK', { minimumFractionDigits: 2 })}</dd></>}
                                    </dl>
                                </aside>
                            </div>

                            <div className="grn-foot">
                                <span className="grn-foot-status" data-ok={gate.ok} role="status">{gate.ok ? 'Ready to save' : `${gate.left} check${gate.left === 1 ? '' : 's'} to complete`}</span>
                                <button type="button" className="grn-btn" onClick={handleCloseGRNDialog}>Cancel</button>
                                <button type="button" className="grn-btn grn-btn-go" onClick={handleCreateGRN} disabled={!gate.ok || createGRNMutation.isPending || isUploading}>
                                    {createGRNMutation.isPending ? 'Saving...' : 'Confirm receipt'}
                                </button>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            {/* Details Drawer - Premium Enterprise Redesign */}
            <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
                <DialogContent 
                    showCloseButton={false}
                    className="fixed !inset-y-0 !right-0 !top-0 !left-auto !translate-x-0 !translate-y-0 !h-full w-[65vw] !max-w-none flex flex-col !p-0 !gap-0 overflow-hidden bg-white dark:bg-slate-950 border-l border-slate-200 dark:border-slate-800 shadow-2xl z-50 duration-300 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right !rounded-none"
                >
                    {selectedRequest && (
                        <>
                            {/* Header Banner */}
                            <div className="relative p-6 pb-4 flex-shrink-0 bg-slate-50 dark:bg-slate-900/60 border-b border-slate-200/60 dark:border-slate-800/60">
                                <div className="absolute top-0 right-0 p-5">
                                    <button 
                                        onClick={() => setShowDetailsDialog(false)} 
                                        className="p-2 rounded-full hover:bg-slate-200/50 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>

                                <div className="space-y-1">
                                    <div className="flex items-center gap-2">
                                        <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">GRN Inventory Intake</span>
                                        <Badge className="bg-emerald-50 text-emerald-600 border border-emerald-200 dark:bg-emerald-955/20 text-[9px] px-2 py-0 font-bold rounded-full">
                                            {activeTab === 'COMPLETED' ? 'Completed & In Stock' : 'Awaiting Receipt Verification'}
                                        </Badge>
                                    </div>
                                    <h2 className="text-xl font-black text-slate-900 dark:text-white leading-tight">
                                        {selectedRequest.requestNr}
                                    </h2>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">
                                        PO Reference: <span className="font-mono font-bold text-slate-700 dark:text-slate-300">{(selectedRequest.poNumber && selectedRequest.poNumber !== 'N/A' && selectedRequest.poNumber !== '-') ? selectedRequest.poNumber : (selectedRequest.purchaseOrders?.length === 1 ? selectedRequest.purchaseOrders[0].poNumber : (selectedRequest.purchaseOrders && selectedRequest.purchaseOrders.length > 1 ? selectedRequest.purchaseOrders.map(p => p.poNumber).filter(Boolean).join(', ') : 'N/A'))}</span>
                                    </p>
                                </div>
                            </div>

                            {/* Split Panels Body */}
                            <div className="flex-1 flex overflow-hidden bg-slate-50/50 dark:bg-slate-950/20">
                                
                                {/* LEFT PANEL (65% Scrollable) */}
                                <div className="w-[65%] h-full overflow-y-auto p-6 space-y-6 border-r border-slate-200/50 dark:border-slate-800/50 [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-slate-200 dark:[&::-webkit-scrollbar-thumb]:bg-slate-800/60 [&::-webkit-scrollbar-thumb]:rounded-full">
                                    
                                    {/* GRN Information - 6 Cards */}
                                    <div className="space-y-3">
                                        <h3 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-2">
                                            <Info className="w-3.5 h-3.5 text-blue-500" /> Intake Details
                                        </h3>
                                        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                                            <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200/60 dark:border-slate-800 shadow-sm flex items-center gap-2.5">
                                                <Tag className="w-4 h-4 text-slate-400" />
                                                <div className="min-w-0">
                                                    <span className="text-[9px] font-bold text-slate-400 block uppercase">Request No</span>
                                                    <span className="font-bold text-slate-800 dark:text-slate-200 text-xs truncate block">{selectedRequest.requestNr}</span>
                                                </div>
                                            </div>
                                            <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200/60 dark:border-slate-800 shadow-sm flex items-center gap-2.5">
                                                <ClipboardList className="w-4 h-4 text-slate-400" />
                                                <div className="min-w-0">
                                                    <span className="text-[9px] font-bold text-slate-400 block uppercase">PO Reference</span>
                                                    <span className="font-bold text-slate-800 dark:text-slate-200 text-xs truncate block">{(selectedRequest.poNumber && selectedRequest.poNumber !== 'N/A' && selectedRequest.poNumber !== '-') ? selectedRequest.poNumber : (selectedRequest.purchaseOrders?.length === 1 ? selectedRequest.purchaseOrders[0].poNumber : (selectedRequest.purchaseOrders && selectedRequest.purchaseOrders.length > 1 ? selectedRequest.purchaseOrders.map(p => p.poNumber).filter(Boolean).join(', ') : 'N/A'))}</span>
                                                </div>
                                            </div>
                                            <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200/60 dark:border-slate-800 shadow-sm flex items-center gap-2.5">
                                                <ClipboardList className="w-4 h-4 text-blue-500" />
                                                <div className="min-w-0">
                                                    <span className="text-[9px] font-bold text-slate-400 block uppercase">Invoice / Del. Note</span>
                                                    <span className="font-bold text-slate-800 dark:text-slate-200 text-xs truncate block">{selectedRequest.reference || 'N/A'}</span>
                                                </div>
                                            </div>
                                            <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200/60 dark:border-slate-800 shadow-sm flex items-center gap-2.5">
                                                <Tag className="w-4 h-4 text-slate-400" />
                                                <div className="min-w-0">
                                                    <span className="text-[9px] font-bold text-slate-400 block uppercase">Source Type</span>
                                                    <span className="font-bold text-slate-800 dark:text-slate-200 text-xs truncate block">{selectedRequest.sourceType}</span>
                                                </div>
                                            </div>
                                            <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200/60 dark:border-slate-800 shadow-sm flex items-center gap-2.5">
                                                <AlertCircle className="w-4 h-4 text-emerald-500" />
                                                <div className="min-w-0">
                                                    <span className="text-[9px] font-bold text-slate-400 block uppercase">Intake Status</span>
                                                    <Badge className={cn(
                                                        "text-[9px] font-bold px-2 py-0 rounded mt-0.5",
                                                        activeTab === 'COMPLETED' ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20" : "bg-amber-500/10 text-amber-600 border border-amber-500/20"
                                                    )}>
                                                        {activeTab === 'COMPLETED' ? 'COMPLETED' : 'AWAITING VERIFICATION'}
                                                    </Badge>
                                                </div>
                                            </div>
                                            <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200/60 dark:border-slate-800 shadow-sm flex items-center gap-2.5 font-sans">
                                                <Calendar className="w-4 h-4 text-slate-400" />
                                                <div className="min-w-0">
                                                    <span className="text-[9px] font-bold text-slate-400 block uppercase">Expected Delivery</span>
                                                    <span className="font-bold text-slate-800 dark:text-slate-200 text-xs truncate block">
                                                        {selectedRequest.expectedDelivery ? new Date(selectedRequest.expectedDelivery).toLocaleDateString() : 'Immediate'}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200/60 dark:border-slate-800 shadow-sm flex items-center gap-2.5 col-span-2 lg:col-span-3">
                                                <Building2 className="w-4 h-4 text-slate-400" />
                                                <div className="min-w-0">
                                                    <span className="text-[9px] font-bold text-slate-400 block uppercase">Supplier</span>
                                                    <span className="font-bold text-slate-800 dark:text-slate-200 text-xs truncate block">{(selectedRequest.vendor && selectedRequest.vendor !== 'N/A' && selectedRequest.vendor !== '-') ? String(selectedRequest.vendor) : (selectedRequest.purchaseOrders?.length ? Array.from(new Set(selectedRequest.purchaseOrders.map(p => (typeof p.vendor === 'object' && p.vendor !== null) ? (p.vendor as unknown as { name?: string }).name : p.vendor).filter(Boolean))).join(', ') || 'N/A' : 'N/A')}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Items Table */}
                                    <div className="space-y-3">
                                        <h3 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-2">
                                            <Package className="w-3.5 h-3.5 text-blue-500" /> Intake Material Registry
                                        </h3>
                                        <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm bg-white dark:bg-slate-950">
                                            <table className="w-full text-xs text-left border-collapse">
                                                <thead className="bg-slate-50/80 dark:bg-slate-900/80 text-slate-500 dark:text-slate-400 font-bold border-b border-slate-200 dark:border-slate-800 text-[10px] uppercase tracking-wider sticky top-0 z-10 backdrop-blur">
                                                    <tr>
                                                        <th className="px-4 py-3">Material / Item</th>
                                                        <th className="px-4 py-3 text-right">Quantity</th>
                                                        <th className="px-4 py-3">Lot Number</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                                    {selectedRequest.items?.map((item) => (
                                                        <tr key={item.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-900/40 transition-colors duration-150 group">
                                                            <td className="px-4 py-3.5">
                                                                <div className="flex items-center gap-2.5">
                                                                    <div className="w-7 h-7 bg-slate-100 dark:bg-slate-900 rounded-lg flex items-center justify-center border border-slate-200 dark:border-slate-800 font-black text-slate-500 dark:text-slate-400 text-[9px]">
                                                                        {item.item?.name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                                                                    </div>
                                                                    <div className="font-bold text-slate-900 dark:text-white text-xs">{item.item?.name}</div>
                                                                </div>
                                                            </td>
                                                            <td className="px-4 py-3.5 text-right font-black text-slate-800 dark:text-slate-200">
                                                                {item.requestedQty} {item.item?.unit}
                                                            </td>
                                                            <td className="px-4 py-3.5">
                                                                <span className="font-mono text-[10px] font-bold text-blue-600 dark:text-blue-400">
                                                                    {item.batch?.batchNumber || (activeTab === 'COMPLETED' ? 'System Assigned' : 'Awaiting Allocation')}
                                                                </span>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </div>

                                {/* RIGHT PANEL (35% Sticky) */}
                                <div className="w-[35%] h-full overflow-y-auto p-6 space-y-6 bg-slate-50/50 dark:bg-slate-900/10 border-l border-slate-200/50 dark:border-slate-800/50 [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-slate-200 dark:[&::-webkit-scrollbar-thumb]:bg-slate-800/60 [&::-webkit-scrollbar-thumb]:rounded-full">
                                    
                                    {/* Summary card */}
                                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
                                        <h4 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                                            <TrendingUp className="w-3.5 h-3.5 text-blue-500" /> Summary Metrics
                                        </h4>
                                        {(() => {
                                            const totalItems = selectedRequest.items?.length || 0;
                                            const totalQty = selectedRequest.items?.reduce((sum, item) => sum + (Number(item.requestedQty) || 0), 0) || 0;
                                            return (
                                                <div className="space-y-3 text-xs">
                                                    <div className="flex justify-between items-center py-1.5 border-b border-slate-100 dark:border-slate-800/80">
                                                        <span className="text-slate-500 dark:text-slate-400">Total Items Catalogued</span>
                                                        <span className="font-black text-slate-800 dark:text-slate-200">{totalItems}</span>
                                                    </div>
                                                    <div className="flex justify-between items-center py-1.5">
                                                        <span className="text-slate-500 dark:text-slate-400">Total Intake Qty</span>
                                                        <span className="font-black text-slate-800 dark:text-slate-200">{totalQty.toLocaleString()}</span>
                                                    </div>
                                                </div>
                                            );
                                        })()}
                                    </div>

                                    {/* Intake timeline */}
                                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-3">
                                        <h4 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                                            <Clock className="w-3.5 h-3.5 text-blue-500" /> Intake Timeline
                                        </h4>
                                        <div className="relative pl-6 space-y-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200 dark:before:bg-slate-800 text-xs">
                                            <div className="relative">
                                                <span className="absolute -left-6 top-0.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-white dark:border-slate-900"></span>
                                                <div className="font-bold text-slate-800 dark:text-slate-200">PO Raised &amp; Supplier Assigned</div>
                                                <div className="text-[10px] text-slate-400">Authorized by procurement team</div>
                                            </div>
                                            <div className="relative">
                                                <span className={cn(
                                                    "absolute -left-6 top-0.5 w-3 h-3 rounded-full border-2 border-white dark:border-slate-900",
                                                    activeTab === 'COMPLETED' ? "bg-emerald-500" : "bg-slate-200 dark:bg-slate-800"
                                                )}></span>
                                                <div className="font-bold text-slate-800 dark:text-slate-200">Goods Receipt Certified</div>
                                                <div className="text-[10px] text-slate-400">
                                                    {activeTab === 'COMPLETED' ? 'Store check validated and updated' : 'Pending verification check'}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Footer */}
                            <div className="px-6 py-4 bg-white dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 flex justify-end items-center flex-shrink-0 gap-3">
                                <Button 
                                    variant="outline" 
                                    onClick={() => setShowDetailsDialog(false)}
                                    className="h-9 px-4 text-xs font-bold rounded-xl border-slate-200 hover:bg-slate-50 text-slate-700 flex items-center gap-1.5"
                                >
                                    <X className="w-3.5 h-3.5" /> Close Details
                                </Button>
                            </div>
                        </>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}

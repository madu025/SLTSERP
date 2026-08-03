"use client";

import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Package, Eye, Info, Calendar, Building2, AlertCircle, Tag, TrendingUp, X, Clock, ClipboardList, Loader2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { createGRN } from "@/actions/inventory-actions";

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
}

interface PORefItem {
    id?: string;
    poNumber?: string;
    vendor?: string | { name?: string };
    items?: Array<{
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
            items: Array<{ itemId: string; quantity: number; serials?: string[] }>;
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
                toast.error(result.error || 'Failed to create GRN');
            }
        },
        onError: () => toast.error('Failed to create GRN')
    });

    const handleSelectPO = (poNumber: string, requestOverride?: InventoryRequest) => {
        const req = requestOverride || selectedRequest;
        setSelectedPOId(poNumber);
        if (!req) return;

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
        handleSelectPO('ALL', request);
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
            purchaseOrderId: selectedPOId !== 'ALL' ? selectedPOId : undefined,
            sltReferenceId: selectedRequest.irNumber || null,
            reference: invoiceNumber,
            documentUrl: finalDocumentUrl || undefined,
            items: receivedItems.map(item => ({
                itemId: item.itemId,
                quantity: parseFloat(item.receivedQty.toString()),
                serials: item.hasSerial ? (item.serials || []).filter(s => s && s.trim() !== '') : undefined,
                expiryDate: item.expiryDate || undefined
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

    const estimatorSummaries = useMemo(() => {
        const totalItems = receivedItems.length;
        
        const groupedOrdered = receivedItems.reduce((acc, item) => {
            const unit = item.unit || 'Nos';
            acc[unit] = (acc[unit] || 0) + item.requestedQty;
            return acc;
        }, {} as Record<string, number>);

        const groupedReceived = receivedItems.reduce((acc, item) => {
            const unit = item.unit || 'Nos';
            acc[unit] = (acc[unit] || 0) + (Number(item.receivedQty) || 0);
            return acc;
        }, {} as Record<string, number>);

        return {
            totalItems,
            groupedOrdered,
            groupedReceived
        };
    }, [receivedItems]);

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
                                                                    <span className="text-slate-500">{req.items?.reduce((acc, item) => acc + (item.receivedQty || 0), 0) || 0} / {req.items?.reduce((acc, item) => acc + (item.requestedQty || 0), 0) || 0} Items</span>
                                                                    <span className="text-blue-600">
                                                                        {Math.round(((req.items?.reduce((acc, item) => acc + (item.receivedQty || 0), 0) || 0) / (req.items?.reduce((acc, item) => acc + (item.requestedQty || 0), 0) || 1)) * 100)}%
                                                                    </span>
                                                                </div>
                                                                <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                                                                    <div 
                                                                        className="h-full bg-blue-500 rounded-full" 
                                                                        style={{ width: `${Math.min(100, Math.round(((req.items?.reduce((acc, item) => acc + (item.receivedQty || 0), 0) || 0) / (req.items?.reduce((acc, item) => acc + (item.requestedQty || 0), 0) || 1)) * 100))}%` }}
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
                    className="fixed !inset-y-0 !right-0 !top-0 !left-auto !translate-x-0 !translate-y-0 !h-full w-[65vw] !max-w-none flex flex-col !p-0 !gap-0 overflow-hidden bg-white dark:bg-slate-950 border-l border-slate-200 dark:border-slate-800 shadow-2xl z-50 duration-300 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right !rounded-none"
                >
                    {selectedRequest && (
                        <>
                            {/* Header Banner */}
                            <div className="relative p-6 pb-4 flex-shrink-0 bg-slate-50 dark:bg-slate-900/60 border-b border-slate-200/60 dark:border-slate-800/60">
                                <div className="absolute top-0 right-0 p-5">
                                    <button 
                                        onClick={handleCloseGRNDialog} 
                                        className="p-2 rounded-full hover:bg-slate-200/50 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>

                                <div className="space-y-1">
                                    <div className="flex items-center gap-2">
                                        <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Inventory Ledger Update</span>
                                        <Badge className="bg-emerald-50 text-emerald-600 border border-emerald-200 dark:bg-emerald-955/20 text-[9px] px-2 py-0 font-bold rounded-full">
                                            Goods Receipt Note
                                        </Badge>
                                    </div>
                                    <h2 className="text-xl font-black text-slate-900 dark:text-white leading-tight">
                                        Record Goods Receipt (GRN)
                                    </h2>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">
                                        Verify ordered materials and register them to store inventory.
                                    </p>
                                </div>
                            </div>

                            {/* Split Panels Body */}
                            <div className="flex-1 flex overflow-hidden bg-slate-50/50 dark:bg-slate-950/20">
                                
                                {/* LEFT PANEL (65% Scrollable Form) */}
                                <div className="w-[65%] h-full overflow-y-auto p-6 space-y-6 border-r border-slate-200/50 dark:border-slate-800/50 [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-slate-200 dark:[&::-webkit-scrollbar-thumb]:bg-slate-800/60 [&::-webkit-scrollbar-thumb]:rounded-full">
                                    
                                    {/* GRN References */}
                                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-sm space-y-4">
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-1.5">
                                                <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">GRN Reference</label>
                                                <Input
                                                    className="h-9 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-mono font-bold text-slate-500 cursor-not-allowed border-dashed"
                                                    value={grnNumber}
                                                    readOnly
                                                />
                                            </div>
                                            <div className="space-y-1.5">
                                                <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Received Date</label>
                                                <Input
                                                    type="date"
                                                    className="h-9 rounded-lg bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-semibold px-3 focus-visible:ring-1 focus-visible:ring-blue-500"
                                                    value={receivedDate}
                                                    onChange={e => setReceivedDate(e.target.value)}
                                                />
                                            </div>

                                        </div>
                                    </div>

                                     {/* Target PO Selector Card (Multi-PO Partial GRN Support) */}
                                     {(() => {
                                         const poList = (selectedRequest.purchaseOrders && selectedRequest.purchaseOrders.length > 0)
                                             ? selectedRequest.purchaseOrders
                                             : (selectedRequest.poNumber && selectedRequest.poNumber !== 'N/A' && selectedRequest.poNumber !== '-')
                                                 ? [{ id: selectedRequest.poNumber, poNumber: selectedRequest.poNumber, vendor: selectedRequest.vendor }]
                                                 : [];

                                         if (poList.length === 0) return null;

                                         return (
                                             <div className="bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/60 p-4 rounded-2xl space-y-2">
                                                 <div className="flex justify-between items-center">
                                                     <label className="text-[10px] font-black uppercase tracking-wider text-blue-700 dark:text-blue-300 flex items-center gap-1.5">
                                                         <ClipboardList className="w-3.5 h-3.5" /> Target PO Delivery Filter
                                                     </label>
                                                     <Badge className="bg-blue-600 text-white text-[9px] px-2 py-0 font-bold rounded">
                                                         {poList.length} PO Reference{poList.length > 1 ? 's' : ''}
                                                     </Badge>
                                                 </div>
                                                 <select
                                                     className="h-9 w-full rounded-lg bg-white dark:bg-slate-900 border border-blue-200 dark:border-blue-800 text-xs font-bold text-slate-700 dark:text-slate-300 px-3 outline-none focus:ring-2 focus:ring-blue-500/50"
                                                     value={selectedPOId}
                                                     onChange={e => handleSelectPO(e.target.value)}
                                                 >
                                                     <option value="ALL">📦 Intake All Outstanding PO Items (Combined)</option>
                                                     {poList.map((po) => (
                                                         <option key={po.id || po.poNumber} value={po.poNumber}>
                                                             📄 {po.poNumber} — {typeof po.vendor === 'object' ? po.vendor?.name : (po.vendor || 'Vendor')}
                                                         </option>
                                                     ))}
                                                 </select>

                                                 <div className="grid grid-cols-2 gap-4 mt-3">
                                                     <div className="space-y-1.5">
                                                         <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">Invoice / Delivery Note</label>
                                                         <Input
                                                             type="text"
                                                             placeholder="E.g. INV-2024-001"
                                                             className="h-9 rounded-lg bg-white dark:bg-slate-900 border border-blue-200/50 dark:border-blue-800/50 text-xs font-semibold px-3 focus-visible:ring-1 focus-visible:ring-blue-500"
                                                             value={invoiceNumber}
                                                             onChange={e => setInvoiceNumber(e.target.value)}
                                                         />
                                                     </div>
                                                     <div className="space-y-1.5">
                                                         <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">Upload Invoice</label>
                                                         <div className="flex gap-2 items-center">
                                                             <Input
                                                                 type="file"
                                                                 accept=".pdf,image/*"
                                                                 className="h-9 rounded-lg bg-white dark:bg-slate-900 border border-blue-200/50 dark:border-blue-800/50 text-xs font-semibold px-3 py-1 cursor-pointer focus-visible:ring-1 focus-visible:ring-blue-500 flex-1"
                                                                 onChange={handleFileSelection}
                                                                 disabled={isUploading || createGRNMutation.isPending}
                                                             />
                                                             {isUploading && <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />}
                                                             {(selectedFile || documentUrl) && !isUploading && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
                                                         </div>
                                                     </div>
                                                 </div>

                                                 <p className="text-[10px] text-blue-600/80 dark:text-blue-400/80 font-medium">
                                                     Selecting a specific PO filters the checklist to show ONLY the materials authorized under that supplier&apos;s purchase order.
                                                 </p>
                                             </div>
                                         );
                                     })()}

                                     {/* Received Items Checklist */}
                                    <div className="space-y-3">
                                        <h3 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-2">
                                            <Package className="w-3.5 h-3.5 text-blue-500" /> Items Verification List
                                        </h3>

                                        <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm bg-white dark:bg-slate-950">
                                            <table className="w-full text-xs text-left border-collapse">
                                                <thead className="bg-slate-50/80 dark:bg-slate-900/80 text-slate-500 dark:text-slate-400 font-bold border-b border-slate-200 dark:border-slate-800 text-[10px] uppercase tracking-wider">
                                                    <tr>
                                                        <th className="px-4 py-3">Material Description</th>
                                                        <th className="px-4 py-3 text-center w-28">Ordered Qty</th>
                                                        <th className="px-4 py-3 text-center w-36">Received Qty</th>
                                                        <th className="px-4 py-3">Expiry &amp; Serial Registry</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                                    {receivedItems.map((item, idx) => (
                                                        <tr key={idx} className="hover:bg-slate-50/30 dark:hover:bg-slate-900/20 transition-colors">
                                                            <td className="px-4 py-3.5">
                                                                <div className="font-bold text-slate-900 dark:text-white">{item.itemName}</div>
                                                                <div className="text-[9px] text-slate-400 mt-0.5">Item Registry Code</div>
                                                            </td>
                                                            <td className="px-4 py-3.5 text-center font-black text-slate-600 dark:text-slate-400">
                                                                {item.requestedQty} <span className="text-[9px] font-semibold text-slate-400">{item.unit || 'Nos'}</span>
                                                            </td>
                                                            <td className="px-4 py-3.5 relative">
                                                                <div className="relative flex items-center">
                                                                    <Input
                                                                        type="number"
                                                                        step="any"
                                                                        className={cn("h-8 text-right font-black text-xs pr-10", item.receivedQty > item.requestedQty ? "text-red-500 border-red-200 focus-visible:ring-red-500" : "")}
                                                                        value={item.receivedQty}
                                                                        onChange={e => updateReceivedQty(idx, e.target.value)}
                                                                    />
                                                                    <span className={cn("absolute right-3 text-[10px] font-bold pointer-events-none", item.receivedQty > item.requestedQty ? "text-red-400" : "text-slate-400")}>
                                                                        {item.unit || 'Nos'}
                                                                    </span>
                                                                </div>
                                                                {item.receivedQty > item.requestedQty && (
                                                                    <div className="absolute top-1 right-2 text-[8px] text-red-500 font-bold bg-white px-1">
                                                                        Over
                                                                    </div>
                                                                )}
                                                            </td>
                                                            <td className="px-4 py-3.5 space-y-3">
                                                                <div className="space-y-1">
                                                                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Expiry Date</span>
                                                                    <Input
                                                                        type="date"
                                                                        className="h-8 text-xs font-mono font-semibold"
                                                                        value={item.expiryDate || ''}
                                                                        onChange={e => {
                                                                            const updated = [...receivedItems];
                                                                            updated[idx].expiryDate = e.target.value;
                                                                            setReceivedItems(updated);
                                                                        }}
                                                                    />
                                                                </div>
                                                                {item.hasSerial && (
                                                                    <div className="bg-slate-50 dark:bg-slate-900 p-3 rounded-xl border border-slate-200/60 dark:border-slate-800 space-y-2">
                                                                        <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">Assign Serial Numbers:</span>
                                                                        <div className="space-y-1.5">
                                                                            {Array.from({ length: Math.ceil(item.receivedQty) || 0 }).map((_, sIdx) => (
                                                                                <Input
                                                                                    key={sIdx}
                                                                                    className="h-8 text-[10px] font-mono bg-white dark:bg-slate-950 font-bold"
                                                                                    placeholder={`Serial #${sIdx + 1}`}
                                                                                    value={item.serials?.[sIdx] || ''}
                                                                                    onChange={e => {
                                                                                        const updatedSerials = [...(item.serials || [])];
                                                                                        updatedSerials[sIdx] = e.target.value;
                                                                                        const updatedItems = [...receivedItems];
                                                                                        updatedItems[idx].serials = updatedSerials;
                                                                                        setReceivedItems(updatedItems);
                                                                                    }}
                                                                                />
                                                                            ))}
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>

                                    {/* Remarks */}
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Additional Notes / Quality Inspection</label>
                                        <Textarea
                                            rows={2}
                                            value={grnRemarks}
                                            onChange={e => setGRNRemarks(e.target.value)}
                                            placeholder="Write any comments regarding quality checking, visual inspect status, damaged goods if any..."
                                            className="text-xs bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-xl resize-none focus-visible:ring-1 focus-visible:ring-blue-500"
                                        />
                                    </div>
                                </div>

                                {/* RIGHT PANEL (35% Sticky Request Details) */}
                                <div className="w-[35%] h-full overflow-y-auto p-6 space-y-6 bg-slate-50/50 dark:bg-slate-900/10 border-l border-slate-200/50 dark:border-slate-800/50 [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-slate-200 dark:[&::-webkit-scrollbar-thumb]:bg-slate-800/60 [&::-webkit-scrollbar-thumb]:rounded-full">
                                    
                                    {/* Request Context Info */}
                                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
                                        <h4 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                                            <Info className="w-3.5 h-3.5 text-blue-500" /> Reference Information
                                        </h4>
                                        {(() => {
                                            const poList = selectedRequest.purchaseOrders || [];
                                            let displayPO = selectedRequest.poNumber || 'N/A';
                                            let displayVendor = (selectedRequest.vendor as string) || 'N/A';

                                            if (poList.length > 0) {
                                                if (selectedPOId === 'ALL') {
                                                    displayPO = `Multiple POs (${poList.length})`;
                                                    const vendors = Array.from(new Set(poList.map(p => typeof p.vendor === 'object' ? p.vendor?.name : p.vendor).filter(Boolean)));
                                                    displayVendor = vendors.length > 1 ? 'Multiple Suppliers' : ((vendors[0] as string) || 'N/A');
                                                } else {
                                                    const target = poList.find(p => p.poNumber === selectedPOId || p.id === selectedPOId);
                                                    if (target) {
                                                        displayPO = target.poNumber || 'N/A';
                                                        displayVendor = typeof target.vendor === 'object' ? (target.vendor?.name || 'N/A') : (target.vendor || 'N/A');
                                                    }
                                                }
                                            }

                                            return (
                                                <div className="space-y-3.5 text-xs">
                                                    <div className="pb-3 border-b border-slate-100 dark:border-slate-800/80">
                                                        <span className="text-[9px] font-bold text-slate-400 block uppercase">Request No</span>
                                                        <span className="font-bold text-slate-800 dark:text-slate-200 text-xs">{selectedRequest.requestNr}</span>
                                                    </div>
                                                    <div className="pb-3 border-b border-slate-100 dark:border-slate-800/80">
                                                        <span className="text-[9px] font-bold text-slate-400 block uppercase">PO Reference</span>
                                                        <span className="font-bold text-slate-800 dark:text-slate-200 text-xs">{displayPO}</span>
                                                    </div>
                                                    <div className="pb-3 border-b border-slate-100 dark:border-slate-800/80">
                                                        <span className="text-[9px] font-bold text-slate-400 block uppercase">Supplier Partner</span>
                                                        <span className="font-bold text-slate-800 dark:text-slate-200 text-xs">{displayVendor}</span>
                                                    </div>
                                                    <div>
                                                        <span className="text-[9px] font-bold text-slate-400 block uppercase">Source Type</span>
                                                        <Badge className="bg-blue-500/10 text-blue-600 border border-blue-500/20 text-[9px] font-bold px-2 py-0 mt-0.5 rounded">{selectedRequest.sourceType}</Badge>
                                                    </div>
                                                </div>
                                            );
                                        })()}
                                    </div>

                                    {/* Verification Metrics */}
                                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
                                        <h4 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                                            <TrendingUp className="w-3.5 h-3.5 text-blue-500" /> Intake Estimator
                                        </h4>
                                        <div className="space-y-3 text-xs">
                                            <div className="flex justify-between items-center py-1.5 border-b border-slate-100 dark:border-slate-800/80 font-semibold">
                                                <span className="text-slate-400">Materials In GRN</span>
                                                <span className="text-slate-800 dark:text-slate-200 font-bold">{estimatorSummaries.totalItems}</span>
                                            </div>
                                            
                                            <div className="space-y-1 py-1.5 border-b border-slate-100 dark:border-slate-800/80">
                                                <div className="font-semibold text-slate-400 mb-1">Total Ordered Qty</div>
                                                {Object.entries(estimatorSummaries.groupedOrdered).map(([unit, qty]) => (
                                                    <div key={unit} className="flex justify-between items-center text-slate-800 dark:text-slate-200">
                                                        <span className="text-[10px] uppercase font-bold text-slate-400">{unit}</span>
                                                        <span className="font-black">{qty.toLocaleString()}</span>
                                                    </div>
                                                ))}
                                                {Object.keys(estimatorSummaries.groupedOrdered).length === 0 && (
                                                    <span className="text-slate-400 text-xs">0</span>
                                                )}
                                            </div>

                                            <div className="space-y-1 py-1.5">
                                                <div className="font-semibold text-slate-400 mb-1">Total Received Qty</div>
                                                {Object.entries(estimatorSummaries.groupedReceived).map(([unit, qty]) => (
                                                    <div key={unit} className="flex justify-between items-center text-blue-600 dark:text-blue-400">
                                                        <span className="text-[10px] uppercase font-bold text-blue-400/70">{unit}</span>
                                                        <span className="font-black">{qty.toLocaleString()}</span>
                                                    </div>
                                                ))}
                                                {Object.keys(estimatorSummaries.groupedReceived).length === 0 && (
                                                    <span className="text-slate-400 text-xs">0</span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Sticky Footer */}
                            <div className="px-6 py-4 bg-white dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 flex justify-end items-center flex-shrink-0 gap-3">
                                <Button variant="outline" onClick={handleCloseGRNDialog} className="h-9 px-4 text-xs font-bold rounded-xl border-slate-200 hover:bg-slate-50 text-slate-700 flex items-center gap-1.5">
                                    Cancel
                                </Button>
                                <Button
                                    onClick={handleCreateGRN}
                                    disabled={createGRNMutation.isPending}
                                    className="h-9 px-5 text-xs font-bold bg-green-600 hover:bg-green-700 text-white rounded-xl flex items-center gap-1.5 shadow-sm shadow-green-500/10 font-sans"
                                >
                                    {createGRNMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <><CheckCircle2 className="w-3.5 h-3.5" /> Confirm Receipt</>}
                                </Button>
                            </div>
                        </>
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
                                            const totalQty = selectedRequest.items?.reduce((sum, item) => sum + item.requestedQty, 0) || 0;
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

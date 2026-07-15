"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Package, CheckCircle, Eye, Info, Calendar, Building2, User, AlertCircle, PenSquare, Tag, TrendingUp, X, Clock, ClipboardList, Loader2, FileText, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { createGRN } from "@/actions/inventory-actions";

interface GRNItem {
    itemId: string;
    itemName: string;
    requestedQty: number;
    receivedQty: number;
    remarks: string;
    serials?: string[];
    hasSerial?: boolean;
    expiryDate?: string;
}

interface InventoryRequest {
    id: string;
    requestNr: string;
    poNumber?: string;
    vendor?: string;
    sourceType: string;
    fromStoreId: string;
    irNumber?: string;
    items: {
        id: string;
        itemId: string;
        item?: {
            name: string;
            code: string;
            unit: string;
            hasSerial?: boolean;
        };
        requestedQty: number;
        batch?: {
            batchNumber: string;
        };
    }[];
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
        poNumber: string;
        vendor: string | null;
    } | null;
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
    const [receivedItems, setReceivedItems] = useState<GRNItem[]>([]);
    const [grnRemarks, setGRNRemarks] = useState('');

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
            const res = await fetch(`/api/inventory/requests?workflowStage=GRN_PENDING`);
            return res.json();
        },
        enabled: activeTab === 'READY'
    });

    // Fetch completed GRNs
    const { data: completedGrns = [], isLoading: isLoadingCompleted } = useQuery<CompletedGRN[]>({
        queryKey: ['completed-generals'],
        queryFn: async () => {
            const res = await fetch(`/api/inventory/grn`);
            const json = await res.json();
            return json.success ? json.data : json;
        },
        enabled: activeTab === 'COMPLETED'
    });

    const isLoading = activeTab === 'READY' ? isLoadingRequests : isLoadingCompleted;

    // Create GRN mutation
    const createGRNMutation = useMutation({
        mutationFn: async (data: {
            storeId: string;
            sourceType: string;
            supplier?: string;
            receivedById: string;
            requestId: string;
            sltReferenceId: string | null;
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

    const handleOpenGRNDialog = (request: InventoryRequest) => {
        setSelectedRequest(request);

        // Initialize received items with requested quantities
        const items: GRNItem[] = request.items.map((item) => {
            const reqQty = item.requestedQty || 0;
            return {
                itemId: item.itemId,
                itemName: item.item?.name || 'Unknown Item',
                requestedQty: reqQty,
                receivedQty: reqQty, // Default to requested qty
                remarks: '',
                hasSerial: item.item?.hasSerial || false,
                serials: Array(Math.ceil(reqQty)).fill(''),
                expiryDate: ''
            };
        });
        setReceivedItems(items);
        setShowGRNDialog(true);
    };

    const handleCloseGRNDialog = () => {
        setShowGRNDialog(false);
        setSelectedRequest(null);
        setReceivedItems([]);
        setGRNRemarks('');
        setGRNNumber(''); // Reset GRN number
    };

    const handleCreateGRN = () => {
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

        const payload = {
            storeId: selectedRequest.fromStoreId,
            sourceType: selectedRequest.sourceType,
            supplier: selectedRequest.vendor,
            receivedById: user.id,
            requestId: selectedRequest.id,
            sltReferenceId: selectedRequest.irNumber || null,
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

    const updateItemRemarks = (index: number, value: string) => {
        const updated = [...receivedItems];
        updated[index].remarks = value;
        setReceivedItems(updated);
    };

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
                                                requests.map((req) => (
                                                    <tr key={req.id} className="hover:bg-slate-50/50 transition-colors duration-150">
                                                        <td className="px-4 py-1.5 font-bold text-slate-800">{req.requestNr}</td>
                                                        <td className="px-3 py-1.5">
                                                            <Badge variant="outline" className="text-[10px] font-mono px-1.5 py-0 border-slate-200 text-slate-600 bg-white">
                                                                {req.poNumber || '-'}
                                                            </Badge>
                                                        </td>
                                                        <td className="px-3 py-1.5 text-slate-700">{req.vendor || '-'}</td>
                                                        <td className="px-3 py-1.5 text-center font-semibold text-slate-700">{req.items?.length || 0}</td>
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
                                                completedGrns.map((grn) => (
                                                    <tr key={grn.id} className="hover:bg-slate-50/50 transition-colors duration-150">
                                                        <td className="px-4 py-1.5 font-bold text-slate-800">{grn.grnNumber}</td>
                                                        <td className="px-3 py-1.5">
                                                            <Badge variant="outline" className="text-[10px] font-mono px-1.5 py-0 border-slate-200 text-slate-600 bg-white">
                                                                {grn.request?.poNumber || '-'}
                                                            </Badge>
                                                        </td>
                                                        <td className="px-3 py-1.5 text-slate-700">{grn.supplier || grn.request?.vendor || '-'}</td>
                                                        <td className="px-3 py-1.5 text-center font-semibold text-slate-700">{grn.items?.length || 0}</td>
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
                                                <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">GRN Reference (Auto-Generated)</label>
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
                                                    className="h-9 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-semibold px-3 focus-visible:ring-1 focus-visible:ring-blue-500"
                                                    value={receivedDate}
                                                    onChange={e => setReceivedDate(e.target.value)}
                                                />
                                            </div>
                                        </div>
                                    </div>

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
                                                        <th className="px-4 py-3">Batch &amp; Expiry Registry</th>
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
                                                                {item.requestedQty}
                                                            </td>
                                                            <td className="px-4 py-3.5">
                                                                <Input
                                                                    type="number"
                                                                    className="h-8 text-right font-black text-xs"
                                                                    value={item.receivedQty}
                                                                    onChange={e => updateReceivedQty(idx, e.target.value)}
                                                                />
                                                            </td>
                                                            <td className="px-4 py-3.5 space-y-3">
                                                                <Input
                                                                    className="h-8 text-xs font-mono"
                                                                    placeholder="Batch Number (optional)"
                                                                    value={item.remarks}
                                                                    onChange={e => updateItemRemarks(idx, e.target.value)}
                                                                />
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
                                        <div className="space-y-3.5 text-xs">
                                            <div className="pb-3 border-b border-slate-100 dark:border-slate-800/80">
                                                <span className="text-[9px] font-bold text-slate-400 block uppercase">Request No</span>
                                                <span className="font-bold text-slate-800 dark:text-slate-200 text-xs">{selectedRequest.requestNr}</span>
                                            </div>
                                            <div className="pb-3 border-b border-slate-100 dark:border-slate-800/80">
                                                <span className="text-[9px] font-bold text-slate-400 block uppercase">PO Reference</span>
                                                <span className="font-bold text-slate-800 dark:text-slate-200 text-xs">{selectedRequest.poNumber || 'N/A'}</span>
                                            </div>
                                            <div className="pb-3 border-b border-slate-100 dark:border-slate-800/80">
                                                <span className="text-[9px] font-bold text-slate-400 block uppercase">Supplier Partner</span>
                                                <span className="font-bold text-slate-800 dark:text-slate-200 text-xs">{selectedRequest.vendor || 'N/A'}</span>
                                            </div>
                                            <div>
                                                <span className="text-[9px] font-bold text-slate-400 block uppercase">Source Type</span>
                                                <Badge className="bg-blue-500/10 text-blue-600 border border-blue-500/20 text-[9px] font-bold px-2 py-0 mt-0.5 rounded">{selectedRequest.sourceType}</Badge>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Verification Metrics */}
                                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
                                        <h4 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                                            <TrendingUp className="w-3.5 h-3.5 text-blue-500" /> Intake Estimator
                                        </h4>
                                        {(() => {
                                            const totalItems = receivedItems.length;
                                            const totalOrdered = receivedItems.reduce((sum, item) => sum + item.requestedQty, 0);
                                            const totalReceived = receivedItems.reduce((sum, item) => sum + (parseFloat(item.receivedQty as any) || 0), 0);
                                            return (
                                                <div className="space-y-3 text-xs">
                                                    <div className="flex justify-between items-center py-1.5 border-b border-slate-100 dark:border-slate-800/80 font-semibold">
                                                        <span className="text-slate-400">Materials In GRN</span>
                                                        <span className="text-slate-800 dark:text-slate-200 font-bold">{totalItems}</span>
                                                    </div>
                                                    <div className="flex justify-between items-center py-1.5 border-b border-slate-100 dark:border-slate-800/80 font-semibold">
                                                        <span className="text-slate-400">Total Ordered Qty</span>
                                                        <span className="text-slate-800 dark:text-slate-200 font-bold">{totalOrdered.toLocaleString()}</span>
                                                    </div>
                                                    <div className="flex justify-between items-center py-1.5 font-bold">
                                                        <span className="text-slate-400">Total Received Qty</span>
                                                        <span className="text-blue-600 dark:text-blue-400">{totalReceived.toLocaleString()}</span>
                                                    </div>
                                                </div>
                                            );
                                        })()}
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
                                        PO Reference: <span className="font-mono font-bold text-slate-700 dark:text-slate-300">{selectedRequest.poNumber || 'N/A'}</span>
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
                                                    <span className="font-bold text-slate-800 dark:text-slate-200 text-xs truncate block">{selectedRequest.poNumber || 'N/A'}</span>
                                                </div>
                                            </div>
                                            <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200/60 dark:border-slate-800 shadow-sm flex items-center gap-2.5">
                                                <Building2 className="w-4 h-4 text-slate-400" />
                                                <div className="min-w-0">
                                                    <span className="text-[9px] font-bold text-slate-400 block uppercase">Supplier</span>
                                                    <span className="font-bold text-slate-800 dark:text-slate-200 text-xs truncate block">{selectedRequest.vendor || 'N/A'}</span>
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
                                                        "text-[9px] font-bold px-2 py-0 rounded",
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
                                                        <th className="px-4 py-3">Batch Number</th>
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

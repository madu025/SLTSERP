"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Package, CheckCircle, Eye } from "lucide-react";
import { toast } from "sonner";
import { createGRN } from "@/actions/inventory-actions";

interface GRNItem {
    itemId: string;
    itemName: string;
    requestedQty: number;
    receivedQty: number;
    remarks: string;
    serials?: string[];
    hasSerial?: boolean;
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
    const { data: requests = [], isLoading } = useQuery<InventoryRequest[]>({
        queryKey: ['grn-requests', activeTab],
        queryFn: async () => {
            const res = await fetch(`/api/inventory/requests?workflowStage=${activeTab === 'READY' ? 'GRN_PENDING' : 'COMPLETED'}`);
            return res.json();
        }
    });

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
                serials: Array(Math.ceil(reqQty)).fill('')
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
                serials: item.hasSerial ? (item.serials || []).filter(s => s && s.trim() !== '') : undefined
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
                            ) : requests.length === 0 ? (
                                <div className="text-center p-8 text-slate-400 text-xs font-semibold">
                                    {activeTab === 'READY' ? 'No pending GRNs' : 'No completed GRNs'}
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-xs text-left border-collapse">
                                        <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                                            <tr>
                                                <th className="px-4 py-2 font-semibold">Request No</th>
                                                <th className="px-3 py-2 font-semibold">PO Number</th>
                                                <th className="px-3 py-2 font-semibold">Vendor</th>
                                                <th className="px-3 py-2 font-semibold text-center">Items</th>
                                                <th className="px-3 py-2 font-semibold">Expected Delivery</th>
                                                <th className="px-4 py-2 font-semibold text-right">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {requests.map((req) => (
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
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </main>

            {/* Create GRN Dialog */}
            <Dialog open={showGRNDialog} onOpenChange={setShowGRNDialog}>
                <DialogContent className="max-w-4xl max-h-[95vh] flex flex-col p-0 overflow-hidden">
                    <DialogHeader className="px-6 py-4 border-b">
                        <DialogTitle>Record Goods Receipt</DialogTitle>
                    </DialogHeader>
                    <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4 no-scrollbar">
                        {selectedRequest && (
                            <div className="space-y-4">
                                {/* GRN Header Info */}
                                <div className="grid grid-cols-2 gap-4 p-3 bg-slate-50 rounded">
                                    <div className="text-sm">
                                        <span className="font-bold">Request No:</span> {selectedRequest.requestNr}
                                    </div>
                                    <div className="text-sm">
                                        <span className="font-bold">PO Number:</span> {selectedRequest.poNumber}
                                    </div>
                                    <div className="text-sm">
                                        <span className="font-bold">Vendor:</span> {selectedRequest.vendor}
                                    </div>
                                    <div className="text-sm">
                                        <span className="font-bold">Source:</span> {selectedRequest.sourceType}
                                    </div>
                                </div>

                                {/* GRN Form */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-xs font-bold text-slate-600 uppercase">GRN Reference No. (Auto)</label>
                                        <Input
                                            className="mt-1 bg-slate-50 text-slate-500 font-mono cursor-not-allowed border-dashed"
                                            value={grnNumber}
                                            readOnly
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-slate-600 uppercase">Received Date</label>
                                        <Input
                                            type="date"
                                            className="mt-1"
                                            value={receivedDate}
                                            onChange={e => setReceivedDate(e.target.value)}
                                        />
                                    </div>
                                </div>

                                {/* Items Table */}
                                <div>
                                    <label className="text-xs font-bold text-slate-600 uppercase mb-2 block">Received Items</label>
                                    <div className="border rounded overflow-hidden">
                                        <table className="w-full text-xs">
                                            <thead className="bg-slate-100">
                                                <tr>
                                                    <th className="px-3 py-2 text-left">Item</th>
                                                    <th className="px-3 py-2 text-center">Ordered Qty</th>
                                                    <th className="px-3 py-2 text-center">Received Qty</th>
                                                    <th className="px-3 py-2 text-left">Batch / Notes</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y">
                                                {receivedItems.map((item, idx) => (
                                                    <tr key={idx}>
                                                        <td className="px-3 py-2">{item.itemName}</td>
                                                        <td className="px-3 py-2 text-center font-medium">{item.requestedQty}</td>
                                                        <td className="px-3 py-2">
                                                            <Input
                                                                type="number"
                                                                className="h-8 text-center"
                                                                value={item.receivedQty}
                                                                onChange={e => updateReceivedQty(idx, e.target.value)}
                                                            />
                                                        </td>
                                                        <td className="px-3 py-2 flex flex-col gap-1">
                                                            <Input
                                                                className="h-8 text-xs font-mono"
                                                                placeholder="Batch ID (optional)"
                                                                value={item.remarks}
                                                                onChange={e => updateItemRemarks(idx, e.target.value)}
                                                            />
                                                            {item.hasSerial && (
                                                                <div className="mt-2 space-y-1 bg-slate-50 p-2 rounded border border-slate-200">
                                                                    <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wide block mb-1">Serial Numbers Required:</label>
                                                                    {Array.from({ length: Math.ceil(item.receivedQty) }).map((_, sIdx) => (
                                                                        <Input
                                                                            key={sIdx}
                                                                            className="h-7 text-[10px] font-mono bg-white"
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
                                                            )}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>

                                {/* GRN Remarks */}
                                <div>
                                    <label className="text-xs font-bold text-slate-600 uppercase">Additional Notes</label>
                                    <Textarea
                                        className="mt-1"
                                        rows={3}
                                        value={grnRemarks}
                                        onChange={e => setGRNRemarks(e.target.value)}
                                        placeholder="Quality check notes, delivery condition, etc."
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                    <DialogFooter className="px-6 py-4 border-t bg-slate-50">
                        <Button variant="outline" onClick={handleCloseGRNDialog}>Cancel</Button>
                        <Button
                            onClick={handleCreateGRN}
                            disabled={createGRNMutation.isPending}
                            className="bg-green-600 hover:bg-green-700"
                        >
                            <CheckCircle className="w-4 h-4 mr-2" />
                            {createGRNMutation.isPending ? 'Saving...' : 'Confirm & Update Stock'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Details Dialog */}
            <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
                <DialogContent className="max-w-3xl">
                    <DialogHeader>
                        <DialogTitle>Request Details</DialogTitle>
                    </DialogHeader>
                    {selectedRequest && (
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4 text-sm bg-slate-50 p-3 rounded">
                                <div><span className="font-bold">Request No:</span> {selectedRequest.requestNr}</div>
                                <div><span className="font-bold">PO Number:</span> {selectedRequest.poNumber}</div>
                                <div><span className="font-bold">Vendor:</span> {selectedRequest.vendor}</div>
                                <div><span className="font-bold">Source:</span> {selectedRequest.sourceType}</div>
                            </div>
                            <table className="w-full text-xs border">
                                <thead className="bg-slate-100">
                                    <tr>
                                        <th className="p-2 border text-left">Item</th>
                                        <th className="p-2 border text-center">Quantity</th>
                                        <th className="p-2 border text-left">Batch No.</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {selectedRequest.items?.map((item) => (
                                        <tr key={item.id}>
                                            <td className="p-2 border">{item.item?.name}</td>
                                            <td className="p-2 border text-center">{item.requestedQty}</td>
                                            <td className="p-2 border font-mono text-[10px] text-blue-600">
                                                {item.batch?.batchNumber || (activeTab === 'COMPLETED' ? 'System Assigned' : '-')}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}

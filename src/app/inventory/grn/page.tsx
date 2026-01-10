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

export default function GRNPage() {
    const queryClient = useQueryClient();
    const [activeTab, setActiveTab] = useState<'READY' | 'COMPLETED'>('READY');
    const [selectedRequest, setSelectedRequest] = useState<any>(null);
    const [showGRNDialog, setShowGRNDialog] = useState(false);
    const [showDetailsDialog, setShowDetailsDialog] = useState(false);

    // GRN Form State
    const [grnNumber, setGRNNumber] = useState('');
    const [receivedDate, setReceivedDate] = useState(new Date().toISOString().split('T')[0]);
    const [receivedItems, setReceivedItems] = useState<any[]>([]);
    const [grnRemarks, setGRNRemarks] = useState('');

    // Fetch requests ready for GRN
    const { data: requests = [], isLoading } = useQuery({
        queryKey: ['grn-requests', activeTab],
        queryFn: async () => {
            const res = await fetch(`/api/inventory/requests?workflowStage=${activeTab === 'READY' ? 'GRN_PENDING' : 'COMPLETED'}`);
            return res.json();
        }
    });

    // Create GRN mutation
    const createGRNMutation = useMutation({
        mutationFn: async (data: any) => {
            const res = await fetch('/api/inventory/grn', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            if (!res.ok) throw new Error('Failed to create GRN');
            return res.json();
        },
        onSuccess: () => {
            toast.success('GRN created successfully! Stock updated.');
            queryClient.invalidateQueries({ queryKey: ['grn-requests'] });
            handleCloseGRNDialog();
        },
        onError: () => toast.error('Failed to create GRN')
    });

    const handleOpenGRNDialog = (request: any) => {
        setSelectedRequest(request);
        setGRNNumber(`GRN-${Date.now()}`);

        // Initialize received items with requested quantities
        const items = request.items.map((item: any) => ({
            itemId: item.itemId,
            itemName: item.item?.name,
            requestedQty: item.requestedQty,
            receivedQty: item.requestedQty, // Default to requested qty
            remarks: ''
        }));
        setReceivedItems(items);
        setShowGRNDialog(true);
    };

    const handleCloseGRNDialog = () => {
        setShowGRNDialog(false);
        setSelectedRequest(null);
        setReceivedItems([]);
        setGRNRemarks('');
    };

    const handleCreateGRN = () => {
        if (!grnNumber) {
            toast.error('GRN Number is required');
            return;
        }

        // Get user from localStorage
        const user = JSON.parse(localStorage.getItem('user') || '{}');

        const payload = {
            storeId: selectedRequest.fromStoreId,
            sourceType: selectedRequest.sourceType,
            supplier: selectedRequest.vendor,
            receivedById: user.id,
            requestId: selectedRequest.id,
            sltReferenceId: selectedRequest.irNumber || null,
            items: receivedItems.map(item => ({
                itemId: item.itemId,
                quantity: parseFloat(item.receivedQty)
            }))
        };

        createGRNMutation.mutate(payload);
    };

    const updateReceivedQty = (index: number, value: string) => {
        const updated = [...receivedItems];
        updated[index].receivedQty = value;
        setReceivedItems(updated);
    };

    const updateItemRemarks = (index: number, value: string) => {
        const updated = [...receivedItems];
        updated[index].remarks = value;
        setReceivedItems(updated);
    };

    return (
        <div className="flex h-screen bg-slate-50 overflow-hidden">
            <Sidebar />
            <main className="flex-1 flex flex-col min-w-0 h-full">
                <Header />
                <div className="flex-1 overflow-y-auto p-4 md:p-6">
                    <div className="max-w-7xl mx-auto space-y-6">
                        {/* Header */}
                        <div>
                            <h1 className="text-2xl font-bold text-slate-900">Goods Receipt Note (GRN)</h1>
                            <p className="text-slate-500">Receive goods and update stock levels</p>
                        </div>

                        {/* Tabs */}
                        <div className="flex gap-2 border-b">
                            <button
                                onClick={() => setActiveTab('READY')}
                                className={`px-4 py-2 font-medium text-sm transition-colors ${activeTab === 'READY'
                                    ? 'border-b-2 border-blue-600 text-blue-600'
                                    : 'text-slate-500 hover:text-slate-700'
                                    }`}
                            >
                                Ready for GRN
                                {requests.length > 0 && activeTab === 'READY' && (
                                    <Badge className="ml-2 bg-blue-600">{requests.length}</Badge>
                                )}
                            </button>
                            <button
                                onClick={() => setActiveTab('COMPLETED')}
                                className={`px-4 py-2 font-medium text-sm transition-colors ${activeTab === 'COMPLETED'
                                    ? 'border-b-2 border-blue-600 text-blue-600'
                                    : 'text-slate-500 hover:text-slate-700'
                                    }`}
                            >
                                Completed GRNs
                            </button>
                        </div>

                        {/* Requests List */}
                        <Card>
                            <CardHeader>
                                <CardTitle>
                                    {activeTab === 'READY' ? 'Pending GRN' : 'Completed GRNs'}
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                {isLoading ? (
                                    <div className="text-center p-8 text-slate-500">Loading...</div>
                                ) : requests.length === 0 ? (
                                    <div className="text-center p-8 text-slate-500">
                                        {activeTab === 'READY' ? 'No pending GRNs' : 'No completed GRNs'}
                                    </div>
                                ) : (
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm">
                                            <thead className="bg-slate-100 border-b">
                                                <tr>
                                                    <th className="px-4 py-3 text-left">Request No</th>
                                                    <th className="px-4 py-3 text-left">PO Number</th>
                                                    <th className="px-4 py-3 text-left">Vendor</th>
                                                    <th className="px-4 py-3 text-left">Items</th>
                                                    <th className="px-4 py-3 text-left">Expected Delivery</th>
                                                    <th className="px-4 py-3 text-right">Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y">
                                                {requests.map((req: any) => (
                                                    <tr key={req.id} className="hover:bg-slate-50">
                                                        <td className="px-4 py-3 font-medium">{req.requestNr}</td>
                                                        <td className="px-4 py-3">
                                                            <Badge variant="outline">{req.poNumber}</Badge>
                                                        </td>
                                                        <td className="px-4 py-3">{req.vendor || '-'}</td>
                                                        <td className="px-4 py-3 text-center">{req.items?.length || 0}</td>
                                                        <td className="px-4 py-3">
                                                            {req.expectedDelivery
                                                                ? new Date(req.expectedDelivery).toLocaleDateString()
                                                                : '-'
                                                            }
                                                        </td>
                                                        <td className="px-4 py-3 text-right">
                                                            <div className="flex justify-end gap-2">
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    onClick={() => {
                                                                        setSelectedRequest(req);
                                                                        setShowDetailsDialog(true);
                                                                    }}
                                                                >
                                                                    <Eye className="w-4 h-4" />
                                                                </Button>
                                                                {activeTab === 'READY' && (
                                                                    <Button
                                                                        size="sm"
                                                                        className="bg-green-600 hover:bg-green-700"
                                                                        onClick={() => handleOpenGRNDialog(req)}
                                                                    >
                                                                        <Package className="w-4 h-4 mr-1" />
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
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </main>

            {/* Create GRN Dialog */}
            <Dialog open={showGRNDialog} onOpenChange={setShowGRNDialog}>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Create Goods Receipt Note</DialogTitle>
                    </DialogHeader>
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
                                    <label className="text-xs font-bold text-slate-600 uppercase">GRN Number</label>
                                    <Input
                                        className="mt-1"
                                        value={grnNumber}
                                        onChange={e => setGRNNumber(e.target.value)}
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
                                                <th className="px-3 py-2 text-left">Remarks</th>
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
                                                    <td className="px-3 py-2">
                                                        <Input
                                                            className="h-8 text-xs"
                                                            placeholder="Optional"
                                                            value={item.remarks}
                                                            onChange={e => updateItemRemarks(idx, e.target.value)}
                                                        />
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* GRN Remarks */}
                            <div>
                                <label className="text-xs font-bold text-slate-600 uppercase">GRN Remarks</label>
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
                    <DialogFooter>
                        <Button variant="outline" onClick={handleCloseGRNDialog}>Cancel</Button>
                        <Button
                            onClick={handleCreateGRN}
                            disabled={createGRNMutation.isPending}
                            className="bg-green-600 hover:bg-green-700"
                        >
                            <CheckCircle className="w-4 h-4 mr-2" />
                            {createGRNMutation.isPending ? 'Creating...' : 'Create GRN & Update Stock'}
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
                                        <th className="p-2 border text-left">Make/Model</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {selectedRequest.items?.map((item: any) => (
                                        <tr key={item.id}>
                                            <td className="p-2 border">{item.item?.name}</td>
                                            <td className="p-2 border text-center">{item.requestedQty}</td>
                                            <td className="p-2 border">{item.make} {item.model}</td>
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

"use client";

import React, { useState, useEffect } from 'react';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Search, AlertTriangle, Trash2, Layers, History } from "lucide-react";
import { toast } from 'sonner';
import { format } from 'date-fns';
import { recordWastage } from "@/actions/inventory-actions";

interface User {
    id: string;
    name: string;
}

interface Store {
    id: string;
    name: string;
    type: string;
}

interface StockItem {
    id: string;
    itemId: string;
    item: { name: string; code: string; unit: string; category: string };
    quantity: number;
    minLevel?: number;
}

export default function StockPage() {
    const queryClient = useQueryClient();
    const [selectedStoreId, setSelectedStoreId] = useState("");
    const [searchTerm, setSearchTerm] = useState("");
    const [user] = useState<User | null>(() => {
        if (typeof window !== 'undefined') {
            const stored = localStorage.getItem('user');
            return stored ? JSON.parse(stored) : null;
        }
        return null;
    });

    // Wastage Modal
    const [wastageItem, setWastageItem] = useState<StockItem | null>(null);
    const [wastageQty, setWastageQty] = useState("");
    const [wastageReason, setWastageReason] = useState("");

    // Batch Details Modal
    const [selectedItemForBatches, setSelectedItemForBatches] = useState<StockItem | null>(null);
    const { data: itemBatches = [], isLoading: isLoadingBatches } = useQuery<Array<{
        id: string;
        quantity: number;
        batch: {
            batchNumber: string;
            createdAt: string;
            grn?: { grnNumber: string; createdAt: string };
            costPrice?: number;
            initialQty: number;
        };
    }>>({
        queryKey: ['item-batches', selectedStoreId, selectedItemForBatches?.itemId],
        queryFn: async () => {
            if (!selectedItemForBatches) return [];
            const res = await fetch(`/api/inventory/batches?storeId=${selectedStoreId}&itemId=${selectedItemForBatches.itemId}`);
            return res.json();
        },
        enabled: !!(selectedStoreId && selectedItemForBatches)
    });


    // Fetch Stores
    const { data: stores = [] } = useQuery<Store[]>({
        queryKey: ['stores'],
        queryFn: async () => {
            const res = await fetch('/api/inventory/stores');
            return res.json();
        }
    });

    // Default Store Selection
    useEffect(() => {
        if (stores.length > 0 && !selectedStoreId) {
            const firstStoreId = stores[0].id;
            setTimeout(() => setSelectedStoreId(firstStoreId), 0);
        }
    }, [stores, selectedStoreId]);

    // Fetch Stock
    const { data: stock = [], isLoading } = useQuery<StockItem[]>({
        queryKey: ['stock', selectedStoreId],
        queryFn: async () => {
            if (!selectedStoreId) return [];
            const res = await fetch(`/api/inventory/stock?storeId=${selectedStoreId}`);
            return res.json();
        },
        enabled: !!selectedStoreId
    });

    // Wastage Mutation
    const wastageMutation = useMutation({
        mutationFn: async () => {
            if (!wastageItem) throw new Error("No item selected");
            return await recordWastage({
                storeId: selectedStoreId,
                userId: user?.id,
                items: [{ itemId: wastageItem.itemId, quantity: parseFloat(wastageQty) }],
                reason: wastageReason
            });
        },
        onSuccess: (result) => {
            if (result.success) {
                toast.success("Wastage recorded successfully");
                setWastageItem(null);
                setWastageQty("");
                setWastageReason("");
                queryClient.invalidateQueries({ queryKey: ['stock'] });
            } else {
                toast.error(result.error || "Failed to record wastage");
            }
        },
        onError: () => toast.error("Failed to record wastage")
    });

    const filteredStock = Array.isArray(stock) ? stock.filter((s) =>
        s.item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.item.code.toLowerCase().includes(searchTerm.toLowerCase())
    ) : [];

    return (
        <div className="h-screen flex bg-slate-50 overflow-hidden">
            <Sidebar />
            <main className="flex-1 flex flex-col min-w-0 h-full">
                <Header />
                <div className="flex-1 flex flex-col min-h-0 overflow-hidden p-4 md:p-8">
                    <div className="max-w-6xl mx-auto w-full flex flex-col h-full space-y-4">

                        <div className="flex justify-between items-center flex-none">
                            <div>
                                <h1 className="text-xl font-bold text-slate-900">Stock Levels</h1>
                                <p className="text-xs text-slate-500">View and manage inventory per store</p>
                            </div>
                            <div className="flex gap-4 items-center bg-white p-2 rounded-lg border shadow-sm">
                                <div className="flex items-center gap-2">
                                    <span className="text-xs font-semibold text-slate-500">Store:</span>
                                    <Select value={selectedStoreId} onValueChange={setSelectedStoreId}>
                                        <SelectTrigger className="w-[200px] h-8 text-xs">
                                            <SelectValue placeholder="Select Store" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {stores.map((s) => (
                                                <SelectItem key={s.id} value={s.id} className="text-xs">
                                                    {s.name} ({s.type})
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="w-px h-6 bg-slate-200" />
                                <div className="relative">
                                    <Search className="w-4 h-4 text-slate-400 absolute left-2.5 top-2" />
                                    <Input
                                        placeholder="Search items..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="h-8 text-xs pl-9 w-[200px]"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="flex-1 bg-white rounded-xl border shadow-sm overflow-hidden flex flex-col">
                            <div className="overflow-auto flex-1">
                                <table className="w-full text-xs text-left">
                                    <thead className="bg-slate-50 text-slate-600 font-bold border-b sticky top-0">
                                        <tr>
                                            <th className="px-4 py-3">Item Code</th>
                                            <th className="px-4 py-3">Item Name</th>
                                            <th className="px-4 py-3 text-center">Unit</th>
                                            <th className="px-4 py-3 text-right">Quantity</th>
                                            <th className="px-4 py-3 text-center">Batches</th>
                                            <th className="px-4 py-3 text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                        {isLoading ? (
                                            <tr><td colSpan={6} className="p-8 text-center text-slate-400">Loading stock...</td></tr>
                                        ) : filteredStock.length === 0 ? (
                                            <tr><td colSpan={6} className="p-8 text-center text-slate-400">No stock found for this store.</td></tr>
                                        ) : (
                                            filteredStock.map((row: StockItem) => (
                                                <tr key={row.id} className="hover:bg-slate-50">
                                                    <td className="px-4 py-2 font-mono text-slate-500">{row.item.code}</td>
                                                    <td className="px-4 py-2 font-bold text-slate-800">{row.item.name}</td>
                                                    <td className="px-4 py-2 text-center text-slate-500 bg-slate-50/50">{row.item.unit}</td>
                                                    <td className={`px-4 py-2 text-right font-bold ${row.quantity <= (row.minLevel || 0) ? 'text-red-600' : 'text-emerald-700'}`}>
                                                        {row.quantity}
                                                        {row.quantity <= (row.minLevel || 0) && <AlertTriangle className="w-3 h-3 inline ml-1 text-red-500" />}
                                                    </td>
                                                    <td className="px-4 py-2 text-center">
                                                        <Button
                                                            variant="ghost" size="sm" className="h-7 text-[10px] gap-1 hover:bg-blue-50 text-blue-600"
                                                            onClick={() => setSelectedItemForBatches(row)}
                                                        >
                                                            <Layers className="w-3 h-3" /> View
                                                        </Button>
                                                    </td>
                                                    <td className="px-4 py-2 text-right">
                                                        <Button
                                                            size="sm" variant="ghost" className="h-6 text-xs text-red-600 hover:bg-red-50"
                                                            onClick={() => setWastageItem(row)}
                                                        >
                                                            <Trash2 className="w-3 h-3 mr-1" /> Wastage
                                                        </Button>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                    </div>
                </div>

                <Dialog open={!!wastageItem} onOpenChange={(o) => { if (!o) setWastageItem(null); }}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Report Wastage</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4">
                            <div className="p-4 bg-slate-50 rounded-lg border">
                                <span className="block text-xs text-slate-500">Item</span>
                                <span className="font-bold text-slate-800">{wastageItem?.item?.name}</span>
                                <div className="text-xs text-slate-400 mt-1">Current Stock: {wastageItem?.quantity} {wastageItem?.item?.unit}</div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-semibold mb-1 block">Quantity to Deduct</label>
                                    <Input
                                        type="number"
                                        className="h-8"
                                        value={wastageQty}
                                        onChange={(e) => setWastageQty(e.target.value)}
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-semibold mb-1 block">Reason</label>
                                    <Input
                                        className="h-8"
                                        placeholder="Damaged, Lost, etc."
                                        value={wastageReason}
                                        onChange={(e) => setWastageReason(e.target.value)}
                                    />
                                </div>
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setWastageItem(null)}>Cancel</Button>
                            <Button
                                variant="destructive"
                                onClick={() => wastageMutation.mutate()}
                                disabled={!wastageQty || Number(wastageQty) <= 0 || wastageMutation.isPending}
                            >
                                {wastageMutation.isPending ? "Updating..." : "Confirm Wastage"}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                {/* Batches View Dialog */}
                <Dialog open={!!selectedItemForBatches} onOpenChange={(o) => { if (!o) setSelectedItemForBatches(null); }}>
                    <DialogContent className="max-w-2xl max-h-[95vh] flex flex-col p-0 overflow-hidden">
                        <DialogHeader className="px-6 py-4 border-b">
                            <DialogTitle className="flex items-center gap-2">
                                <Layers className="w-5 h-5 text-blue-600" />
                                Batch Breakdown: {selectedItemForBatches?.item?.name}
                            </DialogTitle>
                        </DialogHeader>

                        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4 no-scrollbar">
                            <div className="flex justify-between items-end px-1">
                                <div className="text-xs text-slate-500">
                                    Product Code: <span className="font-mono font-bold text-slate-700">{selectedItemForBatches?.item?.code}</span>
                                </div>
                                <div className="text-sm font-bold text-slate-900 border-b-2 border-emerald-500 pb-1">
                                    Total Stock: {selectedItemForBatches?.quantity} {selectedItemForBatches?.item?.unit}
                                </div>
                            </div>

                            <div className="border rounded-lg overflow-hidden">
                                <table className="w-full text-xs">
                                    <thead className="bg-slate-50 border-b">
                                        <tr>
                                            <th className="px-3 py-2 text-left">Batch No.</th>
                                            <th className="px-3 py-2 text-left">Received via</th>
                                            <th className="px-3 py-2 text-right">Initial Qty</th>
                                            <th className="px-3 py-2 text-right">Remaining</th>
                                            <th className="px-3 py-2 text-right">Cost (LKR)</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                        {isLoadingBatches ? (
                                            <tr><td colSpan={5} className="p-8 text-center text-slate-400">Loading batches...</td></tr>
                                        ) : itemBatches.length === 0 ? (
                                            <tr><td colSpan={5} className="p-8 text-center text-slate-400">No active batches for this item.</td></tr>
                                        ) : (
                                            itemBatches.map((b) => (
                                                <tr key={b.id} className="hover:bg-slate-50/50">
                                                    <td className="px-3 py-2 font-mono font-bold text-slate-700">
                                                        {b.batch.batchNumber || 'N/A'}
                                                        <div className="text-[10px] font-normal text-slate-400">
                                                            Created: {format(new Date(b.batch.createdAt), 'yyyy-MM-dd')}
                                                        </div>
                                                    </td>
                                                    <td className="px-3 py-2">
                                                        {b.batch.grn?.grnNumber ? (
                                                            <div className="flex flex-col">
                                                                <span className="font-medium text-slate-700">{b.batch.grn.grnNumber}</span>
                                                                <span className="text-[9px] text-slate-400">{format(new Date(b.batch.grn.createdAt), 'MMM dd, yyyy')}</span>
                                                            </div>
                                                        ) : 'Initial/Manual'}
                                                    </td>
                                                    <td className="px-3 py-2 text-right text-slate-500">{b.batch.initialQty}</td>
                                                    <td className="px-3 py-2 text-right font-bold text-emerald-700">{b.quantity}</td>
                                                    <td className="px-3 py-2 text-right font-mono">
                                                        {b.batch.costPrice?.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>

                            <div className="bg-amber-50 border border-amber-200 p-3 rounded-lg flex gap-3 text-amber-800">
                                <History className="w-5 h-5 shrink-0 mt-0.5" />
                                <p className="text-[11px] leading-relaxed">
                                    <strong>FIFO Policy:</strong> Materials are automatically issued from the oldest batch first (top of this list)
                                    to ensure accurate costing and inventory aging.
                                </p>
                            </div>
                        </div>

                        <DialogFooter className="px-6 py-4 border-t bg-slate-50">
                            <Button variant="outline" onClick={() => setSelectedItemForBatches(null)}>Close</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

            </main>
        </div>
    );
}

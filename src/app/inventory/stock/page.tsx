"use client";

import React, { useState, useEffect } from 'react';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Search, AlertTriangle, Trash2, Layers, History, X, Clock, TrendingUp, Info, AlertCircle, FileText, CheckCircle2 } from "lucide-react";
import { toast } from 'sonner';
import { safeFormat, cn } from '@/lib/utils';
import { recordWastage } from "@/actions/inventory-actions";
import { Badge } from "@/components/ui/badge";

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
    item: { name: string; code: string; unit: string; category: string; hasSerial?: boolean };
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

    // Serial Details Modal
    const [selectedItemForSerials, setSelectedItemForSerials] = useState<StockItem | null>(null);
    const { data: itemSerials = [], isLoading: isLoadingSerials } = useQuery<Array<{
        id: string;
        serialNumber: string;
        status: string;
        createdAt: string;
    }>>({
        queryKey: ['item-serials', selectedStoreId, selectedItemForSerials?.itemId],
        queryFn: async () => {
            if (!selectedItemForSerials) return [];
            const res = await fetch(`/api/inventory/serials?storeId=${selectedStoreId}&itemId=${selectedItemForSerials.itemId}`);
            return res.json();
        },
        enabled: !!(selectedStoreId && selectedItemForSerials)
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
        <div className="erp-page-wrapper flex-row overflow-hidden">
            <Sidebar />
            <main className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
                <Header />
                <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
                    <div className="max-w-7xl mx-auto space-y-4">

                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                            <div className="space-y-0.5">
                                <h1 className="text-xl font-black text-slate-900 tracking-tight">Stock Levels</h1>
                                <p className="text-xs text-slate-500">View and manage inventory per store</p>
                            </div>
                        </div>

                        {/* Controls Toolbar */}
                        <div className="erp-toolbar">
                            <div className="flex flex-col sm:flex-row items-center gap-3 flex-1 w-full">
                                <div className="flex items-center gap-2 w-full sm:w-auto">
                                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider min-w-[50px]">Store:</span>
                                    <Select value={selectedStoreId} onValueChange={setSelectedStoreId}>
                                        <SelectTrigger className="w-[180px] h-8 text-xs bg-white border-slate-200">
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
                                <div className="h-6 w-[1px] bg-slate-200 hidden sm:block" />
                                <div className="relative w-full sm:w-64">
                                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                                    <Input
                                        placeholder="Search items..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="h-8 text-xs pl-9 w-full bg-white border-slate-200"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Stock Table */}
                        <div className="erp-table-container flex flex-col bg-white overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="w-full text-xs text-left border-collapse">
                                    <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200 sticky top-0">
                                        <tr>
                                            <th className="px-4 py-2 font-semibold">Item Code</th>
                                            <th className="px-3 py-2 font-semibold">Item Name</th>
                                            <th className="px-3 py-2 font-semibold text-center">Unit</th>
                                            <th className="px-3 py-2 text-right font-semibold">Quantity</th>
                                            <th className="px-3 py-2 text-center font-semibold">Tracking</th>
                                            <th className="px-4 py-2 text-right font-semibold">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {isLoading ? (
                                            <tr><td colSpan={6} className="p-8 text-center text-slate-400 font-semibold">Loading stock...</td></tr>
                                        ) : filteredStock.length === 0 ? (
                                            <tr><td colSpan={6} className="p-8 text-center text-slate-400 font-semibold">No stock found for this store.</td></tr>
                                        ) : (
                                            filteredStock.map((row: StockItem) => (
                                                <tr key={row.id} className="hover:bg-slate-50/50 transition-colors duration-150">
                                                    <td className="px-4 py-1.5 font-mono text-[11px] text-slate-700">{row.item.code}</td>
                                                    <td className="px-3 py-1.5 font-bold text-slate-900">{row.item.name}</td>
                                                    <td className="px-3 py-1.5 text-center text-slate-500 bg-slate-50/30">{row.item.unit}</td>
                                                    <td className={`px-3 py-1.5 text-right font-mono font-bold ${row.quantity <= (row.minLevel || 0) ? 'text-rose-600' : 'text-emerald-700'}`}>
                                                        {row.quantity}
                                                        {row.quantity <= (row.minLevel || 0) && <AlertTriangle className="w-3.5 h-3.5 inline ml-1 text-rose-500" />}
                                                    </td>
                                                    <td className="px-3 py-1.5 text-center">
                                                        <div className="flex gap-1.5 justify-center">
                                                            <Button
                                                                variant="ghost" size="sm" className="h-7 px-2 text-[10px] gap-1 hover:bg-blue-50 text-blue-600 font-semibold"
                                                                onClick={() => setSelectedItemForBatches(row)}
                                                            >
                                                                <Layers className="w-3 h-3" /> Batches
                                                            </Button>
                                                            {row.item.hasSerial && (
                                                                <Button
                                                                    variant="ghost" size="sm" className="h-7 px-2 text-[10px] gap-1 hover:bg-purple-50 text-purple-600 font-semibold"
                                                                    onClick={() => setSelectedItemForSerials(row)}
                                                                >
                                                                    <Layers className="w-3 h-3" /> Serials
                                                                </Button>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-1.5 text-right">
                                                        <Button
                                                            size="sm" variant="ghost" className="h-7 px-2 text-xs text-rose-600 hover:bg-rose-50 hover:text-rose-700 font-semibold"
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

                {/* Report Wastage Drawer - Premium Design */}
                <Dialog open={!!wastageItem} onOpenChange={(o) => { if (!o) setWastageItem(null); }}>
                    <DialogContent 
                        showCloseButton={false}
                        className="fixed !inset-y-0 !right-0 !top-0 !left-auto !translate-x-0 !translate-y-0 !h-full w-[65vw] !max-w-none flex flex-col !p-0 !gap-0 overflow-hidden bg-white dark:bg-slate-950 border-l border-slate-200 dark:border-slate-800 shadow-2xl z-50 duration-300 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right !rounded-none"
                    >
                        {wastageItem && (
                            <>
                                {/* Header */}
                                <div className="relative p-6 pb-4 flex-shrink-0 bg-slate-50 dark:bg-slate-900/60 border-b border-slate-200/60 dark:border-slate-800/60">
                                    <div className="absolute top-0 right-0 p-5">
                                        <button 
                                            onClick={() => setWastageItem(null)} 
                                            className="p-2 rounded-full hover:bg-slate-200/50 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                                        >
                                            <X className="w-4 h-4" />
                                        </button>
                                    </div>

                                    <div className="space-y-1">
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Inventory Management</span>
                                            <Badge className="bg-red-50 text-red-600 border border-red-200 dark:bg-red-955/20 text-[9px] px-2 py-0 font-bold rounded-full">
                                                Stock Adjustment
                                            </Badge>
                                        </div>
                                        <h2 className="text-xl font-black text-slate-900 dark:text-white leading-tight">
                                            Report Wastage &amp; Damage
                                        </h2>
                                        <p className="text-xs text-slate-500 dark:text-slate-400">
                                            Deduct damaged, lost, or expired items from the warehouse stock levels.
                                        </p>
                                    </div>
                                </div>

                                {/* Body Split */}
                                <div className="flex-1 flex overflow-hidden bg-slate-50/50 dark:bg-slate-950/20">
                                    {/* Left Panel */}
                                    <div className="w-[65%] h-full overflow-y-auto p-6 space-y-6 border-r border-slate-200/50 dark:border-slate-800/50">
                                        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-sm space-y-4">
                                            <div className="space-y-1.5">
                                                <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Quantity to Deduct</label>
                                                <Input
                                                    type="number"
                                                    className="h-9 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-bold px-3 focus-visible:ring-1 focus-visible:ring-blue-500 text-right"
                                                    value={wastageQty}
                                                    onChange={(e) => setWastageQty(e.target.value)}
                                                    placeholder="0"
                                                />
                                            </div>

                                            <div className="space-y-1.5">
                                                <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Deduction Reason</label>
                                                <Input
                                                    className="h-9 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-semibold px-3 focus-visible:ring-1 focus-visible:ring-blue-500"
                                                    placeholder="Damaged in transit, expired, lost during audit, etc."
                                                    value={wastageReason}
                                                    onChange={(e) => setWastageReason(e.target.value)}
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Right Panel */}
                                    <div className="w-[35%] h-full overflow-y-auto p-6 space-y-6 bg-slate-50/50 dark:bg-slate-900/10 border-l border-slate-200/50 dark:border-slate-800/50">
                                        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
                                            <h4 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                                                <Info className="w-3.5 h-3.5 text-blue-500" /> Material Profile
                                            </h4>
                                            <div className="space-y-3.5 text-xs">
                                                <div className="pb-3 border-b border-slate-100 dark:border-slate-800/80">
                                                    <span className="text-[9px] font-bold text-slate-400 block uppercase">Item Name</span>
                                                    <span className="font-bold text-slate-800 dark:text-slate-200 text-xs">{wastageItem.item.name}</span>
                                                </div>
                                                <div className="pb-3 border-b border-slate-100 dark:border-slate-800/80">
                                                    <span className="text-[9px] font-bold text-slate-400 block uppercase">Product Code</span>
                                                    <span className="font-mono font-bold text-slate-800 dark:text-slate-200 text-xs">{wastageItem.item.code}</span>
                                                </div>
                                                <div>
                                                    <span className="text-[9px] font-bold text-slate-400 block uppercase">Current Stock Available</span>
                                                    <span className="font-black text-slate-800 dark:text-slate-200 text-xs mt-0.5 block">{wastageItem.quantity} {wastageItem.item.unit}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Footer */}
                                <div className="px-6 py-4 bg-white dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 flex justify-end items-center flex-shrink-0 gap-3">
                                    <Button variant="outline" onClick={() => setWastageItem(null)} className="h-9 px-4 text-xs font-bold rounded-xl border-slate-200 hover:bg-slate-50 text-slate-700">
                                        Cancel
                                    </Button>
                                    <Button
                                        variant="destructive"
                                        onClick={() => wastageMutation.mutate()}
                                        disabled={!wastageQty || Number(wastageQty) <= 0 || wastageMutation.isPending}
                                        className="h-9 px-5 text-xs font-bold text-white rounded-xl shadow-sm"
                                    >
                                        {wastageMutation.isPending ? "Updating..." : "Confirm Wastage"}
                                    </Button>
                                </div>
                            </>
                        )}
                    </DialogContent>
                </Dialog>

                {/* Batches View Drawer - Premium Design */}
                <Dialog open={!!selectedItemForBatches} onOpenChange={(o) => { if (!o) setSelectedItemForBatches(null); }}>
                    <DialogContent 
                        showCloseButton={false}
                        className="fixed !inset-y-0 !right-0 !top-0 !left-auto !translate-x-0 !translate-y-0 !h-full w-[65vw] !max-w-none flex flex-col !p-0 !gap-0 overflow-hidden bg-white dark:bg-slate-950 border-l border-slate-200 dark:border-slate-800 shadow-2xl z-50 duration-300 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right !rounded-none"
                    >
                        {selectedItemForBatches && (
                            <>
                                {/* Header */}
                                <div className="relative p-6 pb-4 flex-shrink-0 bg-slate-50 dark:bg-slate-900/60 border-b border-slate-200/60 dark:border-slate-800/60">
                                    <div className="absolute top-0 right-0 p-5">
                                        <button 
                                            onClick={() => setSelectedItemForBatches(null)} 
                                            className="p-2 rounded-full hover:bg-slate-200/50 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                                        >
                                            <X className="w-4 h-4" />
                                        </button>
                                    </div>

                                    <div className="space-y-1">
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Inventory Valuation</span>
                                            <Badge className="bg-blue-50 text-blue-600 border border-blue-200 dark:bg-blue-955/20 text-[9px] px-2 py-0 font-bold rounded-full">
                                                Batch Registry
                                            </Badge>
                                        </div>
                                        <h2 className="text-xl font-black text-slate-900 dark:text-white leading-tight">
                                            {selectedItemForBatches.item.name}
                                        </h2>
                                        <p className="text-xs text-slate-500 dark:text-slate-400">
                                            Product Code: <span className="font-mono font-bold text-slate-700 dark:text-slate-300">{selectedItemForBatches.item.code}</span>
                                        </p>
                                    </div>
                                </div>

                                {/* Body Split */}
                                <div className="flex-1 flex overflow-hidden bg-slate-50/50 dark:bg-slate-950/20">
                                    {/* Left Panel */}
                                    <div className="w-[65%] h-full overflow-y-auto p-6 space-y-6 border-r border-slate-200/50 dark:border-slate-800/50 [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-slate-200 dark:[&::-webkit-scrollbar-thumb]:bg-slate-800/60 [&::-webkit-scrollbar-thumb]:rounded-full">
                                        <div className="space-y-3">
                                            <h3 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-2">
                                                <Layers className="w-3.5 h-3.5 text-blue-500" /> Active Inventory Batches
                                            </h3>

                                            <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm bg-white dark:bg-slate-950">
                                                <table className="w-full text-xs text-left border-collapse">
                                                    <thead className="bg-slate-50/80 dark:bg-slate-900/80 text-slate-500 dark:text-slate-400 font-bold border-b border-slate-200 dark:border-slate-800 text-[10px] uppercase tracking-wider">
                                                        <tr>
                                                            <th className="px-4 py-3">Batch Number / Received Date</th>
                                                            <th className="px-4 py-3">Received via</th>
                                                            <th className="px-4 py-3 text-right">Initial Qty</th>
                                                            <th className="px-4 py-3 text-right">Remaining Stock</th>
                                                            <th className="px-4 py-3 text-right">Cost Price (LKR)</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                                        {isLoadingBatches ? (
                                                            <tr><td colSpan={5} className="p-8 text-center text-slate-400 italic">Loading batches...</td></tr>
                                                        ) : itemBatches.length === 0 ? (
                                                            <tr><td colSpan={5} className="p-8 text-center text-slate-400 italic">No active batches for this item.</td></tr>
                                                        ) : (
                                                            itemBatches.map((b) => (
                                                                <tr key={b.id} className="hover:bg-slate-50/30 dark:hover:bg-slate-900/20 transition-colors duration-150">
                                                                    <td className="px-4 py-3.5">
                                                                        <div className="font-mono font-bold text-slate-700 dark:text-slate-300">{b.batch.batchNumber || 'N/A'}</div>
                                                                        <div className="text-[9px] text-slate-400 mt-0.5">Created: {safeFormat(b.batch.createdAt, 'yyyy-MM-dd')}</div>
                                                                    </td>
                                                                    <td className="px-4 py-3.5">
                                                                        {b.batch.grn?.grnNumber ? (
                                                                            <div className="flex flex-col">
                                                                                <span className="font-bold text-slate-700 dark:text-slate-300 text-xs">{b.batch.grn.grnNumber}</span>
                                                                                <span className="text-[9px] text-slate-400 mt-0.5">{safeFormat(b.batch.grn.createdAt, 'MMM dd, yyyy')}</span>
                                                                            </div>
                                                                        ) : 'Initial/Manual'}
                                                                    </td>
                                                                    <td className="px-4 py-3.5 text-right font-semibold text-slate-500">{b.batch.initialQty}</td>
                                                                    <td className="px-4 py-3.5 text-right font-black text-emerald-700 dark:text-emerald-500">{b.quantity}</td>
                                                                    <td className="px-4 py-3.5 text-right font-mono font-bold text-slate-800 dark:text-slate-200">
                                                                        {b.batch.costPrice?.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                                    </td>
                                                                </tr>
                                                            ))
                                                        )}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Right Panel */}
                                    <div className="w-[35%] h-full overflow-y-auto p-6 space-y-6 bg-slate-50/50 dark:bg-slate-900/10 border-l border-slate-200/50 dark:border-slate-800/50">
                                        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
                                            <h4 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                                                <TrendingUp className="w-3.5 h-3.5 text-blue-500" /> Summary Metrics
                                            </h4>
                                            <div className="space-y-3 text-xs pb-1">
                                                <div className="flex justify-between items-center py-1.5 border-b border-slate-100 dark:border-slate-800/80">
                                                    <span className="text-slate-500 dark:text-slate-400">Total Stock Available</span>
                                                    <span className="font-black text-slate-800 dark:text-slate-200">{selectedItemForBatches.quantity} {selectedItemForBatches.item.unit}</span>
                                                </div>
                                                <div className="flex justify-between items-center py-1.5">
                                                    <span className="text-slate-500 dark:text-slate-400">Active Batches</span>
                                                    <span className="font-black text-slate-800 dark:text-slate-200">{itemBatches.length}</span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="bg-amber-50 dark:bg-amber-955/15 border border-amber-250/50 dark:border-amber-900 p-4 rounded-2xl flex gap-3 text-amber-800 dark:text-amber-400">
                                            <History className="w-5 h-5 shrink-0 mt-0.5 text-amber-600 dark:text-amber-500" />
                                            <div className="space-y-1">
                                                <span className="text-[10px] font-black uppercase tracking-wider block">FIFO Valuation Policy</span>
                                                <p className="text-[10px] leading-normal text-slate-600 dark:text-slate-400">
                                                    Materials are automatically issued from the oldest batch first (top of this list)
                                                    to ensure accurate costing and inventory aging.
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Footer */}
                                <div className="px-6 py-4 bg-white dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 flex justify-end items-center flex-shrink-0 gap-3">
                                    <Button variant="outline" onClick={() => setSelectedItemForBatches(null)} className="h-9 px-4 text-xs font-bold rounded-xl border-slate-200 hover:bg-slate-50 text-slate-700">
                                        Close Batches
                                    </Button>
                                </div>
                            </>
                        )}
                    </DialogContent>
                </Dialog>

                {/* Serials View Drawer - Premium Design */}
                <Dialog open={!!selectedItemForSerials} onOpenChange={(o) => { if (!o) setSelectedItemForSerials(null); }}>
                    <DialogContent 
                        showCloseButton={false}
                        className="fixed !inset-y-0 !right-0 !top-0 !left-auto !translate-x-0 !translate-y-0 !h-full w-[65vw] !max-w-none flex flex-col !p-0 !gap-0 overflow-hidden bg-white dark:bg-slate-950 border-l border-slate-200 dark:border-slate-800 shadow-2xl z-50 duration-300 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right !rounded-none"
                    >
                        {selectedItemForSerials && (
                            <>
                                {/* Header */}
                                <div className="relative p-6 pb-4 flex-shrink-0 bg-slate-50 dark:bg-slate-900/60 border-b border-slate-200/60 dark:border-slate-800/60">
                                    <div className="absolute top-0 right-0 p-5">
                                        <button 
                                            onClick={() => setSelectedItemForSerials(null)} 
                                            className="p-2 rounded-full hover:bg-slate-200/50 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                                        >
                                            <X className="w-4 h-4" />
                                        </button>
                                    </div>

                                    <div className="space-y-1">
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Serial Tracker</span>
                                            <Badge className="bg-purple-50 text-purple-600 border border-purple-200 dark:bg-purple-955/20 text-[9px] px-2 py-0 font-bold rounded-full">
                                                Serialized Inventory
                                            </Badge>
                                        </div>
                                        <h2 className="text-xl font-black text-slate-900 dark:text-white leading-tight">
                                            {selectedItemForSerials.item.name}
                                        </h2>
                                        <p className="text-xs text-slate-500 dark:text-slate-400">
                                            Product Code: <span className="font-mono font-bold text-slate-700 dark:text-slate-300">{selectedItemForSerials.item.code}</span>
                                        </p>
                                    </div>
                                </div>

                                {/* Body Split */}
                                <div className="flex-1 flex overflow-hidden bg-slate-50/50 dark:bg-slate-950/20">
                                    {/* Left Panel */}
                                    <div className="w-[65%] h-full overflow-y-auto p-6 space-y-6 border-r border-slate-200/50 dark:border-slate-800/50 [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-slate-200 dark:[&::-webkit-scrollbar-thumb]:bg-slate-800/60 [&::-webkit-scrollbar-thumb]:rounded-full">
                                        <div className="space-y-3">
                                            <h3 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-2">
                                                <Layers className="w-3.5 h-3.5 text-purple-500" /> Active Serial Numbers
                                            </h3>

                                            <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm bg-white dark:bg-slate-950">
                                                <table className="w-full text-xs text-left border-collapse">
                                                    <thead className="bg-slate-50/80 dark:bg-slate-900/80 text-slate-500 dark:text-slate-400 font-bold border-b border-slate-200 dark:border-slate-800 text-[10px] uppercase tracking-wider">
                                                        <tr>
                                                            <th className="px-4 py-3">Serial Number</th>
                                                            <th className="px-4 py-3 text-center">Status</th>
                                                            <th className="px-4 py-3 text-right">Added Date</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                                        {isLoadingSerials ? (
                                                            <tr><td colSpan={3} className="p-8 text-center text-slate-400 italic">Loading serials...</td></tr>
                                                        ) : itemSerials.length === 0 ? (
                                                            <tr><td colSpan={3} className="p-8 text-center text-slate-400 italic">No active serial numbers in this store.</td></tr>
                                                        ) : (
                                                            itemSerials.map((s) => (
                                                                <tr key={s.id} className="hover:bg-slate-50/30 dark:hover:bg-slate-900/20 transition-colors duration-150">
                                                                    <td className="px-4 py-3.5 font-mono font-bold text-slate-700 dark:text-slate-300">
                                                                        {s.serialNumber}
                                                                    </td>
                                                                    <td className="px-4 py-3.5 text-center">
                                                                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-250/60 dark:bg-emerald-950/20 dark:text-emerald-400">
                                                                            {s.status}
                                                                        </span>
                                                                    </td>
                                                                    <td className="px-4 py-3.5 text-right font-mono font-semibold text-slate-400">
                                                                        {safeFormat(s.createdAt, 'yyyy-MM-dd')}
                                                                    </td>
                                                                </tr>
                                                            ))
                                                        )}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Right Panel */}
                                    <div className="w-[35%] h-full overflow-y-auto p-6 space-y-6 bg-slate-50/50 dark:bg-slate-900/10 border-l border-slate-200/50 dark:border-slate-800/50">
                                        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
                                            <h4 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                                                <TrendingUp className="w-3.5 h-3.5 text-purple-500" /> Summary Metrics
                                            </h4>
                                            <div className="space-y-3 text-xs pb-1">
                                                <div className="flex justify-between items-center py-1.5 border-b border-slate-100 dark:border-slate-800/80">
                                                    <span className="text-slate-500 dark:text-slate-400">Total In Stock</span>
                                                    <span className="font-black text-slate-800 dark:text-slate-200">{selectedItemForSerials.quantity} {selectedItemForSerials.item.unit}</span>
                                                </div>
                                                <div className="flex justify-between items-center py-1.5">
                                                    <span className="text-slate-500 dark:text-slate-400">Registered Serials</span>
                                                    <span className="font-black text-slate-800 dark:text-slate-200">{itemSerials.length}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Footer */}
                                <div className="px-6 py-4 bg-white dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 flex justify-end items-center flex-shrink-0 gap-3">
                                    <Button variant="outline" onClick={() => setSelectedItemForSerials(null)} className="h-9 px-4 text-xs font-bold rounded-xl border-slate-200 hover:bg-slate-50 text-slate-700">
                                        Close Tracker
                                    </Button>
                                </div>
                            </>
                        )}
                    </DialogContent>
                </Dialog>

            </main>
        </div>
    );
}

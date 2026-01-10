"use client";

import React, { useState, useEffect } from 'react';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Search, AlertTriangle, Trash2 } from "lucide-react";
import { toast } from 'sonner';

export default function StockPage() {
    const queryClient = useQueryClient();
    const [selectedStoreId, setSelectedStoreId] = useState("");
    const [searchTerm, setSearchTerm] = useState("");
    const [user, setUser] = useState<any>(null);

    // Wastage Modal
    const [wastageItem, setWastageItem] = useState<any>(null);
    const [wastageQty, setWastageQty] = useState("");
    const [wastageReason, setWastageReason] = useState("");

    useEffect(() => {
        const stored = localStorage.getItem('user');
        if (stored) setUser(JSON.parse(stored));
    }, []);

    // Fetch Stores
    const { data: stores = [] } = useQuery({
        queryKey: ['stores'],
        queryFn: async () => {
            const res = await fetch('/api/inventory/stores');
            return res.json();
        }
    });

    // Default Store Selection
    useEffect(() => {
        if (stores.length > 0 && !selectedStoreId) {
            setSelectedStoreId(stores[0].id);
        }
    }, [stores, selectedStoreId]);

    // Fetch Stock
    const { data: stock = [], isLoading } = useQuery({
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
            const res = await fetch('/api/inventory/wastage', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    storeId: selectedStoreId,
                    userId: user?.id,
                    items: [{ itemId: wastageItem.itemId, quantity: wastageQty }],
                    reason: wastageReason
                })
            });
            if (!res.ok) throw new Error('Failed');
        },
        onSuccess: () => {
            toast.success("Wastage recorded successfully");
            setWastageItem(null);
            setWastageQty("");
            setWastageReason("");
            queryClient.invalidateQueries({ queryKey: ['stock'] });
        },
        onError: () => toast.error("Failed to record wastage")
    });

    const filteredStock = Array.isArray(stock) ? stock.filter((s: any) =>
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
                                            {stores.map((s: any) => (
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
                                            <th className="px-4 py-3 text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                        {isLoading ? (
                                            <tr><td colSpan={5} className="p-8 text-center text-slate-400">Loading stock...</td></tr>
                                        ) : filteredStock.length === 0 ? (
                                            <tr><td colSpan={5} className="p-8 text-center text-slate-400">No stock found for this store.</td></tr>
                                        ) : (
                                            filteredStock.map((row: any) => (
                                                <tr key={row.id} className="hover:bg-slate-50">
                                                    <td className="px-4 py-2 font-mono text-slate-500">{row.item.code}</td>
                                                    <td className="px-4 py-2 font-bold text-slate-800">{row.item.name}</td>
                                                    <td className="px-4 py-2 text-center text-slate-500 bg-slate-50/50">{row.item.unit}</td>
                                                    <td className={`px-4 py-2 text-right font-bold ${row.quantity <= (row.minLevel || 0) ? 'text-red-600' : 'text-emerald-700'}`}>
                                                        {row.quantity}
                                                        {row.quantity <= (row.minLevel || 0) && <AlertTriangle className="w-3 h-3 inline ml-1 text-red-500" />}
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

            </main>
        </div>
    );
}

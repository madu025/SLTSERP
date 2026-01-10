"use client";

import React, { useState } from 'react';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, Loader2, FileText, ArrowLeft } from "lucide-react";
import { format } from "date-fns";
import { useRouter } from 'next/navigation';

export default function CardexReportPage() {
    const router = useRouter();
    const [selectedItemId, setSelectedItemId] = useState<string>("ALL");
    const [selectedStoreId, setSelectedStoreId] = useState<string>("ALL");
    const [searchTerm, setSearchTerm] = useState("");

    // Fetch Stores
    const { data: stores = [] } = useQuery({
        queryKey: ['stores'],
        queryFn: async () => (await fetch('/api/inventory/stores')).json()
    });

    // Fetch Items
    const { data: items = [] } = useQuery({
        queryKey: ['items'],
        queryFn: async () => (await fetch('/api/inventory/items')).json()
    });

    // Fetch Transactions
    const { data: transactions = [], isLoading } = useQuery({
        queryKey: ['transactions', selectedItemId, selectedStoreId],
        queryFn: async () => {
            const params = new URLSearchParams();
            if (selectedItemId !== 'ALL') params.append('itemId', selectedItemId);
            if (selectedStoreId !== 'ALL') params.append('storeId', selectedStoreId);
            return (await fetch(`/api/inventory/transactions?${params.toString()}`)).json();
        }
    });

    // Filter Items for Dropdown
    const filteredItems = Array.isArray(items) ? items.filter((i: any) =>
        i.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        i.code.toLowerCase().includes(searchTerm.toLowerCase())
    ) : [];

    // Helper to extract quantity of specific item from transaction
    const getItemQty = (tx: any, itemId: string) => {
        // If "ALL" items selected, we might want to list all items in the tx, but that's messy for a table.
        // If specific item selected, show its qty.
        if (itemId !== 'ALL') {
            const line = tx.items.find((i: any) => i.itemId === itemId);
            return line ? line.quantity : '-';
        }
        return tx.items.reduce((acc: number, curr: any) => acc + curr.quantity, 0); // Total items qty
    };

    return (
        <div className="h-screen flex bg-slate-50 overflow-hidden">
            <Sidebar />
            <main className="flex-1 flex flex-col min-w-0 h-full">
                <Header />
                <div className="flex-1 overflow-y-auto p-4 md:p-8">
                    <div className="max-w-6xl mx-auto space-y-6">

                        <div className="flex items-center gap-4 mb-4">
                            <Button variant="ghost" size="sm" onClick={() => router.back()}>
                                <ArrowLeft className="w-4 h-4 mr-2" /> Back
                            </Button>
                            <div>
                                <h1 className="text-2xl font-bold text-slate-900">Transaction History (Cardex)</h1>
                                <p className="text-slate-500 text-sm">Audit trail for inventory movements.</p>
                            </div>
                        </div>

                        {/* Filters */}
                        <Card>
                            <CardContent className="p-4 grid grid-cols-1 md:grid-cols-4 gap-4">
                                <div>
                                    <label className="text-xs font-bold text-slate-700 block mb-1">Store</label>
                                    <Select value={selectedStoreId} onValueChange={setSelectedStoreId}>
                                        <SelectTrigger className="text-xs bg-white"><SelectValue placeholder="All Stores" /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="ALL">All Stores</SelectItem>
                                            {stores.map((s: any) => (
                                                <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="md:col-span-2">
                                    <label className="text-xs font-bold text-slate-700 block mb-1">Item</label>
                                    <Select value={selectedItemId} onValueChange={setSelectedItemId}>
                                        <SelectTrigger className="text-xs bg-white"><SelectValue placeholder="Select Item to specific history" /></SelectTrigger>
                                        <SelectContent className="max-h-[300px]">
                                            <div className="p-2 sticky top-0 bg-white z-10 border-b">
                                                <Input
                                                    className="h-8 text-xs"
                                                    placeholder="Search item..."
                                                    value={searchTerm}
                                                    onChange={(e) => setSearchTerm(e.target.value)}
                                                    onKeyDown={(e) => e.stopPropagation()} // Prevent select closing
                                                />
                                            </div>
                                            <SelectItem value="ALL">All Items (Summary)</SelectItem>
                                            {filteredItems.map((i: any) => (
                                                <SelectItem key={i.id} value={i.id}>{i.code} - {i.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="flex items-end">
                                    <Button variant="outline" className="w-full text-xs" onClick={() => { setSelectedItemId("ALL"); setSelectedStoreId("ALL"); }}>
                                        Reset Filters
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Table */}
                        <Card className="min-h-[500px]">
                            <CardHeader className="py-4 border-b bg-slate-50/50">
                                <CardTitle className="text-sm">
                                    Movement History
                                    {selectedItemId !== 'ALL' && <span className="text-slate-500 font-normal ml-2"> for {items.find((i: any) => i.id === selectedItemId)?.name}</span>}
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-0">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="w-40">Date</TableHead>
                                            <TableHead className="w-32">Type</TableHead>
                                            <TableHead>Reference / Note</TableHead>
                                            <TableHead>Store</TableHead>
                                            <TableHead>User</TableHead>
                                            <TableHead className="text-right">Qty</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {isLoading ? (
                                            <TableRow>
                                                <TableCell colSpan={6} className="h-24 text-center text-slate-500">
                                                    <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />
                                                    Loading history...
                                                </TableCell>
                                            </TableRow>
                                        ) : !Array.isArray(transactions) || transactions.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={6} className="h-24 text-center text-slate-500">
                                                    No transactions found.
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            transactions.map((tx: any) => (
                                                <TableRow key={tx.id} className="hover:bg-slate-50">
                                                    <TableCell className="text-xs font-mono text-slate-500">
                                                        {format(new Date(tx.createdAt), 'yyyy-MM-dd HH:mm')}
                                                    </TableCell>
                                                    <TableCell className="text-xs font-bold">
                                                        <span className={`px-2 py-1 rounded-full text-[10px] 
                                                            ${tx.type === 'GRN_IN' ? 'bg-emerald-100 text-emerald-700' :
                                                                tx.type === 'WASTAGE' ? 'bg-red-100 text-red-700' :
                                                                    tx.type === 'TRANSFER_IN' ? 'bg-blue-100 text-blue-700' :
                                                                        tx.type === 'TRANSFER_OUT' ? 'bg-orange-100 text-orange-700' : 'bg-slate-100 text-slate-700'
                                                            }`}>
                                                            {tx.type.replace('_', ' ')}
                                                        </span>
                                                    </TableCell>
                                                    <TableCell className="text-xs">
                                                        {/* Show Ref ID or items summary if ALL selected */}
                                                        {selectedItemId === 'ALL' ? (
                                                            <div className="truncate max-w-xs text-slate-500">
                                                                {tx.items.length} items (e.g. {tx.items[0]?.item.name}...)
                                                            </div>
                                                        ) : (
                                                            <span className="text-slate-500 font-mono text-[10px]">{tx.id.slice(-8)}</span>
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="text-xs">{tx.store.name}</TableCell>
                                                    <TableCell className="text-xs text-slate-500">{tx.user?.name || '-'}</TableCell>
                                                    <TableCell className={`text-xs text-right font-bold ${['GRN_IN', 'TRANSFER_IN'].includes(tx.type) ? 'text-emerald-600' : 'text-red-500'
                                                        }`}>
                                                        {['GRN_IN', 'TRANSFER_IN'].includes(tx.type) ? '+' : '-'}
                                                        {getItemQty(tx, selectedItemId)}
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        )}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>

                    </div>
                </div>
            </main>
        </div>
    );
}

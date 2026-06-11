"use client";

import React, { useState } from 'react';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, ArrowLeft, FileText } from "lucide-react";
import { safeFormat } from "@/lib/utils";
import { useRouter } from 'next/navigation';
import { cn } from "@/lib/utils";

interface Store {
    id: string;
    name: string;
}

interface Item {
    id: string;
    name: string;
    code: string;
}

interface Transaction {
    id: string;
    date: string;
    createdAt?: string;
    type: string;
    items: Array<{ itemId: string; quantity: number; item: { name: string } }>;
    store: { name: string };
    user?: { name: string };
}

export default function CardexReportPage() {
    const router = useRouter();
    const [selectedItemId, setSelectedItemId] = useState<string>("ALL");
    const [selectedStoreId, setSelectedStoreId] = useState<string>("ALL");
    const [searchTerm, setSearchTerm] = useState("");

    const { data: stores = [] } = useQuery<Store[]>({
        queryKey: ['stores'],
        queryFn: async () => (await fetch('/api/inventory/stores')).json()
    });

    const { data: items = [] } = useQuery<Item[]>({
        queryKey: ['items'],
        queryFn: async () => (await fetch('/api/inventory/items')).json()
    });

    const { data: transactions = [], isLoading } = useQuery<Transaction[]>({
        queryKey: ['transactions', selectedItemId, selectedStoreId],
        queryFn: async () => {
            const params = new URLSearchParams();
            if (selectedItemId !== 'ALL') params.append('itemId', selectedItemId);
            if (selectedStoreId !== 'ALL') params.append('storeId', selectedStoreId);
            return (await fetch(`/api/inventory/transactions?${params.toString()}`)).json();
        }
    });

    const filteredItems = Array.isArray(items) ? items.filter((i: Item) =>
        i.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        i.code.toLowerCase().includes(searchTerm.toLowerCase())
    ) : [];

    const getItemQty = (tx: Transaction, itemId: string) => {
        if (itemId !== 'ALL') {
            const line = tx.items.find((i) => i.itemId === itemId);
            return line ? line.quantity : '-';
        }
        return tx.items.reduce((acc: number, curr) => acc + curr.quantity, 0);
    };

    return (
        <div className="erp-page-wrapper flex-row overflow-hidden">
            <Sidebar />
            <main className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
                <Header />
                <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
                    <div className="max-w-7xl mx-auto space-y-4">

                        {/* Page Header */}
                        <div className="flex items-center gap-3">
                            <Button variant="outline" size="sm" onClick={() => router.back()} className="h-8 w-8 p-0 rounded-lg border-slate-200 text-slate-500 hover:text-slate-700 transition-all flex items-center justify-center">
                                <ArrowLeft className="w-4 h-4" />
                            </Button>
                            <div className="space-y-0.5">
                                <h1 className="text-xl font-black text-slate-900 tracking-tight">Transaction History (Cardex)</h1>
                                <p className="text-xs text-slate-500">Audit trail for warehouse inventory movements.</p>
                            </div>
                        </div>

                        {/* Filters Toolbar */}
                        <Card className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                            <CardContent className="p-3 grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
                                <div className="space-y-1">
                                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider block ml-0.5">Store</label>
                                    <Select value={selectedStoreId} onValueChange={setSelectedStoreId}>
                                        <SelectTrigger className="h-8 text-xs bg-slate-50 border-none rounded-lg"><SelectValue placeholder="All Stores" /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="ALL">All Stores</SelectItem>
                                            {stores.map((s) => (
                                                <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="md:col-span-2 space-y-1">
                                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider block ml-0.5">Item Search & Filter</label>
                                    <Select value={selectedItemId} onValueChange={setSelectedItemId}>
                                        <SelectTrigger className="h-8 text-xs bg-slate-50 border-none rounded-lg"><SelectValue placeholder="Select Item to specific history" /></SelectTrigger>
                                        <SelectContent className="max-h-[250px]">
                                            <div className="p-1.5 sticky top-0 bg-white z-10 border-b">
                                                <Input
                                                    className="h-8 text-xs"
                                                    placeholder="Search item..."
                                                    value={searchTerm}
                                                    onChange={(e) => setSearchTerm(e.target.value)}
                                                    onKeyDown={(e) => e.stopPropagation()}
                                                />
                                            </div>
                                            <SelectItem value="ALL">All Items (Summary)</SelectItem>
                                            {filteredItems.map((i) => (
                                                <SelectItem key={i.id} value={i.id}>{i.code} - {i.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div>
                                    <Button variant="outline" className="h-8 w-full border-slate-200 text-slate-600 hover:bg-slate-50 transition-all font-bold text-xs rounded-lg" onClick={() => { setSelectedItemId("ALL"); setSelectedStoreId("ALL"); setSearchTerm(""); }}>
                                        Reset Filters
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Transaction Table */}
                        <div className="erp-table-container">
                            {isLoading ? (
                                <div className="py-20 flex flex-col items-center justify-center text-slate-400 gap-4">
                                    <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                                    <p className="text-[10px] font-black uppercase tracking-wider animate-pulse">Loading history...</p>
                                </div>
                            ) : !Array.isArray(transactions) || transactions.length === 0 ? (
                                <div className="py-20 flex flex-col items-center justify-center bg-white rounded-xl border border-dashed border-slate-200 text-slate-400">
                                    <FileText className="w-10 h-10 opacity-20 mb-3" />
                                    <p className="text-xs font-bold">No transactions found matching criteria.</p>
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr>
                                                <th className="w-36">Date</th>
                                                <th className="w-28">Type</th>
                                                <th>Reference ID / Details</th>
                                                <th>Store</th>
                                                <th>Operator</th>
                                                <th className="text-right pr-6 w-24">Qty</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 bg-white">
                                            {transactions.map((tx) => (
                                                <tr key={tx.id} className="hover:bg-slate-50/50 transition-colors">
                                                    <td className="font-mono text-slate-400 text-[10px]">
                                                        {safeFormat(tx.date || tx.createdAt, 'yyyy-MM-dd HH:mm')}
                                                    </td>
                                                    <td>
                                                        <span className={cn(
                                                            "px-2 py-0.5 rounded border text-[9px] font-black uppercase tracking-wider leading-none",
                                                            tx.type === 'GRN_IN' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                                                            tx.type === 'WASTAGE' ? 'bg-red-50 text-red-700 border-red-100' :
                                                            tx.type === 'TRANSFER_IN' ? 'bg-blue-50 text-blue-700 border-blue-100' :
                                                            tx.type === 'TRANSFER_OUT' ? 'bg-amber-50 text-amber-700 border-amber-100' : 
                                                            'bg-slate-50 text-slate-600 border-slate-100'
                                                        )}>
                                                            {tx.type.replace('_', ' ')}
                                                        </span>
                                                    </td>
                                                    <td>
                                                        {selectedItemId === 'ALL' ? (
                                                            <div className="truncate max-w-xs text-slate-500 font-medium">
                                                                {tx.items.length} items (e.g. {tx.items[0]?.item.name}...)
                                                            </div>
                                                        ) : (
                                                            <span className="text-slate-500 font-mono font-bold text-[10px]">{tx.id.slice(-8).toUpperCase()}</span>
                                                        )}
                                                    </td>
                                                    <td className="text-slate-700 font-medium">{tx.store.name}</td>
                                                    <td className="text-slate-500 font-medium">{tx.user?.name || '-'}</td>
                                                    <td className={cn(
                                                        "text-right pr-6 font-bold font-mono text-xs",
                                                        ['GRN_IN', 'TRANSFER_IN'].includes(tx.type) ? 'text-emerald-600' : 'text-red-500'
                                                    )}>
                                                        {['GRN_IN', 'TRANSFER_IN'].includes(tx.type) ? '+' : '-'}
                                                        {getItemQty(tx, selectedItemId)}
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
        </div>
    );
}

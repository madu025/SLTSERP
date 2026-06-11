"use client";

import React, { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Trash, Plus, Undo2, Loader2, ArrowLeft } from "lucide-react";
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';

interface ContractorItem {
    id: string;
    name: string;
}

interface ContractorStockItem {
    itemCode: string;
    quantity: number;
}

interface InventoryItem {
    id: string;
    code: string;
    name: string;
    unit: string;
}

interface ContractorsApiResponse {
    contractors?: ContractorItem[];
    data?: {
        contractors: ContractorItem[];
    };
}

interface ReturnPayload {
    contractorId: string;
    storeId: string;
    month: string;
    reason?: string;
    items: Array<{
        itemId: string;
        quantity: number;
        unit?: string;
        condition: string;
    }>;
}

export default function MaterialReturnPage() {
    const router = useRouter();

    // Form State
    const [selectedContractor, setSelectedContractor] = useState<string>('');
    const [selectedStore, setSelectedStore] = useState<string>('');
    const [month, setMonth] = useState<string>(new Date().toISOString().slice(0, 7)); // YYYY-MM
    const [reason, setReason] = useState<string>('');

    // Items State
    const [rows, setRows] = useState<Array<{ itemId: string; quantity: number; unit: string; condition: string; name: string }>>([
        { itemId: '', quantity: 0, unit: '', condition: 'GOOD', name: '' }
    ]);

    // --- FETCH DATA ---
    const { data: contractorsData } = useQuery<ContractorsApiResponse>({
        queryKey: ['contractors'],
        queryFn: async () => (await fetch('/api/contractors?page=1&limit=1000')).json()
    });
    
    const contractors: ContractorItem[] = Array.isArray(contractorsData?.contractors) 
        ? contractorsData.contractors 
        : Array.isArray(contractorsData?.data?.contractors)
            ? contractorsData.data.contractors
            : [];

    const { data: stores = [] } = useQuery<Array<{ id: string; name: string }>>({
        queryKey: ['stores'],
        queryFn: async () => (await fetch('/api/stores')).json()
    });

    const { data: items = [] } = useQuery<InventoryItem[]>({
        queryKey: ['inventory-items'],
        queryFn: async () => (await fetch('/api/inventory/items')).json()
    });

    // Fetch selected contractor's in-hand stock
    const { data: contractorStock = [] } = useQuery<ContractorStockItem[]>({
        queryKey: ['contractor-stock', selectedContractor],
        queryFn: async () => {
            if (!selectedContractor) return [];
            const res = await fetch(`/api/inventory/in-hand-stock?contractorId=${selectedContractor}`);
            if (!res.ok) throw new Error("Failed to fetch contractor stock");
            return res.json();
        },
        enabled: !!selectedContractor
    });

    const getContractorItemQty = (itemId: string) => {
        const item = items.find((i) => i.id === itemId);
        if (!item) return 0;
        const stock = contractorStock.find((s) => s.itemCode === item.code);
        return stock ? stock.quantity : 0;
    };

    // --- MUTATION ---
    const returnMutation = useMutation({
        mutationFn: async (data: ReturnPayload) => {
            const res = await fetch('/api/inventory/returns', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.message || 'Failed to process return');
            }
            return res.json();
        },
        onSuccess: () => {
            toast.success("Materials returned successfully!");
            // Reset form
            setRows([{ itemId: '', quantity: 0, unit: '', condition: 'GOOD', name: '' }]);
            setReason('');
            setSelectedContractor('');
            setSelectedStore('');
        },
        onError: (err: Error) => {
            toast.error(err.message);
        }
    });

    // --- HANDLERS ---
    const handleAddRow = () => {
        setRows([...rows, { itemId: '', quantity: 0, unit: '', condition: 'GOOD', name: '' }]);
    };

    const handleRemoveRow = (idx: number) => {
        if (rows.length === 1) return;
        setRows(rows.filter((_, i) => i !== idx));
    };

    const handleItemChange = (idx: number, itemId: string) => {
        const item = items.find((i) => i.id === itemId);
        const newRows = [...rows];
        newRows[idx] = {
            ...newRows[idx],
            itemId,
            name: item?.name || '',
            unit: item?.unit || 'Nos'
        };
        setRows(newRows);
    };

    const handleUpdateRow = (idx: number, field: keyof typeof rows[0], value: string | number) => {
        const newRows = [...rows];
        const row = { ...newRows[idx] };
        if (field === 'quantity') {
            row.quantity = typeof value === 'string' ? parseFloat(value) || 0 : (value as number);
        } else if (field === 'itemId') {
            row.itemId = value as string;
        } else if (field === 'unit') {
            row.unit = value as string;
        } else if (field === 'condition') {
            row.condition = value as string;
        } else if (field === 'name') {
            row.name = value as string;
        }
        newRows[idx] = row;
        setRows(newRows);
    };

    const handleSubmit = () => {
        if (!selectedContractor || !selectedStore) {
            toast.error("Please select Contractor and Store");
            return;
        }

        // Validate items
        const validItems = rows.filter(r => r.itemId && r.quantity > 0);
        if (validItems.length === 0) {
            toast.error("Please add at least one valid item");
            return;
        }

        // Validate contractor stock availability
        const invalidStockItems = validItems.filter(row => {
            const available = getContractorItemQty(row.itemId);
            return row.quantity > available;
        });

        if (invalidStockItems.length > 0) {
            const itemNames = invalidStockItems.map(row => {
                const item = items.find((i) => i.id === row.itemId);
                return `${item?.code || row.itemId} (Returned: ${row.quantity}, Contractor Stock: ${getContractorItemQty(row.itemId)})`;
            });
            toast.error(`Quantity returned exceeds contractor available stock for: ${itemNames.join(", ")}`);
            return;
        }

        returnMutation.mutate({
            contractorId: selectedContractor,
            storeId: selectedStore,
            month,
            reason,
            items: validItems.map(r => ({
                itemId: r.itemId,
                quantity: r.quantity,
                unit: r.unit,
                condition: r.condition
            }))
        });
    };

    return (
        <div className="erp-page-wrapper flex-row overflow-hidden">
            <Sidebar />
            <main className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
                <Header />
                <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
                    <div className="max-w-5xl mx-auto space-y-4">

                        {/* Top bar */}
                        <div className="flex justify-between items-center">
                            <div className="space-y-0.5">
                                <h1 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                                    <Button variant="ghost" size="icon" className="h-7 w-7 rounded-md" onClick={() => router.back()}>
                                        <ArrowLeft className="w-4 h-4" />
                                    </Button>
                                    Return Materials from Contractor
                                </h1>
                                <p className="text-xs text-slate-500">Log unused or damaged materials returned by contractors to the store</p>
                            </div>
                        </div>

                        {/* Return details card */}
                        <Card className="border border-slate-200 bg-white rounded-xl shadow-sm">
                            <CardHeader className="p-3 border-b border-slate-100">
                                <CardTitle className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Return Details</CardTitle>
                            </CardHeader>
                            <CardContent className="p-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div className="space-y-3">
                                    {/* Contractor */}
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Contractor *</label>
                                        <select
                                            className="flex h-8 w-full rounded border-slate-200 border bg-white px-2 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                                            value={selectedContractor}
                                            onChange={(e) => setSelectedContractor(e.target.value)}
                                        >
                                            <option value="">Select Contractor...</option>
                                            {contractors.map((c) => (
                                                <option key={c.id} value={c.id}>{c.name}</option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* Store */}
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Store *</label>
                                        <select
                                            className="flex h-8 w-full rounded border-slate-200 border bg-white px-2 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                                            value={selectedStore}
                                            onChange={(e) => setSelectedStore(e.target.value)}
                                        >
                                            <option value="">Select Store...</option>
                                            {stores.map((s) => (
                                                <option key={s.id} value={s.id}>{s.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    {/* Month */}
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Month *</label>
                                        <Input
                                            type="month"
                                            value={month}
                                            onChange={(e) => setMonth(e.target.value)}
                                            className="h-8 text-xs border-slate-200"
                                        />
                                    </div>
                                    {/* Reason */}
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Reason / Note</label>
                                        <Textarea
                                            placeholder="Reason for return..."
                                            value={reason}
                                            onChange={(e) => setReason(e.target.value)}
                                            className="h-8 text-xs border-slate-200 resize-none px-3 py-1.5 min-h-[32px]"
                                            rows={1}
                                        />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Items breakdown list */}
                        <div className="erp-table-container flex flex-col bg-white overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="w-full text-xs text-left border-collapse">
                                    <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                                        <tr>
                                            <th className="px-4 py-2 font-semibold">Item Name</th>
                                            <th className="px-3 py-2 font-semibold w-56">Unit / Contractor Stock</th>
                                            <th className="px-3 py-2 font-semibold w-40">Condition</th>
                                            <th className="px-3 py-2 text-right font-semibold w-32">Return Qty</th>
                                            <th className="px-4 py-2 text-center font-semibold w-16">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {rows.map((row, idx) => (
                                            <tr key={idx} className="hover:bg-slate-50/50 transition-colors duration-150">
                                                <td className="px-3 py-1.5">
                                                    <select
                                                        className="w-full h-7 rounded border-transparent bg-transparent hover:border-slate-200 focus:border-blue-500 focus:bg-white text-xs px-1 -ml-1 focus:outline-none"
                                                        value={row.itemId}
                                                        onChange={(e) => handleItemChange(idx, e.target.value)}
                                                    >
                                                        <option value="">Select Item...</option>
                                                        {items.map((item) => (
                                                            <option key={item.id} value={item.id}>
                                                                {item.code} - {item.name}
                                                            </option>
                                                        ))}
                                                    </select>
                                                </td>
                                                <td className="px-3 py-1.5">
                                                    <div className="flex items-center gap-1.5">
                                                        {row.itemId && (
                                                            <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-slate-200 text-slate-600 bg-white">
                                                                {row.unit || 'Nos'}
                                                            </Badge>
                                                        )}
                                                        {selectedContractor && row.itemId && (
                                                            <Badge
                                                                variant="outline"
                                                                className={`text-[9px] px-1.5 py-0 font-bold ${
                                                                    getContractorItemQty(row.itemId) > 0
                                                                        ? "border-blue-200 text-blue-700 bg-blue-50/50"
                                                                        : "border-rose-200 text-rose-700 bg-rose-50/50"
                                                                }`}
                                                            >
                                                                In Contractor Stock: {getContractorItemQty(row.itemId)}
                                                            </Badge>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-3 py-1.5">
                                                    <select
                                                        className="h-7 rounded border-transparent bg-transparent hover:border-slate-200 focus:border-blue-500 focus:bg-white text-xs px-1 focus:outline-none"
                                                        value={row.condition}
                                                        onChange={(e) => handleUpdateRow(idx, 'condition', e.target.value)}
                                                    >
                                                        <option value="GOOD">Good</option>
                                                        <option value="DAMAGED">Damaged</option>
                                                        <option value="FAULTY">Faulty</option>
                                                    </select>
                                                </td>
                                                <td className="px-3 py-1.5">
                                                    <Input
                                                        type="number"
                                                        className="h-6 w-24 text-right ml-auto text-xs border-transparent hover:border-slate-200 focus:border-blue-500 bg-transparent focus:bg-white"
                                                        placeholder="0"
                                                        value={row.quantity || ''}
                                                        onChange={(e) => handleUpdateRow(idx, 'quantity', e.target.value)}
                                                        min="0"
                                                    />
                                                </td>
                                                <td className="px-4 py-1.5 text-center">
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => handleRemoveRow(idx)}
                                                        className="h-7 w-7 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md"
                                                    >
                                                        <Trash className="w-3.5 h-3.5" />
                                                    </Button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Add Row and Save block */}
                        <div className="flex justify-between items-center bg-slate-50 p-3 rounded-xl border border-slate-200/60">
                            <Button variant="outline" size="sm" className="h-8 text-xs font-semibold border-slate-200 bg-white" onClick={handleAddRow}>
                                <Plus className="w-3.5 h-3.5 mr-1" /> Add Row
                            </Button>
                            
                            <div className="flex gap-2">
                                <Button variant="outline" size="sm" className="h-8 text-xs font-semibold bg-white border-slate-200" onClick={() => router.back()}>
                                    Cancel
                                </Button>
                                <Button
                                    onClick={handleSubmit}
                                    disabled={returnMutation.isPending}
                                    size="sm"
                                    className="h-8 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-sm"
                                >
                                    {returnMutation.isPending ? (
                                        <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                                    ) : (
                                        <Undo2 className="w-3.5 h-3.5 mr-1" />
                                    )}
                                    Submit Return ({rows.filter(r => r.itemId && r.quantity > 0).length})
                                </Button>
                            </div>
                        </div>

                    </div>
                </div>
            </main>
        </div>
    );
}

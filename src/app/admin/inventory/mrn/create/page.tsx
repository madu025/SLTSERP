"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Plus, Trash2, Send, Loader2 } from "lucide-react";
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';

interface InventoryItem {
    id: string;
    code: string;
    name: string;
    unit: string;
    category: string;
}

interface ReturnItem {
    itemId: string;
    quantity: string;
    reason: string;
}

interface StoreItem {
    id: string;
    name: string;
    type: string;
}

interface MRNPayload {
    storeId: string;
    returnType: string;
    returnTo: string;
    supplier: string | null;
    reason: string | null;
    returnedById: string | null;
    items: Array<{
        itemId: string;
        quantity: number;
        reason: string | null;
    }>;
}

export default function MRNCreatePage() {
    const queryClient = useQueryClient();
    const [selectedStore, setSelectedStore] = useState<string>("");
    const [returnType, setReturnType] = useState<string>("DEFECTIVE");
    const [returnTo, setReturnTo] = useState<string>("SLT");
    const [supplier, setSupplier] = useState<string>("");
    const [generalReason, setGeneralReason] = useState<string>("");
    const [returnItems, setReturnItems] = useState<ReturnItem[]>([]);

    // Fetch stores
    const { data: stores = [] } = useQuery<StoreItem[]>({
        queryKey: ["stores"],
        queryFn: async () => {
            const res = await fetch("/api/stores");
            return res.json();
        }
    });

    // Fetch all inventory items
    const { data: items = [] } = useQuery<InventoryItem[]>({
        queryKey: ["inventory-items"],
        queryFn: async () => {
            const res = await fetch("/api/inventory/items");
            return res.json();
        }
    });

    const getCurrentUserId = () => {
        const user = localStorage.getItem('user');
        if (user) {
            return JSON.parse(user).id;
        }
        return null;
    };

    const createMRNMutation = useMutation({
        mutationFn: async (data: MRNPayload) => {
            const res = await fetch("/api/inventory/mrn", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data)
            });
            if (!res.ok) throw new Error("Failed to create MRN");
            return res.json();
        },
        onSuccess: (data) => {
            toast.success(`MRN created! #${data.mrnNumber}`);
            queryClient.invalidateQueries({ queryKey: ["mrns"] });
            // Reset form
            setReturnItems([]);
            setSelectedStore("");
            setGeneralReason("");
            setSupplier("");
        },
        onError: () => toast.error("Failed to create MRN")
    });

    const addNewRow = () => {
        setReturnItems([...returnItems, { itemId: "", quantity: "", reason: "" }]);
    };

    const removeItem = (index: number) => {
        setReturnItems(returnItems.filter((_, i) => i !== index));
    };

    const updateItem = (index: number, field: keyof ReturnItem, value: string) => {
        const updated = [...returnItems];
        updated[index][field] = value;
        setReturnItems(updated);
    };

    const handleSubmit = () => {
        if (!selectedStore) {
            toast.error("Please select a store");
            return;
        }

        const userId = getCurrentUserId();
        if (!userId) {
            toast.error("User not authenticated");
            return;
        }

        const validItems = returnItems.filter(
            item => item.itemId && item.quantity && parseFloat(item.quantity) > 0
        );

        if (validItems.length === 0) {
            toast.error("Please add at least one item");
            return;
        }

        const payload = {
            storeId: selectedStore,
            returnType,
            returnTo,
            supplier: supplier || null,
            reason: generalReason || null,
            returnedById: userId,
            items: validItems.map(item => ({
                itemId: item.itemId,
                quantity: parseFloat(item.quantity),
                reason: item.reason || null
            }))
        };

        createMRNMutation.mutate(payload);
    };

    const getItemDetails = (itemId: string) => {
        return items.find(i => i.id === itemId);
    };

    return (
        <div className="erp-page-wrapper flex-row overflow-hidden">
            <Sidebar />
            <main className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
                <Header />
                <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
                    <div className="max-w-7xl mx-auto space-y-4">

                        {/* Header */}
                        <div className="flex justify-between items-center">
                            <div className="space-y-0.5">
                                <h1 className="text-xl font-black text-slate-900 tracking-tight">Material Return Note (MRN)</h1>
                                <p className="text-xs text-slate-500">Return defective, excess, or unused materials</p>
                            </div>
                            <div className="flex gap-2">
                                <Button onClick={addNewRow} variant="outline" size="sm" className="h-8 text-xs font-semibold rounded-md border border-slate-200 bg-white">
                                    <Plus className="w-3.5 h-3.5 mr-1" />
                                    Add Item
                                </Button>
                                <Button
                                    onClick={handleSubmit}
                                    disabled={createMRNMutation.isPending || returnItems.length === 0}
                                    size="sm"
                                    className="bg-blue-600 hover:bg-blue-700 h-8 text-xs font-bold text-white rounded-md shadow-sm"
                                >
                                    {createMRNMutation.isPending ? (
                                        <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                                    ) : (
                                        <Send className="w-3.5 h-3.5 mr-1" />
                                    )}
                                    Submit MRN ({returnItems.length})
                                </Button>
                            </div>
                        </div>

                        {/* MRN Details */}
                        <Card className="border border-slate-200 bg-white rounded-xl shadow-sm">
                            <CardContent className="p-3 space-y-3">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                    {/* Store */}
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Store *</label>
                                        <select
                                            className="flex h-8 w-full rounded border-slate-200 border bg-white px-2 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                                            value={selectedStore}
                                            onChange={(e) => setSelectedStore(e.target.value)}
                                        >
                                            <option value="">Select Store...</option>
                                            {stores.map((store) => (
                                                <option key={store.id} value={store.id}>{store.name}</option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* Return Type */}
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Return Type *</label>
                                        <select
                                            className="flex h-8 w-full rounded border-slate-200 border bg-white px-2 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                                            value={returnType}
                                            onChange={(e) => setReturnType(e.target.value)}
                                        >
                                            <option value="DEFECTIVE">Defective</option>
                                            <option value="EXCESS">Excess</option>
                                            <option value="UNUSED">Unused</option>
                                            <option value="WRONG_DELIVERY">Wrong Delivery</option>
                                        </select>
                                    </div>

                                    {/* Return To */}
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Return To *</label>
                                        <select
                                            className="flex h-8 w-full rounded border-slate-200 border bg-white px-2 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                                            value={returnTo}
                                            onChange={(e) => setReturnTo(e.target.value)}
                                        >
                                            <option value="SLT">SLT</option>
                                            <option value="SUPPLIER">Supplier</option>
                                            <option value="MAIN_STORE">Main Store</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    {/* Supplier */}
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Supplier (if applicable)</label>
                                        <Input
                                            placeholder="Enter supplier name"
                                            value={supplier}
                                            onChange={(e) => setSupplier(e.target.value)}
                                            className="h-8 text-xs border-slate-200"
                                        />
                                    </div>

                                    {/* General Reason */}
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">General Reason</label>
                                        <Textarea
                                            placeholder="Describe reason for return..."
                                            value={generalReason}
                                            onChange={(e) => setGeneralReason(e.target.value)}
                                            className="h-8 text-xs border-slate-200 resize-none px-3 py-1.5 min-h-[32px]"
                                            rows={1}
                                        />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Items Table */}
                        <div className="erp-table-container flex flex-col bg-white overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="w-full text-xs text-left border-collapse">
                                    <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                                        <tr>
                                            <th className="px-4 py-2 w-8 text-center">#</th>
                                            <th className="px-3 py-2 font-semibold">Item</th>
                                            <th className="px-3 py-2 font-semibold w-24">Unit</th>
                                            <th className="px-3 py-2 text-right font-semibold w-32">Return Qty</th>
                                            <th className="px-3 py-2 font-semibold">Item Reason</th>
                                            <th className="px-4 py-2 text-center font-semibold w-16">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {returnItems.length === 0 ? (
                                            <tr>
                                                <td colSpan={6} className="px-4 py-8 text-center text-slate-400 font-semibold text-xs">
                                                    No items added. Click &quot;Add Item&quot; to start.
                                                </td>
                                            </tr>
                                        ) : (
                                            returnItems.map((item, index) => {
                                                const itemDetails = getItemDetails(item.itemId);
                                                return (
                                                    <tr key={index} className="hover:bg-slate-50/50 transition-colors duration-150">
                                                        <td className="px-4 py-1.5 text-slate-500 text-center">{index + 1}</td>
                                                        <td className="px-3 py-1.5">
                                                            <select
                                                                className="w-full h-7 rounded border-transparent bg-transparent hover:border-slate-200 focus:border-blue-500 focus:bg-white text-xs px-1 -ml-1 focus:outline-none"
                                                                value={item.itemId}
                                                                onChange={(e) => updateItem(index, 'itemId', e.target.value)}
                                                            >
                                                                <option value="">Select Item...</option>
                                                                {items.map((invItem) => (
                                                                    <option key={invItem.id} value={invItem.id}>
                                                                        {invItem.code} - {invItem.name}
                                                                    </option>
                                                                ))}
                                                            </select>
                                                        </td>
                                                        <td className="px-3 py-1.5">
                                                            {itemDetails && (
                                                                <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-slate-200 text-slate-600 bg-white">
                                                                    {itemDetails.unit}
                                                                </Badge>
                                                            )}
                                                        </td>
                                                        <td className="px-3 py-1.5">
                                                            <Input
                                                                type="number"
                                                                className="h-6 w-24 text-right ml-auto text-xs border-transparent hover:border-slate-200 focus:border-blue-500 bg-transparent focus:bg-white"
                                                                placeholder="0"
                                                                value={item.quantity}
                                                                onChange={(e) => updateItem(index, 'quantity', e.target.value)}
                                                                min="0"
                                                                step="1"
                                                            />
                                                        </td>
                                                        <td className="px-3 py-1.5">
                                                            <Input
                                                                className="h-6 text-xs px-2 border-transparent hover:border-slate-200 focus:border-blue-500 bg-transparent focus:bg-white w-full"
                                                                placeholder="Reason..."
                                                                value={item.reason}
                                                                onChange={(e) => updateItem(index, 'reason', e.target.value)}
                                                            />
                                                        </td>
                                                        <td className="px-4 py-1.5 text-center">
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                onClick={() => removeItem(index)}
                                                                className="h-7 w-7 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md"
                                                            >
                                                                <Trash2 className="w-3.5 h-3.5" />
                                                            </Button>
                                                        </td>
                                                    </tr>
                                                );
                                            })
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Info */}
                        <div className="bg-amber-50/50 border border-amber-200/60 rounded-xl p-3 text-amber-800">
                            <p className="text-xs">
                                <strong>Note:</strong> MRN requires approval before stock is reduced. Status: PENDING → APPROVED → Stock Reduced
                            </p>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}

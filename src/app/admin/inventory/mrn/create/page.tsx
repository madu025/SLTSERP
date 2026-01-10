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

export default function MRNCreatePage() {
    const queryClient = useQueryClient();
    const [selectedStore, setSelectedStore] = useState<string>("");
    const [returnType, setReturnType] = useState<string>("DEFECTIVE");
    const [returnTo, setReturnTo] = useState<string>("SLT");
    const [supplier, setSupplier] = useState<string>("");
    const [generalReason, setGeneralReason] = useState<string>("");
    const [returnItems, setReturnItems] = useState<ReturnItem[]>([]);

    // Fetch stores
    const { data: stores = [] } = useQuery({
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
        mutationFn: async (data: any) => {
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
        <div className="flex h-screen bg-slate-50 overflow-hidden">
            <Sidebar />
            <main className="flex-1 flex flex-col min-w-0 h-full">
                <Header />
                <div className="flex-1 overflow-y-auto p-6">
                    <div className="max-w-6xl mx-auto space-y-4">

                        {/* Header */}
                        <div className="flex justify-between items-center">
                            <div>
                                <h1 className="text-xl font-bold text-slate-900">Material Return Note (MRN)</h1>
                                <p className="text-sm text-slate-500">Return defective, excess, or unused materials</p>
                            </div>
                            <div className="flex gap-2">
                                <Button onClick={addNewRow} variant="outline" size="sm">
                                    <Plus className="w-4 h-4 mr-1" />
                                    Add Item
                                </Button>
                                <Button
                                    onClick={handleSubmit}
                                    disabled={createMRNMutation.isPending || returnItems.length === 0}
                                    size="sm"
                                >
                                    {createMRNMutation.isPending ? (
                                        <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                                    ) : (
                                        <Send className="w-4 h-4 mr-1" />
                                    )}
                                    Submit MRN ({returnItems.length})
                                </Button>
                            </div>
                        </div>

                        {/* MRN Details */}
                        <Card>
                            <CardContent className="p-4 space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    {/* Store */}
                                    <div>
                                        <label className="text-sm font-medium mb-1 block">Store *</label>
                                        <select
                                            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                                            value={selectedStore}
                                            onChange={(e) => setSelectedStore(e.target.value)}
                                        >
                                            <option value="">Select Store...</option>
                                            {stores.map((store: any) => (
                                                <option key={store.id} value={store.id}>{store.name}</option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* Return Type */}
                                    <div>
                                        <label className="text-sm font-medium mb-1 block">Return Type *</label>
                                        <select
                                            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
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
                                    <div>
                                        <label className="text-sm font-medium mb-1 block">Return To *</label>
                                        <select
                                            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                                            value={returnTo}
                                            onChange={(e) => setReturnTo(e.target.value)}
                                        >
                                            <option value="SLT">SLT</option>
                                            <option value="SUPPLIER">Supplier</option>
                                            <option value="MAIN_STORE">Main Store</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {/* Supplier */}
                                    <div>
                                        <label className="text-sm font-medium mb-1 block">Supplier (if applicable)</label>
                                        <Input
                                            placeholder="Enter supplier name"
                                            value={supplier}
                                            onChange={(e) => setSupplier(e.target.value)}
                                            className="h-9"
                                        />
                                    </div>

                                    {/* General Reason */}
                                    <div>
                                        <label className="text-sm font-medium mb-1 block">General Reason</label>
                                        <Textarea
                                            placeholder="Describe reason for return..."
                                            value={generalReason}
                                            onChange={(e) => setGeneralReason(e.target.value)}
                                            className="h-9 resize-none"
                                            rows={1}
                                        />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Items Table */}
                        <Card>
                            <CardContent className="p-0">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead className="bg-slate-100 border-b">
                                            <tr>
                                                <th className="px-3 py-2 text-left text-xs font-medium text-slate-600 w-8">#</th>
                                                <th className="px-3 py-2 text-left text-xs font-medium text-slate-600">Item</th>
                                                <th className="px-3 py-2 text-left text-xs font-medium text-slate-600 w-24">Unit</th>
                                                <th className="px-3 py-2 text-right text-xs font-medium text-slate-600 w-32">Return Qty</th>
                                                <th className="px-3 py-2 text-left text-xs font-medium text-slate-600">Item Reason</th>
                                                <th className="px-3 py-2 text-center text-xs font-medium text-slate-600 w-16">Action</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {returnItems.length === 0 ? (
                                                <tr>
                                                    <td colSpan={6} className="px-3 py-8 text-center text-slate-500 text-sm">
                                                        No items added. Click "Add Item" to start.
                                                    </td>
                                                </tr>
                                            ) : (
                                                returnItems.map((item, index) => {
                                                    const itemDetails = getItemDetails(item.itemId);
                                                    return (
                                                        <tr key={index} className="border-b hover:bg-slate-50">
                                                            <td className="px-3 py-2 text-slate-500 text-xs">{index + 1}</td>
                                                            <td className="px-3 py-2">
                                                                <select
                                                                    className="w-full h-8 rounded border border-input bg-background px-2 text-sm"
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
                                                            <td className="px-3 py-2">
                                                                {itemDetails && (
                                                                    <Badge variant="secondary" className="text-xs">
                                                                        {itemDetails.unit}
                                                                    </Badge>
                                                                )}
                                                            </td>
                                                            <td className="px-3 py-2">
                                                                <Input
                                                                    type="number"
                                                                    className="h-8 text-right text-sm"
                                                                    placeholder="0"
                                                                    value={item.quantity}
                                                                    onChange={(e) => updateItem(index, 'quantity', e.target.value)}
                                                                    min="0"
                                                                    step="1"
                                                                />
                                                            </td>
                                                            <td className="px-3 py-2">
                                                                <Input
                                                                    className="h-8 text-sm"
                                                                    placeholder="Reason..."
                                                                    value={item.reason}
                                                                    onChange={(e) => updateItem(index, 'reason', e.target.value)}
                                                                />
                                                            </td>
                                                            <td className="px-3 py-2 text-center">
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    onClick={() => removeItem(index)}
                                                                    className="h-7 w-7 p-0"
                                                                >
                                                                    <Trash2 className="w-3.5 h-3.5 text-red-500" />
                                                                </Button>
                                                            </td>
                                                        </tr>
                                                    );
                                                })
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Info */}
                        <div className="bg-amber-50 border border-amber-200 rounded-md p-3">
                            <p className="text-xs text-amber-900">
                                <strong>Note:</strong> MRN requires approval before stock is reduced. Status: PENDING → APPROVED → Stock Reduced
                            </p>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}

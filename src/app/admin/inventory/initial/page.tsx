"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, Save, Search, RefreshCw } from "lucide-react";
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import { Badge } from "@/components/ui/badge";

interface InventoryItem {
    id: string;
    code: string;
    name: string;
    category: string;
    unit: string;
}

interface StockRecord {
    itemId: string;
    quantity: number;
}

export default function InitialStockPage() {
    const queryClient = useQueryClient();
    const [selectedStore, setSelectedStore] = useState<string>("");
    const [searchTerm, setSearchTerm] = useState("");
    const [stockValues, setStockValues] = useState<Record<string, string>>({});
    // Key: itemId, Value: string input (to allow empty)

    // Fetch Stores
    const { data: stores = [] } = useQuery({
        queryKey: ["stores"],
        queryFn: async () => {
            const res = await fetch("/api/stores?page=1&limit=1000");
            const data = await res.json();
            return Array.isArray(data) ? data : (data.stores || []);
        }
    });

    // Fetch All Items
    const { data: items = [], isLoading: isLoadingItems } = useQuery<InventoryItem[]>({
        queryKey: ["inventory-items"],
        queryFn: async () => {
            const res = await fetch("/api/inventory/items?page=1&limit=1000");
            const data = await res.json();
            return Array.isArray(data) ? data : (data.items || []);
        }
    });

    // Fetch Current Stock when store changes
    const { data: currentStocks = [], isLoading: isLoadingStock, refetch: refetchStock } = useQuery<any[]>({
        queryKey: ["current-stock", selectedStore],
        queryFn: async () => {
            if (!selectedStore) return [];
            const res = await fetch(`/api/inventory/stock?storeId=${selectedStore}`, { cache: 'no-store' });
            const data = await res.json();
            return Array.isArray(data) ? data : (data.stock || data.data || []);
        },
        enabled: !!selectedStore
    });

    // Initialize inputs when current stock loads
    useEffect(() => {
        if (selectedStore && currentStocks && items.length > 0) {
            const initialValues: Record<string, string> = {};
            items.forEach(item => {
                const stock = currentStocks.find((s: any) => s.itemId === item.id);
                initialValues[item.id] = stock ? stock.quantity.toString() : "0";
            });
            setStockValues(initialValues);
        } else if (!selectedStore) {
            // Clear when no store selected
            setStockValues({});
        }
        // Only run when selectedStore changes or when data first loads
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedStore]);


    const saveMutation = useMutation({
        mutationFn: async (payload: any) => {
            const res = await fetch("/api/inventory/stock", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-user-id": "USER_ID_PLACEHOLDER" // Ideally from Auth Context
                },
                body: JSON.stringify(payload)
            });
            if (!res.ok) throw new Error("Failed to update stock");
            return res.json();
        },
        onSuccess: (data) => {
            toast.success(`Stock updated successfully. ${data.itemsUpdated} items affected.`);
            refetchStock();
        },
        onError: () => toast.error("Failed to update stock")
    });

    const handleQuantityChange = (itemId: string, val: string) => {
        setStockValues(prev => ({ ...prev, [itemId]: val }));
    };

    const handleSave = () => {
        if (!selectedStore) {
            toast.error("Please select a store");
            return;
        }

        // Prepare changes
        // We send ALL items or just changed ones?
        // Bulk update API handles all. Let's send all non-empty ones to be safe/consistent.
        const itemsToUpdate = items.map(item => ({
            itemId: item.id,
            quantity: parseFloat(stockValues[item.id] || "0")
        })).filter(i => !isNaN(i.quantity));

        saveMutation.mutate({
            storeId: selectedStore,
            items: itemsToUpdate,
            reason: "Initial Stock Setup / Adjustment"
        });
    };

    const filteredItems = items.filter(item =>
        item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.code.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="flex h-screen bg-slate-50 overflow-hidden">
            <Sidebar />
            <main className="flex-1 flex flex-col min-w-0 h-full">
                <Header />
                <div className="flex-1 overflow-y-auto p-4 md:p-8">
                    <div className="max-w-7xl mx-auto space-y-6">

                        <div className="flex justify-between items-center">
                            <div>
                                <h1 className="text-2xl font-bold text-slate-900">Initial Stock Setup</h1>
                                <p className="text-slate-500">Set physical stock counts for stores (Fresh Start)</p>
                            </div>
                            <Button onClick={handleSave} disabled={saveMutation.isPending || !selectedStore}>
                                {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                                Update All Stock
                            </Button>
                        </div>

                        {/* Controls */}
                        <Card>
                            <CardContent className="p-6 flex flex-col md:flex-row gap-4 items-end">
                                <div className="w-full md:w-1/3 space-y-2">
                                    <select
                                        className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                        value={selectedStore}
                                        onChange={(e) => setSelectedStore(e.target.value)}
                                    >
                                        <option value="" disabled>Select Store...</option>
                                        {stores.map((store: any) => (
                                            <option key={store.id} value={store.id}>{store.name}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="w-full md:w-1/3 space-y-2">
                                    <label className="text-sm font-medium">Search Items</label>
                                    <div className="relative">
                                        <Search className="absolute left-2 top-2.5 h-4 w-4 text-slate-400" />
                                        <Input
                                            placeholder="Search by code or name..."
                                            className="pl-8"
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                        />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Table */}
                        <Card className="overflow-hidden">
                            <div className="max-h-[600px] overflow-y-auto relative">
                                {!selectedStore ? (
                                    <div className="p-12 text-center text-slate-500">
                                        Please select a store to view stock
                                    </div>
                                ) : isLoadingItems || isLoadingStock ? (
                                    <div className="p-12 text-center flex justify-center">
                                        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                                    </div>
                                ) : (
                                    <table className="w-full text-sm text-left">
                                        <thead className="text-xs text-slate-500 uppercase bg-slate-50 sticky top-0 z-10">
                                            <tr>
                                                <th className="px-6 py-3">Code</th>
                                                <th className="px-6 py-3">Item Name</th>
                                                <th className="px-6 py-3">Category</th>
                                                <th className="px-6 py-3 text-right">Current System Qty</th>
                                                <th className="px-6 py-3 text-right bg-blue-50/50">New Physical Qty</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filteredItems.map((item) => {
                                                const currentStock = currentStocks?.find((s: any) => s.itemId === item.id);
                                                const currentQty = currentStock ? currentStock.quantity : 0;
                                                const inputValue = stockValues[item.id] ?? "0";
                                                const isChanged = parseFloat(inputValue) !== currentQty;

                                                return (
                                                    <tr key={item.id} className="border-b hover:bg-slate-50/50">
                                                        <td className="px-6 py-4 font-medium">{item.code}</td>
                                                        <td className="px-6 py-4">{item.name}</td>
                                                        <td className="px-6 py-4">{item.category}</td>
                                                        <td className="px-6 py-4 text-right">
                                                            <Badge variant="outline" className="bg-slate-100">
                                                                {currentQty} {item.unit}
                                                            </Badge>
                                                        </td>
                                                        <td className={`px-6 py-4 text-right ${isChanged ? 'bg-blue-50' : ''}`}>
                                                            <div className="flex justify-end items-center gap-2">
                                                                <Input
                                                                    type="number"
                                                                    className={`w-32 text-right ${isChanged ? 'border-blue-400 font-bold' : ''}`}
                                                                    value={inputValue}
                                                                    onChange={(e) => handleQuantityChange(item.id, e.target.value)}
                                                                />
                                                                <span className="text-slate-500 w-8">{item.unit}</span>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                            {filteredItems.length === 0 && (
                                                <tr>
                                                    <td colSpan={5} className="text-center py-8 text-slate-500">
                                                        No items found
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                )}
                            </div>
                        </Card>

                    </div>
                </div>
            </main>
        </div>
    );
}

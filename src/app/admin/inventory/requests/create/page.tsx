"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
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
    type?: string;
}

interface RequestItem {
    itemId: string;
    requestedQty: string;
    remarks: string;
    make: string;
    model: string;
    suggestedVendor: string;
}

export default function MaterialRequestPage() {
    const queryClient = useQueryClient();

    // Header State
    const [selectedStore, setSelectedStore] = useState<string>("");
    const [sourceType, setSourceType] = useState<string>("SLT");
    const [priority, setPriority] = useState<string>("MEDIUM");
    const [requiredDate, setRequiredDate] = useState<string>("");

    // Reason / Project State
    const [projectTypes, setProjectTypes] = useState<string[]>([]);
    const [maintenanceMonths, setMaintenanceMonths] = useState<string>("");
    const [otherReason, setOtherReason] = useState("");
    const [irNumber, setIrNumber] = useState(""); // IR Number for SLT requests

    const [requestItems, setRequestItems] = useState<RequestItem[]>([]);

    // --- QUERIES ---
    const { data: stores = [] } = useQuery({
        queryKey: ["stores"],
        queryFn: async () => {
            const res = await fetch("/api/stores?page=1&limit=1000");
            const data = await res.json();
            return Array.isArray(data) ? data : (data.stores || []);
        }
    });

    const { data: items = [] } = useQuery<InventoryItem[]>({
        queryKey: ["inventory-items"],
        queryFn: async () => {
            const res = await fetch("/api/inventory/items?page=1&limit=1000");
            const data = await res.json();
            return Array.isArray(data) ? data : (data.items || []);
        }
    });

    const { data: currentStocks = [] } = useQuery({
        queryKey: ["current-stock", selectedStore],
        queryFn: async () => {
            if (!selectedStore) return [];
            const res = await fetch(`/api/inventory/stock?storeId=${selectedStore}`, { cache: 'no-store' });
            const data = await res.json();
            return Array.isArray(data) ? data : (data.stock || data.data || []);
        },
        enabled: !!selectedStore
    });

    const getCurrentStock = (itemId: string) => {
        const stock = currentStocks.find((s: any) => s.itemId === itemId);
        return stock ? stock.quantity : 0;
    };

    // --- MUTATION ---
    const createRequestMutation = useMutation({
        mutationFn: async (data: any) => {
            const res = await fetch("/api/inventory/requests", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data)
            });
            if (!res.ok) throw new Error("Failed to create request");
            return res.json();
        },
        onSuccess: (data) => {
            toast.success(`Request created! #${data.requestNr}`);
            queryClient.invalidateQueries({ queryKey: ["material-requests"] });
            // Reset
            setRequestItems([]);
            setPriority("MEDIUM");
            setProjectTypes([]);
            setMaintenanceMonths("");
            setOtherReason("");
            setIrNumber("");
            setSourceType("SLT");
            // Keep Store and Date
        },
        onError: () => toast.error("Failed to create request")
    });

    // --- HANDLERS ---
    const addNewRow = () => {
        setRequestItems([...requestItems, { itemId: "", requestedQty: "", remarks: "", make: "", model: "", suggestedVendor: "" }]);
    };

    const removeItem = (index: number) => {
        setRequestItems(requestItems.filter((_, i) => i !== index));
    };

    const updateItem = (index: number, field: keyof RequestItem, value: string) => {
        const updated = [...requestItems];
        updated[index][field] = value;
        setRequestItems(updated);
    };

    const toggleProject = (type: string) => {
        if (projectTypes.includes(type)) setProjectTypes(projectTypes.filter(t => t !== type));
        else setProjectTypes([...projectTypes, type]);
    };

    const handleSubmit = () => {
        if (!selectedStore) { toast.error("Please select a store"); return; }
        const user = localStorage.getItem('user');
        if (!user) { toast.error("Authenticated user required"); return; }

        const validItems = requestItems.filter(i => i.itemId && parseFloat(i.requestedQty) > 0);
        if (validItems.length === 0) { toast.error("Add at least one item with Quantity"); return; }

        const purposeDesc = [
            ...projectTypes,
            maintenanceMonths ? `Maintenance: ${maintenanceMonths}` : '',
            otherReason ? `Other: ${otherReason}` : ''
        ].filter(Boolean).join(', ');

        const payload = {
            fromStoreId: selectedStore,
            toStoreId: null,
            requestedById: JSON.parse(user).id,
            priority,
            requiredDate,
            sourceType,
            projectTypes,
            maintenanceMonths,
            irNumber: sourceType === 'SLT' ? irNumber : null, // Only for SLT requests
            purpose: purposeDesc,
            items: validItems.map(item => ({
                itemId: item.itemId,
                requestedQty: parseFloat(item.requestedQty),
                remarks: item.remarks,
                make: item.make,
                model: item.model,
                suggestedVendor: item.suggestedVendor
            }))
        };

        createRequestMutation.mutate(payload);
    };

    useEffect(() => {
        if (selectedStore) {
            const store = stores.find((s: any) => s.id === selectedStore);
            if (store) {
                if (store.type === 'SUB' && sourceType === 'SLT') {
                    setSourceType('MAIN_STORE');
                } else if (store.type === 'MAIN' && sourceType === 'MAIN_STORE') {
                    setSourceType('SLT');
                }
            }
        }
    }, [selectedStore, stores, sourceType]);

    useEffect(() => {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        setRequiredDate(tomorrow.toISOString().split('T')[0]);
    }, []);

    return (
        <div className="flex h-screen bg-slate-50 overflow-hidden">
            <Sidebar />
            <main className="flex-1 flex flex-col min-w-0 h-full">
                <Header />
                <div className="flex-1 overflow-y-auto p-2 md:p-4 bg-slate-50/50">
                    <div className="max-w-7xl mx-auto space-y-3">

                        <div className="flex justify-between items-center bg-white p-3 rounded-md shadow-sm border border-slate-200">
                            <div>
                                <h1 className="text-lg font-bold text-slate-800">New Material Requisition</h1>
                                <p className="text-xs text-slate-500">Create new purchase or transfer request for approvals</p>
                            </div>
                            <Button onClick={handleSubmit} disabled={createRequestMutation.isPending} size="sm" className="bg-blue-600 hover:bg-blue-700 h-8 text-xs">
                                {createRequestMutation.isPending ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Send className="w-3 h-3 mr-1" />}
                                Submit Request
                            </Button>
                        </div>

                        {/* COMPACT CONFIGURATION */}
                        <Card className="border shadow-sm">
                            <CardContent className="p-3 space-y-3">
                                {/* Top Row Inputs */}
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Requesting Store</label>
                                        <select className="flex h-8 w-full rounded border-slate-300 border bg-white px-2 text-xs focus:ring-1 focus:ring-blue-500" value={selectedStore} onChange={e => setSelectedStore(e.target.value)}>
                                            <option value="">Select Store...</option>
                                            {stores.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
                                        </select>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Source</label>
                                        <select className="flex h-8 w-full rounded border-slate-300 border bg-white px-2 text-xs focus:ring-1 focus:ring-blue-500" value={sourceType} onChange={e => setSourceType(e.target.value)}>
                                            {/* Logic: 
                                                - Main Stores: Can see SLT and LOCAL_PURCHASE.
                                                - Sub Stores: Can see MAIN_STORE (Internal) and LOCAL_PURCHASE.
                                            */}
                                            {stores.find((s: any) => s.id === selectedStore)?.type === 'MAIN' && (
                                                <option value="SLT">SLT (Head Office)</option>
                                            )}
                                            {stores.find((s: any) => s.id === selectedStore)?.type === 'SUB' && (
                                                <option value="MAIN_STORE">Main Store (Internal Request)</option>
                                            )}
                                            <option value="LOCAL_PURCHASE">Local Purchase</option>
                                        </select>
                                    </div>
                                    {sourceType === 'SLT' && (
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">IR Number (Optional)</label>
                                            <Input
                                                placeholder="IR-2024-001"
                                                className="h-8 text-xs"
                                                value={irNumber}
                                                onChange={e => setIrNumber(e.target.value)}
                                            />
                                        </div>
                                    )}
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Required Date</label>
                                        <Input type="date" className="h-8 text-xs" value={requiredDate} onChange={e => setRequiredDate(e.target.value)} />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Priority</label>
                                        <select className="flex h-8 w-full rounded border-slate-300 border bg-white px-2 text-xs focus:ring-1 focus:ring-blue-500" value={priority} onChange={e => setPriority(e.target.value)}>
                                            <option value="MEDIUM">Medium</option>
                                            <option value="HIGH">High</option>
                                            <option value="URGENT">Urgent</option>
                                        </select>
                                    </div>
                                </div>

                                {/* Project / Reason Grid */}
                                <div className="bg-slate-50/80 p-2 rounded border border-slate-100">
                                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-x-4 gap-y-2 text-xs text-slate-700">
                                        {/* Row 1 */}
                                        <label className="flex items-center gap-2 cursor-pointer hover:bg-slate-100 rounded px-1 -ml-1">
                                            <input type="checkbox" checked={projectTypes.includes('OSP_FTTH')} onChange={() => toggleProject('OSP_FTTH')} className="rounded border-slate-300 text-blue-600 focus:ring-0 w-3 h-3" />
                                            <span>OSP FTTH</span>
                                        </label>
                                        <label className="flex items-center gap-2 cursor-pointer hover:bg-slate-100 rounded px-1 -ml-1">
                                            <input type="checkbox" checked={projectTypes.includes('OSP_PSTN')} onChange={() => toggleProject('OSP_PSTN')} className="rounded border-slate-300 text-blue-600 focus:ring-0 w-3 h-3" />
                                            <span>OSP PSTN</span>
                                        </label>
                                        <label className="flex items-center gap-2 cursor-pointer hover:bg-slate-100 rounded px-1 -ml-1">
                                            <input type="checkbox" checked={projectTypes.includes('OSP_PEOTV')} onChange={() => toggleProject('OSP_PEOTV')} className="rounded border-slate-300 text-blue-600 focus:ring-0 w-3 h-3" />
                                            <span>OSP PEOTV</span>
                                        </label>
                                        <label className="flex items-center gap-2 cursor-pointer hover:bg-slate-100 rounded px-1 -ml-1">
                                            <input type="checkbox" checked={projectTypes.includes('OSP_HRB')} onChange={() => toggleProject('OSP_HRB')} className="rounded border-slate-300 text-blue-600 focus:ring-0 w-3 h-3" />
                                            <span>OSP HRB</span>
                                        </label>

                                        {/* Inputs integrated in grid */}

                                        <div className="flex items-center gap-1 col-span-3">
                                            <span className="text-slate-500 whitespace-nowrap text-[10px] uppercase font-bold">Stocks Maint:</span>
                                            <div className="flex gap-2">
                                                {['1M', '2M', '3M'].map(m => (
                                                    <label key={m} className="flex items-center gap-1 cursor-pointer">
                                                        <input type="radio" name="maint" checked={maintenanceMonths === m} onChange={() => setMaintenanceMonths(m)} className="text-blue-600 w-3 h-3" />
                                                        {m}
                                                    </label>
                                                ))}
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-1 col-span-3">
                                            <span className="text-slate-500 whitespace-nowrap text-[10px] uppercase font-bold">Other:</span>
                                            <Input placeholder="Specify..." className="h-6 w-full text-xs" value={otherReason} onChange={e => setOtherReason(e.target.value)} />
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* ITEMS TABLE WITH ADD BUTTON IN FOOTER */}
                        <Card className="shadow-sm border overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="w-full text-xs text-left">
                                    <thead className="bg-slate-100 border-b text-slate-600 font-semibold uppercase tracking-tight">
                                        <tr>
                                            <th className="px-3 py-2 w-8 text-center">#</th>
                                            <th className="px-2 py-2 min-w-[180px]">Item</th>
                                            <th className="px-2 py-2 w-[70px]">Stock</th>
                                            <th className="px-2 py-2 w-[100px]">Make</th>
                                            <th className="px-2 py-2 w-[100px]">Model</th>
                                            <th className="px-2 py-2 w-[120px] text-right bg-blue-50/50">Qty</th>
                                            <th className="px-2 py-2 w-[120px]">Vendor</th>
                                            <th className="px-2 py-2 w-[150px]">Remarks</th>
                                            <th className="px-2 py-2 w-8"></th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {requestItems.map((item, idx) => {
                                            const stock = item.itemId ? getCurrentStock(item.itemId) : '-';
                                            // Sort items: SLT items first, then others
                                            const sortedItems = [...items].sort((a, b) => {
                                                const aIsSLT = a.type === 'SLT';
                                                const bIsSLT = b.type === 'SLT';
                                                if (aIsSLT && !bIsSLT) return -1;
                                                if (!aIsSLT && bIsSLT) return 1;
                                                return a.name.localeCompare(b.name);
                                            });
                                            return (
                                                <tr key={idx} className="hover:bg-slate-50 group">
                                                    <td className="px-3 py-1 text-center text-slate-400">{idx + 1}</td>
                                                    <td className="px-2 py-1">
                                                        <select className="w-full h-7 rounded border-transparent bg-transparent hover:border-slate-200 focus:border-blue-500 focus:bg-white text-xs px-1 -ml-1" value={item.itemId} onChange={e => updateItem(idx, 'itemId', e.target.value)}>
                                                            <option value="">Select Item...</option>
                                                            {sortedItems.map(i => (
                                                                <option
                                                                    key={i.id}
                                                                    value={i.id}
                                                                    style={{ backgroundColor: i.type === 'SLT' ? '#dbeafe' : 'white' }}
                                                                >
                                                                    {i.name} ({i.code})
                                                                </option>
                                                            ))}
                                                        </select>
                                                    </td>
                                                    <td className="px-2 py-1 text-slate-500 font-mono text-[10px]">{stock}</td>
                                                    <td className="px-2 py-1"><Input className="h-6 text-xs px-2 border-transparent hover:border-slate-200 focus:border-blue-500 bg-transparent focus:bg-white" placeholder="-" value={item.make} onChange={e => updateItem(idx, 'make', e.target.value)} /></td>
                                                    <td className="px-2 py-1"><Input className="h-6 text-xs px-2 border-transparent hover:border-slate-200 focus:border-blue-500 bg-transparent focus:bg-white" placeholder="-" value={item.model} onChange={e => updateItem(idx, 'model', e.target.value)} /></td>
                                                    <td className="px-2 py-1 bg-blue-50/20"><Input type="number" className="h-6 text-xs text-right font-bold border-transparent bg-transparent focus:bg-white focus:border-blue-500" value={item.requestedQty} onChange={e => updateItem(idx, 'requestedQty', e.target.value)} /></td>
                                                    <td className="px-2 py-1"><Input className="h-6 text-xs px-2 border-transparent hover:border-slate-200 focus:border-blue-500 bg-transparent focus:bg-white" placeholder="-" value={item.suggestedVendor} onChange={e => updateItem(idx, 'suggestedVendor', e.target.value)} /></td>
                                                    <td className="px-2 py-1"><Input className="h-6 text-xs px-2 border-transparent hover:border-slate-200 focus:border-blue-500 bg-transparent focus:bg-white" placeholder="-" value={item.remarks} onChange={e => updateItem(idx, 'remarks', e.target.value)} /></td>
                                                    <td className="px-2 py-1 text-center">
                                                        <button onClick={() => removeItem(idx)} className="text-slate-300 hover:text-red-500 transition-colors"><Trash2 className="w-3 h-3" /></button>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                        {/* ADD BUTTON ROW */}
                                        <tr>
                                            <td colSpan={9} className="p-1">
                                                <Button
                                                    variant="ghost"
                                                    onClick={addNewRow}
                                                    className="w-full h-8 border-2 border-dashed border-slate-200 hover:border-blue-300 hover:bg-blue-50 text-slate-500 hover:text-blue-600 text-xs font-medium flex items-center justify-center gap-1"
                                                >
                                                    <Plus className="w-3 h-3" /> Add New Item Line
                                                </Button>
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </Card>
                    </div>
                </div>
            </main>
        </div>
    );
}

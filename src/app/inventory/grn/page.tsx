"use client";

import React, { useState, useEffect } from 'react';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, X, Save, ArrowLeft, Search, CheckCircle2 } from "lucide-react";
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

export default function GRNPage() {
    const router = useRouter();
    const queryClient = useQueryClient();
    const [user, setUser] = useState<any>(null);
    const [activeStep, setActiveStep] = useState(1); // 1: Info, 2: Items, 3: Review

    // Form State
    const [selectedStoreId, setSelectedStoreId] = useState("");
    const [sourceType, setSourceType] = useState("SLT");
    const [supplier, setSupplier] = useState("");
    const [grnItems, setGrnItems] = useState<{ item: any, qty: string }[]>([]);

    // Item Selection State
    const [itemSearch, setItemSearch] = useState("");
    const [itemFilterType, setItemFilterType] = useState("ALL"); // ALL, SLT, SLTS

    useEffect(() => {
        const stored = localStorage.getItem('user');
        if (stored) setUser(JSON.parse(stored));
    }, []);

    // Queries
    const { data: stores = [] } = useQuery({
        queryKey: ['stores'],
        queryFn: async () => (await fetch('/api/inventory/stores')).json()
    });

    const { data: items = [] } = useQuery({
        queryKey: ['items'],
        queryFn: async () => (await fetch('/api/inventory/items')).json()
    });

    // Validations
    const canProceedToItems = selectedStoreId && (sourceType === 'SLT' || (sourceType === 'LOCAL_PURCHASE' && supplier));
    const canReview = grnItems.length > 0;

    // Mutation
    const mutation = useMutation({
        mutationFn: async () => {
            if (!selectedStoreId) throw new Error("Select a store");
            const res = await fetch('/api/inventory/grn', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    storeId: selectedStoreId,
                    sourceType,
                    supplier: sourceType === 'SLT' ? 'SLT' : supplier,
                    receivedById: user?.id,
                    items: grnItems.map(i => ({ itemId: i.item.id, quantity: i.qty }))
                })
            });
            if (!res.ok) throw new Error('Failed');
        },
        onSuccess: () => {
            toast.success("GRN Created Successfully");
            // Reset or Redirect
            setGrnItems([]);
            setActiveStep(1);
            setSupplier("");
        },
        onError: () => toast.error("Failed to process GRN")
    });

    // Helper
    const filteredItems = Array.isArray(items) ? items.filter((i: any) => {
        const matchSearch = i.name.toLowerCase().includes(itemSearch.toLowerCase()) || i.code.toLowerCase().includes(itemSearch.toLowerCase());
        const matchType = itemFilterType === 'ALL' || i.type === itemFilterType;
        return matchSearch && matchType;
    }) : [];

    // Add item logic
    const handleAddItem = (item: any) => {
        const existing = grnItems.find(g => g.item.id === item.id);
        if (existing) {
            toast.info("Item already added to list");
            return;
        }
        // Default qty empty
        setGrnItems([...grnItems, { item, qty: "1" }]);
    };

    const updateQty = (idx: number, val: string) => {
        const newItems = [...grnItems];
        newItems[idx].qty = val;
        setGrnItems(newItems);
    };

    return (
        <div className="h-screen flex bg-slate-50 overflow-hidden">
            <Sidebar />
            <main className="flex-1 flex flex-col min-w-0 h-full">
                <Header />
                <div className="flex-1 overflow-y-auto p-4 md:p-8">
                    <div className="max-w-5xl mx-auto space-y-6">

                        <div className="flex items-center justify-between mb-8">
                            <div className="flex items-center gap-4">
                                <Button variant="ghost" size="sm" onClick={() => router.back()}>
                                    <ArrowLeft className="w-4 h-4 mr-2" /> Back
                                </Button>
                                <div>
                                    <h1 className="text-2xl font-bold text-slate-900">New GRN Entry</h1>
                                    <p className="text-slate-500 text-xs">Steps: Details &gt; Select Items &gt; Review & Confirm</p>
                                </div>
                            </div>

                            {/* Step Indicator */}
                            <div className="flex items-center gap-2">
                                {[1, 2, 3].map(step => (
                                    <div key={step} className={`flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold transition-colors 
                                        ${activeStep === step ? 'bg-blue-600 text-white shadow-md' :
                                            activeStep > step ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-500'}`}>
                                        {activeStep > step ? <CheckCircle2 className="w-5 h-5" /> : step}
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* STEP 1: Details */}
                        {activeStep === 1 && (
                            <Card className="animate-in fade-in slide-in-from-bottom-2">
                                <CardHeader>
                                    <CardTitle>Step 1: GRN Details</CardTitle>
                                    <CardDescription>Select where the items are coming from and where they are going.</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-6 max-w-2xl">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="space-y-2">
                                            <label className="text-xs font-bold text-slate-700">Receiving Store</label>
                                            <Select value={selectedStoreId} onValueChange={setSelectedStoreId}>
                                                <SelectTrigger><SelectValue placeholder="Select Store" /></SelectTrigger>
                                                <SelectContent>
                                                    {stores.map((s: any) => (
                                                        <SelectItem key={s.id} value={s.id}>{s.name} ({s.type})</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        <div className="space-y-2">
                                            <label className="text-xs font-bold text-slate-700">Source Type</label>
                                            <Select value={sourceType} onValueChange={setSourceType}>
                                                <SelectTrigger><SelectValue /></SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="SLT">SLT (Head Office)</SelectItem>
                                                    <SelectItem value="LOCAL_PURCHASE">Local Purchase</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>

                                    {sourceType === 'LOCAL_PURCHASE' && (
                                        <div className="space-y-2">
                                            <label className="text-xs font-bold text-slate-700">Supplier Name</label>
                                            <Input placeholder="e.g. ABC Hardware Pvt Ltd" value={supplier} onChange={e => setSupplier(e.target.value)} />
                                        </div>
                                    )}

                                    <div className="pt-4 flex justify-end">
                                        <Button disabled={!canProceedToItems} onClick={() => setActiveStep(2)}>
                                            Next: Add Items <ArrowRight className="w-4 h-4 ml-2" />
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        )}

                        {/* STEP 2: Items */}
                        {activeStep === 2 && (
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-right-4">
                                {/* Item Selector */}
                                <Card className="lg:col-span-1 h-[600px] flex flex-col">
                                    <CardHeader className="py-4">
                                        <CardTitle className="text-sm">Available Items</CardTitle>
                                        <div className="space-y-2 mt-2">
                                            <div className="relative">
                                                <Search className="w-4 h-4 absolute left-2 top-2.5 text-slate-400" />
                                                <Input
                                                    className="pl-8 text-xs"
                                                    placeholder="Search code or name..."
                                                    value={itemSearch}
                                                    onChange={e => setItemSearch(e.target.value)}
                                                />
                                            </div>
                                            <Select value={itemFilterType} onValueChange={setItemFilterType}>
                                                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="ALL">All Types</SelectItem>
                                                    <SelectItem value="SLT">SLT Items</SelectItem>
                                                    <SelectItem value="SLTS">SLTS Items</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </CardHeader>
                                    <CardContent className="flex-1 overflow-y-auto px-2">
                                        <div className="space-y-2">
                                            {filteredItems.map((item: any) => (
                                                <div
                                                    key={item.id}
                                                    className="p-3 bg-white border rounded-lg shadow-sm hover:border-blue-400 cursor-pointer transition-all flex flex-col gap-1 group"
                                                    onClick={() => handleAddItem(item)}
                                                >
                                                    <div className="flex justify-between items-start">
                                                        <span className="font-bold text-xs text-slate-800">{item.name}</span>
                                                        <Badge variant="secondary" className="text-[10px] h-5">{item.type}</Badge>
                                                    </div>
                                                    <div className="flex justify-between text-[10px] text-slate-500">
                                                        <span className="font-mono bg-slate-100 px-1 rounded">{item.code}</span>
                                                        <span>{item.unit}</span>
                                                    </div>
                                                    <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                                                        <span>{item.category.replace('_', ' ')}</span>
                                                        <span className="text-blue-600 font-bold opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                                                            Add <Plus className="w-3 h-3" />
                                                        </span>
                                                    </div>
                                                </div>
                                            ))}
                                            {filteredItems.length === 0 && <div className="text-center text-xs text-slate-400 py-4">No items found</div>}
                                        </div>
                                    </CardContent>
                                </Card>

                                {/* Added Items */}
                                <Card className="lg:col-span-2 h-[600px] flex flex-col">
                                    <CardHeader className="py-4 flex flex-row justify-between items-center">
                                        <CardTitle className="text-sm">Items to Receive ({grnItems.length})</CardTitle>
                                        <div className="flex gap-2">
                                            <Button variant="outline" size="sm" onClick={() => setActiveStep(1)}>Back</Button>
                                            <Button size="sm" disabled={!canReview} onClick={() => setActiveStep(3)}>Review GRN</Button>
                                        </div>
                                    </CardHeader>
                                    <CardContent className="flex-1 overflow-y-auto">
                                        {grnItems.length === 0 ? (
                                            <div className="h-full flex flex-col items-center justify-center text-slate-400">
                                                <div className="bg-slate-100 p-4 rounded-full mb-2"><Plus className="w-8 h-8 opacity-20" /></div>
                                                <p className="text-sm">Select items from the list to add to GRN</p>
                                            </div>
                                        ) : (
                                            <table className="w-full text-xs text-left">
                                                <thead className="bg-slate-50 border-b sticky top-0">
                                                    <tr>
                                                        <th className="px-3 py-2 w-10">#</th>
                                                        <th className="px-3 py-2">Item</th>
                                                        <th className="px-3 py-2">Details</th>
                                                        <th className="px-3 py-2 w-32">Rec. Qty</th>
                                                        <th className="px-3 py-2 w-10"></th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y">
                                                    {grnItems.map((entry, idx) => (
                                                        <tr key={idx} className="hover:bg-slate-50">
                                                            <td className="px-3 py-2 text-slate-400">{idx + 1}</td>
                                                            <td className="px-3 py-2">
                                                                <div className="font-bold text-slate-800">{entry.item.name}</div>
                                                                <div className="text-[10px] text-slate-500 font-mono">{entry.item.code}</div>
                                                            </td>
                                                            <td className="px-3 py-2">
                                                                <Badge variant="outline" className="text-[10px] mr-1">{entry.item.type}</Badge>
                                                                <span className="text-[10px] text-slate-500">{entry.item.category.replace('_', ' ')}</span>
                                                            </td>
                                                            <td className="px-3 py-2">
                                                                <div className="flex items-center gap-2">
                                                                    <Input
                                                                        type="number"
                                                                        className="h-7 w-20 text-right"
                                                                        value={entry.qty}
                                                                        onChange={(e) => updateQty(idx, e.target.value)}
                                                                        min="0"
                                                                    />
                                                                    <span className="text-slate-500 font-medium">{entry.item.unit}</span>
                                                                </div>
                                                            </td>
                                                            <td className="px-3 py-2 text-right">
                                                                <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-400 hover:text-red-500" onClick={() => setGrnItems(grnItems.filter((_, i) => i !== idx))}>
                                                                    <X className="w-3 h-3" />
                                                                </Button>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        )}
                                    </CardContent>
                                </Card>
                            </div>
                        )}

                        {/* STEP 3: Review */}
                        {activeStep === 3 && (
                            <Card className="animate-in fade-in zoom-in-95 max-w-4xl mx-auto border-t-4 border-t-emerald-500">
                                <CardHeader className="text-center pb-2">
                                    <div className="mx-auto bg-emerald-100 text-emerald-600 p-3 rounded-full w-12 h-12 flex items-center justify-center mb-4">
                                        <CheckCircle2 className="w-6 h-6" />
                                    </div>
                                    <CardTitle>Confirm GRN Entry</CardTitle>
                                    <CardDescription>Review the details below before submitting to inventory.</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-6">
                                    <div className="bg-slate-50 p-4 rounded-xl border grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                                        <div>
                                            <span className="text-slate-500 block text-xs uppercase tracking-wider">Store</span>
                                            <span className="font-bold text-slate-800">
                                                {stores.find((s: any) => s.id === selectedStoreId)?.name}
                                            </span>
                                        </div>
                                        <div>
                                            <span className="text-slate-500 block text-xs uppercase tracking-wider">Source</span>
                                            <span className="font-bold text-slate-800">
                                                {sourceType === 'SLT' ? 'SLT Head Office' : supplier}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="border rounded-lg overflow-hidden">
                                        <table className="w-full text-sm text-left">
                                            <thead className="bg-slate-100 border-b text-slate-600">
                                                <tr>
                                                    <th className="px-4 py-2">Item</th>
                                                    <th className="px-4 py-2">Unit</th>
                                                    <th className="px-4 py-2 text-right">Quantity</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y">
                                                {grnItems.map((g, i) => (
                                                    <tr key={i}>
                                                        <td className="px-4 py-2">
                                                            <div className="font-medium">{g.item.name}</div>
                                                            <div className="text-xs text-slate-500">{g.item.code}</div>
                                                        </td>
                                                        <td className="px-4 py-2 text-slate-500">{g.item.unit}</td>
                                                        <td className="px-4 py-2 text-right font-bold font-mono">{g.qty}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>

                                    <div className="flex justify-between items-center pt-4">
                                        <Button variant="outline" onClick={() => setActiveStep(2)}>Back to Edit</Button>
                                        <Button
                                            className="bg-emerald-600 hover:bg-emerald-700 w-40"
                                            onClick={() => mutation.mutate()}
                                            disabled={mutation.isPending}
                                        >
                                            {mutation.isPending ? 'Submitting...' : 'Confirm & Save'}
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
}

function ArrowRight({ className }: { className?: string }) {
    return <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></svg>
}

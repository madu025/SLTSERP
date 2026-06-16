"use client";

import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Label } from "@/components/ui/label";
import { Trash, Plus, Save, Package } from "lucide-react";
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

export default function MaterialIssuePage() {
    const queryClient = useQueryClient();
    const router = useRouter();

    // Form State
    const [selectedContractor, setSelectedContractor] = useState<string>('');
    const [selectedStore, setSelectedStore] = useState<string>('');
    const [month, setMonth] = useState<string>(new Date().toISOString().slice(0, 7)); // YYYY-MM

    // Items State
    const [rows, setRows] = useState<Array<{ itemId: string; quantity: number; unit: string; name: string }>>([
        { itemId: '', quantity: 0, unit: '', name: '' }
    ]);

    // Filters
    const [itemCategoryFilter, setItemCategoryFilter] = useState("ALL");
    const [itemJobFilter, setItemJobFilter] = useState("ALL");

    // --- FETCH DATA ---
    const { data: contractorsData } = useQuery({
        queryKey: ['contractors'],
        queryFn: async () => (await fetch('/api/contractors?page=1&limit=1000')).json()
    });
    const contractors = Array.isArray(contractorsData?.contractors) ? contractorsData.contractors : [];

    const { data: stores = [] } = useQuery({
        queryKey: ['stores'],
        queryFn: async () => (await fetch('/api/stores')).json()
    });

    const { data: items = [] } = useQuery({
        queryKey: ['inventory-items'],
        queryFn: async () => (await fetch('/api/inventory/items')).json()
    });

    // --- MUTATION ---
    const issueMutation = useMutation({
        mutationFn: async (data: any) => {
            const res = await fetch('/api/inventory/issue', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.message || 'Failed to issue materials');
            }
            return res.json();
        },
        onSuccess: () => {
            toast.success("Materials issued successfully!");
            // Reset form
            setRows([{ itemId: '', quantity: 0, unit: '', name: '' }]);
            setSelectedContractor('');
            // Optional: Redirect or stay
        },
        onError: (err: any) => {
            toast.error(err.message);
        }
    });

    // --- HANDLERS ---
    const handleAddRow = () => {
        setRows([...rows, { itemId: '', quantity: 0, unit: '', name: '' }]);
    };

    const handleRemoveRow = (idx: number) => {
        if (rows.length === 1) return; // Keep at least one row
        setRows(rows.filter((_, i) => i !== idx));
    };

    const handleItemChange = (idx: number, itemId: string) => {
        const item = items.find((i: any) => i.id === itemId);
        const newRows = [...rows];
        newRows[idx] = {
            ...newRows[idx],
            itemId,
            name: item?.name || '',
            unit: item?.unit || 'Nos' // Default unit if not found
        };
        setRows(newRows);
    };

    const handleQuantityChange = (idx: number, val: string) => {
        const newRows = [...rows];
        newRows[idx].quantity = parseFloat(val) || 0;
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

        issueMutation.mutate({
            contractorId: selectedContractor,
            storeId: selectedStore,
            month,
            items: validItems.map(r => ({
                itemId: r.itemId,
                quantity: r.quantity,
                unit: r.unit
            }))
        });
    };

    return (
        <div className="p-6 max-w-5xl mx-auto space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Issue Materials</h1>
                    <p className="text-slate-500">Issue monthly stock to contractors.</p>
                </div>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="text-sm font-medium uppercase text-slate-500">Config</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="space-y-2">
                        <Label>Contractor</Label>
                        <Select value={selectedContractor} onValueChange={setSelectedContractor}>
                            <SelectTrigger>
                                <SelectValue placeholder="Select Contractor" />
                            </SelectTrigger>
                            <SelectContent>
                                {contractors.map((c: any) => (
                                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label>Store</Label>
                        <Select value={selectedStore} onValueChange={setSelectedStore}>
                            <SelectTrigger>
                                <SelectValue placeholder="Select Store" />
                            </SelectTrigger>
                            <SelectContent>
                                {stores.map((s: any) => (
                                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label>Month</Label>
                        <Input
                            type="month"
                            value={month}
                            onChange={(e) => setMonth(e.target.value)}
                        />
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardContent className="p-0">
                    <div className="p-4 border-b bg-slate-50 flex gap-4 items-center">
                        <Label className="text-xs font-semibold text-slate-500">Filter Items:</Label>
                        <Select value={itemCategoryFilter} onValueChange={setItemCategoryFilter}>
                            <SelectTrigger className="h-8 w-40 text-xs"><SelectValue placeholder="Category" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="ALL">All Categories</SelectItem>
                                <SelectItem value="CABLES">Cables & Wires</SelectItem>
                                <SelectItem value="POLES">Poles</SelectItem>
                                <SelectItem value="FIBER_ACCESSORIES">Fiber Accessories</SelectItem>
                                <SelectItem value="COPPER_ACCESSORIES">Copper Accessories</SelectItem>
                                <SelectItem value="HARDWARE">Hardware</SelectItem>
                                <SelectItem value="EQUIPMENT">Equipment</SelectItem>
                                <SelectItem value="OTHERS">Others</SelectItem>
                            </SelectContent>
                        </Select>
                        <Select value={itemJobFilter} onValueChange={setItemJobFilter}>
                            <SelectTrigger className="h-8 w-40 text-xs"><SelectValue placeholder="Job Type" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="ALL">All Jobs</SelectItem>
                                <SelectItem value="FTTH">FTTH</SelectItem>
                                <SelectItem value="PSTN">PSTN</SelectItem>
                                <SelectItem value="OSP">OSP</SelectItem>
                                <SelectItem value="OTHERS">Others</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[40%]">Item Name</TableHead>
                                <TableHead className="w-[20%]">Unit</TableHead>
                                <TableHead className="w-[20%]">Quantity</TableHead>
                                <TableHead className="w-[10%]">Action</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {rows.map((row, idx) => (
                                <TableRow key={idx}>
                                    <TableCell>
                                        <Select value={row.itemId} onValueChange={(v) => handleItemChange(idx, v)}>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select Item" />
                                            </SelectTrigger>
                                            <SelectContent className="max-h-60">
                                                {items.filter((i: any) =>
                                                    (i.id === row.itemId) ||
                                                    (
                                                        (itemCategoryFilter === 'ALL' || i.category === itemCategoryFilter) &&
                                                        (itemJobFilter === 'ALL' || (i.commonFor && i.commonFor.includes(itemJobFilter)) || (!i.commonFor && itemJobFilter === 'ALL'))
                                                    )
                                                ).map((item: any) => (
                                                    <SelectItem key={item.id} value={item.id}>
                                                        {item.code} - {item.name}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </TableCell>
                                    <TableCell>
                                        <Input value={row.unit} disabled className="bg-slate-50" />
                                    </TableCell>
                                    <TableCell>
                                        <Input
                                            type="number"
                                            min="0"
                                            value={row.quantity || ''}
                                            onChange={(e) => handleQuantityChange(idx, e.target.value)}
                                        />
                                    </TableCell>
                                    <TableCell>
                                        <Button variant="ghost" size="sm" onClick={() => handleRemoveRow(idx)}>
                                            <Trash className="w-4 h-4 text-red-500" />
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>

                    <div className="p-4 border-t flex justify-center">
                        <Button variant="outline" size="sm" onClick={handleAddRow}>
                            <Plus className="w-4 h-4 mr-2" /> Add Item
                        </Button>
                    </div>
                </CardContent>
            </Card>

            <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => router.back()}>Cancel</Button>
                <Button onClick={handleSubmit} disabled={issueMutation.isPending}>
                    {issueMutation.isPending ? 'Processing...' : (
                        <>
                            <Save className="w-4 h-4 mr-2" /> Issue Materials
                        </>
                    )}
                </Button>
            </div>
        </div>
    );
}

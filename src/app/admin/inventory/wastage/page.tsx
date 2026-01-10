"use client";

import React, { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Trash, Plus, AlertTriangle } from "lucide-react";
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

export default function WastageReportPage() {
    const router = useRouter();

    // Form State
    const [selectedContractor, setSelectedContractor] = useState<string>('');
    const [selectedStore, setSelectedStore] = useState<string>('');
    const [month, setMonth] = useState<string>(new Date().toISOString().slice(0, 7)); // YYYY-MM
    const [description, setDescription] = useState<string>('');

    // Items State
    const [rows, setRows] = useState<Array<{ itemId: string; quantity: number; unit: string; name: string }>>([
        { itemId: '', quantity: 0, unit: '', name: '' }
    ]);

    // --- FETCH DATA ---
    const { data: contractors = [] } = useQuery({
        queryKey: ['contractors'],
        queryFn: async () => (await fetch('/api/contractors')).json()
    });

    const { data: stores = [] } = useQuery({
        queryKey: ['stores'],
        queryFn: async () => (await fetch('/api/stores')).json()
    });

    const { data: items = [] } = useQuery({
        queryKey: ['inventory-items'],
        queryFn: async () => (await fetch('/api/inventory/items')).json()
    });

    // --- MUTATION ---
    const wastageMutation = useMutation({
        mutationFn: async (data: any) => {
            const res = await fetch('/api/inventory/wastage', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.message || 'Failed to report wastage');
            }
            return res.json();
        },
        onSuccess: () => {
            toast.success("Wastage reported successfully!");
            // Reset form
            setRows([{ itemId: '', quantity: 0, unit: '', name: '' }]);
            setDescription('');
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
        if (rows.length === 1) return;
        setRows(rows.filter((_, i) => i !== idx));
    };

    const handleItemChange = (idx: number, itemId: string) => {
        const item = items.find((i: any) => i.id === itemId);
        const newRows = [...rows];
        newRows[idx] = {
            ...newRows[idx],
            itemId,
            name: item?.name || '',
            unit: item?.unit || 'Nos'
        };
        setRows(newRows);
    };

    const handleUpdateRow = (idx: number, field: string, value: any) => {
        const newRows = [...rows];
        (newRows[idx] as any)[field] = value;
        setRows(newRows);
    };

    const handleSubmit = () => {
        if (!selectedContractor || !selectedStore) {
            toast.error("Please select Contractor and Store");
            return;
        }

        const validItems = rows.filter(r => r.itemId && r.quantity > 0);
        if (validItems.length === 0) {
            toast.error("Please add at least one valid item");
            return;
        }

        if (!description) {
            toast.error("Please provide a description/reason");
            return;
        }

        wastageMutation.mutate({
            contractorId: selectedContractor, // If empty, it would be store wastage. But we force it here.
            storeId: selectedStore,
            month,
            description,
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
                    <h1 className="text-2xl font-bold text-slate-900">Report Wastage / Loss</h1>
                    <p className="text-slate-500">Report items lost or damaged by contractors (deducted from balance).</p>
                </div>
            </div>

            <Card className="border-red-100 bg-red-50/20">
                <CardHeader>
                    <CardTitle className="text-sm font-medium uppercase text-red-600 flex items-center">
                        <AlertTriangle className="w-4 h-4 mr-2" />
                        Wastage Details
                    </CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
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
                    </div>

                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label>Month of Incident</Label>
                            <Input
                                type="month"
                                value={month}
                                onChange={(e) => setMonth(e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Description / Reason</Label>
                            <Textarea
                                placeholder="Explain how the wastage/loss occurred..."
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                className="border-red-200"
                            />
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[45%]">Item Name</TableHead>
                                <TableHead className="w-[15%]">Unit</TableHead>
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
                                                {items.map((item: any) => (
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
                                            onChange={(e) => handleUpdateRow(idx, 'quantity', parseFloat(e.target.value))}
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
                <Button onClick={handleSubmit} disabled={wastageMutation.isPending} variant="destructive">
                    {wastageMutation.isPending ? 'Reporting...' : (
                        <>
                            <AlertTriangle className="w-4 h-4 mr-2" /> Report Wastage
                        </>
                    )}
                </Button>
            </div>
        </div>
    );
}

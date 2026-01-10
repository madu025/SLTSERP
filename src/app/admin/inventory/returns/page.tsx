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
import { Trash, Plus, Save, Undo2 } from "lucide-react";
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

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
    const returnMutation = useMutation({
        mutationFn: async (data: any) => {
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
        },
        onError: (err: any) => {
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

        // Validate items
        const validItems = rows.filter(r => r.itemId && r.quantity > 0);
        if (validItems.length === 0) {
            toast.error("Please add at least one valid item");
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
        <div className="p-6 max-w-5xl mx-auto space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Return Materials</h1>
                    <p className="text-slate-500">Log materials returned by contractors to the store.</p>
                </div>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="text-sm font-medium uppercase text-slate-500">Return Details</CardTitle>
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
                            <Label>Month</Label>
                            <Input
                                type="month"
                                value={month}
                                onChange={(e) => setMonth(e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Reason / Note</Label>
                            <Textarea
                                placeholder="Reason for return..."
                                value={reason}
                                onChange={(e) => setReason(e.target.value)}
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
                                <TableHead className="w-[35%]">Item Name</TableHead>
                                <TableHead className="w-[15%]">Unit</TableHead>
                                <TableHead className="w-[20%]">Condition</TableHead>
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
                                        <Select value={row.condition} onValueChange={(v) => handleUpdateRow(idx, 'condition', v)}>
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="GOOD">Good</SelectItem>
                                                <SelectItem value="DAMAGED">Damaged</SelectItem>
                                                <SelectItem value="FAULTY">Faulty</SelectItem>
                                            </SelectContent>
                                        </Select>
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
                <Button onClick={handleSubmit} disabled={returnMutation.isPending}>
                    {returnMutation.isPending ? 'Processing...' : (
                        <>
                            <Undo2 className="w-4 h-4 mr-2" /> Submit Return
                        </>
                    )}
                </Button>
            </div>
        </div>
    );
}

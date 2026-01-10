"use client";

import React, { useState } from 'react';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Search, Plus, Edit2, Trash2, AlertTriangle } from "lucide-react";
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';

// --- SCHEMA ---
const itemSchema = z.object({
    code: z.string().min(2, "Code is required"),
    name: z.string().min(2, "Name is required"),
    unit: z.enum(['Nos', 'kg', 'L', 'm', 'pkts', 'ml', 'gram']),
    type: z.enum(['SLT', 'SLTS']),
    category: z.enum(['OSP_NEW_CONN', 'OSP_PROJECT', 'OTHERS']),
    minLevel: z.string().optional().refine((val) => !val || !isNaN(parseFloat(val)) && parseFloat(val) >= 0, { message: "Must be a valid number >= 0" }),
    description: z.string().optional()
});

type ItemFormValues = z.infer<typeof itemSchema>;

export default function ItemMasterPage() {
    const queryClient = useQueryClient();
    const [searchTerm, setSearchTerm] = useState("");
    const [showModal, setShowModal] = useState(false);
    const [editingItem, setEditingItem] = useState<any>(null);
    const [deletingItemId, setDeletingItemId] = useState<string | null>(null);

    // --- QUERIES ---
    const { data: items = [], isLoading } = useQuery({
        queryKey: ['items'],
        queryFn: async () => (await fetch('/api/inventory/items')).json()
    });

    // --- MUTATIONS ---
    const mutation = useMutation({
        mutationFn: async (values: ItemFormValues) => {
            const method = editingItem ? 'PUT' : 'POST';
            const body = editingItem ? { ...values, id: editingItem.id } : values;

            const res = await fetch('/api/inventory/items', {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || 'Failed');
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['items'] });
            setShowModal(false);
            setEditingItem(null);
            toast.success(editingItem ? "Item updated" : "Item registered successfully");
        },
        onError: (err: any) => toast.error(err.message)
    });

    const deleteMutation = useMutation({
        mutationFn: async (id: string) => {
            const res = await fetch(`/api/inventory/items?id=${id}`, {
                method: 'DELETE'
            });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || 'Failed to delete');
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['items'] });
            setDeletingItemId(null);
            toast.success("Item deleted successfully");
        },
        onError: (err: any) => toast.error(err.message)
    });

    // --- FORM ---
    const form = useForm<ItemFormValues>({
        resolver: zodResolver(itemSchema),
        defaultValues: {
            code: '',
            name: '',
            unit: 'Nos',
            type: 'SLTS',
            category: 'OTHERS',
            minLevel: '0',
            description: ''
        }
    });

    // Reset form when modal opens/closes or edit changes
    React.useEffect(() => {
        if (showModal) {
            if (editingItem) {
                form.reset({
                    code: editingItem.code,
                    name: editingItem.name,
                    unit: editingItem.unit,
                    type: editingItem.type,
                    category: editingItem.category,
                    minLevel: (editingItem.minLevel ?? 0).toString(),
                    description: editingItem.description || ''
                });
            } else {
                form.reset({
                    code: '',
                    name: '',
                    unit: 'Nos',
                    type: 'SLTS',
                    category: 'OTHERS',
                    minLevel: '0',
                    description: ''
                });
            }
        }
    }, [showModal, editingItem, form]);

    const filteredItems = Array.isArray(items) ? items.filter((i: any) =>
        i.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        i.code.toLowerCase().includes(searchTerm.toLowerCase())
    ) : [];

    const categoryLabel = (cat: string) => {
        switch (cat) {
            case 'OSP_NEW_CONN': return 'OSP New Connection';
            case 'OSP_PROJECT': return 'OSP Project';
            default: return 'Others';
        }
    };

    return (
        <div className="h-screen flex bg-slate-50 overflow-hidden">
            <Sidebar />
            <main className="flex-1 flex flex-col min-w-0 h-full">
                <Header />
                <div className="flex-1 overflow-y-auto p-4 md:p-8">
                    <div className="max-w-6xl mx-auto space-y-6">

                        <div className="flex justify-between items-center">
                            <div>
                                <h1 className="text-xl font-bold text-slate-900">Item Master</h1>
                                <p className="text-xs text-slate-500">Register and manage inventory items</p>
                            </div>
                            <Button size="sm" onClick={() => { setEditingItem(null); setShowModal(true); }} className="h-8 text-xs">
                                <Plus className="w-4 h-4 mr-2" /> New Item
                            </Button>
                        </div>

                        <div className="bg-white rounded-xl border shadow-sm flex flex-col min-h-[500px]">
                            {/* Toolbar */}
                            <div className="p-4 border-b flex justify-between items-center bg-slate-50/50">
                                <div className="relative w-64">
                                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                                    <Input
                                        placeholder="Search by name or code..."
                                        value={searchTerm}
                                        onChange={e => setSearchTerm(e.target.value)}
                                        className="pl-9 h-9 text-xs"
                                    />
                                </div>
                                <div className="text-xs text-slate-500">
                                    Total Items: <strong>{items.length}</strong>
                                </div>
                            </div>

                            {/* Table */}
                            <div className="flex-1 overflow-auto">
                                <table className="w-full text-xs text-left">
                                    <thead className="bg-slate-50 text-slate-600 font-bold border-b sticky top-0">
                                        <tr>
                                            <th className="px-4 py-3">Code</th>
                                            <th className="px-4 py-3">Item Name</th>
                                            <th className="px-4 py-3">Unit</th>
                                            <th className="px-4 py-3">Type</th>
                                            <th className="px-4 py-3">Reorder Level</th>
                                            <th className="px-4 py-3">Category</th>
                                            <th className="px-4 py-3 text-right">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                        {isLoading ? (
                                            <tr><td colSpan={7} className="p-8 text-center text-slate-400">Loading items...</td></tr>
                                        ) : filteredItems.length === 0 ? (
                                            <tr><td colSpan={7} className="p-8 text-center text-slate-400">No items found.</td></tr>
                                        ) : (
                                            filteredItems.map((item: any) => (
                                                <tr key={item.id} className="hover:bg-slate-50 group">
                                                    <td className="px-4 py-2 font-mono text-slate-500">{item.code}</td>
                                                    <td className="px-4 py-2 font-bold text-slate-800">{item.name}</td>
                                                    <td className="px-4 py-2 text-slate-600">{item.unit}</td>
                                                    <td className="px-4 py-2">
                                                        <Badge variant="outline" className={`${item.type === 'SLT' ? 'border-blue-200 bg-blue-50 text-blue-700' : 'border-purple-200 bg-purple-50 text-purple-700'}`}>
                                                            {item.type}
                                                        </Badge>
                                                    </td>
                                                    <td className="px-4 py-2 text-slate-700">
                                                        {item.minLevel > 0 ? (
                                                            <div className="flex items-center gap-1">
                                                                <AlertTriangle className="w-3 h-3 text-orange-400" />
                                                                {item.minLevel}
                                                            </div>
                                                        ) : <span className="text-slate-400">-</span>}
                                                    </td>
                                                    <td className="px-4 py-2 text-slate-600">{categoryLabel(item.category)}</td>
                                                    <td className="px-4 py-2 text-right flex justify-end gap-1">
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-6 w-6 text-slate-400 hover:text-blue-600"
                                                            onClick={() => { setEditingItem(item); setShowModal(true); }}
                                                        >
                                                            <Edit2 className="w-3 h-3" />
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-6 w-6 text-slate-400 hover:text-red-600"
                                                            onClick={() => setDeletingItemId(item.id)}
                                                        >
                                                            <Trash2 className="w-3 h-3" />
                                                        </Button>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>

                {/* MODAL */}
                <Dialog open={showModal} onOpenChange={setShowModal}>
                    <DialogContent className="max-w-lg">
                        <DialogHeader>
                            <DialogTitle>{editingItem ? 'Edit Item' : 'Register New Item'}</DialogTitle>
                            <DialogDescription>Define inventory item details.</DialogDescription>
                        </DialogHeader>
                        <Form {...form}>
                            <form onSubmit={form.handleSubmit((v) => mutation.mutate(v))} className="space-y-4 py-2">
                                <div className="grid grid-cols-2 gap-4">
                                    <FormField control={form.control} name="code" render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-xs">Item Code</FormLabel>
                                            <FormControl><Input {...field} placeholder="e.g. CAB-001" className="h-8 text-xs" disabled={!!editingItem} /></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )} />
                                    <FormField control={form.control} name="unit" render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-xs">Unit</FormLabel>
                                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                <FormControl><SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger></FormControl>
                                                <SelectContent>
                                                    <SelectItem value="Nos" className="text-xs">Nos</SelectItem>
                                                    <SelectItem value="m" className="text-xs">Meters (m)</SelectItem>
                                                    <SelectItem value="kg" className="text-xs">Kilogram (kg)</SelectItem>
                                                    <SelectItem value="gram" className="text-xs">Gram</SelectItem>
                                                    <SelectItem value="L" className="text-xs">Liter (L)</SelectItem>
                                                    <SelectItem value="ml" className="text-xs">Milliliter (ml)</SelectItem>
                                                    <SelectItem value="pkts" className="text-xs">Packets (pkts)</SelectItem>
                                                </SelectContent>
                                            </Select>
                                            <FormMessage />
                                        </FormItem>
                                    )} />
                                </div>

                                <FormField control={form.control} name="name" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-xs">Item Name</FormLabel>
                                        <FormControl><Input {...field} placeholder="Item Name" className="h-8 text-xs" /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )} />

                                <div className="grid grid-cols-2 gap-4">
                                    <FormField control={form.control} name="type" render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-xs">Source / Owner</FormLabel>
                                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                <FormControl><SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger></FormControl>
                                                <SelectContent>
                                                    <SelectItem value="SLTS" className="text-xs">SLTS</SelectItem>
                                                    <SelectItem value="SLT" className="text-xs">SLT</SelectItem>
                                                </SelectContent>
                                            </Select>
                                            <FormMessage />
                                        </FormItem>
                                    )} />

                                    <FormField control={form.control} name="category" render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-xs">Usage Category</FormLabel>
                                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                <FormControl><SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger></FormControl>
                                                <SelectContent>
                                                    <SelectItem value="OSP_NEW_CONN" className="text-xs">OSP New Connection</SelectItem>
                                                    <SelectItem value="OSP_PROJECT" className="text-xs">OSP Project</SelectItem>
                                                    <SelectItem value="OTHERS" className="text-xs">Others</SelectItem>
                                                </SelectContent>
                                            </Select>
                                            <FormMessage />
                                        </FormItem>
                                    )} />
                                </div>

                                <FormField control={form.control} name="minLevel" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-xs font-bold text-orange-600 flex items-center gap-2">
                                            <AlertTriangle className="w-3 h-3" /> Low Stock Warning Level
                                        </FormLabel>
                                        <FormControl>
                                            <Input {...field} type="number" placeholder="0 = Disable" className="h-8 text-xs border-orange-200 focus:ring-orange-200" />
                                        </FormControl>
                                        <FormMessage />
                                        <p className="text-[10px] text-slate-400">Set minimum quantity to trigger alerts.</p>
                                    </FormItem>
                                )} />

                                <FormField control={form.control} name="description" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-xs">Description (Optional)</FormLabel>
                                        <FormControl><Input {...field} className="h-8 text-xs" /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )} />

                                <DialogFooter>
                                    <Button type="button" variant="outline" onClick={() => setShowModal(false)}>Cancel</Button>
                                    <Button type="submit" disabled={mutation.isPending}>{mutation.isPending ? 'Saving...' : 'Save Item'}</Button>
                                </DialogFooter>
                            </form>
                        </Form>
                    </DialogContent>
                </Dialog>

                {/* DELETE CONFIRMATION */}
                <Dialog open={!!deletingItemId} onOpenChange={(o) => !o && setDeletingItemId(null)}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Confirm Deletion</DialogTitle>
                            <DialogDescription>
                                Are you sure you want to delete this item? This action cannot be undone.
                                <br /><br />
                                <strong>Note:</strong> You cannot delete an item if it is present in any Stock, GRN, or Transaction.
                            </DialogDescription>
                        </DialogHeader>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setDeletingItemId(null)}>Cancel</Button>
                            <Button
                                variant="destructive"
                                onClick={() => deletingItemId && deleteMutation.mutate(deletingItemId)}
                                disabled={deleteMutation.isPending}
                            >
                                {deleteMutation.isPending ? 'Deleting...' : 'Delete Item'}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

            </main>
        </div>
    );
}

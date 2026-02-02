"use client";

import React, { useState } from 'react';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Search, Plus, Edit2, Trash2, AlertTriangle, CheckSquare, Layers, Tag, Package } from "lucide-react";
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { createItem, updateItem, deleteItem, patchBulkItemsAction } from '@/actions/inventory-actions';

// --- SCHEMA ---
const itemSchema = z.object({
    code: z.string().min(2, "Code is required"),
    name: z.string().min(2, "Name is required"),
    commonName: z.string().optional(), // Added Common Name
    unit: z.enum(['Nos', 'kg', 'L', 'm', 'km', 'pkts', 'Box', 'Bot', 'Set', 'Roll']),
    type: z.enum(['SLT', 'SLTS']),
    category: z.string().min(1, "Category is required"),
    commonFor: z.array(z.string()).optional(),
    minLevel: z.string().optional().refine((val) => !val || !isNaN(parseFloat(val)) && parseFloat(val) >= 0, { message: "Must be a valid number >= 0" }),
    isWastageAllowed: z.boolean(),
    maxWastagePercentage: z.string().optional().refine((val) => !val || !isNaN(parseFloat(val)) && parseFloat(val) >= 0, { message: "Must be a valid number >= 0" }),
    unitPrice: z.string().optional().refine((val) => !val || !isNaN(parseFloat(val)) && parseFloat(val) >= 0, { message: "Must be a valid number >= 0" }),
    costPrice: z.string().optional().refine((val) => !val || !isNaN(parseFloat(val)) && parseFloat(val) >= 0, { message: "Must be a valid number >= 0" }),
    description: z.string().optional(),
    importAliases: z.array(z.string()).optional()
});

type ItemFormValues = z.infer<typeof itemSchema>;

export default function ItemMasterPage() {
    const queryClient = useQueryClient();
    const [searchTerm, setSearchTerm] = useState("");
    const [showModal, setShowModal] = useState(false);
    const [editingItem, setEditingItem] = useState<ItemFormValues & { id: string } | null>(null);
    const [deletingItemId, setDeletingItemId] = useState<string | null>(null);

    // Filter & Batch State
    const [categoryFilter, setCategoryFilter] = useState("ALL");
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [showBulkEdit, setShowBulkEdit] = useState(false);
    const [bulkEditType, setBulkEditType] = useState<'CATEGORY' | 'JOB_TYPE' | 'TYPE' | null>(null);
    const [bulkCategory, setBulkCategory] = useState("OTHERS");
    const [bulkType, setBulkType] = useState("SLTS");
    const [bulkCommonFor, setBulkCommonFor] = useState<string[]>([]);

    // --- QUERIES ---
    const { data: items = [], isLoading } = useQuery<(ItemFormValues & { id: string })[]>({
        queryKey: ['items'],
        queryFn: async () => (await fetch('/api/inventory/items')).json()
    });

    // --- MUTATIONS ---
    const mutation = useMutation({
        mutationFn: async (values: ItemFormValues) => {
            if (editingItem) {
                return await updateItem(editingItem.id, values);
            } else {
                return await createItem(values);
            }
        },
        onSuccess: (result: { success: boolean; error?: string }) => {
            if (result.success) {
                queryClient.invalidateQueries({ queryKey: ['items'] });
                setShowModal(false);
                setEditingItem(null);
                toast.success(editingItem ? "Item updated" : "Item registered successfully");
            } else {
                toast.error(result.error || 'Failed to save item');
            }
        },
        onError: (err: Error) => toast.error(err.message)
    });

    const deleteMutation = useMutation({
        mutationFn: async (id: string) => {
            return await deleteItem(id);
        },
        onSuccess: (result: { success: boolean; error?: string }) => {
            if (result.success) {
                queryClient.invalidateQueries({ queryKey: ['items'] });
                setDeletingItemId(null);
                toast.success("Item deleted successfully");
            } else {
                toast.error(result.error || 'Failed to delete item');
            }
        },
        onError: (err: Error) => toast.error(err.message)
    });

    const bulkMutation = useMutation({
        mutationFn: async () => {
            const updates = Array.from(selectedIds).map((id) => {
                const item = items.find((i) => i.id === id);
                if (!item) return null;

                return {
                    id,
                    category: bulkEditType === 'CATEGORY' ? bulkCategory : item.category,
                    type: bulkEditType === 'TYPE' ? bulkType : item.type,
                    commonFor: bulkEditType === 'JOB_TYPE' ? bulkCommonFor : (item.commonFor || [])
                };
            }).filter(Boolean);

            if (updates.length > 0) {
                return await patchBulkItemsAction(updates);
            }
            return { success: true };
        },
        onSuccess: (result: { success: boolean; error?: string } | undefined) => {
            if (result?.success) {
                queryClient.invalidateQueries({ queryKey: ['items'] });
                setShowBulkEdit(false);
                setSelectedIds(new Set());
                toast.success("Bulk update successful");
            } else {
                toast.error(result?.error || "Failed to update items");
            }
        },
        onError: () => toast.error("Failed to update items")
    });

    // --- FORM ---
    const form = useForm<ItemFormValues>({
        resolver: zodResolver(itemSchema),
        defaultValues: {
            code: '',
            name: '',
            commonName: '',
            unit: 'Nos',
            type: 'SLTS',
            category: 'OTHERS',
            commonFor: ['OTHERS'], // Default tag
            minLevel: '0',
            isWastageAllowed: true,
            maxWastagePercentage: '0',
            unitPrice: '0',
            costPrice: '0',
            description: '',
            importAliases: []
        }
    });

    // Reset form when modal opens/closes or edit changes
    React.useEffect(() => {
        if (showModal) {
            if (editingItem) {
                form.reset({
                    code: editingItem.code,
                    name: editingItem.name,
                    commonName: editingItem.commonName || '',
                    unit: editingItem.unit,
                    type: editingItem.type,
                    category: editingItem.category,
                    commonFor: editingItem.commonFor || ['OTHERS'],
                    minLevel: (editingItem.minLevel ?? 0).toString(),
                    isWastageAllowed: editingItem.isWastageAllowed ?? true,
                    maxWastagePercentage: (editingItem.maxWastagePercentage ?? 0).toString(),
                    unitPrice: (editingItem.unitPrice ?? 0).toString(),
                    costPrice: (editingItem.costPrice ?? 0).toString(),
                    description: editingItem.description || '',
                    importAliases: editingItem.importAliases || []
                });
            } else {
                form.reset({
                    code: '',
                    name: '',
                    commonName: '',
                    unit: 'Nos',
                    type: 'SLTS',
                    category: 'OTHERS',
                    commonFor: ['OTHERS'],
                    minLevel: '0',
                    isWastageAllowed: true,
                    maxWastagePercentage: '0',
                    unitPrice: '0',
                    costPrice: '0',
                    description: '',
                    importAliases: []
                });
            }
        }
    }, [showModal, editingItem, form]);

    const filteredItems = Array.isArray(items) ? items.filter((i) =>
        (categoryFilter === "ALL" || i.category === categoryFilter) &&
        (i.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            i.code.toLowerCase().includes(searchTerm.toLowerCase()))
    ) : [];

    // Batch Selection Logic
    const toggleSelectAll = () => {
        if (selectedIds.size === filteredItems.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(filteredItems.map((i) => i.id)));
        }
    };

    const toggleSelect = (id: string) => {
        const newSet = new Set(selectedIds);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSelectedIds(newSet);
    };

    const categoryLabel = (cat: string) => {
        return cat ? cat.replace(/_/g, ' ') : '-';
    };

    return (
        <div className="h-screen flex bg-slate-50 overflow-hidden" >
            <Sidebar />
            <main className="flex-1 flex flex-col min-w-0 h-full">
                <Header />
                <div className="flex-1 overflow-y-auto p-4 md:p-8">
                    <div className="max-w-6xl mx-auto space-y-6">

                        <div className="flex justify-between items-center">
                            <div>
                                <h1 className="text-xl font-bold text-slate-900">Material Registration</h1>
                                <p className="text-xs text-slate-500">Register SLT and Private materials</p>
                            </div>
                            <Button size="sm" onClick={() => { setEditingItem(null); setShowModal(true); }} className="h-8 text-xs">
                                <Plus className="w-4 h-4 mr-2" /> New Item
                            </Button>
                        </div>

                        <div className="bg-white rounded-xl border shadow-sm flex flex-col min-h-[500px]">
                            {/* Toolbar */}
                            {selectedIds.size > 0 ? (
                                <div className="p-4 border-b flex justify-between items-center bg-blue-50 transition-colors">
                                    <div className="flex items-center gap-4">
                                        <span className="text-sm font-bold text-blue-700 flex items-center gap-2">
                                            <CheckSquare className="w-4 h-4" />
                                            {selectedIds.size} Items Selected
                                        </span>
                                        <div className="h-4 w-[1px] bg-blue-200" />
                                        <div className="flex gap-2">
                                            <Button size="sm" variant="outline" className="h-8 bg-white border-blue-200 text-blue-700 hover:bg-blue-100" onClick={() => { setBulkEditType('TYPE'); setShowBulkEdit(true); }}>
                                                <Package className="w-3.5 h-3.5 mr-2" /> Type
                                            </Button>
                                            <Button size="sm" variant="outline" className="h-8 bg-white border-blue-200 text-blue-700 hover:bg-blue-100" onClick={() => { setBulkEditType('JOB_TYPE'); setShowBulkEdit(true); }}>
                                                <Layers className="w-3.5 h-3.5 mr-2" /> Applicable Job
                                            </Button>
                                            <Button size="sm" variant="outline" className="h-8 bg-white border-blue-200 text-blue-700 hover:bg-blue-100" onClick={() => { setBulkEditType('CATEGORY'); setShowBulkEdit(true); }}>
                                                <Tag className="w-3.5 h-3.5 mr-2" /> Category
                                            </Button>
                                        </div>
                                    </div>
                                    <Button size="sm" variant="ghost" className="h-8 text-blue-700 hover:bg-blue-100" onClick={() => setSelectedIds(new Set())}>
                                        Cancel Selection
                                    </Button>
                                </div>
                            ) : (
                                <div className="p-4 border-b flex justify-between items-center bg-slate-50/50">
                                    <div className="flex items-center gap-3 flex-1">
                                        <div className="relative w-64">
                                            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                                            <Input
                                                placeholder="Search by name or code..."
                                                value={searchTerm}
                                                onChange={e => setSearchTerm(e.target.value)}
                                                className="pl-9 h-9 text-xs"
                                            />
                                        </div>
                                        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                                            <SelectTrigger className="h-9 w-[180px] text-xs">
                                                <SelectValue placeholder="All Categories" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="ALL" className="text-xs">All Categories</SelectItem>
                                                <SelectItem value="CABLES" className="text-xs">Cables & Wires</SelectItem>
                                                <SelectItem value="POLES" className="text-xs">Poles & Concrete</SelectItem>
                                                <SelectItem value="FIBER_ACCESSORIES" className="text-xs">Fiber Accessories</SelectItem>
                                                <SelectItem value="COPPER_ACCESSORIES" className="text-xs">Copper Accessories</SelectItem>
                                                <SelectItem value="HARDWARE" className="text-xs">General Hardware</SelectItem>
                                                <SelectItem value="EQUIPMENT" className="text-xs">Equipment / Tools</SelectItem>
                                                <SelectItem value="OTHERS" className="text-xs">Others</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="text-xs text-slate-500">
                                        Total Items: <strong>{items.length}</strong>
                                    </div>
                                </div>
                            )}

                            {/* Table */}
                            <div className="flex-1 overflow-auto">
                                <table className="w-full text-xs text-left">
                                    <thead className="bg-slate-50 text-slate-600 font-bold border-b sticky top-0">
                                        <tr>
                                            <th className="px-4 py-3 w-[40px]">
                                                <div className="flex items-center justify-center">
                                                    <input
                                                        type="checkbox"
                                                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                                                        checked={selectedIds.size === filteredItems.length && filteredItems.length > 0}
                                                        onChange={toggleSelectAll}
                                                    />
                                                </div>
                                            </th>
                                            <th className="px-4 py-3">Code</th>
                                            <th className="px-4 py-3">Item Name</th>
                                            <th className="px-4 py-3">Unit</th>
                                            <th className="px-4 py-3">Type</th>
                                            <th className="px-4 py-3">Reorder Level</th>
                                            <th className="px-4 py-3">Category</th>
                                            <th className="px-4 py-3">Cost Price</th>
                                            <th className="px-4 py-3">Unit Rate</th>
                                            <th className="px-4 py-3 text-right">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                        {isLoading ? (
                                            <tr><td colSpan={10} className="p-8 text-center text-slate-400">Loading items...</td></tr>
                                        ) : filteredItems.length === 0 ? (
                                            <tr><td colSpan={10} className="p-8 text-center text-slate-400">No items found.</td></tr>
                                        ) : (
                                            filteredItems.map((item) => (
                                                <tr key={item.id} className="hover:bg-slate-50 group">
                                                    <td className="px-4 py-2">
                                                        <div className="flex items-center justify-center">
                                                            <input
                                                                type="checkbox"
                                                                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                                                                checked={selectedIds.has(item.id)}
                                                                onChange={() => toggleSelect(item.id)}
                                                            />
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-2 font-mono text-slate-500">{item.code}</td>
                                                    <td className="px-4 py-2 font-bold text-slate-800">{item.name}</td>
                                                    <td className="px-4 py-2 text-slate-600">{item.unit}</td>
                                                    <td className="px-4 py-2">
                                                        <Badge variant="outline" className={`${item.type === 'SLT' ? 'border-blue-200 bg-blue-50 text-blue-700' : 'border-purple-200 bg-purple-50 text-purple-700'}`}>
                                                            {item.type}
                                                        </Badge>
                                                    </td>
                                                    <td className="px-4 py-2 text-slate-700">
                                                        {item.minLevel && parseFloat(item.minLevel) > 0 ? (
                                                            <div className="flex items-center gap-1">
                                                                <AlertTriangle className="w-3 h-3 text-orange-400" />
                                                                {item.minLevel}
                                                            </div>
                                                        ) : <span className="text-slate-400">-</span>}
                                                    </td>
                                                    <td className="px-4 py-2 text-slate-600">{categoryLabel(item.category)}</td>
                                                    <td className="px-4 py-2 font-bold text-rose-600">Rs. {item.costPrice?.toLocaleString()}</td>
                                                    <td className="px-4 py-2 font-bold text-emerald-600">Rs. {item.unitPrice?.toLocaleString()}</td>
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
                    <DialogContent className="max-w-lg max-h-[95vh] flex flex-col p-0 overflow-hidden">
                        <DialogHeader className="px-6 py-4 border-b">
                            <DialogTitle>{editingItem ? 'Edit Item' : 'Register New Item'}</DialogTitle>
                            <DialogDescription>Define inventory item details.</DialogDescription>
                        </DialogHeader>
                        <Form {...form}>
                            <form onSubmit={form.handleSubmit((v) => mutation.mutate(v))} className="flex-1 flex flex-col overflow-hidden">
                                <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
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
                                                        <SelectItem value="Box" className="text-xs">Box</SelectItem>
                                                        <SelectItem value="pkts" className="text-xs">Packets (pkts)</SelectItem>
                                                        <SelectItem value="km" className="text-xs">Kilometer (km)</SelectItem>
                                                        <SelectItem value="Set" className="text-xs">Set</SelectItem>
                                                        <SelectItem value="Roll" className="text-xs">Roll</SelectItem>
                                                        <SelectItem value="Bot" className="text-xs">Bottle (Bot)</SelectItem>
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
                                                <FormLabel className="text-xs">Item Category</FormLabel>
                                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                    <FormControl><SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger></FormControl>
                                                    <SelectContent>
                                                        <SelectItem value="CABLES" className="text-xs">Cables & Wires</SelectItem>
                                                        <SelectItem value="POLES" className="text-xs">Poles & Concrete</SelectItem>
                                                        <SelectItem value="FIBER_ACCESSORIES" className="text-xs">Fiber Accessories</SelectItem>
                                                        <SelectItem value="COPPER_ACCESSORIES" className="text-xs">Copper Accessories</SelectItem>
                                                        <SelectItem value="HARDWARE" className="text-xs">General Hardware</SelectItem>
                                                        <SelectItem value="EQUIPMENT" className="text-xs">Equipment / Tools</SelectItem>
                                                        <SelectItem value="OTHERS" className="text-xs">Others</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                                <FormMessage />
                                            </FormItem>
                                        )} />
                                    </div>

                                    <FormField control={form.control} name="commonName" render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-xs">SLT Material Name (Master Identifier)</FormLabel>
                                            <FormControl><Input {...field} placeholder="e.g. Drop Wire" className="h-8 text-xs font-bold border-blue-200 bg-blue-50/30" /></FormControl>
                                            <FormMessage />
                                            <p className="text-[10px] text-slate-500 italic">
                                                <strong>CRITICAL:</strong> Use the same name for both SLT and SLTS versions of this material.
                                                This bridges different product codes together for reporting and auto-selection.
                                            </p>
                                        </FormItem>
                                    )} />

                                    <FormField control={form.control} name="importAliases" render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-xs">Import Aliases / SLT UI Names</FormLabel>
                                            <div className="space-y-2">
                                                <div className="flex flex-wrap gap-1.5 p-2 border rounded-md bg-slate-50/50 min-h-[40px]">
                                                    {field.value?.map((alias, i) => (
                                                        <Badge key={i} variant="secondary" className="text-[10px] gap-1 px-1.5 py-0">
                                                            {alias}
                                                            <button type="button" onClick={() => field.onChange(field.value?.filter((_, idx) => idx !== i))} className="hover:text-red-500">
                                                                <Trash2 className="w-2.5 h-2.5" />
                                                            </button>
                                                        </Badge>
                                                    ))}
                                                    {(!field.value || field.value.length === 0) && <span className="text-[10px] text-slate-400 italic">No aliases added...</span>}
                                                </div>
                                                <div className="flex gap-2">
                                                    <Input
                                                        placeholder="Add alias (e.g. FTTH-DW)"
                                                        className="h-8 text-xs flex-1"
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter') {
                                                                e.preventDefault();
                                                                const val = e.currentTarget.value.trim();
                                                                if (val && !field.value?.includes(val)) {
                                                                    field.onChange([...(field.value || []), val]);
                                                                    e.currentTarget.value = '';
                                                                }
                                                            }
                                                        }}
                                                    />
                                                </div>
                                                <p className="text-[9px] text-slate-400">Press Enter to add multiple names seen in SLT system.</p>
                                            </div>
                                        </FormItem>
                                    )} />

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

                                    <div className="p-3 bg-slate-50 rounded border space-y-3">
                                        <FormField control={form.control} name="isWastageAllowed" render={({ field }) => (
                                            <FormItem className="flex flex-row items-center justify-between rounded-lg p-0 space-y-0">
                                                <div>
                                                    <FormLabel className="text-xs font-semibold">Allow Wastage</FormLabel>
                                                    <p className="text-[10px] text-slate-500">Enable wastage entry for this item in SOD.</p>
                                                </div>
                                                <FormControl>
                                                    <Checkbox
                                                        checked={field.value}
                                                        onCheckedChange={field.onChange}
                                                        className="data-[state=checked]:bg-blue-600 border-slate-300"
                                                    />
                                                </FormControl>
                                            </FormItem>
                                        )} />

                                        {form.watch("isWastageAllowed") && (
                                            <FormField control={form.control} name="maxWastagePercentage" render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel className="text-xs">Max Wastage %</FormLabel>
                                                    <FormControl>
                                                        <div className="relative">
                                                            <Input {...field} type="number" placeholder="e.g. 5" className="h-8 text-xs pr-6" />
                                                            <span className="absolute right-2 top-2 text-xs text-slate-400">%</span>
                                                        </div>
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )} />
                                        )}
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <FormField control={form.control} name="costPrice" render={({ field }) => (
                                            <FormItem>
                                                <FormLabel className="text-xs font-bold text-rose-600">Internal Cost (LKR)</FormLabel>
                                                <FormControl><Input {...field} type="number" step="0.01" className="h-8 text-xs border-rose-100" /></FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )} />
                                        <FormField control={form.control} name="unitPrice" render={({ field }) => (
                                            <FormItem>
                                                <FormLabel className="text-xs font-bold text-emerald-600">Unit Rate / Revenue (LKR)</FormLabel>
                                                <FormControl><Input {...field} type="number" step="0.01" className="h-8 text-xs border-emerald-100" /></FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )} />
                                    </div>

                                    <FormField control={form.control} name="description" render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-xs">Description (Optional)</FormLabel>
                                            <FormControl><Input {...field} className="h-8 text-xs" /></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )} />
                                </div>
                                <DialogFooter className="px-6 py-4 border-t">
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

                {/* BULK EDIT MODAL */}
                <Dialog open={showBulkEdit} onOpenChange={setShowBulkEdit}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Bulk Update {selectedIds.size} Items</DialogTitle>
                            <DialogDescription>
                                Updating {bulkEditType === 'CATEGORY' ? 'Category' : bulkEditType === 'TYPE' ? 'Type' : 'Applicable Job Types'} for selected items.
                            </DialogDescription>
                        </DialogHeader>

                        <div className="py-4">
                            {bulkEditType === 'CATEGORY' && (
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Select Category</label>
                                    <Select value={bulkCategory} onValueChange={setBulkCategory}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="CABLES">Cables & Wires</SelectItem>
                                            <SelectItem value="POLES">Poles & Concrete</SelectItem>
                                            <SelectItem value="FIBER_ACCESSORIES">Fiber Accessories</SelectItem>
                                            <SelectItem value="COPPER_ACCESSORIES">Copper Accessories</SelectItem>
                                            <SelectItem value="HARDWARE">General Hardware</SelectItem>
                                            <SelectItem value="EQUIPMENT">Equipment / Tools</SelectItem>
                                            <SelectItem value="OTHERS">Others</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            )}

                            {bulkEditType === 'JOB_TYPE' && (
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Select Job Types</label>
                                    <div className="flex flex-wrap gap-4">
                                        {['FTTH', 'PSTN', 'OSP', 'OTHERS'].map(type => (
                                            <div key={type} className="flex items-center gap-2">
                                                <input
                                                    type="checkbox"
                                                    id={`bulk-${type}`}
                                                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                                    checked={bulkCommonFor.includes(type)}
                                                    onChange={(e) => {
                                                        if (e.target.checked) setBulkCommonFor([...bulkCommonFor, type]);
                                                        else setBulkCommonFor(bulkCommonFor.filter(t => t !== type));
                                                    }}
                                                />
                                                <label htmlFor={`bulk-${type}`} className="text-sm cursor-pointer">{type}</label>
                                            </div>
                                        ))}
                                    </div>
                                    <p className="text-xs text-slate-500 pt-2">Note: This will overwrite existing job types for selected items.</p>
                                </div>
                            )}

                            {bulkEditType === 'TYPE' && (
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Select Type (Source)</label>
                                    <Select value={bulkType} onValueChange={setBulkType}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="SLTS">SLTS</SelectItem>
                                            <SelectItem value="SLT">SLT</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            )}
                        </div>

                        <DialogFooter>
                            <Button variant="outline" onClick={() => setShowBulkEdit(false)}>Cancel</Button>
                            <Button onClick={() => bulkMutation.mutate()} disabled={bulkMutation.isPending}>
                                {bulkMutation.isPending ? 'Updating...' : 'Update All'}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

            </main>
        </div >
    );
}

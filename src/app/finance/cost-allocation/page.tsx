"use client";

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { 
    FileText, Plus, Landmark, DollarSign, Layers, Calendar, Trash2, Link as LinkIcon, ClipboardList
} from 'lucide-react';

interface MemoItem {
    id?: string;
    itemName: string;
    quantity: number;
    unitCost: number;
    totalCost?: number;
}

interface CostMemo {
    id: string;
    memoNumber: string;
    title: string;
    description?: string;
    allocationTarget?: string;
    approvedAt?: string | null;
    receivedAt?: string | null;
    documentUrl?: string | null;
    totalCost: number;
    journalEntryId?: string | null;
    createdAt: string;
    items: MemoItem[];
}

export default function CostAllocationPage() {
    const queryClient = useQueryClient();
    const [createDialogOpen, setCreateDialogOpen] = useState(false);
    
    // Form States
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [allocationTarget, setAllocationTarget] = useState('');
    const [approvedAt, setApprovedAt] = useState('');
    const [receivedAt, setReceivedAt] = useState('');
    const [documentUrl, setDocumentUrl] = useState('');
    
    // Nested items list
    const [formItems, setFormItems] = useState<MemoItem[]>([
        { itemName: '', quantity: 1, unitCost: 0 }
    ]);

    // Fetch Cost Memos
    const { data: memos = [], isLoading: loadingMemos } = useQuery<CostMemo[]>({
        queryKey: ['cost-allocation-memos'],
        queryFn: async () => {
            const res = await fetch('/api/admin/finance/cost-allocation');
            const data = await res.json();
            return data.data || [];
        }
    });

    // Create Memo Mutation
    const createMemoMutation = useMutation({
        mutationFn: async (payload: any) => {
            const userId = localStorage.getItem("erp_user_id") || "";
            const role = localStorage.getItem("erp_user_role") || "";

            const res = await fetch('/api/admin/finance/cost-allocation', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-user-id': userId,
                    'x-user-role': role
                },
                body: JSON.stringify(payload)
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.message || data.error || 'Failed to create cost memo');
            return data.data;
        },
        onSuccess: () => {
            toast.success("Cost Allocation Memo registered successfully!");
            setCreateDialogOpen(false);
            // Reset form
            setTitle('');
            setDescription('');
            setAllocationTarget('');
            setApprovedAt('');
            setReceivedAt('');
            setDocumentUrl('');
            setFormItems([{ itemName: '', quantity: 1, unitCost: 0 }]);
            queryClient.invalidateQueries({ queryKey: ['cost-allocation-memos'] });
        },
        onError: (error: any) => {
            toast.error(error.message);
        }
    });

    const handleAddItemRow = () => {
        setFormItems([...formItems, { itemName: '', quantity: 1, unitCost: 0 }]);
    };

    const handleRemoveItemRow = (index: number) => {
        if (formItems.length === 1) return;
        setFormItems(formItems.filter((_, i) => i !== index));
    };

    const handleItemChange = (index: number, key: keyof MemoItem, value: any) => {
        const updated = [...formItems];
        if (key === 'quantity' || key === 'unitCost') {
            updated[index][key] = Number(value);
        } else {
            updated[index][key] = value as never;
        }
        setFormItems(updated);
    };

    const handleCreateMemo = (e: React.FormEvent) => {
        e.preventDefault();
        if (!title) {
            return toast.error("Please fill in the Memo Title.");
        }
        if (formItems.some(i => !i.itemName || i.quantity <= 0 || i.unitCost < 0)) {
            return toast.error("Please fill in all item names and set valid quantities/costs.");
        }

        createMemoMutation.mutate({
            title,
            description,
            allocationTarget: allocationTarget || 'General',
            approvedAt: approvedAt || null,
            receivedAt: receivedAt || null,
            documentUrl: documentUrl || null,
            items: formItems
        });
    };

    // Calculate Summary Stats
    const totalAllocated = memos.reduce((sum, m) => sum + m.totalCost, 0);
    const totalItemsCount = memos.reduce((sum, m) => sum + m.items.reduce((iSum, item) => iSum + item.quantity, 0), 0);

    const calculatedTotalCost = formItems.reduce((sum, item) => sum + (item.quantity * item.unitCost), 0);

    return (
        <div className="erp-page-wrapper flex-row overflow-hidden">
            <Sidebar />
            <main className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
                <Header />
                <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
                    <div className="max-w-7xl mx-auto space-y-6">
                        
                        {/* Title Header */}
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b pb-4">
                            <div className="space-y-0.5">
                                <h1 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                                    <Landmark className="w-5 h-5 text-emerald-600 animate-pulse" />
                                    Cost Center Allocation Memos
                                </h1>
                                <p className="text-xs text-slate-500">Record and track manual allocation memos for internal items, printers, laptops, and OSP cost center transfers.</p>
                            </div>
                            <Button 
                                onClick={() => setCreateDialogOpen(true)}
                                className="bg-slate-900 hover:bg-slate-800 text-white h-9 text-xs font-bold flex items-center gap-1.5 shadow-sm rounded-lg"
                            >
                                <Plus className="w-4 h-4" /> Register Received Memo
                            </Button>
                        </div>

                        {/* Summary Widget Cards */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            
                            <Card className="border-slate-200 bg-white shadow-sm">
                                <CardContent className="p-4 flex items-center justify-between">
                                    <div className="space-y-1">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Allocated Cost</span>
                                        <span className="text-2xl font-black text-slate-900">{totalAllocated.toLocaleString()} LKR</span>
                                    </div>
                                    <div className="h-10 w-10 bg-emerald-50 rounded-lg flex items-center justify-center text-emerald-600">
                                        <DollarSign className="w-5 h-5" />
                                    </div>
                                </CardContent>
                            </Card>

                            <Card className="border-slate-200 bg-white shadow-sm">
                                <CardContent className="p-4 flex items-center justify-between">
                                    <div className="space-y-1">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Memos Registered</span>
                                        <span className="text-2xl font-black text-slate-900">{memos.length} Memos</span>
                                    </div>
                                    <div className="h-10 w-10 bg-blue-50 rounded-lg flex items-center justify-center text-blue-600">
                                        <FileText className="w-5 h-5" />
                                    </div>
                                </CardContent>
                            </Card>

                            <Card className="border-slate-200 bg-white shadow-sm">
                                <CardContent className="p-4 flex items-center justify-between">
                                    <div className="space-y-1">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Items Transferred</span>
                                        <span className="text-2xl font-black text-slate-900">{totalItemsCount} Units</span>
                                    </div>
                                    <div className="h-10 w-10 bg-purple-50 rounded-lg flex items-center justify-center text-purple-600">
                                        <ClipboardList className="w-5 h-5" />
                                    </div>
                                </CardContent>
                            </Card>

                        </div>

                        {/* Memos Table */}
                        <Card className="border-slate-200 bg-white shadow-sm">
                            <CardHeader className="py-3 px-4 border-b border-slate-100 bg-slate-50/50">
                                <CardTitle className="text-xs font-black uppercase text-slate-800 flex items-center gap-1.5 tracking-wider">
                                    <Layers className="w-4 h-4 text-emerald-600" />
                                    Registered Memo History
                                </CardTitle>
                            </CardHeader>
                            <div className="overflow-x-auto">
                                {loadingMemos ? (
                                    <div className="py-20 text-center text-xs text-slate-400">Loading cost allocation history...</div>
                                ) : memos.length === 0 ? (
                                    <div className="py-20 text-center text-xs text-slate-400 italic">No cost allocation memos registered yet.</div>
                                ) : (
                                    <Table>
                                        <TableHeader className="bg-slate-50 border-b border-slate-200">
                                            <TableRow>
                                                <TableHead className="h-8 text-[10px] font-bold text-slate-500 uppercase tracking-wider py-2">Memo Number</TableHead>
                                                <TableHead className="h-8 text-[10px] font-bold text-slate-500 uppercase tracking-wider py-2">Dates</TableHead>
                                                <TableHead className="h-8 text-[10px] font-bold text-slate-500 uppercase tracking-wider py-2">Allocation Target</TableHead>
                                                <TableHead className="h-8 text-[10px] font-bold text-slate-500 uppercase tracking-wider py-2">Title / Description</TableHead>
                                                <TableHead className="h-8 text-[10px] font-bold text-slate-500 uppercase tracking-wider py-2">Items Included</TableHead>
                                                <TableHead className="h-8 text-[10px] font-bold text-slate-500 uppercase tracking-wider py-2 text-right">Total Cost (LKR)</TableHead>
                                                <TableHead className="h-8 text-[10px] font-bold text-slate-500 uppercase tracking-wider py-2 text-center">Docs</TableHead>
                                                <TableHead className="h-8 text-[10px] font-bold text-slate-500 uppercase tracking-wider py-2 text-center">GL Entry</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {memos.map((memo) => (
                                                <TableRow key={memo.id} className="hover:bg-slate-50/50 transition-colors">
                                                    <TableCell className="py-2.5 font-mono text-xs font-bold text-slate-900">{memo.memoNumber}</TableCell>
                                                    <TableCell className="py-2.5 text-xs text-slate-600">
                                                        <div className="flex flex-col space-y-0.5">
                                                            {memo.approvedAt && (
                                                                <span className="flex items-center gap-1 text-[10px]"><Calendar className="w-3 h-3 text-emerald-500" /> App: {new Date(memo.approvedAt).toLocaleDateString()}</span>
                                                            )}
                                                            {memo.receivedAt && (
                                                                <span className="flex items-center gap-1 text-[10px]"><Calendar className="w-3 h-3 text-blue-500" /> Recv: {new Date(memo.receivedAt).toLocaleDateString()}</span>
                                                            )}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="py-2.5 text-xs font-bold text-slate-700">
                                                        {memo.allocationTarget || 'General'}
                                                    </TableCell>
                                                    <TableCell className="py-2.5 text-xs">
                                                        <div className="font-bold text-slate-800">{memo.title}</div>
                                                        <div className="text-[10px] text-slate-400 italic">{memo.description}</div>
                                                    </TableCell>
                                                    <TableCell className="py-2.5 text-xs text-slate-700">
                                                        <div className="flex flex-col gap-1 max-w-[240px]">
                                                            {memo.items.map((item, idx) => (
                                                                <div key={item.id || idx} className="text-[10px] bg-slate-50 border border-slate-100 rounded px-1.5 py-0.5 flex justify-between">
                                                                    <span className="font-medium truncate max-w-[150px]">{item.itemName}</span>
                                                                    <span className="font-bold text-slate-500">x{item.quantity}</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="py-2.5 text-xs text-right font-black text-emerald-700">{memo.totalCost.toLocaleString()}</TableCell>
                                                    <TableCell className="py-2.5 text-xs text-center">
                                                        {memo.documentUrl ? (
                                                            <a href={memo.documentUrl} target="_blank" rel="noreferrer" className="text-blue-600 hover:text-blue-800 inline-flex items-center gap-0.5">
                                                                <LinkIcon className="w-3.5 h-3.5" /> Link
                                                            </a>
                                                        ) : (
                                                            <span className="text-[10px] text-slate-400 italic">None</span>
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="py-2.5 text-xs text-center">
                                                        {memo.journalEntryId ? (
                                                            <span className="font-mono text-[9px] bg-emerald-50 text-emerald-700 px-2 py-0.5 border border-emerald-100 rounded font-bold" title={memo.journalEntryId}>
                                                                POSTED
                                                            </span>
                                                        ) : (
                                                            <span className="text-[9px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded">
                                                                PENDING
                                                            </span>
                                                        )}
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                )}
                            </div>
                        </Card>

                    </div>
                </div>
            </main>

            {/* --- REGISTER MEMO DIALOG MODAL --- */}
            <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
                <DialogContent className="sm:max-w-[560px] bg-white border border-slate-200 overflow-y-auto max-h-[90vh]">
                    <DialogHeader>
                        <DialogTitle className="text-sm font-black uppercase text-slate-800 flex items-center gap-1.5">
                            <Landmark className="w-4 h-4 text-emerald-600" />
                            Register Cost Allocation Memo
                        </DialogTitle>
                        <DialogDescription className="text-xs text-slate-500">
                            Log a manually issued memo and record the items and totals under the OSP/Target cost center ledger expense.
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleCreateMemo} className="space-y-4 py-3">
                        
                        {/* Title */}
                        <div className="space-y-1">
                            <Label className="text-[10px] font-bold text-slate-500 uppercase">Memo Title / Purpose *</Label>
                            <Input 
                                placeholder="e.g. Allocation of Laptops and Printers from Head Office" 
                                value={title} 
                                onChange={(e) => setTitle(e.target.value)}
                                className="h-8 text-xs bg-white border-slate-200"
                                required
                            />
                        </div>

                        {/* Target & Document Url */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <Label className="text-[10px] font-bold text-slate-500 uppercase">Allocation Target / Dept *</Label>
                                <Input 
                                    placeholder="e.g. IT Department, OPMC MD" 
                                    value={allocationTarget} 
                                    onChange={(e) => setAllocationTarget(e.target.value)}
                                    className="h-8 text-xs bg-white border-slate-200"
                                    required
                                />
                            </div>
                            <div className="space-y-1">
                                <Label className="text-[10px] font-bold text-slate-500 uppercase">Procurement Doc Link / URL</Label>
                                <Input 
                                    placeholder="e.g. https://docs.slt.lk/procurement/memo-101.pdf" 
                                    value={documentUrl} 
                                    onChange={(e) => setDocumentUrl(e.target.value)}
                                    className="h-8 text-xs bg-white border-slate-200"
                                />
                            </div>
                        </div>

                        {/* Dates: Approved at & Received at */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <Label className="text-[10px] font-bold text-slate-500 uppercase">Approved Date</Label>
                                <Input 
                                    type="date"
                                    value={approvedAt} 
                                    onChange={(e) => setApprovedAt(e.target.value)}
                                    className="h-8 text-xs bg-white border-slate-200"
                                />
                            </div>
                            <div className="space-y-1">
                                <Label className="text-[10px] font-bold text-slate-500 uppercase">Goods Received Date</Label>
                                <Input 
                                    type="date"
                                    value={receivedAt} 
                                    onChange={(e) => setReceivedAt(e.target.value)}
                                    className="h-8 text-xs bg-white border-slate-200"
                                />
                            </div>
                        </div>

                        {/* Comments */}
                        <div className="space-y-1">
                            <Label className="text-[10px] font-bold text-slate-500 uppercase">Description / Comments</Label>
                            <Input 
                                placeholder="Additional reference details..." 
                                value={description} 
                                onChange={(e) => setDescription(e.target.value)}
                                className="h-8 text-xs bg-white border-slate-200"
                            />
                        </div>

                        {/* Items Section */}
                        <div className="space-y-2 border-t pt-3">
                            <div className="flex justify-between items-center">
                                <Label className="text-[10px] font-bold text-slate-500 uppercase">Items List *</Label>
                                <Button 
                                    type="button" 
                                    onClick={handleAddItemRow}
                                    className="bg-slate-100 text-slate-800 hover:bg-slate-200 h-6 text-[10px] font-bold px-2 flex items-center gap-1 rounded"
                                >
                                    <Plus className="w-3.5 h-3.5" /> Add Item Row
                                </Button>
                            </div>
                            
                            <div className="space-y-2 max-h-[160px] overflow-y-auto border p-2 rounded bg-slate-50">
                                {formItems.map((item, index) => (
                                    <div key={index} className="flex gap-2 items-center">
                                        <Input 
                                            placeholder="Item Name (e.g. Laser Printer)"
                                            value={item.itemName}
                                            onChange={(e) => handleItemChange(index, 'itemName', e.target.value)}
                                            className="h-7 text-xs bg-white flex-1"
                                            required
                                        />
                                        <Input 
                                            type="number"
                                            placeholder="Qty"
                                            min="1"
                                            value={item.quantity}
                                            onChange={(e) => handleItemChange(index, 'quantity', e.target.value)}
                                            className="h-7 text-xs bg-white w-14 text-center"
                                            required
                                        />
                                        <Input 
                                            type="number"
                                            placeholder="Unit Cost"
                                            min="0"
                                            value={item.unitCost}
                                            onChange={(e) => handleItemChange(index, 'unitCost', e.target.value)}
                                            className="h-7 text-xs bg-white w-24 text-right"
                                            required
                                        />
                                        <Button 
                                            type="button" 
                                            onClick={() => handleRemoveItemRow(index)}
                                            disabled={formItems.length === 1}
                                            className="h-7 w-7 bg-red-50 text-red-600 hover:bg-red-100 p-0 flex items-center justify-center rounded"
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Calculated Total Info */}
                        {calculatedTotalCost > 0 && (
                            <div className="p-2.5 bg-slate-100 rounded border flex items-center justify-between text-xs font-bold text-slate-700">
                                <span>Calculated Total Cost:</span>
                                <span className="text-emerald-700 font-black">{calculatedTotalCost.toLocaleString()} LKR</span>
                            </div>
                        )}

                        <DialogFooter className="pt-2">
                            <Button 
                                type="button" 
                                variant="outline" 
                                onClick={() => setCreateDialogOpen(false)}
                                className="h-8 text-xs border-slate-200"
                            >
                                Cancel
                            </Button>
                            <Button 
                                type="submit" 
                                disabled={createMemoMutation.isPending}
                                className="bg-slate-900 hover:bg-slate-800 text-white h-8 text-xs font-bold"
                            >
                                {createMemoMutation.isPending ? 'Saving Record...' : 'Register Memo'}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
}

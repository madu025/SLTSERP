
"use client";

import React, { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Trash, Plus, AlertTriangle, History, FilePlus, Search } from "lucide-react";
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import { cn } from "@/lib/utils";

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

    // History Filters
    const [historyMonth, setHistoryMonth] = useState<string>(new Date().toISOString().slice(0, 7));

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

    const { data: history = [], isLoading: isHistoryLoading } = useQuery({
        queryKey: ['wastage-history', historyMonth],
        queryFn: async () => (await fetch(`/api/inventory/wastage/history?month=${historyMonth}`)).json()
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
        if (!selectedContractor && !selectedStore) {
            toast.error("Please select a Store or Contractor");
            return;
        }

        const validItems = rows.filter(r => r.itemId && r.quantity > 0);
        if (validItems.length === 0) {
            toast.error("Please add at least one valid item");
            return;
        }

        wastageMutation.mutate({
            contractorId: selectedContractor || undefined,
            storeId: selectedStore || undefined,
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
        <div className="flex h-screen bg-slate-50 overflow-hidden">
            <Sidebar />
            <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
                <Header />
                <div className="flex-1 overflow-y-auto p-4 md:p-8">
                    <div className="max-w-6xl mx-auto space-y-6">
                        <div className="flex justify-between items-center">
                            <div>
                                <h1 className="text-2xl font-bold text-slate-900">Wastage & Loss Management</h1>
                                <p className="text-slate-500 text-sm">Monitor and report material wastage across RTOMs and Contractors.</p>
                            </div>
                        </div>

                        <Tabs defaultValue="report" className="w-full">
                            <TabsList className="grid w-full grid-cols-2 max-w-[400px]">
                                <TabsTrigger value="report" className="gap-2">
                                    <FilePlus className="w-4 h-4" />
                                    New Wastage Report
                                </TabsTrigger>
                                <TabsTrigger value="history" className="gap-2">
                                    <History className="w-4 h-4" />
                                    Wastage Logs
                                </TabsTrigger>
                            </TabsList>

                            {/* --- NEW REPORT TAB --- */}
                            <TabsContent value="report" className="space-y-6 mt-4 animate-in fade-in-50">
                                <Card className="border-red-100 bg-red-50/10 shadow-sm">
                                    <CardHeader>
                                        <CardTitle className="text-sm font-bold uppercase text-red-600 flex items-center">
                                            <AlertTriangle className="w-4 h-4 mr-2" />
                                            Incident Identification
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="space-y-4">
                                            <div className="space-y-2">
                                                <Label className="text-xs font-bold text-slate-500 uppercase">Context (Contractor - Optional)</Label>
                                                <Select value={selectedContractor} onValueChange={setSelectedContractor}>
                                                    <SelectTrigger className="bg-white">
                                                        <SelectValue placeholder="Contractor (If field wastage)" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="none">Store Only (No Contractor)</SelectItem>
                                                        {contractors.map((c: any) => (
                                                            <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>

                                            <div className="space-y-2">
                                                <Label className="text-xs font-bold text-slate-500 uppercase">Store / RTOM</Label>
                                                <Select value={selectedStore} onValueChange={setSelectedStore}>
                                                    <SelectTrigger className="bg-white">
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
                                                <Label className="text-xs font-bold text-slate-500 uppercase">Month of Incident</Label>
                                                <Input
                                                    type="month"
                                                    value={month}
                                                    onChange={(e) => setMonth(e.target.value)}
                                                    className="bg-white"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label className="text-xs font-bold text-slate-500 uppercase">Description / Reason</Label>
                                                <Textarea
                                                    placeholder="Explain how the wastage/loss occurred..."
                                                    value={description}
                                                    onChange={(e) => setDescription(e.target.value)}
                                                    className="bg-white min-h-[100px]"
                                                />
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>

                                <Card className="border-none shadow-sm overflow-hidden">
                                    <CardContent className="p-0">
                                        <Table>
                                            <TableHeader className="bg-slate-50">
                                                <TableRow>
                                                    <TableHead className="w-[45%]">Item Name</TableHead>
                                                    <TableHead className="w-[15%]">Unit</TableHead>
                                                    <TableHead className="w-[20%] text-right">Quantity</TableHead>
                                                    <TableHead className="w-[10%] text-center">Action</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {rows.map((row, idx) => (
                                                    <TableRow key={idx}>
                                                        <TableCell>
                                                            <Select value={row.itemId} onValueChange={(v) => handleItemChange(idx, v)}>
                                                                <SelectTrigger className="border-none bg-transparent hover:bg-slate-50 transition-all">
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
                                                        <TableCell className="text-slate-400 text-xs font-mono uppercase">
                                                            {row.unit || '---'}
                                                        </TableCell>
                                                        <TableCell>
                                                            <Input
                                                                type="number"
                                                                min="0"
                                                                placeholder="0.00"
                                                                className="text-right font-bold border-none bg-transparent"
                                                                value={row.quantity || ''}
                                                                onChange={(e) => handleUpdateRow(idx, 'quantity', parseFloat(e.target.value))}
                                                            />
                                                        </TableCell>
                                                        <TableCell className="text-center">
                                                            <Button variant="ghost" size="sm" onClick={() => handleRemoveRow(idx)}>
                                                                <Trash className="w-4 h-4 text-red-400" />
                                                            </Button>
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>

                                        <div className="p-4 bg-slate-50/50 border-t flex justify-center">
                                            <Button variant="outline" size="sm" onClick={handleAddRow} className="bg-white text-xs h-8">
                                                <Plus className="w-3 h-3 mr-2" /> Add Material Line
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>

                                <div className="flex justify-end gap-3 pt-4">
                                    <Button variant="outline" onClick={() => router.back()}>Cancel</Button>
                                    <Button onClick={handleSubmit} disabled={wastageMutation.isPending} variant="destructive" className="px-8 shadow-lg shadow-red-100">
                                        {wastageMutation.isPending ? 'Reporting...' : (
                                            <>
                                                <CheckCircle2 className="w-4 h-4 mr-2" /> Finalize Wastage Record
                                            </>
                                        )}
                                    </Button>
                                </div>
                            </TabsContent>

                            {/* --- HISTORY TAB --- */}
                            <TabsContent value="history" className="mt-4 animate-in fade-in-50">
                                <Card className="border-none shadow-sm">
                                    <CardHeader className="flex flex-row items-center justify-between">
                                        <div>
                                            <CardTitle className="text-lg font-bold">Wastage Logs</CardTitle>
                                            <CardDescription>Review past material wastage and loss incidents.</CardDescription>
                                        </div>
                                        <div className="flex items-center gap-2 bg-slate-50 p-1 rounded-lg border">
                                            <Label className="pl-2 text-[10px] font-bold text-slate-400 uppercase">Period:</Label>
                                            <Input 
                                                type="month" 
                                                className="w-[160px] h-8 border-none bg-transparent" 
                                                value={historyMonth}
                                                onChange={(e) => setHistoryMonth(e.target.value)}
                                            />
                                        </div>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="border rounded-xl overflow-hidden bg-white">
                                            <Table>
                                                <TableHeader className="bg-slate-50">
                                                    <TableRow>
                                                        <TableHead>Date / Category</TableHead>
                                                        <TableHead>Target Entity</TableHead>
                                                        <TableHead>Materials Impacted</TableHead>
                                                        <TableHead>Reason</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {isHistoryLoading ? (
                                                        <TableRow><TableCell colSpan={4} className="text-center py-10">Loading logs...</TableCell></TableRow>
                                                    ) : history.length === 0 ? (
                                                        <TableRow><TableCell colSpan={4} className="text-center py-10 text-slate-400">No wastage records found for this period.</TableCell></TableRow>
                                                    ) : (
                                                        history.map((log: any) => (
                                                            <TableRow key={log.id} className="hover:bg-slate-50/50">
                                                                <TableCell>
                                                                    <div className="flex flex-col">
                                                                        <span className="text-xs font-bold text-slate-800">{new Date(log.date).toLocaleDateString()}</span>
                                                                        <span className={cn(
                                                                            "text-[9px] px-1.5 py-0.5 rounded-sm font-bold w-fit mt-1",
                                                                            log.type === 'CONTRACTOR' ? "bg-amber-100 text-amber-800" : "bg-blue-100 text-blue-800"
                                                                        )}>
                                                                            {log.type}
                                                                        </span>
                                                                    </div>
                                                                </TableCell>
                                                                <TableCell>
                                                                    <div className="flex flex-col">
                                                                        <span className="font-medium text-slate-900">{log.entityName}</span>
                                                                        <span className="text-[10px] text-slate-400">{log.storeName}</span>
                                                                    </div>
                                                                </TableCell>
                                                                <TableCell>
                                                                    <div className="space-y-1">
                                                                        {log.items.map((i: any, idx: number) => (
                                                                            <div key={idx} className="flex justify-between text-xs border-b border-slate-50 pb-1 last:border-0 mr-4">
                                                                                <span className="text-slate-600">{i.name}</span>
                                                                                <span className="font-bold text-red-600">-{i.quantity}</span>
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                </TableCell>
                                                                <TableCell className="max-w-[200px]">
                                                                    <p className="text-xs text-slate-500 italic truncate" title={log.description}>
                                                                        {log.description || 'No reason specified'}
                                                                    </p>
                                                                </TableCell>
                                                            </TableRow>
                                                        ))
                                                    )}
                                                </TableBody>
                                            </Table>
                                        </div>
                                    </CardContent>
                                </Card>
                            </TabsContent>
                        </Tabs>
                    </div>
                </div>
            </main>
        </div>
    );
}

function CheckCircle2(props: any) {
    return (
        <svg
            {...props}
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
        </svg>
    )
}

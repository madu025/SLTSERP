
"use client";

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Trash, Plus, AlertTriangle, History, FilePlus, CheckCircle2, ShieldCheck } from "lucide-react";
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import { cn } from "@/lib/utils";

interface ContractorItem {
    id: string;
    name: string;
}

interface ContractorResponse {
    success: boolean;
    data?: {
        contractors: ContractorItem[];
    };
    contractors?: ContractorItem[];
}

interface StoreItem {
    id: string;
    name: string;
}

interface InventoryItem {
    id: string;
    code: string;
    name: string;
    unit: string;
}

interface ContractorStockItem {
    itemId: string;
    quantity: number;
}

interface WastageLogItem {
    id: string;
    date: string;
    description: string;
    entityName: string;
    storeName: string;
    status: string;
    items: Array<{
        name: string;
        quantity: number;
    }>;
}

interface WastagePayload {
    contractorId?: string;
    storeId?: string;
    month: string;
    description: string;
    items: Array<{ itemId: string; quantity: number; unit: string }>;
}

interface WastageMutationResponse {
    success: boolean;
    status?: string;
    message?: string;
}

interface ApproveMutationResponse {
    success: boolean;
    message?: string;
}

export default function WastageReportPage() {
    const router = useRouter();
    const queryClient = useQueryClient();

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

    // Auth Helper
    const getAuthHeaders = () => {
        const userId = localStorage.getItem("erp_user_id") || "";
        const role = localStorage.getItem("erp_user_role") || "";
        return { 'x-user-id': userId, 'x-user-role': role };
    };

    // --- FETCH DATA ---
    const { data: contractorsData } = useQuery<ContractorResponse>({
        queryKey: ['contractors'],
        queryFn: async () => (await fetch('/api/contractors?page=1&limit=1000')).json()
    });
    const contractors: ContractorItem[] = contractorsData?.success && Array.isArray(contractorsData.data?.contractors)
        ? contractorsData.data.contractors
        : Array.isArray(contractorsData?.contractors)
            ? contractorsData.contractors
            : [];

    const { data: stores = [] } = useQuery<StoreItem[]>({
        queryKey: ['stores'],
        queryFn: async () => (await fetch('/api/stores')).json()
    });

    const { data: items = [] } = useQuery<InventoryItem[]>({
        queryKey: ['inventory-items'],
        queryFn: async () => (await fetch('/api/inventory/items')).json()
    });

    const { data: contractorStock = [] } = useQuery<ContractorStockItem[]>({
        queryKey: ['contractor-stock-for-wastage', selectedContractor],
        queryFn: async () => {
            if (!selectedContractor || selectedContractor === 'none') return [];
            const res = await fetch(`/api/inventory/in-hand-stock?contractorId=${selectedContractor}`);
            return res.json() as Promise<ContractorStockItem[]>;
        },
        enabled: !!selectedContractor && selectedContractor !== 'none'
    });

    const { data: history = [], isLoading: isHistoryLoading } = useQuery<WastageLogItem[]>({
        queryKey: ['wastage-history', historyMonth],
        queryFn: async () => {
            const res = await fetch(`/api/inventory/wastage/history?month=${historyMonth}`, { headers: getAuthHeaders() });
            return res.json() as Promise<WastageLogItem[]>;
        }
    });

    // --- MUTATIONS ---
    const wastageMutation = useMutation<WastageMutationResponse, Error, WastagePayload>({
        mutationFn: async (data) => {
            const res = await fetch('/api/inventory/wastage', {
                method: 'POST',
                headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.message || 'Failed to report wastage');
            }
            return res.json();
        },
        onSuccess: (data) => {
            if (data.status === 'PENDING') {
                toast.info("Record saved. High-value materials require manager approval.");
            } else {
                toast.success("Wastage reported and stock updated!");
            }
            setRows([{ itemId: '', quantity: 0, unit: '', name: '' }]);
            setDescription('');
            queryClient.invalidateQueries({ queryKey: ['wastage-history'] });
        },
        onError: (err) => toast.error(err.message)
    });

    const approveMutation = useMutation<ApproveMutationResponse, Error, string>({
        mutationFn: async (id) => {
            const res = await fetch('/api/inventory/wastage/approve', {
                method: 'POST',
                headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
                body: JSON.stringify({ id })
            });
            if (!res.ok) throw new Error('Approval failed');
            return res.json();
        },
        onSuccess: () => {
            toast.success("Wastage approved and stock adjusted.");
            queryClient.invalidateQueries({ queryKey: ['wastage-history'] });
        },
        onError: (err) => toast.error(err.message)
    });

    // --- HANDLERS ---
    const handleAddRow = () => setRows([...rows, { itemId: '', quantity: 0, unit: '', name: '' }]);

    const handleRemoveRow = (idx: number) => {
        if (rows.length === 1) return;
        setRows(rows.filter((_, i) => i !== idx));
    };

    const handleItemChange = (idx: number, itemId: string) => {
        const item = items.find((i: InventoryItem) => i.id === itemId);
        const newRows = [...rows];
        newRows[idx] = { ...newRows[idx], itemId, name: item?.name || '', unit: item?.unit || 'Nos' };
        setRows(newRows);
    };

    const handleUpdateRow = (idx: number, field: string, value: string | number) => {
        const newRows = [...rows];
        (newRows[idx] as Record<string, unknown>)[field] = value;
        setRows(newRows);
    };

    const handleSubmit = () => {
        if (!selectedContractor && !selectedStore) return toast.error("Select Store or Contractor");
        const validItems = rows.filter(r => r.itemId && r.quantity > 0);
        if (validItems.length === 0) return toast.error("Add valid items");

        wastageMutation.mutate({
            contractorId: (selectedContractor && selectedContractor !== 'none') ? selectedContractor : undefined,
            storeId: selectedStore || undefined,
            month,
            description,
            items: validItems.map(r => ({ itemId: r.itemId, quantity: r.quantity, unit: r.unit }))
        });
    };

    const isPrivileged = typeof window !== 'undefined' ? ['OSP_MANAGER', 'SUPER_ADMIN', 'ADMIN'].includes(localStorage.getItem("erp_user_role") || "") : false;

    return (
        <div className="erp-page-wrapper flex-row overflow-hidden">
            <Sidebar />
            <main className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
                <Header />
                <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
                    <div className="max-w-7xl mx-auto space-y-4">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                            <div className="space-y-0.5">
                                <h1 className="text-xl font-black text-slate-900 tracking-tight">Wastage & Loss Management</h1>
                                <p className="text-xs text-slate-500">Monitor and report material wastage across RTOMs and Contractors.</p>
                            </div>
                        </div>

                        <Tabs defaultValue="report" className="w-full">
                            <TabsList className="grid w-full grid-cols-2 max-w-[320px] h-8 p-0.5 bg-slate-100 border border-slate-200 rounded-lg">
                                <TabsTrigger value="report" className="gap-2 text-xs h-7 data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm">
                                    <FilePlus className="w-3.5 h-3.5" />
                                    New Wastage
                                </TabsTrigger>
                                <TabsTrigger value="history" className="gap-2 text-xs h-7 data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm">
                                    <History className="w-3.5 h-3.5" />
                                    Wastage Logs
                                </TabsTrigger>
                            </TabsList>

                            {/* --- NEW REPORT TAB --- */}
                            <TabsContent value="report" className="space-y-4 mt-3">
                                <Card className="border-slate-200 bg-white shadow-sm">
                                    <CardHeader className="py-3 px-4 border-b border-slate-100">
                                        <CardTitle className="text-xs font-black uppercase text-slate-800 flex items-center tracking-wider">
                                            <AlertTriangle className="w-3.5 h-3.5 mr-2 text-amber-500" />
                                            Incident Identification
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4">
                                        <div className="space-y-3">
                                            <div className="space-y-1">
                                                <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Context (Contractor - Optional)</Label>
                                                <Select value={selectedContractor} onValueChange={setSelectedContractor}>
                                                    <SelectTrigger className="bg-white h-8 text-xs border-slate-200"><SelectValue placeholder="Contractor (If field wastage)" /></SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="none" className="text-xs">Store Only (No Contractor)</SelectItem>
                                                        {contractors.map((c: ContractorItem) => <SelectItem key={c.id} value={c.id} className="text-xs">{c.name}</SelectItem>)}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div className="space-y-1">
                                                <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Store / RTOM</Label>
                                                <Select value={selectedStore} onValueChange={setSelectedStore}>
                                                    <SelectTrigger className="bg-white h-8 text-xs border-slate-200"><SelectValue placeholder="Select Store" /></SelectTrigger>
                                                    <SelectContent>
                                                        {stores.map((s: StoreItem) => <SelectItem key={s.id} value={s.id} className="text-xs">{s.name}</SelectItem>)}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </div>
                                        <div className="space-y-3">
                                            <div className="space-y-1">
                                                <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Month of Incident</Label>
                                                <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="bg-white h-8 text-xs border-slate-200" />
                                            </div>
                                            <div className="space-y-1">
                                                <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Description / Reason</Label>
                                                <Textarea placeholder="Explain how the wastage/loss occurred..." value={description} onChange={(e) => setDescription(e.target.value)} className="bg-white min-h-[80px] text-xs border-slate-200 p-2 focus-visible:ring-1 focus-visible:ring-slate-300" />
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>

                                <div className="erp-table-container flex flex-col bg-white overflow-hidden">
                                    <Table>
                                        <TableHeader className="bg-slate-50 border-b border-slate-200">
                                            <TableRow className="hover:bg-transparent">
                                                <TableHead className="w-[50%] h-8 text-[10px] font-bold text-slate-500 uppercase tracking-wider py-2">Item Name</TableHead>
                                                <TableHead className="w-[15%] h-8 text-[10px] font-bold text-slate-500 uppercase tracking-wider py-2">Unit</TableHead>
                                                <TableHead className="w-[20%] h-8 text-[10px] font-bold text-slate-500 uppercase tracking-wider py-2 text-right">Quantity</TableHead>
                                                <TableHead className="w-[15%] h-8 text-[10px] font-bold text-slate-500 uppercase tracking-wider py-2 text-center">Action</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {rows.map((row, idx) => (
                                                <TableRow key={idx} className="hover:bg-slate-50/30">
                                                    <TableCell className="py-1">
                                                        <Select value={row.itemId} onValueChange={(v) => handleItemChange(idx, v)}>
                                                            <SelectTrigger className="border-none bg-transparent hover:bg-slate-50/50 h-8 text-xs px-2 focus:ring-0 focus:ring-offset-0">
                                                                <SelectValue placeholder="Select Item" />
                                                            </SelectTrigger>
                                                            <SelectContent className="max-h-60">
                                                                {items.map((item: InventoryItem) => {
                                                                    const stock = contractorStock.find((s: ContractorStockItem) => s.itemId === item.id);
                                                                    return (
                                                                        <SelectItem key={item.id} value={item.id} className="text-xs">
                                                                            <div className="flex justify-between w-full gap-4">
                                                                                <span>{item.code} - {item.name}</span>
                                                                                {selectedContractor && selectedContractor !== 'none' && (
                                                                                    <span className="text-[10px] font-black text-slate-400">Available: {stock?.quantity || 0}</span>
                                                                                )}
                                                                            </div>
                                                                        </SelectItem>
                                                                    );
                                                                })}
                                                            </SelectContent>
                                                        </Select>
                                                    </TableCell>
                                                    <TableCell className="text-slate-400 text-xs font-mono uppercase py-1">{row.unit || '---'}</TableCell>
                                                    <TableCell className="py-1"><Input type="number" min="0" placeholder="0.00" className="text-right font-bold border-none bg-transparent h-8 text-xs focus-visible:ring-0 focus-visible:ring-offset-0" value={row.quantity || ''} onChange={(e) => handleUpdateRow(idx, 'quantity', parseFloat(e.target.value))} /></TableCell>
                                                    <TableCell className="text-center py-1"><Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-red-600 hover:bg-red-50" onClick={() => handleRemoveRow(idx)}><Trash className="w-3.5 h-3.5" /></Button></TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                    <div className="p-2 bg-slate-50/50 border-t border-slate-200 flex justify-center">
                                        <Button variant="outline" size="sm" onClick={handleAddRow} className="bg-white text-[11px] h-7 px-3 border-slate-200 shadow-sm"><Plus className="w-3 h-3 mr-1.5" /> Add Material Line</Button>
                                    </div>
                                </div>

                                <div className="flex justify-end gap-2 pt-2">
                                    <Button variant="outline" className="h-8 text-xs border-slate-200" onClick={() => router.back()}>Cancel</Button>
                                    <Button onClick={handleSubmit} disabled={wastageMutation.isPending} variant="destructive" className="h-8 text-xs px-5 flex items-center gap-1.5">
                                        {wastageMutation.isPending ? 'Reporting...' : <><CheckCircle2 className="w-3.5 h-3.5" /> Finalize Wastage Record</>}
                                    </Button>
                                </div>
                            </TabsContent>

                            {/* --- HISTORY TAB --- */}
                            <TabsContent value="history" className="mt-3 space-y-3">
                                <div className="erp-toolbar flex-row justify-between items-center">
                                    <div className="space-y-0.5">
                                        <h3 className="text-sm font-bold text-slate-800">Wastage Logs</h3>
                                        <p className="text-xs text-slate-500">Monitor and approve wastage incidents.</p>
                                    </div>
                                    <div className="flex items-center gap-2 bg-slate-50 p-1 rounded-lg border border-slate-200">
                                        <Label className="pl-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Period:</Label>
                                        <Input type="month" className="w-[140px] h-7 text-xs border-none bg-transparent p-0 focus-visible:ring-0 focus-visible:ring-offset-0" value={historyMonth} onChange={(e) => setHistoryMonth(e.target.value)} />
                                    </div>
                                </div>

                                <div className="erp-table-container flex flex-col bg-white overflow-hidden">
                                    <Table>
                                        <TableHeader className="bg-slate-50 border-b border-slate-200">
                                            <TableRow className="hover:bg-transparent">
                                                <TableHead className="h-8 text-[10px] font-bold text-slate-500 uppercase tracking-wider py-2">Incident Info</TableHead>
                                                <TableHead className="h-8 text-[10px] font-bold text-slate-500 uppercase tracking-wider py-2">Target Entity</TableHead>
                                                <TableHead className="h-8 text-[10px] font-bold text-slate-500 uppercase tracking-wider py-2">Materials Impacted</TableHead>
                                                <TableHead className="h-8 text-[10px] font-bold text-slate-500 uppercase tracking-wider py-2">Status</TableHead>
                                                <TableHead className="h-8 text-[10px] font-bold text-slate-500 uppercase tracking-wider py-2 text-right">Action</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {isHistoryLoading ? (
                                                <TableRow><TableCell colSpan={5} className="text-center py-10 text-xs text-slate-400">Loading logs...</TableCell></TableRow>
                                            ) : (history.length === 0) ? (
                                                <TableRow><TableCell colSpan={5} className="text-center py-10 text-xs text-slate-400">No records found for this period.</TableCell></TableRow>
                                            ) : (
                                                history.map((log: WastageLogItem) => (
                                                    <TableRow key={log.id} className="hover:bg-slate-50/30">
                                                        <TableCell className="py-2">
                                                            <div className="flex flex-col">
                                                                <span className="text-xs font-bold text-slate-800">{new Date(log.date).toLocaleDateString()}</span>
                                                                <span className="text-[10px] text-slate-400 italic truncate max-w-[150px]">{log.description || 'No reason'}</span>
                                                            </div>
                                                        </TableCell>
                                                        <TableCell className="py-2">
                                                            <div className="flex flex-col">
                                                                <span className="font-bold text-slate-900 text-xs">{log.entityName}</span>
                                                                <span className="text-[10px] text-slate-400">{log.storeName}</span>
                                                            </div>
                                                        </TableCell>
                                                        <TableCell className="py-2">
                                                            <div className="space-y-1">
                                                                {log.items.map((i: { name: string; quantity: number }, idx: number) => (
                                                                    <div key={idx} className="flex justify-between text-[11px] border-b border-slate-50 pb-0.5 last:border-0 mr-4">
                                                                        <span className="text-slate-600">{i.name}</span>
                                                                        <span className="font-bold text-red-600">-{i.quantity}</span>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </TableCell>
                                                        <TableCell className="py-2">
                                                            <span className={cn(
                                                                "erp-status-badge text-[9px] px-2 py-0.5 font-bold border",
                                                                log.status === 'APPROVED' ? "bg-emerald-50 text-emerald-700 border-emerald-200" : 
                                                                log.status === 'PENDING' ? "bg-amber-50 text-amber-700 border-amber-200 animate-pulse" : 
                                                                "bg-rose-50 text-rose-700 border-rose-200"
                                                            )}>
                                                                {log.status}
                                                            </span>
                                                        </TableCell>
                                                        <TableCell className="text-right py-2">
                                                            {log.status === 'PENDING' && isPrivileged && (
                                                                <Button 
                                                                    size="sm" 
                                                                    className="h-6 px-3 bg-emerald-600 hover:bg-emerald-700 text-[10px] font-bold gap-1"
                                                                    onClick={() => approveMutation.mutate(log.id)}
                                                                    disabled={approveMutation.isPending}
                                                                >
                                                                    <ShieldCheck className="w-3.5 h-3.5" /> Approve
                                                                </Button>
                                                            )}
                                                        </TableCell>
                                                    </TableRow>
                                                ))
                                            )}
                                        </TableBody>
                                    </Table>
                                </div>
                            </TabsContent>
                        </Tabs>
                    </div>
                </div>
            </main>
        </div>
    );
}

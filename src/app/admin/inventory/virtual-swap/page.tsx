
"use client";

import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
    RefreshCw, 
    AlertTriangle, 
    CheckCircle2, 
    Loader2, 
    ArrowRightLeft, 
    History,
    Boxes,
    PackageSearch,
    Info,
    LayoutList,
    AlertCircle
} from "lucide-react";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

export default function VirtualSwapPage() {
    const queryClient = useQueryClient();
    const [isConfirmed, setIsConfirmed] = useState(false);
    
    // Filters for In-Hand Analysis
    const [selectedContractor, setSelectedContractor] = useState<string>('all');
    const [searchTerm, setSearchTerm] = useState('');

    // Auth Helper
    const getAuthHeaders = () => {
        const userId = localStorage.getItem("erp_user_id") || "";
        const role = localStorage.getItem("erp_user_role") || "";
        return { 'x-user-id': userId, 'x-user-role': role };
    };

    // 1. Fetch Contractors for filters
    const { data: contractors = [] } = useQuery({
        queryKey: ['contractors-list'],
        queryFn: async () => {
            const res = await fetch('/api/contractors?limit=1000');
            const data = await res.json();
            return data.contractors || [];
        }
    });

    // 2. Fetch Transition Summary (Aggregate View)
    const { data: summary = [], isLoading, refetch } = useQuery({
        queryKey: ['virtual-swap-summary'],
        queryFn: async () => {
            const res = await fetch('/api/inventory/virtual-swap', { headers: getAuthHeaders() });
            if (!res.ok) throw new Error('Failed to fetch summary');
            return res.json();
        }
    });

    // 3. Fetch Transition Preview (Detailed Per Contractor)
    const { data: preview = [], isLoading: isPreviewLoading } = useQuery({
        queryKey: ['virtual-swap-preview'],
        queryFn: async () => {
            const res = await fetch('/api/inventory/virtual-swap/preview', { headers: getAuthHeaders() });
            if (!res.ok) throw new Error('Failed to fetch preview');
            return res.json();
        }
    });

    // 4. Fetch Detailed In-Hand Stock (Current State)
    const { data: inHandStock = [], isLoading: isInHandLoading } = useQuery({
        queryKey: ['in-hand-stock'],
        queryFn: async () => {
            const res = await fetch('/api/inventory/in-hand-stock', { headers: getAuthHeaders() });
            if (!res.ok) throw new Error('Failed to fetch in-hand stock');
            return res.json();
        }
    });

    // 5. Execute Swap Mutation
    const swapMutation = useMutation({
        mutationFn: async () => {
            const res = await fetch('/api/inventory/virtual-swap', {
                method: 'POST',
                headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' }
            });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.message || 'Swap failed');
            }
            return res.json();
        },
        onSuccess: (data) => {
            toast.success(`Successfully swapped stock for ${data.contractorsProcessed} contractors!`);
            queryClient.invalidateQueries({ queryKey: ['virtual-swap-summary'] });
            queryClient.invalidateQueries({ queryKey: ['virtual-swap-preview'] });
            queryClient.invalidateQueries({ queryKey: ['in-hand-stock'] });
            setIsConfirmed(false);
            refetch();
        },
        onError: (err: any) => toast.error(err.message || "Stock swap failed.")
    });

    const mappableQty = Array.isArray(summary) ? summary.filter(s => s.isMappable).reduce((acc: number, curr: any) => acc + curr.totalQty, 0) : 0;
    const unmappableQty = Array.isArray(summary) ? summary.filter(s => !s.isMappable).reduce((acc: number, curr: any) => acc + curr.totalQty, 0) : 0;

    return (
        <div className="flex h-screen bg-slate-50 overflow-hidden">
            <Sidebar />
            <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
                <Header />
                <div className="flex-1 overflow-y-auto p-4 md:p-8">
                    <div className="max-w-6xl mx-auto space-y-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <h1 className="text-2xl font-bold text-slate-900">Virtual Material Transition</h1>
                                <p className="text-slate-500 text-sm">Convert remaining SLT stock in the field to SLTS metadata without physical collection.</p>
                            </div>
                            <div className="flex gap-2 text-[10px] uppercase font-bold tracking-widest text-slate-400">
                                <span>Stores Management</span>
                                <span className="text-slate-200">|</span>
                                <span>Transition Hub</span>
                            </div>
                        </div>

                        <Tabs defaultValue="conversion" className="w-full">
                            <TabsList className="grid w-full grid-cols-3 max-w-[600px]">
                                <TabsTrigger value="conversion" className="gap-2">
                                    <ArrowRightLeft className="w-4 h-4" />
                                    Conversion Hub
                                </TabsTrigger>
                                <TabsTrigger value="preview" className="gap-2">
                                    <LayoutList className="w-4 h-4" />
                                    Transaction Preview
                                </TabsTrigger>
                                <TabsTrigger value="analysis" className="gap-2">
                                    <PackageSearch className="w-4 h-4" />
                                    Inventory Analysis
                                </TabsTrigger>
                            </TabsList>

                            {/* --- CONVERSION HUB --- */}
                            <TabsContent value="conversion" className="space-y-6 mt-4">
                                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                    <div className="lg:col-span-1 space-y-6">
                                        <Card className="border-none shadow-sm bg-slate-900 text-white overflow-hidden relative">
                                            <div className="absolute -right-4 -bottom-4 opacity-10">
                                                <RefreshCw className="w-24 h-24" />
                                            </div>
                                            <CardHeader className="pb-2">
                                                <CardTitle className="text-xs font-bold text-slate-400 uppercase tracking-widest">Available for Swap</CardTitle>
                                            </CardHeader>
                                            <CardContent>
                                                <div className="space-y-4">
                                                    <div>
                                                        <span className="text-4xl font-black">{mappableQty.toLocaleString()}</span>
                                                        <span className="ml-2 text-slate-400 text-xs uppercase">Swap-Ready Units</span>
                                                    </div>
                                                    
                                                    {unmappableQty > 0 && (
                                                        <div className="flex items-center gap-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg text-amber-400">
                                                            <AlertCircle className="w-4 h-4 shrink-0" />
                                                            <span className="text-[10px] font-bold uppercase tracking-tight">
                                                                {unmappableQty.toLocaleString()} units have no SLTS mapping
                                                            </span>
                                                        </div>
                                                    )}

                                                    <div className="pt-4 border-t border-slate-800 space-y-2">
                                                        <div className="flex justify-between text-xs text-slate-400">
                                                            <span>Ready Mappings:</span>
                                                            <span className="font-bold text-emerald-400">{summary.filter(s => s.isMappable).length} Items</span>
                                                        </div>
                                                        <div className="flex justify-between text-xs text-slate-400">
                                                            <span>Actionable Contractors:</span>
                                                            <span className="font-bold text-white">
                                                                {Array.isArray(summary) ? summary.filter(s => s.isMappable).reduce((acc, curr) => acc + curr.contractorCount, 0) : 0} Affected
                                                            </span>
                                                        </div>
                                                    </div>
                                                    
                                                    {!isConfirmed ? (
                                                        <Button 
                                                            className="w-full bg-emerald-600 hover:bg-emerald-700 mt-4 h-11 border-none shadow-lg shadow-emerald-900/20"
                                                            onClick={() => setIsConfirmed(true)}
                                                            disabled={mappableQty === 0}
                                                        >
                                                            Initiate Bulk Swap
                                                        </Button>
                                                    ) : (
                                                        <div className="space-y-2 mt-4 animate-in fade-in slide-in-from-top-2">
                                                            <Button 
                                                                className="w-full bg-red-600 hover:bg-red-700 h-11 transition-all"
                                                                onClick={() => swapMutation.mutate()}
                                                                disabled={swapMutation.isPending}
                                                            >
                                                                {swapMutation.isPending ? (
                                                                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                                                ) : (
                                                                    <CheckCircle2 className="w-4 h-4 mr-2" />
                                                                )}
                                                                Final Confirmation
                                                            </Button>
                                                            <Button 
                                                                variant="ghost" 
                                                                className="w-full text-slate-400 hover:text-white h-9"
                                                                onClick={() => setIsConfirmed(false)}
                                                                disabled={swapMutation.isPending}
                                                            >
                                                                Cancel
                                                            </Button>
                                                        </div>
                                                    )}
                                                </div>
                                            </CardContent>
                                        </Card>

                                        <Alert className="bg-white border-slate-200">
                                            <Info className="h-4 w-4 text-blue-600" />
                                            <AlertTitle className="text-xs font-bold uppercase text-slate-500">How it works</AlertTitle>
                                            <AlertDescription className="text-[10px] leading-relaxed text-slate-400 mt-1">
                                                The system identifies all SLT materials held by contractors. It automatically looks for an SLTS counterpart sharing the same <strong>Common Name</strong>. 
                                                When confirmed, quantities are moved to auto-generated Transition Batches for the new materials.
                                            </AlertDescription>
                                        </Alert>
                                    </div>

                                    <Card className="lg:col-span-2 border-none shadow-sm overflow-hidden">
                                        <CardHeader className="bg-white border-b py-4">
                                            <CardTitle className="text-sm font-bold text-slate-700 flex items-center gap-2 uppercase tracking-widest">
                                                <Boxes className="w-4 h-4 text-emerald-600" />
                                                Material Mapping Registry
                                            </CardTitle>
                                        </CardHeader>
                                        <CardContent className="p-0 h-[450px] overflow-y-auto">
                                            <Table>
                                                <TableHeader className="bg-slate-50 sticky top-0 z-10 shadow-sm">
                                                    <TableRow>
                                                        <TableHead>Common Item Name</TableHead>
                                                        <TableHead className="text-right">Total In Hand (SLT)</TableHead>
                                                        <TableHead className="text-center">Status</TableHead>
                                                        <TableHead>Target SLTS Item</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {isLoading ? (
                                                        <TableRow><TableCell colSpan={4} className="text-center py-20 text-slate-400">Syncing mapping data...</TableCell></TableRow>
                                                    ) : (!Array.isArray(summary) || summary.length === 0) ? (
                                                        <TableRow><TableCell colSpan={4} className="text-center py-20 text-slate-400 italic">No SLT materials detected in contractor stock.</TableCell></TableRow>
                                                    ) : (
                                                        summary.map((item: any, idx: number) => (
                                                            <TableRow key={idx} className={item.isMappable ? "" : "bg-red-50/30"}>
                                                                <TableCell className="font-medium">{item.commonName}</TableCell>
                                                                <TableCell className="text-right">
                                                                    <div className="flex flex-col items-end">
                                                                        <span className={cn("font-bold", item.isMappable ? "text-slate-900" : "text-red-600")}>
                                                                            {item.totalQty.toLocaleString()}
                                                                        </span>
                                                                        <span className="text-[10px] text-slate-400 uppercase tracking-tighter">{item.unit}</span>
                                                                    </div>
                                                                </TableCell>
                                                                <TableCell className="text-center">
                                                                    <ArrowRightLeft className="w-3 h-3 text-slate-300 mx-auto" />
                                                                </TableCell>
                                                                <TableCell>
                                                                    {item.isMappable ? (
                                                                        <div className="flex items-center gap-2 text-emerald-600 font-bold text-[10px] uppercase">
                                                                            <CheckCircle2 className="w-3 h-3" />
                                                                            Ready: {item.commonName} (SLTS)
                                                                        </div>
                                                                    ) : (
                                                                        <div className="flex items-center gap-2 text-red-500 font-bold text-[10px] uppercase">
                                                                            <AlertTriangle className="w-3 h-3" />
                                                                            Unmapped (No SLTS match)
                                                                        </div>
                                                                    )}
                                                                </TableCell>
                                                            </TableRow>
                                                        ))
                                                    )}
                                                </TableBody>
                                            </Table>
                                        </CardContent>
                                    </Card>
                                </div>
                            </TabsContent>

                            {/* --- PREVIEW HUB --- */}
                            <TabsContent value="preview" className="mt-4 animate-in slide-in-from-right-2 duration-300">
                                <Card className="border-none shadow-sm">
                                    <CardHeader className="pb-2">
                                        <CardTitle className="text-lg font-bold">Transaction Preview Hub</CardTitle>
                                        <CardDescription>Exploratory view of individual contractor-wise swaps scheduled in the system.</CardDescription>
                                    </CardHeader>
                                    <CardContent className="p-0">
                                        <div className="max-h-[600px] overflow-y-auto">
                                            <Table>
                                                <TableHeader className="bg-slate-50 sticky top-0 z-10 shadow-sm">
                                                    <TableRow>
                                                        <TableHead>Contractor / OPMC</TableHead>
                                                        <TableHead>Current (SLT)</TableHead>
                                                        <TableHead className="text-center">Action</TableHead>
                                                        <TableHead>Target (SLTS)</TableHead>
                                                        <TableHead className="text-right">Quantity</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {isPreviewLoading ? (
                                                        <TableRow><TableCell colSpan={5} className="text-center py-20 text-slate-400">Loading scheduled transactions...</TableCell></TableRow>
                                                    ) : (!Array.isArray(preview) || preview.length === 0) ? (
                                                        <TableRow><TableCell colSpan={5} className="text-center py-20 text-slate-400">No mappable transactions found.</TableCell></TableRow>
                                                    ) : (
                                                        preview.map((p: any, idx: number) => (
                                                            <TableRow key={idx} className="hover:bg-slate-50/50 transition-colors">
                                                                <TableCell>
                                                                    <div className="flex flex-col">
                                                                        <span className="font-bold text-slate-900">{p.contractorName}</span>
                                                                        <span className="text-[10px] text-slate-400 uppercase">{p.opmcName}</span>
                                                                    </div>
                                                                </TableCell>
                                                                <TableCell className="text-xs text-amber-700 font-medium">{p.fromItem}</TableCell>
                                                                <TableCell className="text-center">
                                                                    <ArrowRightLeft className="w-3 h-3 text-slate-400 mx-auto" />
                                                                </TableCell>
                                                                <TableCell className="text-xs text-emerald-700 font-bold">{p.toItem}</TableCell>
                                                                <TableCell className="text-right">
                                                                    <div className="flex flex-col items-end">
                                                                        <span className="font-black text-slate-950">{p.quantity.toLocaleString()}</span>
                                                                        <span className="text-[9px] text-slate-400 uppercase font-bold">{p.unit}</span>
                                                                    </div>
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

                            {/* --- ANALYSIS TAB --- */}
                            <TabsContent value="analysis" className="mt-4">
                                <Card className="border-none shadow-sm mb-6">
                                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                                        <div>
                                            <CardTitle className="text-lg font-bold">In-Hand Analysis Console</CardTitle>
                                            <CardDescription>Search and filter all materials currently held in the field.</CardDescription>
                                        </div>
                                        <div className="flex gap-2">
                                            <Select value={selectedContractor} onValueChange={(v) => setSelectedContractor(v)}>
                                                <SelectTrigger className="w-[200px] h-9 bg-white">
                                                    <SelectValue placeholder="All Contractors" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="all">All Contractors</SelectItem>
                                                    {contractors.map((c: any) => (
                                                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            <Input 
                                                placeholder="Material name or code..." 
                                                className="w-[200px] h-9 bg-white"
                                                value={searchTerm}
                                                onChange={(e) => setSearchTerm(e.target.value)}
                                            />
                                        </div>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="border rounded-xl overflow-hidden bg-white">
                                            <Table>
                                                <TableHeader className="bg-slate-50 sticky top-0">
                                                    <TableRow>
                                                        <TableHead>Contractor</TableHead>
                                                        <TableHead>Type</TableHead>
                                                        <TableHead>Item Code</TableHead>
                                                        <TableHead>Description</TableHead>
                                                        <TableHead className="text-right">Qty (In Hand)</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {isInHandLoading ? (
                                                        <TableRow><TableCell colSpan={5} className="text-center py-10">Syncing balances...</TableCell></TableRow>
                                                    ) : (inHandStock.length === 0) ? (
                                                        <TableRow><TableCell colSpan={5} className="text-center py-10 text-slate-400 italic">No stock found matching filters.</TableCell></TableRow>
                                                    ) : (
                                                        inHandStock.filter((item: any) => {
                                                            const matchContractor = selectedContractor === 'all' || item.contractorName.toLowerCase().includes(contractors.find((c: any) => c.id === selectedContractor)?.name.toLowerCase() || '');
                                                            const matchSearch = item.itemName.toLowerCase().includes(searchTerm.toLowerCase()) || item.itemCode.toLowerCase().includes(searchTerm.toLowerCase());
                                                            return matchContractor && matchSearch;
                                                        }).map((row: any) => (
                                                            <TableRow key={row.id} className="hover:bg-slate-50/50">
                                                                <TableCell>
                                                                    <div className="flex flex-col">
                                                                        <span className="font-medium text-slate-900">{row.contractorName}</span>
                                                                        <span className="text-[10px] text-slate-400 uppercase">{row.opmcName}</span>
                                                                    </div>
                                                                </TableCell>
                                                                <TableCell>
                                                                    <span className={cn(
                                                                        "text-[9px] px-1.5 py-0.5 rounded-full font-bold",
                                                                        row.itemType === 'SLT' ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"
                                                                    )}>
                                                                        {row.itemType}
                                                                    </span>
                                                                </TableCell>
                                                                <TableCell className="font-mono text-xs">{row.itemCode}</TableCell>
                                                                <TableCell className="text-slate-600 text-xs">{row.itemName}</TableCell>
                                                                <TableCell className="text-right">
                                                                    <div className="flex flex-col items-end">
                                                                        <span className="font-bold text-slate-900">{row.quantity.toLocaleString()}</span>
                                                                        <span className="text-[10px] text-slate-400 uppercase">{row.unit}</span>
                                                                    </div>
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

function Boxes(props: any) {
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
            <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
            <path d="m3.3 7 8.7 5 8.7-5" />
            <path d="M12 22V12" />
        </svg>
    )
}

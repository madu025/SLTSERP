
"use client";

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
    Boxes,
    PackageSearch,
    Info,
    LayoutList,
    AlertCircle
} from "lucide-react";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

interface ContractorItem {
    id: string;
    name: string;
}

interface VirtualSwapSummaryItem {
    commonName: string;
    totalQty: number;
    unit: string;
    isMappable: boolean;
    contractorCount: number;
}

interface VirtualSwapPreviewItem {
    contractorName: string;
    opmcName: string;
    fromItem: string;
    toItem: string;
    quantity: number;
    unit: string;
}

interface InHandStockItem {
    id: string;
    contractorName: string;
    opmcName: string;
    itemType: string;
    itemCode: string;
    itemName: string;
    quantity: number;
    unit: string;
}

interface SwapMutationResponse {
    success: boolean;
    contractorsProcessed: number;
    message?: string;
}

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
    const { data: contractors = [] } = useQuery<ContractorItem[]>({
        queryKey: ['contractors-list'],
        queryFn: async () => {
            const res = await fetch('/api/contractors?limit=1000');
            const json = await res.json();
            const actualData = json?.success && json?.data ? json.data : json;
            return (actualData?.contractors || []) as ContractorItem[];
        }
    });

    // 2. Fetch Transition Summary (Aggregate View)
    const { data: summary = [], isLoading, refetch } = useQuery<VirtualSwapSummaryItem[]>({
        queryKey: ['virtual-swap-summary'],
        queryFn: async () => {
            const res = await fetch('/api/inventory/virtual-swap', { headers: getAuthHeaders() });
            if (!res.ok) throw new Error('Failed to fetch summary');
            return res.json() as Promise<VirtualSwapSummaryItem[]>;
        }
    });

    // 3. Fetch Transition Preview (Detailed Per Contractor)
    const { data: preview = [], isLoading: isPreviewLoading } = useQuery<VirtualSwapPreviewItem[]>({
        queryKey: ['virtual-swap-preview'],
        queryFn: async () => {
            const res = await fetch('/api/inventory/virtual-swap/preview', { headers: getAuthHeaders() });
            if (!res.ok) throw new Error('Failed to fetch preview');
            return res.json() as Promise<VirtualSwapPreviewItem[]>;
        }
    });

    // 4. Fetch Detailed In-Hand Stock (Current State)
    const { data: inHandStock = [], isLoading: isInHandLoading } = useQuery<InHandStockItem[]>({
        queryKey: ['in-hand-stock'],
        queryFn: async () => {
            const res = await fetch('/api/inventory/in-hand-stock', { headers: getAuthHeaders() });
            if (!res.ok) throw new Error('Failed to fetch in-hand stock');
            return res.json() as Promise<InHandStockItem[]>;
        }
    });

    // 5. Execute Swap Mutation
    const swapMutation = useMutation<SwapMutationResponse, Error, void>({
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
        onError: (err) => toast.error(err.message || "Stock swap failed.")
    });

    const mappableQty = Array.isArray(summary) ? summary.filter((s: VirtualSwapSummaryItem) => s.isMappable).reduce((acc: number, curr: VirtualSwapSummaryItem) => acc + curr.totalQty, 0) : 0;
    const unmappableQty = Array.isArray(summary) ? summary.filter((s: VirtualSwapSummaryItem) => !s.isMappable).reduce((acc: number, curr: VirtualSwapSummaryItem) => acc + curr.totalQty, 0) : 0;

    return (
        <div className="erp-page-wrapper flex-row overflow-hidden">
            <Sidebar />
            <main className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
                <Header />
                <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
                    <div className="max-w-7xl mx-auto space-y-4">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                            <div className="space-y-0.5">
                                <h1 className="text-xl font-black text-slate-900 tracking-tight">Virtual Material Transition</h1>
                                <p className="text-xs text-slate-500">Convert remaining SLT stock in the field to SLTS metadata without physical collection.</p>
                            </div>
                            <div className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">
                                <span>Stores Management</span>
                                <span className="mx-1.5 text-slate-200">|</span>
                                <span>Transition Hub</span>
                            </div>
                        </div>

                        <Tabs defaultValue="conversion" className="w-full">
                            <TabsList className="grid w-full grid-cols-3 max-w-[480px] h-8 p-0.5 bg-slate-100 border border-slate-200 rounded-lg">
                                <TabsTrigger value="conversion" className="gap-2 text-xs h-7 data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm">
                                    <ArrowRightLeft className="w-3.5 h-3.5" />
                                    Conversion Hub
                                </TabsTrigger>
                                <TabsTrigger value="preview" className="gap-2 text-xs h-7 data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm">
                                    <LayoutList className="w-3.5 h-3.5" />
                                    Transaction Preview
                                </TabsTrigger>
                                <TabsTrigger value="analysis" className="gap-2 text-xs h-7 data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm">
                                    <PackageSearch className="w-3.5 h-3.5" />
                                    Inventory Analysis
                                </TabsTrigger>
                            </TabsList>

                            {/* --- CONVERSION HUB --- */}
                            <TabsContent value="conversion" className="space-y-4 mt-3">
                                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                                    <div className="lg:col-span-1 space-y-4">
                                        <Card className="border-none shadow-sm bg-slate-900 text-white overflow-hidden relative">
                                            <div className="absolute -right-4 -bottom-4 opacity-10">
                                                <RefreshCw className="w-16 h-16" />
                                            </div>
                                            <CardHeader className="pb-1.5 pt-3 px-4">
                                                <CardTitle className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Available for Swap</CardTitle>
                                            </CardHeader>
                                            <CardContent className="p-4 pt-0">
                                                <div className="space-y-3">
                                                    <div>
                                                        <span className="text-3xl font-black">{mappableQty.toLocaleString()}</span>
                                                        <span className="ml-1.5 text-slate-400 text-[10px] uppercase font-bold">Swap-Ready Units</span>
                                                    </div>
                                                    
                                                    {unmappableQty > 0 && (
                                                        <div className="flex items-center gap-2 p-2 bg-amber-500/10 border border-amber-500/20 rounded-lg text-amber-400 text-[9px]">
                                                            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                                                            <span className="font-bold uppercase tracking-tight">
                                                                {unmappableQty.toLocaleString()} units have no SLTS mapping
                                                            </span>
                                                        </div>
                                                    )}

                                                    <div className="pt-3 border-t border-slate-800 space-y-1.5 text-xs">
                                                        <div className="flex justify-between text-slate-400">
                                                            <span>Ready Mappings:</span>
                                                            <span className="font-bold text-emerald-400">{summary.filter((s: VirtualSwapSummaryItem) => s.isMappable).length} Items</span>
                                                        </div>
                                                        <div className="flex justify-between text-slate-400">
                                                            <span>Actionable Contractors:</span>
                                                            <span className="font-bold text-white">
                                                                {Array.isArray(summary) ? summary.filter((s: VirtualSwapSummaryItem) => s.isMappable).reduce((acc: number, curr: VirtualSwapSummaryItem) => acc + curr.contractorCount, 0) : 0} Affected
                                                            </span>
                                                        </div>
                                                    </div>
                                                    
                                                    {!isConfirmed ? (
                                                        <Button 
                                                            className="w-full bg-emerald-600 hover:bg-emerald-700 mt-2 h-9 text-xs border-none shadow-md shadow-emerald-950/20 text-white"
                                                            onClick={() => setIsConfirmed(true)}
                                                            disabled={mappableQty === 0}
                                                        >
                                                            Initiate Bulk Swap
                                                        </Button>
                                                    ) : (
                                                        <div className="space-y-1.5 mt-2 animate-in fade-in slide-in-from-top-2">
                                                            <Button 
                                                                className="w-full bg-red-600 hover:bg-red-700 h-9 text-xs transition-all text-white"
                                                                onClick={() => swapMutation.mutate()}
                                                                disabled={swapMutation.isPending}
                                                            >
                                                                {swapMutation.isPending ? (
                                                                    <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                                                                ) : (
                                                                    <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                                                                )}
                                                                Final Confirmation
                                                            </Button>
                                                            <Button 
                                                                variant="ghost" 
                                                                className="w-full text-slate-400 hover:text-white h-8 text-[11px]"
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

                                        <Alert className="bg-white border-slate-200 p-3">
                                            <Info className="h-4 w-4 text-blue-600" />
                                            <AlertTitle className="text-[10px] font-bold uppercase text-slate-500 tracking-wider">How it works</AlertTitle>
                                            <AlertDescription className="text-[10px] leading-relaxed text-slate-400 mt-0.5">
                                                The system identifies SLT materials held by contractors. It automatically looks for an SLTS counterpart sharing the same <strong>Common Name</strong>. Quantities are moved to auto-generated Transition Batches for the new materials.
                                            </AlertDescription>
                                        </Alert>
                                    </div>

                                    <div className="lg:col-span-2 erp-table-container flex flex-col bg-white overflow-hidden">
                                        <div className="bg-white border-b border-slate-200 px-4 py-2.5 flex items-center justify-between">
                                            <h3 className="text-xs font-black uppercase text-slate-800 tracking-wider flex items-center gap-1.5">
                                                <Boxes className="w-3.5 h-3.5 text-emerald-600" />
                                                Material Mapping Registry
                                            </h3>
                                        </div>
                                        <div className="p-0 max-h-[380px] overflow-y-auto">
                                            <Table>
                                                <TableHeader className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
                                                    <TableRow className="hover:bg-transparent">
                                                        <TableHead className="h-8 text-[10px] font-bold text-slate-500 uppercase tracking-wider py-2">Common Item Name</TableHead>
                                                        <TableHead className="h-8 text-[10px] font-bold text-slate-500 uppercase tracking-wider py-2 text-right">Total In Hand (SLT)</TableHead>
                                                        <TableHead className="h-8 text-[10px] font-bold text-slate-500 uppercase tracking-wider py-2 text-center">Status</TableHead>
                                                        <TableHead className="h-8 text-[10px] font-bold text-slate-500 uppercase tracking-wider py-2">Target SLTS Item</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {isLoading ? (
                                                        <TableRow><TableCell colSpan={4} className="text-center py-20 text-xs text-slate-400">Syncing mapping data...</TableCell></TableRow>
                                                    ) : (!Array.isArray(summary) || summary.length === 0) ? (
                                                        <TableRow><TableCell colSpan={4} className="text-center py-20 text-xs text-slate-400 italic">No SLT materials detected in contractor stock.</TableCell></TableRow>
                                                    ) : (
                                                        summary.map((item: VirtualSwapSummaryItem, idx: number) => (
                                                            <TableRow key={idx} className={cn("text-xs", item.isMappable ? "hover:bg-slate-50/30" : "bg-red-50/20 hover:bg-red-50/30")}>
                                                                <TableCell className="font-medium py-1.5">{item.commonName}</TableCell>
                                                                <TableCell className="text-right py-1.5">
                                                                    <div className="flex flex-col items-end">
                                                                        <span className={cn("font-bold", item.isMappable ? "text-slate-900" : "text-red-600")}>
                                                                            {item.totalQty.toLocaleString()}
                                                                        </span>
                                                                        <span className="text-[9px] text-slate-400 uppercase tracking-tighter">{item.unit}</span>
                                                                    </div>
                                                                </TableCell>
                                                                <TableCell className="text-center py-1.5">
                                                                    <ArrowRightLeft className="w-3 h-3 text-slate-300 mx-auto" />
                                                                </TableCell>
                                                                <TableCell className="py-1.5">
                                                                    {item.isMappable ? (
                                                                        <div className="flex items-center gap-1 text-emerald-600 font-bold text-[10px] uppercase">
                                                                            <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                                                                            Ready: {item.commonName} (SLTS)
                                                                        </div>
                                                                    ) : (
                                                                        <div className="flex items-center gap-1 text-red-500 font-bold text-[10px] uppercase">
                                                                            <AlertTriangle className="w-3 h-3 text-red-400" />
                                                                            Unmapped (No SLTS match)
                                                                        </div>
                                                                    )}
                                                                </TableCell>
                                                            </TableRow>
                                                        ))
                                                    )}
                                                </TableBody>
                                            </Table>
                                        </div>
                                    </div>
                                </div>
                            </TabsContent>

                            {/* --- PREVIEW HUB --- */}
                            <TabsContent value="preview" className="mt-3 animate-in slide-in-from-right-2 duration-300">
                                <div className="erp-table-container flex flex-col bg-white overflow-hidden">
                                    <div className="bg-white border-b border-slate-200 px-4 py-2.5">
                                        <h3 className="text-sm font-bold text-slate-800">Transaction Preview Hub</h3>
                                        <p className="text-xs text-slate-500 mt-0.5">Exploratory view of individual contractor-wise swaps scheduled in the system.</p>
                                    </div>
                                    <div className="p-0 max-h-[500px] overflow-y-auto">
                                        <Table>
                                            <TableHeader className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
                                                <TableRow className="hover:bg-transparent">
                                                    <TableHead className="h-8 text-[10px] font-bold text-slate-500 uppercase tracking-wider py-2">Contractor / OPMC</TableHead>
                                                    <TableHead className="h-8 text-[10px] font-bold text-slate-500 uppercase tracking-wider py-2">Current (SLT)</TableHead>
                                                    <TableHead className="h-8 text-[10px] font-bold text-slate-500 uppercase tracking-wider py-2 text-center">Action</TableHead>
                                                    <TableHead className="h-8 text-[10px] font-bold text-slate-500 uppercase tracking-wider py-2">Target (SLTS)</TableHead>
                                                    <TableHead className="h-8 text-[10px] font-bold text-slate-500 uppercase tracking-wider py-2 text-right">Quantity</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {isPreviewLoading ? (
                                                    <TableRow><TableCell colSpan={5} className="text-center py-20 text-xs text-slate-400">Loading scheduled transactions...</TableCell></TableRow>
                                                ) : (!Array.isArray(preview) || preview.length === 0) ? (
                                                    <TableRow><TableCell colSpan={5} className="text-center py-20 text-xs text-slate-400">No mappable transactions found.</TableCell></TableRow>
                                                ) : (
                                                    preview.map((p: VirtualSwapPreviewItem, idx: number) => (
                                                        <TableRow key={idx} className="hover:bg-slate-50/30 text-xs">
                                                            <TableCell className="py-2">
                                                                <div className="flex flex-col">
                                                                    <span className="font-bold text-slate-900">{p.contractorName}</span>
                                                                    <span className="text-[10px] text-slate-400 uppercase">{p.opmcName}</span>
                                                                </div>
                                                            </TableCell>
                                                            <TableCell className="text-xs text-amber-700 font-medium py-2">{p.fromItem}</TableCell>
                                                            <TableCell className="text-center py-2">
                                                                <ArrowRightLeft className="w-3 h-3 text-slate-400 mx-auto" />
                                                            </TableCell>
                                                            <TableCell className="text-xs text-emerald-700 font-bold py-2">{p.toItem}</TableCell>
                                                            <TableCell className="text-right py-2">
                                                                <div className="flex flex-col items-end">
                                                                    <span className="font-black text-slate-955">{p.quantity.toLocaleString()}</span>
                                                                    <span className="text-[9px] text-slate-400 uppercase font-bold">{p.unit}</span>
                                                                </div>
                                                            </TableCell>
                                                        </TableRow>
                                                    ))
                                                )}
                                            </TableBody>
                                        </Table>
                                    </div>
                                </div>
                            </TabsContent>

                            {/* --- ANALYSIS TAB --- */}
                            <TabsContent value="analysis" className="mt-3">
                                <div className="erp-table-container flex flex-col bg-white overflow-hidden">
                                    <div className="bg-white border-b border-slate-200 px-4 py-2.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                                        <div className="space-y-0.5">
                                            <h3 className="text-sm font-bold text-slate-800">In-Hand Analysis Console</h3>
                                            <p className="text-xs text-slate-500">Search and filter all materials currently held in the field.</p>
                                        </div>
                                        <div className="flex gap-2 w-full sm:w-auto">
                                            <Select value={selectedContractor} onValueChange={(v) => setSelectedContractor(v)}>
                                                <SelectTrigger className="w-[180px] h-8 text-xs bg-white border-slate-200">
                                                    <SelectValue placeholder="All Contractors" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="all" className="text-xs">All Contractors</SelectItem>
                                                    {contractors.map((c: ContractorItem) => (
                                                        <SelectItem key={c.id} value={c.id} className="text-xs">{c.name}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            <Input 
                                                placeholder="Material name or code..." 
                                                className="w-[180px] h-8 text-xs bg-white border-slate-200 focus-visible:ring-1 focus-visible:ring-slate-300"
                                                value={searchTerm}
                                                onChange={(e) => setSearchTerm(e.target.value)}
                                            />
                                        </div>
                                    </div>
                                    <div className="p-0 max-h-[500px] overflow-y-auto">
                                        <Table>
                                            <TableHeader className="bg-slate-50 border-b border-slate-200 sticky top-0">
                                                <TableRow className="hover:bg-transparent">
                                                    <TableHead className="h-8 text-[10px] font-bold text-slate-500 uppercase tracking-wider py-2">Contractor</TableHead>
                                                    <TableHead className="h-8 text-[10px] font-bold text-slate-500 uppercase tracking-wider py-2">Type</TableHead>
                                                    <TableHead className="h-8 text-[10px] font-bold text-slate-500 uppercase tracking-wider py-2">Item Code</TableHead>
                                                    <TableHead className="h-8 text-[10px] font-bold text-slate-500 uppercase tracking-wider py-2">Description</TableHead>
                                                    <TableHead className="h-8 text-[10px] font-bold text-slate-500 uppercase tracking-wider py-2 text-right">Qty (In Hand)</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {isInHandLoading ? (
                                                    <TableRow><TableCell colSpan={5} className="text-center py-10 text-xs text-slate-400">Syncing balances...</TableCell></TableRow>
                                                ) : (inHandStock.length === 0) ? (
                                                    <TableRow><TableCell colSpan={5} className="text-center py-10 text-xs text-slate-400 italic">No stock found matching filters.</TableCell></TableRow>
                                                ) : (
                                                    inHandStock.filter((item: InHandStockItem) => {
                                                        const matchContractor = selectedContractor === 'all' || item.contractorName.toLowerCase().includes(contractors.find((c: ContractorItem) => c.id === selectedContractor)?.name.toLowerCase() || '');
                                                        const matchSearch = item.itemName.toLowerCase().includes(searchTerm.toLowerCase()) || item.itemCode.toLowerCase().includes(searchTerm.toLowerCase());
                                                        return matchContractor && matchSearch;
                                                    }).map((row: InHandStockItem) => (
                                                        <TableRow key={row.id} className="hover:bg-slate-50/30 text-xs">
                                                            <TableCell className="py-2">
                                                                <div className="flex flex-col">
                                                                    <span className="font-medium text-slate-900">{row.contractorName}</span>
                                                                    <span className="text-[10px] text-slate-400 uppercase">{row.opmcName}</span>
                                                                </div>
                                                            </TableCell>
                                                            <TableCell className="py-2">
                                                                <span className={cn(
                                                                    "erp-status-badge text-[9px] px-1.5 py-0.5 font-bold border",
                                                                    row.itemType === 'SLT' ? "bg-amber-50 text-amber-700 border border-amber-200" : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                                                )}>
                                                                    {row.itemType}
                                                                </span>
                                                            </TableCell>
                                                            <TableCell className="font-mono text-xs py-2">{row.itemCode}</TableCell>
                                                            <TableCell className="text-slate-600 text-xs py-2">{row.itemName}</TableCell>
                                                            <TableCell className="text-right py-2">
                                                                <div className="flex flex-col items-end">
                                                                    <span className="font-bold text-slate-900">{row.quantity.toLocaleString()}</span>
                                                                    <span className="text-[9px] text-slate-400 uppercase tracking-tighter">{row.unit}</span>
                                                                </div>
                                                            </TableCell>
                                                        </TableRow>
                                                    ))
                                                )}
                                            </TableBody>
                                        </Table>
                                    </div>
                                </div>
                            </TabsContent>
                        </Tabs>
                    </div>
                </div>
            </main>
        </div>
    );
}

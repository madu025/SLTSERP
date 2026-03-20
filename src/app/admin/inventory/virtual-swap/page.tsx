
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
    PackageSearch
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

    // 1. Fetch Contractors for filters
    const { data: contractors = [] } = useQuery({
        queryKey: ['contractors-list'],
        queryFn: async () => {
            const res = await fetch('/api/contractors?limit=1000');
            const data = await res.json();
            return data.contractors || [];
        }
    });

    // 2. Fetch Transition Summary (What can be swapped)
    const { data: summary = [], isLoading, refetch } = useQuery({
        queryKey: ['virtual-swap-summary'],
        queryFn: async () => {
            const res = await fetch('/api/inventory/virtual-swap');
            if (!res.ok) throw new Error('Failed to fetch summary');
            return res.json();
        }
    });

    // 3. Fetch Detailed In-Hand Stock
    const { data: inHandStock = [], isLoading: isInHandLoading } = useQuery({
        queryKey: ['in-hand-stock'],
        queryFn: async () => {
            const res = await fetch('/api/inventory/in-hand-stock');
            if (!res.ok) throw new Error('Failed to fetch in-hand stock');
            return res.json();
        }
    });

    // 4. Execute Swap Mutation
    const swapMutation = useMutation({
        mutationFn: async () => {
            const userId = localStorage.getItem("erp_user_id") || "SYSTEM";
            const res = await fetch('/api/inventory/virtual-swap', {
                method: 'POST',
                headers: { 'x-user-id': userId }
            });
            if (!res.ok) throw new Error('Swap failed');
            return res.json();
        },
        onSuccess: (data) => {
            toast.success(`Successfully swapped stock for ${data.contractorsProcessed} contractors!`);
            queryClient.invalidateQueries({ queryKey: ['virtual-swap-summary'] });
            queryClient.invalidateQueries({ queryKey: ['in-hand-stock'] });
            queryClient.invalidateQueries({ queryKey: ['reconciliation'] });
            setIsConfirmed(false);
            refetch();
        },
        onError: () => toast.error("Stock swap failed. Please check server logs.")
    });

    // Filtering logic for Analysis tab
    const filteredInHand = useMemo(() => {
        return inHandStock.filter((item: any) => {
            const matchContractor = selectedContractor === 'all' || item.contractorName.toLowerCase().includes(contractors.find((c: any) => c.id === selectedContractor)?.name.toLowerCase() || '');
            const matchSearch = item.itemName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                              item.itemCode.toLowerCase().includes(searchTerm.toLowerCase());
            return matchContractor && matchSearch;
        });
    }, [inHandStock, selectedContractor, searchTerm, contractors]);

    const totalQty = summary.reduce((acc: number, curr: any) => acc + curr.totalQty, 0);

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
                            <TabsList className="grid w-full grid-cols-2 max-w-[400px]">
                                <TabsTrigger value="conversion" className="gap-2">
                                    <ArrowRightLeft className="w-4 h-4" />
                                    Conversion Hub
                                </TabsTrigger>
                                <TabsTrigger value="analysis" className="gap-2">
                                    <PackageSearch className="w-4 h-4" />
                                    In-Hand Analysis
                                </TabsTrigger>
                            </TabsList>

                            {/* --- CONVERSION HUB --- */}
                            <TabsContent value="conversion" className="space-y-6 mt-4">
                                <Alert className="bg-amber-50 border-amber-200 text-amber-900 shadow-sm">
                                    <AlertTriangle className="h-4 h-4 !text-amber-600" />
                                    <AlertTitle className="font-bold">Important Directive Notice</AlertTitle>
                                    <AlertDescription className="text-xs">
                                        Use this tool only when a formal direction is received to stop using SLT materials. 
                                        Executing the swap will virtually transfer all SLT quantities to SLTS for all contractors in the field.
                                    </AlertDescription>
                                </Alert>

                                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                    {/* Summary Stats */}
                                    <Card className="lg:col-span-1 border-none shadow-sm">
                                        <CardHeader className="pb-2">
                                            <CardTitle className="text-sm font-bold text-slate-500 uppercase">Total Pending Conversion</CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            <div className="space-y-4">
                                                <div>
                                                    <span className="text-4xl font-black text-slate-900">{totalQty.toLocaleString()}</span>
                                                    <span className="ml-2 text-slate-400 text-xs">Units Total</span>
                                                </div>
                                                <div className="pt-4 border-t space-y-2">
                                                    <div className="flex justify-between text-xs">
                                                        <span className="text-slate-500">Materials Impacted:</span>
                                                        <span className="font-bold">{summary.length} Types</span>
                                                    </div>
                                                    <div className="flex justify-between text-xs">
                                                        <span className="text-slate-500">Active Contractors:</span>
                                                        <span className="font-bold text-emerald-600">{Array.from(new Set(summary.flatMap((s: any) => s.contractorCount))).length} Identified</span>
                                                    </div>
                                                </div>
                                                
                                                {!isConfirmed ? (
                                                    <Button 
                                                        className="w-full bg-slate-900 hover:bg-black mt-4 h-11"
                                                        onClick={() => setIsConfirmed(true)}
                                                        disabled={summary.length === 0}
                                                    >
                                                        Initialize Bulk Swap
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
                                                            Confirm Global Re-tagging
                                                        </Button>
                                                        <Button 
                                                            variant="ghost" 
                                                            className="w-full text-slate-500 h-9"
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

                                    {/* Detailed Item List */}
                                    <Card className="lg:col-span-2 border-none shadow-sm overflow-hidden">
                                        <CardHeader className="bg-white border-b py-4">
                                            <CardTitle className="text-sm font-bold text-slate-700 flex items-center gap-2">
                                                <Boxes className="w-4 h-4 text-emerald-600" />
                                                Target Material Mapping
                                            </CardTitle>
                                        </CardHeader>
                                        <CardContent className="p-0">
                                            <Table>
                                                <TableHeader className="bg-slate-50">
                                                    <TableRow>
                                                        <TableHead>Common Item Name</TableHead>
                                                        <TableHead className="text-right">SLT In Hand</TableHead>
                                                        <TableHead className="text-center">Status</TableHead>
                                                        <TableHead>Target SLTS Item</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {isLoading ? (
                                                        <TableRow><TableCell colSpan={4} className="text-center py-10 text-slate-400">Loading mapping data...</TableCell></TableRow>
                                                    ) : summary.length === 0 ? (
                                                        <TableRow><TableCell colSpan={4} className="text-center py-10 text-slate-400">No SLT materials currently held by contractors.</TableCell></TableRow>
                                                    ) : (
                                                        summary.map((item: any, idx: number) => (
                                                            <TableRow key={idx}>
                                                                <TableCell className="font-medium">{item.commonName}</TableCell>
                                                                <TableCell className="text-right">
                                                                    <div className="flex flex-col items-end">
                                                                        <span className="text-amber-600 font-bold">{item.totalQty.toLocaleString()}</span>
                                                                        <span className="text-[10px] text-slate-400 uppercase tracking-tighter">{item.unit}</span>
                                                                    </div>
                                                                </TableCell>
                                                                <TableCell className="text-center">
                                                                    <ArrowRightLeft className="w-3 h-3 text-slate-300 mx-auto" />
                                                                </TableCell>
                                                                <TableCell>
                                                                    {item.sltsItemId ? (
                                                                        <div className="flex items-center gap-2 text-emerald-600 font-medium text-xs">
                                                                            <CheckCircle2 className="w-3 h-3" />
                                                                            Ready for {item.commonName} (SLTS)
                                                                        </div>
                                                                    ) : (
                                                                        <div className="flex items-center gap-2 text-red-500 font-medium text-xs">
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

                            {/* --- ANALYTICS TAB --- */}
                            <TabsContent value="analysis" className="mt-4">
                                <Card className="border-none shadow-sm mb-6">
                                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                                        <div>
                                            <CardTitle className="text-lg font-bold">Material Stock in Field (In-Hand)</CardTitle>
                                            <CardDescription>Consolidated View of all materials currently held by contractors across all OPMCs.</CardDescription>
                                        </div>
                                        <div className="flex gap-2">
                                            <Select 
                                                value={selectedContractor} 
                                                onValueChange={(v) => setSelectedContractor(v)}
                                            >
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
                                                placeholder="Search material..." 
                                                className="w-[200px] h-9 bg-white"
                                                value={searchTerm}
                                                onChange={(e) => setSearchTerm(e.target.value)}
                                            />
                                        </div>
                                    </CardHeader>
                                    <CardContent>
                                        <Alert className="bg-slate-900 border-none text-white overflow-hidden relative mb-6">
                                            <div className="absolute right-0 top-0 opacity-10 filter grayscale brightness-200">
                                                <History className="w-32 h-32" />
                                            </div>
                                            <History className="h-4 w-4 !text-emerald-400" />
                                            <AlertTitle className="font-bold flex items-center gap-2">
                                                Historical Reconciliation Hint
                                            </AlertTitle>
                                            <AlertDescription className="text-xs text-slate-300">
                                                This view shows real-time balances. Items are grouped per contractor and material.
                                            </AlertDescription>
                                        </Alert>
                                        
                                        <div className="border rounded-xl overflow-hidden bg-white">
                                            <Table>
                                                <TableHeader className="bg-slate-50">
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
                                                        <TableRow><TableCell colSpan={5} className="text-center py-10">Loading balances...</TableCell></TableRow>
                                                    ) : filteredInHand.length === 0 ? (
                                                        <TableRow><TableCell colSpan={5} className="text-center py-10 text-slate-400">No stock found for selected criteria.</TableCell></TableRow>
                                                    ) : (
                                                        filteredInHand.map((row: any) => (
                                                            <TableRow key={row.id} className="hover:bg-slate-50/50">
                                                                <TableCell>
                                                                    <div className="flex flex-col">
                                                                        <span className="font-medium text-slate-900">{row.contractorName}</span>
                                                                        <span className="text-[10px] text-slate-400">{row.opmcName}</span>
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
                                                                <TableCell className="text-slate-600">{row.itemName}</TableCell>
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

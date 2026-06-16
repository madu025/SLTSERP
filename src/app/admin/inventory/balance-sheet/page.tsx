"use client";

import React, { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Label } from "@/components/ui/label";
import { Loader2, Save, FileSpreadsheet } from "lucide-react";
import { toast } from 'sonner';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';

export default function BalanceSheetPage() {
    const [selectedContractor, setSelectedContractor] = useState<string>('');
    const [selectedStore, setSelectedStore] = useState<string>('');
    const [month, setMonth] = useState<string>(new Date().toISOString().slice(0, 7)); // YYYY-MM
    const [reportData, setReportData] = useState<any>(null);

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

    // --- MUTATIONS ---
    const generateMutation = useMutation({
        mutationFn: async () => {
            const res = await fetch('/api/inventory/balance-sheet/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contractorId: selectedContractor,
                    storeId: selectedStore,
                    month
                })
            });
            if (!res.ok) throw new Error('Failed to generate report');
            return res.json();
        },
        onSuccess: (data) => {
            setReportData(data);
            toast.success("Report generated");
        },
        onError: () => toast.error("Generation failed")
    });

    const saveMutation = useMutation({
        mutationFn: async () => {
            if (!reportData) return;
            const res = await fetch('/api/inventory/balance-sheet', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contractorId: selectedContractor,
                    storeId: selectedStore,
                    month,
                    items: reportData.items
                })
            });
            if (!res.ok) throw new Error('Failed to save report');
            return res.json();
        },
        onSuccess: () => {
            toast.success("Balance Sheet Saved Successfully");
        },
        onError: () => toast.error("Save failed")
    });

    const handleGenerate = () => {
        if (!selectedContractor || !selectedStore || !month) {
            toast.error("Please select all fields");
            return;
        }
        generateMutation.mutate();
    };

    return (
        <div className="erp-page-wrapper flex-row overflow-hidden">
            <Sidebar />
            <main className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
                <Header />
                <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
                    <div className="max-w-7xl mx-auto space-y-4">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                            <div className="space-y-0.5">
                                <h1 className="text-xl font-black text-slate-900 tracking-tight">Monthly Balance Sheet</h1>
                                <p className="text-xs text-slate-500">Generate and freeze monthly material balances.</p>
                            </div>
                        </div>

                        <div className="erp-toolbar p-3 bg-white rounded-lg border border-slate-200">
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end w-full">
                                <div className="space-y-1">
                                    <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Contractor</Label>
                                    <Select value={selectedContractor} onValueChange={setSelectedContractor}>
                                        <SelectTrigger className="h-8 text-xs bg-white border-slate-200">
                                            <SelectValue placeholder="Select Contractor" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {contractors.map((c: any) => (
                                                <SelectItem key={c.id} value={c.id} className="text-xs">{c.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-1">
                                    <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Store</Label>
                                    <Select value={selectedStore} onValueChange={setSelectedStore}>
                                        <SelectTrigger className="h-8 text-xs bg-white border-slate-200">
                                            <SelectValue placeholder="Select Store" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {stores.map((s: any) => (
                                                <SelectItem key={s.id} value={s.id} className="text-xs">{s.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-1">
                                    <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Month</Label>
                                    <Input
                                        type="month"
                                        value={month}
                                        onChange={(e) => setMonth(e.target.value)}
                                        className="h-8 text-xs bg-white border-slate-200 focus-visible:ring-1 focus-visible:ring-slate-300"
                                    />
                                </div>

                                <Button onClick={handleGenerate} disabled={generateMutation.isPending} className="bg-blue-600 hover:bg-blue-700 h-8 text-xs w-full md:w-auto px-4 shadow-sm">
                                    {generateMutation.isPending ? <Loader2 className="animate-spin w-3.5 h-3.5 mr-1.5" /> : <FileSpreadsheet className="w-3.5 h-3.5 mr-1.5" />}
                                    Generate Report
                                </Button>
                            </div>
                        </div>

                        {reportData && (
                            <div className="erp-table-container flex flex-col bg-white overflow-hidden animate-in slide-in-from-bottom-2 duration-300">
                                <div className="bg-white border-b border-slate-200 px-4 py-2.5 flex items-center justify-between">
                                    <h3 className="text-xs font-black uppercase text-slate-800 tracking-wider">Report Preview: {month}</h3>
                                    <Button variant="default" size="sm" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} className="h-8 text-xs shadow-sm bg-blue-600 hover:bg-blue-700 text-white">
                                        <Save className="w-3.5 h-3.5 mr-1.5" />
                                        {saveMutation.isPending ? "Saving..." : "Save & Freeze"}
                                    </Button>
                                </div>
                                <div className="p-0">
                                    <Table>
                                        <TableHeader className="bg-slate-50 border-b border-slate-200">
                                            <TableRow className="hover:bg-transparent">
                                                <TableHead className="h-8 text-[10px] font-bold text-slate-500 uppercase tracking-wider py-2">Item Code</TableHead>
                                                <TableHead className="h-8 text-[10px] font-bold text-slate-500 uppercase tracking-wider py-2">Description</TableHead>
                                                <TableHead className="h-8 text-[10px] font-bold text-slate-500 uppercase tracking-wider py-2 text-right">Opening</TableHead>
                                                <TableHead className="h-8 text-[10px] font-bold text-slate-500 uppercase tracking-wider py-2 text-right">Received</TableHead>
                                                <TableHead className="h-8 text-[10px] font-bold text-slate-500 uppercase tracking-wider py-2 text-right">Used</TableHead>
                                                <TableHead className="h-8 text-[10px] font-bold text-slate-500 uppercase tracking-wider py-2 text-right">Wastage</TableHead>
                                                <TableHead className="h-8 text-[10px] font-bold text-slate-500 uppercase tracking-wider py-2 text-right">Returned</TableHead>
                                                <TableHead className="h-8 text-[10px] font-bold text-slate-500 uppercase tracking-wider py-2 text-right font-bold bg-slate-50/50">Closing</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {reportData.items.length === 0 ? (
                                                <TableRow>
                                                    <TableCell colSpan={8} className="text-center py-8 text-xs text-slate-400">
                                                        No activity found for this month.
                                                    </TableCell>
                                                </TableRow>
                                            ) : (
                                                reportData.items.map((item: any) => (
                                                    <TableRow key={item.itemId} className="hover:bg-slate-50/30 text-xs">
                                                        <TableCell className="font-mono text-xs py-1.5">{item.itemCode}</TableCell>
                                                        <TableCell className="py-1.5">{item.itemName} <span className="text-[10px] text-slate-400">({item.unit})</span></TableCell>
                                                        <TableCell className="text-right text-slate-600 py-1.5">{item.opening}</TableCell>
                                                        <TableCell className="text-right text-green-700 font-medium py-1.5">+{item.received}</TableCell>
                                                        <TableCell className="text-right text-blue-700 font-medium py-1.5">-{item.used}</TableCell>
                                                        <TableCell className="text-right text-orange-700 py-1.5">-{item.wastage}</TableCell>
                                                        <TableCell className="text-right text-purple-700 py-1.5">-{item.returned}</TableCell>
                                                        <TableCell className="text-right font-bold bg-slate-50/50 border-l border-slate-100 py-1.5 text-slate-900">{item.closing.toFixed(2)}</TableCell>
                                                    </TableRow>
                                                ))
                                            )}
                                        </TableBody>
                                    </Table>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
}

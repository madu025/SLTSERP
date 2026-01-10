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

export default function BalanceSheetPage() {
    const [selectedContractor, setSelectedContractor] = useState<string>('');
    const [selectedStore, setSelectedStore] = useState<string>('');
    const [month, setMonth] = useState<string>(new Date().toISOString().slice(0, 7)); // YYYY-MM
    const [reportData, setReportData] = useState<any>(null);

    // --- FETCH DATA ---
    const { data: contractors = [] } = useQuery({
        queryKey: ['contractors'],
        queryFn: async () => (await fetch('/api/contractors')).json()
    });

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
        <div className="p-6 max-w-6xl mx-auto space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Monthly Balance Sheet</h1>
                    <p className="text-slate-500">Generate and freeze monthly material balances.</p>
                </div>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="text-sm font-medium uppercase text-slate-500">Report Criteria</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
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

                    <div className="space-y-2">
                        <Label>Month</Label>
                        <Input
                            type="month"
                            value={month}
                            onChange={(e) => setMonth(e.target.value)}
                        />
                    </div>

                    <Button onClick={handleGenerate} disabled={generateMutation.isPending}>
                        {generateMutation.isPending ? <Loader2 className="animate-spin w-4 h-4 mr-2" /> : <FileSpreadsheet className="w-4 h-4 mr-2" />}
                        Generate Report
                    </Button>
                </CardContent>
            </Card>

            {reportData && (
                <div className="space-y-4 animate-in slide-in-from-bottom-5 fade-in duration-500">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle>Report Preview: {month}</CardTitle>
                            <Button variant="default" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
                                <Save className="w-4 h-4 mr-2" />
                                {saveMutation.isPending ? "Saving..." : "Save & Freeze"}
                            </Button>
                        </CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Item Code</TableHead>
                                        <TableHead>Description</TableHead>
                                        <TableHead className="text-right">Opening</TableHead>
                                        <TableHead className="text-right">Received</TableHead>
                                        <TableHead className="text-right">Used</TableHead>
                                        <TableHead className="text-right">Wastage</TableHead>
                                        <TableHead className="text-right">Returned</TableHead>
                                        <TableHead className="text-right font-bold bg-slate-50">Closing</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {reportData.items.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={8} className="text-center py-8 text-slate-500">
                                                No activity found for this month.
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        reportData.items.map((item: any) => (
                                            <TableRow key={item.itemId}>
                                                <TableCell className="font-mono text-xs">{item.itemCode}</TableCell>
                                                <TableCell>{item.itemName} <span className="text-xs text-slate-400">({item.unit})</span></TableCell>
                                                <TableCell className="text-right text-slate-600">{item.opening}</TableCell>
                                                <TableCell className="text-right text-blue-600 font-medium">+{item.received}</TableCell>
                                                <TableCell className="text-right text-amber-600">-{item.used}</TableCell>
                                                <TableCell className="text-right text-orange-600">-{item.wastage}</TableCell>
                                                <TableCell className="text-right text-green-600">-{item.returned}</TableCell>
                                                <TableCell className="text-right font-bold bg-slate-50 border-l">{item.closing.toFixed(2)}</TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </div>
            )}
        </div>
    );
}

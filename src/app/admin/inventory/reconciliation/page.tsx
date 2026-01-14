"use client";

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { FileText, Loader2, Search, ChevronDown } from "lucide-react";
import { reconciliationFilterSchema } from '@/lib/validations/inventory';
import { z } from 'zod';
import { cn } from "@/lib/utils";

type FilterValues = z.infer<typeof reconciliationFilterSchema>;

export default function ReconciliationPage() {
    const form = useForm<FilterValues>({
        resolver: zodResolver(reconciliationFilterSchema),
        defaultValues: {
            contractorId: '',
            storeId: '',
            month: new Date().toISOString().slice(0, 7)
        }
    });

    const contractorId = form.watch('contractorId');
    const storeId = form.watch('storeId');
    const month = form.watch('month');

    // Fetch Stores
    const { data: stores = [] } = useQuery({
        queryKey: ['stores'],
        queryFn: async () => (await fetch('/api/stores')).json()
    });

    // Fetch Contractors
    const { data: contractorsData } = useQuery({
        queryKey: ['contractors-all'],
        queryFn: async () => (await fetch('/api/contractors?limit=1000')).json()
    });
    const contractors = contractorsData?.contractors || [];

    // Fetch Reconciliation Data
    const { data: reportResult, isLoading, isFetching, refetch } = useQuery({
        queryKey: ['reconciliation', contractorId, storeId, month],
        queryFn: async () => {
            if (!contractorId || !storeId || !month) return { success: true, data: [] };
            const res = await fetch(`/api/inventory/reconciliation?contractorId=${contractorId}&storeId=${storeId}&month=${month}`);
            if (!res.ok) throw new Error('Failed to fetch');
            return res.json();
        },
        enabled: !!(contractorId && storeId && month)
    });

    const report = reportResult?.data || [];

    const onSubmit = () => refetch();

    return (
        <div className="flex h-screen bg-slate-50 overflow-hidden">
            <Sidebar />
            <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
                <Header />
                <div className="flex-1 overflow-y-auto p-4 md:p-8">
                    <div className="max-w-7xl mx-auto space-y-6">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div>
                                <h1 className="text-2xl font-bold text-slate-900">Material Reconciliation</h1>
                                <p className="text-slate-500">Track and reconcile material usage against issued quantities.</p>
                            </div>
                            <Button variant="outline" className="gap-2">
                                <FileText className="w-4 h-4" />
                                Export CSV
                            </Button>
                        </div>

                        {/* Filter Bar */}
                        <Card className="border-none shadow-sm">
                            <CardContent className="p-4">
                                <Form {...form}>
                                    <form onSubmit={form.handleSubmit(onSubmit)} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                                        <FormField
                                            control={form.control}
                                            name="contractorId"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel className="text-xs text-slate-500 uppercase font-bold tracking-wider">Contractor</FormLabel>
                                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                        <FormControl>
                                                            <SelectTrigger className="bg-white">
                                                                <SelectValue placeholder="Select Contractor" />
                                                            </SelectTrigger>
                                                        </FormControl>
                                                        <SelectContent>
                                                            {contractors.map((c: any) => (
                                                                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />

                                        <FormField
                                            control={form.control}
                                            name="storeId"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel className="text-xs text-slate-500 uppercase font-bold tracking-wider">Storage Facility</FormLabel>
                                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                        <FormControl>
                                                            <SelectTrigger className="bg-white">
                                                                <SelectValue placeholder="Select Store" />
                                                            </SelectTrigger>
                                                        </FormControl>
                                                        <SelectContent>
                                                            {stores.map((s: any) => (
                                                                <SelectItem key={s.id} value={s.id}>{s.name} ({s.type})</SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />

                                        <FormField
                                            control={form.control}
                                            name="month"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel className="text-xs text-slate-500 uppercase font-bold tracking-wider">Accounting Month</FormLabel>
                                                    <FormControl>
                                                        <Input type="month" className="bg-white" {...field} />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />

                                        <Button
                                            type="submit"
                                            className="bg-blue-600 hover:bg-blue-700 h-10 w-full md:w-auto"
                                            disabled={isLoading || isFetching}
                                        >
                                            {(isLoading || isFetching) ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Search className="w-4 h-4 mr-2" />}
                                            Generate Report
                                        </Button>
                                    </form>
                                </Form>
                            </CardContent>
                        </Card>

                        {/* Report Table */}
                        <Card className="border-none shadow-sm overflow-hidden">
                            <CardHeader className="bg-white border-b py-4">
                                <CardTitle className="text-sm font-bold text-slate-700">Detailed Reconciliation Report</CardTitle>
                            </CardHeader>
                            <CardContent className="p-0">
                                <Table>
                                    <TableHeader className="bg-slate-50">
                                        <TableRow>
                                            <TableHead className="w-[100px]">Code</TableHead>
                                            <TableHead>Material Description</TableHead>
                                            <TableHead className="text-right">Issued</TableHead>
                                            <TableHead className="text-right">Used (SOD)</TableHead>
                                            <TableHead className="text-right">Wastage</TableHead>
                                            <TableHead className="text-right">Returned</TableHead>
                                            <TableHead className="text-right font-bold">Unaccounted / Stock</TableHead>
                                            <TableHead className="text-right">Unit Cost</TableHead>
                                            <TableHead className="text-right">Total Value</TableHead>
                                            <TableHead className="w-[100px]"></TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {report.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={8} className="text-center py-20 text-slate-400">
                                                    {isLoading ? "Fetching data..." : "No data found for selected criteria."}
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            report.map((item: any) => (
                                                <TableRow key={item.id} className="hover:bg-slate-50/50">
                                                    <TableCell className="font-mono text-xs">{item.code}</TableCell>
                                                    <TableCell>
                                                        <div className="flex flex-col">
                                                            <span className="font-medium text-slate-900">{item.name}</span>
                                                            <span className="text-[10px] text-slate-400 uppercase tracking-tighter">{item.unit}</span>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-right text-blue-600 font-medium">+{item.issued}</TableCell>
                                                    <TableCell className="text-right text-amber-600">-{item.used}</TableCell>
                                                    <TableCell className="text-right text-orange-600">-{item.wastage}</TableCell>
                                                    <TableCell className="text-right text-green-600">-{item.returned}</TableCell>
                                                    <TableCell className="text-right">
                                                        <div className="flex flex-col items-end">
                                                            <span className={cn(
                                                                "font-bold",
                                                                item.balance < 0 ? "text-red-600" : "text-slate-900"
                                                            )}>
                                                                {item.balance.toFixed(2)}
                                                            </span>
                                                            <span className="text-[10px] text-slate-400">Remaining</span>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-right font-mono text-[11px] text-slate-500">
                                                        {item.costPrice?.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                    </TableCell>
                                                    <TableCell className="text-right font-mono font-bold text-slate-900">
                                                        {item.totalValue?.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                    </TableCell>
                                                    <TableCell>
                                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400">
                                                            <ChevronDown className="w-4 h-4" />
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        )}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </main>
        </div>
    );
}

// Helper to remove custom cn definition since we now import from @/lib/utils

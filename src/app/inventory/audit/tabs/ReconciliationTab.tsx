"use client";

import { useQuery } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { FileText, Loader2, Search, ChevronDown } from "lucide-react";
import { reconciliationFilterSchema } from '@/lib/validations/inventory';
import { z } from 'zod';
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

interface ReconciliationItem {
    id: string;
    code: string;
    name: string;
    unit: string;
    issued: number;
    used: number;
    wastage: number;
    returned: number;
    balance: number;
    costPrice?: number;
    totalValue?: number;
}

interface StoreItem {
    id: string;
    name: string;
    type: string;
}

type FilterValues = z.infer<typeof reconciliationFilterSchema>;

export default function ReconciliationTab() {
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
    const { data: stores = [] } = useQuery<StoreItem[]>({
        queryKey: ['stores'],
        queryFn: async () => (await fetch('/api/stores')).json()
    });

    // Fetch Contractors
    const { data: contractorsData } = useQuery<ContractorResponse>({
        queryKey: ['contractors-all'],
        queryFn: async () => (await fetch('/api/admin/contractors?limit=1000')).json()
    });
    const contractors: ContractorItem[] = contractorsData?.success && Array.isArray(contractorsData.data?.contractors)
        ? contractorsData.data.contractors
        : Array.isArray(contractorsData?.contractors)
            ? contractorsData.contractors
            : [];

    // Fetch Reconciliation Data
    const { data: reportResult, isLoading, isFetching, refetch } = useQuery<{ success: boolean; data: ReconciliationItem[] }>({
        queryKey: ['reconciliation', contractorId, storeId, month],
        queryFn: async () => {
            if (!contractorId || !storeId || !month) return { success: true, data: [] };
            const res = await fetch(`/api/inventory/reconciliation?contractorId=${contractorId}&storeId=${storeId}&month=${month}`);
            if (!res.ok) throw new Error('Failed to fetch');
            return res.json();
        },
        enabled: !!(contractorId && storeId && month)
    });

    const report: ReconciliationItem[] = reportResult?.data || [];

    const onSubmit = () => refetch();

    return (
        <div className="space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-white dark:bg-slate-950 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                <div>
                    <h2 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">Material Reconciliation</h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Track and reconcile material usage against issued quantities per contractor and store.</p>
                </div>
                <Button variant="outline" className="h-8 text-xs border-slate-200 dark:border-slate-800 gap-1.5 shadow-sm">
                    <FileText className="w-3.5 h-3.5" />
                    Export CSV
                </Button>
            </div>

            {/* Filter Bar */}
            <div className="p-4 bg-white dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
                        <FormField
                            control={form.control}
                            name="contractorId"
                            render={({ field }) => (
                                <FormItem className="space-y-1">
                                    <FormLabel className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Contractor</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <FormControl>
                                            <SelectTrigger className="bg-white dark:bg-slate-900 h-9 text-xs border-slate-200 dark:border-slate-800">
                                                <SelectValue placeholder="Select Contractor" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            {contractors.map((c: ContractorItem) => (
                                                <SelectItem key={c.id} value={c.id} className="text-xs">{c.name}</SelectItem>
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
                                <FormItem className="space-y-1">
                                    <FormLabel className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Storage Facility</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <FormControl>
                                            <SelectTrigger className="bg-white dark:bg-slate-900 h-9 text-xs border-slate-200 dark:border-slate-800">
                                                <SelectValue placeholder="Select Store" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            {stores.map((s: StoreItem) => (
                                                <SelectItem key={s.id} value={s.id} className="text-xs">{s.name} ({s.type})</SelectItem>
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
                                <FormItem className="space-y-1">
                                    <FormLabel className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Accounting Month</FormLabel>
                                    <FormControl>
                                        <Input type="month" className="bg-white dark:bg-slate-900 h-9 text-xs border-slate-200 dark:border-slate-800" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <Button
                            type="submit"
                            className="bg-blue-600 hover:bg-blue-700 text-white font-bold h-9 text-xs w-full md:w-auto px-4 shadow-sm"
                            disabled={isLoading || isFetching}
                        >
                            {(isLoading || isFetching) ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <Search className="w-3.5 h-3.5 mr-1.5" />}
                            Generate Report
                        </Button>
                    </form>
                </Form>
            </div>

            {/* Report Table */}
            <div className="bg-white dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                <div className="border-b border-slate-200 dark:border-slate-800 px-4 py-3 flex items-center justify-between">
                    <h3 className="text-xs font-black uppercase text-slate-900 dark:text-white tracking-wider">Detailed Reconciliation Report</h3>
                </div>
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-800">
                            <TableRow className="hover:bg-transparent">
                                <TableHead className="w-[100px] h-8 text-[10px] font-bold text-slate-500 uppercase tracking-wider py-2">Code</TableHead>
                                <TableHead className="h-8 text-[10px] font-bold text-slate-500 uppercase tracking-wider py-2">Material Description</TableHead>
                                <TableHead className="h-8 text-[10px] font-bold text-slate-500 uppercase tracking-wider py-2 text-right">Issued</TableHead>
                                <TableHead className="h-8 text-[10px] font-bold text-slate-500 uppercase tracking-wider py-2 text-right">Used (SOD)</TableHead>
                                <TableHead className="h-8 text-[10px] font-bold text-slate-500 uppercase tracking-wider py-2 text-right">Wastage</TableHead>
                                <TableHead className="h-8 text-[10px] font-bold text-slate-500 uppercase tracking-wider py-2 text-right">Returned</TableHead>
                                <TableHead className="h-8 text-[10px] font-bold text-slate-500 uppercase tracking-wider py-2 text-right font-bold">Unaccounted / Stock</TableHead>
                                <TableHead className="h-8 text-[10px] font-bold text-slate-500 uppercase tracking-wider py-2 text-right">Unit Cost</TableHead>
                                <TableHead className="h-8 text-[10px] font-bold text-slate-500 uppercase tracking-wider py-2 text-right">Total Value</TableHead>
                                <TableHead className="w-[60px] h-8 text-[10px] font-bold text-slate-500 uppercase tracking-wider py-2 text-center"></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {report.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={10} className="text-center py-16 text-xs text-slate-400">
                                        {isLoading ? "Fetching data..." : "No data found for selected criteria."}
                                    </TableCell>
                                </TableRow>
                            ) : (
                                report.map((item: ReconciliationItem) => (
                                    <TableRow key={item.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/50 text-xs">
                                        <TableCell className="font-mono text-xs py-2">{item.code}</TableCell>
                                        <TableCell className="py-2">
                                            <div className="flex flex-col">
                                                <span className="font-medium text-slate-900 dark:text-white">{item.name}</span>
                                                <span className="text-[10px] text-slate-400 uppercase tracking-tighter">{item.unit}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right text-blue-600 font-medium py-2">+{item.issued}</TableCell>
                                        <TableCell className="text-right text-amber-600 py-2">-{item.used}</TableCell>
                                        <TableCell className="text-right text-orange-600 py-2">-{item.wastage}</TableCell>
                                        <TableCell className="text-right text-emerald-600 py-2">-{item.returned}</TableCell>
                                        <TableCell className="text-right py-2">
                                            <div className="flex flex-col items-end">
                                                <span className={cn(
                                                    "font-bold",
                                                    item.balance < 0 ? "text-rose-600 dark:text-rose-400" : "text-slate-900 dark:text-white"
                                                )}>
                                                    {item.balance.toFixed(2)}
                                                </span>
                                                <span className="text-[9px] text-slate-400">Remaining</span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right font-mono text-[11px] text-slate-500 py-2">
                                            {item.costPrice?.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                        </TableCell>
                                        <TableCell className="text-right font-mono font-bold text-slate-900 dark:text-white py-2">
                                            {item.totalValue?.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                        </TableCell>
                                        <TableCell className="text-center py-2">
                                            <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400">
                                                <ChevronDown className="w-3.5 h-3.5" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>
            </div>
        </div>
    );
}

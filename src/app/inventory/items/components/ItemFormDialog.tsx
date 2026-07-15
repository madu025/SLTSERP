"use client";

import React, { useEffect, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertTriangle, Info, X, Barcode, FileText, Tag, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const itemSchema = z.object({
    code: z.string().min(2, "Item code is required"),
    sltCode: z.string().optional(),
    name: z.string().min(2, "Item name is required"),
    commonName: z.string().min(2, "Common name is required"),
    unit: z.enum(['Nos', 'kg', 'L', 'm', 'km', 'pkts', 'Box', 'Bot', 'Set', 'Roll', 'gram', 'ml']),
    type: z.enum(['SLT', 'SLTS']),
    category: z.string().min(1, "Category is required"),
    commonFor: z.array(z.string()).optional(),
    minLevel: z.string().optional().refine((val) => !val || !isNaN(parseFloat(val)) && parseFloat(val) >= 0, { message: "Invalid number" }),
    isWastageAllowed: z.boolean(),
    maxWastagePercentage: z.string().optional().refine((val) => !val || !isNaN(parseFloat(val)) && parseFloat(val) >= 0, { message: "Invalid number" }),
    unitPrice: z.string().optional().refine((val) => !val || !isNaN(parseFloat(val)) && parseFloat(val) >= 0, { message: "Invalid number" }),
    costPrice: z.string().optional().refine((val) => !val || !isNaN(parseFloat(val)) && parseFloat(val) >= 0, { message: "Invalid number" }),
    hasSerial: z.boolean(),
    description: z.string().optional(),
    importAliases: z.array(z.string()).optional()
});

type ItemFormValues = z.infer<typeof itemSchema>;

interface ItemFormDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    initialData?: (ItemFormValues & { id: string }) | null;
    onSubmit: (values: ItemFormValues) => Promise<void>;
    isSubmitting: boolean;
}

export function ItemFormDialog({ open, onOpenChange, initialData, onSubmit, isSubmitting }: ItemFormDialogProps) {
    const [aliasInput, setAliasInput] = useState("");

    const form = useForm<ItemFormValues>({
        resolver: zodResolver(itemSchema),
        defaultValues: {
            code: "",
            name: "",
            commonName: "",
            unit: "Nos",
            type: "SLTS",
            category: "OTHERS",
            commonFor: ["OTHERS"],
            minLevel: "0",
            isWastageAllowed: true,
            maxWastagePercentage: "0",
            unitPrice: "0",
            costPrice: "0",
            hasSerial: false,
            description: "",
            importAliases: []
        }
    });

    useEffect(() => {
        if (open) {
            if (initialData) {
                form.reset({
                    ...initialData,
                    minLevel: (initialData.minLevel || "0").toString(),
                    maxWastagePercentage: (initialData.maxWastagePercentage || "0").toString(),
                    unitPrice: (initialData.unitPrice || "0").toString(),
                    costPrice: (initialData.costPrice || "0").toString(),
                });
                setTimeout(() => setAliasInput(initialData.importAliases?.join(", ") || ""), 0);
            } else {
                form.reset();
                setTimeout(() => setAliasInput(""), 0);
            }
        }
    }, [open, initialData, form]);

    const isWastageAllowed = useWatch({ control: form.control, name: "isWastageAllowed" });
    const watchedCode = useWatch({ control: form.control, name: "code" });
    const watchedName = useWatch({ control: form.control, name: "name" });
    const watchedCategory = useWatch({ control: form.control, name: "category" });
    const watchedUnit = useWatch({ control: form.control, name: "unit" });
    const watchedHasSerial = useWatch({ control: form.control, name: "hasSerial" });
    const watchedCostPrice = useWatch({ control: form.control, name: "costPrice" });
    const watchedUnitPrice = useWatch({ control: form.control, name: "unitPrice" });

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent 
                showCloseButton={false}
                className="fixed !inset-y-0 !right-0 !top-0 !left-auto !translate-x-0 !translate-y-0 !h-full w-[65vw] !max-w-none flex flex-col !p-0 !gap-0 overflow-hidden bg-white dark:bg-slate-950 border-l border-slate-200 dark:border-slate-800 shadow-2xl z-50 duration-300 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right !rounded-none"
            >
                {/* Header */}
                <div className="relative p-6 pb-4 flex-shrink-0 bg-slate-50 dark:bg-slate-900/60 border-b border-slate-200/60 dark:border-slate-800/60">
                    <div className="absolute top-0 right-0 p-5">
                        <button 
                            type="button"
                            onClick={() => onOpenChange(false)} 
                            className="p-2 rounded-full hover:bg-slate-200/50 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>

                    <div className="space-y-1">
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Material Directory</span>
                            <Badge className="bg-blue-50 text-blue-600 border border-blue-200 dark:bg-blue-955/20 text-[9px] px-2 py-0 font-bold rounded-full">
                                {initialData ? "Modify Asset" : "Register Material"}
                            </Badge>
                        </div>
                        <h2 className="text-xl font-black text-slate-900 dark:text-white leading-tight">
                            {initialData ? "Edit Item Details" : "Add New Item"}
                        </h2>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                            Register item specification, measurements, pricing details, and inventory policies.
                        </p>
                    </div>
                </div>

                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="flex-1 flex flex-col overflow-hidden">
                        {/* Body Split */}
                        <div className="flex-1 flex overflow-hidden bg-slate-50/50 dark:bg-slate-950/20">
                            {/* Left Panel - Scrollable Form */}
                            <div className="w-[65%] h-full overflow-y-auto p-6 space-y-6 border-r border-slate-200/50 dark:border-slate-800/50 [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-slate-200 dark:[&::-webkit-scrollbar-thumb]:bg-slate-800/60 [&::-webkit-scrollbar-thumb]:rounded-full">
                                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-sm space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <FormField control={form.control} name="code" render={({ field }) => (
                                            <FormItem>
                                                <FormLabel className="text-[10px] font-black uppercase tracking-widest text-slate-400">Internal Item Code</FormLabel>
                                                <FormControl><Input {...field} placeholder="e.g. SLTS-CABLE-001" className="h-9 border-slate-200 bg-slate-50/50 dark:bg-slate-950 font-mono text-xs rounded-lg px-3 focus-visible:ring-1 focus-visible:ring-blue-500" disabled={!!initialData} /></FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )} />
                                        <FormField control={form.control} name="sltCode" render={({ field }) => (
                                            <FormItem>
                                                <FormLabel className="text-[10px] font-black uppercase tracking-widest text-slate-400">SLT Item Code (Optional)</FormLabel>
                                                <FormControl><Input {...field} value={field.value || ""} placeholder="e.g. C-1234" className="h-9 border-slate-200 bg-slate-50/50 dark:bg-slate-950 font-mono text-xs rounded-lg px-3 focus-visible:ring-1 focus-visible:ring-blue-500" /></FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )} />
                                    </div>

                                    <FormField control={form.control} name="name" render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-[10px] font-black uppercase tracking-widest text-slate-400">Full Item Name</FormLabel>
                                            <FormControl><Input {...field} placeholder="e.g. Fiber Optic Cable 4-Core" className="h-9 border-slate-200 rounded-lg px-3 focus-visible:ring-1 focus-visible:ring-blue-500 font-bold" /></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )} />

                                    <FormField control={form.control} name="commonName" render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-[10px] font-black uppercase tracking-widest text-slate-400">Common Name</FormLabel>
                                            <FormControl><Input {...field} placeholder="e.g. Drop Cable" className="h-9 border-slate-200 rounded-lg px-3 focus-visible:ring-1 focus-visible:ring-blue-500 font-semibold" /></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )} />

                                    <div className="grid grid-cols-2 gap-4">
                                        <FormField control={form.control} name="unit" render={({ field }) => (
                                            <FormItem>
                                                <FormLabel className="text-[10px] font-black uppercase tracking-widest text-slate-400">Unit of Measure</FormLabel>
                                                <Select onValueChange={field.onChange} value={field.value}>
                                                    <FormControl><SelectTrigger className="h-9 bg-slate-50/50 dark:bg-slate-950 border-slate-200 text-xs font-bold rounded-lg"><SelectValue /></SelectTrigger></FormControl>
                                                    <SelectContent>
                                                        {['Nos', 'm', 'kg', 'gram', 'L', 'ml', 'Box', 'pkts', 'km', 'Set', 'Roll', 'Bot'].map(u => <SelectItem key={u} value={u} className="text-xs">{u}</SelectItem>)}
                                                    </SelectContent>
                                                </Select>
                                            </FormItem>
                                        )} />
                                        <FormField control={form.control} name="category" render={({ field }) => (
                                            <FormItem>
                                                <FormLabel className="text-[10px] font-black uppercase tracking-widest text-slate-400">Item Category</FormLabel>
                                                <Select onValueChange={field.onChange} value={field.value}>
                                                    <FormControl><SelectTrigger className="h-9 bg-slate-50/50 dark:bg-slate-950 border-slate-200 text-xs font-bold rounded-lg"><SelectValue /></SelectTrigger></FormControl>
                                                    <SelectContent>
                                                        {['CABLES', 'POLES', 'FIBER_ACCESSORIES', 'COPPER_ACCESSORIES', 'HARDWARE', 'EQUIPMENT', 'OTHERS'].map(c => <SelectItem key={c} value={c} className="text-xs">{c.replace('_', ' ')}</SelectItem>)}
                                                    </SelectContent>
                                                </Select>
                                            </FormItem>
                                        )} />
                                    </div>
                                </div>

                                <div className="bg-amber-50 dark:bg-amber-955/10 border border-amber-200 dark:border-amber-900/50 p-4 rounded-2xl space-y-3">
                                    <FormField control={form.control} name="minLevel" render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-[10px] font-black uppercase tracking-widest text-amber-600 flex items-center gap-1.5">
                                                <AlertTriangle className="w-3.5 h-3.5 text-amber-500" /> Minimum Stock Level Threshold
                                            </FormLabel>
                                            <FormControl><Input {...field} type="number" className="h-9 bg-white dark:bg-slate-950 border-amber-200 dark:border-amber-900/60 rounded-lg px-3 focus-visible:ring-1 focus-visible:ring-amber-500 font-black text-amber-900 dark:text-amber-400 text-right" /></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )} />
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3">
                                        <FormField control={form.control} name="isWastageAllowed" render={({ field }) => (
                                            <FormItem className="flex items-center justify-between space-y-0">
                                                <FormLabel className="text-[10px] font-black uppercase tracking-widest text-slate-500">Allow Material Wastage</FormLabel>
                                                <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} className="data-[state=checked]:bg-slate-900" /></FormControl>
                                            </FormItem>
                                        )} />
                                        {isWastageAllowed && (
                                            <FormField control={form.control} name="maxWastagePercentage" render={({ field }) => (
                                                <FormItem>
                                                    <div className="relative">
                                                        <Input {...field} type="number" className="h-9 px-3 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-right pr-8 font-black focus-visible:ring-1 focus-visible:ring-blue-500" />
                                                        <span className="absolute right-3 top-2.5 text-[9px] font-black text-slate-400 opacity-50">% Max</span>
                                                    </div>
                                                </FormItem>
                                            )} />
                                        )}
                                    </div>

                                    <div className="p-4 rounded-2xl bg-blue-50/50 dark:bg-blue-955/10 border border-blue-150/40 dark:border-blue-900/40 flex items-center justify-between">
                                        <div className="space-y-0.5">
                                            <FormLabel className="text-[10px] font-black uppercase tracking-widest text-blue-600 dark:text-blue-400">Track by Serial Number</FormLabel>
                                            <p className="text-[9px] text-blue-400 dark:text-blue-550 font-bold leading-tight">Requires unique serial codes per unit transaction</p>
                                        </div>
                                        <FormField control={form.control} name="hasSerial" render={({ field }) => (
                                            <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} className="data-[state=checked]:bg-blue-600 border-blue-200" /></FormControl>
                                        )} />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                                    <FormField control={form.control} name="costPrice" render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-[10px] font-black uppercase tracking-widest text-slate-400">Cost Price (LKR)</FormLabel>
                                            <FormControl><Input {...field} type="number" step="0.01" className="h-9 bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 rounded-lg px-3 focus-visible:ring-1 focus-visible:ring-blue-500 font-black text-rose-600 text-right" /></FormControl>
                                        </FormItem>
                                    )} />
                                    <FormField control={form.control} name="unitPrice" render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-[10px] font-black uppercase tracking-widest text-slate-400">Unit Price (LKR)</FormLabel>
                                            <FormControl><Input {...field} type="number" step="0.01" className="h-9 bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 rounded-lg px-3 focus-visible:ring-1 focus-visible:ring-blue-500 font-black text-emerald-600 text-right" /></FormControl>
                                        </FormItem>
                                    )} />
                                </div>

                                <FormField control={form.control} name="importAliases" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-[10px] font-black uppercase tracking-widest text-slate-400">Import Aliases (Comma separated)</FormLabel>
                                        <FormControl>
                                            <Input
                                                className="h-9 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-lg px-3 focus-visible:ring-1 focus-visible:ring-blue-500 font-mono text-[10px]"
                                                placeholder="ALIAS_1, ALIAS_2, EXTERNAL_CODE"
                                                value={aliasInput}
                                                onChange={(e) => {
                                                    const val = e.target.value;
                                                    setAliasInput(val);
                                                    field.onChange(val.split(",").map(s => s.trim()).filter(Boolean));
                                                }}
                                            />
                                        </FormControl>
                                        <p className="text-[9px] text-slate-400 font-bold italic px-1">Used to automatically match items when importing from Excel files.</p>
                                    </FormItem>
                                    )} />
                            </div>

                            {/* Right Panel - Real-Time Preview */}
                            <div className="w-[35%] h-full overflow-y-auto p-6 bg-slate-50/50 dark:bg-slate-900/10 border-l border-slate-200/50 dark:border-slate-800/50 space-y-6">
                                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
                                    <h4 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                                        <FileText className="w-3.5 h-3.5 text-blue-500" /> Live Data Card
                                    </h4>

                                    <div className="p-4 bg-slate-50 dark:bg-slate-950 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center text-center py-6 space-y-3">
                                        <Barcode className="w-12 h-12 text-slate-400 opacity-60" />
                                        <div className="space-y-1">
                                            <span className="font-mono text-xs font-bold text-slate-800 dark:text-slate-250 block bg-slate-100 dark:bg-slate-900 px-2 py-0.5 rounded">
                                                {watchedCode || "CODE-PENDING"}
                                            </span>
                                            <span className="font-bold text-slate-900 dark:text-white text-xs block max-w-[180px] truncate">
                                                {watchedName || "Unnamed Material"}
                                            </span>
                                        </div>

                                        <div className="flex flex-wrap gap-1.5 justify-center mt-1">
                                            <Badge className="bg-blue-50 hover:bg-blue-50 text-blue-600 border border-blue-150/50 text-[9px] px-1.5 py-0 font-bold rounded">
                                                {watchedCategory || "OTHERS"}
                                            </Badge>
                                            <Badge className="bg-slate-100 hover:bg-slate-100 text-slate-600 border text-[9px] px-1.5 py-0 font-bold rounded">
                                                UOM: {watchedUnit || "Nos"}
                                            </Badge>
                                            {watchedHasSerial && (
                                                <Badge className="bg-purple-50 hover:bg-purple-50 text-purple-600 border border-purple-150/40 text-[9px] px-1.5 py-0 font-bold rounded flex items-center gap-0.5">
                                                    <ShieldCheck className="w-2.5 h-2.5" /> Serialized
                                                </Badge>
                                            )}
                                        </div>
                                    </div>

                                    <div className="space-y-2.5 text-xs pt-1">
                                        <div className="flex justify-between items-center py-1 border-b border-slate-100 dark:border-slate-800/80">
                                            <span className="text-slate-500">Suggested Cost</span>
                                            <span className="font-mono font-bold text-rose-600">LKR {Number(watchedCostPrice || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                        </div>
                                        <div className="flex justify-between items-center py-1 border-b border-slate-100 dark:border-slate-800/80">
                                            <span className="text-slate-500">Retail Unit Price</span>
                                            <span className="font-mono font-bold text-emerald-600">LKR {Number(watchedUnitPrice || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="px-6 py-4 bg-white dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 flex justify-end items-center flex-shrink-0 gap-3">
                            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="h-9 px-4 text-xs font-bold rounded-xl border-slate-200 hover:bg-slate-50 text-slate-700">
                                Cancel
                            </Button>
                            <Button 
                                type="submit" 
                                disabled={isSubmitting} 
                                className="h-9 px-5 rounded-xl bg-slate-900 hover:bg-slate-850 text-white font-bold text-xs uppercase tracking-wider shadow-sm"
                            >
                                {isSubmitting ? "Saving..." : "Save Item Details"}
                            </Button>
                        </div>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}

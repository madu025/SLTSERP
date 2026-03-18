"use client";

import React, { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertTriangle, Info, Package, Target } from "lucide-react";

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
                setAliasInput(initialData.importAliases?.join(", ") || "");
            } else {
                form.reset();
                setAliasInput("");
            }
        }
    }, [open, initialData, form]);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-xl max-h-[95vh] flex flex-col p-0 overflow-hidden rounded-3xl border-none shadow-2xl">
                <DialogHeader className="px-8 py-6 bg-slate-50/50 border-b">
                    <DialogTitle className="text-xl font-black text-slate-900 tracking-tight">
                        {initialData ? "Edit Item Details" : "Add New Item"}
                    </DialogTitle>
                    <DialogDescription className="text-xs font-semibold text-slate-500">Fill in the details to save this item in the inventory.</DialogDescription>
                </DialogHeader>

                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="flex-1 flex flex-col overflow-hidden">
                        <div className="flex-1 overflow-y-auto px-8 py-6 space-y-6">
                            <div className="grid grid-cols-2 gap-6">
                                <FormField control={form.control} name="code" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-[10px] font-black uppercase tracking-widest text-slate-400">Internal Item Code</FormLabel>
                                        <FormControl><Input {...field} placeholder="e.g. SLTS-CABLE-001" className="h-11 border-slate-100 bg-slate-50/50 font-mono text-xs" disabled={!!initialData} /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                                <FormField control={form.control} name="sltCode" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-[10px] font-black uppercase tracking-widest text-slate-400">SLT Item Code (Optional)</FormLabel>
                                        <FormControl><Input {...field} value={field.value || ""} placeholder="e.g. C-1234" className="h-11 border-slate-100 bg-slate-50/50 font-mono text-xs" /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                            </div>

                            <FormField control={form.control} name="name" render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-[10px] font-black uppercase tracking-widest text-slate-400">Full Item Name</FormLabel>
                                    <FormControl><Input {...field} placeholder="e.g. Fiber Optic Cable 4-Core" className="h-11 shadow-sm font-bold" /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />

                            <div className="grid grid-cols-2 gap-6">
                                <FormField control={form.control} name="unit" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-[10px] font-black uppercase tracking-widest text-slate-400">Unit of Measure</FormLabel>
                                        <Select onValueChange={field.onChange} value={field.value}>
                                            <FormControl><SelectTrigger className="h-11 bg-slate-50/50 border-slate-100 text-xs font-bold"><SelectValue /></SelectTrigger></FormControl>
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
                                            <FormControl><SelectTrigger className="h-11 bg-slate-50/50 border-slate-100 text-xs font-bold"><SelectValue /></SelectTrigger></FormControl>
                                            <SelectContent>
                                                {['CABLES', 'POLES', 'FIBER_ACCESSORIES', 'COPPER_ACCESSORIES', 'HARDWARE', 'EQUIPMENT', 'OTHERS'].map(c => <SelectItem key={c} value={c} className="text-xs">{c.replace('_', ' ')}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    </FormItem>
                                )} />
                            </div>

                            <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100 space-y-4">
                                <FormField control={form.control} name="minLevel" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-[10px] font-black uppercase tracking-widest text-amber-600 flex items-center gap-1.5 line-through-none">
                                            <AlertTriangle className="w-3 h-3" /> Minimum Stock Level (Alert)
                                        </FormLabel>
                                        <FormControl><Input {...field} type="number" className="h-11 bg-white border-amber-200 focus:ring-amber-200 font-black text-amber-900" /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                                <div className="flex items-center gap-2 text-[10px] text-amber-600 font-bold opacity-70 px-1">
                                    <Info className="w-3 h-3" /> You will receive an alert if the stock falls below this level.
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-3">
                                    <FormField control={form.control} name="isWastageAllowed" render={({ field }) => (
                                        <FormItem className="flex items-center justify-between space-y-0">
                                            <FormLabel className="text-[10px] font-black uppercase tracking-widest text-slate-500">Allow Material Wastage</FormLabel>
                                            <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} className="data-[state=checked]:bg-slate-900" /></FormControl>
                                        </FormItem>
                                    )} />
                                    {form.watch("isWastageAllowed") && (
                                        <FormField control={form.control} name="maxWastagePercentage" render={({ field }) => (
                                            <FormItem>
                                                <div className="relative">
                                                    <Input {...field} type="number" className="h-9 px-3 text-xs bg-white text-right pr-8 font-black" />
                                                    <span className="absolute right-3 top-2.5 text-[10px] font-black text-slate-400 opacity-50">% Max</span>
                                                </div>
                                            </FormItem>
                                        )} />
                                    )}
                                </div>

                                <div className="p-4 rounded-2xl bg-blue-50/50 border border-blue-100 flex items-center justify-between">
                                    <div className="space-y-0.5">
                                        <FormLabel className="text-[10px] font-black uppercase tracking-widest text-blue-600">Track by Serial Number</FormLabel>
                                        <p className="text-[9px] text-blue-400 font-bold">Requires serial number entry for every transaction</p>
                                    </div>
                                    <FormField control={form.control} name="hasSerial" render={({ field }) => (
                                        <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} className="data-[state=checked]:bg-blue-600 border-blue-200" /></FormControl>
                                    )} />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-6 bg-slate-50/30 p-4 rounded-2xl border border-dashed">
                                <FormField control={form.control} name="costPrice" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-[10px] font-black uppercase tracking-widest text-slate-400">Cost Price (LKR)</FormLabel>
                                        <FormControl><Input {...field} type="number" step="0.01" className="h-11 bg-white border-slate-100 font-black text-rose-600" /></FormControl>
                                    </FormItem>
                                )} />
                                <FormField control={form.control} name="unitPrice" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-[10px] font-black uppercase tracking-widest text-slate-400">Unit Price (LKR)</FormLabel>
                                        <FormControl><Input {...field} type="number" step="0.01" className="h-11 bg-white border-slate-100 font-black text-emerald-600" /></FormControl>
                                    </FormItem>
                                )} />
                            </div>

                            <FormField control={form.control} name="importAliases" render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-[10px] font-black uppercase tracking-widest text-slate-400">Import Aliases (Comma separated)</FormLabel>
                                    <FormControl>
                                        <Input
                                            className="h-11 bg-slate-50 border-slate-100 font-mono text-[10px]"
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

                        <DialogFooter className="px-8 py-6 bg-slate-50 border-t flex justify-between items-center">
                            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} className="font-bold text-slate-400">Cancel</Button>
                            <Button type="submit" disabled={isSubmitting} className="h-12 px-10 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-black text-xs uppercase tracking-widest shadow-2XL shadow-slate-200">
                                {isSubmitting ? "Saving..." : "Save Item Details"}
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}

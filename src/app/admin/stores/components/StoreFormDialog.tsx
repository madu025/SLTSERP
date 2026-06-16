"use client";

import React, { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Building2, MapPin, User, Layers, Check, X } from "lucide-react";

const storeSchema = z.object({
    name: z.string().min(2, "Name required"),
    type: z.enum(['MAIN', 'SUB']),
    location: z.string().optional(),
    managerId: z.string().nullable().optional(),
    opmcIds: z.array(z.string()).default([])
});

type StoreFormValues = z.infer<typeof storeSchema>;

interface StoreFormDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    initialData?: (StoreFormValues & { id: string }) | null;
    onSubmit: (values: StoreFormValues) => Promise<void>;
    isSubmitting: boolean;
    users: any[];
    opmcs: any[];
}

export function StoreFormDialog({ open, onOpenChange, initialData, onSubmit, isSubmitting, users, opmcs }: StoreFormDialogProps) {
    const form = useForm<StoreFormValues>({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        resolver: zodResolver(storeSchema) as any,
        defaultValues: {
            name: "",
            type: "SUB",
            location: "",
            managerId: null,
            opmcIds: []
        }
    });

    useEffect(() => {
        if (open) {
            if (initialData) {
                form.reset({
                    name: initialData.name,
                    type: initialData.type as 'MAIN' | 'SUB',
                    location: initialData.location || "",
                    managerId: initialData.managerId || null,
                    opmcIds: initialData.opmcIds || []
                });
            } else {
                form.reset();
            }
        }
    }, [open, initialData, form]);

    const toggleOPMC = (id: string) => {
        const current = form.getValues("opmcIds") || [];
        const next = current.includes(id) ? current.filter(i => i !== id) : [...current, id];
        form.setValue("opmcIds", next, { shouldValidate: true });
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-xl rounded-[40px] border-none shadow-2xl p-0 overflow-hidden flex flex-col max-h-[90vh]">
                <DialogHeader className="px-10 py-8 bg-slate-50 border-b">
                    <DialogTitle className="text-2xl font-black text-slate-900 tracking-tight">
                        {initialData ? "Refine Store Logistics" : "Register Logistics Center"}
                    </DialogTitle>
                    <DialogDescription className="text-xs font-semibold text-slate-500 uppercase tracking-widest mt-1">
                        Define physical anchors and jurisdictional clusters.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto px-10 py-8 space-y-8 no-scrollbar">
                    <Form {...form}>
                        <form id="store-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                            <FormField control={form.control} name="name" render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-[10px] font-black uppercase tracking-widest text-slate-400">Formal Center Label</FormLabel>
                                    <FormControl><Input {...field} placeholder="e.g., Kaduwela Distribution Center" className="h-12 bg-white border-slate-100 rounded-2xl shadow-sm font-black text-slate-800" /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />

                            <div className="grid grid-cols-2 gap-6">
                                <FormField control={form.control} name="type" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-[10px] font-black uppercase tracking-widest text-slate-400">Center Classification</FormLabel>
                                        <Select onValueChange={field.onChange} value={field.value}>
                                            <FormControl><SelectTrigger className="h-12 bg-white border-slate-100 rounded-2xl text-xs font-bold"><SelectValue /></SelectTrigger></FormControl>
                                            <SelectContent className="rounded-2xl shadow-2xl">
                                                <SelectItem value="MAIN" className="text-xs font-bold font-black">MAIN HUB</SelectItem>
                                                <SelectItem value="SUB" className="text-xs font-bold">REGIONAL SUB</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </FormItem>
                                )} />
                                <FormField control={form.control} name="location" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-[10px] font-black uppercase tracking-widest text-slate-400">Spatial Coordinates / Area</FormLabel>
                                        <FormControl><Input {...field} placeholder="Colombo-07 District" className="h-12 bg-white border-slate-100 rounded-2xl text-xs font-bold" /></FormControl>
                                    </FormItem>
                                )} />
                            </div>

                            <FormField control={form.control} name="managerId" render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-[10px] font-black uppercase tracking-widest text-slate-400">Logistics Administrator</FormLabel>
                                    <Select onValueChange={val => field.onChange(val === "NONE" ? null : val)} value={field.value || "NONE"}>
                                        <FormControl><SelectTrigger className="h-12 bg-white border-slate-100 rounded-2xl text-xs font-bold">
                                            <div className="flex items-center gap-2">
                                                <User className="w-3.5 h-3.5 text-slate-400" />
                                                <SelectValue placeholder="Assign Overseer..." />
                                            </div>
                                        </SelectTrigger></FormControl>
                                        <SelectContent className="rounded-2xl max-h-60 shadow-2xl">
                                            <SelectItem value="NONE" className="text-xs font-bold italic opacity-60">No administrator assigned</SelectItem>
                                            {users.map((user: any) => (
                                                <SelectItem key={user.id} value={user.id} className="text-xs font-bold">{user.name} ({user.email})</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </FormItem>
                            )} />

                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Jurisdictional Coverage (RTOMs)</Label>
                                    <span className="text-[9px] font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">{form.watch("opmcIds")?.length || 0} Assigned</span>
                                </div>
                                <div className="grid grid-cols-2 gap-3 max-h-60 overflow-y-auto pr-2 no-scrollbar border-y py-4 border-slate-50">
                                    {opmcs.map((opmc) => (
                                        <div 
                                            key={opmc.id} 
                                            onClick={() => toggleOPMC(opmc.id)}
                                            className={`flex items-center justify-between p-3 rounded-2xl border transition-all cursor-pointer group ${form.watch("opmcIds").includes(opmc.id) ? 'bg-blue-600 border-blue-600 shadow-lg shadow-blue-100' : 'bg-slate-50 border-slate-100 hover:border-slate-200'}`}
                                        >
                                            <div className="space-y-0.5">
                                                <p className={`text-[11px] font-black uppercase tracking-tight ${form.watch("opmcIds").includes(opmc.id) ? 'text-white' : 'text-slate-800'}`}>{opmc.name}</p>
                                                <p className={`text-[9px] font-bold ${form.watch("opmcIds").includes(opmc.id) ? 'text-blue-100' : 'text-slate-400'}`}>{opmc.rtom}</p>
                                            </div>
                                            {form.watch("opmcIds").includes(opmc.id) && <Check className="w-4 h-4 text-white" />}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </form>
                    </Form>
                </div>

                <DialogFooter className="px-10 py-8 bg-slate-50 border-t flex justify-between items-center">
                    <Button variant="ghost" onClick={() => onOpenChange(false)} className="font-bold text-slate-400 uppercase tracking-widest text-[10px]">Abandon Threat</Button>
                    <Button form="store-form" type="submit" disabled={isSubmitting} className="h-14 px-12 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-black text-xs uppercase tracking-widest shadow-2xl shadow-slate-200 transition-all hover:-translate-y-1">
                        {isSubmitting ? "Transmitting..." : "Finalize Entity Entry"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

"use client";

import React, { useState, useMemo, useEffect } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Shield, User, ChevronLeft, ChevronRight } from "lucide-react";
import { ROLE_CATEGORIES } from '../constants/roles';

// Zod Schema (Same as before)
const userSchema = z.object({
    username: z.string().min(3, "Username required"),
    email: z.string().email("Invalid email"),
    password: z.string().optional(),
    name: z.string().min(2, "Name required"),
    role: z.string(),
    employeeId: z.string().optional(),
    opmcIds: z.array(z.string()),
    supervisorId: z.string().optional(),
    assignedStoreId: z.string().optional(),
});

export type UserFormValues = z.infer<typeof userSchema>;

interface UserProp {
    id?: string;
    name?: string | null;
    username?: string;
    role: string;
    accessibleOpmcs?: { id: string }[];
}

interface OpmcProp {
    id: string;
    name: string;
    rtom?: string;
    storeId?: string | null;
}

interface StoreProp {
    id: string;
    name: string;
}

interface UserFormDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSubmit: (values: UserFormValues) => void;
    initialData?: UserFormValues & { id?: string };
    isSubmitting: boolean;
    users: UserProp[];
    opmcs: OpmcProp[];
    stores: StoreProp[];
}

export function UserFormDialog({
    open,
    onOpenChange,
    onSubmit,
    initialData,
    isSubmitting,
    users,
    opmcs,
    stores
}: UserFormDialogProps) {
    const [step, setStep] = useState(1);
    const [selectedSection, setSelectedSection] = useState<string | null>(null);

    const form = useForm<UserFormValues>({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        resolver: zodResolver(userSchema) as any,
        defaultValues: initialData || {
            username: '', email: '', password: '', name: '', role: '', employeeId: '', opmcIds: [], supervisorId: '', assignedStoreId: 'none'
        }
    });

    const watchedOpmcIds = useWatch({ control: form.control, name: 'opmcIds' });
    const watchedRole = useWatch({ control: form.control, name: 'role' });

    // Sync form and section when dialog opens/closes
    useEffect(() => {
        if (!open) return;
        if (initialData) {
            form.reset(initialData);
            const section = Object.entries(ROLE_CATEGORIES).find(([, roles]) => roles.includes(initialData.role))?.[0] || null;
            setTimeout(() => setSelectedSection(section), 0);
        } else {
            form.reset({
                username: '', email: '', password: '', name: '', role: '', employeeId: '', opmcIds: [], supervisorId: '', assignedStoreId: 'none'
            });
            setTimeout(() => { setSelectedSection(null); setStep(1); }, 0);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    // --- AUTO-SUPERVISOR LOGIC ---
    useEffect(() => {
        const role = watchedRole;
        const opmcIds = watchedOpmcIds || [];

        if (!role || role === '') return;

        let autoSupervisorId = '';

        if (role === 'OSP_MANAGER') {
            autoSupervisorId = users.find(u => u.role === 'ADMIN' || u.role === 'SUPER_ADMIN')?.id || '';
        }
        else if (['AREA_MANAGER', 'STORES_MANAGER', 'FINANCE_MANAGER', 'INVOICE_MANAGER', 'SA_MANAGER', 'OFFICE_ADMIN', 'PROCUREMENT_OFFICER'].includes(role)) {
            autoSupervisorId = users.find(u => u.role === 'OSP_MANAGER')?.id || '';
        }
        else if (role === 'STORES_ASSISTANT') autoSupervisorId = users.find(u => u.role === 'STORES_MANAGER')?.id || '';
        else if (role === 'FINANCE_ASSISTANT') autoSupervisorId = users.find(u => u.role === 'FINANCE_MANAGER')?.id || '';
        else if (role === 'INVOICE_ASSISTANT') autoSupervisorId = users.find(u => u.role === 'INVOICE_MANAGER')?.id || '';
        else if (role === 'SA_ASSISTANT') autoSupervisorId = users.find(u => u.role === 'SA_MANAGER')?.id || '';
        else if (role === 'OFFICE_ADMIN_ASSISTANT' || role === 'SITE_OFFICE_STAFF') {
            autoSupervisorId = users.find(u => u.role === 'OFFICE_ADMIN')?.id || '';
        }
        else if (['ENGINEER', 'ASSISTANT_ENGINEER', 'AREA_COORDINATOR', 'QC_OFFICER'].includes(role)) {
            const match = users.find(u =>
                u.role === 'AREA_MANAGER' &&
                u.accessibleOpmcs?.some((o: { id: string }) => opmcIds.includes(o.id))
            );
            autoSupervisorId = match?.id || users.find(u => u.role === 'OSP_MANAGER')?.id || '';
        }

        if (autoSupervisorId && autoSupervisorId !== form.getValues('supervisorId')) {
            form.setValue('supervisorId', autoSupervisorId);
        }
    }, [watchedRole, watchedOpmcIds, users, form]);

    // --- FILTERED SELECTIONS ---
    const potentialSupervisors = useMemo(() => {
        const selectedOpmcIds = watchedOpmcIds || [];
        if (selectedOpmcIds.length === 0) return users.filter(u => u.id !== initialData?.id);

        return users.filter(u => {
            if (u.id === initialData?.id) return false;
            const supervisorOpmcs = u.accessibleOpmcs?.map((o: { id: string }) => o.id) || [];
            return supervisorOpmcs.some((id: string) => selectedOpmcIds.includes(id)) || u.role === 'SUPER_ADMIN' || u.role === 'ADMIN';
        });
    }, [users, initialData, watchedOpmcIds]);

    const filteredStores = useMemo(() => {
        const selectedOpmcIds = watchedOpmcIds || [];
        if (selectedOpmcIds.length === 0) return stores;

        const linkedStoreIds = opmcs
            .filter((o) => selectedOpmcIds.includes(o.id) && o.storeId)
            .map((o) => o.storeId as string);

        if (linkedStoreIds.length === 0) return stores;
        return stores.filter(s => linkedStoreIds.includes(s.id));
    }, [stores, opmcs, watchedOpmcIds]);

    const handleNext = async () => {
        let fields: (keyof UserFormValues)[] = [];
        if (step === 1) fields = ['name', 'username', 'email', 'employeeId'];
        if (step === 2) fields = ['role', 'opmcIds'];

        const isValid = await form.trigger(fields);
        if (isValid) setStep(step + 1);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-xl p-0 overflow-hidden border-none shadow-2xl">
                <div className="bg-slate-900 p-6 text-white relative">
                    <div className="absolute top-0 right-0 p-4 opacity-10">
                        <User className="w-32 h-32" />
                    </div>
                    <DialogHeader>
                        <DialogTitle className="text-xl font-bold">{initialData?.id ? 'Edit User Details' : 'Add New User'}</DialogTitle>
                        <DialogDescription className="text-slate-400 text-xs">
                            Step {step} of 3: {step === 1 ? 'Personal Details' : step === 2 ? 'Account Role' : 'Assignments'}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="flex gap-2 mt-6">
                        {[1, 2, 3].map(s => (
                            <div key={s} className={`h-1.5 flex-1 rounded-full transition-all duration-500 ${s <= step ? 'bg-blue-500' : 'bg-slate-800'}`} />
                        ))}
                    </div>
                </div>

                <div className="p-8 bg-white">
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">

                            {step === 1 && (
                                <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                                    <FormField control={form.control} name="name" render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-[11px] font-bold uppercase text-slate-500">Full Name</FormLabel>
                                            <FormControl><Input placeholder="Prasad Kumara" className="h-10 text-sm" {...field} /></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )} />

                                    <div className="grid grid-cols-2 gap-4">
                                        <FormField control={form.control} name="username" render={({ field }) => (
                                            <FormItem>
                                                <FormLabel className="text-[11px] font-bold uppercase text-slate-500">Username</FormLabel>
                                                <FormControl><Input placeholder="prasad_k" className="h-10 text-sm" {...field} /></FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )} />
                                        <FormField control={form.control} name="employeeId" render={({ field }) => (
                                            <FormItem>
                                                <FormLabel className="text-[11px] font-bold uppercase text-slate-500">Employee ID (Staff ID)</FormLabel>
                                                <FormControl><Input placeholder="e.g. 12345" className="h-10 text-sm" {...field} /></FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )} />
                                    </div>

                                    <FormField control={form.control} name="email" render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-[11px] font-bold uppercase text-slate-500">Email Address</FormLabel>
                                            <FormControl><Input type="email" placeholder="e.g. name@slt.lk" className="h-10 text-sm" {...field} /></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )} />

                                    <FormField control={form.control} name="password" render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-[11px] font-bold uppercase text-slate-500">Password {initialData?.id && '(Leave blank to keep current)'}</FormLabel>
                                            <FormControl><Input type="password" placeholder="••••••••" className="h-10 text-sm" {...field} /></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )} />
                                </div>
                            )}

                            {step === 2 && (
                                <div className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-300">
                                    <div className="space-y-2">
                                        <FormLabel className="text-[11px] font-bold uppercase text-slate-500">Department</FormLabel>
                                        <Select onValueChange={(val) => {
                                            setSelectedSection(val);
                                            form.setValue('role', ''); 
                                        }} value={selectedSection || ''}>
                                            <FormControl>
                                                <SelectTrigger className="h-10 text-sm">
                                                    <SelectValue placeholder="Select Department..." />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                {Object.keys(ROLE_CATEGORIES).map(cat => (
                                                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <FormField control={form.control} name="role" render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-[11px] font-bold uppercase text-slate-500">System Role</FormLabel>
                                            <Select onValueChange={field.onChange} value={field.value} disabled={!selectedSection}>
                                                <FormControl>
                                                    <SelectTrigger className="h-10 text-sm">
                                                        <SelectValue placeholder={selectedSection ? "Choose Role..." : "Select Department First"} />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    {selectedSection && ROLE_CATEGORIES[selectedSection as keyof typeof ROLE_CATEGORIES].map(r => (
                                                        <SelectItem key={r} value={r}>{r.replace(/_/g, ' ')}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            <FormMessage />
                                        </FormItem>
                                    )} />

                                    <FormField control={form.control} name="opmcIds" render={({ field }) => (
                                        <FormItem>
                                            <div className="flex justify-between items-center mb-1">
                                                <FormLabel className="text-[11px] font-bold uppercase text-slate-500">Assigned Regions (RTOM)</FormLabel>
                                                <Button type="button" variant="link" className="h-auto p-0 text-[10px]" onClick={() => {
                                                    if (field.value.length === opmcs.length) field.onChange([]);
                                                    else field.onChange(opmcs.map(o => o.id));
                                                }}>
                                                    {field.value.length === opmcs.length ? 'Clear All' : 'Select All'}
                                                </Button>
                                            </div>
                                            <ScrollArea className="h-[180px] border border-slate-100 rounded-xl p-3 bg-slate-50">
                                                <div className="grid grid-cols-2 gap-2 text-[11px]">
                                                    {opmcs.map((opmc) => (
                                                        <div key={opmc.id} className="flex items-center space-x-2 py-1">
                                                            <Checkbox
                                                                id={`opmc-${opmc.id}`}
                                                                checked={field.value.includes(opmc.id)}
                                                                onCheckedChange={(checked) => {
                                                                    return checked
                                                                        ? field.onChange([...field.value, opmc.id])
                                                                        : field.onChange(field.value.filter((val) => val !== opmc.id))
                                                                }}
                                                            />
                                                            <label htmlFor={`opmc-${opmc.id}`} className="cursor-pointer truncate">
                                                                {opmc.rtom} - {opmc.name}
                                                            </label>
                                                        </div>
                                                    ))}
                                                </div>
                                            </ScrollArea>
                                            <FormMessage />
                                        </FormItem>
                                    )} />
                                </div>
                            )}

                            {step === 3 && (
                                <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                                    <FormField control={form.control} name="supervisorId" render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-[11px] font-bold uppercase text-slate-500">Direct Supervisor</FormLabel>
                                            <Select onValueChange={field.onChange} value={field.value || 'none'}>
                                                <FormControl>
                                                    <SelectTrigger className="h-10 text-sm">
                                                        <SelectValue placeholder="Select Supervisor..." />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    <SelectItem value="none">No Supervisor (Independent)</SelectItem>
                                                    {potentialSupervisors.filter(u => !!u.id).map(u => (
                                                        <SelectItem key={u.id} value={u.id ?? ''}>
                                                            {u.name || u.username} ({u.role.replace(/_/g, ' ')})
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            <p className="text-[10px] text-slate-400 mt-1 italic">Filtered based on RTOM access selected in Step 2.</p>
                                            <FormMessage />
                                        </FormItem>
                                    )} />

                                    <FormField control={form.control} name="assignedStoreId" render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-[11px] font-bold uppercase text-slate-500">Primary Store</FormLabel>
                                            <Select onValueChange={field.onChange} value={field.value || 'none'}>
                                                <FormControl>
                                                    <SelectTrigger className="h-10 text-sm">
                                                        <SelectValue placeholder="Select Base Store..." />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    <SelectItem value="none">General Access (No Base Store)</SelectItem>
                                                    {filteredStores.map(store => (
                                                        <SelectItem key={store.id} value={store.id}>{store.name}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            <FormMessage />
                                        </FormItem>
                                    )} />

                                    <div className="p-4 bg-amber-50 rounded-xl border border-amber-100 flex gap-3">
                                        <Shield className="w-5 h-5 text-amber-500 shrink-0" />
                                        <div className="text-[10px] text-amber-800 leading-relaxed">
                                            <strong>Final Check:</strong> By saving this user, you grant them access to the selected RTOMs and Store. Ensure the roles are correctly assigned to prevent unauthorized data access.
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div className="pt-6 flex justify-between gap-3 border-t">
                                <div className="flex gap-2">
                                    {step > 1 && (
                                        <Button type="button" variant="outline" onClick={() => setStep(step - 1)}>
                                            <ChevronLeft className="w-4 h-4 mr-1" /> Back
                                        </Button>
                                    )}
                                    <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} className="text-slate-400">Cancel</Button>
                                </div>

                                {step < 3 ? (
                                    <Button type="button" onClick={handleNext} className="bg-blue-600 px-10 shadow-lg shadow-blue-100">
                                        Continue <ChevronRight className="w-4 h-4 ml-1" />
                                    </Button>
                                ) : (
                                    <Button type="submit" disabled={isSubmitting} className="bg-green-600 px-10 shadow-lg shadow-green-100">
                                        {isSubmitting ? 'Saving...' : initialData?.id ? 'Save Details' : 'Create User'}
                                    </Button>
                                )}
                            </div>
                        </form>
                    </Form>
                </div>
            </DialogContent>
        </Dialog>
    );
}

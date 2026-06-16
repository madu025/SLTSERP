"use client";

import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Search, Plus, Trash, Pencil, Building2, Warehouse } from "lucide-react";
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { toast } from 'sonner';
import { createOPMC, updateOPMC, deleteOPMC } from '@/actions/opmc-actions';
import { Badge } from '@/components/ui/badge';

// Types
interface OPMC {
    id: string;
    name: string;
    rtom: string;
    region: string;
    province: string;
    storeId?: string;
    store?: { id: string, name: string };
    createdAt: string;
    _count?: { staff: number; projects: number };
}

interface Store { id: string; name: string; type: string; }

// Zod Schema
const opmcSchema = z.object({
    name: z.string().optional(),
    rtom: z.string().min(2, "RTOM is required"),
    region: z.string().min(1, "Region required"),
    province: z.string().min(1, "Province required"),
    storeId: z.string().optional(),
});
type OPMCFormValues = z.infer<typeof opmcSchema>

const REGIONS = ['ALL', 'METRO', 'REGION 01', 'REGION 02', 'REGION 03'];

export default function RTOMRegistrationPage() {
    const queryClient = useQueryClient();
    const [searchTerm, setSearchTerm] = useState("");
    const [regionFilter, setRegionFilter] = useState("ALL");
    const [showModal, setShowModal] = useState(false);
    const [selectedOPMC, setSelectedOPMC] = useState<OPMC | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<OPMC | null>(null);

    const form = useForm<OPMCFormValues>({
        resolver: zodResolver(opmcSchema),
        defaultValues: { name: '', rtom: '', region: 'METRO', province: 'METRO 01', storeId: '' }
    });

    // --- QUERIES ---
    const { data: opmcs = [], isLoading } = useQuery<OPMC[]>({
        queryKey: ["opmcs"],
        queryFn: async () => (await fetch("/api/opmcs")).json()
    });

    const { data: stores = [] } = useQuery<Store[]>({
        queryKey: ['stores'],
        queryFn: async () => (await fetch('/api/inventory/stores')).json()
    });

    // --- MUTATIONS ---
    const mutation = useMutation({
        mutationFn: async (values: OPMCFormValues & { id?: string }) => {
            const data = { name: values.name || '', rtom: values.rtom, region: values.region, province: values.province, storeId: values.storeId };
            if (values.id) return await updateOPMC({ ...data, id: values.id });
            return await createOPMC(data);
        },
        onSuccess: (result) => {
            if (result.success) {
                queryClient.invalidateQueries({ queryKey: ["opmcs"] });
                handleCloseModal();
                toast.success("RTOM saved successfully");
            } else {
                toast.error(result.error || "Error saving RTOM");
            }
        },
        onError: () => toast.error("Error saving RTOM")
    });

    const deleteMutation = useMutation({
        mutationFn: async (id: string) => await deleteOPMC(id),
        onSuccess: (result) => {
            if (result.success) {
                queryClient.invalidateQueries({ queryKey: ["opmcs"] });
                toast.success("RTOM deleted");
                setDeleteTarget(null);
            } else {
                toast.error(result.error || "Error deleting RTOM");
            }
        },
        onError: () => toast.error("Error deleting RTOM")
    });

    // --- HANDLERS ---
    const handleOpenModal = (opmc?: OPMC) => {
        if (opmc) {
            setSelectedOPMC(opmc);
            form.reset({ name: opmc.name || '', rtom: opmc.rtom, region: opmc.region, province: opmc.province, storeId: opmc.storeId || '' });
        } else {
            setSelectedOPMC(null);
            form.reset({ name: '', rtom: '', region: 'METRO', province: 'METRO 01', storeId: '' });
        }
        setShowModal(true);
    };

    const handleCloseModal = () => { setShowModal(false); setSelectedOPMC(null); };
    const onSubmit = (values: OPMCFormValues) => mutation.mutate({ ...values, id: selectedOPMC?.id });

    const filteredOPMCs = useMemo(() => opmcs.filter(o => {
        const matchSearch = (o.name || '').toLowerCase().includes(searchTerm.toLowerCase()) || o.rtom.toLowerCase().includes(searchTerm.toLowerCase());
        const matchRegion = regionFilter === 'ALL' || o.region === regionFilter;
        return matchSearch && matchRegion;
    }), [opmcs, searchTerm, regionFilter]);

    const regionBadgeColor = (region: string) => {
        if (region === 'METRO') return 'bg-blue-50 text-blue-700 border-blue-200';
        if (region === 'REGION 01') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
        if (region === 'REGION 02') return 'bg-amber-50 text-amber-700 border-amber-200';
        return 'bg-purple-50 text-purple-700 border-purple-200';
    };

    return (
        <div className="h-screen flex bg-slate-50 overflow-hidden">
            <Sidebar />
            <main className="flex-1 flex flex-col min-w-0 h-full">
                <Header />
                <div className="flex-1 flex flex-col min-h-0 overflow-hidden">

                    {/* Header Controls */}
                    <div className="flex-none p-4 space-y-3">
                        <div className="flex justify-between items-center">
                            <div>
                                <h1 className="text-xl font-black text-slate-900 flex items-center gap-2">
                                    <Building2 className="w-5 h-5 text-slate-500" />
                                    RTOM Management
                                </h1>
                                <p className="text-xs text-slate-500 mt-0.5">
                                    Manage Regional Telecom Offices and store assignments
                                    {!isLoading && <span className="ml-1 font-bold text-slate-700">({opmcs.length} total)</span>}
                                </p>
                            </div>
                            <Button onClick={() => handleOpenModal()} className="h-8 text-xs bg-blue-600 hover:bg-blue-700">
                                <Plus className="w-4 h-4 mr-2" /> Add RTOM
                            </Button>
                        </div>

                        {/* Filters Toolbar */}
                        <div className="flex flex-col md:flex-row gap-2 items-start md:items-center">
                            {/* Region Filter Pills */}
                            <div className="flex gap-1 flex-wrap">
                                {REGIONS.map(r => (
                                    <button
                                        key={r}
                                        onClick={() => setRegionFilter(r)}
                                        className={`px-3 py-1 text-[10px] font-black uppercase tracking-wider rounded-full border transition-all ${regionFilter === r ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-500 border-slate-200 hover:border-blue-300'}`}
                                    >
                                        {r}
                                    </button>
                                ))}
                            </div>
                            {/* Search */}
                            <div className="relative ml-auto w-full md:w-72">
                                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                                <Input
                                    placeholder="Search RTOM code or name..."
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                    className="h-8 pl-9 text-xs bg-white border-slate-200"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Table */}
                    <div className="flex-1 mx-4 mb-4 bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col min-h-0">
                        <div className="flex-1 overflow-auto">
                            {isLoading ? (
                                <div className="p-10 text-center text-slate-500 text-sm">Loading RTOMs...</div>
                            ) : filteredOPMCs.length === 0 ? (
                                <div className="p-10 text-center text-slate-400 text-sm">No RTOMs found.</div>
                            ) : (
                                <table className="w-full text-xs text-left">
                                    <thead className="bg-slate-50 text-slate-500 font-black uppercase tracking-wider text-[10px] border-b border-slate-200 sticky top-0 z-10">
                                        <tr>
                                            <th className="px-4 py-3 w-12 text-center">#</th>
                                            <th className="px-4 py-3">RTOM</th>
                                            <th className="px-4 py-3">Name</th>
                                            <th className="px-4 py-3">Region</th>
                                            <th className="px-4 py-3">Province</th>
                                            <th className="px-4 py-3">Assigned Store</th>
                                            <th className="px-4 py-3 text-right pr-6">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {filteredOPMCs.map((opmc, idx) => (
                                            <tr key={opmc.id} className="hover:bg-slate-50/70 transition-colors group">
                                                <td className="px-4 py-2.5 text-center font-mono text-slate-400">{idx + 1}</td>
                                                <td className="px-4 py-2.5">
                                                    <span className="font-black text-slate-900 text-[11px] uppercase">{opmc.rtom}</span>
                                                </td>
                                                <td className="px-4 py-2.5 text-slate-600">{opmc.name || <span className="text-slate-300 italic">—</span>}</td>
                                                <td className="px-4 py-2.5">
                                                    <Badge className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${regionBadgeColor(opmc.region)}`}>
                                                        {opmc.region}
                                                    </Badge>
                                                </td>
                                                <td className="px-4 py-2.5 text-slate-500">{opmc.province}</td>
                                                <td className="px-4 py-2.5">
                                                    {opmc.store ? (
                                                        <div className="flex items-center gap-1.5">
                                                            <Warehouse className="w-3 h-3 text-blue-500" />
                                                            <span className="font-semibold text-blue-700 text-[11px]">{opmc.store.name}</span>
                                                        </div>
                                                    ) : (
                                                        <span className="text-slate-400 italic text-[10px]">Not assigned</span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-2.5 text-right pr-4">
                                                    <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <Button variant="ghost" size="icon" onClick={() => handleOpenModal(opmc)} className="h-7 w-7 hover:bg-blue-50 hover:text-blue-600">
                                                            <Pencil className="w-3.5 h-3.5" />
                                                        </Button>
                                                        <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(opmc)} className="h-7 w-7 hover:bg-red-50 hover:text-red-600">
                                                            <Trash className="w-3.5 h-3.5" />
                                                        </Button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                        {/* Footer count */}
                        {!isLoading && (
                            <div className="px-4 py-2 border-t border-slate-100 bg-slate-50/50 text-[10px] text-slate-400 font-semibold">
                                Showing {filteredOPMCs.length} of {opmcs.length} RTOMs
                            </div>
                        )}
                    </div>
                </div>

                {/* Add/Edit Modal */}
                <Dialog open={showModal} onOpenChange={setShowModal}>
                    <DialogContent className="max-w-md">
                        <DialogHeader>
                            <DialogTitle>{selectedOPMC ? 'Edit RTOM' : 'Register RTOM'}</DialogTitle>
                            <DialogDescription>Enter RTOM details and assign a store.</DialogDescription>
                        </DialogHeader>

                        <Form {...form}>
                            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                                <FormField control={form.control} name="rtom" render={({ field }) => (
                                    <FormItem><FormLabel>RTOM Code *</FormLabel><FormControl><Input {...field} placeholder="e.g. KAD" className="uppercase h-8 text-xs" /></FormControl><FormMessage /></FormItem>
                                )} />
                                <FormField control={form.control} name="name" render={({ field }) => (
                                    <FormItem><FormLabel>RTOM Name</FormLabel><FormControl><Input {...field} placeholder="e.g. Kaduwela" className="h-8 text-xs" /></FormControl><FormMessage /></FormItem>
                                )} />
                                <div className="grid grid-cols-2 gap-4">
                                    <FormField control={form.control} name="region" render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Region</FormLabel>
                                            <Select onValueChange={field.onChange} value={field.value}>
                                                <FormControl><SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select Region" /></SelectTrigger></FormControl>
                                                <SelectContent>
                                                    <SelectItem value="METRO">METRO</SelectItem>
                                                    <SelectItem value="REGION 01">REGION 01</SelectItem>
                                                    <SelectItem value="REGION 02">REGION 02</SelectItem>
                                                    <SelectItem value="REGION 03">REGION 03</SelectItem>
                                                </SelectContent>
                                            </Select>
                                            <FormMessage />
                                        </FormItem>
                                    )} />
                                    <FormField control={form.control} name="province" render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Province</FormLabel>
                                            <Select onValueChange={field.onChange} value={field.value}>
                                                <FormControl><SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select Province" /></SelectTrigger></FormControl>
                                                <SelectContent>
                                                    <SelectItem value="METRO 01">METRO 01</SelectItem>
                                                    <SelectItem value="METRO 02">METRO 02</SelectItem>
                                                    <SelectItem value="CP">CP</SelectItem>
                                                    <SelectItem value="EP">EP</SelectItem>
                                                    <SelectItem value="NP">NP</SelectItem>
                                                    <SelectItem value="NWP">NWP</SelectItem>
                                                    <SelectItem value="SAB">SAB</SelectItem>
                                                    <SelectItem value="SP">SP</SelectItem>
                                                    <SelectItem value="UVA">UVA</SelectItem>
                                                    <SelectItem value="WPN">WPN</SelectItem>
                                                    <SelectItem value="WPS">WPS</SelectItem>
                                                </SelectContent>
                                            </Select>
                                            <FormMessage />
                                        </FormItem>
                                    )} />
                                </div>
                                <FormField control={form.control} name="storeId" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Assigned Store</FormLabel>
                                        <Select onValueChange={field.onChange} value={field.value}>
                                            <FormControl><SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select Store (Optional)" /></SelectTrigger></FormControl>
                                            <SelectContent>
                                                {stores.map((s: Store) => <SelectItem key={s.id} value={s.id} className="text-xs">{s.name} ({s.type})</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )} />

                                <DialogFooter>
                                    <Button type="button" variant="outline" size="sm" onClick={handleCloseModal}>Cancel</Button>
                                    <Button type="submit" size="sm" disabled={mutation.isPending}>
                                        {mutation.isPending ? 'Saving...' : (selectedOPMC ? 'Update' : 'Register')}
                                    </Button>
                                </DialogFooter>
                            </form>
                        </Form>
                    </DialogContent>
                </Dialog>

                {/* Delete Confirmation */}
                <AlertDialog open={!!deleteTarget} onOpenChange={(open: boolean) => !open && setDeleteTarget(null)}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Delete RTOM &quot;{deleteTarget?.rtom}&quot;?</AlertDialogTitle>
                            <AlertDialogDescription>
                                This will permanently delete this RTOM and remove all associated assignments. This action cannot be undone.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                                onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
                                className="bg-red-600 hover:bg-red-700"
                            >
                                {deleteMutation.isPending ? 'Deleting...' : 'Delete RTOM'}
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>

            </main>
        </div>
    );
}

"use client";

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Search, Plus, Trash, Pencil, Factory, Building2 } from "lucide-react";
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";
import { toast } from 'sonner';
import { createOPMC, updateOPMC, deleteOPMC } from '@/actions/opmc-actions';

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
    _count?: {
        staff: number;
        projects: number;
    };
}

// Zod Schema
const opmcSchema = z.object({
    name: z.string().optional(),
    rtom: z.string().min(2, "RTOM is required"),
    region: z.string().min(1, "Region required"),
    province: z.string().min(1, "Province required"),
    storeId: z.string().optional(),
});

type OPMCFormValues = z.infer<typeof opmcSchema>

export default function RTOMRegistrationPage() {
    const queryClient = useQueryClient();
    const [searchTerm, setSearchTerm] = useState("");

    // Modal State
    const [showModal, setShowModal] = useState(false);
    const [selectedOPMC, setSelectedOPMC] = useState<OPMC | null>(null);

    const form = useForm<OPMCFormValues>({
        resolver: zodResolver(opmcSchema),
        defaultValues: {
            name: '', rtom: '', region: 'METRO', province: 'METRO 01', storeId: ''
        }
    });

    // --- QUERIES ---
    const { data: opmcs = [], isLoading } = useQuery<OPMC[]>({
        queryKey: ["opmcs"],
        queryFn: async () => (await fetch("/api/opmcs")).json()
    });

    const { data: stores = [] } = useQuery({
        queryKey: ['stores'],
        queryFn: async () => (await fetch('/api/inventory/stores')).json()
    });

    // --- MUTATIONS ---
    const mutation = useMutation({
        mutationFn: async (values: OPMCFormValues & { id?: string }) => {
            const data = {
                name: values.name || '',
                rtom: values.rtom,
                region: values.region,
                province: values.province,
                storeId: values.storeId
            };

            if (values.id) {
                return await updateOPMC({ ...data, id: values.id });
            } else {
                return await createOPMC(data);
            }
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
        mutationFn: async (id: string) => {
            return await deleteOPMC(id);
        },
        onSuccess: (result) => {
            if (result.success) {
                queryClient.invalidateQueries({ queryKey: ["opmcs"] });
                toast.success("RTOM deleted");
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
            form.reset({
                name: opmc.name || '',
                rtom: opmc.rtom,
                region: opmc.region,
                province: opmc.province,
                storeId: opmc.storeId || ''
            });
        } else {
            setSelectedOPMC(null);
            form.reset({
                name: '', rtom: '', region: 'METRO', province: 'METRO 01', storeId: ''
            });
        }
        setShowModal(true);
    };

    const handleCloseModal = () => {
        setShowModal(false);
        setSelectedOPMC(null);
    };

    const onSubmit = (values: OPMCFormValues) => {
        mutation.mutate({ ...values, id: selectedOPMC?.id });
    };

    const filteredOPMCs = opmcs.filter(o =>
        (o.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        o.rtom.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="h-screen flex bg-slate-50 overflow-hidden">
            <Sidebar />
            <main className="flex-1 flex flex-col min-w-0 h-full">
                <Header />
                <div className="flex-1 overflow-y-auto p-4 md:p-8">
                    <div className="max-w-6xl mx-auto space-y-6">

                        <div className="flex justify-between items-center">
                            <div>
                                <h1 className="text-2xl font-bold text-slate-900">RTOM Management</h1>
                                <p className="text-slate-500">Manage Regional Telecom Offices and Store Assignments.</p>
                            </div>
                            <Button onClick={() => handleOpenModal()} className="bg-blue-600 hover:bg-blue-700">
                                <Plus className="w-4 h-4 mr-2" /> Add RTOM
                            </Button>
                        </div>

                        <div className="flex items-center space-x-2 bg-white p-2 rounded-lg border w-full md:w-1/3">
                            <Search className="w-4 h-4 text-slate-400" />
                            <Input
                                placeholder="Search RTOM..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className="border-none focus-visible:ring-0 shadow-none h-8"
                            />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {filteredOPMCs.map(opmc => (
                                <Card key={opmc.id} className="hover:shadow-md transition-shadow">
                                    <CardContent className="p-6">
                                        <div className="flex justify-between items-start">
                                            <div className="space-y-1">
                                                <div className="flex items-center gap-2">
                                                    <h3 className="text-lg font-bold text-slate-800">{opmc.rtom}</h3>
                                                    {opmc.name && <span className="text-sm text-slate-500">({opmc.name})</span>}
                                                </div>
                                                <div className="text-xs text-slate-500 uppercase font-semibold">{opmc.region} • {opmc.province}</div>

                                                <div className="pt-2 flex items-center gap-2 text-xs text-slate-600">
                                                    <Building2 className="w-3 h-3 text-blue-500" />
                                                    {opmc.store ? (
                                                        <span className="font-semibold text-blue-700">{opmc.store.name}</span>
                                                    ) : (
                                                        <span className="text-slate-400 italic">No Assigned Store</span>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="flex gap-2">
                                                <Button variant="ghost" size="sm" onClick={() => handleOpenModal(opmc)} className="h-8 w-8 p-0"><Pencil className="w-4 h-4 text-slate-500" /></Button>
                                                <Button variant="ghost" size="sm" onClick={() => deleteMutation.mutate(opmc.id)} className="h-8 w-8 p-0"><Trash className="w-4 h-4 text-slate-500 hover:text-red-500" /></Button>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>

                    </div>
                </div>

                {/* Modal */}
                <Dialog open={showModal} onOpenChange={setShowModal}>
                    <DialogContent className="max-w-md">
                        <DialogHeader>
                            <DialogTitle>{selectedOPMC ? 'Edit RTOM' : 'Register RTOM'}</DialogTitle>
                            <DialogDescription>Enter RTOM details and assign a store.</DialogDescription>
                        </DialogHeader>

                        <Form {...form}>
                            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
                                <FormField control={form.control} name="rtom" render={({ field }) => (
                                    <FormItem><FormLabel>RTOM Code *</FormLabel><FormControl><Input {...field} placeholder="e.g. KAD" className="uppercase" /></FormControl><FormMessage /></FormItem>
                                )} />
                                <FormField control={form.control} name="name" render={({ field }) => (
                                    <FormItem><FormLabel>RTOM Name</FormLabel><FormControl><Input {...field} placeholder="e.g. Kaduwela" /></FormControl><FormMessage /></FormItem>
                                )} />
                                <div className="grid grid-cols-2 gap-4">
                                    <FormField control={form.control} name="region" render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Region</FormLabel>
                                            <Select onValueChange={field.onChange} value={field.value}>
                                                <FormControl><SelectTrigger><SelectValue placeholder="Select Region" /></SelectTrigger></FormControl>
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
                                                <FormControl><SelectTrigger><SelectValue placeholder="Select Province" /></SelectTrigger></FormControl>
                                                <SelectContent>
                                                    <SelectItem value="METRO 01">METRO 01</SelectItem>
                                                    <SelectItem value="METRO 02">METRO 02</SelectItem>
                                                    <SelectItem value="CP">CP</SelectItem>
                                                    <SelectItem value="NWP">NWP</SelectItem>
                                                    <SelectItem value="WPN">WPN</SelectItem>
                                                    <SelectItem value="UVA">UVA</SelectItem>
                                                    <SelectItem value="SAB">SAB</SelectItem>
                                                    <SelectItem value="SP">SP</SelectItem>
                                                    <SelectItem value="WPS">WPS</SelectItem>
                                                    <SelectItem value="EP">EP</SelectItem>
                                                    <SelectItem value="NP">NP</SelectItem>
                                                </SelectContent>
                                            </Select>
                                            <FormMessage />
                                        </FormItem>
                                    )} />
                                </div>
                                <FormField control={form.control} name="storeId" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Assigned Store / Branch</FormLabel>
                                        <Select onValueChange={field.onChange} value={field.value}>
                                            <FormControl><SelectTrigger><SelectValue placeholder="Select Store (Optional)" /></SelectTrigger></FormControl>
                                            <SelectContent>
                                                {stores.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name} ({s.type})</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )} />

                                <DialogFooter>
                                    <Button type="button" variant="outline" onClick={handleCloseModal}>Cancel</Button>
                                    <Button type="submit" disabled={mutation.isPending}>{selectedOPMC ? 'Update' : 'Register'}</Button>
                                </DialogFooter>
                            </form>
                        </Form>
                    </DialogContent>
                </Dialog>
            </main>
        </div>
    );
}

"use client";

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Trash, Plus, Pencil, Search, Users, ShieldAlert, Building2 } from "lucide-react";
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { toast } from 'sonner';

// Types
interface TeamMember {
    id?: string;
    name: string;
    idCopyNumber: string;
    contractorIdCopyNumber: string;
}

interface ContractorTeam {
    id?: string;
    name: string;
    opmcId?: string | null;
    storeIds?: string[];
    primaryStoreId?: string | null;
    members: TeamMember[];
}

interface Contractor {
    id: string;
    name: string;
    address: string;
    registrationNumber: string;
    brNumber?: string | null;
    status: 'ACTIVE' | 'INACTIVE' | 'PENDING';
    registrationFeePaid: boolean;
    agreementSigned: boolean;
    agreementDate?: string | null;
    bankAccountNumber?: string | null;
    bankBranch?: string | null;
    storeId?: string | null;
    store?: { name: string };
    teams: ContractorTeam[];
    createdAt: string;
}

// Zod Schema
const contractorSchema = z.object({
    name: z.string().min(2, "Name is required"),
    address: z.string().min(5, "Address is required"),
    registrationNumber: z.string().min(2, "Reg Num is required"),
    brNumber: z.string().optional(),
    status: z.enum(['ACTIVE', 'INACTIVE', 'PENDING']),
    registrationFeePaid: z.boolean(),
    agreementSigned: z.boolean(),
    agreementDate: z.string().optional(),
    bankAccountNumber: z.string().optional(),
    bankBranch: z.string().optional(),
    storeId: z.string().optional(),
});

type ContractorFormValues = z.infer<typeof contractorSchema>

export default function ContractorsPage() {
    const queryClient = useQueryClient();
    const [searchTerm, setSearchTerm] = useState("");

    // Modal State
    const [showModal, setShowModal] = useState(false);
    const [selectedContractor, setSelectedContractor] = useState<Contractor | null>(null);

    // Dynamic Team Management State
    const [teams, setTeams] = useState<ContractorTeam[]>([]);

    const form = useForm<ContractorFormValues>({
        resolver: zodResolver(contractorSchema),
        defaultValues: {
            name: '', address: '', registrationNumber: '', brNumber: '', status: 'PENDING',
            registrationFeePaid: false, agreementSigned: false, agreementDate: '',
            bankAccountNumber: '', bankBranch: '', storeId: ''
        }
    });

    // --- QUERIES ---
    const { data: contractors = [], isLoading } = useQuery<Contractor[]>({
        queryKey: ["contractors"],
        queryFn: async () => (await fetch("/api/contractors")).json()
    });

    const { data: stores = [] } = useQuery({
        queryKey: ['stores'],
        queryFn: async () => (await fetch('/api/stores')).json()
    });

    const { data: opmcs = [] } = useQuery({
        queryKey: ['opmcs'],
        queryFn: async () => (await fetch('/api/opmc')).json()
    });

    // --- MUTATIONS ---
    const mutation = useMutation({
        mutationFn: async (values: ContractorFormValues & { teams: ContractorTeam[], id?: string }) => {
            const method = values.id ? 'PUT' : 'POST';
            const res = await fetch('/api/contractors', {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(values)
            });
            if (!res.ok) throw new Error('Failed');
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["contractors"] });
            setShowModal(false);
            toast.success("Contractor saved successfully");
        },
        onError: () => toast.error("Failed to save contractor")
    });

    const deleteMutation = useMutation({
        mutationFn: async (id: string) => {
            await fetch(`/api/contractors?id=${id}`, { method: 'DELETE' });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["contractors"] });
            toast.success("Contractor deleted");
        }
    });

    // --- HANDLERS ---
    const handleAdd = () => {
        setSelectedContractor(null);
        setTeams([]);
        form.reset({
            name: '', address: '', registrationNumber: '', brNumber: '', status: 'PENDING',
            registrationFeePaid: false, agreementSigned: false, agreementDate: '', storeId: ''
        });
        setShowModal(true);
    };

    const handleEdit = (c: Contractor) => {
        setSelectedContractor(c);
        setTeams(c.teams.map((t: any) => ({
            id: t.id,
            name: t.name,
            opmcId: t.opmcId || undefined,
            // Map store assignments from backend
            storeIds: t.storeAssignments?.map((sa: any) => sa.storeId) || [],
            primaryStoreId: t.storeAssignments?.find((sa: any) => sa.isPrimary)?.storeId || null,
            members: t.members
        })));

        form.reset({
            name: c.name,
            address: c.address || '',
            registrationNumber: c.registrationNumber || '',
            brNumber: c.brNumber || '',
            status: c.status,
            registrationFeePaid: c.registrationFeePaid,
            agreementSigned: c.agreementSigned,
            agreementDate: c.agreementDate ? new Date(c.agreementDate).toISOString().split('T')[0] : '',
            bankAccountNumber: c.bankAccountNumber || '',
            bankBranch: c.bankBranch || '',
            storeId: c.storeId || ''
        });
        setShowModal(true);
    };

    const handleSubmit = (values: ContractorFormValues) => {
        mutation.mutate({ ...values, teams, id: selectedContractor?.id });
    };

    // Team Management Helpers
    const addTeam = () => {
        setTeams([...teams, { name: 'New Team', members: [] }]);
    };

    const updateTeam = (idx: number, field: keyof ContractorTeam, val: any) => {
        const newTeams = [...teams];
        (newTeams[idx] as any)[field] = val;
        setTeams(newTeams);
    };

    const toggleStore = (teamIdx: number, storeId: string) => {
        const currentStores = teams[teamIdx].storeIds || [];
        let newStores;
        if (currentStores.includes(storeId)) {
            newStores = currentStores.filter(id => id !== storeId);
            if (teams[teamIdx].primaryStoreId === storeId) {
                updateTeam(teamIdx, 'primaryStoreId', null);
            }
        } else {
            newStores = [...currentStores, storeId];
            if (newStores.length === 1) {
                updateTeam(teamIdx, 'primaryStoreId', storeId);
            }
        }
        updateTeam(teamIdx, 'storeIds', newStores);
    };

    const removeTeam = (idx: number) => {
        setTeams(teams.filter((_, i) => i !== idx));
    };

    const addMember = (teamIdx: number) => {
        const newTeams = [...teams];
        newTeams[teamIdx].members.push({ name: '', idCopyNumber: '', contractorIdCopyNumber: '' });
        setTeams(newTeams);
    };

    const updateMember = (teamIdx: number, memberIdx: number, field: keyof TeamMember, val: string) => {
        const newTeams = [...teams];
        (newTeams[teamIdx].members[memberIdx] as any)[field] = val;
        setTeams(newTeams);
    };

    const removeMember = (teamIdx: number, memberIdx: number) => {
        const newTeams = [...teams];
        newTeams[teamIdx].members = newTeams[teamIdx].members.filter((_, i) => i !== memberIdx);
        setTeams(newTeams);
    };

    const filteredContractors = contractors.filter(c =>
        c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.registrationNumber?.includes(searchTerm)
    );

    return (
        <div className="h-screen flex bg-slate-50 overflow-hidden">
            <Sidebar />
            <main className="flex-1 flex flex-col min-w-0 h-full">
                <Header />
                <div className="flex-1 overflow-y-auto p-4 md:p-8">
                    <div className="max-w-7xl mx-auto space-y-6">

                        <div className="flex justify-between items-center">
                            <div>
                                <h1 className="text-2xl font-bold text-slate-900">Contractor Management</h1>
                                <p className="text-slate-500">Register and manage contractors, teams, and assignments.</p>
                            </div>
                            <Button onClick={handleAdd} className="bg-blue-600 hover:bg-blue-700">
                                <Plus className="w-4 h-4 mr-2" /> Register Contractor
                            </Button>
                        </div>

                        <div className="flex items-center space-x-2 bg-white p-2 rounded-lg border">
                            <Search className="w-4 h-4 text-slate-400" />
                            <Input
                                placeholder="Search contractors..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className="border-none focus-visible:ring-0 shadow-none h-8"
                            />
                        </div>

                        <div className="grid grid-cols-1 gap-4">
                            {filteredContractors.map(contractor => (
                                <Card key={contractor.id} className="hover:shadow-md transition-shadow">
                                    <CardContent className="p-6">
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <h3 className="text-lg font-bold text-slate-800">{contractor.name}</h3>
                                                    <Badge variant="outline" className={contractor.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : ''}>
                                                        {contractor.status}
                                                    </Badge>
                                                </div>
                                                <p className="text-sm text-slate-500 mt-1">{contractor.registrationNumber} • {contractor.store?.name || 'No Store'}</p>
                                                <div className="flex gap-4 mt-2 text-xs text-slate-600">
                                                    <div className="flex items-center gap-1"><Users className="w-3 h-3" /> {contractor.teams.length} Teams</div>
                                                    <div className="flex items-center gap-1"><Building2 className="w-3 h-3" /> {contractor.store?.name || 'Unassigned'}</div>
                                                </div>
                                            </div>
                                            <div className="flex gap-2">
                                                <Button variant="ghost" size="sm" onClick={() => handleEdit(contractor)}><Pencil className="w-4 h-4 text-slate-500 hover:text-blue-600" /></Button>
                                                <Button variant="ghost" size="sm" onClick={() => deleteMutation.mutate(contractor.id)}><Trash className="w-4 h-4 text-slate-500 hover:text-red-600" /></Button>
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
                    <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto w-full">
                        <DialogHeader>
                            <DialogTitle>{selectedContractor ? 'Edit Contractor' : 'Register New Contractor'}</DialogTitle>
                            <DialogDescription>Manage contractor details, store assignment, and teams.</DialogDescription>
                        </DialogHeader>

                        <Form {...form}>
                            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6 mt-4">

                                {/* Basic Details */}
                                <div className="grid grid-cols-2 gap-4">
                                    <FormField control={form.control} name="name" render={({ field }) => (
                                        <FormItem><FormLabel>Contractor Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                                    )} />
                                    <FormField control={form.control} name="registrationNumber" render={({ field }) => (
                                        <FormItem><FormLabel>Registration No</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                                    )} />
                                    <FormField control={form.control} name="address" render={({ field }) => (
                                        <FormItem className="col-span-2"><FormLabel>Address</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                                    )} />
                                    <FormField control={form.control} name="storeId" render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Assigned Store / Branch</FormLabel>
                                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                <FormControl><SelectTrigger><SelectValue placeholder="Select Store" /></SelectTrigger></FormControl>
                                                <SelectContent>
                                                    {stores.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name} ({s.type})</SelectItem>)}
                                                </SelectContent>
                                            </Select>
                                            <FormMessage />
                                        </FormItem>
                                    )} />
                                    <FormField control={form.control} name="status" render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Status</FormLabel>
                                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                                                <SelectContent>
                                                    <SelectItem value="ACTIVE">Active</SelectItem>
                                                    <SelectItem value="INACTIVE">Inactive</SelectItem>
                                                    <SelectItem value="PENDING">Pending</SelectItem>
                                                </SelectContent>
                                            </Select>
                                            <FormMessage />
                                        </FormItem>
                                    )} />
                                </div>

                                <Separator />

                                {/* Teams Management */}
                                <div>
                                    <div className="flex justify-between items-center mb-2">
                                        <h3 className="text-sm font-bold text-slate-800">Teams & Members</h3>
                                        <Button type="button" size="sm" variant="outline" onClick={addTeam}><Plus className="w-3 h-3 mr-1" /> Add Team</Button>
                                    </div>

                                    <div className="space-y-4">
                                        {teams.map((team, tIdx) => (
                                            <div key={tIdx} className="border rounded-lg p-4 bg-slate-50 relative">
                                                <div className="absolute top-2 right-2">
                                                    <Button type="button" variant="ghost" size="sm" onClick={() => removeTeam(tIdx)} className="h-6 w-6 p-0 text-slate-400 hover:text-red-500"><Trash className="w-4 h-4" /></Button>
                                                </div>

                                                <div className="grid grid-cols-2 gap-4 mb-3">
                                                    <div className="space-y-1">
                                                        <Label className="text-xs">Team Name</Label>
                                                        <Input value={team.name} onChange={e => updateTeam(tIdx, 'name', e.target.value)} className="h-8 text-xs bg-white" />
                                                    </div>
                                                    <div className="col-span-2 space-y-2 mt-2 border p-2 rounded bg-white">
                                                        <Label className="text-xs font-semibold">Assign Stores & Primary Location</Label>
                                                        <ScrollArea className="h-32 w-full border rounded p-2">
                                                            {stores.map((store: any) => {
                                                                const isSelected = (team.storeIds || []).includes(store.id);
                                                                const isPrimary = team.primaryStoreId === store.id;
                                                                return (
                                                                    <div key={store.id} className="flex items-center justify-between py-1 border-b last:border-0 border-slate-100">
                                                                        <div className="flex items-center gap-2">
                                                                            <Checkbox
                                                                                checked={isSelected}
                                                                                onCheckedChange={() => toggleStore(tIdx, store.id)}
                                                                                id={`team-${tIdx}-store-${store.id}`}
                                                                            />
                                                                            <label htmlFor={`team-${tIdx}-store-${store.id}`} className="text-xs cursor-pointer select-none">
                                                                                {store.name}
                                                                            </label>
                                                                        </div>
                                                                        {isSelected && (
                                                                            <div className="flex items-center gap-1">
                                                                                <input
                                                                                    type="radio"
                                                                                    name={`team-${tIdx}-primary`}
                                                                                    checked={isPrimary}
                                                                                    onChange={() => updateTeam(tIdx, 'primaryStoreId', store.id)}
                                                                                    className="w-3 h-3 cursor-pointer"
                                                                                />
                                                                                <span className="text-[10px] text-slate-500">Primary</span>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                )
                                                            })}
                                                        </ScrollArea>
                                                    </div>
                                                </div>

                                                <div className="pl-2 border-l-2 border-slate-200">
                                                    <div className="flex justify-between items-center mb-1">
                                                        <Label className="text-[10px] text-slate-500 uppercase">Members</Label>
                                                        <Button type="button" size="sm" variant="ghost" onClick={() => addMember(tIdx)} className="h-5 text-[10px]"><Plus className="w-3 h-3 mr-1" /> Add Member</Button>
                                                    </div>
                                                    <div className="space-y-2">
                                                        {team.members.map((member, mIdx) => (
                                                            <div key={mIdx} className="flex gap-2 items-center">
                                                                <Input
                                                                    placeholder="Name"
                                                                    value={member.name}
                                                                    onChange={e => updateMember(tIdx, mIdx, 'name', e.target.value)}
                                                                    className="h-7 text-xs flex-1 bg-white"
                                                                />
                                                                <Input
                                                                    placeholder="NIC"
                                                                    value={member.idCopyNumber}
                                                                    onChange={e => updateMember(tIdx, mIdx, 'idCopyNumber', e.target.value)}
                                                                    className="h-7 text-xs w-24 bg-white"
                                                                />
                                                                <Button type="button" variant="ghost" size="sm" onClick={() => removeMember(tIdx, mIdx)} className="h-7 w-7 p-0 text-slate-400 hover:text-red-500"><Trash className="w-3 h-3" /></Button>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <DialogFooter>
                                    <Button type="button" variant="outline" onClick={() => setShowModal(false)}>Cancel</Button>
                                    <Button type="submit" disabled={mutation.isPending}>Save Contractor</Button>
                                </DialogFooter>
                            </form>
                        </Form>
                    </DialogContent>
                </Dialog>
            </main>
        </div>
    );
}

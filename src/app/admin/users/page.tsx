"use client";

import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Search, Plus, Trash, Pencil, Shield, User } from "lucide-react";
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from 'sonner';
import { createUser, updateUser, deleteUser } from '@/actions/user-actions';

// Types
interface UserData {
    id: string;
    username: string;
    email: string;
    name: string | null;
    role: string;
    employeeId?: string | null;
    createdAt: string;
    assignedStoreId?: string | null;
    accessibleOpmcs: { id: string, rtom: string }[];
    supervisor?: { id: string, name: string | null, username: string };
}

interface OPMC {
    id: string;
    name: string;
    rtom: string;
}

interface Store {
    id: string;
    name: string;
    location: string | null;
}

// Zod Schema
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

type UserFormValues = z.infer<typeof userSchema>

// Roles that strictly require OPMC selection
const requiresOPMC = ['MANAGER', 'SA_MANAGER', 'SA_ASSISTANT', 'SITE_OFFICE_STAFF'];

const roleCategories = {
    'System Admin': ['SUPER_ADMIN', 'ADMIN'],
    'Main Management': ['OSP_MANAGER'],
    'OSP & Operations': ['AREA_MANAGER', 'ENGINEER', 'ASSISTANT_ENGINEER', 'AREA_COORDINATOR', 'QC_OFFICER'],
    'Stores & Inventory': ['STORES_MANAGER', 'STORES_ASSISTANT'],
    'Finance': ['FINANCE_MANAGER', 'FINANCE_ASSISTANT'],
    'Invoice Section': ['INVOICE_MANAGER', 'INVOICE_ASSISTANT'],
    'Service Assurance': ['SA_MANAGER', 'SA_ASSISTANT'],
    'Office Admin': ['OFFICE_ADMIN', 'OFFICE_ADMIN_ASSISTANT', 'SITE_OFFICE_STAFF'],
    'Procurement': ['PROCUREMENT_OFFICER']
};

export default function UserRegistrationPage() {
    const queryClient = useQueryClient();
    const [searchTerm, setSearchTerm] = useState("");

    // Modal & Selection State
    const [showModal, setShowModal] = useState(false);
    const [selectedUser, setSelectedUser] = useState<UserData | null>(null);
    const [step, setStep] = useState(1);
    const [selectedSection, setSelectedSection] = useState<string | null>(null);

    // --- QUERIES ---
    const { data: users = [], isLoading: usersLoading } = useQuery<UserData[]>({
        queryKey: ["users"],
        queryFn: async () => {
            const res = await fetch("/api/users?page=1&limit=1000");
            if (!res.ok) return [];
            const data = await res.json();
            return data.users || (Array.isArray(data) ? data : []);
        }
    });

    const { data: opmcs = [] } = useQuery<OPMC[]>({
        queryKey: ["opmcs"],
        queryFn: async () => {
            const res = await fetch("/api/opmcs");
            if (!res.ok) return [];
            return res.json();
        }
    });

    const { data: stores = [] } = useQuery<Store[]>({
        queryKey: ["stores"],
        queryFn: async () => {
            const res = await fetch("/api/inventory/stores");
            if (!res.ok) return [];
            return res.json();
        }
    });

    // --- MUTATIONS ---
    const mutation = useMutation({
        mutationFn: async (values: UserFormValues & { id?: string }) => {
            if (values.id) {
                return await updateUser({ ...values, id: values.id });
            } else {
                return await createUser(values);
            }
        },
        onSuccess: (result) => {
            if (result.success) {
                queryClient.invalidateQueries({ queryKey: ["users"] });
                handleCloseModal();
                toast.success("User saved successfully");
            } else {
                toast.error(result.error || "Error saving user");
            }
        },
        onError: () => toast.error("Error saving user")
    });

    const deleteMutation = useMutation({
        mutationFn: async (id: string) => {
            return await deleteUser(id);
        },
        onSuccess: (result) => {
            if (result.success) {
                queryClient.invalidateQueries({ queryKey: ["users"] });
                toast.success("User deleted");
            } else {
                toast.error(result.error || "Error deleting user");
            }
        }
    });

    const form = useForm<UserFormValues>({
        resolver: zodResolver(userSchema),
        defaultValues: {
            username: '', email: '', password: '', name: '', role: '', employeeId: '', opmcIds: [], supervisorId: '', assignedStoreId: 'none'
        }
    });

    const watchedOpmcIds = form.watch('opmcIds');
    const watchedRole = form.watch('role');

    // --- AUTO-SUPERVISOR LOGIC ---
    React.useEffect(() => {
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
                u.accessibleOpmcs.some(o => opmcIds.includes(o.id))
            );
            autoSupervisorId = match?.id || users.find(u => u.role === 'OSP_MANAGER')?.id || '';
        }

        if (autoSupervisorId && autoSupervisorId !== form.getValues('supervisorId')) {
            form.setValue('supervisorId', autoSupervisorId);
        }
    }, [watchedRole, watchedOpmcIds, users, form]);

    // --- LOGIC ---
    const handleOpenModal = (user?: UserData) => {
        setStep(1);
        if (user) {
            setSelectedUser(user);
            // Identify section from role
            const section = Object.entries(roleCategories).find(([_, roles]) => roles.includes(user.role))?.[0] || null;
            setSelectedSection(section);

            form.reset({
                username: user.username,
                email: user.email,
                password: '',
                name: user.name || '',
                role: user.role,
                employeeId: user.employeeId || '',
                opmcIds: user.accessibleOpmcs?.map(o => o.id) || [],
                supervisorId: user.supervisor?.id || '',
                assignedStoreId: (user as any).assignedStoreId || 'none'
            });
        } else {
            setSelectedUser(null);
            setSelectedSection(null);
            form.reset({
                username: '', email: '', password: '', name: '', role: '', employeeId: '', opmcIds: [], supervisorId: '', assignedStoreId: 'none'
            });
        }
        setShowModal(true);
    };

    const handleCloseModal = () => {
        setShowModal(false);
        setSelectedUser(null);
        setStep(1);
        form.reset();
    };

    const onSubmit = (values: UserFormValues) => {
        mutation.mutate({
            ...values,
            id: selectedUser?.id
        });
    };

    // Filter Logic
    const filteredUsers = users.filter(u => {
        const searchLower = searchTerm.toLowerCase();
        return u.name?.toLowerCase().includes(searchLower) ||
            u.username.toLowerCase().includes(searchLower) ||
            u.email.toLowerCase().includes(searchLower) ||
            u.role.toLowerCase().includes(searchLower);
    });

    // Supervisor Logic: Filter by OPMC (Point 5)
    const potentialSupervisors = useMemo(() => {
        const selectedOpmcIds = watchedOpmcIds || [];
        if (selectedOpmcIds.length === 0) return users.filter(u => u.id !== selectedUser?.id);

        return users.filter(u => {
            if (u.id === selectedUser?.id) return false;
            // Check if supervisor shares at least one OPMC
            const supervisorOpmcs = u.accessibleOpmcs?.map(o => o.id) || [];
            return supervisorOpmcs.some(id => selectedOpmcIds.includes(id)) || u.role === 'SUPER_ADMIN' || u.role === 'ADMIN';
        });
    }, [users, selectedUser, watchedOpmcIds]);

    // Store Filtering: Filter by selected OPMCs (Point 5)
    const filteredStores = useMemo(() => {
        const selectedOpmcIds = watchedOpmcIds || [];
        if (selectedOpmcIds.length === 0) return stores;

        // Find stores linked to selected OPMCs
        const linkedStoreIds = opmcs
            .filter((o: any) => selectedOpmcIds.includes(o.id) && (o as any).storeId)
            .map((o: any) => (o as any).storeId);

        if (linkedStoreIds.length === 0) return stores;
        return stores.filter(s => linkedStoreIds.includes(s.id));
    }, [stores, opmcs, watchedOpmcIds]);

    {/* ... Buttons ... */ }

    return (
        <div className="h-screen flex bg-slate-50 overflow-hidden">
            <Sidebar />
            <main className="flex-1 flex flex-col min-w-0 h-full">
                <Header />
                <div className="flex-1 flex flex-col min-h-0 overflow-hidden">

                    {/* Fixed Top Section */}
                    <div className="flex-none p-4 space-y-4">
                        <div className="flex justify-between items-center">
                            <div>
                                <h1 className="text-xl font-bold text-slate-900">System Users</h1>
                                <p className="text-xs text-slate-500 mt-0.5">Manage user accounts, roles & permissions</p>
                            </div>
                            <div className="flex gap-2">
                                <Button variant="outline" size="sm" onClick={() => window.location.href = '/admin/users/import'} className="h-8 text-xs border-dashed border-slate-300">
                                    <Plus className="w-4 h-4 mr-2" /> Bulk Import
                                </Button>
                                <Button size="sm" onClick={() => handleOpenModal()} className="h-8 text-xs">
                                    <Plus className="w-4 h-4 mr-2" /> New User
                                </Button>
                            </div>
                        </div>

                        <div className="bg-white p-2 rounded-lg border shadow-sm flex items-center gap-2">
                            <Search className="w-4 h-4 text-slate-400" />
                            <Input
                                placeholder="Search users by name, email, or role..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className="h-8 text-xs border-0 focus-visible:ring-0 max-w-sm"
                            />
                        </div>
                    </div>

                    {/* Table Section */}
                    <div className="flex-1 mx-4 mb-4 bg-white rounded-xl border shadow-sm flex flex-col min-h-0">
                        <div className="flex-1 overflow-auto">
                            {usersLoading ? (
                                <div className="p-10 text-center text-slate-500 text-sm">Loading users...</div>
                            ) : filteredUsers.length === 0 ? (
                                <div className="p-10 text-center text-slate-500 text-sm">No users found.</div>
                            ) : (
                                <table className="w-full text-xs text-left relative">
                                    <thead className="bg-slate-50 text-slate-600 font-medium border-b sticky top-0 z-10">
                                        <tr>
                                            <th className="px-4 py-3 whitespace-nowrap">User</th>
                                            <th className="px-4 py-3 whitespace-nowrap">Role</th>
                                            <th className="px-4 py-3 whitespace-nowrap">RTOM Access</th>
                                            <th className="px-4 py-3 whitespace-nowrap">Supervisor</th>
                                            <th className="px-4 py-3 whitespace-nowrap text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y text-[11px]">
                                        {filteredUsers.map((u) => (
                                            <tr key={u.id} className="hover:bg-slate-50/50 transition-colors">
                                                <td className="px-4 py-2">
                                                    <div className="flex items-center gap-2">
                                                        <div className="h-7 w-7 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-[10px]">
                                                            {(u.name?.[0] || u.username[0]).toUpperCase()}
                                                        </div>
                                                        <div>
                                                            <div className="font-semibold text-slate-900">{u.name}</div>
                                                            <div className="text-[10px] text-slate-500">{u.username} • {u.email}</div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-2">
                                                    <span className="px-2 py-0.5 rounded-full text-[9px] bg-slate-100 text-slate-600 border border-slate-200 font-semibold tracking-wide">
                                                        {u.role.replace(/_/g, ' ')}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-2 text-slate-500">
                                                    <div className="flex flex-wrap gap-1">
                                                        {u.accessibleOpmcs?.length > 0 ? (
                                                            u.accessibleOpmcs.slice(0, 3).map(opmc => (
                                                                <span key={opmc.id} className="px-1.5 py-0.5 rounded text-[8px] bg-slate-50 text-slate-500 border border-slate-100">
                                                                    {opmc.rtom}
                                                                </span>
                                                            ))
                                                        ) : <span className="text-[9px] text-slate-400 italic">None</span>}
                                                        {u.accessibleOpmcs?.length > 3 && (
                                                            <span className="px-1.5 py-0.5 rounded text-[8px] bg-slate-50 text-slate-500 border border-slate-100">+{u.accessibleOpmcs.length - 3}</span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-4 py-2">
                                                    {u.supervisor ? (
                                                        <div className="flex items-center gap-1.5 text-slate-600">
                                                            <Shield className="w-3 h-3 text-slate-400" />
                                                            <span>{u.supervisor.name || u.supervisor.username}</span>
                                                        </div>
                                                    ) : <span className="text-slate-400 italic text-[9px]">None</span>}
                                                </td>
                                                <td className="px-4 py-2 text-right">
                                                    <div className="flex justify-end gap-1">
                                                        <Button variant="ghost" size="icon" className="h-7 w-7 text-blue-600 hover:bg-blue-50" onClick={() => handleOpenModal(u)}>
                                                            <Pencil className="w-3.5 h-3.5" />
                                                        </Button>
                                                        {u.role !== 'SUPER_ADMIN' && (
                                                            <Button variant="ghost" size="icon" className="h-7 w-7 text-red-600 hover:bg-red-50" onClick={() => { if (confirm(`Delete ${u.username}?`)) deleteMutation.mutate(u.id) }}>
                                                                <Trash className="w-3.5 h-3.5" />
                                                            </Button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>
                </div>

                {/* MODAL */}
                <Dialog open={showModal} onOpenChange={setShowModal}>
                    <DialogContent className="max-w-xl p-0 overflow-hidden border-none shadow-2xl">
                        <div className="bg-slate-900 p-6 text-white relative">
                            <div className="absolute top-0 right-0 p-4 opacity-10">
                                <User className="w-32 h-32" />
                            </div>
                            <DialogHeader>
                                <DialogTitle className="text-xl font-bold">{selectedUser ? 'Update Profile' : 'Assign New User'}</DialogTitle>
                                <DialogDescription className="text-slate-400 text-xs">
                                    Step {step} of 3: {step === 1 ? 'Personal Identity' : step === 2 ? 'Professional Access' : 'Supervision & Stocks'}
                                </DialogDescription>
                            </DialogHeader>

                            {/* Step Progress */}
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
                                                        <FormLabel className="text-[11px] font-bold uppercase text-slate-500">Staff ID</FormLabel>
                                                        <FormControl><Input placeholder="E12345" className="h-10 text-sm" {...field} /></FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )} />
                                            </div>

                                            <FormField control={form.control} name="email" render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel className="text-[11px] font-bold uppercase text-slate-500">Corporate Email</FormLabel>
                                                    <FormControl><Input type="email" placeholder="prasad@slt.lk" className="h-10 text-sm" {...field} /></FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )} />

                                            <FormField control={form.control} name="password" render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel className="text-[11px] font-bold uppercase text-slate-500">Access Password {selectedUser && '(Leave blank to skip)'}</FormLabel>
                                                    <FormControl><Input type="password" placeholder="••••••••" className="h-10 text-sm" {...field} /></FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )} />
                                        </div>
                                    )}

                                    {step === 2 && (
                                        <div className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-300">
                                            <div className="space-y-2">
                                                <FormLabel className="text-[11px] font-bold uppercase text-slate-500">Department / Section</FormLabel>
                                                <Select onValueChange={(val) => {
                                                    setSelectedSection(val);
                                                    form.setValue('role', ''); // Reset role when section changes
                                                }} value={selectedSection || ''}>
                                                    <FormControl>
                                                        <SelectTrigger className="h-10 text-sm">
                                                            <SelectValue placeholder="Select Department..." />
                                                        </SelectTrigger>
                                                    </FormControl>
                                                    <SelectContent>
                                                        {Object.keys(roleCategories).map(cat => (
                                                            <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>

                                            <FormField control={form.control} name="role" render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel className="text-[11px] font-bold uppercase text-slate-500">Specific Role</FormLabel>
                                                    <Select onValueChange={field.onChange} value={field.value} disabled={!selectedSection}>
                                                        <FormControl>
                                                            <SelectTrigger className="h-10 text-sm">
                                                                <SelectValue placeholder={selectedSection ? "Choose Role..." : "Select Department First"} />
                                                            </SelectTrigger>
                                                        </FormControl>
                                                        <SelectContent>
                                                            {selectedSection && roleCategories[selectedSection as keyof typeof roleCategories].map(r => (
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
                                                        <FormLabel className="text-[11px] font-bold uppercase text-slate-500">RTOM Jurisdictions</FormLabel>
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
                                                    <FormLabel className="text-[11px] font-bold uppercase text-slate-500">Operations Supervisor</FormLabel>
                                                    <Select onValueChange={field.onChange} value={field.value || 'none'}>
                                                        <FormControl>
                                                            <SelectTrigger className="h-10 text-sm">
                                                                <SelectValue placeholder="Select Supervisor..." />
                                                            </SelectTrigger>
                                                        </FormControl>
                                                        <SelectContent>
                                                            <SelectItem value="none">No Supervisor (Independent)</SelectItem>
                                                            {potentialSupervisors.map(u => (
                                                                <SelectItem key={u.id} value={u.id}>
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
                                                    <FormLabel className="text-[11px] font-bold uppercase text-slate-500">Primary Inventory Store</FormLabel>
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
                                                <Button type="button" variant="outline" onClick={() => setStep(step - 1)}>Back</Button>
                                            )}
                                            <Button type="button" variant="ghost" onClick={handleCloseModal} className="text-slate-400">Cancel</Button>
                                        </div>

                                        {step < 3 ? (
                                            <Button type="button" onClick={() => setStep(step + 1)} className="bg-blue-600 px-10 shadow-lg shadow-blue-100">Next Step</Button>
                                        ) : (
                                            <Button type="submit" disabled={mutation.isPending} className="bg-green-600 px-10 shadow-lg shadow-green-100">
                                                {mutation.isPending ? 'Processing...' : selectedUser ? 'Update Profile' : 'Confirm Registration'}
                                            </Button>
                                        )}
                                    </div>
                                </form>
                            </Form>
                        </div>
                    </DialogContent>
                </Dialog>

            </main>
        </div>
    );
}

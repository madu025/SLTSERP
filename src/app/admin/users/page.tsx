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
    'OSP Category': ['MANAGER', 'OSP_MANAGER', 'AREA_MANAGER', 'ENGINEER', 'ASSISTANT_ENGINEER', 'AREA_COORDINATOR', 'QC_OFFICER'],
    'Office Admin Category': ['OFFICE_ADMIN', 'OFFICE_ADMIN_ASSISTANT', 'SITE_OFFICE_STAFF'],
    'Finance Category': ['FINANCE_MANAGER', 'FINANCE_ASSISTANT'],
    'Invoice Section': ['INVOICE_MANAGER', 'INVOICE_ASSISTANT'],
    'Stores Category': ['STORES_MANAGER', 'STORES_ASSISTANT', 'PROCUREMENT_OFFICER'],
    'Service Fulfillment': ['SA_MANAGER', 'SA_ASSISTANT'],
    'System Admin': ['SUPER_ADMIN', 'ADMIN']
};

export default function UserRegistrationPage() {
    const queryClient = useQueryClient();
    const [searchTerm, setSearchTerm] = useState("");

    // Modal & Selection State
    const [showModal, setShowModal] = useState(false);
    const [selectedUser, setSelectedUser] = useState<UserData | null>(null);

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
            const method = values.id ? 'PUT' : 'POST';
            const res = await fetch('/api/users', {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(values)
            });
            if (!res.ok) throw new Error('Failed');
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["users"] });
            handleCloseModal();
            alert("User saved successfully");
        },
        onError: () => alert("Error saving user")
    });

    const deleteMutation = useMutation({
        mutationFn: async (id: string) => {
            const res = await fetch(`/api/users?id=${id}`, { method: 'DELETE' });
            if (!res.ok) throw new Error('Failed');
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["users"] });
            alert("User deleted");
        }
    });

    const form = useForm<UserFormValues>({
        resolver: zodResolver(userSchema),
        defaultValues: {
            username: '', email: '', password: '', name: '', role: 'ENGINEER', employeeId: '', opmcIds: [], supervisorId: '', assignedStoreId: 'none'
        }
    });

    // ... (handlers)
    const handleOpenModal = (user?: UserData) => {
        if (user) {
            setSelectedUser(user);
            form.reset({
                // ... other fields
                username: user.username,
                email: user.email,
                password: '',
                name: user.name || '',
                role: user.role,
                employeeId: user.employeeId || '',
                opmcIds: user.accessibleOpmcs?.map(o => o.id) || [],
                supervisorId: user.supervisor?.id || '',
                assignedStoreId: (user as any).assignedStoreId || 'none' // Need to ensure API returns this
            });
        } else {
            setSelectedUser(null);
            form.reset({
                username: '', email: '', password: '', name: '', role: 'ENGINEER', employeeId: '', opmcIds: [], supervisorId: '', assignedStoreId: 'none'
            });
        }
        setShowModal(true);
    };

    const handleCloseModal = () => {
        setShowModal(false);
        setSelectedUser(null);
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

    // Supervisor Logic (Simple: exclude self)
    const potentialSupervisors = useMemo(() => {
        return users.filter(u => u.id !== selectedUser?.id);
    }, [users, selectedUser]);

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
                            <Button size="sm" onClick={() => handleOpenModal()} className="h-8 text-xs">
                                <Plus className="w-4 h-4 mr-2" /> New User
                            </Button>
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
                                            <th className="px-4 py-3 whitespace-nowrap">OPMC Access</th>
                                            <th className="px-4 py-3 whitespace-nowrap">Supervisor</th>
                                            <th className="px-4 py-3 whitespace-nowrap text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y">
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
                                                    <span className="px-2 py-0.5 rounded-full text-[10px] bg-slate-100 text-slate-600 border border-slate-200 font-semibold tracking-wide">
                                                        {u.role.replace(/_/g, ' ')}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-2">
                                                    <div className="flex flex-wrap gap-1">
                                                        {u.accessibleOpmcs?.length > 0 ? (
                                                            u.accessibleOpmcs.slice(0, 3).map(opmc => (
                                                                <span key={opmc.id} className="px-1.5 py-0.5 rounded text-[9px] bg-slate-50 text-slate-500 border border-slate-100">
                                                                    {opmc.rtom}
                                                                </span>
                                                            ))
                                                        ) : <span className="text-[10px] text-slate-400 italic">None</span>}
                                                        {u.accessibleOpmcs?.length > 3 && (
                                                            <span className="px-1.5 py-0.5 rounded text-[9px] bg-slate-50 text-slate-500 border border-slate-100">+{u.accessibleOpmcs.length - 3} more</span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-4 py-2">
                                                    {u.supervisor ? (
                                                        <div className="flex items-center gap-1.5 text-slate-600">
                                                            <Shield className="w-3 h-3 text-slate-400" />
                                                            <span>{u.supervisor.name || u.supervisor.username}</span>
                                                        </div>
                                                    ) : <span className="text-slate-400 italic text-[10px]">None</span>}
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
                    <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                            <DialogTitle>{selectedUser ? 'Edit User' : 'Register New User'}</DialogTitle>
                            <DialogDescription>Fill in the user details and access permissions below.</DialogDescription>
                        </DialogHeader>

                        <Form {...form}>
                            <form onSubmit={form.handleSubmit(onSubmit)} className="grid grid-cols-1 md:grid-cols-2 gap-6">

                                {/* Left Col: Identity */}
                                <div className="space-y-4">
                                    <h4 className="text-xs font-bold uppercase text-slate-500 tracking-wider mb-2">Identity</h4>

                                    <FormField control={form.control} name="name" render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-xs">Full Name</FormLabel>
                                            <FormControl><Input className="h-8 text-xs" {...field} /></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )} />

                                    <div className="grid grid-cols-2 gap-4">
                                        <FormField control={form.control} name="username" render={({ field }) => (
                                            <FormItem>
                                                <FormLabel className="text-xs">Username</FormLabel>
                                                <FormControl><Input className="h-8 text-xs" {...field} /></FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )} />
                                        <FormField control={form.control} name="employeeId" render={({ field }) => (
                                            <FormItem>
                                                <FormLabel className="text-xs">Emp ID</FormLabel>
                                                <FormControl><Input className="h-8 text-xs" {...field} /></FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )} />
                                    </div>

                                    <FormField control={form.control} name="email" render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-xs">Email</FormLabel>
                                            <FormControl><Input type="email" className="h-8 text-xs" {...field} /></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )} />

                                    <FormField control={form.control} name="password" render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-xs">Password {selectedUser && '(Leave empty to keep)'}</FormLabel>
                                            <FormControl><Input type="password" className="h-8 text-xs" {...field} /></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )} />
                                </div>

                                {/* Right Col: Role & Access */}
                                <div className="space-y-4">
                                    <h4 className="text-xs font-bold uppercase text-slate-500 tracking-wider mb-2">Role & Access</h4>

                                    <FormField control={form.control} name="role" render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-xs">Role</FormLabel>
                                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                <FormControl>
                                                    <SelectTrigger className="h-8 text-xs">
                                                        <SelectValue placeholder="Select a role" />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    {Object.entries(roleCategories).map(([cat, roles]) => (
                                                        <SelectGroup key={cat}>
                                                            <SelectLabel className="text-[10px] text-slate-400 uppercase tracking-widest">{cat}</SelectLabel>
                                                            {roles.map(r => (
                                                                <SelectItem key={r} value={r} className="text-xs pl-6">{r.replace(/_/g, ' ')}</SelectItem>
                                                            ))}
                                                        </SelectGroup>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            <FormMessage />
                                        </FormItem>
                                    )} />

                                    <FormField control={form.control} name="supervisorId" render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-xs">Supervisor</FormLabel>
                                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                <FormControl>
                                                    <SelectTrigger className="h-8 text-xs">
                                                        <SelectValue placeholder="Select supervisor..." />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    <SelectItem value="none">None</SelectItem>
                                                    {potentialSupervisors.map(u => (
                                                        <SelectItem key={u.id} value={u.id} className="text-xs">{u.name || u.username} ({u.role})</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            <FormMessage />
                                        </FormItem>
                                    )} />

                                    {/* OPMC Multi Select */}
                                    <FormField control={form.control} name="opmcIds" render={({ field }) => (
                                        <FormItem>
                                            <div className="flex justify-between items-center mb-1">
                                                <FormLabel className="text-xs">OPMC Access</FormLabel>
                                                <Button type="button" variant="link" className="h-auto p-0 text-[10px]" onClick={() => {
                                                    if (field.value.length === opmcs.length) field.onChange([]);
                                                    else field.onChange(opmcs.map(o => o.id));
                                                }}>
                                                    {field.value.length === opmcs.length ? 'None' : 'All'}
                                                </Button>
                                            </div>
                                            <ScrollArea className="h-[150px] border rounded-md p-2 bg-slate-50">
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
                                                        <label htmlFor={`opmc-${opmc.id}`} className="text-xs leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer w-full">
                                                            {opmc.rtom} - {opmc.name}
                                                        </label>
                                                    </div>
                                                ))}
                                            </ScrollArea>
                                            <FormMessage />
                                        </FormItem>
                                    )} />

                                    {/* Assigned Store (New Field) */}
                                    <FormField control={form.control} name="assignedStoreId" render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-xs">Assigned Store (For Inventory Access)</FormLabel>
                                            <Select onValueChange={field.onChange} value={field.value || 'none'}>
                                                <FormControl>
                                                    <SelectTrigger className="h-8 text-xs">
                                                        <SelectValue placeholder="Select a store (optional)" />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    <SelectItem value="none">None (All / No Store)</SelectItem>
                                                    {stores.map(store => (
                                                        <SelectItem key={store.id} value={store.id} className="text-xs">
                                                            {store.name}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            <FormMessage />
                                        </FormItem>
                                    )} />
                                </div>

                                <div className="md:col-span-2 pt-4 flex justify-end gap-2 border-t">
                                    <Button type="button" variant="outline" onClick={handleCloseModal}>Cancel</Button>
                                    <Button type="submit" disabled={mutation.isPending}>
                                        {mutation.isPending ? 'Saving...' : 'Save User'}
                                    </Button>
                                </div>
                            </form>
                        </Form>
                    </DialogContent>
                </Dialog>

            </main>
        </div>
    );
}

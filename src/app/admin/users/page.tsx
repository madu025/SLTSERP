"use client";

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Search, Plus, Trash, Pencil, Shield, Users } from "lucide-react";
import { UserFormDialog, UserFormValues } from './components/UserFormDialog';
import { useUserOperations } from './hooks/useUserOperations';
import { useRouter } from 'next/navigation';

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
    storeId?: string | null;
}

interface Store {
    id: string;
    name: string;
    location: string | null;
}

export default function UserRegistrationPage() {
    const [searchTerm, setSearchTerm] = useState("");
    const [roleFilter, setRoleFilter] = useState("ALL");
    const [showModal, setShowModal] = useState(false);
    const [selectedUser, setSelectedUser] = useState<UserData | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<UserData | null>(null);
    const router = useRouter();

    const { upsertMutation, removeMutation } = useUserOperations();

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

    const handleOpenModal = (user?: UserData) => {
        if (user) {
            setSelectedUser(user);
        } else {
            setSelectedUser(null);
        }
        setShowModal(true);
    };

    const handleFormSubmit = async (values: UserFormValues) => {
        await upsertMutation.mutateAsync({
            ...values,
            id: selectedUser?.id
        });
        setShowModal(false);
        setSelectedUser(null);
    };

    // Filter Logic
    const ALL_ROLES = ['ALL', 'SUPER_ADMIN', 'ADMIN', 'OSP_MANAGER', 'AREA_MANAGER', 'ENGINEER', 'MANAGER', 'STORES_MANAGER', 'STORES_ASSISTANT', 'PROCUREMENT_OFFICER'];
    const filteredUsers = users.filter(u => {
        const searchLower = searchTerm.toLowerCase();
        const matchSearch = u.name?.toLowerCase().includes(searchLower) ||
            u.username.toLowerCase().includes(searchLower) ||
            u.email.toLowerCase().includes(searchLower) ||
            u.role.toLowerCase().includes(searchLower);
        const matchRole = roleFilter === 'ALL' || u.role === roleFilter;
        return matchSearch && matchRole;
    });

    return (
        <div className="h-screen flex bg-slate-50 overflow-hidden">
            <Sidebar />
            <main className="flex-1 flex flex-col min-w-0 h-full">
                <Header />
                <div className="flex-1 flex flex-col min-h-0 overflow-hidden">

                    {/* Fixed Top Section */}
                    <div className="flex-none p-4 space-y-3">
                        <div className="flex justify-between items-center">
                            <div>
                                <h1 className="text-xl font-black text-slate-900 flex items-center gap-2">
                                    <Users className="w-5 h-5 text-slate-500" />
                                    System Users
                                </h1>
                                <p className="text-xs text-slate-500 mt-0.5">
                                    Manage user accounts, roles &amp; permissions
                                    {!usersLoading && <span className="ml-1 font-bold text-slate-700">({users.length} total)</span>}
                                </p>
                            </div>
                            <div className="flex gap-2">
                                <Button variant="outline" size="sm" onClick={() => router.push('/admin/users/import')} className="h-8 text-xs border-dashed border-slate-300">
                                    <Plus className="w-4 h-4 mr-2" /> Bulk Import
                                </Button>
                                <Button size="sm" onClick={() => handleOpenModal()} className="h-8 text-xs">
                                    <Plus className="w-4 h-4 mr-2" /> New User
                                </Button>
                            </div>
                        </div>

                        {/* Role Filter Pills + Search */}
                        <div className="flex flex-col md:flex-row gap-2 items-start md:items-center">
                            <div className="flex gap-1 flex-wrap">
                                {ALL_ROLES.slice(0, 6).map(role => (
                                    <button
                                        key={role}
                                        onClick={() => setRoleFilter(role)}
                                        className={`px-2.5 py-1 text-[9px] font-black uppercase tracking-wider rounded-full border transition-all ${
                                            roleFilter === role ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-500 border-slate-200 hover:border-blue-300'
                                        }`}
                                    >
                                        {role.replace(/_/g, ' ')}
                                    </button>
                                ))}
                            </div>
                            <div className="relative ml-auto w-full md:w-80">
                                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                                <Input
                                    placeholder="Search by name, email, or role..."
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                    className="h-8 pl-9 text-xs border-slate-200"
                                />
                            </div>
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
                                                            <Button variant="ghost" size="icon" className="h-7 w-7 text-red-600 hover:bg-red-50" onClick={() => setDeleteTarget(u)}>
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

                <UserFormDialog 
                    open={showModal}
                    onOpenChange={(open) => {
                        setShowModal(open);
                        if (!open) {
                            setSelectedUser(null);
                        }
                    }}
                    onSubmit={handleFormSubmit}
                    isSubmitting={upsertMutation.isPending}
                    initialData={selectedUser ? {
                        ...selectedUser,
                        name: selectedUser.name || '',
                        employeeId: selectedUser.employeeId || '',
                        opmcIds: selectedUser.accessibleOpmcs?.map(o => o.id) || [],
                        supervisorId: selectedUser.supervisor?.id || '',
                        assignedStoreId: selectedUser.assignedStoreId || 'none'
                    } : undefined}
                    users={users}
                    opmcs={opmcs}
                    stores={stores}
                />

                {/* Delete Confirmation */}
                <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Delete user &quot;{deleteTarget?.username}&quot;?</AlertDialogTitle>
                            <AlertDialogDescription>
                                This will permanently delete this user account and remove all associated access. This action cannot be undone.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                                onClick={() => deleteTarget && removeMutation.mutate(deleteTarget.id)}
                                className="bg-red-600 hover:bg-red-700"
                            >
                                {removeMutation.isPending ? 'Deleting...' : 'Delete User'}
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>

            </main>
        </div>
    );
}

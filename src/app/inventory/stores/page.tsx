"use client";

import React, { useState, useMemo } from "react";
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash, MapPin, User, Search, Layers, AlertTriangle, Check, Warehouse } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

// High-Fidelity Refactored Components
import { useStoreOperations } from "./hooks/useStoreOperations";
import { StoreFormDialog } from "./components/StoreFormDialog";

interface Store {
    id: string;
    name: string;
    type: string;
    location?: string;
    manager?: { id: string; name: string; email: string };
    opmcs: Array<{ id: string; name: string; rtom: string }>;
}

interface OPMC {
    id: string;
    name: string;
    rtom: string;
}

interface User {
    id: string;
    name: string;
    email: string;
}

interface StoreFormValues {
    name: string;
    type: "MAIN" | "SUB";
    location?: string;
    managerId?: string | null;
    opmcIds: string[];
}

export default function StoresManagementPage() {
    // --- STATE MANAGEMENT ---
    const [searchTerm, setSearchTerm] = useState("");
    const [showFormModal, setShowFormModal] = useState(false);
    const [activeStore, setActiveStore] = useState<Store | null>(null);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);

    // --- HOOKS & OPERATIONS ---
    const { upsertMutation, removeMutation } = useStoreOperations();

    // Data Fetching
    const { data: stores = [], isLoading: isLoadingStores } = useQuery<Store[]>({
        queryKey: ["stores"],
        queryFn: async () => (await fetch("/api/stores")).json()
    });

    const { data: opmcs = [] } = useQuery<OPMC[]>({
        queryKey: ["opmcs"],
        queryFn: async () => (await fetch("/api/opmcs")).json()
    });

    const { data: users = [] } = useQuery<User[]>({
        queryKey: ["users-select"],
        queryFn: async () => {
            const res = await fetch("/api/users?page=1&limit=1000");
            const data = await res.json();
            return data.users || [];
        }
    });

    // --- HANDLERS ---
    const handleAdd = () => {
        setActiveStore(null);
        setShowFormModal(true);
    };

    const handleEdit = (store: Store) => {
        setActiveStore(store);
        setShowFormModal(true);
    };

    const handleDelete = (id: string) => {
        setShowDeleteConfirm(id);
    };

    const onFormSubmit = async (values: StoreFormValues) => {
        await upsertMutation.mutateAsync({ id: activeStore?.id, data: values });
        setShowFormModal(false);
    };

    const onConfirmDelete = async () => {
        if (!showDeleteConfirm) return;
        await removeMutation.mutateAsync(showDeleteConfirm);
        setShowDeleteConfirm(null);
    };

    const filteredStores = useMemo(() => {
        return stores.filter(store =>
            store.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            store.location?.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [stores, searchTerm]);

    return (
        <div className="h-screen flex bg-slate-50 selection:bg-blue-100 selection:text-blue-900 overflow-hidden">
            <Sidebar />
            <main className="flex-1 flex flex-col min-w-0 h-full relative">
                <Header />
                <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
                    <div className="max-w-7xl mx-auto space-y-6">
                        
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div>
                                <h1 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                                    <Warehouse className="w-5 h-5 text-slate-500" />
                                    Store Management
                                </h1>
                                <p className="text-xs text-slate-500 mt-0.5">Manage inventory stores, branches and RTOM assignments</p>
                            </div>
                            <Button onClick={handleAdd} className="h-8 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs">
                                <Plus className="w-4 h-4 mr-2" /> Add Store
                            </Button>
                        </div>

                        {/* Search Bar */}
                        <div className="relative w-full md:w-80">
                            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                            <Input
                                placeholder="Search stores by name or location..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className="h-8 pl-9 text-xs bg-white border-slate-200"
                            />
                        </div>

                        {/* Grid Visualization */}
                        {isLoadingStores ? (
                            <div className="py-20 flex flex-col items-center justify-center gap-4 opacity-30">
                                <Layers className="w-16 h-16 animate-pulse" />
                                <p className="text-xs font-black uppercase tracking-widest">Synchronizing Infrastructure Matrix...</p>
                            </div>
                        ) : filteredStores.length === 0 ? (
                            <div className="py-20 flex flex-col items-center justify-center text-slate-400 gap-3">
                                <Warehouse className="w-12 h-12 stroke-[1]" />
                                <p className="text-sm text-slate-500">No stores found. Add the first store to get started.</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pb-6">
                                {filteredStores.map((store) => (
                                    <Card key={store.id} className="group border border-slate-200 bg-white rounded-xl shadow-none hover:shadow-md transition-all duration-200 overflow-hidden">
                                        <CardContent className="p-0">
                                            <div className="p-5 space-y-4">
                                                <div className="flex justify-between items-start">
                                                    <div className="space-y-1.5">
                                                        <Badge variant="outline" className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${store.type === 'MAIN' ? 'bg-blue-600 border-blue-600 text-white' : 'bg-slate-100 border-slate-200 text-slate-500'}`}>
                                                            {store.type} STORE
                                                        </Badge>
                                                        <h3 className="text-sm font-bold text-slate-900 group-hover:text-blue-600 transition-colors">{store.name}</h3>
                                                    </div>
                                                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                                                        <Button variant="ghost" size="icon" onClick={() => handleEdit(store)} className="h-7 w-7 bg-slate-50 hover:bg-blue-50 rounded-lg">
                                                            <Pencil className="w-3.5 h-3.5 text-slate-400 hover:text-blue-600" />
                                                        </Button>
                                                        <Button variant="ghost" size="icon" onClick={() => handleDelete(store.id)} className="h-7 w-7 bg-slate-50 hover:bg-rose-50 rounded-lg">
                                                            <Trash className="w-3.5 h-3.5 text-slate-400 hover:text-rose-600" />
                                                        </Button>
                                                    </div>
                                                </div>

                                                <div className="space-y-2.5">
                                                    <div className="flex items-center gap-2.5">
                                                        <div className="h-7 w-7 rounded-lg bg-slate-50 flex items-center justify-center border border-slate-100">
                                                            <MapPin className="w-3.5 h-3.5 text-slate-400" />
                                                        </div>
                                                        <div>
                                                            <p className="text-[9px] font-black uppercase text-slate-400 leading-none">Location</p>
                                                            <p className="text-xs font-semibold text-slate-700 mt-0.5 truncate max-w-[160px]">{store.location || 'Not specified'}</p>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-2.5">
                                                        <div className="h-7 w-7 rounded-lg bg-slate-50 flex items-center justify-center border border-slate-100">
                                                            <User className="w-3.5 h-3.5 text-slate-400" />
                                                        </div>
                                                        <div>
                                                            <p className="text-[9px] font-black uppercase text-slate-400 leading-none">Store Manager</p>
                                                            <p className="text-xs font-semibold text-slate-700 mt-0.5">{store.manager?.name || 'Not assigned'}</p>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="px-5 py-3 border-t bg-slate-50/50 flex flex-col gap-2">
                                                <div className="flex items-center justify-between">
                                                    <p className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Assigned RTOMs</p>
                                                    <div className="h-4 w-4 bg-emerald-500 rounded-full border-2 border-white shadow-sm flex items-center justify-center">
                                                        <Check className="w-2.5 h-2.5 text-white" />
                                                    </div>
                                                </div>
                                                <div className="flex flex-wrap gap-1.5">
                                                    {store.opmcs?.length > 0 ? (
                                                        store.opmcs.map(o => (
                                                            <Badge key={o.id} variant="outline" className="text-[9px] font-bold bg-white border-slate-200 text-slate-600 px-2 py-0.5 rounded-md">
                                                                {o.name || o.rtom}
                                                            </Badge>
                                                        ))
                                                    ) : <span className="text-[10px] text-slate-400 italic">No RTOMs assigned</span>}
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                <StoreFormDialog 
                    open={showFormModal}
                    onOpenChange={setShowFormModal}
                    initialData={activeStore ? {
                        ...activeStore,
                        opmcIds: activeStore.opmcs.map(o => o.id),
                        type: activeStore.type as 'MAIN' | 'SUB',
                        managerId: activeStore.manager?.id
                    } : null}
                    onSubmit={onFormSubmit}
                    isSubmitting={upsertMutation.isPending}
                    users={users}
                    opmcs={opmcs}
                />

                {/* DELETE CONFIRMATION */}
                <Dialog open={!!showDeleteConfirm} onOpenChange={(o) => !o && setShowDeleteConfirm(null)}>
                    <DialogContent className="max-w-md">
                        <DialogHeader>
                            <DialogTitle className="text-slate-900">Delete Store</DialogTitle>
                            <DialogDescription>
                                Are you sure you want to delete this store? This action cannot be undone and will remove all store associations.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 flex items-start gap-2.5">
                            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                            <p className="text-xs text-amber-800">Deleting this store will disrupt all associated RTOM assignments and stock records. Ensure all physical inventory has been transferred before proceeding.</p>
                        </div>
                        <DialogFooter className="gap-2">
                            <Button variant="outline" onClick={() => setShowDeleteConfirm(null)} className="h-8 text-xs">Cancel</Button>
                            <Button onClick={onConfirmDelete} disabled={removeMutation.isPending} className="h-8 text-xs bg-red-600 hover:bg-red-700">
                                {removeMutation.isPending ? "Deleting..." : "Delete Store"}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

            </main>
        </div>
    );
}

"use client";

import React, { useState, useMemo } from "react";
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash, Building2, MapPin, User, Search, Map as MapIcon, Layers, ChevronRight, AlertTriangle } from "lucide-react";
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

export default function StoresManagementPage() {
    // --- STATE MANAGEMENT ---
    const [searchTerm, setSearchTerm] = useState("");
    const [showFormModal, setShowFormModal] = useState(false);
    const [activeStore, setActiveStore] = useState<Store | null>(null);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);

    // --- HOOKS & OPERATIONS ---
    const queryClient = useQueryClient(); // Wait, I need to import useQueryClient from tanstack
    const { upsertMutation, removeMutation } = useStoreOperations();

    // Data Fetching
    const { data: stores = [], isLoading: isLoadingStores } = useQuery<Store[]>({
        queryKey: ["stores"],
        queryFn: async () => (await fetch("/api/stores")).json()
    });

    const { data: opmcs = [] } = useQuery<any[]>({
        queryKey: ["opmcs"],
        queryFn: async () => (await fetch("/api/opmcs")).json()
    });

    const { data: users = [] } = useQuery<any[]>({
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

    const onFormSubmit = async (values: any) => {
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
                <div className="flex-1 overflow-y-auto p-6 md:p-12">
                    <div className="max-w-7xl mx-auto space-y-12">
                        
                        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                            <div className="space-y-1">
                                <h1 className="text-3xl font-black text-slate-900 tracking-tight">Logistics Infrastructure</h1>
                                <p className="text-xs font-semibold text-slate-500 flex items-center gap-1.5 uppercase tracking-widest opacity-80">
                                    <MapIcon className="w-3.5 h-3.5" /> High-Fidelity Distribution Hub Registry
                                </p>
                            </div>
                            <Button onClick={handleAdd} className="h-12 px-10 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-black text-xs uppercase tracking-widest shadow-2xl shadow-slate-200 transition-all hover:-translate-y-1">
                                <Plus className="w-4 h-4 mr-2" /> Register Logistics Center
                            </Button>
                        </div>

                        {/* Search Bar */}
                        <div className="relative group max-w-xl">
                            <Search className="w-4 h-4 text-slate-400 absolute left-4 top-4 transition-colors group-focus-within:text-blue-500" />
                            <Input
                                placeholder="Execute search by center label or regional coordinates..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className="pl-12 h-12 bg-white border-none rounded-2xl shadow-sm text-xs font-bold transition-all focus:ring-4 focus:ring-blue-100/50"
                            />
                        </div>

                        {/* Grid Visualization */}
                        {isLoadingStores ? (
                            <div className="py-20 flex flex-col items-center justify-center gap-4 opacity-30">
                                <Layers className="w-16 h-16 animate-pulse" />
                                <p className="text-xs font-black uppercase tracking-widest">Synchronizing Infrastructure Matrix...</p>
                            </div>
                        ) : filteredStores.length === 0 ? (
                            <div className="py-20 flex flex-col items-center justify-center text-slate-400 opacity-30 gap-4">
                                <MapIcon className="w-20 h-20 stroke-[1]" />
                                <p className="text-sm font-black uppercase tracking-widest">No logistics centers located in current index.</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 pb-12">
                                {filteredStores.map((store) => (
                                    <Card key={store.id} className="group border-none bg-white rounded-[40px] shadow-sm hover:shadow-2xl hover:shadow-slate-200/50 transition-all duration-500 overflow-hidden">
                                        <CardContent className="p-0">
                                            <div className="p-8 space-y-6">
                                                <div className="flex justify-between items-start">
                                                    <div className="space-y-2">
                                                        <Badge variant="outline" className={`text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-full ${store.type === 'MAIN' ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-100' : 'bg-slate-100 border-slate-200 text-slate-500'}`}>
                                                            {store.type} HUB
                                                        </Badge>
                                                        <h3 className="text-xl font-black text-slate-900 group-hover:text-blue-600 transition-colors uppercase leading-tight">{store.name}</h3>
                                                    </div>
                                                    <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-all">
                                                        <Button variant="ghost" size="icon" onClick={() => handleEdit(store)} className="h-9 w-9 bg-slate-50 hover:bg-blue-100 rounded-xl transition-all active:scale-95">
                                                            <Pencil className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-600" />
                                                        </Button>
                                                        <Button variant="ghost" size="icon" onClick={() => handleDelete(store.id)} className="h-9 w-9 bg-slate-50 hover:bg-rose-100 rounded-xl transition-all active:scale-95">
                                                            <Trash className="w-3.5 h-3.5 text-slate-400 group-hover:text-rose-600" />
                                                        </Button>
                                                    </div>
                                                </div>

                                                <div className="space-y-4">
                                                    <div className="flex items-center gap-3 group/meta">
                                                        <div className="h-9 w-9 rounded-2xl bg-slate-50 flex items-center justify-center transition-all group-hover/meta:bg-white border border-slate-50"><MapPin className="w-4 h-4 text-slate-400" /></div>
                                                        <div>
                                                            <p className="text-[9px] font-black uppercase text-slate-400 leading-none">Regional Anchors</p>
                                                            <p className="text-xs font-bold text-slate-700 mt-1 truncate max-w-[150px]">{store.location || 'Centralized Node'}</p>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-3 group/meta">
                                                        <div className="h-9 w-9 rounded-2xl bg-slate-50 flex items-center justify-center transition-all group-hover/meta:bg-white border border-slate-50"><User className="w-4 h-4 text-slate-400" /></div>
                                                        <div>
                                                            <p className="text-[9px] font-black uppercase text-slate-400 leading-none">Logistics Supervisor</p>
                                                            <p className="text-xs font-bold text-slate-700 mt-1">{store.manager?.name || 'Unassigned Overseer'}</p>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="px-8 py-5 border-t bg-slate-50/50 flex flex-col gap-3">
                                                <div className="flex items-center justify-between">
                                                    <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Jurisdictional RTOMs</p>
                                                    <div className="h-4 w-4 bg-emerald-500 rounded-full border-2 border-white shadow-sm flex items-center justify-center"><Check className="w-2.5 h-2.5 text-white" /></div>
                                                </div>
                                                <div className="flex flex-wrap gap-2">
                                                    {store.opmcs?.length > 0 ? (
                                                        store.opmcs.map(o => (
                                                            <Badge key={o.id} variant="outline" className="text-[9px] font-bold bg-white border-slate-100 text-slate-600 px-3 py-0.5 rounded-lg shadow-sm">
                                                                {o.name}
                                                            </Badge>
                                                        ))
                                                    ) : <span className="text-[10px] font-bold italic text-slate-400">No RTOMs assigned yet.</span>}
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
                    initialData={activeStore}
                    onSubmit={onFormSubmit}
                    isSubmitting={upsertMutation.isPending}
                    users={users}
                    opmcs={opmcs}
                />

                {/* DELETE CONFIRMATION */}
                <Dialog open={!!showDeleteConfirm} onOpenChange={(o) => !o && setShowDeleteConfirm(null)}>
                    <DialogContent className="max-w-md rounded-[40px] border-none shadow-2xl p-0 overflow-hidden">
                        <DialogHeader className="px-8 py-8 bg-rose-50 border-b border-rose-100 text-center">
                            <div className="h-16 w-16 bg-white rounded-3xl mx-auto flex items-center justify-center shadow-xl shadow-rose-100 border border-rose-100 mb-4">
                                <Trash className="w-8 h-8 text-rose-600" />
                            </div>
                            <DialogTitle className="text-2xl font-black text-rose-900 tracking-tight">Purge Logistics Node?</DialogTitle>
                            <DialogDescription className="text-xs font-bold text-rose-500 uppercase tracking-widest mt-2">
                                Decommissioning is absolute and permanent.
                            </DialogDescription>
                        </DialogHeader>
                        
                        <div className="px-8 py-8 space-y-6">
                            <div className="p-4 bg-amber-50 rounded-2xl border border-amber-200 flex items-start gap-3">
                                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
                                <p className="text-[11px] font-bold text-amber-800 leading-relaxed">
                                    Purging this center will disrupt all associated RTOM logistics and stock records. Ensure all physical inventory has been transferred to a surviving hub before execution.
                                </p>
                            </div>
                        </div>

                        <DialogFooter className="px-8 py-8 bg-slate-50 border-t flex justify-between items-center">
                            <Button variant="ghost" onClick={() => setShowDeleteConfirm(null)} className="font-bold text-slate-400 uppercase tracking-widest text-[10px]">Relinquish Threat</Button>
                            <Button onClick={onConfirmDelete} disabled={removeMutation.isPending} className="h-14 px-10 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white font-black text-xs uppercase tracking-widest shadow-2xl shadow-rose-200 transition-all hover:-translate-y-1">
                                {removeMutation.isPending ? "Executing Purge..." : "Confirm Decommission"}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

            </main>
        </div>
    );
}

// Fixed missing import
import { useQueryClient } from "@tanstack/react-query";

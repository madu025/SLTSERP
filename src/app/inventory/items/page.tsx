"use client";

import React, { useState } from "react";
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import { useQuery } from "@tanstack/react-query";
import { InventoryItem, ItemFormValues } from "@/types/inventory";

// High-Fidelity Refactored Components
import { useItemOperations } from "./hooks/useItemOperations";
import { ItemTable } from "./components/ItemTable";
import { ItemFormDialog } from "./components/ItemFormDialog";
import { BulkOperationsModals } from "./components/BulkOperationsModals";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export default function ItemMasterPage() {
    // --- STATE MANAGEMENT ---
    const [searchTerm, setSearchTerm] = useState("");
    const [categoryFilter, setCategoryFilter] = useState("ALL");
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    
    // Modal Visibility
    const [showFormModal, setShowFormModal] = useState(false);
    const [showBulkEditModal, setShowBulkEditModal] = useState(false);
    const [showMergeModal, setShowMergeModal] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);

    // Active Data
    const [activeItem, setActiveItem] = useState<InventoryItem | null>(null);
    const [bulkEditType, setBulkEditType] = useState<'CATEGORY' | 'JOB_TYPE' | 'TYPE' | null>(null);
    const [mergeTargetId, setMergeTargetId] = useState<string | null>(null);

    // Bulk Fields
    const [bulkCategory, setBulkCategory] = useState("OTHERS");
    const [bulkType, setBulkType] = useState("SLTS");
    const [bulkCommonFor, setBulkCommonFor] = useState<string[]>([]);

    // --- HOOKS & OPERATIONS ---
    const { upsertMutation, removeMutation, bulkUpdateMutation, mergeMutation } = useItemOperations();

    const { data: items = [], isLoading } = useQuery<InventoryItem[]>({
        queryKey: ["items"],
        queryFn: async () => {
            const res = await fetch("/api/inventory/items");
            if (!res.ok) throw new Error("Failed to fetch inventory items");
            return res.json();
        }
    });

    // --- SELECTION LOGIC ---
    const toggleSelect = (id: string) => {
        const newSet = new Set(selectedIds);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSelectedIds(newSet);
    };

    const toggleSelectAll = () => {
        if (selectedIds.size > 0) {
            setSelectedIds(new Set());
        } else {
            const filtered = items.filter(i => 
                (categoryFilter === "ALL" || i.category === categoryFilter) &&
                (i.name.toLowerCase().includes(searchTerm.toLowerCase()) || i.code.toLowerCase().includes(searchTerm.toLowerCase()))
            );
            setSelectedIds(new Set(filtered.map(i => i.id)));
        }
    };

    // --- HANDLERS ---
    const handleAdd = () => {
        setActiveItem(null);
        setShowFormModal(true);
    };

    const handleEdit = (item: InventoryItem) => {
        setActiveItem(item);
        setShowFormModal(true);
    };

    const handleDelete = (id: string) => {
        setShowDeleteConfirm(id);
    };

    const handleBulkEdit = (type: 'CATEGORY' | 'JOB_TYPE' | 'TYPE') => {
        setBulkEditType(type);
        setShowBulkEditModal(true);
    };

    const handleMerge = () => {
        setShowMergeModal(true);
    };

    const onFormSubmit = async (values: ItemFormValues) => {
        await upsertMutation.mutateAsync({ id: activeItem?.id, data: values });
        setShowFormModal(false);
    };

    const onBulkSubmit = async () => {
        const updates = Array.from(selectedIds).map(id => {
            const item = items.find(i => i.id === id);
            if (!item) return null;
            return {
                id,
                category: bulkEditType === 'CATEGORY' ? bulkCategory : item.category,
                type: bulkEditType === 'TYPE' ? bulkType : item.type,
                commonFor: bulkEditType === 'JOB_TYPE' ? bulkCommonFor : (item.commonFor || [])
            };
        }).filter((u): u is NonNullable<typeof u> => u !== null);

        await bulkUpdateMutation.mutateAsync(updates);
        setShowBulkEditModal(false);
        setSelectedIds(new Set());
    };

    const onMergeSubmit = async () => {
        if (!mergeTargetId) return;
        const sourceId = Array.from(selectedIds).find(id => id !== mergeTargetId);
        if (!sourceId) return;

        await mergeMutation.mutateAsync({ sourceId, targetId: mergeTargetId });
        setShowMergeModal(false);
        setSelectedIds(new Set());
    };

    const confirmDelete = async () => {
        if (!showDeleteConfirm) return;
        await removeMutation.mutateAsync(showDeleteConfirm);
        setShowDeleteConfirm(null);
    };

    // Derived Selection
    const selectedItemsForMerge = items.filter(i => selectedIds.has(i.id));

    return (
        <div className="h-screen flex bg-slate-50 selection:bg-blue-100 selection:text-blue-900 overflow-hidden">
            <Sidebar />
            <main className="flex-1 flex flex-col min-w-0 h-full relative">
                <Header />
                <div className="flex-1 overflow-y-auto p-6 md:p-12">
                    <div className="max-w-7xl mx-auto">
                        <ItemTable 
                            items={items}
                            isLoading={isLoading}
                            searchTerm={searchTerm}
                            onSearchChange={setSearchTerm}
                            categoryFilter={categoryFilter}
                            onCategoryFilterChange={setCategoryFilter}
                            selectedIds={selectedIds}
                            onToggleSelect={toggleSelect}
                            onToggleSelectAll={toggleSelectAll}
                            onAdd={handleAdd}
                            onEdit={handleEdit}
                            onDelete={handleDelete}
                            onBulkEdit={handleBulkEdit}
                            onMerge={handleMerge}
                        />
                    </div>
                </div>

                <ItemFormDialog 
                    open={showFormModal}
                    onOpenChange={setShowFormModal}
                    initialData={activeItem ? {
                        ...activeItem,
                        commonName: activeItem.commonName || '',
                        sltCode: activeItem.sltCode || '',
                        description: activeItem.description || '',
                        minLevel: (activeItem.minLevel ?? 0).toString(),
                        maxWastagePercentage: (activeItem.maxWastagePercentage ?? 0).toString(),
                        unitPrice: (activeItem.unitPrice ?? 0).toString(),
                        costPrice: (activeItem.costPrice ?? 0).toString(),
                        commonFor: activeItem.commonFor || [],
                        importAliases: activeItem.importAliases || [],
                        unit: activeItem.unit as ItemFormValues['unit'],
                        type: activeItem.type as ItemFormValues['type'],
                    } : null}
                    onSubmit={onFormSubmit}
                    isSubmitting={upsertMutation.isPending}
                />

                <BulkOperationsModals 
                    showBulkEdit={showBulkEditModal}
                    onShowBulkEditChange={setShowBulkEditModal}
                    bulkEditType={bulkEditType}
                    selectedCount={selectedIds.size}
                    bulkCategory={bulkCategory}
                    setBulkCategory={setBulkCategory}
                    bulkType={bulkType}
                    setBulkType={setBulkType}
                    bulkCommonFor={bulkCommonFor}
                    setBulkCommonFor={setBulkCommonFor}
                    onBulkSubmit={onBulkSubmit}
                    isBulkSubmitting={bulkUpdateMutation.isPending}
                    showMergeModal={showMergeModal}
                    onShowMergeModalChange={setShowMergeModal}
                    selectedItemsForMerge={selectedItemsForMerge}
                    mergeTargetId={mergeTargetId}
                    setMergeTargetId={setMergeTargetId}
                    onMergeSubmit={onMergeSubmit}
                    isMerging={mergeMutation.isPending}
                />

                <Dialog open={!!showDeleteConfirm} onOpenChange={(o) => !o && setShowDeleteConfirm(null)}>
                    <DialogContent className="rounded-3xl border-none shadow-2xl p-0 overflow-hidden">
                        <DialogHeader className="px-8 py-6 bg-rose-50 border-b border-rose-100 flex items-center justify-between flex-row">
                            <div className="flex items-center gap-3">
                                <div className="h-10 w-10 rounded-xl bg-white flex items-center justify-center shadow-lg shadow-rose-100 border border-rose-100">
                                    <TrashIcon className="w-5 h-5 text-rose-600" />
                                </div>
                                <div>
                                    <DialogTitle className="text-xl font-black text-rose-900">Delete Material</DialogTitle>
                                    <DialogDescription className="text-[10px] font-black uppercase text-rose-400 tracking-widest opacity-80">Permanent removal from the inventory.</DialogDescription>
                                </div>
                            </div>
                        </DialogHeader>
                        <div className="px-8 py-8 space-y-4">
                            <p className="text-xs font-bold text-slate-600 leading-relaxed">
                                Are you sure you want to delete this material? This action will permanently remove its record from the system.
                            </p>
                            <div className="p-3 bg-rose-100/30 rounded-xl border border-rose-100 text-[9px] font-black text-rose-600 uppercase tracking-widest flex items-center gap-2">
                                <AlertTriangleIcon className="w-4 h-4" /> Warning: Historical records and stock data will be lost.
                            </div>
                        </div>
                        <DialogFooter className="px-8 py-6 bg-slate-50 border-t flex justify-between items-center">
                            <Button variant="ghost" onClick={() => setShowDeleteConfirm(null)} className="font-bold text-slate-400 uppercase tracking-widest text-[10px]">Cancel</Button>
                            <Button variant="destructive" onClick={confirmDelete} disabled={removeMutation.isPending} className="h-12 px-10 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white font-black text-xs uppercase tracking-widest shadow-xl shadow-rose-200">
                                {removeMutation.isPending ? "Deleting..." : "Confirm Delete"}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </main>
        </div>
    );
}

function TrashIcon({ className }: { className?: string }) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
            <path d="M3 6h18" />
            <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
            <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
        </svg>
    );
}

function AlertTriangleIcon({ className }: { className?: string }) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
            <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
            <path d="M12 9v4" />
            <path d="M12 17h.01" />
        </svg>
    );
}

"use client";

import React from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, RotateCcw, Check, ChevronRight, Layers } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface Item {
    id: string;
    code: string;
    name: string;
    commonName?: string;
    category: string;
    type: string;
}

interface BulkOperationsModalsProps {
    // Bulk Edit
    showBulkEdit: boolean;
    onShowBulkEditChange: (open: boolean) => void;
    bulkEditType: 'CATEGORY' | 'JOB_TYPE' | 'TYPE' | null;
    selectedCount: number;
    bulkCategory: string;
    setBulkCategory: (val: string) => void;
    bulkType: string;
    setBulkType: (val: string) => void;
    bulkCommonFor: string[];
    setBulkCommonFor: (val: string[]) => void;
    onBulkSubmit: () => void;
    isBulkSubmitting: boolean;

    // Merge
    showMergeModal: boolean;
    onShowMergeModalChange: (open: boolean) => void;
    selectedItemsForMerge: Item[];
    mergeTargetId: string | null;
    setMergeTargetId: (id: string | null) => void;
    onMergeSubmit: () => void;
    isMerging: boolean;
}

export function BulkOperationsModals({
    showBulkEdit, onShowBulkEditChange, bulkEditType, selectedCount,
    bulkCategory, setBulkCategory, bulkType, setBulkType, bulkCommonFor, setBulkCommonFor, onBulkSubmit, isBulkSubmitting,
    showMergeModal, onShowMergeModalChange, selectedItemsForMerge, mergeTargetId, setMergeTargetId, onMergeSubmit, isMerging
}: BulkOperationsModalsProps) {

    return (
        <>
            {/* BULK EDIT MODAL */}
            <Dialog open={showBulkEdit} onOpenChange={onShowBulkEditChange}>
                <DialogContent className="max-w-md rounded-3xl border-none shadow-2xl p-0 overflow-hidden">
                    <DialogHeader className="px-8 py-6 bg-slate-50 border-b">
                        <DialogTitle className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                            <Layers className="w-5 h-5 text-blue-600" /> Bulk Recalibration
                        </DialogTitle>
                        <DialogDescription className="text-xs font-semibold text-slate-500">Updating metadata for {selectedCount} targeted entities.</DialogDescription>
                    </DialogHeader>

                    <div className="px-8 py-8 space-y-6">
                        {bulkEditType === 'CATEGORY' && (
                            <div className="space-y-3">
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Target Category Cluster</label>
                                <Select value={bulkCategory} onValueChange={setBulkCategory}>
                                    <SelectTrigger className="h-12 rounded-xl bg-slate-50 border-slate-100 text-xs font-bold"><SelectValue /></SelectTrigger>
                                    <SelectContent className="rounded-2xl border-none shadow-2xl">
                                        {['CABLES', 'POLES', 'FIBER_ACCESSORIES', 'COPPER_ACCESSORIES', 'HARDWARE', 'EQUIPMENT', 'OTHERS'].map(c => (
                                            <SelectItem key={c} value={c} className="text-xs font-bold">{c.replace('_', ' ')}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}

                        {bulkEditType === 'JOB_TYPE' && (
                            <div className="space-y-4">
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Applicable Project Scopes</label>
                                <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                                    {['FTTH', 'PSTN', 'OSP', 'OTHERS'].map(type => (
                                        <div key={type} className="flex items-center gap-3">
                                            <input
                                                type="checkbox"
                                                id={`bulk-${type}`}
                                                className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 checked:bg-blue-600 cursor-pointer"
                                                checked={bulkCommonFor.includes(type)}
                                                onChange={(e) => {
                                                    if (e.target.checked) setBulkCommonFor([...bulkCommonFor, type]);
                                                    else setBulkCommonFor(bulkCommonFor.filter(t => t !== type));
                                                }}
                                            />
                                            <label htmlFor={`bulk-${type}`} className="text-xs font-bold text-slate-600 cursor-pointer uppercase tracking-widest">{type}</label>
                                        </div>
                                    ))}
                                </div>
                                <div className="p-3 bg-blue-50/50 rounded-xl border border-blue-100 flex items-start gap-2 text-[9px] text-blue-600 font-bold opacity-80">
                                    <InfoIcon className="w-3.5 h-3.5 shrink-0" />
                                    This operation will synchronize all targeted entities to the selected scopes.
                                </div>
                            </div>
                        )}

                        {bulkEditType === 'TYPE' && (
                            <div className="space-y-3">
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Resource Ownership</label>
                                <Select value={bulkType} onValueChange={setBulkType}>
                                    <SelectTrigger className="h-12 rounded-xl bg-slate-50 border-slate-100 text-xs font-bold"><SelectValue /></SelectTrigger>
                                    <SelectContent className="rounded-2xl border-none shadow-2xl">
                                        <SelectItem value="SLTS" className="text-xs font-bold font-black">SLTS (INTERNAL)</SelectItem>
                                        <SelectItem value="SLT" className="text-xs font-bold">SLT (GLOBAL)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        )}
                    </div>

                    <DialogFooter className="px-8 py-6 bg-slate-50 border-t flex justify-between items-center">
                        <Button variant="ghost" onClick={() => onShowBulkEditChange(false)} className="font-bold text-slate-400">Abort Operation</Button>
                        <Button onClick={onBulkSubmit} disabled={isBulkSubmitting} className="h-12 px-10 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-black text-xs uppercase tracking-widest shadow-xl shadow-blue-200">
                            {isBulkSubmitting ? "Processing..." : "Commit Batch Changes"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* MERGE MODAL */}
            <Dialog open={showMergeModal} onOpenChange={onShowMergeModalChange}>
                <DialogContent className="max-w-xl rounded-[40px] border-none shadow-2xl p-0 overflow-hidden">
                    <DialogHeader className="px-10 py-8 bg-emerald-600 text-white">
                        <DialogTitle className="text-2xl font-black tracking-tight flex items-center gap-3">
                            <RotateCcw className="w-6 h-6" /> Entity Identification Merge
                        </DialogTitle>
                        <DialogDescription className="text-emerald-100 text-xs font-bold tracking-widest uppercase opacity-80">
                            Consolidating redundant material signatures into a single global entity.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="px-10 py-10 space-y-8">
                        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 flex items-start gap-4">
                            <div className="h-10 w-10 bg-amber-100 rounded-xl flex items-center justify-center shrink-0">
                                <AlertTriangle className="w-5 h-5 text-amber-600" />
                            </div>
                            <div className="space-y-1">
                                <h4 className="text-xs font-black text-amber-900 uppercase tracking-widest">Structural Safety Protocol</h4>
                                <p className="text-[11px] font-bold text-amber-800/70 leading-relaxed">
                                    Merging will transfer all stock balances, historical GRN records, and serial tracking data to the **Primary Entity**. The secondary entity will be permanently purged from the registry.
                                </p>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-6 relative">
                            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-8 w-8 bg-white border border-slate-100 rounded-full flex items-center justify-center z-10 shadow-lg">
                                <ChevronRight className="w-4 h-4 text-slate-400" />
                            </div>

                            {selectedItemsForMerge.map((item, idx) => (
                                <div
                                    key={item.id}
                                    onClick={() => setMergeTargetId(item.id)}
                                    className={`relative p-6 rounded-3xl border-2 transition-all duration-500 cursor-pointer group ${mergeTargetId === item.id ? 'border-emerald-500 bg-emerald-50 shadow-2xl shadow-emerald-100 scale-105 z-20' : 'border-slate-50 bg-slate-50/50 hover:border-slate-100'}`}
                                >
                                    <div className={`absolute top-4 right-4 h-6 w-6 rounded-full flex items-center justify-center transition-all ${mergeTargetId === item.id ? 'bg-emerald-600 text-white' : 'bg-slate-200 group-hover:bg-slate-300'}`}>
                                        {mergeTargetId === item.id ? <Check className="w-4 h-4" /> : <div className="h-2 w-2 rounded-full bg-slate-400" />}
                                    </div>

                                    <div className="space-y-4">
                                        <div className="space-y-1">
                                            <p className={`text-[10px] font-black uppercase tracking-widest ${mergeTargetId === item.id ? 'text-emerald-600' : 'text-slate-400 opacity-60'}`}>
                                                {mergeTargetId === item.id ? 'Primary (Survive)' : `Option ${idx + 1}`}
                                            </p>
                                            <h3 className="text-sm font-black text-slate-900 leading-tight uppercase line-clamp-2">{item.name}</h3>
                                        </div>
                                        <div className="flex gap-2">
                                            <code className="text-[10px] font-black p-1 px-2 rounded bg-white border border-slate-100 text-slate-600">{item.code}</code>
                                            <Badge variant="outline" className="text-[8px] font-black border-slate-200 uppercase tracking-widest">{item.category}</Badge>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <DialogFooter className="px-10 py-8 bg-slate-50 border-t flex justify-between items-center">
                        <Button variant="ghost" onClick={() => onShowMergeModalChange(false)} className="font-bold text-slate-400 uppercase tracking-widest text-[10px]">Abandon Session</Button>
                        <Button onClick={onMergeSubmit} disabled={isMerging || !mergeTargetId} className="h-14 px-12 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase tracking-widest shadow-2xl shadow-emerald-200 transition-all hover:-translate-y-1">
                            {isMerging ? "Synchronizing..." : "Finalize Atomic Merge"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}

function InfoIcon({ className }: { className?: string }) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
            <circle cx="12" cy="12" r="10" />
            <path d="M12 16v-4" />
            <path d="M12 8h.01" />
        </svg>
    );
}

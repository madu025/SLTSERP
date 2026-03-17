"use client";

import React, { useMemo } from "react";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

import { useOrderAction } from "./useOrderAction";
import { OrderAssignmentSection } from "./OrderAssignmentSection";
import { DeviceSerialSection } from "./DeviceSerialSection";
import { MaterialUsageSection } from "./MaterialUsageSection";
import { ReturnReasonSection } from "./ReturnReasonSection";
import { OrderActionData, Contractor, InventoryItem } from "./types";

interface OrderActionModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (data: any) => void;
    title?: string;
    isReturn?: boolean;
    isComplete?: boolean;
    orderData?: OrderActionData;
    contractors?: Contractor[];
    items?: InventoryItem[];
    showExtendedFields?: boolean;
    materialSource?: string;
    itemSortOrder?: string[];
}

export default function OrderActionModal({
    isOpen,
    onClose,
    onConfirm,
    title = "Select Date",
    isReturn = false,
    isComplete = false,
    orderData,
    contractors = [],
    items = [],
    showExtendedFields = false,
    materialSource = 'SLT',
    itemSortOrder: _itemSortOrder = []
}: OrderActionModalProps) {
    const { state, controls } = useOrderAction(isOpen, orderData, items || [], materialSource, onConfirm);

    const useExtendedView = showExtendedFields || (isComplete && !isReturn);
    const iptvCount = orderData?.iptv ? parseInt(orderData.iptv) : 0;
    const requiresIPTV = useExtendedView && iptvCount > 0;

    // Filter Items Logic (Simplified for the modal view)
    const filteredItems = useMemo(() => items || [], [items]);

    // Quick Items logic extracted from original
    const quickItems = useMemo(() => {
        if (!items) return [];
        const candidates = items.filter(i => i.isOspFtth);
        const groups: Record<string, InventoryItem[]> = {};
        candidates.forEach(i => {
            const key = (i.commonName || i.name || "").trim();
            if (!key) return;
            if (!groups[key]) groups[key] = [];
            groups[key].push(i);
        });

        return Object.entries(groups).map(([label, groupItems]) => {
            const activeSource = materialSource === 'SLT' ? 'SLT' : 'SLTS';
            const best = groupItems.find(i => i.type === activeSource) || groupItems[0];
            return { label, item: best };
        });
    }, [items, materialSource]);

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent
                className={cn(
                    "overflow-hidden flex flex-col p-0 gap-0 transition-all duration-200",
                    useExtendedView
                        ? (state.activeTab === 'materials' || state.activeTab === 'finish' ? "sm:max-w-7xl h-[90vh]" : "sm:max-w-2xl h-[90vh]")
                        : "sm:max-w-lg max-h-[90vh]"
                )}
            >
                <DialogHeader className="px-6 py-4 border-b shrink-0 bg-white">
                    <DialogTitle className="text-xl font-extrabold text-slate-900 tracking-tight">{title}</DialogTitle>
                    {useExtendedView && (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 pt-4 border-t border-slate-100">
                            {[
                                { label: "Voice", val: orderData?.voiceNumber },
                                { label: "Pkg", val: orderData?.package },
                                { label: "IPTV", val: orderData?.iptv },
                                { label: "DP", val: orderData?.dp }
                            ].map(info => (
                                <div key={info.label} className="flex flex-col gap-1 p-2 rounded-lg bg-slate-50 border border-slate-100">
                                    <span className="text-[10px] font-bold text-blue-600 uppercase tracking-widest">{info.label}</span>
                                    <span className="text-sm font-bold text-slate-800 truncate">{info.val || 'N/A'}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </DialogHeader>

                <div className={cn(
                    "flex-1 min-h-0 bg-white flex flex-col",
                    useExtendedView ? "overflow-hidden p-0" : "overflow-y-auto px-6 py-6"
                )}>
                    {useExtendedView ? (
                        <div className="flex flex-col h-full w-full bg-slate-50/30">
                            {/* TABS */}
                            <div className="flex items-center px-6 bg-white border-b border-slate-200 sticky top-0 z-20 shadow-sm">
                                {['details', 'materials', 'finish'].map((tab, idx) => (
                                    <button
                                        key={tab}
                                        onClick={() => controls.setActiveTab(tab as 'details' | 'materials' | 'finish')}
                                        className={cn(
                                            "px-6 py-4 text-xs font-bold uppercase tracking-wider border-b-2 transition-all",
                                            state.activeTab === tab
                                                ? "border-blue-600 text-blue-600 bg-blue-50/50"
                                                : "border-transparent text-slate-500 hover:text-slate-700"
                                        )}
                                    >
                                        <span className="text-slate-400 font-mono mr-2">0{idx + 1}</span> {tab}
                                    </button>
                                ))}
                            </div>

                            <div className="flex-1 overflow-y-auto p-6">
                                {state.activeTab === 'details' && (
                                    <div className="max-w-3xl mx-auto space-y-6">
                                        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                                <div className="space-y-6">
                                                    <div className="space-y-2">
                                                        <Label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Completion Date</Label>
                                                        <Popover>
                                                            <PopoverTrigger asChild>
                                                                <Button variant="outline" className="w-full h-11 justify-start border-slate-200">
                                                                    <CalendarIcon className="mr-2 h-4 w-4 text-blue-500" />
                                                                    {state.date ? format(state.date, "PPP") : <span>Pick a date</span>}
                                                                </Button>
                                                            </PopoverTrigger>
                                                            <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={state.date} onSelect={controls.setDate} /></PopoverContent>
                                                        </Popover>
                                                    </div>
                                                    <div className="space-y-2">
                                                        <Label className="text-xs font-bold text-slate-400 uppercase tracking-widest">DP Details</Label>
                                                        <Input value={state.dpDetails} onChange={e => controls.setDpDetails(e.target.value)} className="h-11" />
                                                    </div>
                                                </div>
                                                <OrderAssignmentSection 
                                                    assignmentType={state.assignmentType}
                                                    onAssignmentTypeChange={controls.setAssignmentType}
                                                    selectedContractorId={state.selectedContractorId}
                                                    onContractorChange={controls.setSelectedContractorId}
                                                    selectedTeamId={state.selectedTeamId}
                                                    onTeamChange={controls.setSelectedTeamId}
                                                    directTeamName={state.directTeamName}
                                                    onDirectTeamNameChange={controls.setDirectTeamName}
                                                    contractors={contractors}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {state.activeTab === 'materials' && (
                                    <MaterialUsageSection 
                                        rows={state.extendedMaterialRows}
                                        onAddRow={controls.addExtendedRow}
                                        onUpdateRow={controls.updateExtendedRow}
                                        onRemoveRow={controls.removeExtendedRow}
                                        onPortalImport={controls.handlePortalImport}
                                        onApplyPreset={controls.applyPreset}
                                        items={filteredItems}
                                        quickItems={quickItems}
                                        materialSource={materialSource}
                                    />
                                )}

                                {state.activeTab === 'finish' && (
                                    <div className="max-w-3xl mx-auto space-y-8">
                                        <DeviceSerialSection 
                                            ontType={state.ontType}
                                            onOntTypeChange={controls.setOntType}
                                            ontSerialNumber={state.ontSerialNumber}
                                            onOntSerialNumberChange={controls.setOntSerialNumber}
                                            iptvSerials={state.iptvSerials}
                                            onIptvSerialChange={controls.setIptvSerial}
                                            requiresIPTV={requiresIPTV}
                                        />
                                        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                                            <Label className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 block">Notes</Label>
                                            <Textarea value={state.comment} onChange={e => controls.setComment(e.target.value)} rows={6} />
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="p-4 bg-white border-t border-slate-200 flex justify-between items-center z-20">
                                <Button variant="ghost" onClick={onClose}>Cancel</Button>
                                <div className="flex gap-3">
                                    {state.activeTab !== 'details' && <Button variant="outline" onClick={() => controls.setActiveTab(state.activeTab === 'finish' ? 'materials' : 'details')}>Back</Button>}
                                    {state.activeTab === 'finish' ? (
                                        <Button onClick={controls.confirm} className="bg-emerald-600 hover:bg-emerald-700 px-8">Complete Order</Button>
                                    ) : (
                                        <Button onClick={() => controls.setActiveTab(state.activeTab === 'details' ? 'materials' : 'finish')}>Next</Button>
                                    )}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-6 px-6 py-4">
                            {/* Simple View for Return / Update */}
                            <div className="space-y-4">
                                <Label>Date</Label>
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button variant="outline" className="w-full h-12 justify-start"><CalendarIcon className="mr-2 h-4 w-4" />{state.date ? format(state.date, "PPP") : "Select Date"}</Button>
                                    </PopoverTrigger>
                                    <PopoverContent><Calendar mode="single" selected={state.date} onSelect={controls.setDate} /></PopoverContent>
                                </Popover>
                            </div>
                            {isReturn && (
                                <ReturnReasonSection 
                                    reason={state.reason} onReasonChange={controls.setReason}
                                    customReason={state.customReason} onCustomReasonChange={controls.setCustomReason}
                                />
                            )}
                            <div className="space-y-2">
                                <Label>Comments</Label>
                                <Textarea value={state.comment} onChange={e => controls.setComment(e.target.value)} />
                            </div>
                            <Button onClick={controls.confirm} className="w-full h-12 bg-slate-900">{isComplete ? "Finalize" : isReturn ? "Return" : "Save"}</Button>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}

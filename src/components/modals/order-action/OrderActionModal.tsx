"use client";

import React, { useMemo } from "react";
import { format } from "date-fns";
import { CalendarIcon, X } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
import { OrderActionData, Contractor, InventoryItem, OrderCompletionData } from "./types";

interface OrderActionModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (data: OrderCompletionData) => void;
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
    itemSortOrder = []
}: OrderActionModalProps) {
    const { state, controls } = useOrderAction(isOpen, orderData, items || [], materialSource, onConfirm);

    const useExtendedView = showExtendedFields || (isComplete && !isReturn);
    const iptvCount = orderData?.iptv ? parseInt(orderData.iptv) : 0;
    const requiresIPTV = useExtendedView && iptvCount > 0;

    // Filter & Sort Items Logic
    const filteredItems = useMemo(() => {
        if (!items) return [];
        const result = [...items];
        
        if (itemSortOrder && itemSortOrder.length > 0) {
            result.sort((a, b) => {
                const indexA = itemSortOrder.indexOf(a.id);
                const indexB = itemSortOrder.indexOf(b.id);
                if (indexA === -1 && indexB === -1) return 0;
                if (indexA === -1) return 1;
                if (indexB === -1) return -1;
                return indexA - indexB;
            });
        }
        return result;
    }, [items, itemSortOrder]);

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
                        ? "sm:max-w-4xl h-auto max-h-[85vh]"
                        : "sm:max-w-md h-auto max-h-[85vh]"
                )}
            >
                <DialogHeader className="px-6 py-3 border-b shrink-0 bg-white">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
                        <DialogTitle className="text-sm font-black text-slate-900 tracking-tight">
                            {orderData?.sltsStatus === 'COMPLETED' ? `UPDATE COMPLETE ORDER` : title}
                        </DialogTitle>
                        {useExtendedView && (
                            <div className="flex flex-wrap items-center gap-1.5">
                                {[
                                    { label: "Voice", val: orderData?.voiceNumber },
                                    { label: "Pkg", val: orderData?.package },
                                    { label: "IPTV", val: orderData?.iptv },
                                    { label: "DP", val: orderData?.dp }
                                ].map(info => (
                                    <div key={info.label} className="flex items-center gap-1 py-0.5 px-2 rounded-lg bg-slate-50 border border-slate-200/60 text-[9px] font-bold">
                                        <span className="text-blue-600 uppercase tracking-wider text-[8px]">{info.label}:</span>
                                        <span className="text-slate-700 truncate max-w-[100px]">{info.val || 'N/A'}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </DialogHeader>

                <div className={cn(
                    "flex-1 min-h-0 bg-white flex flex-col",
                    useExtendedView ? "" : "overflow-y-auto px-6 py-4"
                )}>
                    {useExtendedView ? (
                        <div className="flex flex-col w-full bg-slate-50/30">
                            {/* TABS */}
                            <div className="flex items-center px-4 bg-white border-b border-slate-200 sticky top-0 z-20 shadow-sm">
                                {['details', 'materials', 'cpe', 'finish'].map((tab, idx) => (
                                    <button
                                        key={tab}
                                        onClick={() => controls.setActiveTab(tab as 'details' | 'materials' | 'cpe' | 'finish')}
                                        className={cn(
                                            "px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider border-b-2 transition-all",
                                            state.activeTab === tab
                                                ? "border-blue-600 text-blue-600 bg-blue-50/50"
                                                : "border-transparent text-slate-500 hover:text-slate-700"
                                        )}
                                    >
                                        <span className="text-slate-400 font-mono mr-1.5">0{idx + 1}</span> {tab === 'cpe' ? 'CPE Recovery' : tab}
                                    </button>
                                ))}
                            </div>

                             <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                                {state.activeTab === 'details' && (
                                    <div className="max-w-2xl mx-auto space-y-4">
                                        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-sm space-y-4">
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <div className="space-y-4">
                                                    <div className="space-y-1">
                                                        <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Completion Date</Label>
                                                        <Popover>
                                                            <PopoverTrigger asChild>
                                                                <Button variant="outline" className="w-full h-9 justify-start border-slate-200 text-xs">
                                                                    <CalendarIcon className="mr-2 h-3.5 w-3.5 text-blue-500" />
                                                                    {state.date ? format(state.date, "PPP") : <span>Pick a date</span>}
                                                                </Button>
                                                            </PopoverTrigger>
                                                            <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={state.date} onSelect={controls.setDate} /></PopoverContent>
                                                        </Popover>
                                                    </div>
                                                    <div className="space-y-1">
                                                         <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">DP Details</Label>
                                                         <Input value={state.dpDetails} onChange={e => controls.setDpDetails(e.target.value)} className="h-9 text-xs" />
                                                     </div>

                                                 {/* Relational Erected Poles Section */}
                                                 <div className="space-y-3 bg-slate-50/50 border border-slate-200 rounded-xl p-4 mt-2">
                                                     <div className="flex items-center justify-between">
                                                         <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                                                             Erected Poles
                                                         </Label>
                                                         <Button
                                                             type="button"
                                                             variant="outline"
                                                             size="sm"
                                                             onClick={controls.addErectedPoleRow}
                                                             className="h-7 text-[10px] font-bold text-emerald-700 border-emerald-200 hover:bg-emerald-50"
                                                         >
                                                             + Add Pole
                                                         </Button>
                                                     </div>

                                                     {state.erectedPoles && state.erectedPoles.length > 0 ? (
                                                         <div className="space-y-2">
                                                             {state.erectedPoles.map((pole, pIdx) => (
                                                                 <div key={pIdx} className="flex gap-2 items-center">
                                                                     <div className="w-[180px]">
                                                                         <Select
                                                                             value={pole.poleType}
                                                                             onValueChange={(val) => controls.updateErectedPoleRow(pIdx, 'poleType', val)}
                                                                         >
                                                                             <SelectTrigger className="h-8 text-xs bg-white border-slate-200">
                                                                                 <SelectValue placeholder="Select Pole Type" />
                                                                             </SelectTrigger>
                                                                             <SelectContent>
                                                                                 <SelectItem value="PLC-5_6-CE" className="text-xs">5.6m Concrete Pole (5_6-CE)</SelectItem>
                                                                                 <SelectItem value="PLC-6_7-CE" className="text-xs">6.7m Concrete Pole (6_7-CE)</SelectItem>
                                                                                 <SelectItem value="PLC-8" className="text-xs">8.0m Concrete Pole (PLC-8)</SelectItem>
                                                                                 <SelectItem value="SLTPL" className="text-xs">SLT Provided Pole (SLTPL)</SelectItem>
                                                                             </SelectContent>
                                                                         </Select>
                                                                     </div>
                                                                     <div className="flex-1">
                                                                         <Input
                                                                             value={pole.poleNumber}
                                                                             onChange={(e) => controls.updateErectedPoleRow(pIdx, 'poleNumber', e.target.value.toUpperCase())}
                                                                             placeholder="Pole Number / Serial"
                                                                             className="h-8 text-xs bg-white"
                                                                         />
                                                                     </div>
                                                                     <Button
                                                                         type="button"
                                                                         variant="ghost"
                                                                         size="icon"
                                                                         onClick={() => controls.removeErectedPoleRow(pIdx)}
                                                                         className="h-8 w-8 text-slate-400 hover:text-red-500 rounded-md"
                                                                     >
                                                                         <X className="w-3.5 h-3.5" />
                                                                     </Button>
                                                                 </div>
                                                             ))}
                                                         </div>
                                                     ) : (
                                                         <div className="text-[11px] text-slate-400 text-center py-2 italic bg-white border border-dashed rounded-lg border-slate-200">
                                                             No poles erected for this service order.
                                                         </div>
                                                     )}
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

                                {state.activeTab === 'cpe' && (
                                    <div className="max-w-2xl mx-auto space-y-4">
                                        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3">
                                            <div className="flex justify-between items-center border-b pb-2">
                                                <div>
                                                    <h3 className="text-xs font-bold text-slate-850 uppercase tracking-wider">Collected Old CPE (CPE Recovery)</h3>
                                                    <p className="text-[10px] text-slate-500">Log any old/faulty ONT, STB, or Telephone instruments collected from customer premises.</p>
                                                </div>
                                                <Button variant="outline" size="sm" className="h-7 text-[10px] font-bold" onClick={controls.addCollectedCpeRow}>
                                                    + Add Device
                                                </Button>
                                            </div>

                                            {state.collectedCpes.length === 0 ? (
                                                <div className="text-center py-6 text-slate-400 text-[11px] font-medium">
                                                    No old CPE devices logged for collection. Click "+ Add Device" if you collected any.
                                                </div>
                                            ) : (
                                                <div className="space-y-2">
                                                    {state.collectedCpes.map((cpe, idx) => (
                                                        <div key={idx} className="grid grid-cols-12 gap-2 items-center bg-slate-50 p-2 rounded-lg border border-slate-100">
                                                            <div className="col-span-3">
                                                                <select
                                                                    value={cpe.deviceType}
                                                                    onChange={e => controls.updateCollectedCpeRow(idx, 'deviceType', e.target.value as any)}
                                                                    className="w-full h-8 px-2 bg-white border border-slate-200 rounded text-[11px] focus:outline-none focus:border-blue-400 font-bold"
                                                                >
                                                                    <option value="ONT">ONT (Router)</option>
                                                                    <option value="STB">STB (Set-Top Box)</option>
                                                                    <option value="PHONE">Phone (Telephone)</option>
                                                                </select>
                                                            </div>
                                                            <div className="col-span-6">
                                                                <Input
                                                                    placeholder="Old Device Serial Number"
                                                                    value={cpe.serialNumber}
                                                                    onChange={e => controls.updateCollectedCpeRow(idx, 'serialNumber', e.target.value)}
                                                                    className="h-8 text-[11px] font-mono"
                                                                />
                                                            </div>
                                                            <div className="col-span-2">
                                                                <select
                                                                    value={cpe.condition}
                                                                    onChange={e => controls.updateCollectedCpeRow(idx, 'condition', e.target.value as any)}
                                                                    className="w-full h-8 px-2 bg-white border border-slate-200 rounded text-[11px] focus:outline-none focus:border-blue-400"
                                                                >
                                                                    <option value="FAULTY">Faulty</option>
                                                                    <option value="WORKING">Working</option>
                                                                </select>
                                                            </div>
                                                            <div className="col-span-1 text-center">
                                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-rose-500 hover:bg-rose-50" onClick={() => controls.removeCollectedCpeRow(idx)}>
                                                                    ✕
                                                                </Button>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {state.activeTab === 'finish' && (
                                    <div className="max-w-2xl mx-auto space-y-4">
                                        <DeviceSerialSection 
                                            ontType={state.ontType}
                                            onOntTypeChange={controls.setOntType}
                                            ontSerialNumber={state.ontSerialNumber}
                                            onOntSerialNumberChange={controls.setOntSerialNumber}
                                            iptvSerials={state.iptvSerials}
                                            onIptvSerialChange={controls.setIptvSerial}
                                            requiresIPTV={requiresIPTV}
                                        />
                                        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                                            <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 block">Notes</Label>
                                            <Textarea value={state.comment} onChange={e => controls.setComment(e.target.value)} rows={4} className="text-xs" />
                                        </div>
                                    </div>
                                )}
                            </div>

                             <div className="p-3 bg-white border-t border-slate-200 flex justify-between items-center z-20 shrink-0">
                                <Button variant="ghost" size="sm" onClick={onClose} className="h-9 text-xs">Cancel</Button>
                                <div className="flex gap-2">
                                    {state.activeTab !== 'details' && (
                                        <Button 
                                            variant="outline" 
                                            size="sm" 
                                            onClick={() => controls.setActiveTab(state.activeTab === 'finish' ? 'cpe' : (state.activeTab === 'cpe' ? 'materials' : 'details'))} 
                                            className="h-9 text-xs"
                                        >
                                            Back
                                        </Button>
                                    )}
                                    {state.activeTab === 'finish' ? (
                                        <Button size="sm" onClick={controls.confirm} className="bg-emerald-600 hover:bg-emerald-700 px-6 h-9 text-xs font-bold uppercase">
                                            {orderData?.sltsStatus === 'COMPLETED' ? 'Update & Save' : 'Complete Order'}
                                        </Button>
                                    ) : (
                                        <Button 
                                            size="sm" 
                                            onClick={() => controls.setActiveTab(state.activeTab === 'details' ? 'materials' : (state.activeTab === 'materials' ? 'cpe' : 'finish'))} 
                                            className="h-9 text-xs font-bold uppercase"
                                        >
                                            Next
                                        </Button>
                                    )}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-4 px-6 py-4">
                            {/* Simple View for Return / Update */}
                            <div className="space-y-1.5">
                                <Label className="text-[10px] font-bold text-slate-450 uppercase tracking-widest">Date</Label>
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button variant="outline" className="w-full h-9 justify-start text-xs"><CalendarIcon className="mr-2 h-3.5 w-3.5 text-blue-500" />{state.date ? format(state.date, "PPP") : "Select Date"}</Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={state.date} onSelect={controls.setDate} /></PopoverContent>
                                </Popover>
                            </div>
                            {isReturn && (
                                <ReturnReasonSection 
                                    reason={state.reason} onReasonChange={controls.setReason}
                                    customReason={state.customReason} onCustomReasonChange={controls.setCustomReason}
                                />
                            )}
                            <div className="space-y-1.5">
                                <Label className="text-[10px] font-bold text-slate-450 uppercase tracking-widest">Comments</Label>
                                <Textarea value={state.comment} onChange={e => controls.setComment(e.target.value)} rows={3} className="text-xs" />
                            </div>
                            <Button onClick={controls.confirm} className="w-full h-9 text-xs bg-slate-900 font-bold uppercase hover:bg-slate-800">{isComplete ? "Finalize" : isReturn ? "Return" : "Save"}</Button>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}

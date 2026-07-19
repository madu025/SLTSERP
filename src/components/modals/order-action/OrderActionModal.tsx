"use client";

import React, { useMemo, useState } from "react";
import { format } from "date-fns";
import { 
    CalendarIcon, X, ClipboardList, Package, Router, CheckCircle2, Check,
    Tv, Smartphone, ShieldCheck
} from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";

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

function parsePoleType(typeStr: string) {
    if (!typeStr) {
        return { sizeType: 'PLC-5_6-CE', isSltProvided: false, isConcretePoured: false };
    }
    const parts = typeStr.split('|');
    if (parts.length === 1) {
        if (typeStr === 'SLTPL') {
            return { sizeType: 'PLC-5_6-CE', isSltProvided: true, isConcretePoured: false };
        }
        return { sizeType: typeStr, isSltProvided: false, isConcretePoured: false };
    }
    const sizeType = parts[0] || 'PLC-5_6-CE';
    const isSltProvided = parts[1] === 'SLT';
    const isConcretePoured = parts[2] === 'CONCRETE';
    return { sizeType, isSltProvided, isConcretePoured };
}

function serializePoleType(sizeType: string, isSltProvided: boolean, isConcretePoured: boolean) {
    return `${sizeType}|${isSltProvided ? 'SLT' : 'CONTRACTOR'}|${isConcretePoured ? 'CONCRETE' : 'NO_CONCRETE'}`;
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
    const [showSuccess, setShowSuccess] = useState(false);
    const [completedData, setCompletedData] = useState<OrderCompletionData | null>(null);

    const handleHookConfirm = (data: OrderCompletionData) => {
        setCompletedData(data);
        setShowSuccess(true);
    };

    const { state, controls } = useOrderAction(isOpen, orderData, items || [], materialSource, handleHookConfirm);

    // Reset local success state on reopen
    React.useEffect(() => {
        if (isOpen) {
            setShowSuccess(false);
            setCompletedData(null);
        }
    }, [isOpen]);

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

    // Memoize dates to prevent impure render calculations
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const todayStr = format(today, "yyyy-MM-dd");
    const yesterdayStr = format(yesterday, "yyyy-MM-dd");

    // Dynamic Drawer width based on tab content complexity
    const drawerWidth = useMemo(() => {
        if (!useExtendedView) return "w-[480px] max-w-full";
        if (state.activeTab === 'materials') return "w-[85vw] !max-w-none";
        return "w-[65vw] !max-w-none";
    }, [useExtendedView, state.activeTab]);

    // Tab completion checks
    const isDetailsCompleted = !!state.date;
    const isMaterialsCompleted = state.extendedMaterialRows.some(r => parseFloat(r.usedQty || r.f1Qty || r.g1Qty || '0') > 0);
    const isCpeCompleted = state.collectedCpes.some(c => c.serialNumber.trim() !== "");

    const getTabStatus = (tabId: 'details' | 'materials' | 'cpe' | 'finish') => {
        if (state.activeTab === tabId) return 'active';
        if (tabId === 'details' && isDetailsCompleted) return 'completed';
        if (tabId === 'materials' && isMaterialsCompleted) return 'completed';
        if (tabId === 'cpe' && isCpeCompleted) return 'completed';
        return 'pending';
    };

    const steps = ['details', 'materials', 'cpe', 'finish'] as const;
    const currentStepIndex = steps.indexOf(state.activeTab);
    const progressPercent = ((currentStepIndex + 1) / steps.length) * 100;

    const tabConfig = [
        { id: 'details', label: 'Details', icon: ClipboardList },
        { id: 'materials', label: 'Materials', icon: Package },
        { id: 'cpe', label: 'CPE Recovery', icon: Router },
        { id: 'finish', label: 'Review & Finish', icon: CheckCircle2 }
    ] as const;

    const handleConfirmFinal = () => {
        if (completedData) {
            onConfirm(completedData);
        } else {
            controls.confirm();
        }
    };

    if (showSuccess) {
        return (
            <Dialog open={isOpen} onOpenChange={onClose}>
                <DialogContent
                    showCloseButton={false}
                    className={cn(
                        "fixed !inset-y-0 !right-0 !top-0 !left-auto !translate-x-0 !translate-y-0 !h-full flex flex-col justify-center items-center !p-8 !gap-6 overflow-hidden bg-white dark:bg-slate-950 border-l border-slate-200 dark:border-slate-800 shadow-2xl z-50 duration-300 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right !rounded-none text-foreground w-full transition-all",
                        drawerWidth
                    )}
                >
                    <div className="flex flex-col items-center justify-center text-center max-w-sm space-y-6 animate-in fade-in zoom-in-95 duration-300">
                        <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                            <CheckCircle2 className="w-10 h-10 animate-bounce" />
                        </div>
                        <div className="space-y-2">
                            <h2 className="text-xl font-extrabold text-slate-900 dark:text-white tracking-tight">Order Completed Successfully</h2>
                            <p className="text-sm font-semibold text-slate-500 font-mono">SO-NUM: {orderData?.soNum || 'N/A'}</p>
                            <p className="text-xs text-slate-450 font-medium">Materials inventory counts have been updated. Managers have been notified of this completion.</p>
                        </div>
                        <div className="flex w-full gap-3 mt-4">
                            <Button 
                                variant="outline" 
                                className="flex-1 h-10 text-xs font-bold"
                                onClick={handleConfirmFinal}
                            >
                                View Order
                            </Button>
                            <Button 
                                className="flex-1 h-10 text-xs font-bold bg-slate-900 hover:bg-slate-800 dark:bg-slate-850 dark:hover:bg-slate-750 text-white"
                                onClick={handleConfirmFinal}
                            >
                                Close Drawer
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        );
    }

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent
                showCloseButton={false}
                className={cn(
                    "fixed !inset-y-0 !right-0 !top-0 !left-auto !translate-x-0 !translate-y-0 !h-full flex flex-col !p-0 !gap-0 overflow-hidden bg-white dark:bg-slate-950 border-l border-slate-200 dark:border-slate-800 shadow-2xl z-50 duration-300 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right !rounded-none text-foreground w-full transition-all",
                    drawerWidth
                )}
            >
                <div className="relative p-6 pb-4 flex-shrink-0 bg-slate-50 dark:bg-slate-900/60 border-b border-slate-200/60 dark:border-slate-800/60">
                    <div className="absolute top-0 right-0 p-5">
                        <button 
                            type="button"
                            onClick={onClose} 
                            className="p-2 rounded-full hover:bg-slate-200/50 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                    <div className="flex flex-col gap-1 mr-8">
                        <DialogTitle className="text-lg font-extrabold text-slate-900 dark:text-white tracking-tight">
                            {orderData?.sltsStatus === 'COMPLETED' ? `UPDATE COMPLETE ORDER` : title}
                        </DialogTitle>
                        {useExtendedView && (
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-3 pt-3 border-t border-slate-200/40 dark:border-slate-800/40 text-xs">
                                <div>
                                    <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Customer</div>
                                    <div className="text-xs font-semibold text-slate-700 dark:text-slate-300 truncate max-w-[150px]" title={orderData?.customerName || 'N/A'}>
                                        {orderData?.customerName || 'N/A'}
                                    </div>
                                </div>
                                <div>
                                    <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Package</div>
                                    <div className="text-xs font-semibold text-slate-700 dark:text-slate-300 truncate max-w-[150px]" title={orderData?.package || 'N/A'}>
                                        {orderData?.package || 'N/A'}
                                    </div>
                                </div>
                                <div>
                                    <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Devices / IPTV</div>
                                    <div className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                                        {iptvCount > 0 ? `${iptvCount} IPTV` : 'None'}
                                    </div>
                                </div>
                                <div>
                                    <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Distribution Point</div>
                                    <div className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                                        {orderData?.dp || 'N/A'}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {useExtendedView && (
                    <div className="border-b border-slate-200/60 dark:border-slate-800/60">
                        <div className="flex items-center px-4 bg-white dark:bg-slate-950 border-b border-slate-100 dark:border-slate-900 sticky top-0 z-20">
                            {tabConfig.map(({ id, label, icon: TabIcon }, idx) => {
                                const status = getTabStatus(id);
                                return (
                                    <button
                                        key={id}
                                        type="button"
                                        onClick={() => controls.setActiveTab(id)}
                                        className={cn(
                                            "flex items-center gap-2 px-4 py-3 text-xs font-bold tracking-wide border-b-2 transition-all",
                                            status === 'active'
                                                ? "border-blue-600 text-blue-600 bg-blue-50/20 dark:bg-blue-900/10"
                                                : "border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                                        )}
                                    >
                                        {status === 'completed' ? (
                                            <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 font-bold" />
                                        ) : status === 'active' ? (
                                            <span className="w-1.5 h-1.5 rounded-full bg-blue-600" />
                                        ) : (
                                            <span className="text-[10px] font-mono text-slate-400">0{idx + 1}</span>
                                        )}
                                        <TabIcon className={cn("w-3.5 h-3.5", status === 'active' ? "text-blue-600" : "text-slate-400")} />
                                        <span>{label}</span>
                                    </button>
                                );
                            })}
                        </div>
                        <div className="px-6 py-2 bg-slate-50/50 dark:bg-slate-900/30 flex items-center justify-between gap-4">
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                                Step {currentStepIndex + 1} of 4: {tabConfig[currentStepIndex].label}
                            </span>
                            <div className="flex-1 max-w-[150px] h-1 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                <div className="h-full bg-blue-600 rounded-full transition-all duration-300" style={{ width: `${progressPercent}%` }} />
                            </div>
                        </div>
                    </div>
                )}

                <div className={cn(
                    "flex-1 min-h-0 bg-white dark:bg-slate-950 flex flex-col overflow-y-auto",
                    useExtendedView ? "" : "p-6"
                )}>
                    {useExtendedView ? (
                        <div className="flex flex-col w-full bg-slate-50/30 dark:bg-slate-900/10 flex-1">
                            <div className="flex-1 overflow-y-auto p-6 space-y-6 transition-all duration-300 animate-in fade-in-50 slide-in-from-bottom-2">
                                {state.activeTab === 'details' && (
                                    <div className="w-full space-y-6">
                                        <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200/50 dark:border-slate-800/50 shadow-sm space-y-6">
                                            <div className="space-y-6">
                                                <div className="space-y-4">
                                                    <div className="space-y-2">
                                                        <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Completion Date</Label>
                                                        <div className="flex gap-2">
                                                            <Button
                                                                type="button"
                                                                variant={state.date && format(state.date, "yyyy-MM-dd") === todayStr ? "default" : "outline"}
                                                                onClick={() => controls.setDate(new Date())}
                                                                className="h-9 text-xs flex-1 font-semibold"
                                                            >
                                                                Today
                                                            </Button>
                                                            <Button
                                                                type="button"
                                                                variant={state.date && format(state.date, "yyyy-MM-dd") === yesterdayStr ? "default" : "outline"}
                                                                onClick={() => {
                                                                    const d = new Date();
                                                                    d.setDate(d.getDate() - 1);
                                                                    controls.setDate(d);
                                                                }}
                                                                className="h-9 text-xs flex-1 font-semibold"
                                                            >
                                                                Yesterday
                                                            </Button>
                                                            <Popover>
                                                                <PopoverTrigger asChild>
                                                                    <Button 
                                                                        variant="outline" 
                                                                        className={cn(
                                                                            "h-9 text-xs flex-1 font-semibold text-left justify-start",
                                                                            state.date && format(state.date, "yyyy-MM-dd") !== todayStr && format(state.date, "yyyy-MM-dd") !== yesterdayStr && "border-blue-500 text-blue-600"
                                                                        )}
                                                                    >
                                                                        <CalendarIcon className="mr-2 h-3.5 w-3.5 text-blue-500" />
                                                                        {state.date ? format(state.date, "MMM dd, yyyy") : "Pick Date..."}
                                                                    </Button>
                                                                </PopoverTrigger>
                                                                <PopoverContent className="w-auto p-0 z-50">
                                                                    <Calendar mode="single" selected={state.date} onSelect={controls.setDate} />
                                                                </PopoverContent>
                                                            </Popover>
                                                        </div>
                                                    </div>

                                                    <div className="space-y-1">
                                                         <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">DP Details</Label>
                                                         <Input value={state.dpDetails} onChange={e => controls.setDpDetails(e.target.value)} className="h-9 text-xs" />
                                                     </div>
 
                                                     <div className="space-y-3 mt-2">
                                                         <div className="flex items-center justify-between">
                                                             <Label className="text-xs font-bold text-slate-550 uppercase tracking-wider flex items-center gap-1.5">
                                                                 Erected Poles
                                                             </Label>
                                                             <Button
                                                                 type="button"
                                                                 variant="outline"
                                                                 size="sm"
                                                                 onClick={controls.addErectedPoleRow}
                                                                 className="h-7 text-[10px] font-bold text-emerald-700 border-emerald-250 hover:bg-emerald-50"
                                                             >
                                                                 + Add Pole
                                                             </Button>
                                                         </div>
 
                                                          {state.erectedPoles && state.erectedPoles.length > 0 ? (
                                                              <div className="space-y-2">
                                                                  {state.erectedPoles.map((pole, pIdx) => {
                                                                      const { sizeType, isSltProvided, isConcretePoured } = parsePoleType(pole.poleType);
                                                                      return (
                                                                          <div key={pIdx} className="flex flex-col sm:flex-row gap-2 items-start sm:items-center bg-slate-50/50 dark:bg-slate-900/30 p-2 rounded-xl border border-slate-100 dark:border-slate-800/40 w-full">
                                                                              <div className="w-full sm:w-[160px]">
                                                                                  <Select
                                                                                      value={sizeType}
                                                                                      onValueChange={(val) => controls.updateErectedPoleRow(pIdx, 'poleType', serializePoleType(val, isSltProvided, isConcretePoured))}
                                                                                  >
                                                                                      <SelectTrigger className="h-8 text-xs bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-850">
                                                                                          <SelectValue placeholder="Select Pole" />
                                                                                      </SelectTrigger>
                                                                                      <SelectContent>
                                                                                          <SelectItem value="PLC-5_6-CE" className="text-xs">5.6m Concrete Pole</SelectItem>
                                                                                          <SelectItem value="PLC-6_7-CE" className="text-xs">6.7m Concrete Pole</SelectItem>
                                                                                          <SelectItem value="PLC-8" className="text-xs">8.0m Concrete Pole</SelectItem>
                                                                                          <SelectItem value="PLC-GI" className="text-xs">GI Pole</SelectItem>
                                                                                      </SelectContent>
                                                                                  </Select>
                                                                              </div>
                                                                              <div className="w-full sm:flex-1">
                                                                                  <Input
                                                                                      value={pole.poleNumber}
                                                                                      onChange={(e) => controls.updateErectedPoleRow(pIdx, 'poleNumber', e.target.value.toUpperCase())}
                                                                                      placeholder="Pole Serial / Number"
                                                                                      className="h-8 text-xs bg-white dark:bg-slate-950"
                                                                                  />
                                                                              </div>
                                                                              <div className="flex items-center gap-4 pl-1 sm:pl-0">
                                                                                  <label className="flex items-center gap-1.5 cursor-pointer select-none">
                                                                                      <Checkbox
                                                                                          checked={isSltProvided}
                                                                                          onCheckedChange={(checked) => controls.updateErectedPoleRow(pIdx, 'poleType', serializePoleType(sizeType, !!checked, isConcretePoured))}
                                                                                          className="w-3.5 h-3.5 border-slate-350 data-[state=checked]:bg-indigo-600 data-[state=checked]:border-indigo-600"
                                                                                      />
                                                                                      <span className="text-[10px] font-bold uppercase text-slate-500 tracking-wider">SLT Provided</span>
                                                                                  </label>
                                                                                  <label className="flex items-center gap-1.5 cursor-pointer select-none">
                                                                                      <Checkbox
                                                                                          checked={isConcretePoured}
                                                                                          onCheckedChange={(checked) => controls.updateErectedPoleRow(pIdx, 'poleType', serializePoleType(sizeType, isSltProvided, !!checked))}
                                                                                          className="w-3.5 h-3.5 border-slate-350 data-[state=checked]:bg-emerald-600 data-[state=checked]:border-emerald-600"
                                                                                      />
                                                                                      <span className="text-[10px] font-bold uppercase text-slate-500 tracking-wider">Pole Concrete</span>
                                                                                  </label>
                                                                              </div>
                                                                              <Button
                                                                                  type="button"
                                                                                  variant="ghost"
                                                                                  size="icon"
                                                                                  onClick={() => controls.removeErectedPoleRow(pIdx)}
                                                                                  className="h-8 w-8 text-slate-400 hover:text-red-500 rounded-md sm:ml-1 self-end sm:self-center"
                                                                              >
                                                                                  <X className="w-3.5 h-3.5" />
                                                                              </Button>
                                                                          </div>
                                                                      );
                                                                  })}
                                                              </div>
                                                          ) : (
                                                             <div className="text-center py-6 text-slate-400 text-xs italic bg-white dark:bg-slate-900 border border-dashed rounded-xl border-slate-200/80 dark:border-slate-800/80">
                                                                 <span className="text-lg block mb-1">🪵</span>
                                                                 <div className="font-semibold text-slate-700 dark:text-slate-350">No erected poles yet.</div>
                                                                 <div className="text-[10px] text-slate-400 mt-0.5">Click &quot;Add Pole&quot; to record one if poles were installed.</div>
                                                             </div>
                                                         )}
                                                     </div>
                                                </div>
                                                <hr className="border-slate-100 dark:border-slate-800/60" />
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
                                    <div className="w-full">
                                        <MaterialUsageSection 
                                            rows={state.extendedMaterialRows}
                                            onAddRow={controls.addExtendedRow}
                                            onQuickAdd={controls.quickAddMaterial}
                                            onUpdateRow={controls.updateExtendedRow}
                                            onRemoveRow={controls.removeExtendedRow}
                                            onPortalImport={controls.handlePortalImport}
                                            onApplyPreset={controls.applyPreset}
                                            items={filteredItems}
                                            quickItems={quickItems}
                                            materialSource={materialSource}
                                        />
                                    </div>
                                )}

                                {state.activeTab === 'cpe' && (
                                    <div className="w-full space-y-6">
                                        <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200/50 dark:border-slate-800/50 shadow-sm space-y-6">
                                            <div className="space-y-4 pb-2">
                                                <div>
                                                    <h3 className="text-sm font-bold text-slate-800 dark:text-white uppercase tracking-wider">Collected Old CPE (CPE Recovery)</h3>
                                                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Log any old/faulty ONT, STB, or Telephone instruments collected from customer premises.</p>
                                                </div>
                                                <div className="flex gap-2">
                                                    <Button 
                                                        variant="outline" 
                                                        size="sm" 
                                                        className="h-9 flex-1 text-xs font-bold gap-1.5 hover:border-blue-500 hover:text-blue-600 transition-colors bg-white dark:bg-slate-950"
                                                        onClick={() => controls.addCollectedCpeWithType('ONT')}
                                                    >
                                                        <Router className="w-3.5 h-3.5" />
                                                        + ONT (Router)
                                                    </Button>
                                                    <Button 
                                                        variant="outline" 
                                                        size="sm" 
                                                        className="h-9 flex-1 text-xs font-bold gap-1.5 hover:border-blue-500 hover:text-blue-600 transition-colors bg-white dark:bg-slate-950"
                                                        onClick={() => controls.addCollectedCpeWithType('STB')}
                                                    >
                                                        <Tv className="w-3.5 h-3.5" />
                                                        + STB (Set-Top)
                                                    </Button>
                                                    <Button 
                                                        variant="outline" 
                                                        size="sm" 
                                                        className="h-9 flex-1 text-xs font-bold gap-1.5 hover:border-blue-500 hover:text-blue-600 transition-colors bg-white dark:bg-slate-950"
                                                        onClick={() => controls.addCollectedCpeWithType('PHONE')}
                                                    >
                                                        <Smartphone className="w-3.5 h-3.5" />
                                                        + Phone
                                                    </Button>
                                                </div>
                                            </div>

                                            {state.collectedCpes.length === 0 ? (
                                                <div className="text-center py-8 text-slate-400 text-xs italic bg-white dark:bg-slate-900 border border-dashed rounded-xl border-slate-200/80 dark:border-slate-800/80">
                                                    No old CPE devices logged for collection yet. Click buttons above to add.
                                                </div>
                                            ) : (
                                                <div className="space-y-3">
                                                    {state.collectedCpes.map((cpe, idx) => (
                                                        <div key={idx} className="grid grid-cols-12 gap-2 items-center bg-slate-50 dark:bg-slate-900/50 p-3 rounded-xl border border-slate-200/40 dark:border-slate-800/40">
                                                            <div className="col-span-3">
                                                                <select
                                                                    value={cpe.deviceType}
                                                                    onChange={e => controls.updateCollectedCpeRow(idx, 'deviceType', e.target.value as 'ONT' | 'STB' | 'PHONE')}
                                                                    className="w-full h-9 px-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded text-xs focus:outline-none focus:border-blue-400 font-bold"
                                                                >
                                                                    <option value="ONT">ONT (Router)</option>
                                                                    <option value="STB">STB (Set-Top)</option>
                                                                    <option value="PHONE">Phone (Landline)</option>
                                                                </select>
                                                            </div>
                                                            <div className="col-span-6">
                                                                <Input
                                                                    placeholder="Old Device Serial Number"
                                                                    value={cpe.serialNumber}
                                                                    onChange={e => controls.updateCollectedCpeRow(idx, 'serialNumber', e.target.value)}
                                                                    className="h-9 text-xs font-mono"
                                                                />
                                                            </div>
                                                            <div className="col-span-2">
                                                                <select
                                                                    value={cpe.condition}
                                                                    onChange={e => controls.updateCollectedCpeRow(idx, 'condition', e.target.value as 'FAULTY' | 'WORKING')}
                                                                    className="w-full h-9 px-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded text-xs focus:outline-none focus:border-blue-400"
                                                                >
                                                                    <option value="FAULTY">Faulty</option>
                                                                    <option value="WORKING">Working</option>
                                                                </select>
                                                            </div>
                                                            <div className="col-span-1 text-center">
                                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-rose-500 hover:bg-rose-50 rounded-md" onClick={() => controls.removeCollectedCpeRow(idx)}>
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
                                    <div className="w-full space-y-6">
                                        <DeviceSerialSection 
                                            ontType={state.ontType}
                                            onOntTypeChange={controls.setOntType}
                                            ontSerialNumber={state.ontSerialNumber}
                                            onOntSerialNumberChange={controls.setOntSerialNumber}
                                            iptvSerials={state.iptvSerials}
                                            onIptvSerialChange={controls.setIptvSerial}
                                            requiresIPTV={requiresIPTV}
                                        />

                                        <div className="p-5 bg-blue-50/20 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/50 rounded-xl space-y-4">
                                            <h4 className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider flex items-center gap-1.5">
                                                <ShieldCheck className="w-4 h-4" />
                                                Completion Summary Review
                                            </h4>
                                            <div className="grid grid-cols-2 gap-3 text-xs">
                                                <div className="bg-white dark:bg-slate-900 p-3 rounded-lg border border-slate-100 dark:border-slate-800">
                                                    <span className="text-[10px] text-slate-400 uppercase font-bold block">Completion Date</span>
                                                    <span className="font-semibold text-slate-700 dark:text-slate-200">{state.date ? format(state.date, "MMM dd, yyyy") : 'Not set'}</span>
                                                </div>
                                                <div className="bg-white dark:bg-slate-900 p-3 rounded-lg border border-slate-100 dark:border-slate-800">
                                                    <span className="text-[10px] text-slate-400 uppercase font-bold block">Assignment</span>
                                                    <span className="font-semibold text-slate-700 dark:text-slate-200">{state.assignmentType === 'CONTRACTOR' ? 'Contractor Team' : (state.directTeamName || 'Direct Team')}</span>
                                                </div>
                                                <div className="bg-white dark:bg-slate-900 p-3 rounded-lg border border-slate-100 dark:border-slate-800">
                                                    <span className="text-[10px] text-slate-400 uppercase font-bold block">Materials Consumed</span>
                                                    <span className="font-semibold text-slate-700 dark:text-slate-200">
                                                        {state.extendedMaterialRows.filter(r => parseFloat(r.usedQty || r.f1Qty || r.g1Qty || '0') > 0).length} Items logged
                                                    </span>
                                                </div>
                                                <div className="bg-white dark:bg-slate-900 p-3 rounded-lg border border-slate-100 dark:border-slate-800">
                                                    <span className="text-[10px] text-slate-400 uppercase font-bold block">CPE Collected</span>
                                                    <span className="font-semibold text-slate-700 dark:text-slate-200">
                                                        {state.collectedCpes.length} Devices recorded
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200/50 dark:border-slate-800/50 shadow-sm">
                                            <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">Notes</Label>
                                            <Textarea 
                                                value={state.comment} 
                                                onChange={e => controls.setComment(e.target.value)} 
                                                rows={4} 
                                                placeholder="Add installation notes... (Optional)"
                                                className="text-xs" 
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="p-5 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/20 flex justify-between items-center z-20 shrink-0 shadow-[0_-8px_20px_rgba(0,0,0,.05)]">
                                <Button variant="ghost" size="sm" onClick={onClose} className="h-9 text-xs">Cancel</Button>
                                <div className="flex gap-2">
                                    {state.activeTab !== 'details' && (
                                         <Button 
                                             variant="outline" 
                                             size="sm" 
                                             onClick={() => controls.setActiveTab(state.activeTab === 'finish' ? 'cpe' : (state.activeTab === 'cpe' ? 'materials' : 'details'))} 
                                             className="h-9 text-xs"
                                         >
                                             ← Previous
                                         </Button>
                                    )}
                                    {state.activeTab === 'finish' ? (
                                         <Button size="sm" onClick={controls.confirm} className="bg-emerald-600 hover:bg-emerald-700 px-6 h-9 text-xs font-bold uppercase text-white">
                                             {orderData?.sltsStatus === 'COMPLETED' ? 'Update & Save' : 'Complete Order'}
                                         </Button>
                                    ) : (
                                         <Button 
                                             size="sm" 
                                             onClick={() => controls.setActiveTab(state.activeTab === 'details' ? 'materials' : (state.activeTab === 'materials' ? 'cpe' : 'finish'))} 
                                             className="h-9 text-xs font-bold uppercase text-white bg-blue-600 hover:bg-blue-700"
                                         >
                                             Continue →
                                         </Button>
                                    )}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            <div className="space-y-2">
                                <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Date</Label>
                                <div className="flex gap-2">
                                    <Button
                                        type="button"
                                        variant={state.date && format(state.date, "yyyy-MM-dd") === todayStr ? "default" : "outline"}
                                        onClick={() => controls.setDate(new Date())}
                                        className="h-9 text-xs flex-1 font-semibold"
                                    >
                                        Today
                                    </Button>
                                    <Button
                                        type="button"
                                        variant={state.date && format(state.date, "yyyy-MM-dd") === yesterdayStr ? "default" : "outline"}
                                        onClick={() => {
                                            const d = new Date();
                                            d.setDate(d.getDate() - 1);
                                            controls.setDate(d);
                                        }}
                                        className="h-9 text-xs flex-1 font-semibold"
                                    >
                                        Yesterday
                                    </Button>
                                    <Popover>
                                        <PopoverTrigger asChild>
                                            <Button variant="outline" className="h-9 text-xs flex-1 font-semibold justify-start text-left">
                                                <CalendarIcon className="mr-2 h-3.5 w-3.5 text-blue-500" />
                                                {state.date ? format(state.date, "MMM dd, yyyy") : "Pick Date..."}
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0 z-50">
                                            <Calendar mode="single" selected={state.date} onSelect={controls.setDate} />
                                        </PopoverContent>
                                    </Popover>
                                </div>
                            </div>
                            {isReturn && (
                                <ReturnReasonSection 
                                    reason={state.reason} onReasonChange={controls.setReason}
                                    customReason={state.customReason} onCustomReasonChange={controls.setCustomReason}
                                />
                            )}
                            <div className="space-y-1.5">
                                <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Comments</Label>
                                <Textarea 
                                    value={state.comment} 
                                    onChange={e => controls.setComment(e.target.value)} 
                                    rows={3} 
                                    placeholder="Add notes..."
                                    className="text-xs" 
                                />
                            </div>
                        </div>
                    )}
                </div>
                {!useExtendedView && (
                    <div className="p-5 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/20 shrink-0 flex gap-2 shadow-[0_-8px_20px_rgba(0,0,0,.05)]">
                        <Button variant="outline" className="flex-1 h-9 text-xs" onClick={onClose}>Cancel</Button>
                        <Button onClick={controls.confirm} className="flex-1 h-9 text-xs bg-slate-900 dark:bg-slate-800 text-white font-bold uppercase hover:bg-slate-800 dark:hover:bg-slate-700">{isComplete ? "Finalize" : isReturn ? "Return" : "Save"}</Button>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}

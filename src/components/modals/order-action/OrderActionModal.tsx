"use client";

import React, { useMemo, useState } from "react";
import { format } from "date-fns";
import { CalendarIcon, X, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

import { useOrderAction } from "./useOrderAction";
import { OrderSheetMode } from "./OrderSheetMode";
import { ReturnReasonSection } from "./ReturnReasonSection";
import { OrderActionData, Contractor, InventoryItem, OrderCompletionData } from "./types";

interface OrderActionModalProps {
    isOpen: boolean;
    onClose: () => void;
    title?: string;
    actionType?: 'complete' | 'return';
    isComplete?: boolean;
    isReturn?: boolean;
    showExtendedFields?: boolean;
    orderData?: OrderActionData;
    contractors?: Contractor[];
    items?: InventoryItem[];
    onConfirm: (data: OrderCompletionData) => void;
    requiresIPTV?: boolean;
    materialSource?: string;
    itemSortOrder?: string[];
    categoryOrder?: string[];
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
    itemSortOrder = [],
    categoryOrder = []
}: OrderActionModalProps) {
    const [showSuccess, setShowSuccess] = useState(false);
    const [completedData, setCompletedData] = useState<OrderCompletionData | null>(null);

    const handleHookConfirm = (data: OrderCompletionData) => {
        setCompletedData(data);
        setShowSuccess(true);
    };

    // Filter & Sort Items Logic based on Admin Settings Category Order
    const filteredItems = useMemo(() => {
        if (!items) return [];
        const result = [...items];
        
        if (categoryOrder && categoryOrder.length > 0) {
            result.sort((a, b) => {
                const catA = a.commonName || a.name;
                const catB = b.commonName || b.name;
                const indexA = categoryOrder.indexOf(catA);
                const indexB = categoryOrder.indexOf(catB);
                if (indexA !== -1 && indexB !== -1) return indexA - indexB;
                if (indexA !== -1) return -1;
                if (indexB !== -1) return 1;
                return 0;
            });
        } else if (itemSortOrder && itemSortOrder.length > 0) {
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
    }, [items, itemSortOrder, categoryOrder]);

    const { state, controls } = useOrderAction(isOpen, orderData, filteredItems, materialSource, handleHookConfirm);

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

    const drawerWidth = useExtendedView ? "sm:max-w-4xl md:max-w-5xl" : "sm:max-w-md";
    const todayStr = useMemo(() => format(new Date(), "yyyy-MM-dd"), []);
    const yesterdayStr = useMemo(() => {
        const d = new Date();
        d.setDate(d.getDate() - 1);
        return format(d, "yyyy-MM-dd");
    }, []);

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
                        <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400 ring-8 ring-emerald-50 dark:ring-emerald-950">
                            <CheckCircle2 className="w-10 h-10 animate-bounce" />
                        </div>
                        <div className="space-y-2">
                            <h2 className="text-xl font-extrabold text-slate-900 dark:text-white tracking-tight">Order Completed Successfully</h2>
                            <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 py-1 px-3 rounded-full inline-block font-mono border border-emerald-200 dark:border-emerald-800">
                                SO-NUM: {orderData?.soNum || 'N/A'}
                            </p>
                            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Materials inventory counts have been updated. Managers have been notified of this completion.</p>
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
                                className="flex-1 h-10 text-xs font-bold bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 text-white"
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
                    "fixed !inset-y-0 !right-0 !top-0 !left-auto !translate-x-0 !translate-y-0 !h-full flex flex-col !p-0 !gap-0 overflow-hidden bg-white dark:bg-slate-950 border-l border-slate-200 dark:border-slate-800 shadow-xl z-50 duration-300 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right !rounded-none text-foreground w-full transition-all",
                    drawerWidth
                )}
            >
                {/* Header with Title and Order Badges */}
                <div className="relative p-6 pb-4 flex-shrink-0 bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
                    <div className="absolute top-4 right-4 z-10 flex items-center gap-3">
                        <button 
                            type="button"
                            onClick={onClose} 
                            className="p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                    
                    <div className="flex flex-col gap-1.5 mr-16">
                        <div className="flex items-center gap-2">
                            <span className="px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider bg-blue-600 text-white rounded-md font-mono">
                                {orderData?.soNum || 'SERVICE ORDER'}
                            </span>
                            {orderData?.sltsStatus && (
                                <span className="px-2 py-0.5 text-[10px] font-bold uppercase rounded border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800">
                                    {orderData.sltsStatus}
                                </span>
                            )}
                        </div>
                        <DialogTitle className="text-lg font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                            {orderData?.sltsStatus === 'COMPLETED' ? `Update Complete Order` : title}
                        </DialogTitle>
                    </div>
                </div>

                {/* Render Sheet Mode for Extended View or Return Form */}
                {useExtendedView ? (
                    <OrderSheetMode 
                        orderData={orderData}
                        state={state}
                        controls={controls}
                        contractors={contractors}
                        filteredItems={filteredItems}
                        quickItems={quickItems}
                        requiresIPTV={requiresIPTV}
                        materialSource={materialSource}
                        onClose={onClose}
                    />
                ) : (
                    <div className="p-6 space-y-6 flex-1 overflow-y-auto">
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
                                className="text-xs bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800" 
                            />
                        </div>

                        <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-2">
                            <Button variant="outline" onClick={onClose} className="h-9 text-xs font-bold">
                                Cancel
                            </Button>
                            <Button onClick={controls.confirm} className="h-9 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white">
                                Confirm
                            </Button>
                        </div>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}

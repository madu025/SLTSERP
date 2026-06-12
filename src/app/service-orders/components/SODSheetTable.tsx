"use client";

import React, { useState, useMemo } from "react";
import { ServiceOrder } from "@/types/service-order";
import { Contractor } from "@/components/modals/order-action/types";
import { Info, MessageSquare, CheckCircle2, Loader2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SODSheetTableProps {
    orders: ServiceOrder[];
    filterType: "pending" | "completed" | "return";
    contractors: Contractor[];
    selectedIds: Set<string>;
    toggleSelect: (id: string) => void;
    toggleAll: () => void;
    isAllSelected: boolean;
    onSort: (key: keyof ServiceOrder) => void;
    sortConfig: { key: keyof ServiceOrder; direction: "asc" | "desc" } | null;
    onUpdateField: (id: string, data: Record<string, unknown>) => Promise<unknown>;
    onOpenModal: (order: ServiceOrder, type: "detail" | "schedule" | "comment" | "action") => void;
}

export function SODSheetTable(props: SODSheetTableProps) {
    const {
        orders,
        filterType,
        contractors,
        selectedIds,
        onSort,
        sortConfig,
        onUpdateField,
        onOpenModal
    } = props;
    // Map to keep track of saving states per cell (key: "orderId-fieldName")
    const [savingStates, setSavingStates] = useState<Record<string, "saving" | "saved" | "error" | null>>({});
    const [columnFilters, setColumnFilters] = useState<Record<string, string>>({});

    const filteredAndSortedOrders = useMemo(() => {
        let result = [...orders];

        for (const [key, filterValue] of Object.entries(columnFilters)) {
            if (!filterValue) continue;
            
            const lowerFilter = filterValue.toLowerCase();
            result = result.filter(order => {
                if (key === "contractorId") {
                    return order.contractorId === filterValue;
                }
                if (key === "sltsStatus") {
                    return order.sltsStatus === filterValue;
                }
                if (key === "completedDate") {
                    const dateStr = order.completedDate ? new Date(order.completedDate).toLocaleDateString("en-GB") : "";
                    return dateStr.includes(filterValue);
                }
                if (key === "statusDate") {
                    const dateStr = order.statusDate ? new Date(order.statusDate).toLocaleDateString("en-GB") : "";
                    return dateStr.includes(filterValue);
                }
                if (key === "scheduledDate") {
                    const dateStr = order.scheduledDate ? new Date(order.scheduledDate).toLocaleDateString("en-GB") : "";
                    return dateStr.includes(filterValue);
                }
                if (key === "returnReason") {
                    const reason = order.returnReason || order.status || "";
                    return reason.toLowerCase().includes(lowerFilter);
                }
                if (key === "customerName") {
                    const nameMatch = order.customerName?.toLowerCase().includes(lowerFilter) || false;
                    const addressMatch = order.address?.toLowerCase().includes(lowerFilter) || false;
                    return nameMatch || addressMatch;
                }
                
                const val = order[key as keyof ServiceOrder];
                if (val === null || val === undefined) return false;
                return String(val).toLowerCase().includes(lowerFilter);
            });
        }

        if (sortConfig) {
            const { key, direction } = sortConfig;
            result.sort((a, b) => {
                let aVal = a[key];
                let bVal = b[key];

                if (aVal === null || aVal === undefined) aVal = "";
                if (bVal === null || bVal === undefined) bVal = "";

                if (typeof aVal === "number" && typeof bVal === "number") {
                    return direction === "asc" ? aVal - bVal : bVal - aVal;
                }

                const aStr = String(aVal);
                const bStr = String(bVal);
                return direction === "asc"
                    ? aStr.localeCompare(bStr, undefined, { numeric: true, sensitivity: "base" })
                    : bStr.localeCompare(aStr, undefined, { numeric: true, sensitivity: "base" });
            });
        }

        return result;
    }, [orders, columnFilters, sortConfig]);

    const handleSaveField = async (orderId: string, fieldName: string, value: unknown) => {
        const cellKey = `${orderId}-${fieldName}`;
        
        // Find existing order to verify if the value actually changed
        const order = orders.find(o => o.id === orderId);
        if (order) {
            const currentValue = order[fieldName as keyof ServiceOrder];
            // Normalize values for comparison
            const normCurrent = currentValue === null || currentValue === undefined ? "" : String(currentValue);
            const normNew = value === null || value === undefined ? "" : String(value);
            if (normCurrent === normNew) return; // Skip saving if value is identical
        }

        setSavingStates(prev => ({ ...prev, [cellKey]: "saving" }));
        
        try {
            const payload: Record<string, unknown> = { id: orderId };
            
            // Map specific fields if needed
            if (fieldName === "scheduledDate") {
                payload.scheduledDate = value ? new Date(value as string).toISOString() : null;
            } else if (fieldName === "completedDate") {
                payload.completedDate = value ? new Date(value as string).toISOString() : null;
            } else {
                payload[fieldName] = value === "" ? null : value;
            }

            await onUpdateField(orderId, payload);
            
            setSavingStates(prev => ({ ...prev, [cellKey]: "saved" }));
            setTimeout(() => {
                setSavingStates(prev => ({ ...prev, [cellKey]: null }));
            }, 1500);
        } catch (error) {
            console.error("Error auto-saving field:", error);
            setSavingStates(prev => ({ ...prev, [cellKey]: "error" }));
        }
    };

    const handleKeyDown = (
        e: React.KeyboardEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
        rowIndex: number,
        field: string
    ) => {
        // Stop default browser behavior if navigating
        if (e.key === "ArrowDown") {
            e.preventDefault();
            const nextInput = document.querySelector(`[data-row-index="${rowIndex + 1}"][data-field="${field}"]`) as HTMLElement;
            if (nextInput) nextInput.focus();
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            const prevInput = document.querySelector(`[data-row-index="${rowIndex - 1}"][data-field="${field}"]`) as HTMLElement;
            if (prevInput) prevInput.focus();
        } else if (e.key === "Enter") {
            // Only submit on Enter if it's not a multiline textarea, or if Shift+Enter is not used
            e.preventDefault();
            (e.target as HTMLElement).blur(); // trigger auto-save
            const nextInput = document.querySelector(`[data-row-index="${rowIndex + 1}"][data-field="${field}"]`) as HTMLElement;
            if (nextInput) nextInput.focus();
        }
    };

    // Helper to render inline save state indicators
    const renderCellStatus = (orderId: string, fieldName: string) => {
        const state = savingStates[`${orderId}-${fieldName}`];
        if (state === "saving") {
            return <Loader2 className="w-2.5 h-2.5 text-primary animate-spin absolute right-1.5 top-1/2 -translate-y-1/2 opacity-75" />;
        }
        if (state === "saved") {
            return <Check className="w-2.5 h-2.5 text-emerald-400 absolute right-1.5 top-1/2 -translate-y-1/2" />;
        }
        if (state === "error") {
            return <span className="text-[7px] text-rose-500 font-bold absolute right-1.5 top-1/2 -translate-y-1/2">ERR</span>;
        }
        return null;
    };

    // Style helper for inputs in Sheet Mode
    const cellInputClass = "w-full h-full bg-transparent border-none focus:outline-none focus:ring-1 focus:ring-blue-500/80 focus:bg-background/90 px-1 py-1 text-[10px] font-mono text-foreground rounded transition-all placeholder:opacity-35";

    const getStatusColorClass = (status: string | null | undefined) => {
        const s = status ? status.toUpperCase() : '';
        if (s.includes('COMPLETED') || s.includes('CLOSED') || s.includes('SUCCESS') || s.includes('PASSED')) {
            return 'bg-emerald-50 text-emerald-700 border-emerald-200/50 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20';
        }
        if (s.includes('RETURN') || s.includes('REJECT') || s.includes('FAIL') || s.includes('ISSUE')) {
            return 'bg-rose-50 text-rose-700 border-rose-200/50 dark:bg-rose-500/10 dark:text-rose-400 dark:border-rose-500/20';
        }
        if (s.includes('PROGRESS') || s.includes('ASSIGN') || s.includes('CONSTRUCT')) {
            return 'bg-amber-50 text-amber-700 border-amber-200/50 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20';
        }
        return 'bg-blue-50 text-blue-700 border-blue-200/50 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20';
    };

    return (
        <div className="w-full h-full overflow-auto border-t border-border/20 custom-scrollbar">
            <table className="w-full border-collapse text-left table-fixed">
                <thead className="bg-muted/80 border-b border-border/40 sticky top-0 z-40 backdrop-blur-md">
                    <tr className="text-muted-foreground font-black uppercase tracking-tight text-[9px]">
                        <th className="w-[100px] px-2 py-1.5 border-r border-border/20 md:sticky md:left-0 bg-muted/90 z-50">
                            <div className="flex flex-col gap-1">
                                <div className="flex items-center justify-between cursor-pointer hover:text-foreground transition-colors" onClick={() => onSort("soNum")}>
                                    <span>SO Number</span>
                                    {sortConfig?.key === "soNum" && (sortConfig.direction === "asc" ? "▲" : "▼")}
                                </div>
                                <input
                                    type="text"
                                    placeholder="Filter..."
                                    value={columnFilters.soNum || ""}
                                    onChange={(e) => setColumnFilters(prev => ({ ...prev, soNum: e.target.value }))}
                                    onClick={(e) => e.stopPropagation()}
                                    className="h-5 px-1 py-0.5 text-[8.5px] w-full bg-background border border-border/40 rounded focus:border-primary focus:outline-none placeholder:opacity-50 font-mono font-normal text-foreground"
                                />
                            </div>
                        </th>
                                             {/* Dynamic columns based on filterType */}
                        {filterType === "completed" ? (
                            <>
                                <th className="w-[95px] px-2 py-1.5 border-r border-border/20 text-emerald-450 dark:text-emerald-400">
                                    <div className="flex flex-col gap-1">
                                        <div className="flex items-center justify-between cursor-pointer hover:text-foreground transition-colors" onClick={() => onSort("completedDate")}>
                                            <span>Completed Date</span>
                                            {sortConfig?.key === "completedDate" && (sortConfig.direction === "asc" ? "▲" : "▼")}
                                        </div>
                                        <input
                                            type="text"
                                            placeholder="DD/MM/YYYY"
                                            value={columnFilters.completedDate || ""}
                                            onChange={(e) => setColumnFilters(prev => ({ ...prev, completedDate: e.target.value }))}
                                            onClick={(e) => e.stopPropagation()}
                                            className="h-5 px-1 py-0.5 text-[8.5px] w-full bg-background border border-border/40 rounded focus:border-primary focus:outline-none placeholder:opacity-50 font-mono font-normal text-foreground"
                                        />
                                    </div>
                                </th>
                                <th className="w-[220px] px-2 py-1.5 border-r border-border/20">
                                    <div className="flex flex-col gap-1">
                                        <div className="flex items-center justify-between cursor-pointer hover:text-foreground transition-colors" onClick={() => onSort("customerName")}>
                                            <span>Customer Details</span>
                                            {sortConfig?.key === "customerName" && (sortConfig.direction === "asc" ? "▲" : "▼")}
                                        </div>
                                        <input
                                            type="text"
                                            placeholder="Filter name or address..."
                                            value={columnFilters.customerName || ""}
                                            onChange={(e) => setColumnFilters(prev => ({ ...prev, customerName: e.target.value }))}
                                            onClick={(e) => e.stopPropagation()}
                                            className="h-5 px-1 py-0.5 text-[8.5px] w-full bg-background border border-border/40 rounded focus:border-primary focus:outline-none placeholder:opacity-50 font-sans font-normal text-foreground"
                                        />
                                    </div>
                                </th>
                                <th className="w-[105px] px-2 py-1.5 border-r border-border/20">
                                    <div className="flex flex-col gap-1">
                                        <div className="flex items-center justify-between cursor-pointer hover:text-foreground transition-colors" onClick={() => onSort("voiceNumber")}>
                                            <span>Voice Number</span>
                                            {sortConfig?.key === "voiceNumber" && (sortConfig.direction === "asc" ? "▲" : "▼")}
                                        </div>
                                        <input
                                            type="text"
                                            placeholder="Filter..."
                                            value={columnFilters.voiceNumber || ""}
                                            onChange={(e) => setColumnFilters(prev => ({ ...prev, voiceNumber: e.target.value }))}
                                            onClick={(e) => e.stopPropagation()}
                                            className="h-5 px-1 py-0.5 text-[8.5px] w-full bg-background border border-border/40 rounded focus:border-primary focus:outline-none placeholder:opacity-50 font-mono font-normal text-foreground"
                                        />
                                    </div>
                                </th>
                                <th className="w-[110px] px-2 py-1.5 border-r border-border/20">
                                    <div className="flex flex-col gap-1">
                                        <div className="flex items-center justify-between cursor-pointer hover:text-foreground transition-colors" onClick={() => onSort("ontSerialNumber")}>
                                            <span>ONT Serial</span>
                                            {sortConfig?.key === "ontSerialNumber" && (sortConfig.direction === "asc" ? "▲" : "▼")}
                                        </div>
                                        <input
                                            type="text"
                                            placeholder="Filter serial..."
                                            value={columnFilters.ontSerialNumber || ""}
                                            onChange={(e) => setColumnFilters(prev => ({ ...prev, ontSerialNumber: e.target.value }))}
                                            onClick={(e) => e.stopPropagation()}
                                            className="h-5 px-1 py-0.5 text-[8.5px] w-full bg-background border border-border/40 rounded focus:border-primary focus:outline-none placeholder:opacity-50 font-mono font-normal text-foreground"
                                        />
                                    </div>
                                </th>
                                <th className="w-[135px] px-2 py-1.5 border-r border-border/20">
                                    <div className="flex flex-col gap-1">
                                        <div className="flex items-center justify-between cursor-pointer hover:text-foreground transition-colors" onClick={() => onSort("contractorId")}>
                                            <span>Contractor</span>
                                            {sortConfig?.key === "contractorId" && (sortConfig.direction === "asc" ? "▲" : "▼")}
                                        </div>
                                        <select
                                            value={columnFilters.contractorId || ""}
                                            onChange={(e) => setColumnFilters(prev => ({ ...prev, contractorId: e.target.value }))}
                                            onClick={(e) => e.stopPropagation()}
                                            className="h-5 px-1 py-0 text-[8.5px] w-full bg-background border border-border/40 rounded focus:border-primary focus:outline-none font-sans font-normal text-foreground"
                                        >
                                            <option value="">All Teams</option>
                                            {contractors.map((c) => (
                                                <option key={c.id} value={c.id}>
                                                    {c.name}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                </th>
                                <th className="w-[130px] px-2 py-1.5 border-r border-border/20">
                                    <div className="flex flex-col gap-1">
                                        <div className="flex items-center justify-between cursor-pointer hover:text-foreground transition-colors" onClick={() => onSort("status")}>
                                            <span>Status</span>
                                            {sortConfig?.key === "status" && (sortConfig.direction === "asc" ? "▲" : "▼")}
                                        </div>
                                        <input
                                            type="text"
                                            placeholder="Filter..."
                                            value={columnFilters.status || ""}
                                            onChange={(e) => setColumnFilters(prev => ({ ...prev, status: e.target.value }))}
                                            onClick={(e) => e.stopPropagation()}
                                            className="h-5 px-1 py-0.5 text-[8.5px] w-full bg-background border border-border/40 rounded focus:border-primary focus:outline-none placeholder:opacity-50 font-sans font-normal text-foreground"
                                        />
                                    </div>
                                </th>
                                <th className="w-[150px] px-2 py-1.5 border-r border-border/20">
                                    <div className="flex flex-col gap-1">
                                        <div className="flex items-center justify-between cursor-pointer hover:text-foreground transition-colors" onClick={() => onSort("comments")}>
                                            <span>Comments/Notes</span>
                                            {sortConfig?.key === "comments" && (sortConfig.direction === "asc" ? "▲" : "▼")}
                                        </div>
                                        <input
                                            type="text"
                                            placeholder="Filter comments..."
                                            value={columnFilters.comments || ""}
                                            onChange={(e) => setColumnFilters(prev => ({ ...prev, comments: e.target.value }))}
                                            onClick={(e) => e.stopPropagation()}
                                            className="h-5 px-1 py-0.5 text-[8.5px] w-full bg-background border border-border/40 rounded focus:border-primary focus:outline-none placeholder:opacity-50 font-sans font-normal text-foreground"
                                        />
                                    </div>
                                </th>
                            </>
                        ) : filterType === "return" ? (
                            <>
                                <th className="w-[95px] px-2 py-1.5 border-r border-border/20 text-rose-455 dark:text-rose-400">
                                    <div className="flex flex-col gap-1">
                                        <div className="flex items-center justify-between cursor-pointer hover:text-foreground transition-colors" onClick={() => onSort("completedDate")}>
                                            <span>Return Date</span>
                                            {sortConfig?.key === "completedDate" && (sortConfig.direction === "asc" ? "▲" : "▼")}
                                        </div>
                                        <input
                                            type="text"
                                            placeholder="DD/MM/YYYY"
                                            value={columnFilters.completedDate || ""}
                                            onChange={(e) => setColumnFilters(prev => ({ ...prev, completedDate: e.target.value }))}
                                            onClick={(e) => e.stopPropagation()}
                                            className="h-5 px-1 py-0.5 text-[8.5px] w-full bg-background border border-border/40 rounded focus:border-primary focus:outline-none placeholder:opacity-50 font-mono font-normal text-foreground"
                                        />
                                    </div>
                                </th>
                                <th className="w-[220px] px-2 py-1.5 border-r border-border/20">
                                    <div className="flex flex-col gap-1">
                                        <div className="flex items-center justify-between cursor-pointer hover:text-foreground transition-colors" onClick={() => onSort("customerName")}>
                                            <span>Customer Details</span>
                                            {sortConfig?.key === "customerName" && (sortConfig.direction === "asc" ? "▲" : "▼")}
                                        </div>
                                        <input
                                            type="text"
                                            placeholder="Filter name or address..."
                                            value={columnFilters.customerName || ""}
                                            onChange={(e) => setColumnFilters(prev => ({ ...prev, customerName: e.target.value }))}
                                            onClick={(e) => e.stopPropagation()}
                                            className="h-5 px-1 py-0.5 text-[8.5px] w-full bg-background border border-border/40 rounded focus:border-primary focus:outline-none placeholder:opacity-50 font-sans font-normal text-foreground"
                                        />
                                    </div>
                                </th>
                                <th className="w-[105px] px-2 py-1.5 border-r border-border/20">
                                    <div className="flex flex-col gap-1">
                                        <div className="flex items-center justify-between cursor-pointer hover:text-foreground transition-colors" onClick={() => onSort("voiceNumber")}>
                                            <span>Voice Number</span>
                                            {sortConfig?.key === "voiceNumber" && (sortConfig.direction === "asc" ? "▲" : "▼")}
                                        </div>
                                        <input
                                            type="text"
                                            placeholder="Filter..."
                                            value={columnFilters.voiceNumber || ""}
                                            onChange={(e) => setColumnFilters(prev => ({ ...prev, voiceNumber: e.target.value }))}
                                            onClick={(e) => e.stopPropagation()}
                                            className="h-5 px-1 py-0.5 text-[8.5px] w-full bg-background border border-border/40 rounded focus:border-primary focus:outline-none placeholder:opacity-50 font-mono font-normal text-foreground"
                                        />
                                    </div>
                                </th>
                                <th className="w-[135px] px-2 py-1.5 border-r border-border/20">
                                    <div className="flex flex-col gap-1">
                                        <div className="flex items-center justify-between cursor-pointer hover:text-foreground transition-colors" onClick={() => onSort("contractorId")}>
                                            <span>Contractor</span>
                                            {sortConfig?.key === "contractorId" && (sortConfig.direction === "asc" ? "▲" : "▼")}
                                        </div>
                                        <select
                                            value={columnFilters.contractorId || ""}
                                            onChange={(e) => setColumnFilters(prev => ({ ...prev, contractorId: e.target.value }))}
                                            onClick={(e) => e.stopPropagation()}
                                            className="h-5 px-1 py-0 text-[8.5px] w-full bg-background border border-border/40 rounded focus:border-primary focus:outline-none font-sans font-normal text-foreground"
                                        >
                                            <option value="">All Teams</option>
                                            {contractors.map((c) => (
                                                <option key={c.id} value={c.id}>
                                                    {c.name}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                </th>
                                <th className="w-[130px] px-2 py-1.5 border-r border-border/20">
                                    <div className="flex flex-col gap-1">
                                        <div className="flex items-center justify-between cursor-pointer hover:text-foreground transition-colors" onClick={() => onSort("sltsStatus")}>
                                            <span>Status</span>
                                            {sortConfig?.key === "sltsStatus" && (sortConfig.direction === "asc" ? "▲" : "▼")}
                                        </div>
                                        <select
                                            value={columnFilters.sltsStatus || ""}
                                            onChange={(e) => setColumnFilters(prev => ({ ...prev, sltsStatus: e.target.value }))}
                                            onClick={(e) => e.stopPropagation()}
                                            className="h-5 px-1 py-0 text-[8.5px] w-full bg-background border border-border/40 rounded focus:border-primary focus:outline-none font-sans font-normal text-foreground"
                                        >
                                            <option value="">All</option>
                                            <option value="RETURN">RETURN</option>
                                            <option value="INPROGRESS">IN PROGRESS</option>
                                            <option value="COMPLETED">COMPLETED</option>
                                        </select>
                                    </div>
                                </th>
                                <th className="w-[140px] px-2 py-1.5 border-r border-border/20">
                                    <div className="flex flex-col gap-1">
                                        <div className="flex items-center justify-between cursor-pointer hover:text-foreground transition-colors" onClick={() => onSort("returnReason")}>
                                            <span>Return Reason</span>
                                            {sortConfig?.key === "returnReason" && (sortConfig.direction === "asc" ? "▲" : "▼")}
                                        </div>
                                        <input
                                            type="text"
                                            placeholder="Filter reasons..."
                                            value={columnFilters.returnReason || ""}
                                            onChange={(e) => setColumnFilters(prev => ({ ...prev, returnReason: e.target.value }))}
                                            onClick={(e) => e.stopPropagation()}
                                            className="h-5 px-1 py-0.5 text-[8.5px] w-full bg-background border border-border/40 rounded focus:border-primary focus:outline-none placeholder:opacity-50 font-sans font-normal text-foreground"
                                        />
                                    </div>
                                </th>
                                <th className="w-[150px] px-2 py-1.5 border-r border-border/20">
                                    <div className="flex flex-col gap-1">
                                        <div className="flex items-center justify-between cursor-pointer hover:text-foreground transition-colors" onClick={() => onSort("comments")}>
                                            <span>Comments/Notes</span>
                                            {sortConfig?.key === "comments" && (sortConfig.direction === "asc" ? "▲" : "▼")}
                                        </div>
                                        <input
                                            type="text"
                                            placeholder="Filter comments..."
                                            value={columnFilters.comments || ""}
                                            onChange={(e) => setColumnFilters(prev => ({ ...prev, comments: e.target.value }))}
                                            onClick={(e) => e.stopPropagation()}
                                            className="h-5 px-1 py-0.5 text-[8.5px] w-full bg-background border border-border/40 rounded focus:border-primary focus:outline-none placeholder:opacity-50 font-sans font-normal text-foreground"
                                        />
                                    </div>
                                </th>
                            </>
                        ) : (
                            // PENDING (Dispatcher Grid)
                            <>
                                <th className="w-[220px] px-2 py-1.5 border-r border-border/20">
                                    <div className="flex flex-col gap-1">
                                        <div className="flex items-center justify-between cursor-pointer hover:text-foreground transition-colors" onClick={() => onSort("customerName")}>
                                            <span>Customer Details</span>
                                            {sortConfig?.key === "customerName" && (sortConfig.direction === "asc" ? "▲" : "▼")}
                                        </div>
                                        <input
                                            type="text"
                                            placeholder="Filter name or address..."
                                            value={columnFilters.customerName || ""}
                                            onChange={(e) => setColumnFilters(prev => ({ ...prev, customerName: e.target.value }))}
                                            onClick={(e) => e.stopPropagation()}
                                            className="h-5 px-1 py-0.5 text-[8.5px] w-full bg-background border border-border/40 rounded focus:border-primary focus:outline-none placeholder:opacity-50 font-sans font-normal text-foreground"
                                        />
                                    </div>
                                </th>
                                <th className="w-[105px] px-2 py-1.5 border-r border-border/20">
                                    <div className="flex flex-col gap-1">
                                        <div className="flex items-center justify-between cursor-pointer hover:text-foreground transition-colors" onClick={() => onSort("voiceNumber")}>
                                            <span>Voice/TP Number</span>
                                            {sortConfig?.key === "voiceNumber" && (sortConfig.direction === "asc" ? "▲" : "▼")}
                                        </div>
                                        <input
                                            type="text"
                                            placeholder="Filter..."
                                            value={columnFilters.voiceNumber || ""}
                                            onChange={(e) => setColumnFilters(prev => ({ ...prev, voiceNumber: e.target.value }))}
                                            onClick={(e) => e.stopPropagation()}
                                            className="h-5 px-1 py-0.5 text-[8.5px] w-full bg-background border border-border/40 rounded focus:border-primary focus:outline-none placeholder:opacity-50 font-mono font-normal text-foreground"
                                        />
                                    </div>
                                </th>
                                <th className="w-[70px] px-2 py-1.5 border-r border-border/20">
                                    <div className="flex flex-col gap-1">
                                        <div className="flex items-center justify-between cursor-pointer hover:text-foreground transition-colors" onClick={() => onSort("dp")}>
                                            <span>DP</span>
                                            {sortConfig?.key === "dp" && (sortConfig.direction === "asc" ? "▲" : "▼")}
                                        </div>
                                        <input
                                            type="text"
                                            placeholder="Filter..."
                                            value={columnFilters.dp || ""}
                                            onChange={(e) => setColumnFilters(prev => ({ ...prev, dp: e.target.value }))}
                                            onClick={(e) => e.stopPropagation()}
                                            className="h-5 px-1 py-0.5 text-[8.5px] w-full bg-background border border-border/40 rounded focus:border-primary focus:outline-none placeholder:opacity-50 font-mono font-normal text-foreground"
                                        />
                                    </div>
                                </th>
                                <th className="w-[135px] px-2 py-1.5 border-r border-border/20">
                                    <div className="flex flex-col gap-1">
                                        <div className="flex items-center justify-between cursor-pointer hover:text-foreground transition-colors" onClick={() => onSort("contractorId")}>
                                            <span>Contractor</span>
                                            {sortConfig?.key === "contractorId" && (sortConfig.direction === "asc" ? "▲" : "▼")}
                                        </div>
                                        <select
                                            value={columnFilters.contractorId || ""}
                                            onChange={(e) => setColumnFilters(prev => ({ ...prev, contractorId: e.target.value }))}
                                            onClick={(e) => e.stopPropagation()}
                                            className="h-5 px-1 py-0 text-[8.5px] w-full bg-background border border-border/40 rounded focus:border-primary focus:outline-none font-sans font-normal text-foreground"
                                        >
                                            <option value="">All Teams</option>
                                            {contractors.map((c) => (
                                                <option key={c.id} value={c.id}>
                                                    {c.name}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                </th>
                                <th className="w-[130px] px-2 py-1.5 border-r border-border/20">
                                    <div className="flex flex-col gap-1">
                                        <div className="flex items-center justify-between cursor-pointer hover:text-foreground transition-colors" onClick={() => onSort("sltsStatus")}>
                                            <span>SLTS Status</span>
                                            {sortConfig?.key === "sltsStatus" && (sortConfig.direction === "asc" ? "▲" : "▼")}
                                        </div>
                                        <select
                                            value={columnFilters.sltsStatus || ""}
                                            onChange={(e) => setColumnFilters(prev => ({ ...prev, sltsStatus: e.target.value }))}
                                            onClick={(e) => e.stopPropagation()}
                                            className="h-5 px-1 py-0 text-[8.5px] w-full bg-background border border-border/40 rounded focus:border-primary focus:outline-none font-sans font-normal text-foreground"
                                        >
                                            <option value="">All</option>
                                            <option value="PENDING">PENDING</option>
                                            <option value="ASSIGNED">ASSIGNED</option>
                                            <option value="INPROGRESS">IN PROGRESS</option>
                                            <option value="COMPLETED">COMPLETED</option>
                                            <option value="RETURN">RETURN</option>
                                        </select>
                                    </div>
                                </th>
                                <th className="w-[115px] px-2 py-1.5 border-r border-border/20">
                                    <div className="flex flex-col gap-1">
                                        <div className="flex items-center justify-between cursor-pointer hover:text-foreground transition-colors" onClick={() => onSort("scheduledDate")}>
                                            <span>Appointment Date</span>
                                            {sortConfig?.key === "scheduledDate" && (sortConfig.direction === "asc" ? "▲" : "▼")}
                                        </div>
                                        <input
                                            type="text"
                                            placeholder="DD/MM/YYYY"
                                            value={columnFilters.scheduledDate || ""}
                                            onChange={(e) => setColumnFilters(prev => ({ ...prev, scheduledDate: e.target.value }))}
                                            onClick={(e) => e.stopPropagation()}
                                            className="h-5 px-1 py-0.5 text-[8.5px] w-full bg-background border border-border/40 rounded focus:border-primary focus:outline-none placeholder:opacity-50 font-mono font-normal text-foreground"
                                        />
                                    </div>
                                </th>
                                <th className="w-[150px] px-2 py-1.5 border-r border-border/20">
                                    <div className="flex flex-col gap-1">
                                        <div className="flex items-center justify-between cursor-pointer hover:text-foreground transition-colors" onClick={() => onSort("comments")}>
                                            <span>Comments/Notes</span>
                                            {sortConfig?.key === "comments" && (sortConfig.direction === "asc" ? "▲" : "▼")}
                                        </div>
                                        <input
                                            type="text"
                                            placeholder="Filter comments..."
                                            value={columnFilters.comments || ""}
                                            onChange={(e) => setColumnFilters(prev => ({ ...prev, comments: e.target.value }))}
                                            onClick={(e) => e.stopPropagation()}
                                            className="h-5 px-1 py-0.5 text-[8.5px] w-full bg-background border border-border/40 rounded focus:border-primary focus:outline-none placeholder:opacity-50 font-sans font-normal text-foreground"
                                        />
                                    </div>
                                </th>
                            </>
                        )}
                        <th className="w-[85px] text-center md:sticky md:right-0 bg-muted/90 z-50">Actions</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-border/25">
                    {filteredAndSortedOrders.length > 0 ? (
                        filteredAndSortedOrders.map((order, index) => (
                            <tr
                                key={order.id}
                                className={`hover:bg-primary/[0.02] dark:hover:bg-primary/[0.04] border-b border-border/10 transition-colors ${
                                    selectedIds.has(order.id) ? "bg-primary/5" : ""
                                }`}
                            >
                                {/* SO Number (Read-only, clickable details) */}
                                <td className="px-2 font-mono font-bold text-[10px] border-r border-border/15 md:sticky md:left-0 bg-card z-20 hover:bg-primary/[0.02] dark:hover:bg-primary/[0.04]">
                                    <div className="flex items-center gap-1">
                                        <button
                                            type="button"
                                            className="text-foreground hover:text-primary transition-colors text-left truncate"
                                            onClick={() => onOpenModal(order, "detail")}
                                            title="View Details"
                                        >
                                            {order.soNum}
                                        </button>
                                        {order.hasBridgeLog && (
                                            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" title="BRIDGE Log Available" />
                                        )}
                                    </div>
                                </td>

                                {/* COMPLETED VIEW */}
                                {filterType === "completed" && (
                                    <>
                                        <td className="px-2 border-r border-border/15 text-[10px] font-bold text-emerald-500 font-mono">
                                            {order.completedDate ? new Date(order.completedDate).toLocaleDateString("en-GB") : "-"}
                                        </td>
                                        <td className="px-2 border-r border-border/15 py-1 text-[10px] text-foreground" title={`${order.customerName || ""} - ${order.address || ""}`}>
                                            <div className="max-w-[210px] flex flex-col gap-0.5">
                                                <span className="font-bold truncate leading-tight">{order.customerName || "-"}</span>
                                                {order.address && <span className="text-muted-foreground font-normal truncate leading-tight">{order.address}</span>}
                                            </div>
                                        </td>
                                        
                                        {/* Voice Number (Read-only) */}
                                        <td className="px-2 border-r border-border/15 text-[10px] font-medium text-foreground truncate" title={order.voiceNumber || ""}>
                                            {order.voiceNumber || "-"}
                                        </td>

                                        {/* ONT Serial */}
                                        <td className="relative border-r border-border/15 p-0">
                                            <input
                                                type="text"
                                                defaultValue={order.ontSerialNumber || ""}
                                                onBlur={(e) => handleSaveField(order.id, "ontSerialNumber", e.target.value)}
                                                onKeyDown={(e) => handleKeyDown(e, index, "ontSerialNumber")}
                                                data-row-index={index}
                                                data-field="ontSerialNumber"
                                                className={cellInputClass}
                                                placeholder="N/A"
                                            />
                                            {renderCellStatus(order.id, "ontSerialNumber")}
                                        </td>

                                        {/* Contractor Select */}
                                        <td className="relative border-r border-border/15 p-0">
                                            <select
                                                value={order.contractorId || ""}
                                                onChange={(e) => handleSaveField(order.id, "contractorId", e.target.value)}
                                                onKeyDown={(e) => handleKeyDown(e, index, "contractorId")}
                                                data-row-index={index}
                                                data-field="contractorId"
                                                className="w-full h-full bg-transparent border-none focus:outline-none focus:ring-1 focus:ring-blue-500/80 focus:bg-background/90 pl-1 pr-6 py-1 text-[10px] font-medium text-foreground"
                                            >
                                                <option value="">Select Team</option>
                                                {contractors.map((c) => (
                                                    <option key={c.id} value={c.id}>
                                                        {c.name}
                                                    </option>
                                                ))}
                                            </select>
                                            {renderCellStatus(order.id, "contractorId")}
                                        </td>

                                        {/* Status (Read-only portal status) */}
                                        <td className="px-2 border-r border-border/15">
                                            <span className={`px-2 py-0.5 rounded-full font-black text-[10px] uppercase border ${getStatusColorClass(order.status)}`}>
                                                {order.status || "-"}
                                            </span>
                                        </td>

                                        {/* Comments */}
                                        <td className="relative border-r border-border/15 p-0 group">
                                            <input
                                                type="text"
                                                defaultValue={order.comments || ""}
                                                onBlur={(e) => handleSaveField(order.id, "comments", e.target.value)}
                                                onKeyDown={(e) => handleKeyDown(e, index, "comments")}
                                                data-row-index={index}
                                                data-field="comments"
                                                className="w-full h-full bg-transparent border-none focus:outline-none focus:ring-1 focus:ring-blue-500/80 focus:bg-background/90 pl-1.5 pr-6 py-1 text-[10px] font-sans text-foreground rounded transition-all placeholder:opacity-35"
                                                placeholder="No comments"
                                            />
                                            {order.comments && order.comments.length > 20 && (
                                                <button
                                                    type="button"
                                                    onClick={() => onOpenModal(order, "comment")}
                                                    className="absolute right-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center p-0.5 bg-background/80 rounded"
                                                    title="View Full Comments"
                                                >
                                                    <Info className="w-3.5 h-3.5 text-blue-400 hover:text-blue-500" />
                                                </button>
                                            )}
                                            {renderCellStatus(order.id, "comments")}
                                        </td>
                                    </>
                                )}

                                {/* RETURN VIEW */}
                                {filterType === "return" && (
                                    <>
                                        <td className="px-2 border-r border-border/15 text-[10px] font-bold text-rose-500 font-mono">
                                            {order.completedDate ? new Date(order.completedDate).toLocaleDateString("en-GB") : order.statusDate ? new Date(order.statusDate).toLocaleDateString("en-GB") : "-"}
                                        </td>
                                        <td className="px-2 border-r border-border/15 py-1 text-[10px] text-foreground" title={`${order.customerName || ""} - ${order.address || ""}`}>
                                            <div className="max-w-[210px] flex flex-col gap-0.5">
                                                <span className="font-bold truncate leading-tight">{order.customerName || "-"}</span>
                                                {order.address && <span className="text-muted-foreground font-normal truncate leading-tight">{order.address}</span>}
                                            </div>
                                        </td>
                                        
                                        {/* Voice Number (Read-only) */}
                                        <td className="px-2 border-r border-border/15 text-[10px] font-medium text-foreground truncate" title={order.voiceNumber || ""}>
                                            {order.voiceNumber || "-"}
                                        </td>

                                        {/* Contractor Select */}
                                        <td className="relative border-r border-border/15 p-0">
                                            <select
                                                value={order.contractorId || ""}
                                                onChange={(e) => handleSaveField(order.id, "contractorId", e.target.value)}
                                                onKeyDown={(e) => handleKeyDown(e, index, "contractorId")}
                                                data-row-index={index}
                                                data-field="contractorId"
                                                className="w-full h-full bg-transparent border-none focus:outline-none focus:ring-1 focus:ring-blue-500/80 focus:bg-background/90 pl-1 pr-6 py-1 text-[10px] font-medium text-foreground"
                                            >
                                                <option value="">Select Team</option>
                                                {contractors.map((c) => (
                                                    <option key={c.id} value={c.id}>
                                                        {c.name}
                                                    </option>
                                                ))}
                                            </select>
                                            {renderCellStatus(order.id, "contractorId")}
                                        </td>

                                        {/* Status Select */}
                                        <td className="relative border-r border-border/15 p-0">
                                            <select
                                                value={order.sltsStatus}
                                                onChange={(e) => handleSaveField(order.id, "sltsStatus", e.target.value)}
                                                onKeyDown={(e) => handleKeyDown(e, index, "sltsStatus")}
                                                data-row-index={index}
                                                data-field="sltsStatus"
                                                className="w-full h-full bg-transparent border-none focus:outline-none focus:ring-1 focus:ring-blue-500/80 focus:bg-background/90 pl-1 pr-6 py-1 text-[10px] font-black text-rose-400"
                                            >
                                                <option value="RETURN">RETURN</option>
                                                <option value="INPROGRESS">IN PROGRESS</option>
                                                <option value="COMPLETED">COMPLETED</option>
                                            </select>
                                            {renderCellStatus(order.id, "sltsStatus")}
                                        </td>

                                        {/* Return Reason (Read only from SLT Portal) */}
                                        <td className="px-2 border-r border-border/15 text-[10px] truncate font-semibold text-rose-500 uppercase" title={order.returnReason || order.status || ""}>
                                            {order.returnReason || order.status || "-"}
                                        </td>

                                        {/* Comments */}
                                        <td className="relative border-r border-border/15 p-0 group">
                                            <input
                                                type="text"
                                                defaultValue={order.comments || ""}
                                                onBlur={(e) => handleSaveField(order.id, "comments", e.target.value)}
                                                onKeyDown={(e) => handleKeyDown(e, index, "comments")}
                                                data-row-index={index}
                                                data-field="comments"
                                                className="w-full h-full bg-transparent border-none focus:outline-none focus:ring-1 focus:ring-blue-500/80 focus:bg-background/90 pl-1.5 pr-6 py-1 text-[10px] font-sans text-foreground rounded transition-all placeholder:opacity-35"
                                                placeholder="No comments"
                                            />
                                            {order.comments && order.comments.length > 20 && (
                                                <button
                                                    type="button"
                                                    onClick={() => onOpenModal(order, "comment")}
                                                    className="absolute right-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center p-0.5 bg-background/80 rounded"
                                                    title="View Full Comments"
                                                >
                                                    <Info className="w-3.5 h-3.5 text-blue-400 hover:text-blue-500" />
                                                </button>
                                            )}
                                            {renderCellStatus(order.id, "comments")}
                                        </td>
                                    </>
                                )}

                                {/* PENDING / DISPATCH VIEW */}
                                {filterType === "pending" && (
                                    <>
                                        {/* Customer Details */}
                                        <td className="px-2 border-r border-border/15 py-1 text-[10px] text-foreground" title={`${order.customerName || ""} - ${order.address || ""}`}>
                                            <div className="max-w-[210px] flex flex-col gap-0.5">
                                                <span className="font-bold truncate leading-tight">{order.customerName || "-"}</span>
                                                {order.address && <span className="text-muted-foreground font-normal truncate leading-tight">{order.address}</span>}
                                            </div>
                                        </td>

                                        {/* Voice/TP Number (Read-only) */}
                                        <td className="px-2 border-r border-border/15 text-[10px] font-medium text-foreground truncate" title={order.voiceNumber || ""}>
                                            {order.voiceNumber || "-"}
                                        </td>

                                        {/* DP */}
                                        <td className="relative border-r border-border/15 p-0">
                                            <input
                                                type="text"
                                                defaultValue={order.dp || ""}
                                                onBlur={(e) => handleSaveField(order.id, "dp", e.target.value)}
                                                onKeyDown={(e) => handleKeyDown(e, index, "dp")}
                                                data-row-index={index}
                                                data-field="dp"
                                                className="w-full h-full bg-transparent border-none focus:outline-none focus:ring-1 focus:ring-blue-500/80 focus:bg-background/90 px-1 py-1 text-[10px] font-mono text-foreground rounded transition-all placeholder:opacity-35"
                                                placeholder="N/A"
                                            />
                                            {renderCellStatus(order.id, "dp")}
                                        </td>

                                        {/* Contractor Dropdown */}
                                        <td className="relative border-r border-border/15 p-0">
                                            <select
                                                value={order.contractorId || ""}
                                                onChange={(e) => handleSaveField(order.id, "contractorId", e.target.value)}
                                                onKeyDown={(e) => handleKeyDown(e, index, "contractorId")}
                                                data-row-index={index}
                                                data-field="contractorId"
                                                className="w-full h-full bg-transparent border-none focus:outline-none focus:ring-1 focus:ring-blue-500/80 focus:bg-background/90 pl-1 pr-6 py-1 text-[10px] font-bold text-blue-400"
                                            >
                                                <option value="">Select Team</option>
                                                {contractors.map((c) => (
                                                    <option key={c.id} value={c.id}>
                                                        {c.name}
                                                    </option>
                                                ))}
                                            </select>
                                            {renderCellStatus(order.id, "contractorId")}
                                        </td>

                                        {/* SLTS Status Dropdown */}
                                        <td className="relative border-r border-border/15 p-0">
                                            <select
                                                value={order.sltsStatus}
                                                onChange={(e) => handleSaveField(order.id, "sltsStatus", e.target.value)}
                                                onKeyDown={(e) => handleKeyDown(e, index, "sltsStatus")}
                                                data-row-index={index}
                                                data-field="sltsStatus"
                                                className={`w-full h-full bg-transparent border-none focus:outline-none focus:ring-1 focus:ring-blue-500/80 focus:bg-background/90 pl-1 pr-6 py-1 text-[10px] font-black ${
                                                    order.sltsStatus === "COMPLETED" ? "text-emerald-400" :
                                                    order.sltsStatus === "RETURN" ? "text-rose-400" : "text-amber-400"
                                                }`}
                                            >
                                                <option value="PENDING">PENDING</option>
                                                <option value="ASSIGNED">ASSIGNED</option>
                                                <option value="INPROGRESS">IN PROGRESS</option>
                                                <option value="COMPLETED">COMPLETED</option>
                                                <option value="RETURN">RETURN</option>
                                            </select>
                                            {renderCellStatus(order.id, "sltsStatus")}
                                        </td>

                                        {/* Appointment Date Inline */}
                                        <td className="relative border-r border-border/15 p-0">
                                            <input
                                                type="date"
                                                defaultValue={order.scheduledDate ? new Date(order.scheduledDate).toISOString().split("T")[0] : ""}
                                                onChange={(e) => handleSaveField(order.id, "scheduledDate", e.target.value)}
                                                onKeyDown={(e) => handleKeyDown(e, index, "scheduledDate")}
                                                data-row-index={index}
                                                data-field="scheduledDate"
                                                className="w-full h-full bg-transparent border-none focus:outline-none focus:ring-1 focus:ring-blue-500/80 focus:bg-background/90 px-1 py-1 text-[10px] font-bold text-foreground font-mono"
                                            />
                                            {renderCellStatus(order.id, "scheduledDate")}
                                        </td>

                                        {/* Comments */}
                                        <td className="relative border-r border-border/15 p-0 group">
                                            <input
                                                type="text"
                                                defaultValue={order.comments || ""}
                                                onBlur={(e) => handleSaveField(order.id, "comments", e.target.value)}
                                                onKeyDown={(e) => handleKeyDown(e, index, "comments")}
                                                data-row-index={index}
                                                data-field="comments"
                                                className="w-full h-full bg-transparent border-none focus:outline-none focus:ring-1 focus:ring-blue-500/80 focus:bg-background/90 pl-1.5 pr-6 py-1 text-[10px] font-sans text-foreground rounded transition-all placeholder:opacity-35"
                                                placeholder="No comments"
                                            />
                                            {order.comments && order.comments.length > 20 && (
                                                <button
                                                    type="button"
                                                    onClick={() => onOpenModal(order, "comment")}
                                                    className="absolute right-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center p-0.5 bg-background/80 rounded"
                                                    title="View Full Comments"
                                                >
                                                    <Info className="w-3.5 h-3.5 text-blue-400 hover:text-blue-500" />
                                                </button>
                                            )}
                                            {renderCellStatus(order.id, "comments")}
                                        </td>
                                    </>
                                )}

                                {/* Sticky Actions column */}
                                <td className="text-center border-l border-border/15 md:sticky md:right-0 bg-card z-20 hover:bg-primary/[0.02] dark:hover:bg-primary/[0.04] shadow-[-2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                                    <div className="flex items-center gap-1 justify-center py-0.5">
                                        <Button
                                            size="icon"
                                            variant="ghost"
                                            className="h-6 w-6"
                                            title="Order Info"
                                            onClick={() => onOpenModal(order, "detail")}
                                        >
                                            <Info className="w-3.5 h-3.5 text-muted-foreground/60" />
                                        </Button>
                                        <Button
                                            size="icon"
                                            variant="ghost"
                                            className={`h-6 w-6 relative ${order.comments ? "bg-amber-500/10" : ""}`}
                                            title="Comments History"
                                            onClick={() => onOpenModal(order, "comment")}
                                        >
                                            <MessageSquare className={`w-3.5 h-3.5 ${order.comments ? "text-amber-400" : "text-muted-foreground/40"}`} />
                                            {order.comments && (
                                                <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-amber-500" />
                                            )}
                                        </Button>
                                        <Button
                                            size="icon"
                                            variant="ghost"
                                            className="h-6 w-6 hover:bg-emerald-500/10"
                                            title="Confirm Completion"
                                            onClick={() => onOpenModal(order, "action")}
                                        >
                                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                                        </Button>
                                    </div>
                                </td>
                            </tr>
                        ))
                    ) : (
                        <tr>
                            <td colSpan={20} className="px-3 py-20 text-center text-muted-foreground text-xs italic">
                                No Service Orders found for the active filters.
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
    );
}

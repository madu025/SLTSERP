"use client";

import React, { useState } from "react";
import { ServiceOrder } from "@/types/service-order";
import { Contractor } from "@/components/modals/order-action/types";
import { Checkbox } from "@/components/ui/checkbox";
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

export function SODSheetTable({
    orders,
    filterType,
    contractors,
    selectedIds,
    toggleSelect,
    toggleAll,
    isAllSelected,
    onSort,
    sortConfig,
    onUpdateField,
    onOpenModal
}: SODSheetTableProps) {
    // Map to keep track of saving states per cell (key: "orderId-fieldName")
    const [savingStates, setSavingStates] = useState<Record<string, "saving" | "saved" | "error" | null>>({});

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
        e: React.KeyboardEvent<HTMLInputElement | HTMLSelectElement>,
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
                    <tr className="text-muted-foreground font-black uppercase tracking-tight text-[9px] h-9">
                        <th className="w-[35px] text-center border-r border-border/20 md:sticky md:left-0 bg-muted/90 z-50">
                            <Checkbox checked={isAllSelected} onCheckedChange={() => toggleAll()} className="border-border/40 data-[state=checked]:bg-primary" />
                        </th>
                        <th className="w-[100px] px-2 border-r border-border/20 md:sticky md:left-[35px] bg-muted/90 z-50 cursor-pointer hover:bg-muted/70" onClick={() => onSort("soNum")}>
                            SO Number {sortConfig?.key === "soNum" && (sortConfig.direction === "asc" ? "▲" : "▼")}
                        </th>
                        
                        {/* Dynamic columns based on filterType */}
                        {filterType === "completed" ? (
                            <>
                                <th className="w-[110px] px-2 border-r border-border/20 text-emerald-400">Completed Date</th>
                                <th className="w-[140px] px-2 border-r border-border/20">Customer Name</th>
                                <th className="w-[90px] px-2 border-r border-border/20">Voice Number</th>
                                <th className="w-[110px] px-2 border-r border-border/20">ONT Serial</th>
                                <th className="w-[60px] px-2 border-r border-border/20">Wire (M)</th>
                                <th className="w-[120px] px-2 border-r border-border/20">Contractor</th>
                                <th className="w-[100px] px-2 border-r border-border/20">Status</th>
                                <th className="w-[160px] px-2 border-r border-border/20">Comments/Notes</th>
                            </>
                        ) : filterType === "return" ? (
                            <>
                                <th className="w-[110px] px-2 border-r border-border/20 text-rose-400">Return Date</th>
                                <th className="w-[130px] px-2 border-r border-border/20">Customer Name</th>
                                <th className="w-[95px] px-2 border-r border-border/20">Voice Number</th>
                                <th className="w-[120px] px-2 border-r border-border/20">Contractor</th>
                                <th className="w-[100px] px-2 border-r border-border/20">Status</th>
                                <th className="w-[180px] px-2 border-r border-border/20">Return Reason</th>
                                <th className="w-[160px] px-2 border-r border-border/20">Comments/Notes</th>
                            </>
                        ) : (
                            // PENDING (Dispatcher Grid)
                            <>
                                <th className="w-[130px] px-2 border-r border-border/20">Customer Name</th>
                                <th className="w-[95px] px-2 border-r border-border/20">Voice/TP Number</th>
                                <th className="w-[60px] px-2 border-r border-border/20">DP</th>
                                <th className="w-[120px] px-2 border-r border-border/20">ONT Serial</th>
                                <th className="w-[100px] px-2 border-r border-border/20">DP Details</th>
                                <th className="w-[60px] px-2 border-r border-border/20">Wire (M)</th>
                                <th className="w-[125px] px-2 border-r border-border/20">Contractor</th>
                                <th className="w-[95px] px-2 border-r border-border/20">SLTS Status</th>
                                <th className="w-[110px] px-2 border-r border-border/20">Appointment Date</th>
                                <th className="w-[160px] px-2 border-r border-border/20">Comments/Notes</th>
                            </>
                        )}
                        <th className="w-[85px] text-center md:sticky md:right-0 bg-muted/90 z-50">Actions</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-border/25">
                    {orders.length > 0 ? (
                        orders.map((order, index) => (
                            <tr
                                key={order.id}
                                className={`h-9 hover:bg-primary/[0.02] dark:hover:bg-primary/[0.04] border-b border-border/10 transition-colors ${
                                    selectedIds.has(order.id) ? "bg-primary/5" : ""
                                }`}
                            >
                                {/* Checkbox column */}
                                <td className="text-center border-r border-border/15 md:sticky md:left-0 bg-card z-20 hover:bg-primary/[0.02] dark:hover:bg-primary/[0.04]">
                                    <Checkbox
                                        checked={selectedIds.has(order.id)}
                                        onCheckedChange={() => toggleSelect(order.id)}
                                        className="border-border/40"
                                    />
                                </td>
                                
                                {/* SO Number (Read-only, clickable details) */}
                                <td className="px-2 font-mono font-bold text-[10.5px] border-r border-border/15 md:sticky md:left-[35px] bg-card z-20 hover:bg-primary/[0.02] dark:hover:bg-primary/[0.04]">
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
                                        <td className="px-2 border-r border-border/15 text-[10.5px] font-bold text-emerald-500 font-mono">
                                            {order.completedDate ? new Date(order.completedDate).toLocaleDateString("en-GB") : "-"}
                                        </td>
                                        <td className="px-2 border-r border-border/15 truncate text-[10.5px] font-medium" title={order.customerName || ""}>
                                            {order.customerName || "-"}
                                        </td>
                                        
                                        {/* Voice Number (Read-only) */}
                                        <td className="px-2 border-r border-border/15 text-[10.5px] font-medium text-foreground truncate" title={order.voiceNumber || ""}>
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

                                        {/* Drop Wire Distance */}
                                        <td className="relative border-r border-border/15 p-0">
                                            <input
                                                type="number"
                                                defaultValue={order.dropWireDistance ?? ""}
                                                onBlur={(e) => handleSaveField(order.id, "dropWireDistance", e.target.value)}
                                                onKeyDown={(e) => handleKeyDown(e, index, "dropWireDistance")}
                                                data-row-index={index}
                                                data-field="dropWireDistance"
                                                className={cellInputClass}
                                                placeholder="0"
                                            />
                                            {renderCellStatus(order.id, "dropWireDistance")}
                                        </td>

                                        {/* Contractor Select */}
                                        <td className="relative border-r border-border/15 p-0">
                                            <select
                                                value={order.contractorId || ""}
                                                onChange={(e) => handleSaveField(order.id, "contractorId", e.target.value)}
                                                onKeyDown={(e) => handleKeyDown(e, index, "contractorId")}
                                                data-row-index={index}
                                                data-field="contractorId"
                                                className="w-full h-full bg-transparent border-none focus:outline-none focus:ring-1 focus:ring-blue-500/80 focus:bg-background/90 px-1 py-1 text-[10px] font-bold text-foreground"
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
                                            <span className={`px-2 py-0.5 rounded-full font-black text-[9px] uppercase border ${getStatusColorClass(order.status)}`}>
                                                {order.status || "-"}
                                            </span>
                                        </td>

                                        {/* Comments */}
                                        <td className="relative border-r border-border/15 p-0">
                                            <input
                                                type="text"
                                                defaultValue={order.comments || ""}
                                                onBlur={(e) => handleSaveField(order.id, "comments", e.target.value)}
                                                onKeyDown={(e) => handleKeyDown(e, index, "comments")}
                                                data-row-index={index}
                                                data-field="comments"
                                                className={cellInputClass}
                                                placeholder="No comments"
                                            />
                                            {renderCellStatus(order.id, "comments")}
                                        </td>
                                    </>
                                )}

                                {/* RETURN VIEW */}
                                {filterType === "return" && (
                                    <>
                                        <td className="px-2 border-r border-border/15 text-[10.5px] font-bold text-rose-500 font-mono">
                                            {order.completedDate ? new Date(order.completedDate).toLocaleDateString("en-GB") : order.statusDate ? new Date(order.statusDate).toLocaleDateString("en-GB") : "-"}
                                        </td>
                                        <td className="px-2 border-r border-border/15 truncate text-[10.5px] font-medium" title={order.customerName || ""}>
                                            {order.customerName || "-"}
                                        </td>
                                        
                                        {/* Voice Number (Read-only) */}
                                        <td className="px-2 border-r border-border/15 text-[10.5px] font-medium text-foreground truncate" title={order.voiceNumber || ""}>
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
                                                className="w-full h-full bg-transparent border-none focus:outline-none focus:ring-1 focus:ring-blue-500/80 focus:bg-background/90 px-1 py-1 text-[10px] font-bold text-foreground"
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
                                                className="w-full h-full bg-transparent border-none focus:outline-none focus:ring-1 focus:ring-blue-500/80 focus:bg-background/90 px-1 py-1 text-[10px] font-black text-rose-400"
                                            >
                                                <option value="RETURN">RETURN</option>
                                                <option value="INPROGRESS">IN PROGRESS</option>
                                                <option value="COMPLETED">COMPLETED</option>
                                            </select>
                                            {renderCellStatus(order.id, "sltsStatus")}
                                        </td>

                                        {/* Return Reason (Read only from SLT Portal) */}
                                        <td className="px-2 border-r border-border/15 text-[10.5px] truncate font-semibold text-rose-500 uppercase" title={order.returnReason || order.status || ""}>
                                            {order.returnReason || order.status || "-"}
                                        </td>

                                        {/* Comments */}
                                        <td className="relative border-r border-border/15 p-0">
                                            <input
                                                type="text"
                                                defaultValue={order.comments || ""}
                                                onBlur={(e) => handleSaveField(order.id, "comments", e.target.value)}
                                                onKeyDown={(e) => handleKeyDown(e, index, "comments")}
                                                data-row-index={index}
                                                data-field="comments"
                                                className={cellInputClass}
                                                placeholder="No comments"
                                            />
                                            {renderCellStatus(order.id, "comments")}
                                        </td>
                                    </>
                                )}

                                {/* PENDING / DISPATCH VIEW */}
                                {filterType === "pending" && (
                                    <>
                                        <td className="px-2 border-r border-border/15 truncate text-[10.5px] font-medium text-foreground" title={order.customerName || ""}>
                                            {order.customerName || "-"}
                                        </td>

                                        {/* Voice/TP Number (Read-only) */}
                                        <td className="px-2 border-r border-border/15 text-[10.5px] font-medium text-foreground truncate" title={order.voiceNumber || ""}>
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
                                                className={cellInputClass}
                                                placeholder="N/A"
                                            />
                                            {renderCellStatus(order.id, "dp")}
                                        </td>

                                        {/* ONT Serial Number */}
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

                                        {/* DP Details */}
                                        <td className="relative border-r border-border/15 p-0">
                                            <input
                                                type="text"
                                                defaultValue={order.dpDetails || ""}
                                                onBlur={(e) => handleSaveField(order.id, "dpDetails", e.target.value)}
                                                onKeyDown={(e) => handleKeyDown(e, index, "dpDetails")}
                                                data-row-index={index}
                                                data-field="dpDetails"
                                                className={cellInputClass}
                                                placeholder="N/A"
                                            />
                                            {renderCellStatus(order.id, "dpDetails")}
                                        </td>

                                        {/* Wire distance (M) */}
                                        <td className="relative border-r border-border/15 p-0">
                                            <input
                                                type="number"
                                                defaultValue={order.dropWireDistance ?? ""}
                                                onBlur={(e) => handleSaveField(order.id, "dropWireDistance", e.target.value)}
                                                onKeyDown={(e) => handleKeyDown(e, index, "dropWireDistance")}
                                                data-row-index={index}
                                                data-field="dropWireDistance"
                                                className={cellInputClass}
                                                placeholder="0"
                                            />
                                            {renderCellStatus(order.id, "dropWireDistance")}
                                        </td>

                                        {/* Contractor Dropdown */}
                                        <td className="relative border-r border-border/15 p-0">
                                            <select
                                                value={order.contractorId || ""}
                                                onChange={(e) => handleSaveField(order.id, "contractorId", e.target.value)}
                                                onKeyDown={(e) => handleKeyDown(e, index, "contractorId")}
                                                data-row-index={index}
                                                data-field="contractorId"
                                                className="w-full h-full bg-transparent border-none focus:outline-none focus:ring-1 focus:ring-blue-500/80 focus:bg-background/90 px-1 py-1 text-[10px] font-bold text-blue-400"
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
                                                className={`w-full h-full bg-transparent border-none focus:outline-none focus:ring-1 focus:ring-blue-500/80 focus:bg-background/90 px-1 py-1 text-[10px] font-black ${
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
                                                className="w-full h-full bg-transparent border-none focus:outline-none focus:ring-1 focus:ring-blue-500/80 focus:bg-background/90 px-1 py-1 text-[9.5px] font-bold text-foreground font-mono"
                                            />
                                            {renderCellStatus(order.id, "scheduledDate")}
                                        </td>

                                        {/* Comments */}
                                        <td className="relative border-r border-border/15 p-0">
                                            <input
                                                type="text"
                                                defaultValue={order.comments || ""}
                                                onBlur={(e) => handleSaveField(order.id, "comments", e.target.value)}
                                                onKeyDown={(e) => handleKeyDown(e, index, "comments")}
                                                data-row-index={index}
                                                data-field="comments"
                                                className={cellInputClass}
                                                placeholder="No comments"
                                            />
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

"use client";

import React, { useState, useMemo } from "react";
import { ServiceOrder } from "@/types/service-order";
import { Contractor } from "@/types/service-order/order-action.types";
import { Info, MessageSquare, CheckCircle2, Loader2, Check, Calendar, ChevronDown, WifiOff, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuSub,
    DropdownMenuSubContent,
    DropdownMenuSubTrigger,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getComputedSodStatus } from "@/lib/constants/sod-constants";

// Asia/Colombo-pinned date formatting: return/completed date cells and their column
// filters must not depend on the viewer's machine timezone.
const fmtColomboDate = (value?: Date | string | null): string =>
    value
        ? new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Colombo", day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(value))
        : "";
const fmtColomboTime = (value?: Date | string | null): string =>
    value
        ? new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Colombo", hour: "2-digit", minute: "2-digit", hour12: true }).format(new Date(value))
        : "";

interface SODSheetTableProps {
    orders: ServiceOrder[];
    filterType: "pending" | "install_closed" | "completed" | "return" | "disappeared";
    contractors: Contractor[];
    selectedIds: Set<string>;
    toggleSelect: (id: string) => void;
    toggleAll: () => void;
    isAllSelected: boolean;
    onSort: (key: keyof ServiceOrder) => void;
    sortConfig: { key: keyof ServiceOrder; direction: "asc" | "desc" } | null;
    onUpdateField: (id: string, data: Record<string, unknown>) => Promise<unknown>;
    onOpenModal: (order: ServiceOrder, type: "detail" | "schedule" | "comment" | "action") => void;
    onPendingReturn?: (order: ServiceOrder) => void;
    columnFilters?: Record<string, string>;
    onColumnFiltersChange?: (filters: Record<string, string>) => void;
    visibleColumns?: string[]; // Column keys from admin settings
}

function getSlaAgingBadge(receivedDate?: Date | string | null) {
    if (!receivedDate) return { text: 'N/A', days: 0, category: 'UNKNOWN', className: 'text-slate-500', rowClassName: '' };
    const recDate = new Date(receivedDate);
    const now = new Date();
    const diffTime = Math.max(0, now.getTime() - recDate.getTime());
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    // 5-Tier Executive SLA Aging Breakdown (Management Target Breakdown)
    if (diffDays <= 2) {
        return { 
            text: `${diffDays}d`, 
            days: diffDays, 
            category: 'WITHIN_2D',
            className: 'text-emerald-800 dark:text-emerald-300 font-extrabold',
            rowClassName: 'bg-emerald-100/80 dark:bg-emerald-900/40' 
        };
    } else if (diffDays <= 5) {
        return { 
            text: `${diffDays}d`, 
            days: diffDays, 
            category: 'WITHIN_5D',
            className: 'text-teal-800 dark:text-teal-300 font-extrabold',
            rowClassName: 'bg-teal-100/80 dark:bg-teal-900/40' 
        };
    } else if (diffDays <= 7) {
        return { 
            text: `${diffDays}d`, 
            days: diffDays, 
            category: 'WITHIN_7D',
            className: 'text-amber-800 dark:text-amber-300 font-extrabold',
            rowClassName: 'bg-amber-100/80 dark:bg-amber-900/40' 
        };
    } else if (diffDays <= 10) {
        return { 
            text: `${diffDays}d`, 
            days: diffDays, 
            category: 'WITHIN_10D',
            className: 'text-orange-800 dark:text-orange-300 font-extrabold',
            rowClassName: 'bg-orange-100/80 dark:bg-orange-900/40' 
        };
    } else {
        return { 
            text: `${diffDays}d OVERDUE`, 
            days: diffDays, 
            category: 'OVER_10D',
            className: 'text-rose-800 dark:text-rose-300 font-black animate-pulse',
            rowClassName: 'bg-rose-100/90 dark:bg-rose-900/50 border-y-2 border-rose-500/40' 
        };
    }
}

function parseSoNumberDate(soNum?: string | null): Date | null {
    if (!soNum) return null;
    const match = soNum.match(/20\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])/);
    if (!match) return null;
    const dateStr = match[0];
    const year = parseInt(dateStr.slice(0, 4), 10);
    const month = parseInt(dateStr.slice(4, 6), 10) - 1;
    const day = parseInt(dateStr.slice(6, 8), 10);
    const date = new Date(year, month, day);
    return isNaN(date.getTime()) ? null : date;
}

export function SODSheetTable(props: SODSheetTableProps) {
    const {
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
        onOpenModal,
        onPendingReturn,
        columnFilters: externalColumnFilters,
        onColumnFiltersChange,
        visibleColumns
    } = props;

    // Helper to check if a column is visible (if visibleColumns is not provided, show all)
    const isColumnVisible = (columnKey: string): boolean => {
        if (!visibleColumns || visibleColumns.length === 0) return true;
        return visibleColumns.includes(columnKey);
    };
    // Map to keep track of saving states per cell (key: "orderId-fieldName")
    const [savingStates, setSavingStates] = useState<Record<string, "saving" | "saved" | "error" | null>>({});
    const [internalColumnFilters, setInternalColumnFilters] = useState<Record<string, string>>({});

    // Use external filters if provided, otherwise use internal state
    const columnFilters = externalColumnFilters ?? internalColumnFilters;
    const setColumnFilters = (updater: Record<string, string> | ((prev: Record<string, string>) => Record<string, string>)) => {
        if (onColumnFiltersChange) {
            // External mode: call parent handler
            const next = typeof updater === 'function' ? updater(columnFilters) : updater;
            onColumnFiltersChange(next);
        } else {
            // Internal mode: update local state
            setInternalColumnFilters(updater);
        }
    };

    const filteredAndSortedOrders = useMemo(() => {
        let result = [...orders];

        // Client-side filtering only for fields NOT handled server-side
        // Server-side handles: sltsStatus, contractorId, teamId, voiceNumber, customerName, soNum, ontSerialNumber
        // Client-side handles: completedDate, statusDate, scheduledDate, returnReason
        for (const [key, filterValue] of Object.entries(columnFilters)) {
            if (!filterValue) continue;
            // Skip server-side filtered fields
            if (['sltsStatus', 'contractorId', 'teamId', 'voiceNumber', 'customerName', 'soNum', 'ontSerialNumber'].includes(key)) continue;
            
            const lowerFilter = filterValue.toLowerCase();
            result = result.filter(order => {
                if (key === "completedDate") {
                    const dateStr = fmtColomboDate(order.completedDate);
                    return dateStr.includes(filterValue);
                }
                if (key === "statusDate") {
                    const dateStr = fmtColomboDate(order.statusDate);
                    return dateStr.includes(filterValue);
                }
                if (key === "scheduledDate") {
                    const dateStr = order.scheduledDate ? new Date(order.scheduledDate).toLocaleDateString("en-GB") : "";
                    return dateStr.includes(filterValue);
                }
                if (key === "returnReason") {
                    const reason = order.returnReason || "";
                    return reason.toLowerCase().includes(lowerFilter);
                }
                if (key === "status") {
                    // Filter must match the displayed computed badge, not the raw workflow field
                    return getComputedSodStatus(order).toLowerCase().includes(lowerFilter);
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

    // Revenue totals for the completed view footer (respects active column filters)
    const revenueTotals = useMemo(() => {
        return filteredAndSortedOrders.reduce(
            (acc, o) => {
                acc.revenue += Number(o.revenueAmount) || 0;
                acc.contractor += Number(o.contractorAmount) || 0;
                if (o.revenueAmount) acc.withRevenue += 1;
                return acc;
            },
            { revenue: 0, contractor: 0, withRevenue: 0 }
        );
    }, [filteredAndSortedOrders]);

    const handleSaveField = async (orderId: string, fieldName: string, value: unknown) => {
        const cellKey = `${orderId}-${fieldName}`;
        
        // Find existing order to verify if the value actually changed
        const order = orders.find(o => o.id === orderId);
        if (order && fieldName !== "teamAssignment") {
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
            if (fieldName === "teamAssignment") {
                const valStr = String(value);
                if (!valStr) {
                    payload.contractorId = null;
                    payload.teamId = null;
                    payload.directTeamName = null;
                } else if (valStr.startsWith('CUSTOM:')) {
                    const customName = valStr.replace('CUSTOM:', '').trim();
                    payload.contractorId = null;
                    payload.teamId = null;
                    payload.directTeamName = customName || null;
                } else {
                    const [cId, tId] = valStr.split('|');
                    payload.contractorId = cId || null;
                    payload.teamId = tId || null;
                }
            } else if (fieldName === "scheduledDate") {
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

    const renderContractorTeamDropdown = (order: ServiceOrder, index: number) => {
        const selectedContractor = contractors.find(c => c.id === order.contractorId);
        const selectedTeam = selectedContractor?.teams?.find(t => t.id === order.teamId) || (order.team ? { id: order.team.id, name: order.team.name } : null);
        const contractorName = selectedContractor?.name || order.contractor?.name;
        const teamName = selectedTeam?.name || order.team?.name;
        
        let label = "Select Team";
        let isSyncedTeam = false;

        const isGenericTaskName = (name?: string | null) => {
            if (!name) return true;
            const u = name.trim().toUpperCase();
            if (u.includes('/')) return false;
            const genericPatterns = [
                'CONSTRUCT_OSP', 'RECONSTRUCT_OSP', 'MODIFY-LOCATION', 'MODIFY_LOCATION',
                'SERVICE_MODIFY', 'SERVICE-MODIFY', 'MAINTAIN_OSP', 'MAINTAIN-OSP',
                'FAULT_REPAIR', 'CONSTRUCT', 'RECONSTRUCT', 'OSP', 'REPAIR',
                'INSTALL', 'NEW_CONNECTION', 'UPGRADE', 'CHANGE_LOCATION', 'LOCATION_CHANGE'
            ];
            return genericPatterns.some(pattern => u === pattern || u.startsWith(pattern));
        };

        if (contractorName) {
            if (teamName) {
                label = `${contractorName} - ${teamName}`;
            } else {
                label = `${contractorName}`;
            }
        } else if (teamName) {
            label = teamName;
        } else if (order.directTeam && !isGenericTaskName(order.directTeam)) {
            const raw = order.directTeam;
            label = raw.split('/')[0].trim();
            isSyncedTeam = true;
        }

        return (
            <div className="w-full h-full relative" data-row-index={index} data-field="contractorId">
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <button className={`w-full h-full flex items-center justify-between bg-transparent border-none focus:outline-none focus:ring-1 focus:ring-blue-500/80 focus:bg-primary/5 pl-1.5 pr-2 py-1 text-[10px] font-bold text-left hover:bg-primary/5 transition-colors ${isSyncedTeam ? 'text-indigo-600 dark:text-indigo-400 font-extrabold' : 'text-blue-500'}`}>
                            <span className="truncate" title={label}>{label}</span>
                            <ChevronDown className="w-3 h-3 opacity-50 ml-1 shrink-0" />
                        </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-48 p-1" align="start">
                        <DropdownMenuLabel className="text-[10px] py-1 px-2 uppercase text-muted-foreground">Assign Contractor Team</DropdownMenuLabel>
                        <DropdownMenuSeparator className="my-1" />
                        <DropdownMenuItem onClick={() => handleSaveField(order.id, "teamAssignment", "")} className="text-[11px] py-1 px-2 h-auto min-h-0">
                            <span className="text-muted-foreground italic">Clear Assignment</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                            onClick={() => {
                                const customName = prompt("Enter Custom Team Name:");
                                if (customName !== null && customName.trim()) {
                                    handleSaveField(order.id, "teamAssignment", `CUSTOM:${customName.trim()}`);
                                }
                            }} 
                            className="text-[11px] py-1 px-2 h-auto min-h-0 text-indigo-600 font-bold dark:text-indigo-400"
                        >
                            + Enter Custom Team Name...
                        </DropdownMenuItem>
                        {contractors.map((c) => {
                            if (c.teams && c.teams.length > 0) {
                                return (
                                    <DropdownMenuSub key={c.id}>
                                        <DropdownMenuSubTrigger 
                                            onClick={() => handleSaveField(order.id, "teamAssignment", `${c.id}|${c.teams?.[0]?.id || ''}`)}
                                            className="text-[11px] py-1 px-2 h-auto min-h-0 flex justify-between items-center"
                                        >
                                            <span>{c.name}</span>
                                        </DropdownMenuSubTrigger>
                                        <DropdownMenuSubContent className="p-1">
                                            {c.teams.map((t) => (
                                                <DropdownMenuItem
                                                    key={t.id}
                                                    onClick={() => handleSaveField(order.id, "teamAssignment", `${c.id}|${t.id}`)}
                                                    className="text-[11px] py-1 px-2 h-auto min-h-0 font-medium"
                                                >
                                                    {c.name} - <span className="font-bold text-amber-500 ml-1">{t.name}</span>
                                                </DropdownMenuItem>
                                            ))}
                                        </DropdownMenuSubContent>
                                    </DropdownMenuSub>
                                );
                            } else {
                                return (
                                    <DropdownMenuItem
                                        key={c.id}
                                        onClick={() => handleSaveField(order.id, "teamAssignment", `${c.id}|`)}
                                        className="text-[11px] py-1 px-2 h-auto min-h-0 flex items-center justify-between"
                                    >
                                        {c.name} <span className="text-muted-foreground text-[9px] ml-2">(No Teams)</span>
                                    </DropdownMenuItem>
                                );
                            }
                        })}
                    </DropdownMenuContent>
                </DropdownMenu>
                {renderCellStatus(order.id, "teamAssignment")}
            </div>
        );
    };

    return (
        <div className="w-full h-full overflow-auto border-t border-border/20 custom-scrollbar">
            <table className="min-w-[1100px] w-full border-collapse text-left table-fixed">
                <thead className="bg-muted/80 border-b border-border/40 sticky top-0 z-40 backdrop-blur-md">
                    <tr className="text-muted-foreground font-black uppercase tracking-tight text-[9px]">
                        <th className="w-[36px] px-1 py-1.5 border-r border-border/20 text-center md:sticky md:left-0 bg-muted/90 z-50">
                            <Checkbox checked={isAllSelected} onCheckedChange={() => toggleAll()} className="border-slate-400 dark:border-slate-500 data-[state=checked]:border-primary data-[state=checked]:bg-primary" />
                        </th>
                        <th className="w-[135px] min-w-[135px] px-2 py-1.5 border-r border-border/20 md:sticky md:left-[36px] bg-muted/90 z-50">
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
                        {filterType === "completed" || filterType === "install_closed" ? (
                            <>
                                {isColumnVisible('completedDate') && (
                                <th className="w-[110px] px-2 py-1.5 border-r border-border/20 text-emerald-450 dark:text-emerald-400">
                                    <div className="flex flex-col gap-1">
                                        <div className="flex items-center justify-between cursor-pointer hover:text-foreground transition-colors" onClick={() => onSort("completedDate")}>
                                            <span>{filterType === "completed" ? "Completed Date" : "Install Closed Date"}</span>
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
                                )}
                                {isColumnVisible('customerName') && (
                                <th className="w-[210px] px-2 py-1.5 border-r border-border/20">
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
                                )}
                                {isColumnVisible('voiceNumber') && (
                                <th className="w-[125px] px-2 py-1.5 border-r border-border/20">
                                    <div className="flex flex-col gap-1">
                                        <div className="flex items-center justify-between cursor-pointer hover:text-foreground transition-colors" onClick={() => onSort("voiceNumber")}>
                                            <span>Voice</span>
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
                                )}
                                {isColumnVisible('ontSerialNumber') && (
                                <th className="w-[115px] px-2 py-1.5 border-r border-border/20">
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
                                )}
                                {isColumnVisible('teamId') && (
                                <th className="w-[145px] px-2 py-1.5 border-r border-border/20">
                                    <div className="flex flex-col gap-1">
                                        <div className="flex items-center justify-between cursor-pointer hover:text-foreground transition-colors" onClick={() => onSort("teamId")}>
                                            <span>Contractor Team</span>
                                            {sortConfig?.key === "teamId" && (sortConfig.direction === "asc" ? "▲" : "▼")}
                                        </div>
                                        <select
                                            value={columnFilters.teamId || ""}
                                            onChange={(e) => setColumnFilters(prev => ({ ...prev, teamId: e.target.value }))}
                                            onClick={(e) => e.stopPropagation()}
                                            className="h-5 px-1 py-0 text-[8.5px] w-full bg-background border border-border/40 rounded focus:border-primary focus:outline-none font-sans font-normal text-foreground"
                                        >
                                            <option value="">All Teams</option>
                                            {contractors.map((c) => (
                                                <optgroup key={c.id} label={c.name}>
                                                    {c.teams && c.teams.length > 0 ? (
                                                        c.teams.map(t => (
                                                            <option key={t.id} value={t.id}>
                                                                {c.name} - {t.name}
                                                            </option>
                                                        ))
                                                    ) : (
                                                        <option value={c.id} disabled>
                                                            {c.name} (No Teams)
                                                        </option>
                                                    )}
                                                </optgroup>
                                            ))}
                                        </select>
                                    </div>
                                </th>
                                )}
                                {isColumnVisible('status') && (
                                <th className="w-[120px] px-2 py-1.5 border-r border-border/20">
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
                                )}
                                {isColumnVisible('comments') && (
                                <th className="w-[165px] px-2 py-1.5 border-r border-border/20">
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
                                )}
                                {isColumnVisible('revenue') && (
                                <th className="w-[100px] px-2 py-1.5 border-r border-border/20">
                                    <div className="flex flex-col gap-1">
                                        <span className="text-emerald-500 dark:text-emerald-400">Revenue</span>
                                        <span className="text-[7px] text-muted-foreground font-normal normal-case">Rs. Amount</span>
                                    </div>
                                </th>
                                )}
                            </>
                        ) : filterType === "return" ? (
                            <>
                                {isColumnVisible('completedDate') && (
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
                                )}
                                {isColumnVisible('customerName') && (
                                <th className="w-[175px] px-2 py-1.5 border-r border-border/20">
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
                                )}
                                {isColumnVisible('voiceNumber') && (
                                <th className="w-[110px] px-2 py-1.5 border-r border-border/20">
                                    <div className="flex flex-col gap-1">
                                        <div className="flex items-center justify-between cursor-pointer hover:text-foreground transition-colors" onClick={() => onSort("voiceNumber")}>
                                            <span>Voice</span>
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
                                )}
                                {isColumnVisible('contractorId') && (
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
                                )}
                                {isColumnVisible('sltsStatus') && (
                                <th className="w-[90px] px-2 py-1.5 border-r border-border/20">
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
                                )}
                                {isColumnVisible('returnReason') && (
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
                                )}
                                {isColumnVisible('comments') && (
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
                                )}
                            </>
                        ) : (
                            // PENDING (Dispatcher Grid)
                            <>
                                {isColumnVisible('customerName') && (
                                <th className="w-[170px] min-w-[170px] px-2 py-1.5 border-r border-border/20">
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
                                )}
                                {isColumnVisible('voiceNumber') && (
                                <th className="w-[95px] min-w-[95px] px-2 py-1.5 border-r border-border/20">
                                    <div className="flex flex-col gap-1">
                                        <div className="flex items-center justify-between cursor-pointer hover:text-foreground transition-colors" onClick={() => onSort("voiceNumber")}>
                                            <span>Voice</span>
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
                                )}
                                {isColumnVisible('dp') && (
                                 <th className="w-[110px] min-w-[110px] px-2 py-1.5 border-r border-border/20">
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
                                )}
                                {isColumnVisible('contractorId') && (
                                <th className="w-[115px] min-w-[115px] px-2 py-1.5 border-r border-border/20">
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
                                )}
                                {isColumnVisible('sltsStatus') && (
                                <th className="w-[95px] min-w-[95px] px-2 py-1.5 border-r border-border/20">
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
                                            <option value="PENDING">PENDING</option>
                                            <option value="INPROGRESS">IN PROGRESS</option>
                                            <option value="ASSIGNED">ASSIGNED</option>
                                            <option value="COMPLETED">COMPLETED</option>
                                            <option value="RETURN">RETURN</option>
                                            <option value="DISAPPEARED">DISAPPEARED</option>
                                        </select>
                                    </div>
                                </th>
                                )}
                                {isColumnVisible('scheduledDate') && (
                                 <th className="w-[105px] min-w-[105px] px-2 py-1.5 border-r border-border/20">
                                    <div className="flex flex-col gap-1">
                                        <div className="flex items-center justify-between cursor-pointer hover:text-foreground transition-colors" onClick={() => onSort("scheduledDate")}>
                                            <span>Appointment</span>
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
                                )}
                                {isColumnVisible('comments') && (
                                <th className="w-[125px] min-w-[125px] px-2 py-1.5 border-r border-border/20">
                                    <div className="flex flex-col gap-1">
                                        <div className="flex items-center justify-between cursor-pointer hover:text-foreground transition-colors" onClick={() => onSort("comments")}>
                                            <span>Comments/Notes</span>
                                            {sortConfig?.key === "comments" && (sortConfig.direction === "asc" ? "▲" : "▼")}
                                        </div>
                                        <input
                                            type="text"
                                            placeholder="Filter..."
                                            value={columnFilters.comments || ""}
                                            onChange={(e) => setColumnFilters(prev => ({ ...prev, comments: e.target.value }))}
                                            onClick={(e) => e.stopPropagation()}
                                            className="h-5 px-1 py-0.5 text-[8.5px] w-full bg-background border border-border/40 rounded focus:border-primary focus:outline-none placeholder:opacity-50 font-sans font-normal text-foreground"
                                        />
                                    </div>
                                </th>
                                )}
                            </>
                        )}
                        <th className="w-[100px] min-w-[100px] text-center md:sticky md:right-0 bg-muted/90 z-50">Actions</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-border/25">
                    {filteredAndSortedOrders.length > 0 ? (
                        filteredAndSortedOrders.map((order, index) => {
                            const sla = (filterType === "pending" || filterType === "disappeared") ? getSlaAgingBadge(order.receivedDate) : null;
                            const rowBg = sla?.rowClassName || '';
                            const stickyBg = sla?.rowClassName ? 'bg-inherit' : 'bg-card';
                            
                            return (
                            <tr
                                key={order.id}
                                className={`hover:bg-primary/[0.05] dark:hover:bg-primary/[0.08] border-b border-border/10 transition-colors ${
                                    selectedIds.has(order.id) ? "bg-primary/10" : ""
                                } ${rowBg}`}
                            >
                                {/* Checkbox */}
                                <td className={`px-1 text-center border-r border-border/15 md:sticky md:left-0 z-20 ${stickyBg}`}>
                                    <Checkbox checked={selectedIds.has(order.id)} onCheckedChange={() => toggleSelect(order.id)} className="border-slate-400 dark:border-slate-500 data-[state=checked]:border-primary data-[state=checked]:bg-primary" />
                                </td>
                                {/* SO Number (Read-only, clickable details) */}
                                <td className={`px-2 font-mono font-bold text-[10px] border-r border-border/15 md:sticky md:left-[36px] z-20 ${stickyBg}`}>
                                    <div className="flex flex-col gap-0.5 py-0.5">
                                        <div className="flex items-center gap-1.5">
                                            {(order.isOfflineWorkOrder || order.completionMode?.toUpperCase() === 'OFFLINE' || order.status?.toUpperCase() === 'OFFLINE' || String(order.completionMode).toUpperCase().includes('OFFLINE')) && (
                                                <span 
                                                    className="px-1.5 py-0.5 text-[8px] font-black uppercase rounded-md bg-rose-600 text-white shadow-xs shrink-0 inline-flex items-center gap-1 cursor-help" 
                                                    title={`Offline Work Order Connection (${order.offlineReference || 'Contractor Entry'})`}
                                                >
                                                    <WifiOff className="w-2.5 h-2.5 text-white" />
                                                    OFFLINE
                                                </span>
                                            )}
                                            <button
                                                type="button"
                                                className="text-foreground hover:text-primary transition-colors text-left truncate font-bold"
                                                onClick={() => onOpenModal(order, "detail")}
                                                title="View Details"
                                            >
                                                {order.soNum}
                                            </button>
                                            {order.hasBridgeLog && (
                                                <span 
                                                    className="p-1 rounded-full bg-indigo-600/10 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400 border border-indigo-500/30 shadow-xs shrink-0 inline-flex items-center justify-center cursor-help" 
                                                    title="Synced via SLTS Bridge Chrome Extension Log"
                                                >
                                                    <Zap className="w-2.5 h-2.5 text-indigo-500 animate-pulse" />
                                                </span>
                                            )}
                                        </div>
                                         {/* Received Date Subtext & Dynamic KPI Aging/Turnaround Indicator */}
                                         {(() => {
                                             const parsedDate = parseSoNumberDate(order.soNum);
                                             const effectiveDate = parsedDate || (order.receivedDate ? new Date(order.receivedDate) : null);
                                             if (!effectiveDate) return null;

                                             return (
                                                 <div className="flex items-center gap-1.5 font-sans">
                                                     <span className="text-[8.5px] font-medium text-muted-foreground font-mono" title="SO Issue / Received Date">
                                                         {effectiveDate.toLocaleDateString('en-GB')}
                                                     </span>
                                                     {filterType === 'pending' && (() => {
                                                         const sla = getSlaAgingBadge(effectiveDate);
                                                         return (
                                                             <span className={`px-1 py-0.1 text-[7.5px] font-extrabold uppercase rounded border ${sla.className}`} title={`Received ${sla.days} days ago`}>
                                                                 {sla.text}
                                                             </span>
                                                         );
                                                     })()}
                                                     {filterType === 'completed' && order.completedDate && (() => {
                                                         const compDate = new Date(order.completedDate);
                                                         const diffTime = Math.max(0, compDate.getTime() - effectiveDate.getTime());
                                                         const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
                                                         return (
                                                             <span className="px-1 py-0.1 text-[7.5px] font-extrabold uppercase rounded border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 font-mono" title={`Completed in ${diffDays} days`}>
                                                                 {diffDays}d
                                                             </span>
                                                         );
                                                     })()}
                                                 </div>
                                             );
                                         })()}
                                    </div>
                                </td>

                                {/* COMPLETED & INSTALL CLOSED VIEW */}
                                {(filterType === "completed" || filterType === "install_closed") && (
                                    <>
                                        {isColumnVisible('completedDate') && (
                                        <td className="px-2 border-r border-border/15 text-[10px] font-bold text-emerald-500 font-mono">
                                            {order.completedDate 
                                                ? fmtColomboDate(order.completedDate)
                                                : order.statusDate 
                                                    ? fmtColomboDate(order.statusDate)
                                                    : "-"
                                            }
                                        </td>
                                        )}
                                        {isColumnVisible('customerName') && (
                                        <td className="px-2 border-r border-border/15 py-1 text-[10px] text-foreground" title={`${order.customerName || ""} - ${order.address || ""}`}>
                                            <div className="max-w-[175px] flex flex-col gap-0.5">
                                                <span className="font-bold truncate leading-tight">{order.customerName || "-"}</span>
                                                {order.address && <span className="text-muted-foreground font-normal truncate leading-tight">{order.address}</span>}
                                            </div>
                                        </td>
                                        )}
                                        {isColumnVisible('voiceNumber') && (
                                        <td className="px-2 border-r border-border/15 py-1 text-[10px] font-medium text-foreground truncate" title={`${order.voiceNumber || ""} - ${order.orderType || ""}`}>
                                            <div className="flex flex-col gap-0.5">
                                                <span>{order.voiceNumber || "-"}</span>
                                                {order.orderType && <span className="text-[8.5px] text-muted-foreground font-semibold uppercase">{order.orderType}</span>}
                                            </div>
                                        </td>
                                        )}
                                        {isColumnVisible('ontSerialNumber') && (
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
                                        )}
                                        {isColumnVisible('teamId') && (
                                        <td className="relative border-r border-border/15 p-0">
                                            {renderContractorTeamDropdown(order, index)}
                                        </td>
                                        )}
                                        {isColumnVisible('status') && (
                                        <td className="px-2 border-r border-border/15">
                                            <span className={`px-2 py-0.5 rounded-full font-black text-[10px] uppercase border ${getStatusColorClass(getComputedSodStatus(order))}`} title={`Portal: ${order.sltsStatus || "-"} / Workflow: ${order.status || "-"}`}>
                                                {getComputedSodStatus(order)}
                                            </span>
                                        </td>
                                        )}
                                        {isColumnVisible('comments') && (
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
                                        )}
                                        {isColumnVisible('revenue') && (
                                        <td className="px-2 border-r border-border/15 text-[10px]">
                                            <div className="flex flex-col gap-0.5">
                                                <span className="font-black text-emerald-500 font-mono">{order.revenueAmount ? `Rs.${Number(order.revenueAmount).toLocaleString()}` : "-"}</span>
                                                {order.contractorAmount ? <span className="text-[8px] text-blue-400 font-bold font-mono">Con: Rs.{Number(order.contractorAmount).toLocaleString()}</span> : null}
                                            </div>
                                        </td>
                                        )}
                                    </>
                                )}

                                {/* RETURN VIEW */}
                                {filterType === "return" && (
                                    <>
                                        {isColumnVisible('completedDate') && (
                                        <td className="px-2 border-r border-border/15 text-[10px] font-bold text-rose-500 font-mono">
                                            {(order.completedDate || order.statusDate) ? (
                                                <div className="flex flex-col leading-tight">
                                                    <span>{fmtColomboDate(order.completedDate || order.statusDate)}</span>
                                                    <span className="text-[7.5px] font-semibold text-rose-400/80">{fmtColomboTime(order.completedDate || order.statusDate)}</span>
                                                </div>
                                            ) : "-"}
                                        </td>
                                        )}
                                        {isColumnVisible('customerName') && (
                                        <td className="px-2 border-r border-border/15 py-1 text-[10px] text-foreground" title={`${order.customerName || ""} - ${order.address || ""}`}>
                                            <div className="max-w-[210px] flex flex-col gap-0.5">
                                                <span className="font-bold truncate leading-tight">{order.customerName || "-"}</span>
                                                {order.address && <span className="text-muted-foreground font-normal truncate leading-tight">{order.address}</span>}
                                            </div>
                                        </td>
                                        )}
                                        {isColumnVisible('voiceNumber') && (
                                        <td className="px-2 border-r border-border/15 py-1 text-[10px] font-medium text-foreground truncate" title={`${order.voiceNumber || ""} - ${order.orderType || ""}`}>
                                            <div className="flex flex-col gap-0.5">
                                                <span>{order.voiceNumber || "-"}</span>
                                                {order.orderType && <span className="text-[8.5px] text-muted-foreground font-semibold uppercase">{order.orderType}</span>}
                                            </div>
                                        </td>
                                        )}
                                        {isColumnVisible('contractorId') && (
                                        <td className="relative border-r border-border/15 p-0">
                                            {renderContractorTeamDropdown(order, index)}
                                        </td>
                                        )}
                                        {isColumnVisible('sltsStatus') && (
                                        <td className="relative border-r border-border/15 p-0">
                                            <select
                                                value={order.sltsStatus}
                                                onChange={(e) => {
                                                    const val = e.target.value;
                                                    if (val === "COMPLETED") {
                                                        e.target.value = order.sltsStatus;
                                                        onOpenModal(order, "action");
                                                        return;
                                                    }
                                                    handleSaveField(order.id, "sltsStatus", val);
                                                }}
                                                onKeyDown={(e) => handleKeyDown(e, index, "sltsStatus")}
                                                data-row-index={index}
                                                data-field="sltsStatus"
                                                className="w-full h-full bg-transparent border-none focus:outline-none focus:ring-1 focus:ring-blue-500/80 focus:bg-background/90 pl-1 pr-3 py-1 text-[10px] font-black text-rose-400"
                                            >
                                                <option value="RETURN">RETURN</option>
                                                <option value="INPROGRESS">IN PROGRESS</option>
                                                {filterType !== "return" && <option value="COMPLETED">COMPLETED</option>}
                                            </select>
                                            {renderCellStatus(order.id, "sltsStatus")}
                                        </td>
                                        )}
                                        {isColumnVisible('returnReason') && (
                                        <td className="px-2 border-r border-border/15 text-[10px] truncate font-semibold text-rose-500 uppercase" title={order.returnReason || ""}>
                                            {order.returnReason || "-"}
                                        </td>
                                        )}
                                        {isColumnVisible('comments') && (
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
                                        )}
                                    </>
                                )}

                                {/* PENDING / DISPATCH VIEW */}
                                {(filterType === "pending" || filterType === "disappeared") && (
                                    <>
                                        {isColumnVisible('customerName') && (
                                        <td className="px-2 border-r border-border/15 py-1 text-[10px] text-foreground" title={`${order.customerName || ""} - ${order.address || ""}`}>
                                            <div className="max-w-[175px] flex flex-col gap-0.5">
                                                <span className="font-bold truncate leading-tight">{order.customerName || "-"}</span>
                                                {order.address && <span className="text-muted-foreground font-normal truncate leading-tight">{order.address}</span>}
                                            </div>
                                        </td>
                                        )}
                                        {isColumnVisible('voiceNumber') && (
                                        <td className="px-2 border-r border-border/15 py-1 text-[10px] font-medium text-foreground truncate" title={`${order.voiceNumber || ""} - ${order.orderType || ""}`}>
                                            <div className="flex flex-col gap-0.5">
                                                <span>{order.voiceNumber || "-"}</span>
                                                {order.orderType && <span className="text-[8.5px] text-muted-foreground font-semibold uppercase">{order.orderType}</span>}
                                            </div>
                                        </td>
                                        )}
                                        {isColumnVisible('dp') && (
                                        <td className="px-2 border-r border-border/15 py-1 text-[10px] font-mono text-foreground truncate max-w-[120px]" title={order.dp || ""}>
                                            {order.dp || "-"}
                                        </td>
                                        )}
                                        {isColumnVisible('contractorId') && (
                                        <td className="relative border-r border-border/15 p-0">
                                            {renderContractorTeamDropdown(order, index)}
                                        </td>
                                        )}
                                        {isColumnVisible('sltsStatus') && (
                                        <td className="relative border-r border-border/15 p-0">
                                            <select
                                                value={order.sltsStatus}
                                                onChange={(e) => {
                                                    const val = e.target.value;
                                                    if (val === "COMPLETED") {
                                                        e.target.value = order.sltsStatus;
                                                        onOpenModal(order, "action");
                                                        return;
                                                    }
                                                    if (order.sltsStatus === "DISAPPEARED" && val === "RETURN") {
                                                        e.target.value = order.sltsStatus;
                                                        onPendingReturn?.(order);
                                                        return;
                                                    }
                                                    handleSaveField(order.id, "sltsStatus", val);
                                                }}
                                                onKeyDown={(e) => handleKeyDown(e, index, "sltsStatus")}
                                                data-row-index={index}
                                                data-field="sltsStatus"
                                                className={`w-full h-full bg-transparent border-none focus:outline-none focus:ring-1 focus:ring-blue-500/80 focus:bg-background/90 pl-1 pr-3 py-1 text-[10px] font-black ${
                                                    order.sltsStatus === "COMPLETED" ? "text-emerald-500" :
                                                    order.sltsStatus === "ASSIGNED" ? "text-emerald-600" :
                                                    order.sltsStatus === "RETURN" ? "text-rose-500" : 
                                                    order.sltsStatus === "OFFLINE" ? "text-slate-400" : 
                                                    order.sltsStatus === "PROV_CLOSED" ? "text-blue-500" : order.sltsStatus === "DISAPPEARED" ? "text-gray-500" : "text-amber-500"
                                                }`}
                                            >
                                                <option value="PENDING">PENDING</option>
                                                <option value="INPROGRESS">IN PROGRESS</option>
                                                <option value="ASSIGNED">ASSIGNED</option>
                                                <option value="PROV_CLOSED">PROV CLOSED</option>
                                                <option value="COMPLETED">COMPLETED</option>
                                                <option value="RETURN">RETURN</option>
                                                <option value="DISAPPEARED">DISAPPEARED</option>
                                            </select>
                                            {renderCellStatus(order.id, "sltsStatus")}
                                        </td>
                                        )}
                                        {isColumnVisible('scheduledDate') && (
                                        <td className="relative border-r border-border/15 p-0 w-[105px] min-w-[105px]">
                                            <div className="relative w-full min-h-[32px] flex items-center justify-center px-1 py-0.5">
                                                <input
                                                    type="date"
                                                    value={order.scheduledDate ? new Date(order.scheduledDate).toISOString().split("T")[0] : ""}
                                                    onChange={(e) => handleSaveField(order.id, "scheduledDate", e.target.value)}
                                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                                    title={order.scheduledTime ? `Appointment: ${new Date(order.scheduledDate!).toLocaleDateString('en-GB')} at ${order.scheduledTime}` : "Click to set appointment date"}
                                                />
                                                <div className={`text-[9.5px] font-mono font-bold px-1 py-0.5 rounded transition-colors text-center flex flex-col items-center leading-tight w-full ${
                                                    order.scheduledDate 
                                                        ? "text-indigo-600 dark:text-indigo-400 bg-indigo-500/15 border border-indigo-500/30" 
                                                        : "text-muted-foreground/40 font-normal hover:text-foreground"
                                                }`}>
                                                    {order.scheduledDate ? (
                                                        <>
                                                            <span>{new Date(order.scheduledDate).toLocaleDateString('en-GB')}</span>
                                                            {order.scheduledTime && (
                                                                <span className="text-[8.5px] font-extrabold text-indigo-700 dark:text-indigo-300 truncate max-w-full">
                                                                    {order.scheduledTime}
                                                                </span>
                                                            )}
                                                        </>
                                                    ) : "-"}
                                                </div>
                                            </div>
                                            {renderCellStatus(order.id, "scheduledDate")}
                                        </td>
                                        )}
                                        {isColumnVisible('comments') && (
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
                                        )}
                                    </>
                                )}

                                {/* Sticky Actions column */}
                                <td className={`text-center border-l border-border/15 md:sticky md:right-0 z-30 shadow-[-2px_0_5px_-2px_rgba(0,0,0,0.1)] ${stickyBg}`}>
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
                                        {filterType === "pending" && 
                                          !["INSTALL_CLOSED", "CLOSED", "COMPLETED", "RETURNED", "RETIN"].includes(order.sltsStatus || order.status || "") && (
                                             <Button
                                                 size="icon"
                                                 variant="ghost"
                                                 className="h-6 w-6 hover:bg-indigo-500/10"
                                                 title="Schedule Appointment"
                                                 onClick={() => onOpenModal(order, "schedule")}
                                             >
                                                 <Calendar className="w-3.5 h-3.5 text-indigo-400" />
                                             </Button>
                                         )}
                                        {filterType !== "return" && (
                                        <Button
                                            size="icon"
                                            variant="ghost"
                                            className="h-6 w-6 hover:bg-emerald-500/10"
                                            title="Confirm Completion"
                                            onClick={() => onOpenModal(order, "action")}
                                        >
                                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                                        </Button>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        );
                    })
                    ) : (
                        <tr>
                            <td colSpan={20} className="px-3 py-16 text-center">
                                <div className="flex flex-col items-center gap-2">
                                    <div className="w-10 h-10 rounded-xl bg-muted/60 border border-border/30 flex items-center justify-center">
                                        <Info className="w-5 h-5 text-muted-foreground/30" />
                                    </div>
                                    <p className="text-xs font-semibold text-muted-foreground">No matching records</p>
                                    <p className="text-[10px] text-muted-foreground/60">Try adjusting column filters above</p>
                                </div>
                            </td>
                        </tr>
                    )}
                </tbody>
                {filterType === "completed" && isColumnVisible('revenue') && filteredAndSortedOrders.length > 0 && (
                    <tfoot className="sticky bottom-0 z-20">
                        <tr className="bg-slate-100/95 dark:bg-slate-800/95 backdrop-blur border-t-2 border-emerald-500/40">
                            <td colSpan={20} className="px-3 py-2">
                                <div className="flex items-center justify-between gap-4 flex-wrap">
                                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">
                                        {filteredAndSortedOrders.length} Order{filteredAndSortedOrders.length === 1 ? "" : "s"}
                                        <span className="ml-2 normal-case font-semibold">({revenueTotals.withRevenue} with revenue)</span>
                                    </span>
                                    <div className="flex items-center gap-5">
                                        <div className="flex flex-col items-end leading-tight">
                                            <span className="text-[8px] text-muted-foreground font-semibold uppercase">Total Revenue</span>
                                            <span className="text-[12px] font-black text-emerald-600 dark:text-emerald-400 font-mono">Rs.{revenueTotals.revenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                        </div>
                                        <div className="flex flex-col items-end leading-tight">
                                            <span className="text-[8px] text-muted-foreground font-semibold uppercase">Total Contractor</span>
                                            <span className="text-[12px] font-black text-blue-500 dark:text-blue-400 font-mono">Rs.{revenueTotals.contractor.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                        </div>
                                    </div>
                                </div>
                            </td>
                        </tr>
                    </tfoot>
                )}
            </table>
        </div>
    );
}

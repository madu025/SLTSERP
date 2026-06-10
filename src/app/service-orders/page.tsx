"use client";

import React, { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import { useTableColumnSettings } from "@/hooks/useTableColumnSettings";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { RefreshCw, Plus, Activity, Layers, Filter, Search, Calendar, MessageSquare, CheckCircle2, FileSpreadsheet, Info, AlertCircle, ChevronUp, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { ServiceOrder } from "@/types/service-order";
import { OrderActionData, Contractor, InventoryItem, OrderCompletionData } from "@/components/modals/order-action/types";

interface OPMC {
    id: string;
    rtom: string;
    name?: string;
}

import { useSODOperations } from "./hooks/useSODOperations";
import { useSODTable } from "./hooks/useSODTable";
import { SODSummary } from "./components/SODSummary";
import { SODSheetTable } from "./components/SODSheetTable";

const ManualEntryModal = dynamic(() => import("@/components/modals/ManualEntryModal"), { ssr: false });
const ScheduleModal = dynamic(() => import("@/components/modals/ScheduleModal"), { ssr: false });
const CommentModal = dynamic(() => import("@/components/modals/CommentModal"), { ssr: false });
const DetailModal = dynamic(() => import("@/components/modals/DetailModal"), { ssr: false });
const OrderActionModal = dynamic(() => import("@/components/modals/OrderActionModal"), { ssr: false });
const ExcelImportModal = dynamic(() => import("@/components/modals/ExcelImportModal"), { ssr: false });


export default function ServiceOrdersPage({ filterType = 'pending', pageTitle = 'Service Orders' }: { filterType?: 'pending' | 'completed' | 'return'; pageTitle?: string; }) {
    const queryClient = useQueryClient();

    const getStatusColorClass = (status: string) => {
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
    // Choose table settings key based on filterType
    const tableName = filterType === 'completed' ? 'completed_sod' : (filterType === 'return' ? 'return_sod' : 'pending_sod');
    const { isColumnVisible } = useTableColumnSettings(tableName);
    const hasSetDefault = React.useRef(false);

    // Filter State
    const [selectedRtomId, setSelectedRtomId] = useState<string>("");
    const [selectedRtom, setSelectedRtom] = useState<string>("");
    const [selectedMonth] = useState<string>(String(new Date().getMonth() + 1));
    const [selectedYear] = useState<string>(String(new Date().getFullYear()));
    const [searchTerm, setSearchTerm] = useState("");
    const [showMetrics, setShowMetrics] = useState<boolean>(() => {
        if (typeof window !== 'undefined') {
            const val = localStorage.getItem('sod_show_metrics');
            return val !== 'false';
        }
        return true;
    });
    const [statusFilter, setStatusFilter] = useState(filterType === 'completed' ? 'ALL' : 'DEFAULT');
    const [patFilter] = useState(pageTitle === 'Invoicable Service Orders' ? 'READY' : "ALL");
    const [matFilter] = useState("ALL");
    const [sortConfig, setSortConfig] = useState<{ key: keyof ServiceOrder; direction: "asc" | "desc" } | null>({
        key: filterType === 'completed' ? 'completedDate' : (filterType === 'return' ? 'statusDate' : 'createdAt'),
        direction: "desc"
    });

    // Modals State
    const [showManualModal, setShowManualModal] = useState(false);
    const [showScheduleModal, setShowScheduleModal] = useState(false);
    const [showCommentModal, setShowCommentModal] = useState(false);
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [showActionModal, setShowActionModal] = useState(false);
    const [showExcelModal, setShowExcelModal] = useState(false);
    const [selectedOrder, setSelectedOrder] = useState<ServiceOrder | null>(null);

    const [isSheetMode, setIsSheetMode] = useState<boolean>(() => {
        if (typeof window !== "undefined") {
            return localStorage.getItem("sod_sheet_mode") === "true";
        }
        return false;
    });

    const toggleSheetMode = () => {
        setIsSheetMode(prev => {
            const next = !prev;
            localStorage.setItem("sod_sheet_mode", String(next));
            return next;
        });
    };

    // --- HOOKS ---
    const { syncMutation, addOrderMutation, updateStatusMutation, scheduleMutation, commentMutation } = useSODOperations(selectedRtomId, selectedRtom);

    // Fetch OPMCs for context
    const { data: opmcs = [] } = useQuery<OPMC[]>({
        queryKey: ["opmcs"],
        queryFn: async () => {
             const storedUser = localStorage.getItem('user');
             if (!storedUser) return [];
             const user = JSON.parse(storedUser) as { role: string; username: string };
             const isAdmin = user.role === 'ADMIN' || user.role === 'SUPER_ADMIN';
             if (isAdmin) {
                 const res = await fetch("/api/opmcs");
                 return (await res.json()) as OPMC[];
             }
             const res = await fetch("/api/users?page=1&limit=1000");
             const data = (await res.json()) as { users: { username: string; accessibleOpmcs: OPMC[] }[] };
             const currentUser = data.users.find((u) => u.username === user.username);
             return currentUser?.accessibleOpmcs?.map((o) => ({ id: o.id, rtom: o.rtom, name: o.name || '' })) || [];
        }
    });

    const { data: qData, isLoading: isLoadingOrders } = useQuery<{ items: ServiceOrder[], summary: { totalSod: number, contractorAssigned: number, appointments: number, statusBreakdown: Record<string, number> } }>({
        queryKey: ["service-orders", selectedRtomId, filterType, selectedMonth, selectedYear, searchTerm, statusFilter, patFilter, matFilter, sortConfig],
        queryFn: async () => {
            if (!selectedRtomId) return { items: [], summary: { totalSod: 0, contractorAssigned: 0, appointments: 0, statusBreakdown: {} } };
            const monthParam = filterType === 'pending' ? '' : `&month=${selectedMonth}`;
            const yearParam = filterType === 'pending' ? '' : `&year=${selectedYear}`;
            const searchParam = searchTerm ? `&search=${encodeURIComponent(searchTerm)}` : '';
            const statusParam = statusFilter ? `&statusFilter=${statusFilter}` : '';
            const patParam = patFilter ? `&patFilter=${patFilter}` : '';
            const matParam = matFilter ? `&matFilter=${matFilter}` : '';

            const res = await fetch(`/api/service-orders?rtomId=${selectedRtomId}&filter=${filterType}${monthParam}${yearParam}${searchParam}${statusParam}${patParam}${matParam}`);
            return (await res.json()) as { items: ServiceOrder[], summary: { totalSod: number, contractorAssigned: number, appointments: number, statusBreakdown: Record<string, number> } };
        },
        enabled: !!selectedRtomId
    });

    const { data: contractors = [] } = useQuery<Contractor[]>({
        queryKey: ["contractors", selectedRtomId],
        queryFn: async () => {
            if (!selectedRtomId) return [];
            const res = await fetch(`/api/contractors?rtomId=${selectedRtomId}`);
            const data = (await res.json()) as { items: Contractor[] };
            return data.items || [];
        },
        enabled: !!selectedRtomId
    });

    const { data: inventoryItems = [] } = useQuery<InventoryItem[]>({
        queryKey: ["inventory-items"],
        queryFn: async () => {
             const res = await fetch("/api/inventory/items?page=1&limit=1000");
             const data = (await res.json()) as { items: InventoryItem[] };
             return (data.items || []) as InventoryItem[];
        }
    });

    const { data: systemConfigs = {} } = useQuery<Record<string, string>>({
        queryKey: ["system-configs"],
        queryFn: async () => {
            const res = await fetch("/api/system-config");
            return await res.json() as Record<string, string>;
        }
    });

    const serviceOrders: ServiceOrder[] = Array.isArray(qData?.items) ? qData!.items : [];
    const summary = qData?.summary || { totalSod: 0, contractorAssigned: 0, appointments: 0, statusBreakdown: {} };
    
    // Explicit array cast for safety
    const safeOpmcs: OPMC[] = React.useMemo(() => Array.isArray(opmcs) ? opmcs : [], [opmcs]);

    const { selectedIds, toggleSelect, toggleAll, isAllSelected } = useSODTable(serviceOrders);

    useEffect(() => {
        // Only set default if one isn't already set and we have OPMCs
        if (safeOpmcs.length > 0 && !selectedRtomId && !hasSetDefault.current) {
            const firstOpmc = safeOpmcs[0];
            hasSetDefault.current = true;
            // Use setTimeout to avoid synchronous setState warning and cascading renders
            setTimeout(() => {
                setSelectedRtomId(firstOpmc.id);
                setSelectedRtom(firstOpmc.rtom);
            }, 0);
        }
    }, [safeOpmcs, selectedRtomId]);

    const handleOpmcChange = (value: string) => {
        const opmc = safeOpmcs.find(o => o.id === value);
        if (opmc) {
            setSelectedRtomId(value);
            setSelectedRtom(opmc.rtom);
        }
    };

    const handleBulkAction = (action: string) => {
        if (selectedIds.size === 0) return;
        toast.info(`Applying ${action} to ${selectedIds.size} orders...`);
        // TODO: Implement actual bulk API call
    };

    const requestSort = (key: keyof ServiceOrder) => {
        let direction: "asc" | "desc" = "asc";
        if (sortConfig && sortConfig.key === key && sortConfig.direction === "asc") direction = "desc";
        setSortConfig({ key, direction });
    };

    return (
        <div className="h-screen flex bg-background text-foreground overflow-hidden">
            <Sidebar />
            <main className="flex-1 flex flex-col min-w-0 h-full">
                <Header />
                <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
                    <div className="flex-none px-4 py-2.5 space-y-2.5">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                            <div>
                                <div className="flex items-center gap-2">
                                    <Layers className="w-5 h-5 text-primary" />
                                    <h1 className="text-xl font-bold text-foreground tracking-tight">{pageTitle}</h1>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-6 w-6 text-muted-foreground hover:text-foreground ml-1"
                                        onClick={() => {
                                            const newVal = !showMetrics;
                                            setShowMetrics(newVal);
                                            localStorage.setItem('sod_show_metrics', String(newVal));
                                        }}
                                        title={showMetrics ? "Hide Summary Metrics" : "Show Summary Metrics"}
                                    >
                                        {showMetrics ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                    </Button>
                                </div>
                                <p className="text-[10px] uppercase tracking-widest font-black text-muted-foreground mt-0.5">Service Order Management</p>
                            </div>
                            <div className="flex items-center gap-2">
                                <Button
                                    variant={isSheetMode ? "default" : "outline"}
                                    size="sm"
                                    className={`h-8 font-bold shadow-sm ${
                                        isSheetMode 
                                            ? 'bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30' 
                                            : 'border-border/40 hover:bg-muted text-foreground'
                                    }`}
                                    onClick={toggleSheetMode}
                                >
                                    <FileSpreadsheet className="w-3.5 h-3.5 mr-2" />
                                    {isSheetMode ? 'Standard View' : 'Google Sheet Mode'}
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-8 shadow-sm border-border/40 hover:bg-muted"
                                    onClick={() => syncMutation.mutate()}
                                    disabled={!selectedRtomId || syncMutation.isPending}
                                >
                                    <RefreshCw className={`w-3.5 h-3.5 mr-2 ${syncMutation.isPending ? 'animate-spin' : ''}`} />
                                    Update from Portal
                                </Button>
                                {filterType === 'pending' && <Button size="sm" className="h-8 bg-primary hover:bg-primary-dark text-white font-bold shadow-sm" onClick={() => setShowManualModal(true)} disabled={!selectedRtomId}><Plus className="w-3.5 h-3.5 mr-2" /> Manual Entry</Button>}
                                {filterType === 'pending' && <Button variant="outline" size="sm" className="h-8 border-emerald-500/20 text-emerald-400 bg-emerald-500/5 hover:bg-emerald-500/10 shadow-sm" onClick={() => setShowExcelModal(true)}><FileSpreadsheet className="w-3.5 h-3.5 mr-2" /> Excel Import</Button>}
                            </div>
                        </div>

                        {showMetrics && (
                            <SODSummary filterType={filterType} summary={summary} missingCount={serviceOrders.filter((o: ServiceOrder) => o.comments?.includes('[MISSING FROM SYNC')).length} />
                        )}

                        <div className="bg-card p-2 rounded-xl border border-border/40 shadow-sm flex flex-wrap gap-2 items-center">
                             <div className="flex items-center gap-2 px-2 py-1 bg-muted rounded-lg border border-border/20">
                                 <Filter className="w-3.5 h-3.5 text-muted-foreground" />
                                 <Select value={selectedRtomId} onValueChange={handleOpmcChange}>
                                     <SelectTrigger className="h-8 border-none bg-transparent w-[140px] focus:ring-0 shadow-none font-bold text-xs"><SelectValue placeholder="RTOM" /></SelectTrigger>
                                     <SelectContent>
                                         {safeOpmcs.length > 0 ? safeOpmcs.map(o => <SelectItem key={o.id} value={o.id} className="text-xs">{o.rtom}</SelectItem>) : <SelectItem value="error" disabled>No RTOMs Available</SelectItem>}
                                     </SelectContent>
                                 </Select>
                             </div>

                             <div className="flex-1 relative flex items-center min-w-[200px]">
                                 <Search className="absolute left-3 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                                 <Input placeholder="Search orders, customers, numbers..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="h-8 pl-9 bg-muted/30 border-border/40 text-xs" />
                             </div>

                             <div className="flex items-center gap-2">
                                 <Select value={statusFilter} onValueChange={setStatusFilter}>
                                     <SelectTrigger className="h-8 w-[150px] border-border/40 bg-card text-xs font-semibold"><SelectValue /></SelectTrigger>
                                     <SelectContent>
                                         <SelectItem value="DEFAULT" className="text-xs">Filter by Status</SelectItem>
                                         <SelectItem value="ALL" className="text-xs">Show All</SelectItem>
                                         <SelectItem value="INPROGRESS" className="text-xs">In Progress</SelectItem>
                                         <SelectItem value="RETURN" className="text-xs text-rose-500 font-bold dark:text-rose-400">Returned/Issues</SelectItem>
                                     </SelectContent>
                                 </Select>
                             </div>
                        </div>
                    </div>

                    <div className="flex-1 mx-4 mb-4 bg-card rounded-2xl border border-border/40 shadow-sm flex flex-col min-h-0 overflow-hidden relative">
                        {/* Bulk Action Overlay */}
                        {selectedIds.size > 0 && (
                            <div className="absolute top-2 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white px-6 py-2 rounded-full shadow-2xl flex items-center gap-4 animate-in fade-in slide-in-from-top-4">
                                <span className="text-xs font-bold border-r border-slate-700 pr-4">{selectedIds.size} Items Selected</span>
                                <div className="flex items-center gap-2">
                                    <Button variant="ghost" size="sm" className="h-7 text-[10px] font-bold uppercase hover:bg-slate-800 text-white" onClick={() => handleBulkAction('ASSIGN')}>Assign Team</Button>
                                    <Button variant="ghost" size="sm" className="h-7 text-[10px] font-bold uppercase hover:bg-slate-800 text-emerald-400" onClick={() => handleBulkAction('COMPLETE')}>Bulk Complete</Button>
                                    <Button variant="ghost" size="sm" className="h-7 text-[10px] font-bold uppercase hover:bg-slate-800 text-rose-400" onClick={() => handleBulkAction('DELETE')}>Remove</Button>
                                    <button onClick={() => toggleAll()} className="ml-2 p-1 hover:bg-slate-800 rounded"><Activity className="w-4 h-4" /></button>
                                </div>
                            </div>
                        )}

                        <div className="flex-1 overflow-auto custom-scrollbar flex flex-col">
                            {isLoadingOrders ? (
                                <div className="flex items-center justify-center h-full p-20 text-muted-foreground flex-1">
                                    <div className="text-center">
                                        <RefreshCw className="w-10 h-10 animate-spin mx-auto mb-4 opacity-20 text-primary" />
                                        <p className="font-bold text-xs uppercase tracking-widest animate-pulse">Loading Service Orders...</p>
                                    </div>
                                </div>
                            ) : isSheetMode ? (
                                <SODSheetTable
                                    orders={serviceOrders}
                                    filterType={filterType}
                                    contractors={contractors}
                                    selectedIds={selectedIds}
                                    toggleSelect={toggleSelect}
                                    toggleAll={toggleAll}
                                    isAllSelected={isAllSelected}
                                    onSort={requestSort}
                                    sortConfig={sortConfig}
                                    onUpdateField={async (id, data) => {
                                        return updateStatusMutation.mutateAsync({ id, ...data });
                                    }}
                                    onOpenModal={(order, type) => {
                                        setSelectedOrder(order);
                                        if (type === 'detail') setShowDetailModal(true);
                                        if (type === 'schedule') setShowScheduleModal(true);
                                        if (type === 'comment') setShowCommentModal(true);
                                        if (type === 'action') setShowActionModal(true);
                                    }}
                                />
                            ) : (
                                <table className="w-full text-[10px] text-left">
                                    <thead className="bg-muted border-b border-border/40 sticky top-0 z-40 backdrop-blur-md">
                                        <tr className="text-muted-foreground font-bold uppercase tracking-tight text-[9px]">
                                            <th className="px-2 py-3 w-10 text-center md:sticky md:left-0 bg-muted z-50 shadow-[1px_0_0_0_var(--color-border)]">
                                                <Checkbox checked={isAllSelected} onCheckedChange={() => toggleAll()} className="border-border/40 data-[state=checked]:bg-primary" />
                                            </th>
                                            {isColumnVisible('soNum') && <th className="px-1.5 py-3 cursor-pointer hover:bg-muted/80 transition-colors md:sticky md:left-10 bg-muted z-50 shadow-[1px_0_0_0_var(--color-border)] w-[110px]" onClick={() => requestSort('soNum')}>SO Number</th>}
                                            
                                            {filterType === 'completed' ? (
                                                <>
                                                    {isColumnVisible('completedDate') && <th className="px-1.5 py-3 md:sticky md:left-[150px] bg-emerald-500/10 z-50 shadow-[1px_0_0_0_var(--color-border)] w-[85px] text-emerald-450 dark:text-emerald-400">Completed</th>}
                                                    {isColumnVisible('lea') && <th className="px-1.5 py-3 md:sticky md:left-[235px] bg-muted z-50 shadow-[1px_0_0_0_var(--color-border)] w-[50px]">LEA</th>}
                                                    {isColumnVisible('customerName') && <th className="px-1.5 py-3 md:sticky md:left-[285px] bg-muted z-50 shadow-[1px_0_0_0_var(--color-border)] w-[160px]">Customer</th>}
                                                    {isColumnVisible('contractor') && <th className="px-2 py-3 bg-muted/40 border-b border-border/40">Team & Material Usage</th>}
                                                    <th className="px-2 py-3 bg-muted/40 border-b border-border/40">Completion Details</th>
                                                </>
                                            ) : (
                                                <>
                                                    {isColumnVisible('statusDate') && <th className="px-1.5 py-3 md:sticky md:left-[150px] bg-muted z-50 shadow-[1px_0_0_0_var(--color-border)] w-[75px]">Received</th>}
                                                    {isColumnVisible('lea') && <th className="px-1.5 py-3 md:sticky md:left-[225px] bg-muted z-50 shadow-[1px_0_0_0_var(--color-border)] w-[50px]">LEA</th>}
                                                    {isColumnVisible('customerName') && <th className="px-1.5 py-3 md:sticky md:left-[275px] bg-muted z-50 shadow-[1px_0_0_0_var(--color-border)] w-[160px]">Customer</th>}
                                                    {isColumnVisible('voiceNumber') && <th className="px-1.5 py-3 md:sticky md:left-[435px] bg-muted z-50 shadow-[1px_0_0_0_var(--color-border)] w-[90px]">Voice/TP</th>}
                                                    <th className="px-2 py-3 bg-muted/40 border-b border-border/40 text-primary">Details (Order/Task/DP)</th>
                                                    <th className="px-2 py-3 bg-muted/40 border-b border-border/40">Status & Assignment</th>
                                                </>
                                            )}
                                            
                                            <th className="px-2 py-3 md:sticky md:right-0 bg-muted z-50 shadow-[-1px_0_0_0_var(--color-border)] w-[60px] text-center"></th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border/20 italic-last-update">
                                        {Array.isArray(serviceOrders) && serviceOrders.length > 0 ? (
                                            serviceOrders.map((order: ServiceOrder) => (
                                                <React.Fragment key={order.id}>
                                                    {filterType === 'completed' ? (
                                                        <tr className={`group hover:bg-primary/[0.02] dark:hover:bg-primary/[0.04] transition-colors border-t border-border/10 ${selectedIds.has(order.id) ? 'bg-primary/5' : ''}`}>
                                                            <td className="px-1.5 py-4 text-center md:sticky md:left-0 bg-card z-20 group-hover:bg-primary/[0.02] dark:group-hover:bg-primary/[0.04] border-r border-border/10">
                                                                <Checkbox checked={selectedIds.has(order.id)} onCheckedChange={() => toggleSelect(order.id)} className="border-border/40" />
                                                            </td>
                                                            <td className="px-1.5 py-4 font-mono font-bold text-foreground text-[11px] md:sticky md:left-10 bg-card z-20 group-hover:bg-primary/[0.02] dark:group-hover:bg-primary/[0.04] border-r border-border/10">
                                                                <div className="cursor-pointer hover:text-primary transition-colors" onClick={() => { setSelectedOrder(order); setShowDetailModal(true); }}>{order.soNum}</div>
                                                            </td>
                                                            <td className="px-1.5 py-4 md:sticky md:left-[150px] bg-card z-20 group-hover:bg-primary/[0.02] dark:group-hover:bg-primary/[0.04] border-r border-border/10">
                                                                <div className="font-black text-emerald-500 text-[11.5px]">{order.completedDate ? new Date(order.completedDate).toLocaleDateString('en-GB') : '-'}</div>
                                                                <div className="text-[9px] text-muted-foreground font-bold uppercase">{order.completedDate ? new Date(order.completedDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'DONE'}</div>
                                                            </td>
                                                            <td className="px-1.5 py-4 md:sticky md:left-[235px] bg-card z-20 group-hover:bg-primary/[0.02] dark:group-hover:bg-primary/[0.04] border-r border-border/10 text-center">
                                                                <span className="px-1 py-0.5 bg-muted rounded text-foreground text-[10px] font-black border border-border/10">{order.lea || '-'}</span>
                                                            </td>
                                                            <td className="px-1.5 py-4 font-bold text-foreground text-[11px] md:sticky md:left-[285px] bg-card z-20 group-hover:bg-primary/[0.02] dark:group-hover:bg-primary/[0.04] border-r border-border/10 truncate max-w-[160px]" title={order.customerName || undefined}>
                                                                {order.customerName || '-'}
                                                            </td>
                                                            
                                                            {/* COMPLETED SPECIFIC COLS */}
                                                            <td className="px-2 py-4">
                                                                <div className="flex flex-col gap-1">
                                                                    <div className="flex items-center gap-1.5">
                                                                        <span className="text-[10px] font-black text-blue-400 uppercase bg-blue-500/10 px-1.5 py-0.5 rounded border border-blue-500/20">
                                                                            {order.contractor?.name || order.directTeam || 'N/A'}
                                                                        </span>
                                                                        <span className="text-muted-foreground/60 font-bold">/</span>
                                                                        <span className="text-[10px] text-foreground/80 font-bold">{order.voiceNumber || '-'}</span>
                                                                    </div>
                                                                    <div className="flex items-center gap-1 text-[9px]">
                                                                        <FileSpreadsheet className="w-2.5 h-2.5 text-muted-foreground/60" />
                                                                         <span className="text-muted-foreground font-bold">Materials:</span>
                                                                         <div className="flex flex-wrap gap-1">
                                                                             {order.materialUsage && order.materialUsage.length > 0 ? (
                                                                                 order.materialUsage.slice(0, 3).map((m, i) => (
                                                                                     <span key={i} className="text-[9px] bg-emerald-500/10 text-emerald-400 px-1 rounded border border-emerald-500/20 font-black">
                                                                                         {m.item?.name || m.itemId}
                                                                                     </span>
                                                                                 ))
                                                                             ) : (
                                                                                 <span className="text-muted-foreground/60 font-medium italic">NONE</span>
                                                                             )}
                                                                             {order.materialUsage && order.materialUsage.length > 3 && (
                                                                                 <span className="text-[9px] text-muted-foreground">+{order.materialUsage.length - 3}</span>
                                                                             )}
                                                                         </div>
                                                                     </div>
                                                                </div>
                                                            </td>
                                                            <td className="px-2 py-4">
                                                                <div className="flex flex-col gap-1">
                                                                    <div className="flex items-center gap-2">
                                                                        <span className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Serial:</span>
                                                                        <span className="text-[10px] font-mono font-bold text-foreground">{order.ontSerialNumber || 'N/A'}</span>
                                                                    </div>
                                                                    <div className="flex items-center gap-2">
                                                                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase ${
                                                                            order.completionMode === 'ONLINE' ? 'bg-indigo-500/15 text-indigo-400 border border-indigo-500/20' : 'bg-muted text-muted-foreground border border-border/20'
                                                                        }`}>{order.completionMode || 'OFFLINE'}</span>
                                                                        {order.dropWireDistance && <span className="text-[9px] font-bold text-muted-foreground">{order.dropWireDistance}M WIRE</span>}
                                                                    </div>
                                                                </div>
                                                            </td>

                                                             <td className="px-1 py-4 text-center md:sticky md:right-0 bg-card z-20 group-hover:bg-primary/[0.02] dark:group-hover:bg-primary/[0.04] border-l border-border/10 shadow-[-2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                                                                 <div className="flex items-center gap-1 justify-center">
                                                                     <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => { setSelectedOrder(order); setShowDetailModal(true); }}><Info className="w-3.5 h-3.5 text-slate-400" /></Button>
                                                                     <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => { setSelectedOrder(order); setShowActionModal(true); }}><RefreshCw className="w-3.5 h-3.5 text-blue-600" /></Button>
                                                                     <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => { setSelectedOrder(order); setShowCommentModal(true); }}><MessageSquare className={`w-3.5 h-3.5 ${order.comments ? 'text-amber-500' : 'text-slate-300'}`} /></Button>
                                                                 </div>
                                                             </td>
                                                        </tr>
                                                    ) : (
                                                         <>
                                                             {/* PENDING VIEW (Stacked Two-Row Layout) */}
                                                             <tr className={`group hover:bg-primary/[0.02] dark:hover:bg-primary/[0.04] transition-colors border-t border-border/10 ${selectedIds.size > 0 && selectedIds.has(order.id) ? 'bg-primary/5' : ''}`}>
                                                                 <td rowSpan={2} className="px-1.5 py-3 text-center md:sticky md:left-0 bg-card z-20 group-hover:bg-primary/[0.02] dark:group-hover:bg-primary/[0.04] border-r border-border/10">
                                                                     <Checkbox checked={selectedIds.has(order.id)} onCheckedChange={() => toggleSelect(order.id)} className="border-border/40" />
                                                                 </td>
                                                                 <td rowSpan={2} className="px-1.5 py-3 font-mono font-bold text-foreground text-[11.5px] md:sticky md:left-10 bg-card z-20 group-hover:bg-primary/[0.02] dark:group-hover:bg-primary/[0.04] border-r border-border/10 cursor-pointer" onClick={() => { setSelectedOrder(order); setShowDetailModal(true); }}>
                                                                     <div className="group-hover:text-primary transition-colors uppercase">{order.soNum}</div>
                                                                     <div className="text-[8.5px] text-muted-foreground font-normal flex items-center gap-0.5 mt-0.5">
                                                                         <Activity className="w-2.5 h-2.5 opacity-60" />{order.id.slice(-6)}
                                                                     </div>
                                                                 </td>
                                                                 <td rowSpan={2} className="px-1.5 py-3 md:sticky md:left-[150px] bg-card z-20 group-hover:bg-primary/[0.02] dark:group-hover:bg-primary/[0.04] border-r border-border/10">
                                                                     <div className="font-bold text-foreground text-[11px]">{order.statusDate ? new Date(order.statusDate).toLocaleDateString('en-GB') : '-'}</div>
                                                                     <div className="text-[8.5px] uppercase text-muted-foreground font-bold">Recvd</div>
                                                                 </td>
                                                                 <td rowSpan={2} className="px-1.5 py-3 md:sticky md:left-[225px] bg-card z-20 group-hover:bg-primary/[0.02] dark:group-hover:bg-primary/[0.04] border-r border-border/10 text-center">
                                                                     <span className="px-1 py-0.5 bg-muted rounded text-foreground text-[11px] font-black border border-border/10 italic">{order.lea || '-'}</span>
                                                                 </td>
                                                                 <td rowSpan={2} className="px-1.5 py-3 md:sticky md:left-[275px] bg-card z-20 group-hover:bg-primary/[0.02] dark:group-hover:bg-primary/[0.04] border-r border-border/10 truncate max-w-[160px]" title={order.customerName || undefined}>
                                                                     {order.customerName || '-'}
                                                                 </td>
                                                                 <td rowSpan={2} className="px-1.5 py-3 md:sticky md:left-[435px] bg-card z-20 group-hover:bg-primary/[0.02] dark:group-hover:bg-primary/[0.04] border-r border-border/10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                                                                     {order.voiceNumber || '-'}
                                                                 </td>
                                                                 
                                                                 <td className="px-1.5 py-2 border-b border-border/10">
                                                                     <div className="flex items-center gap-1.5 flex-wrap">
                                                                          <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border-blue-200/50 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20 font-black uppercase text-[9px] border">{order.orderType || 'N/A'}</span>
                                                                          <span className="text-muted-foreground font-black text-[9.5px] uppercase">{order.package || '-'}</span>
                                                                          {order.woroTaskName && <span className="text-amber-700 dark:text-amber-400 font-black uppercase text-[9px] bg-amber-50 dark:bg-amber-500/10 border border-amber-200/50 dark:border-amber-500/20 px-1.5 rounded">{order.woroTaskName}</span>}
                                                                         {order.dp && <span className="font-mono text-muted-foreground/60 text-[9px] font-bold border-l border-border/10 pl-1.5">DP: {order.dp}</span>}
                                                                     </div>
                                                                 </td>
                                                                 <td className="px-1.5 py-2 border-b border-border/10">
                                                                     <div className="flex flex-col gap-0.5">
                                                                         <span className="text-muted-foreground text-[10px] truncate max-w-[220px] font-medium italic opacity-75" title={order.address || undefined}>{order.address}</span>
                                                                         {order.techContact && (
                                                                             <span className="flex items-center gap-1 text-muted-foreground font-mono text-[9px] font-bold uppercase tracking-tighter">
                                                                                 <Activity className="w-2.5 h-2.5 opacity-30" />{order.techContact}
                                                                             </span>
                                                                         )}
                                                                     </div>
                                                                 </td>
                                                                 <td className="px-1 py-2 text-center md:sticky md:right-0 bg-card z-20 group-hover:bg-primary/[0.02] dark:group-hover:bg-primary/[0.04] border-l border-b border-border/10 shadow-[-2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                                                                     <div className="flex items-center gap-0.5 justify-center">
                                                                         <Button size="icon" variant="ghost" className="h-5 w-5 hover:bg-blue-500/10" title="Details" onClick={() => { setSelectedOrder(order); setShowDetailModal(true); }}><Info className="w-3.5 h-3.5 text-muted-foreground/60" /></Button>
                                                                         <Button size="icon" variant="ghost" className="h-5 w-5 hover:bg-indigo-500/10" title="Schedule" onClick={() => { setSelectedOrder(order); setShowScheduleModal(true); }}><Calendar className="w-3.5 h-3.5 text-indigo-400" /></Button>
                                                                     </div>
                                                                 </td>
                                                             </tr>
                                                             <tr className={`group hover:bg-primary/[0.02] dark:hover:bg-primary/[0.04] transition-colors ${selectedIds.has(order.id) ? 'bg-primary/5' : ''}`}>
                                                                 <td className="px-1.5 py-2.5 border-b border-border/10">
                                                                     <div className="flex items-center gap-2">
                                                                          <span className={`px-2 py-0.5 rounded-full font-black text-[9px] uppercase border ${getStatusColorClass(order.status)}`}>{order.status}</span>
                                                                         {order.scheduledDate && (
                                                                             <span className="flex items-center gap-1 text-[9px] font-black text-indigo-400 bg-indigo-500/10 px-1.5 py-0.5 rounded border border-indigo-500/20 uppercase tracking-tighter">
                                                                                 <Calendar className="w-2.5 h-2.5" /> {new Date(order.scheduledDate).toLocaleDateString()}
                                                                             </span>
                                                                         )}
                                                                     </div>
                                                                 </td>
                                                                 <td className="px-1.5 py-2.5 border-b border-border/10">
                                                                     <div className="flex items-center gap-1.5">
                                                                         <Select value={order.sltsStatus} onValueChange={(val) => updateStatusMutation.mutate({ id: order.id, sltsStatus: val })}>
                                                                             <SelectTrigger className="h-5 text-[9px] w-[90px] font-black border-border/40 bg-card px-1 shadow-none transition-all hover:border-primary/40 focus:ring-1 focus:ring-primary/10"><SelectValue /></SelectTrigger>
                                                                             <SelectContent>
                                                                                 <SelectItem value="PENDING" className="text-[10px] font-black">PENDING</SelectItem>
                                                                                 <SelectItem value="ASSIGNED" className="text-[10px] font-black">ASSIGNED</SelectItem>
                                                                                 <SelectItem value="INPROGRESS" className="text-[10px] font-black">IN PROGRESS</SelectItem>
                                                                                 <SelectItem value="COMPLETED" className="text-[10px] font-black text-emerald-400">COMPLETED</SelectItem>
                                                                                 <SelectItem value="RETURN" className="text-[10px] font-black text-rose-400">RETURN</SelectItem>
                                                                             </SelectContent>
                                                                         </Select>
                                                                         {order.contractor && (
                                                                             <div className="flex items-center gap-1">
                                                                                 <span className="text-blue-400 font-black text-[10px] uppercase bg-blue-500/10 px-1.5 py-0.5 rounded border border-blue-500/20">[{order.contractor.name}]</span>
                                                                             </div>
                                                                         )}
                                                                     </div>
                                                                 </td>
                                                                 <td className="px-1 py-2 text-center md:sticky md:right-0 bg-card z-20 group-hover:bg-primary/[0.02] dark:group-hover:bg-primary/[0.04] border-l border-b border-border/10 shadow-[-2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                                                                     <div className="flex items-center gap-1 justify-center">
                                                                         <div className="relative">
                                                                             <Button size="icon" variant="ghost" className={`h-6 w-6 rounded-full ${order.comments ? 'bg-amber-500/10 hover:bg-amber-500/20' : 'hover:bg-muted'}`} onClick={() => { setSelectedOrder(order); setShowCommentModal(true); }}>
                                                                                 <MessageSquare className={`w-3.5 h-3.5 ${order.comments ? 'text-amber-400' : 'text-muted-foreground/40'}`} />
                                                                                 {order.comments && <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-amber-500 ring-1 ring-card" />}
                                                                             </Button>
                                                                         </div>
                                                                         <Button size="icon" variant="ghost" className="h-6 w-6 rounded-full hover:bg-emerald-500/10" onClick={() => { setSelectedOrder(order); setShowActionModal(true); }}><CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /></Button>
                                                                     </div>
                                                                 </td>
                                                             </tr>
                                                         </>
                                                     )}
                                                </React.Fragment>
                                            ))
                                        ) : (
                                            <tr>
                                                <td colSpan={20} className="px-3 py-20 text-center text-muted-foreground">
                                                    <div className="flex flex-col items-center gap-2">
                                                        <AlertCircle className="w-8 h-8 opacity-20" />
                                                        <p className="font-bold text-xs uppercase tracking-widest">No Service Orders Found</p>
                                                        <p className="text-[10px] text-muted-foreground max-w-[200px] mx-auto italic">Try selecting a different RTOM or checking your connection.</p>
                                                    </div>
                                                </td>
                                            </tr>
                                        )}

                                    </tbody>
                                </table>

                            )}
                        </div>
                    </div>
                </div>

                <ManualEntryModal isOpen={showManualModal} onClose={() => setShowManualModal(false)} onSubmit={(data) => addOrderMutation.mutate(data)} />
                <ScheduleModal isOpen={showScheduleModal} onClose={() => setShowScheduleModal(false)} onSubmit={(data) => scheduleMutation.mutate({ orderId: selectedOrder?.id as string, data })} selectedOrder={selectedOrder} />
                <CommentModal isOpen={showCommentModal} onClose={() => setShowCommentModal(false)} onSubmit={(comment) => commentMutation.mutate({ orderId: selectedOrder?.id as string, comment })} selectedOrder={selectedOrder} />
                <DetailModal isOpen={showDetailModal} onClose={() => setShowDetailModal(false)} selectedOrder={selectedOrder} />
                <OrderActionModal 
                    isOpen={showActionModal} 
                    onClose={() => setShowActionModal(false)} 
                    orderData={selectedOrder as unknown as OrderActionData} 
                    contractors={contractors}
                    items={inventoryItems}
                    materialSource={systemConfigs['OSP_MATERIAL_SOURCE'] || 'SLT'}
                    onConfirm={(data: OrderCompletionData) => { 
                        if (selectedOrder?.id) {
                            const mutationData = { ...data, id: selectedOrder.id };
                            updateStatusMutation.mutate(mutationData); 
                        }
                        setShowActionModal(false); 
                    }} 
                    title={'COMPLETE ORDER'} 
                    isComplete 
                />
                <ExcelImportModal isOpen={showExcelModal} onClose={() => setShowExcelModal(false)} onImportSuccess={() => queryClient.invalidateQueries({ queryKey: ["service-orders"] })} />
            </main>
        </div>
    );
}

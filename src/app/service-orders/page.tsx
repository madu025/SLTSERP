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
import { RefreshCw, Plus, Activity, Layers, Filter, Search, Calendar, MessageSquare, CheckCircle2, FileSpreadsheet, Info, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { ServiceOrder } from "@/types/service-order";
import { OrderActionData } from "@/components/modals/order-action/types";

interface OPMC {
    id: string;
    rtom: string;
    name?: string;
}

import { useSODOperations } from "./hooks/useSODOperations";
import { useSODTable } from "./hooks/useSODTable";
import { SODSummary } from "./components/SODSummary";

const ManualEntryModal = dynamic(() => import("@/components/modals/ManualEntryModal"), { ssr: false });
const ScheduleModal = dynamic(() => import("@/components/modals/ScheduleModal"), { ssr: false });
const CommentModal = dynamic(() => import("@/components/modals/CommentModal"), { ssr: false });
const DetailModal = dynamic(() => import("@/components/modals/DetailModal"), { ssr: false });
const OrderActionModal = dynamic(() => import("@/components/modals/OrderActionModal"), { ssr: false });
const ExcelImportModal = dynamic(() => import("@/components/modals/ExcelImportModal"), { ssr: false });


export default function ServiceOrdersPage({ filterType = 'pending', pageTitle = 'Service Orders' }: { filterType?: 'pending' | 'completed' | 'return'; pageTitle?: string; }) {
    const queryClient = useQueryClient();
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
        <div className="h-screen flex bg-slate-50 overflow-hidden">
            <Sidebar />
            <main className="flex-1 flex flex-col min-w-0 h-full">
                <Header />
                <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
                    <div className="flex-none p-4 space-y-4">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                            <div>
                                <div className="flex items-center gap-2">
                                    <Layers className="w-5 h-5 text-blue-600" />
                                    <h1 className="text-xl font-bold text-slate-900 tracking-tight">{pageTitle}</h1>
                                </div>
                                <p className="text-[10px] uppercase tracking-widest font-black text-slate-400 mt-0.5">Service Order Management</p>
                            </div>
                            <div className="flex items-center gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-8 shadow-sm border-slate-200"
                                    onClick={() => syncMutation.mutate()}
                                    disabled={!selectedRtomId || syncMutation.isPending}
                                >
                                    <RefreshCw className={`w-3.5 h-3.5 mr-2 ${syncMutation.isPending ? 'animate-spin' : ''}`} />
                                    Update from Portal
                                </Button>
                                {filterType === 'pending' && <Button size="sm" className="h-8 bg-blue-600 hover:bg-blue-700 shadow-sm" onClick={() => setShowManualModal(true)} disabled={!selectedRtomId}><Plus className="w-3.5 h-3.5 mr-2" /> Manual Entry</Button>}
                                {filterType === 'pending' && <Button variant="outline" size="sm" className="h-8 border-emerald-200 text-emerald-700 hover:bg-emerald-50 shadow-sm" onClick={() => setShowExcelModal(true)}><FileSpreadsheet className="w-3.5 h-3.5 mr-2" /> Excel Import</Button>}
                            </div>
                        </div>

                        <SODSummary filterType={filterType} summary={summary} missingCount={serviceOrders.filter((o: ServiceOrder) => o.comments?.includes('[MISSING FROM SYNC')).length} />

                        <div className="bg-white p-2 rounded-xl border shadow-sm flex flex-wrap gap-2 items-center">
                             <div className="flex items-center gap-2 px-2 py-1 bg-slate-50 rounded-lg border border-slate-100">
                                 <Filter className="w-3.5 h-3.5 text-slate-400" />
                                 <Select value={selectedRtomId} onValueChange={handleOpmcChange}>
                                     <SelectTrigger className="h-8 border-none bg-transparent w-[140px] focus:ring-0 shadow-none font-bold text-xs"><SelectValue placeholder="RTOM" /></SelectTrigger>
                                     <SelectContent>
                                         {safeOpmcs.length > 0 ? safeOpmcs.map(o => <SelectItem key={o.id} value={o.id} className="text-xs">{o.rtom}</SelectItem>) : <SelectItem value="error" disabled>No RTOMs Available</SelectItem>}
                                     </SelectContent>
                                 </Select>
                             </div>

                             <div className="flex-1 relative flex items-center min-w-[200px]">
                                 <Search className="absolute left-3 w-4 h-4 text-slate-400 pointer-events-none" />
                                 <Input placeholder="Search orders, customers, numbers..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="h-10 pl-9 bg-slate-50/50 border-slate-200" />
                             </div>

                             <div className="flex items-center gap-2">
                                 <Select value={statusFilter} onValueChange={setStatusFilter}>
                                     <SelectTrigger className="h-10 w-[160px] border-slate-200 bg-white"><SelectValue /></SelectTrigger>
                                     <SelectContent>
                                         <SelectItem value="DEFAULT">Filter by Status</SelectItem>
                                         <SelectItem value="ALL">Show All</SelectItem>
                                         <SelectItem value="INPROGRESS">In Progress</SelectItem>
                                         <SelectItem value="RETURN" className="text-rose-600">Returned/Issues</SelectItem>
                                     </SelectContent>
                                 </Select>
                             </div>
                        </div>
                    </div>

                    <div className="flex-1 mx-4 mb-4 bg-white rounded-2xl border shadow-sm flex flex-col min-h-0 overflow-hidden relative">
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

                        <div className="flex-1 overflow-auto custom-scrollbar">
                            {isLoadingOrders ? (
                                <div className="flex items-center justify-center h-full p-20 text-slate-400">
                                    <div className="text-center">
                                        <RefreshCw className="w-10 h-10 animate-spin mx-auto mb-4 opacity-20 text-blue-600" />
                                        <p className="font-bold text-xs uppercase tracking-widest animate-pulse">Loading Service Orders...</p>
                                    </div>
                                </div>
                            ) : (
                                <table className="w-full text-[10px] text-left">
                                    <thead className="bg-[#fcfdff] border-b sticky top-0 z-40 backdrop-blur-md">
                                        <tr className="text-slate-500 font-bold uppercase tracking-tight text-[9px]">
                                            <th className="px-2 py-3 w-10 text-center sticky left-0 bg-[#fcfdff] z-50 shadow-[1px_0_0_0_rgba(0,0,0,0.05)]">
                                                <Checkbox checked={isAllSelected} onCheckedChange={() => toggleAll()} className="border-slate-300 data-[state=checked]:bg-blue-600" />
                                            </th>
                                            {isColumnVisible('soNum') && <th className="px-1.5 py-3 cursor-pointer hover:bg-slate-50 transition-colors sticky left-10 bg-[#fcfdff] z-50 shadow-[1px_0_0_0_rgba(0,0,0,0.05)] w-[110px]" onClick={() => requestSort('soNum')}>SO Number</th>}
                                            
                                            {filterType === 'completed' ? (
                                                <>
                                                    {isColumnVisible('completedDate') && <th className="px-1.5 py-3 sticky left-[150px] bg-emerald-50/30 z-50 shadow-[1px_0_0_0_rgba(0,0,0,0.05)] w-[85px] text-emerald-700">Completed</th>}
                                                    {isColumnVisible('lea') && <th className="px-1.5 py-3 sticky left-[235px] bg-[#fcfdff] z-50 shadow-[1px_0_0_0_rgba(0,0,0,0.05)] w-[50px]">LEA</th>}
                                                    {isColumnVisible('customerName') && <th className="px-1.5 py-3 sticky left-[285px] bg-[#fcfdff] z-50 shadow-[1px_0_0_0_rgba(0,0,0,0.05)] w-[160px]">Customer</th>}
                                                    {isColumnVisible('contractor') && <th className="px-2 py-3 bg-slate-50/50">Team & Material Usage</th>}
                                                    <th className="px-2 py-3 bg-slate-50/50">Completion Details</th>
                                                </>
                                            ) : (
                                                <>
                                                    {isColumnVisible('statusDate') && <th className="px-1.5 py-3 sticky left-[150px] bg-[#fcfdff] z-50 shadow-[1px_0_0_0_rgba(0,0,0,0.05)] w-[75px]">Received</th>}
                                                    {isColumnVisible('lea') && <th className="px-1.5 py-3 sticky left-[225px] bg-[#fcfdff] z-50 shadow-[1px_0_0_0_rgba(0,0,0,0.05)] w-[50px]">LEA</th>}
                                                    {isColumnVisible('customerName') && <th className="px-1.5 py-3 sticky left-[275px] bg-[#fcfdff] z-50 shadow-[1px_0_0_0_rgba(0,0,0,0.05)] w-[160px]">Customer</th>}
                                                    {isColumnVisible('voiceNumber') && <th className="px-1.5 py-3 sticky left-[435px] bg-[#fcfdff] z-50 shadow-[1px_0_0_0_rgba(0,0,0,0.05)] w-[90px]">Voice/TP</th>}
                                                    <th className="px-2 py-3 bg-slate-50/50 text-blue-600">Details (Order/Task/DP)</th>
                                                    <th className="px-2 py-3 bg-slate-50/50">Status & Assignment</th>
                                                </>
                                            )}
                                            
                                            <th className="px-2 py-3 sticky right-0 bg-[#fcfdff] z-50 shadow-[-1px_0_0_0_rgba(0,0,0,0.05)] w-[60px] text-center"></th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 italic-last-update">
                                        {Array.isArray(serviceOrders) && serviceOrders.length > 0 ? (
                                            serviceOrders.map((order: ServiceOrder) => (
                                                <React.Fragment key={order.id}>
                                                    {filterType === 'completed' ? (
                                                        <tr className={`group hover:bg-[#f8faff] transition-colors border-t border-slate-200 ${selectedIds.has(order.id) ? 'bg-blue-50/50' : ''}`}>
                                                            <td className="px-1.5 py-2 text-center sticky left-0 bg-white z-20 group-hover:bg-[#f8faff] border-r">
                                                                <Checkbox checked={selectedIds.has(order.id)} onCheckedChange={() => toggleSelect(order.id)} className="border-slate-200" />
                                                            </td>
                                                            <td className="px-1.5 py-2 font-mono font-bold text-slate-900 text-[11px] sticky left-10 bg-white z-20 group-hover:bg-[#f8faff] border-r">
                                                                <div className="cursor-pointer hover:text-blue-600" onClick={() => { setSelectedOrder(order); setShowDetailModal(true); }}>{order.soNum}</div>
                                                            </td>
                                                            <td className="px-1.5 py-2 sticky left-[150px] bg-white z-20 group-hover:bg-[#f8faff] border-r">
                                                                <div className="font-black text-emerald-700 text-[11.5px]">{order.completedDate ? new Date(order.completedDate).toLocaleDateString('en-GB') : '-'}</div>
                                                                <div className="text-[9px] text-slate-400 font-bold uppercase">{order.completedDate ? new Date(order.completedDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'DONE'}</div>
                                                            </td>
                                                            <td className="px-1.5 py-2 sticky left-[235px] bg-white z-20 group-hover:bg-[#f8faff] border-r text-center">
                                                                <span className="px-1 py-0.5 bg-slate-100 rounded text-slate-700 text-[10px] font-black">{order.lea || '-'}</span>
                                                            </td>
                                                            <td className="px-1.5 py-2 font-bold text-slate-900 text-[11px] sticky left-[285px] bg-white z-20 group-hover:bg-[#f8faff] border-r truncate max-w-[160px]" title={order.customerName || undefined}>
                                                                {order.customerName || '-'}
                                                            </td>
                                                            
                                                            {/* COMPLETED SPECIFIC COLS */}
                                                            <td className="px-2 py-2">
                                                                <div className="flex flex-col gap-1">
                                                                    <div className="flex items-center gap-1.5">
                                                                        <span className="text-[10px] font-black text-blue-700 uppercase bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100">
                                                                            {order.contractor?.name || order.directTeam || 'N/A'}
                                                                        </span>
                                                                        <span className="text-slate-400 font-bold">/</span>
                                                                        <span className="text-[10px] text-slate-600 font-bold">{order.voiceNumber || '-'}</span>
                                                                    </div>
                                                                    <div className="flex items-center gap-1 text-[9px]">
                                                                        <FileSpreadsheet className="w-2.5 h-2.5 text-slate-400" />
                                                                        <span className="text-slate-500 font-bold">Materials:</span>
                                                                        <span className="text-slate-900 font-black">{order.materialUsage?.length || 0} ITEMS</span>
                                                                    </div>
                                                                </div>
                                                            </td>
                                                            <td className="px-2 py-2">
                                                                <div className="flex flex-col gap-1">
                                                                    <div className="flex items-center gap-2">
                                                                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Serial:</span>
                                                                        <span className="text-[10px] font-mono font-bold text-slate-900">{order.ontSerialNumber || 'N/A'}</span>
                                                                    </div>
                                                                    <div className="flex items-center gap-2">
                                                                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase ${
                                                                            order.completionMode === 'ONLINE' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-600'
                                                                        }`}>{order.completionMode || 'OFFLINE'}</span>
                                                                        {order.dropWireDistance && <span className="text-[9px] font-bold text-slate-500">{order.dropWireDistance}M WIRE</span>}
                                                                    </div>
                                                                </div>
                                                            </td>

                                                            <td className="px-1 py-2 text-center sticky right-0 bg-white z-20 group-hover:bg-[#f8faff] border-l shadow-[-2px_0_5px_-2px_rgba(0,0,0,0.05)]">
                                                                <div className="flex items-center gap-1 justify-center">
                                                                    <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => { setSelectedOrder(order); setShowDetailModal(true); }}><Info className="w-3.5 h-3.5 text-slate-400" /></Button>
                                                                    <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => { setSelectedOrder(order); setShowCommentModal(true); }}><MessageSquare className={`w-3.5 h-3.5 ${order.comments ? 'text-amber-500' : 'text-slate-300'}`} /></Button>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    ) : (
                                                        <>
                                                            {/* PENDING VIEW (Stacked Two-Row Layout) */}
                                                            <tr className={`group hover:bg-[#f8faff] transition-colors border-t border-slate-200 ${selectedIds.size > 0 && selectedIds.has(order.id) ? 'bg-blue-50/50' : ''}`}>
                                                                <td rowSpan={2} className="px-1.5 py-0.5 text-center sticky left-0 bg-white z-20 group-hover:bg-[#f8faff] border-r">
                                                                    <Checkbox checked={selectedIds.has(order.id)} onCheckedChange={() => toggleSelect(order.id)} className="border-slate-200" />
                                                                </td>
                                                                <td rowSpan={2} className="px-1.5 py-0.5 font-mono font-bold text-slate-900 text-[11.5px] sticky left-10 bg-white z-20 group-hover:bg-[#f8faff] border-r cursor-pointer" onClick={() => { setSelectedOrder(order); setShowDetailModal(true); }}>
                                                                    <div className="group-hover:text-blue-600 transition-colors uppercase">{order.soNum}</div>
                                                                    <div className="text-[8.5px] text-slate-400 font-normal flex items-center gap-0.5 mt-0.5">
                                                                        <Activity className="w-2 h-2" />{order.id.slice(-6)}
                                                                    </div>
                                                                </td>
                                                                <td rowSpan={2} className="px-1.5 py-0.5 sticky left-[150px] bg-white z-20 group-hover:bg-[#f8faff] border-r">
                                                                    <div className="font-bold text-slate-900 text-[11px]">{order.statusDate ? new Date(order.statusDate).toLocaleDateString('en-GB') : '-'}</div>
                                                                    <div className="text-[8.5px] uppercase text-slate-400 font-bold">Recvd</div>
                                                                </td>
                                                                <td rowSpan={2} className="px-1.5 py-0.5 sticky left-[225px] bg-white z-20 group-hover:bg-[#f8faff] border-r text-center">
                                                                    <span className="px-1 py-0.5 bg-slate-100 rounded text-slate-700 text-[11px] font-black italic">{order.lea || '-'}</span>
                                                                </td>
                                                                <td rowSpan={2} className="px-1.5 py-0.5 font-bold text-slate-900 text-[11px] sticky left-[275px] bg-white z-20 group-hover:bg-[#f8faff] border-r truncate max-w-[160px]" title={order.customerName || undefined}>
                                                                    {order.customerName || '-'}
                                                                </td>
                                                                <td rowSpan={2} className="px-1.5 py-0.5 font-mono text-slate-600 text-[11px] font-bold sticky left-[435px] bg-white z-20 group-hover:bg-[#f8faff] border-r shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">
                                                                    {order.voiceNumber || '-'}
                                                                </td>
                                                                
                                                                <td className="px-1.5 py-0.5 border-b border-slate-100">
                                                                    <div className="flex items-center gap-1.5 flex-wrap">
                                                                        <span className="px-1.5 py-0.5 rounded bg-blue-100/50 text-blue-700 font-black uppercase text-[9px] border border-blue-100">{order.orderType || 'N/A'}</span>
                                                                        <span className="text-slate-500 font-black text-[9.5px] uppercase">{order.package || '-'}</span>
                                                                        {order.woroTaskName && <span className="text-amber-600 font-black uppercase text-[9px] bg-amber-50 px-1 rounded">{order.woroTaskName}</span>}
                                                                        {order.dp && <span className="font-mono text-slate-400 text-[9px] font-bold border-l border-slate-200 pl-1.5">DP: {order.dp}</span>}
                                                                    </div>
                                                                </td>
                                                                <td className="px-1.5 py-0.5 border-b border-slate-100">
                                                                    <div className="flex flex-col gap-0.5">
                                                                        <span className="text-slate-500 text-[10px] truncate max-w-[220px] font-medium italic opacity-70" title={order.address || undefined}>{order.address}</span>
                                                                        {order.techContact && (
                                                                            <span className="flex items-center gap-1 text-slate-400 font-mono text-[9px] font-bold uppercase tracking-tighter">
                                                                                <Activity className="w-2.5 h-2.5 opacity-30" />{order.techContact}
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                </td>
                                                                <td className="px-1 py-0.5 text-center sticky right-0 bg-white z-20 group-hover:bg-[#f8faff] border-l border-b border-slate-100 shadow-[-2px_0_5px_-2px_rgba(0,0,0,0.05)]">
                                                                    <div className="flex items-center gap-0.5 justify-center">
                                                                        <Button size="icon" variant="ghost" className="h-5 w-5 hover:bg-blue-50" title="Details" onClick={() => { setSelectedOrder(order); setShowDetailModal(true); }}><Info className="w-3.5 h-3.5 text-slate-400" /></Button>
                                                                        <Button size="icon" variant="ghost" className="h-5 w-5 hover:bg-indigo-50" title="Schedule" onClick={() => { setSelectedOrder(order); setShowScheduleModal(true); }}><Calendar className="w-3.5 h-3.5 text-indigo-400" /></Button>
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                            <tr className={`group hover:bg-[#f8faff] transition-colors ${selectedIds.has(order.id) ? 'bg-blue-50/50' : ''}`}>
                                                                <td className="px-1.5 py-3 border-b border-slate-100/50">
                                                                    <div className="flex items-center gap-2">
                                                                        <span className={`px-2 py-0.5 rounded-full font-black text-[9px] uppercase border ${
                                                                            order.status.includes('COMPLETED') ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                                                                            order.status.includes('RETURN') ? 'bg-rose-50 text-rose-700 border-rose-100' : 'bg-amber-50 text-amber-700 border-amber-100'
                                                                        }`}>{order.status}</span>
                                                                        {order.scheduledDate && (
                                                                            <span className="flex items-center gap-1 text-[9px] font-black text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100 uppercase tracking-tighter">
                                                                                <Calendar className="w-2.5 h-2.5" /> {new Date(order.scheduledDate).toLocaleDateString()}
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                </td>
                                                                <td className="px-1.5 py-3 border-b border-slate-100/50">
                                                                    <div className="flex items-center gap-1.5">
                                                                        <Select value={order.sltsStatus} onValueChange={(val) => updateStatusMutation.mutate({ id: order.id, sltsStatus: val })}>
                                                                            <SelectTrigger className="h-5 text-[9px] w-[90px] font-black border-slate-200 bg-white px-1 shadow-none transition-all hover:border-blue-300 focus:ring-1 focus:ring-blue-100"><SelectValue /></SelectTrigger>
                                                                            <SelectContent>
                                                                                <SelectItem value="PENDING" className="text-[10px] font-black">PENDING</SelectItem>
                                                                                <SelectItem value="ASSIGNED" className="text-[10px] font-black">ASSIGNED</SelectItem>
                                                                                <SelectItem value="INPROGRESS" className="text-[10px] font-black">IN PROGRESS</SelectItem>
                                                                                <SelectItem value="COMPLETED" className="text-[10px] font-black text-emerald-600">COMPLETED</SelectItem>
                                                                                <SelectItem value="RETURN" className="text-[10px] font-black text-rose-600">RETURN</SelectItem>
                                                                            </SelectContent>
                                                                        </Select>
                                                                        {order.contractor && (
                                                                            <div className="flex items-center gap-1">
                                                                                <span className="text-blue-700 font-black text-[10px] uppercase bg-blue-50 px-1 rounded">[{order.contractor.name}]</span>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </td>
                                                                <td className="px-1 py-1.5 text-center sticky right-0 bg-white z-20 group-hover:bg-[#f8faff] border-l border-b border-slate-100/50 shadow-[-2px_0_5px_-2px_rgba(0,0,0,0.05)]">
                                                                    <div className="flex items-center gap-1 justify-center">
                                                                        <div className="relative">
                                                                            <Button size="icon" variant="ghost" className={`h-6 w-6 rounded-full ${order.comments ? 'bg-amber-100/50 hover:bg-amber-100' : 'hover:bg-amber-50'}`} onClick={() => { setSelectedOrder(order); setShowCommentModal(true); }}>
                                                                                <MessageSquare className={`w-3.5 h-3.5 ${order.comments ? 'text-amber-600' : 'text-slate-300'}`} />
                                                                                {order.comments && <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-amber-500 ring-1 ring-white" />}
                                                                            </Button>
                                                                        </div>
                                                                        <Button size="icon" variant="ghost" className="h-6 w-6 rounded-full hover:bg-emerald-50" onClick={() => { setSelectedOrder(order); setShowActionModal(true); }}><CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /></Button>
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        </>
                                                    )}
                                                </React.Fragment>
                                            ))
                                        ) : (
                                            <tr>
                                                <td colSpan={20} className="px-3 py-20 text-center text-slate-400">
                                                    <div className="flex flex-col items-center gap-2">
                                                        <AlertCircle className="w-8 h-8 opacity-20" />
                                                        <p className="font-bold text-xs uppercase tracking-widest">No Service Orders Found</p>
                                                        <p className="text-[10px] text-slate-400 max-w-[200px] mx-auto italic">Try selecting a different RTOM or checking your connection.</p>
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
                <OrderActionModal isOpen={showActionModal} onClose={() => setShowActionModal(false)} orderData={selectedOrder as unknown as OrderActionData} onConfirm={(data: { date: Date; reason?: string; comment?: string }) => { if (selectedOrder?.id) updateStatusMutation.mutate({ ...data, id: selectedOrder.id }); setShowActionModal(false); }} title={'COMPLETE ORDER'} isComplete />
                <ExcelImportModal isOpen={showExcelModal} onClose={() => setShowExcelModal(false)} onImportSuccess={() => queryClient.invalidateQueries({ queryKey: ["service-orders"] })} />
            </main>
        </div>
    );
}

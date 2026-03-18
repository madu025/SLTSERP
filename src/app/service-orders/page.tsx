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
import { RefreshCw, Plus, Activity, Layers, Filter, Search, Calendar, MessageSquare, ChevronDown, CheckCircle2, FileSpreadsheet, Info } from "lucide-react";
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
    const { isColumnVisible } = useTableColumnSettings("pending_sod");
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

    const serviceOrders: ServiceOrder[] = qData?.items || [];
    const summary = qData?.summary || { totalSod: 0, contractorAssigned: 0, appointments: 0, statusBreakdown: {} };
    const { selectedIds, toggleSelect, toggleAll, isAllSelected } = useSODTable(serviceOrders);

    useEffect(() => {
        // Only set default if one isn't already set and we have OPMCs
        if (opmcs.length > 0 && !selectedRtomId && !hasSetDefault.current) {
            const firstOpmc = opmcs[0];
            hasSetDefault.current = true;
            // Use setTimeout to avoid synchronous setState warning and cascading renders
            setTimeout(() => {
                setSelectedRtomId(firstOpmc.id);
                setSelectedRtom(firstOpmc.rtom);
            }, 0);
        }
    }, [opmcs, selectedRtomId]);

    const handleOpmcChange = (value: string) => {
        const opmc = opmcs.find(o => o.id === value);
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
                                     <SelectContent>{opmcs.map(o => <SelectItem key={o.id} value={o.id} className="text-xs">{o.rtom}</SelectItem>)}</SelectContent>
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
                                <table className="w-full text-xs text-left">
                                    <thead className="bg-[#fcfdff] border-b sticky top-0 z-40 backdrop-blur-md">
                                        <tr className="text-slate-500 font-bold uppercase tracking-tight text-[10px]">
                                            <th className="px-4 py-4 w-12 text-center">
                                                <Checkbox checked={isAllSelected} onCheckedChange={() => toggleAll()} className="border-slate-300 data-[state=checked]:bg-blue-600" />
                                            </th>
                                            {isColumnVisible('soNum') && <th className="px-3 py-4 cursor-pointer hover:bg-slate-50 transition-colors" onClick={() => requestSort('soNum')}>
                                                <div className="flex items-center gap-1.5">Service Order No. <ChevronDown className="w-3 h-3 text-slate-300" /></div>
                                            </th>}
                                            {isColumnVisible('status') && <th className="px-3 py-4">Status</th>}
                                            <th className="px-3 py-4 text-right pr-6">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {serviceOrders.map((order: ServiceOrder) => (
                                            <tr key={order.id} className={`group hover:bg-[#f8faff] transition-colors ${selectedIds.has(order.id) ? 'bg-blue-50/50' : ''}`}>
                                                <td className="px-4 py-3 text-center">
                                                    <Checkbox checked={selectedIds.has(order.id)} onCheckedChange={() => toggleSelect(order.id)} className="border-slate-200 transition-transform group-hover:scale-110" />
                                                </td>
                                                <td className="px-3 py-3">
                                                    <div className="flex flex-col">
                                                        <span className="font-mono font-bold text-slate-900 group-hover:text-blue-600 transition-colors">{order.soNum}</span>
                                                        <span className="text-[9px] text-slate-500 font-medium truncate max-w-[150px]">{order.customerName || 'No Name'}</span>
                                                    </div>
                                                </td>
                                                <td className="px-3 py-3">
                                                    <Select value={order.sltsStatus} onValueChange={(val) => updateStatusMutation.mutate({ id: order.id, sltsStatus: val })}>
                                                        <SelectTrigger className="h-7 text-[10px] w-28 font-bold border-slate-200"><SelectValue /></SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="PENDING">Pending</SelectItem>
                                                            <SelectItem value="ASSIGNED">Assigned</SelectItem>
                                                            <SelectItem value="INPROGRESS">In Progress</SelectItem>
                                                            <SelectItem value="COMPLETED" className="text-emerald-600">Completed</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </td>
                                                <td className="px-3 py-3 text-right pr-6 flex justify-end items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <Button size="icon" variant="ghost" className="h-8 w-8 hover:bg-white hover:shadow-sm" onClick={() => { setSelectedOrder(order); setShowDetailModal(true); }}><Info className="w-3.5 h-3.5 text-slate-400" /></Button>
                                                    <Button size="icon" variant="ghost" className="h-8 w-8 hover:bg-white hover:shadow-sm" onClick={() => { setSelectedOrder(order); setShowScheduleModal(true); }}><Calendar className="w-3.5 h-3.5 text-slate-400" /></Button>
                                                    <Button size="icon" variant="ghost" className="h-8 w-8 hover:bg-white hover:shadow-sm" onClick={() => { setSelectedOrder(order); setShowCommentModal(true); }}><MessageSquare className="w-3.5 h-3.5 text-slate-400" /></Button>
                                                    <div className="w-[1px] h-4 bg-slate-200 mx-1" />
                                                    <Button size="icon" variant="ghost" className="h-8 w-8 hover:bg-emerald-50 hover:text-emerald-700" onClick={() => { setSelectedOrder(order); setShowActionModal(true); }}><CheckCircle2 className="w-3.5 h-3.5" /></Button>
                                                </td>
                                            </tr>
                                        ))}
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
                <OrderActionModal isOpen={showActionModal} onClose={() => setShowActionModal(false)} orderData={selectedOrder as unknown as OrderActionData} onConfirm={(data: { date: Date; reason?: string; comment?: string }) => { updateStatusMutation.mutate({ ...data, id: selectedOrder?.id }); setShowActionModal(false); }} title={'COMPLETE ORDER'} isComplete />
                <ExcelImportModal isOpen={showExcelModal} onClose={() => setShowExcelModal(false)} onImportSuccess={() => queryClient.invalidateQueries({ queryKey: ["service-orders"] })} />
            </main>
        </div>
    );
}

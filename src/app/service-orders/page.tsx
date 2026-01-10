"use client";

import React, { useState, useEffect, useMemo } from "react";
import dynamic from "next/dynamic";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import { useTableColumnSettings } from "@/hooks/useTableColumnSettings";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { RefreshCw, Plus, Calendar, MessageSquare, ArrowUpDown, ChevronLeft, ChevronRight, FileText, UserCheck, CalendarCheck, Activity, RotateCcw } from "lucide-react";
import { Form } from "@/components/ui/form";
import { toast } from "sonner";

const ManualEntryModal = dynamic(() => import("@/components/modals/ManualEntryModal"), { ssr: false });
const ScheduleModal = dynamic(() => import("@/components/modals/ScheduleModal"), { ssr: false });
const CommentModal = dynamic(() => import("@/components/modals/CommentModal"), { ssr: false });
const DetailModal = dynamic(() => import("@/components/modals/DetailModal"), { ssr: false });
const DatePickerModal = dynamic(() => import("@/components/modals/DatePickerModal"), { ssr: false });
const RestoreRequestModal = dynamic(() => import("@/components/modals/RestoreRequestModal"), { ssr: false });

interface ServiceOrder {
    id: string;
    rtom: string;
    lea: string | null;
    soNum: string;
    voiceNumber: string | null;
    orderType: string | null;
    serviceType: string | null;
    customerName: string | null;
    techContact: string | null;
    status: string;
    statusDate: string | null;
    address: string | null;
    dp: string | null;
    package: string | null;
    sales: string | null;
    woroTaskName: string | null;
    iptv: string | null;
    sltsStatus: string;
    scheduledDate: string | null;
    scheduledTime: string | null;
    comments: string | null;
    createdAt: string;
    contractorId?: string | null;
    contractor?: { name: string };
    completedDate?: string | null;
    ontSerialNumber?: string | null;
    iptvSerialNumbers?: string | null;
    dpDetails?: string | null;
}

interface OPMC {
    id: string;
    rtom: string;
    name: string;
}

interface Contractor {
    id: string;
    name: string;
}

interface ServiceOrdersPageProps {
    filterType?: 'pending' | 'completed' | 'return';
    pageTitle?: string;
}

export default function ServiceOrdersPage({ filterType = 'pending', pageTitle = 'Service Orders' }: ServiceOrdersPageProps) {
    const queryClient = useQueryClient();
    const { isColumnVisible } = useTableColumnSettings("pending_sod");

    // State
    const [selectedOpmcId, setSelectedOpmcId] = useState<string>("");
    const [selectedRtom, setSelectedRtom] = useState<string>("");
    const [searchTerm, setSearchTerm] = useState("");
    const [statusFilter, setStatusFilter] = useState("DEFAULT");
    const [sortConfig, setSortConfig] = useState<{ key: keyof ServiceOrder; direction: "asc" | "desc" } | null>({ key: "createdAt", direction: "desc" });
    const [page, setPage] = useState(1);
    const [limit] = useState(50);
    const [user, setUser] = useState<any>(null);

    // Modals State
    const [showManualModal, setShowManualModal] = useState(false);
    const [showScheduleModal, setShowScheduleModal] = useState(false);
    const [showCommentModal, setShowCommentModal] = useState(false);
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [showDateModal, setShowDateModal] = useState(false);
    const [showRestoreModal, setShowRestoreModal] = useState(false);
    const [selectedOrder, setSelectedOrder] = useState<ServiceOrder | null>(null);
    const [pendingStatusChange, setPendingStatusChange] = useState<{ orderId: string, newStatus: string } | null>(null);

    useEffect(() => {
        const storedUser = localStorage.getItem('user');
        if (storedUser) setUser(JSON.parse(storedUser));
    }, []);

    // --- QUERIES ---

    // Fetch OPMCs
    const { data: opmcs = [], isLoading: isLoadingOpmcs } = useQuery<OPMC[]>({
        queryKey: ["opmcs"],
        queryFn: async () => {
            const storedUser = localStorage.getItem('user');
            if (!storedUser) return [];
            const user = JSON.parse(storedUser);
            const isAdmin = user.role === 'ADMIN' || user.role === 'SUPER_ADMIN';

            if (isAdmin) {
                const res = await fetch("/api/opmcs");
                return res.json();
            } else {
                const res = await fetch("/api/users");
                const users = await res.json();
                const currentUser = users.find((u: any) => u.username === user.username);
                return currentUser?.accessibleOpmcs?.map((opmc: any) => ({
                    id: opmc.id,
                    rtom: opmc.rtom,
                    name: opmc.name || ''
                })) || [];
            }
        },
    });

    // Fetch Contractors
    const { data: contractors = [] } = useQuery<Contractor[]>({
        queryKey: ["contractors"],
        queryFn: async () => {
            const res = await fetch("/api/contractors");
            return res.json();
        },
        staleTime: 5 * 60 * 1000,
        gcTime: 10 * 60 * 1000
    });

    // Fetch Inventory Items
    const { data: items = [] } = useQuery({
        queryKey: ["inventory-items"],
        queryFn: async () => (await fetch("/api/inventory/items")).json(),
        staleTime: 5 * 60 * 1000
    });

    // Fetch Service Orders (fetch ALL to enable proper sorting of missing SODs)
    const { data: qData, isLoading: isLoadingOrders, isRefetching } = useQuery<{ items: ServiceOrder[], meta: any, summary: any }>({
        queryKey: ["service-orders", selectedOpmcId, filterType],
        queryFn: async () => {
            if (!selectedOpmcId) return { items: [], meta: {}, summary: {} };
            // Fetch all items (no pagination on API side)
            const res = await fetch(`/api/service-orders?opmcId=${selectedOpmcId}&filter=${filterType}&page=1&limit=10000`);
            return res.json();
        },
        enabled: !!selectedOpmcId,
        refetchInterval: 10 * 60 * 1000,
        refetchOnMount: true,
        refetchOnWindowFocus: true,
        staleTime: 0 // Always fetch fresh data
    });

    const serviceOrders = qData?.items || [];
    const meta = qData?.meta || { total: 0, page: 1, limit: 50, totalPages: 1 };
    const summary = qData?.summary || { totalSod: 0, contractorAssigned: 0, appointments: 0, statusBreakdown: {} };

    // Set default OPMC
    useEffect(() => {
        if (opmcs.length > 0 && !selectedOpmcId) {
            setSelectedOpmcId(opmcs[0].id);
            setSelectedRtom(opmcs[0].rtom);
        }
    }, [opmcs, selectedOpmcId]);

    const handleOpmcChange = (value: string) => {
        const opmc = opmcs.find(o => o.id === value);
        if (opmc) {
            setSelectedOpmcId(value);
            setSelectedRtom(opmc.rtom);
            setPage(1); // Reset page on OPMC change
        }
    };

    // --- MUTATIONS ---

    const syncMutation = useMutation({
        mutationFn: async () => {
            const res = await fetch("/api/service-orders/sync", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ opmcId: selectedOpmcId, rtom: selectedRtom })
            });
            return res.json();
        },
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ["service-orders"] });
            const message = `Sync completed: ${data.created} created, ${data.updated} updated${data.markedAsMissing > 0 ? `, ${data.markedAsMissing} marked as missing (highlighted in orange)` : ''}`;
            toast.success(message);
        },
        onError: () => toast.error("Sync failed")
    });

    const addOrderMutation = useMutation({
        mutationFn: async (data: any) => {
            const res = await fetch("/api/service-orders", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ...data, opmcId: selectedOpmcId, rtom: selectedRtom })
            });
            if (!res.ok) throw new Error("Failed");
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["service-orders"] });
            setShowManualModal(false);
            alert("Order added successfully");
        }
    });


    const updateStatusMutation = useMutation({
        mutationFn: async ({
            id,
            status,
            date,
            comment,
            reason,
            ontSerialNumber,
            ontType,
            iptvSerialNumbers,
            dpDetails,
            contractorId,
            teamId,
            materialUsage
        }: {
            id: string;
            status: string;
            date?: string | null;
            comment?: string;
            reason?: string;
            ontSerialNumber?: string;
            ontType?: 'NEW' | 'EXISTING';
            iptvSerialNumbers?: string[];
            dpDetails?: string;
            contractorId?: string;
            teamId?: string;
            materialUsage?: any;
        }) => {
            const res = await fetch("/api/service-orders", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    id,
                    sltsStatus: status,
                    scheduledDate: date,
                    comments: comment,
                    returnReason: reason,
                    ontSerialNumber,
                    ontType,
                    iptvSerialNumbers,
                    dpDetails,
                    contractorId,
                    teamId,
                    materialUsage
                })
            });
            if (!res.ok) throw new Error("Failed");
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["service-orders"] });
            toast.success("Status updated successfully");
        },
        onError: () => {
            toast.error("Failed to update status");
        }
    });

    const scheduleMutation = useMutation({
        mutationFn: async (data: any) => {
            const res = await fetch("/api/service-orders", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    id: selectedOrder?.id,
                    scheduledDate: data.date,
                    scheduledTime: data.time,
                    techContact: data.contactNumber
                })
            });
            if (!res.ok) throw new Error("Failed");
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["service-orders"] });
            setShowScheduleModal(false);
            alert("Scheduled successfully");
        }
    });

    const commentMutation = useMutation({
        mutationFn: async (comment: string) => {
            const res = await fetch("/api/service-orders", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id: selectedOrder?.id, comments: comment })
            });
            if (!res.ok) throw new Error("Failed");
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["service-orders"] });
            setShowCommentModal(false);
            alert("Comment added");
        }
    });

    const assignContractorMutation = useMutation({
        mutationFn: async ({ orderId, contractorId }: { orderId: string, contractorId: string }) => {
            const res = await fetch("/api/service-orders", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    id: orderId,
                    contractorId: contractorId || null,
                    sltsStatus: 'INPROGRESS'
                })
            });
            if (!res.ok) throw new Error("Failed");
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["service-orders"] });
        }
    });

    const restoreRequestMutation = useMutation({
        mutationFn: async (data: { reason: string }) => {
            const res = await fetch("/api/restore-requests", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    serviceOrderId: selectedOrder?.id,
                    reason: data.reason,
                    userId: user?.id,
                    requestedByUsername: user?.username
                })
            });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.message || "Failed");
            }
            return res.json();
        },
        onSuccess: () => {
            setShowRestoreModal(false);
            alert("Restore request submitted successfully. An Admin or Area Coordinator will review it.");
        },
        onError: (err: any) => {
            alert(err.message);
        }
    });

    // --- HANDLERS ---

    const handleStatusChange = (orderId: string, newStatus: string) => {
        // Find the order to get its data
        const order = serviceOrders.find(o => o.id === orderId);

        if (newStatus === "COMPLETED" || newStatus === "RETURN") {
            if (order) {
                setSelectedOrder(order); // Set selected order for modal data
            }
            setPendingStatusChange({ orderId, newStatus });
            setShowDateModal(true);
        } else {
            updateStatusMutation.mutate({ id: orderId, status: newStatus });
        }
    };

    const handleDateSubmit = (date: string, comment?: string, reason?: string) => {
        if (pendingStatusChange) {
            updateStatusMutation.mutate({
                id: pendingStatusChange.orderId,
                status: pendingStatusChange.newStatus,
                date,
                comment,
                reason
            });
            setPendingStatusChange(null);
            setShowDateModal(false);
        }
    };

    // Filter & Sort
    const filteredOrders = serviceOrders.filter(order => {
        const matchesSearch =
            order.soNum.toLowerCase().includes(searchTerm.toLowerCase()) ||
            order.customerName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            order.voiceNumber?.toLowerCase().includes(searchTerm.toLowerCase());

        const matchesStatus = statusFilter === 'ALL'
            ? true
            : statusFilter === 'DEFAULT'
                ? ["ASSIGNED", "INPROGRESS", "PROV_CLOSED", "INSTALL_CLOSED"].includes(order.status)
                : order.status === statusFilter;

        return matchesSearch && matchesStatus;
    });

    // Separate missing and normal orders
    const missingOrders = filteredOrders.filter(order =>
        order.comments?.includes('[MISSING FROM SYNC')
    );

    const normalOrders = filteredOrders.filter(order =>
        !order.comments?.includes('[MISSING FROM SYNC')
    );

    // Sort each group separately
    const sortFunction = (a: ServiceOrder, b: ServiceOrder) => {
        if (!sortConfig) return 0;
        const { key, direction } = sortConfig;
        let aValue: any = a[key] ?? "";
        let bValue: any = b[key] ?? "";
        // Special case for date sorting
        if (key === 'scheduledDate' || key === 'createdAt' || key === 'statusDate') {
            aValue = new Date(aValue).getTime();
            bValue = new Date(bValue).getTime();
        }
        if (aValue < bValue) return direction === "asc" ? -1 : 1;
        if (aValue > bValue) return direction === "asc" ? 1 : -1;
        return 0;
    };

    const sortedMissing = [...missingOrders].sort(sortFunction);
    const sortedNormal = [...normalOrders].sort(sortFunction);

    // Combine: Missing first, then normal
    const sortedOrders = [...sortedMissing, ...sortedNormal];

    // Client-side pagination
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedOrders = sortedOrders.slice(startIndex, endIndex);
    const totalPages = Math.ceil(sortedOrders.length / limit);

    // Update meta with client-side pagination
    const clientMeta = {
        total: sortedOrders.length,
        page,
        limit,
        totalPages
    };

    const requestSort = (key: keyof ServiceOrder) => {
        let direction: "asc" | "desc" = "asc";
        if (sortConfig && sortConfig.key === key && sortConfig.direction === "asc") {
            direction = "desc";
        }
        setSortConfig({ key, direction });
    };

    if (isLoadingOpmcs && !selectedOpmcId) {
        return <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-500">Loading Configuration...</div>;
    }

    // Helper for summary cards - Fixed Height Compact
    const SummaryCard = ({ title, value, icon: Icon, colorClass }: any) => (
        <Card className="shadow-none border h-14">
            <CardContent className="h-full px-3 flex items-center justify-between">
                <div>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{title}</p>
                    <p className="text-xl font-bold text-slate-900 leading-none mt-0.5">{value}</p>
                </div>
                <div className={`p-1.5 rounded-md ${colorClass} bg-opacity-10`}>
                    <Icon className={`w-4 h-4 ${colorClass.replace('bg-', 'text-')}`} />
                </div>
            </CardContent>
        </Card>
    );

    return (
        <div className="h-screen flex bg-slate-50 overflow-hidden">
            <Sidebar />
            <main className="flex-1 flex flex-col min-w-0 h-full">
                <Header />
                <div className="flex-1 flex flex-col min-h-0 overflow-hidden">

                    {/* Top Section: Fixed Height (Shrinkable) */}
                    <div className="flex-none p-3 space-y-3">

                        {/* Title & Actions */}
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                            <div>
                                <h1 className="text-base font-bold text-slate-900 tracking-tight leading-none">{pageTitle}</h1>
                                <p className="text-[9px] text-slate-500 mt-0.5">Manage {filterType} OSP installations</p>
                            </div>
                            <div className="flex gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-7 text-xs px-2"
                                    onClick={() => syncMutation.mutate()}
                                    disabled={!selectedOpmcId || syncMutation.isPending}
                                >
                                    <RefreshCw className={`w-3 h-3 mr-1.5 ${syncMutation.isPending ? 'animate-spin' : ''}`} />
                                    Sync
                                </Button>
                                <Button
                                    size="sm"
                                    className="h-7 text-xs px-2"
                                    onClick={() => setShowManualModal(true)}
                                    disabled={!selectedOpmcId}
                                >
                                    <Plus className="w-3 h-3 mr-1.5" />
                                    Entry
                                </Button>
                            </div>
                        </div>

                        {/* SUMMARY CARDS */}
                        <div className="grid grid-cols-2 lg:grid-cols-5 gap-2">
                            <SummaryCard title="Total SODs" value={summary.totalSod || 0} icon={FileText} colorClass="bg-blue-100 text-blue-600" />
                            <SummaryCard title="Contractors" value={summary.contractorAssigned || 0} icon={UserCheck} colorClass="bg-purple-100 text-purple-600" />
                            <SummaryCard title="Appointments" value={summary.appointments || 0} icon={CalendarCheck} colorClass="bg-indigo-100 text-indigo-600" />
                            <Card className="shadow-none border h-14">
                                <CardContent className="h-full px-3 py-1 flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <Activity className="w-4 h-4 text-orange-600" />
                                        <span className="text-[10px] font-semibold text-slate-600 uppercase">Missing</span>
                                    </div>
                                    <span className="text-lg font-bold text-orange-600">{serviceOrders.filter(o => o.comments?.includes('[MISSING FROM SYNC')).length}</span>
                                </CardContent>
                            </Card>
                            <Card className="shadow-none border h-14">
                                <CardContent className="h-full px-3 py-1 flex flex-col justify-center">
                                    <div className="w-full">
                                        <div className="flex justify-between items-center text-[12px] leading-tight"><span className="text-slate-500 font-medium">In Progress</span> <span className="font-bold text-slate-700">{summary.statusBreakdown?.INPROGRESS || 0}</span></div>
                                        <div className="flex justify-between items-center text-[12px] leading-tight"><span className="text-slate-500 font-medium">Inst. Closed</span> <span className="font-bold text-emerald-600">{summary.statusBreakdown?.INSTALL_CLOSED || 0}</span></div>
                                        <div className="flex justify-between items-center text-[12px] leading-tight"><span className="text-slate-500 font-medium">Prov. Closed</span> <span className="font-bold text-blue-600">{summary.statusBreakdown?.PROV_CLOSED || 0}</span></div>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>

                        {/* Controls */}
                        <div className="bg-white p-1.5 rounded-lg border shadow-sm flex flex-wrap gap-2 items-center">
                            <div className="flex items-center gap-2">
                                <label className="text-[9px] font-semibold text-slate-500 uppercase whitespace-nowrap hidden sm:block">OPMC</label>
                                <Select value={selectedOpmcId} onValueChange={handleOpmcChange}>
                                    <SelectTrigger className="h-7 w-[160px] text-xs"><SelectValue placeholder="Select OPMC" /></SelectTrigger>
                                    <SelectContent>
                                        {opmcs.map(o => (
                                            <SelectItem key={o.id} value={o.id} className="text-xs">{o.rtom} - {o.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="hidden sm:block w-[1px] h-5 bg-slate-200" />
                            <div className="flex items-center gap-2 flex-1 min-w-[150px]">
                                <Input
                                    placeholder="Search SO Number, Name..."
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                    className="h-7 text-xs w-full"
                                />
                            </div>
                            <div className="flex items-center gap-2">
                                <Select value={statusFilter} onValueChange={setStatusFilter}>
                                    <SelectTrigger className="h-7 w-[120px] text-xs"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="DEFAULT" className="font-semibold text-xs">Standard View</SelectItem>
                                        <SelectItem value="ALL" className="text-xs">All Status</SelectItem>
                                        <SelectItem value="INPROGRESS" className="text-xs">In Progress</SelectItem>
                                        <SelectItem value="INSTALL_CLOSED" className="text-xs">Install Closed</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </div>

                    {/* Table Area (Flex-1 to take remaining space, overflow-hidden on parent to force scroll on child) */}
                    <div className="flex-1 mx-3 mb-3 bg-white rounded-xl border shadow-none flex flex-col min-h-0">
                        {/* Table Scrollable Container */}
                        <div className="flex-1 overflow-auto">
                            {(isLoadingOrders && !isRefetching) ? (
                                <div className="p-8 text-center text-slate-500">Loading Orders...</div>
                            ) : (
                                <table className="w-full text-xs text-left relative">
                                    <thead className="bg-slate-50 text-slate-600 font-medium border-b sticky top-0 z-10 shadow-sm">
                                        <tr>
                                            {isColumnVisible('soNum') && <th className="px-3 py-2 cursor-pointer hover:bg-slate-100 whitespace-nowrap group" onClick={() => requestSort('soNum')}>SO Number <ArrowUpDown className={`w-3 h-3 inline ml-1 transition-opacity ${sortConfig?.key === 'soNum' ? 'opacity-100 text-blue-600' : 'opacity-30 group-hover:opacity-100'}`} /></th>}
                                            {isColumnVisible('lea') && <th className="px-3 py-2 cursor-pointer hover:bg-slate-100 whitespace-nowrap group" onClick={() => requestSort('lea')}>LEA <ArrowUpDown className={`w-3 h-3 inline ml-1 transition-opacity ${sortConfig?.key === 'lea' ? 'opacity-100 text-blue-600' : 'opacity-30 group-hover:opacity-100'}`} /></th>}
                                            {isColumnVisible('customerName') && <th className="px-3 py-2 cursor-pointer hover:bg-slate-100 whitespace-nowrap group" onClick={() => requestSort('customerName')}>Customer <ArrowUpDown className={`w-3 h-3 inline ml-1 transition-opacity ${sortConfig?.key === 'customerName' ? 'opacity-100 text-blue-600' : 'opacity-30 group-hover:opacity-100'}`} /></th>}
                                            {isColumnVisible('voiceNumber') && <th className="px-3 py-2 cursor-pointer hover:bg-slate-100 whitespace-nowrap group" onClick={() => requestSort('voiceNumber')}>Voice <ArrowUpDown className={`w-3 h-3 inline ml-1 transition-opacity ${sortConfig?.key === 'voiceNumber' ? 'opacity-100 text-blue-600' : 'opacity-30 group-hover:opacity-100'}`} /></th>}
                                            {isColumnVisible('package') && <th className="px-3 py-2 cursor-pointer hover:bg-slate-100 whitespace-nowrap group" onClick={() => requestSort('package')}>Package <ArrowUpDown className={`w-3 h-3 inline ml-1 transition-opacity ${sortConfig?.key === 'package' ? 'opacity-100 text-blue-600' : 'opacity-30 group-hover:opacity-100'}`} /></th>}

                                            {filterType === 'return' ? (
                                                // Specific columns for Return View
                                                <>
                                                    <th className="px-3 py-2 cursor-pointer hover:bg-slate-100 whitespace-nowrap group" onClick={() => requestSort('status')}>Status <ArrowUpDown className={`w-3 h-3 inline ml-1 transition-opacity ${sortConfig?.key === 'status' ? 'opacity-100 text-blue-600' : 'opacity-30 group-hover:opacity-100'}`} /></th>
                                                    <th className="px-3 py-2 whitespace-nowrap">Contractor</th>
                                                    <th className="px-3 py-2 cursor-pointer hover:bg-slate-100 whitespace-nowrap group" onClick={() => requestSort('statusDate')}>Return Date <ArrowUpDown className={`w-3 h-3 inline ml-1 transition-opacity ${sortConfig?.key === 'statusDate' ? 'opacity-100 text-blue-600' : 'opacity-30 group-hover:opacity-100'}`} /></th>
                                                    <th className="px-3 py-2 whitespace-nowrap">Return Reason/Comment</th>
                                                </>
                                            ) : (
                                                // Standard columns for other views
                                                <>
                                                    {isColumnVisible('status') && <th className="px-3 py-2 cursor-pointer hover:bg-slate-100 whitespace-nowrap group" onClick={() => requestSort('status')}>Status <ArrowUpDown className={`w-3 h-3 inline ml-1 transition-opacity ${sortConfig?.key === 'status' ? 'opacity-100 text-blue-600' : 'opacity-30 group-hover:opacity-100'}`} /></th>}
                                                    {isColumnVisible('sltsStatus') && <th className="px-3 py-2 cursor-pointer hover:bg-slate-100 whitespace-nowrap group" onClick={() => requestSort('sltsStatus')}>SLTS Status <ArrowUpDown className={`w-3 h-3 inline ml-1 transition-opacity ${sortConfig?.key === 'sltsStatus' ? 'opacity-100 text-blue-600' : 'opacity-30 group-hover:opacity-100'}`} /></th>}
                                                    {isColumnVisible('scheduledDate') && <th className="px-3 py-2 cursor-pointer hover:bg-slate-100 whitespace-nowrap group" onClick={() => requestSort('scheduledDate')}>Appointment <ArrowUpDown className={`w-3 h-3 inline ml-1 transition-opacity ${sortConfig?.key === 'scheduledDate' ? 'opacity-100 text-blue-600' : 'opacity-30 group-hover:opacity-100'}`} /></th>}
                                                    {isColumnVisible('dp') && <th className="px-3 py-2 cursor-pointer hover:bg-slate-100 whitespace-nowrap group" onClick={() => requestSort('dp')}>DP <ArrowUpDown className={`w-3 h-3 inline ml-1 transition-opacity ${sortConfig?.key === 'dp' ? 'opacity-100 text-blue-600' : 'opacity-30 group-hover:opacity-100'}`} /></th>}
                                                    {isColumnVisible('iptv') && <th className="px-3 py-2 cursor-pointer hover:bg-slate-100 whitespace-nowrap group" onClick={() => requestSort('iptv')}>IPTV <ArrowUpDown className={`w-3 h-3 inline ml-1 transition-opacity ${sortConfig?.key === 'iptv' ? 'opacity-100 text-blue-600' : 'opacity-30 group-hover:opacity-100'}`} /></th>}
                                                </>
                                            )}

                                            <th className="px-3 py-2 text-right whitespace-nowrap">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y text-[11px]">
                                        {paginatedOrders.length === 0 ? (
                                            <tr><td colSpan={11} className="p-8 text-center text-slate-500">No orders found.</td></tr>
                                        ) : (
                                            paginatedOrders.map(order => {
                                                const isMissingFromSync = order.comments?.includes('[MISSING FROM SYNC');
                                                return (
                                                    <tr key={order.id} className={`transition-colors ${isMissingFromSync ? 'bg-orange-50 hover:bg-orange-100' : 'hover:bg-slate-50/50'}`}>
                                                        {isColumnVisible('soNum') && (
                                                            <td className="px-3 py-1.5 font-mono font-medium text-primary whitespace-nowrap">
                                                                <button onClick={() => { setSelectedOrder(order); setShowDetailModal(true); }}>{order.soNum}</button>
                                                            </td>
                                                        )}
                                                        {isColumnVisible('lea') && <td className="px-3 py-1.5 text-slate-600 whitespace-nowrap">{order.lea || '-'}</td>}
                                                        {isColumnVisible('customerName') && <td className="px-3 py-1.5 max-w-[120px] truncate" title={order.customerName || ''}>{order.customerName || '-'}</td>}
                                                        {isColumnVisible('voiceNumber') && <td className="px-3 py-1.5 text-slate-600 whitespace-nowrap">{order.voiceNumber || '-'}</td>}
                                                        {isColumnVisible('package') && <td className="px-3 py-1.5 text-slate-600 whitespace-nowrap"><span className="px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded text-[10px] font-semibold">{order.package || '-'}</span></td>}

                                                        {filterType === 'return' ? (
                                                            <>
                                                                <td className="px-3 py-1.5 whitespace-nowrap">
                                                                    <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wide border text-rose-700 bg-rose-50 border-rose-200">
                                                                        RETURN
                                                                    </span>
                                                                </td>
                                                                <td className="px-3 py-1.5 text-slate-600 whitespace-nowrap">
                                                                    {order.contractor?.name ? order.contractor.name : (
                                                                        contractors.find(c => c.id === order.contractorId)?.name || "Unassigned"
                                                                    )}
                                                                </td>
                                                                <td className="px-3 py-1.5 text-slate-600 whitespace-nowrap">
                                                                    {order.statusDate ? new Date(order.statusDate).toLocaleDateString() : '-'}
                                                                </td>
                                                                <td className="px-3 py-1.5 text-slate-600 max-w-[200px] truncate" title={order.comments || ''}>
                                                                    {order.comments || '-'}
                                                                </td>
                                                            </>
                                                        ) : (
                                                            <>
                                                                {isColumnVisible('status') && (
                                                                    <td className="px-3 py-1.5 whitespace-nowrap">
                                                                        <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wide border ${order.status === 'INPROGRESS' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                                                                            order.status === 'INSTALL_CLOSED' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-50 text-slate-600 border-slate-200'
                                                                            }`}>
                                                                            {order.status}
                                                                        </span>
                                                                    </td>
                                                                )}
                                                                {isColumnVisible('sltsStatus') && (
                                                                    <td className="px-3 py-1.5">
                                                                        <Select
                                                                            value={order.sltsStatus}
                                                                            onValueChange={(val) => handleStatusChange(order.id, val)}
                                                                        >
                                                                            <SelectTrigger className={`h-6 w-[90px] text-[10px] px-2 min-h-0 border-slate-200 font-medium ${order.sltsStatus === 'INPROGRESS' ? 'text-amber-700 bg-amber-50 border-amber-200' :
                                                                                order.sltsStatus === 'COMPLETED' ? 'text-emerald-700 bg-emerald-50 border-emerald-200' :
                                                                                    order.sltsStatus === 'RETURN' ? 'text-rose-700 bg-rose-50 border-rose-200' : ''
                                                                                }`}>
                                                                                <SelectValue />
                                                                            </SelectTrigger>
                                                                            <SelectContent>
                                                                                <SelectItem value="INPROGRESS" className="text-xs">In Progress</SelectItem>
                                                                                <SelectItem value="COMPLETED" className="text-xs">Completed</SelectItem>
                                                                                <SelectItem value="RETURN" className="text-xs">Return</SelectItem>
                                                                            </SelectContent>
                                                                        </Select>
                                                                    </td>
                                                                )}
                                                                {isColumnVisible('scheduledDate') && (
                                                                    <td className="px-3 py-1.5 text-[10px] text-slate-600 whitespace-nowrap">
                                                                        {order.scheduledDate ? (
                                                                            <div className="flex items-center gap-1">
                                                                                <span className="font-semibold text-slate-700">{new Date(order.scheduledDate).toLocaleDateString([], { month: 'numeric', day: 'numeric' })}</span>
                                                                                <span className="text-slate-400">|</span>
                                                                                <span>{order.scheduledTime}</span>
                                                                            </div>
                                                                        ) : '-'}
                                                                    </td>
                                                                )}
                                                                {isColumnVisible('dp') && <td className="px-3 py-1.5 text-slate-600 text-[10px] whitespace-nowrap">{order.dp || '-'}</td>}
                                                                {isColumnVisible('iptv') && <td className="px-3 py-1.5 text-slate-600 text-[10px] whitespace-nowrap text-center">{order.iptv || '-'}</td>}
                                                            </>
                                                        )}

                                                        <td className="px-3 py-1.5 text-right whitespace-nowrap">
                                                            <div className="flex justify-end gap-1">
                                                                {filterType === 'return' ? (
                                                                    <Button
                                                                        size="sm"
                                                                        variant="outline"
                                                                        className="h-6 text-[10px] px-2 border-amber-200 text-amber-700 hover:bg-amber-50"
                                                                        onClick={() => { setSelectedOrder(order); setShowRestoreModal(true); }}
                                                                    >
                                                                        <RotateCcw className="w-3 h-3 mr-1" />
                                                                        Request Restore
                                                                    </Button>
                                                                ) : (
                                                                    <>
                                                                        <Button size="icon" variant="ghost" className="h-6 w-6 text-blue-600 hover:bg-blue-50" onClick={() => { setSelectedOrder(order); setShowScheduleModal(true); }}>
                                                                            <Calendar className="w-3.5 h-3.5" />
                                                                        </Button>
                                                                        <Button size="icon" variant="ghost" className="h-6 w-6 text-green-600 hover:bg-green-50" onClick={() => { setSelectedOrder(order); setShowCommentModal(true); }}>
                                                                            <MessageSquare className="w-3.5 h-3.5" />
                                                                        </Button>
                                                                    </>
                                                                )}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })
                                        )}
                                    </tbody>
                                </table>
                            )}
                        </div>
                        {/* Pagination Footer - Fixed at bottom of table container */}
                        <div className="flex-none border-t p-2 bg-slate-50 flex items-center justify-between text-xs text-slate-500">
                            <div>
                                Showing {(meta.page - 1) * meta.limit + 1} to {Math.min(meta.page * meta.limit, meta.total)} of {meta.total}
                            </div>
                            <div className="flex gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-7 w-7 p-0"
                                    disabled={page <= 1}
                                    onClick={() => setPage(p => Math.max(1, p - 1))}
                                >
                                    <ChevronLeft className="w-4 h-4" />
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-7 w-7 p-0"
                                    disabled={page >= meta.totalPages}
                                    onClick={() => setPage(p => Math.min(meta.totalPages, p + 1))}
                                >
                                    <ChevronRight className="w-4 h-4" />
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Modals */}
                <ManualEntryModal
                    isOpen={showManualModal}
                    onClose={() => setShowManualModal(false)}
                    onSubmit={(data) => addOrderMutation.mutate(data)}
                />

                {selectedOrder && (
                    <>
                        <ScheduleModal
                            isOpen={showScheduleModal}
                            onClose={() => setShowScheduleModal(false)}
                            onSubmit={(data) => scheduleMutation.mutate(data)}
                            selectedOrder={selectedOrder}
                        />

                        <CommentModal
                            isOpen={showCommentModal}
                            onClose={() => setShowCommentModal(false)}
                            onSubmit={(comment) => commentMutation.mutate(comment)}
                            selectedOrder={selectedOrder}
                            initialComment={selectedOrder.comments || ""}
                        />

                        <DetailModal
                            isOpen={showDetailModal}
                            onClose={() => setShowDetailModal(false)}
                            selectedOrder={selectedOrder}
                        />

                        <RestoreRequestModal
                            isOpen={showRestoreModal}
                            onClose={() => setShowRestoreModal(false)}
                            onSubmit={(data) => restoreRequestMutation.mutate(data)}
                        />
                    </>
                )}

                <DatePickerModal
                    isOpen={showDateModal}
                    onClose={() => setShowDateModal(false)}
                    onConfirm={(data) => {
                        if (pendingStatusChange) {
                            updateStatusMutation.mutate({
                                id: pendingStatusChange.orderId,
                                status: pendingStatusChange.newStatus,
                                date: data.date,
                                comment: data.comment,
                                reason: data.reason,
                                ontSerialNumber: data.ontSerialNumber,
                                ontType: data.ontType,
                                iptvSerialNumbers: data.iptvSerialNumbers,
                                dpDetails: data.dpDetails,
                                contractorId: data.contractorId,
                                teamId: data.teamId,
                                materialUsage: data.materialUsage
                            });
                            setShowDateModal(false);
                            setPendingStatusChange(null);
                        }
                    }}
                    title={pendingStatusChange?.newStatus === 'RETURN' ? "Mark as Return" : "Complete Order"}
                    isReturn={pendingStatusChange?.newStatus === 'RETURN'}
                    isComplete={pendingStatusChange?.newStatus === 'COMPLETED'}
                    orderData={selectedOrder ? {
                        package: selectedOrder.package,
                        iptv: selectedOrder.iptv,
                        dp: selectedOrder.dp,
                        voiceNumber: selectedOrder.voiceNumber
                    } : undefined}
                    contractors={contractors}
                    items={items}
                />

            </main>
        </div>
    );
}

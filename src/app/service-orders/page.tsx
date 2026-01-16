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
import { RefreshCw, Plus, Calendar, MessageSquare, ArrowUpDown, ChevronLeft, ChevronRight, FileText, UserCheck, CalendarCheck, Activity, RotateCcw, ClipboardList } from "lucide-react";
import { Form } from "@/components/ui/form";
import { toast } from "sonner";

const ManualEntryModal = dynamic(() => import("@/components/modals/ManualEntryModal"), { ssr: false });
const ScheduleModal = dynamic(() => import("@/components/modals/ScheduleModal"), { ssr: false });
const CommentModal = dynamic(() => import("@/components/modals/CommentModal"), { ssr: false });
const DetailModal = dynamic(() => import("@/components/modals/DetailModal"), { ssr: false });
const OrderActionModal = dynamic(() => import("@/components/modals/OrderActionModal"), { ssr: false });


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
    teamId?: string | null;
    contractor?: { name: string };
    completedDate?: string | null;
    updatedAt?: string | null;
    ontSerialNumber?: string | null;
    iptvSerialNumbers?: string | null;
    dpDetails?: string | null;
    patStatus?: string | null;
    opmcPatStatus?: string | null;
    opmcPatDate?: string | null;
    sltsPatStatus?: string | null;
    hoPatStatus?: string | null;
    hoPatDate?: string | null;
    isInvoicable: boolean;
    revenueAmount?: number | null;
    contractorAmount?: number | null;
    dropWireDistance?: number | null;
    materialUsage?: Array<{ itemId: string; quantity: string; usageType: 'USED' | 'WASTAGE' }> | null;
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

// Helper for summary cards - Fixed Height Compact
// eslint-disable-next-line @typescript-eslint/no-explicit-any
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

export default function ServiceOrdersPage({ filterType = 'pending', pageTitle = 'Service Orders' }: ServiceOrdersPageProps) {
    const queryClient = useQueryClient();
    const { isColumnVisible } = useTableColumnSettings("pending_sod");

    // State
    const [selectedRtomId, setSelectedRtomId] = useState<string>("");
    const [selectedRtom, setSelectedRtom] = useState<string>("");
    const [selectedMonth, setSelectedMonth] = useState<string>(String(new Date().getMonth() + 1));
    const [selectedYear, setSelectedYear] = useState<string>(String(new Date().getFullYear()));
    const [searchTerm, setSearchTerm] = useState("");
    const [statusFilter, setStatusFilter] = useState(filterType === 'completed' ? 'ALL' : 'DEFAULT');
    const [sortConfig, setSortConfig] = useState<{ key: keyof ServiceOrder; direction: "asc" | "desc" } | null>({
        key: filterType === 'completed' ? 'completedDate' : (filterType === 'return' ? 'statusDate' : 'createdAt'),
        direction: "desc"
    });
    const [page, setPage] = useState(1);
    const [limit] = useState(50);
    const [patFilter, setPatFilter] = useState(pageTitle === 'Invoicable Service Orders' ? 'READY' : "ALL");
    const [matFilter, setMatFilter] = useState("ALL");
    const [user, setUser] = useState<any>(null);
    const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);

    // Modals State
    const [showManualModal, setShowManualModal] = useState(false);
    const [showScheduleModal, setShowScheduleModal] = useState(false);
    const [showCommentModal, setShowCommentModal] = useState(false);
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [showActionModal, setShowActionModal] = useState(false);

    useEffect(() => {
        setStatusFilter(filterType === 'completed' ? 'ALL' : 'DEFAULT');
        setSortConfig({
            key: filterType === 'completed' ? 'completedDate' : (filterType === 'return' ? 'statusDate' : 'createdAt'),
            direction: "desc"
        });
    }, [filterType]);
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
                const res = await fetch("/api/users?page=1&limit=1000");
                const data = await res.json();
                const users = data.users || (Array.isArray(data) ? data : []);
                const currentUser = users.find((u: any) => u.username === user.username);
                return currentUser?.accessibleOpmcs?.map((opmc: any) => ({
                    id: opmc.id,
                    rtom: opmc.rtom,
                    name: opmc.name || ''
                })) || [];
            }
        },
        staleTime: 10 * 60 * 1000, // Consider configuration fresh for 10 minutes
        gcTime: 30 * 60 * 1000,    // Keep in cache for 30 minutes
    });

    // Fetch Contractors
    // Fetch Contractors
    const { data: contractorsData } = useQuery({
        queryKey: ["contractors"],
        queryFn: async () => {
            // Fetch all contractors for dropdowns
            const res = await fetch("/api/contractors?page=1&limit=1000");
            return res.json();
        },
        staleTime: 5 * 60 * 1000,
        gcTime: 10 * 60 * 1000
    });
    const contractors: any[] = Array.isArray(contractorsData?.contractors) ? contractorsData.contractors : [];

    // Fetch Inventory Items
    const { data: items = [] } = useQuery({
        queryKey: ["inventory-items"],
        queryFn: async () => (await fetch("/api/inventory/items")).json(),
        staleTime: 0 // Fetch fresh items every time to ensure config changes are reflected
    });

    // Fetch System Config for Material Source
    const { data: config = {} } = useQuery({
        queryKey: ["system-config"],
        queryFn: async () => (await fetch("/api/admin/system-config")).json(),
        staleTime: 0 // Fetch fresh config every time component mounts to avoid stale settings
    });
    const materialSource = config['OSP_MATERIAL_SOURCE'] || 'SLT';

    // Fetch Service Orders (Server-side search, filter, and pagination)
    const { data: qData, isLoading: isLoadingOrders, isRefetching } = useQuery<{ items: ServiceOrder[], meta: any, summary: any }>({
        queryKey: ["service-orders", selectedRtomId, filterType, selectedMonth, selectedYear, searchTerm, statusFilter, patFilter, matFilter, page],
        queryFn: async () => {
            if (!selectedRtomId) return { items: [], meta: {}, summary: {} };
            const monthParam = filterType === 'pending' ? '' : `&month=${selectedMonth}`;
            const yearParam = filterType === 'pending' ? '' : `&year=${selectedYear}`;
            const searchParam = searchTerm ? `&search=${encodeURIComponent(searchTerm)}` : '';
            const statusParam = statusFilter ? `&statusFilter=${statusFilter}` : '';
            const patParam = patFilter ? `&patFilter=${patFilter}` : '';
            const matParam = matFilter ? `&matFilter=${matFilter}` : '';

            const res = await fetch(`/api/service-orders?rtomId=${selectedRtomId}&filter=${filterType}${monthParam}${yearParam}${searchParam}${statusParam}${patParam}${matParam}&page=${page}&limit=${limit}`);
            return res.json();
        },
        enabled: !!selectedRtomId,
        refetchOnMount: true,
        refetchOnWindowFocus: true,
        staleTime: 30000 // Keep data fresh for 30s
    });

    const serviceOrders = qData?.items || [];
    const meta = qData?.meta || { total: 0, page: 1, limit: 50, totalPages: 1 };
    const summary = qData?.summary || { totalSod: 0, contractorAssigned: 0, appointments: 0, statusBreakdown: {} };

    // Set default OPMC
    useEffect(() => {
        if (opmcs.length > 0 && !selectedRtomId) {
            setSelectedRtomId(opmcs[0].id);
            setSelectedRtom(opmcs[0].rtom);
        }
    }, [opmcs, selectedRtomId]);

    const handleOpmcChange = (value: string) => {
        const opmc = opmcs.find(o => o.id === value);
        if (opmc) {
            setSelectedRtomId(value);
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
                body: JSON.stringify({ rtomId: selectedRtomId, rtom: selectedRtom })
            });
            return res.json();
        },
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ["service-orders"] });
            setLastSyncTime(new Date());
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
                body: JSON.stringify({ ...data, rtomId: selectedRtomId, rtom: selectedRtom })
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
            directTeamName,
            materialUsage,
            patStatus,
            opmcPatStatus,
            sltsPatStatus,
            completionMode
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
            directTeamName?: string;
            materialUsage?: any;
            patStatus?: string;
            opmcPatStatus?: string;
            sltsPatStatus?: string;
            completionMode?: 'ONLINE' | 'OFFLINE';
        }) => {
            const res = await fetch("/api/service-orders", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    id,
                    sltsStatus: status,
                    ...(status === 'COMPLETED' || status === 'RETURN'
                        ? { completedDate: date }
                        : { scheduledDate: date }
                    ),
                    comments: comment,
                    returnReason: reason,
                    ontSerialNumber,
                    ontType,
                    iptvSerialNumbers,
                    dpDetails,
                    contractorId,
                    teamId,
                    directTeamName,
                    materialUsage,
                    dropWireDistance: true,
                    updatedAt: true,
                    createdAt: true,
                    patStatus,
                    opmcPatStatus,
                    sltsPatStatus,
                    completionMode
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

    // --- HANDLERS ---

    const handleStatusChange = (orderId: string, newStatus: string) => {
        // Find the order to get its data
        const order = serviceOrders.find(o => o.id === orderId);

        if (newStatus === "COMPLETED" || newStatus === "RETURN") {
            if (order) {
                setSelectedOrder(order); // Set selected order for modal data
            }
            setPendingStatusChange({ orderId, newStatus });
            setShowActionModal(true);
        } else {
            updateStatusMutation.mutate({ id: orderId, status: newStatus });
        }
    };

    const handleActionSubmit = (date: string, comment?: string, reason?: string) => {
        if (pendingStatusChange) {
            updateStatusMutation.mutate({
                id: pendingStatusChange.orderId,
                status: pendingStatusChange.newStatus,
                date,
                comment,
                reason
            });
            setPendingStatusChange(null);
            setShowActionModal(false);
        }
    };

    const paginatedOrders = serviceOrders;

    // Update meta with server-side response
    const clientMeta = meta;

    const requestSort = (key: keyof ServiceOrder) => {
        let direction: "asc" | "desc" = "asc";
        if (sortConfig && sortConfig.key === key && sortConfig.direction === "asc") {
            direction = "desc";
        }
        setSortConfig({ key, direction });
    };

    if (isLoadingOpmcs && !selectedRtomId) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50">
                <div className="relative flex items-center justify-center mb-4">
                    <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
                    <div className="absolute w-6 h-6 bg-primary/10 rounded-full animate-pulse"></div>
                </div>
                <h2 className="text-sm font-bold text-slate-900 tracking-tight">nexusErp</h2>
                <p className="text-[10px] text-slate-500 mt-1 uppercase tracking-widest font-medium">Loading Configuration...</p>
            </div>
        );
    }



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
                            <div className="flex items-center gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className={`h-7 text-xs px-3 ${syncMutation.isPending ? 'bg-blue-50 border-blue-200' : ''}`}
                                    onClick={() => syncMutation.mutate()}
                                    disabled={!selectedRtomId || syncMutation.isPending}
                                >
                                    <RefreshCw className={`w-3 h-3 mr-1.5 ${syncMutation.isPending ? 'animate-spin text-blue-600' : ''}`} />
                                    {syncMutation.isPending ? 'Syncing...' : 'Sync Now'}
                                </Button>
                                {lastSyncTime && (
                                    <span className="text-[9px] text-slate-400 font-medium hidden sm:block">
                                        Synced: {lastSyncTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                )}
                                <Button
                                    size="sm"
                                    className="h-7 text-xs px-2"
                                    onClick={() => setShowManualModal(true)}
                                    disabled={!selectedRtomId}
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
                                <label className="text-[9px] font-semibold text-slate-500 uppercase whitespace-nowrap hidden sm:block">RTOM</label>
                                <Select value={selectedRtomId} onValueChange={handleOpmcChange}>
                                    <SelectTrigger className="h-7 w-[160px] text-xs"><SelectValue placeholder="Select RTOM" /></SelectTrigger>
                                    <SelectContent>
                                        {opmcs.map(o => (
                                            <SelectItem key={o.id} value={o.id} className="text-xs">{o.rtom}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="hidden sm:block w-[1px] h-5 bg-slate-200" />

                            {/* Date Filters - Only for Completed/Return views */}
                            {filterType !== 'pending' && (
                                <>
                                    <div className="flex items-center gap-1">
                                        <Select value={selectedYear} onValueChange={setSelectedYear}>
                                            <SelectTrigger className="h-7 w-[75px] text-xs"><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                {[new Date().getFullYear() - 1, new Date().getFullYear(), new Date().getFullYear() + 1].map(y => (
                                                    <SelectItem key={y} value={String(y)} className="text-xs">{y}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                                            <SelectTrigger className="h-7 w-[110px] text-xs"><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                {[
                                                    { v: '1', l: 'January' }, { v: '2', l: 'February' }, { v: '3', l: 'March' }, { v: '4', l: 'April' },
                                                    { v: '5', l: 'May' }, { v: '6', l: 'June' }, { v: '7', l: 'July' }, { v: '8', l: 'August' },
                                                    { v: '9', l: 'September' }, { v: '10', l: 'October' }, { v: '11', l: 'November' }, { v: '12', l: 'December' }
                                                ].map(m => (
                                                    <SelectItem key={m.v} value={m.v} className="text-xs">{m.l}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="hidden sm:block w-[1px] h-5 bg-slate-200" />
                                </>
                            )}
                            <div className="flex items-center gap-2 w-[240px]">
                                <Input
                                    placeholder="Search SO Number, Name..."
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                    className="h-7 text-xs w-full"
                                />
                            </div>
                            {filterType === 'pending' && (
                                <div className="flex items-center gap-2">
                                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                                        <SelectTrigger className="h-7 w-[150px] text-xs"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="DEFAULT" className="font-semibold text-xs">Standard View</SelectItem>
                                            <SelectItem value="ALL" className="text-xs">All Status</SelectItem>
                                            <SelectItem value="ASSIGNED" className="text-xs">Assigned</SelectItem>
                                            <SelectItem value="INPROGRESS" className="text-xs">In Progress</SelectItem>
                                            <SelectItem value="INSTALL_CLOSED" className="text-xs">Install Closed</SelectItem>
                                            <SelectItem value="PROV_CLOSED" className="text-xs">Prov. Closed</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            )}
                            {filterType === 'completed' && (
                                <>
                                    <div className="hidden sm:block w-[1px] h-5 bg-slate-200" />
                                    <div className="flex items-center gap-2">
                                        <label className="text-[9px] font-semibold text-slate-500 uppercase whitespace-nowrap">Invoice Status</label>
                                        <Select value={patFilter} onValueChange={setPatFilter}>
                                            <SelectTrigger className="h-7 w-[120px] text-xs"><SelectValue placeholder="PAT Status" /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="ALL" className="text-xs">All PAT</SelectItem>
                                                <SelectItem value="READY" className="text-xs font-bold text-emerald-600">INVOICABLE (BOTH PASS)</SelectItem>
                                                <SelectItem value="PENDING" className="text-xs">Pending HO</SelectItem>
                                                <SelectItem value="SLTS_PASS" className="text-xs">SLTS Pass</SelectItem>
                                                <SelectItem value="OPMC_REJECTED" className="text-xs text-rose-600">Reg. Rejected</SelectItem>
                                                <SelectItem value="HO_REJECTED" className="text-xs text-rose-600 font-bold">HO Rejected</SelectItem>
                                                <SelectItem value="HO_PASS" className="text-xs text-blue-600">HO Pass</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <label className="text-[9px] font-semibold text-slate-500 uppercase whitespace-nowrap">Mat</label>
                                        <Select value={matFilter} onValueChange={setMatFilter}>
                                            <SelectTrigger className="h-7 w-[90px] text-xs"><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="ALL" className="text-xs">All</SelectItem>
                                                <SelectItem value="PENDING" className="text-xs">Pending</SelectItem>
                                                <SelectItem value="COMPLETED" className="text-xs">Completed</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </>
                            )}
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
                                            {isColumnVisible('orderType') && <th className="px-3 py-2 cursor-pointer hover:bg-slate-100 whitespace-nowrap group" onClick={() => requestSort('orderType')}>Order Type <ArrowUpDown className={`w-3 h-3 inline ml-1 transition-opacity ${sortConfig?.key === 'orderType' ? 'opacity-100 text-blue-600' : 'opacity-30 group-hover:opacity-100'}`} /></th>}
                                            {isColumnVisible('statusDate') && <th className="px-3 py-2 cursor-pointer hover:bg-slate-100 whitespace-nowrap group" onClick={() => requestSort('statusDate')}>Received Date <ArrowUpDown className={`w-3 h-3 inline ml-1 transition-opacity ${sortConfig?.key === 'statusDate' ? 'opacity-100 text-blue-600' : 'opacity-30 group-hover:opacity-100'}`} /></th>}
                                            {isColumnVisible('createdAt') && filterType === 'pending' && <th className="px-3 py-2 cursor-pointer hover:bg-slate-100 whitespace-nowrap group" onClick={() => requestSort('createdAt')}>Imported Date <ArrowUpDown className={`w-3 h-3 inline ml-1 transition-opacity ${sortConfig?.key === 'createdAt' ? 'opacity-100 text-blue-600' : 'opacity-30 group-hover:opacity-100'}`} /></th>}

                                            {filterType === 'return' ? (
                                                // Specific columns for Return View
                                                <>
                                                    <th className="px-3 py-2 cursor-pointer hover:bg-slate-100 whitespace-nowrap group" onClick={() => requestSort('status')}>Status <ArrowUpDown className={`w-3 h-3 inline ml-1 transition-opacity ${sortConfig?.key === 'status' ? 'opacity-100 text-blue-600' : 'opacity-30 group-hover:opacity-100'}`} /></th>
                                                    <th className="px-3 py-2 whitespace-nowrap">Contractor</th>
                                                    <th className="px-3 py-2 cursor-pointer hover:bg-slate-100 whitespace-nowrap group" onClick={() => requestSort('completedDate')}>Return Date <ArrowUpDown className={`w-3 h-3 inline ml-1 transition-opacity ${sortConfig?.key === 'completedDate' ? 'opacity-100 text-blue-600' : 'opacity-30 group-hover:opacity-100'}`} /></th>
                                                    <th className="px-3 py-2 whitespace-nowrap">Return Reason/Comment</th>
                                                </>
                                            ) : (
                                                // Standard columns for other views
                                                <>
                                                    {isColumnVisible('status') && filterType !== 'completed' && <th className="px-3 py-2 cursor-pointer hover:bg-slate-100 whitespace-nowrap group" onClick={() => requestSort('status')}>Status <ArrowUpDown className={`w-3 h-3 inline ml-1 transition-opacity ${sortConfig?.key === 'status' ? 'opacity-100 text-blue-600' : 'opacity-30 group-hover:opacity-100'}`} /></th>}
                                                    {isColumnVisible('sltsStatus') && filterType !== 'completed' && <th className="px-3 py-2 cursor-pointer hover:bg-slate-100 whitespace-nowrap group" onClick={() => requestSort('sltsStatus')}>SLTS Status <ArrowUpDown className={`w-3 h-3 inline ml-1 transition-opacity ${sortConfig?.key === 'sltsStatus' ? 'opacity-100 text-blue-600' : 'opacity-30 group-hover:opacity-100'}`} /></th>}
                                                    {isColumnVisible('scheduledDate') && filterType !== 'completed' && <th className="px-3 py-2 cursor-pointer hover:bg-slate-100 whitespace-nowrap group" onClick={() => requestSort('scheduledDate')}>Appointment <ArrowUpDown className={`w-3 h-3 inline ml-1 transition-opacity ${sortConfig?.key === 'scheduledDate' ? 'opacity-100 text-blue-600' : 'opacity-30 group-hover:opacity-100'}`} /></th>}
                                                    {filterType === 'completed' && <th className="px-3 py-2 cursor-pointer hover:bg-slate-100 whitespace-nowrap group" onClick={() => requestSort('completedDate')}>Completed Date <ArrowUpDown className={`w-3 h-3 inline ml-1 transition-opacity ${sortConfig?.key === 'completedDate' ? 'opacity-100 text-blue-600' : 'opacity-30 group-hover:opacity-100'}`} /></th>}
                                                    {filterType === 'completed' && <th className="px-3 py-2 whitespace-nowrap">Contractor</th>}
                                                    {filterType === 'completed' && <th className="px-3 py-2 whitespace-nowrap">ONT Serial</th>}
                                                    {filterType === 'completed' && <th className="px-3 py-2 whitespace-nowrap text-right">Dist.</th>}
                                                    {filterType === 'completed' && <th className="px-3 py-2 whitespace-nowrap text-right">Rev.</th>}
                                                    {filterType === 'completed' && <th className="px-3 py-2 whitespace-nowrap text-right">Pay.</th>}
                                                    {filterType === 'completed' && <th className="px-3 py-2 whitespace-nowrap">Mat Status</th>}
                                                    {filterType === 'completed' && <th className="px-3 py-2 whitespace-nowrap text-center">HO PAT</th>}
                                                    {filterType === 'completed' && <th className="px-3 py-2 whitespace-nowrap text-center text-[10px]">PAT Month</th>}
                                                    {filterType === 'completed' && <th className="px-3 py-2 whitespace-nowrap text-center">SLTS PAT</th>}
                                                    {filterType === 'completed' && <th className="px-3 py-2 whitespace-nowrap text-center">Invoice</th>}
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
                                                    <tr key={order.id} className={`transition-colors ${isMissingFromSync ? 'bg-orange-50 hover:bg-orange-100' :
                                                        (filterType === 'completed' && order.patStatus === 'PENDING') ? 'bg-yellow-50 hover:bg-yellow-100' :
                                                            (filterType === 'completed' && (order.patStatus === 'COMPLETED' || order.patStatus === 'VERIFIED')) ? 'bg-emerald-50 hover:bg-emerald-100' :
                                                                'hover:bg-slate-50/50'
                                                        }`}>
                                                        {isColumnVisible('soNum') && (
                                                            <td className="px-3 py-1.5 font-mono font-medium text-primary whitespace-nowrap">
                                                                <button onClick={() => { setSelectedOrder(order); setShowDetailModal(true); }}>{order.soNum}</button>
                                                            </td>
                                                        )}
                                                        {isColumnVisible('lea') && <td className="px-3 py-1.5 text-slate-600 whitespace-nowrap">{order.lea || '-'}</td>}
                                                        {isColumnVisible('customerName') && <td className="px-3 py-1.5 max-w-[120px] truncate" title={order.customerName || ''}>{order.customerName || '-'}</td>}
                                                        {isColumnVisible('voiceNumber') && <td className="px-3 py-1.5 text-slate-600 whitespace-nowrap">{order.voiceNumber || '-'}</td>}
                                                        {isColumnVisible('package') && <td className="px-3 py-1.5 text-slate-600 whitespace-nowrap"><span className="px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded text-[10px] font-semibold">{order.package || '-'}</span></td>}
                                                        {isColumnVisible('orderType') && <td className="px-3 py-1.5 text-slate-600 whitespace-nowrap"><span className="px-1.5 py-0.5 bg-purple-50 text-purple-700 rounded text-[10px] font-medium">{order.orderType || '-'}</span></td>}
                                                        {isColumnVisible('statusDate') && <td className="px-3 py-1.5 text-slate-600 text-[10px] whitespace-nowrap">{order.statusDate ? new Date(order.statusDate).toLocaleDateString() : '-'}</td>}
                                                        {isColumnVisible('createdAt') && filterType === 'pending' && <td className="px-3 py-1.5 text-slate-600 text-[10px] whitespace-nowrap">{order.createdAt ? new Date(order.createdAt).toLocaleDateString() : '-'}</td>}

                                                        {filterType === 'return' ? (
                                                            <>
                                                                <td className="px-3 py-1.5 whitespace-nowrap">
                                                                    <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wide border text-rose-700 bg-rose-50 border-rose-200">
                                                                        RETURN
                                                                    </span>
                                                                </td>
                                                                <td className="px-3 py-1.5 text-slate-600 whitespace-nowrap">
                                                                    {order.contractor?.name ? order.contractor.name : (
                                                                        contractors.find((c: any) => c.id === order.contractorId)?.name || "Unassigned"
                                                                    )}
                                                                </td>
                                                                <td className="px-3 py-1.5 text-slate-600 whitespace-nowrap">
                                                                    {order.completedDate ? new Date(order.completedDate).toLocaleDateString() : (order.updatedAt ? new Date(order.updatedAt).toLocaleDateString() : '-')}
                                                                </td>
                                                                <td className="px-3 py-1.5 text-slate-600 max-w-[200px] truncate" title={order.comments || ''}>
                                                                    {order.comments || '-'}
                                                                </td>
                                                            </>
                                                        ) : (
                                                            <>
                                                                {isColumnVisible('status') && filterType !== 'completed' && (
                                                                    <td className="px-3 py-1.5 whitespace-nowrap">
                                                                        <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wide border ${order.status === 'INPROGRESS' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                                                                            order.status === 'INSTALL_CLOSED' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-50 text-slate-600 border-slate-200'
                                                                            }`}>
                                                                            {order.status}
                                                                        </span>
                                                                    </td>
                                                                )}
                                                                {isColumnVisible('sltsStatus') && filterType !== 'completed' && (
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
                                                                {isColumnVisible('scheduledDate') && filterType !== 'completed' && (
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
                                                                {filterType === 'completed' && (
                                                                    <td className="px-3 py-1.5 text-[10px] text-slate-600 whitespace-nowrap">
                                                                        {order.completedDate ? new Date(order.completedDate).toLocaleDateString() : '-'}
                                                                    </td>
                                                                )}
                                                                {filterType === 'completed' && (
                                                                    <td className="px-3 py-1.5 text-slate-600 text-[10px] whitespace-nowrap">
                                                                        {order.contractor?.name || contractors.find((c: any) => c.id === order.contractorId)?.name || '-'}
                                                                    </td>
                                                                )}
                                                                {filterType === 'completed' && (
                                                                    <td className="px-3 py-1.5 text-slate-600 text-[10px] whitespace-nowrap font-mono">
                                                                        {order.ontSerialNumber || '-'}
                                                                    </td>
                                                                )}
                                                                {filterType === 'completed' && (
                                                                    <td className="px-3 py-1.5 text-slate-600 text-[10px] whitespace-nowrap text-right font-mono">
                                                                        {order.dropWireDistance ? `${order.dropWireDistance}m` : '-'}
                                                                    </td>
                                                                )}
                                                                {filterType === 'completed' && (
                                                                    <td className="px-3 py-1.5 text-green-700 text-[10px] whitespace-nowrap text-right font-bold">
                                                                        {order.revenueAmount ? order.revenueAmount.toLocaleString() : '-'}
                                                                    </td>
                                                                )}
                                                                {filterType === 'completed' && (
                                                                    <td className="px-3 py-1.5 text-blue-700 text-[10px] whitespace-nowrap text-right font-bold">
                                                                        {order.contractorAmount ? order.contractorAmount.toLocaleString() : '-'}
                                                                    </td>
                                                                )}
                                                                {filterType === 'completed' && (
                                                                    <>
                                                                        <td className="px-3 py-1.5 text-center whitespace-nowrap">
                                                                            {order.comments?.includes('[MATERIAL_COMPLETED]') ? (
                                                                                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-green-100 text-green-700 border border-green-200">DONE</span>
                                                                            ) : (
                                                                                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-slate-100 text-slate-500 border border-slate-200">PENDING</span>
                                                                            )}
                                                                        </td>
                                                                        <td className="px-3 py-1.5 text-center whitespace-nowrap">
                                                                            <div className="flex flex-col gap-0.5">
                                                                                <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold uppercase border ${order.hoPatStatus === 'PASS' ? 'bg-blue-100 text-blue-700 border-blue-200' :
                                                                                    order.hoPatStatus === 'REJECTED' ? 'bg-rose-100 text-rose-700 border-rose-200' :
                                                                                        order.opmcPatStatus === 'REJECTED' ? 'bg-amber-50 text-amber-600 border-amber-200' :
                                                                                            'bg-slate-50 text-slate-400 border-slate-200'
                                                                                    }`}>
                                                                                    HO: {order.hoPatStatus || (order.opmcPatStatus === 'REJECTED' ? 'REG_REJ' : 'PENDING')}
                                                                                </span>
                                                                                {order.opmcPatStatus === 'REJECTED' && !order.hoPatStatus && (
                                                                                    <span className="text-[7px] font-bold text-amber-600 uppercase tracking-tighter">REGIONAL REJECT</span>
                                                                                )}
                                                                            </div>
                                                                        </td>
                                                                        <td className="px-3 py-1.5 text-center whitespace-nowrap text-[10px] text-slate-500 font-medium">
                                                                            {order.hoPatDate ? new Date(order.hoPatDate).toLocaleDateString([], { month: 'short', year: 'numeric' }) : '-'}
                                                                        </td>
                                                                        <td className="px-3 py-1.5 text-center whitespace-nowrap">
                                                                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase border ${order.sltsPatStatus === 'PASS' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' :
                                                                                order.sltsPatStatus === 'REJECTED' ? 'bg-red-100 text-red-700 border-red-200' :
                                                                                    'bg-yellow-100 text-yellow-700 border-yellow-200'
                                                                                }`}>
                                                                                {order.sltsPatStatus || 'PENDING'}
                                                                            </span>
                                                                        </td>
                                                                        <td className="px-3 py-1.5 text-center whitespace-nowrap">
                                                                            {order.isInvoicable ? (
                                                                                <div className="flex flex-col items-center">
                                                                                    <span className="px-1.5 py-0.5 rounded-full bg-blue-600 text-white text-[9px] font-bold uppercase shadow-sm">READY</span>
                                                                                    <span className="text-[7px] text-blue-600 font-bold mt-0.5 uppercase tracking-tighter">INVOICABLE</span>
                                                                                </div>
                                                                            ) : (
                                                                                <span className="px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-400 text-[9px] font-bold uppercase border border-slate-200 opacity-50">BLOCKED</span>
                                                                            )}
                                                                        </td>
                                                                    </>
                                                                )}
                                                                {isColumnVisible('dp') && <td className="px-3 py-1.5 text-slate-600 text-[10px] whitespace-nowrap">{order.dp || '-'}</td>}
                                                                {isColumnVisible('iptv') && <td className="px-3 py-1.5 text-slate-600 text-[10px] whitespace-nowrap text-center">{order.iptv || '-'}</td>}
                                                            </>
                                                        )}

                                                        <td className="px-3 py-1.5 text-right whitespace-nowrap">
                                                            <div className="flex justify-end gap-1">
                                                                <>
                                                                    {filterType === 'return' && (
                                                                        <Button
                                                                            size="icon"
                                                                            variant="ghost"
                                                                            className="h-6 w-6 text-orange-600 hover:bg-orange-50"
                                                                            title="Restore to Pending"
                                                                            onClick={() => {
                                                                                if (confirm("Are you sure you want to move this order back to Pending?")) {
                                                                                    updateStatusMutation.mutate({ id: order.id, status: 'INPROGRESS' });
                                                                                }
                                                                            }}
                                                                        >
                                                                            <RotateCcw className="w-3.5 h-3.5" />
                                                                        </Button>
                                                                    )}
                                                                    {filterType !== 'completed' && filterType !== 'return' && (
                                                                        <Button size="icon" variant="ghost" className="h-6 w-6 text-blue-600 hover:bg-blue-50" onClick={() => { setSelectedOrder(order); setShowScheduleModal(true); }}>
                                                                            <Calendar className="w-3.5 h-3.5" />
                                                                        </Button>
                                                                    )}
                                                                    {filterType !== 'completed' && (
                                                                        <Button size="icon" variant="ghost" className="h-6 w-6 text-green-600 hover:bg-green-50" onClick={() => { setSelectedOrder(order); setShowCommentModal(true); }}>
                                                                            <MessageSquare className="w-3.5 h-3.5" />
                                                                        </Button>
                                                                    )}
                                                                    {filterType === 'completed' && (
                                                                        <Button
                                                                            size="icon"
                                                                            variant="ghost"
                                                                            className="h-6 w-6 text-purple-600 hover:bg-purple-50"
                                                                            onClick={() => {
                                                                                setPendingStatusChange({
                                                                                    orderId: order.id,
                                                                                    newStatus: 'COMPLETED'
                                                                                });
                                                                                setSelectedOrder(order);
                                                                                setShowActionModal(true);
                                                                            }}
                                                                            title="Update Material & Photo Status"
                                                                        >
                                                                            <ClipboardList className="w-3.5 h-3.5" />
                                                                        </Button>
                                                                    )}
                                                                </>
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

                {
                    selectedOrder && (
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


                        </>
                    )
                }

                <OrderActionModal
                    isOpen={showActionModal}
                    onClose={() => setShowActionModal(false)}
                    onConfirm={(data) => {
                        let finalComment = data.comment || "";
                        let statusToUpdate = pendingStatusChange?.newStatus;

                        if (data.materialStatus === 'COMPLETED') {
                            if (!finalComment.includes('[MATERIAL_COMPLETED]')) finalComment += " [MATERIAL_COMPLETED]";
                        } else {
                            finalComment = finalComment.replace(' [MATERIAL_COMPLETED]', '').replace('[MATERIAL_COMPLETED]', '');
                        }

                        // Wired Only Logic - Keep as INPROGRESS
                        if (data.wiredOnly) {
                            statusToUpdate = 'INPROGRESS';
                            if (!finalComment.includes('[WIRED_ONLY]')) finalComment += " [WIRED_ONLY]";

                            const reasons = [];
                            if (data.ontShortage) reasons.push('ONT_SHORTAGE');
                            if (data.stbShortage) reasons.push('STB_SHORTAGE');
                            if (data.delayReasons?.cxDelay) reasons.push('CX_DELAY');
                            if (data.delayReasons?.system) reasons.push('SYSTEM_ISSUE');

                            if (reasons.length > 0) finalComment += ` [${reasons.join(',')}]`;
                        }

                        if (pendingStatusChange) {
                            updateStatusMutation.mutate({
                                id: pendingStatusChange.orderId,
                                status: statusToUpdate!,
                                date: data.date,
                                comment: finalComment,
                                reason: data.reason,
                                ontSerialNumber: data.ontSerialNumber,
                                ontType: data.ontType,
                                iptvSerialNumbers: data.iptvSerialNumbers,
                                dpDetails: data.dpDetails,
                                contractorId: data.contractorId,
                                teamId: data.teamId,
                                directTeamName: data.directTeamName,
                                materialUsage: data.materialUsage,
                                opmcPatStatus: data.opmcPatStatus,
                                sltsPatStatus: data.sltsPatStatus,
                                completionMode: data.completionMode
                            });
                            setShowActionModal(false);
                            setPendingStatusChange(null);
                        }
                    }}
                    title={pendingStatusChange?.newStatus === 'RETURN' ? "Mark as Return" : filterType === 'completed' ? "Update Installation Details" : "Complete Order"}
                    isReturn={pendingStatusChange?.newStatus === 'RETURN'}
                    isComplete={pendingStatusChange?.newStatus === 'COMPLETED'}
                    orderData={selectedOrder ? {
                        package: selectedOrder.package,
                        serviceType: selectedOrder.serviceType, // Pass Service Type
                        orderType: selectedOrder.orderType,     // Pass Order Type
                        comments: selectedOrder.comments,
                        iptv: selectedOrder.iptv,
                        dp: selectedOrder.dp,
                        voiceNumber: selectedOrder.voiceNumber,
                        contractorId: selectedOrder.contractorId,
                        teamId: selectedOrder.teamId,
                        completedDate: selectedOrder.completedDate,
                        ontSerialNumber: selectedOrder.ontSerialNumber,
                        iptvSerialNumbers: selectedOrder.iptvSerialNumbers ? selectedOrder.iptvSerialNumbers.split(',').map(s => s.trim()).filter(Boolean) : [],
                        opmcPatStatus: selectedOrder.opmcPatStatus as any,
                        sltsPatStatus: selectedOrder.sltsPatStatus as any,
                        materialUsage: selectedOrder.materialUsage,
                        directTeam: (selectedOrder as any).directTeam,
                        completionMode: (selectedOrder as any).completionMode
                    } : undefined}
                    contractors={contractors}
                    items={items}
                    materialSource={materialSource}
                    itemSortOrder={(() => {
                        try { return JSON.parse(config['OSP_ITEM_ORDER'] || '[]'); } catch { return []; }
                    })()}
                    showExtendedFields={filterType === 'completed'}
                />

            </main >
        </div >
    );
}

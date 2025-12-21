"use client";

import React, { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import { useTableColumnSettings } from "@/hooks/useTableColumnSettings";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { RefreshCw, Plus, Calendar, MessageSquare, ArrowUpDown } from "lucide-react";
import { Form } from "@/components/ui/form";
import { toast } from "sonner";

const ManualEntryModal = dynamic(() => import("@/components/modals/ManualEntryModal"), { ssr: false });
const ScheduleModal = dynamic(() => import("@/components/modals/ScheduleModal"), { ssr: false });
const CommentModal = dynamic(() => import("@/components/modals/CommentModal"), { ssr: false });
const DetailModal = dynamic(() => import("@/components/modals/DetailModal"), { ssr: false });
const DatePickerModal = dynamic(() => import("@/components/modals/DatePickerModal"), { ssr: false });

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

export default function ServiceOrdersPage() {
    const queryClient = useQueryClient();
    const { isColumnVisible } = useTableColumnSettings("pending_sod");

    // State
    const [selectedOpmcId, setSelectedOpmcId] = useState<string>("");
    const [selectedRtom, setSelectedRtom] = useState<string>("");
    const [searchTerm, setSearchTerm] = useState("");
    const [statusFilter, setStatusFilter] = useState("ALL");
    const [sortConfig, setSortConfig] = useState<{ key: keyof ServiceOrder; direction: "asc" | "desc" } | null>({ key: "createdAt", direction: "desc" });

    // Modals State
    const [showManualModal, setShowManualModal] = useState(false);
    const [showScheduleModal, setShowScheduleModal] = useState(false);
    const [showCommentModal, setShowCommentModal] = useState(false);
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [showDateModal, setShowDateModal] = useState(false);
    const [selectedOrder, setSelectedOrder] = useState<ServiceOrder | null>(null);
    const [pendingStatusChange, setPendingStatusChange] = useState<{ orderId: string, newStatus: string } | null>(null);

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
        }
    });

    // Fetch Service Orders
    const { data: serviceOrders = [], isLoading: isLoadingOrders, isRefetching } = useQuery<ServiceOrder[]>({
        queryKey: ["service-orders", selectedOpmcId],
        queryFn: async () => {
            if (!selectedOpmcId) return [];
            const res = await fetch(`/api/service-orders?opmcId=${selectedOpmcId}&filter=pending`);
            return res.json();
        },
        enabled: !!selectedOpmcId,
        refetchInterval: 10 * 60 * 1000, // Auto refetch every 10 mins
    });

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
            alert(`Sync completed: ${data.created} created, ${data.updated} updated`);
        },
        onError: () => alert("Sync failed")
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
        mutationFn: async ({ id, status, date }: { id: string, status: string, date?: string | null }) => {
            const res = await fetch("/api/service-orders", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id, sltsStatus: status, completedDate: date })
            });
            if (!res.ok) throw new Error("Failed");
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["service-orders"] });
            alert("Status updated");
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
        if (newStatus === "COMPLETED" || newStatus === "RETURN") {
            setPendingStatusChange({ orderId, newStatus });
            setShowDateModal(true);
        } else {
            updateStatusMutation.mutate({ id: orderId, status: newStatus });
        }
    };

    const handleDateSubmit = (date: string) => {
        if (pendingStatusChange) {
            updateStatusMutation.mutate({
                id: pendingStatusChange.orderId,
                status: pendingStatusChange.newStatus,
                date
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
        const matchesStatus = statusFilter === 'ALL' || order.status === statusFilter;
        return matchesSearch && matchesStatus;
    });

    const sortedOrders = [...filteredOrders].sort((a, b) => {
        if (!sortConfig) return 0;
        const { key, direction } = sortConfig;
        let aValue = a[key] ?? "";
        let bValue = b[key] ?? "";
        if (aValue < bValue) return direction === "asc" ? -1 : 1;
        if (aValue > bValue) return direction === "asc" ? 1 : -1;
        return 0;
    });

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

    return (
        <div className="min-h-screen flex bg-slate-50">
            <Sidebar />
            <main className="flex-1 flex flex-col min-w-0">
                <Header />
                <div className="flex-1 overflow-y-auto p-2 md:p-4">
                    <div className="max-w-[1920px] mx-auto space-y-4">

                        {/* Title & Actions */}
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                            <div>
                                <h1 className="text-xl font-bold text-slate-900 tracking-tight">Service Orders</h1>
                                <p className="text-xs text-slate-500">Manage pending OSP installations</p>
                            </div>
                            <div className="flex gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => syncMutation.mutate()}
                                    disabled={!selectedOpmcId || syncMutation.isPending}
                                >
                                    <RefreshCw className={`w-3.5 h-3.5 mr-2 ${syncMutation.isPending ? 'animate-spin' : ''}`} />
                                    Sync
                                </Button>
                                <Button
                                    size="sm"
                                    onClick={() => setShowManualModal(true)}
                                    disabled={!selectedOpmcId}
                                >
                                    <Plus className="w-3.5 h-3.5 mr-2" />
                                    Entry
                                </Button>
                            </div>
                        </div>

                        {/* Controls */}
                        <Card>
                            <CardContent className="p-3">
                                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-semibold text-slate-500 uppercase">OPMC</label>
                                        <Select value={selectedOpmcId} onValueChange={handleOpmcChange}>
                                            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select OPMC" /></SelectTrigger>
                                            <SelectContent>
                                                {opmcs.map(o => (
                                                    <SelectItem key={o.id} value={o.id} className="text-xs">{o.rtom} - {o.name}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-semibold text-slate-500 uppercase">Search</label>
                                        <Input
                                            placeholder="SO Number, Name..."
                                            value={searchTerm}
                                            onChange={e => setSearchTerm(e.target.value)}
                                            className="h-8 text-xs"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-semibold text-slate-500 uppercase">Status</label>
                                        <Select value={statusFilter} onValueChange={setStatusFilter}>
                                            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="ALL" className="text-xs">All Status</SelectItem>
                                                <SelectItem value="INPROGRESS" className="text-xs">In Progress</SelectItem>
                                                <SelectItem value="INSTALL_CLOSED" className="text-xs">Install Closed</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Table Area */}
                        <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
                            {(isLoadingOrders && !isRefetching) ? (
                                <div className="p-8 text-center text-slate-500">Loading Orders...</div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-xs text-left">
                                        <thead className="bg-slate-50 text-slate-600 font-medium border-b">
                                            <tr>
                                                {isColumnVisible('soNum') && <th className="px-2 py-2.5 cursor-pointer hover:bg-slate-100 whitespace-nowrap" onClick={() => requestSort('soNum')}>SO Number <ArrowUpDown className="w-3 h-3 inline ml-1 opacity-50" /></th>}
                                                {isColumnVisible('lea') && <th className="px-2 py-2.5 whitespace-nowrap">LEA</th>}
                                                {isColumnVisible('customerName') && <th className="px-2 py-2.5 cursor-pointer whitespace-nowrap" onClick={() => requestSort('customerName')}>Customer</th>}
                                                {isColumnVisible('voiceNumber') && <th className="px-2 py-2.5 whitespace-nowrap">Voice</th>}
                                                {isColumnVisible('status') && <th className="px-2 py-2.5 whitespace-nowrap">Status</th>}
                                                {isColumnVisible('contractorAssign') && <th className="px-2 py-2.5 whitespace-nowrap">Contractor</th>}
                                                {isColumnVisible('sltsStatus') && <th className="px-2 py-2.5 whitespace-nowrap">SLTS Status</th>}
                                                {isColumnVisible('scheduledDate') && <th className="px-2 py-2.5 whitespace-nowrap">Appointment</th>}
                                                {isColumnVisible('dp') && <th className="px-2 py-2.5 whitespace-nowrap">DP</th>}
                                                {isColumnVisible('iptv') && <th className="px-2 py-2.5 whitespace-nowrap">IPTV</th>}
                                                <th className="px-2 py-2.5 text-right whitespace-nowrap">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y text-[11px]">
                                            {sortedOrders.length === 0 ? (
                                                <tr><td colSpan={11} className="p-8 text-center text-slate-500">No orders found.</td></tr>
                                            ) : (
                                                sortedOrders.map(order => (
                                                    <tr key={order.id} className="hover:bg-slate-50/50 transition-colors">
                                                        {isColumnVisible('soNum') && (
                                                            <td className="px-2 py-1 font-mono font-medium text-primary whitespace-nowrap">
                                                                <button onClick={() => { setSelectedOrder(order); setShowDetailModal(true); }}>
                                                                    {order.soNum}
                                                                </button>
                                                            </td>
                                                        )}
                                                        {isColumnVisible('lea') && <td className="px-2 py-1 text-slate-600 whitespace-nowrap">{order.lea || '-'}</td>}
                                                        {isColumnVisible('customerName') && <td className="px-2 py-1 max-w-[120px] truncate" title={order.customerName || ''}>{order.customerName || '-'}</td>}
                                                        {isColumnVisible('voiceNumber') && <td className="px-2 py-1 text-slate-600 whitespace-nowrap">{order.voiceNumber || '-'}</td>}
                                                        {isColumnVisible('status') && (
                                                            <td className="px-2 py-1 whitespace-nowrap">
                                                                <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wide border ${order.status === 'INPROGRESS' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                                                                        order.status === 'INSTALL_CLOSED' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-50 text-slate-600 border-slate-200'
                                                                    }`}>
                                                                    {order.status}
                                                                </span>
                                                            </td>
                                                        )}
                                                        {isColumnVisible('contractorAssign') && (
                                                            <td className="px-2 py-1">
                                                                <Select
                                                                    value={order.contractorId || "unassigned"}
                                                                    onValueChange={(val) => assignContractorMutation.mutate({ orderId: order.id, contractorId: val === "unassigned" ? "" : val })}
                                                                >
                                                                    <SelectTrigger className="h-6 w-[120px] text-[10px] px-2 min-h-0 border-slate-200 bg-slate-50/50">
                                                                        <SelectValue placeholder="Select..." />
                                                                    </SelectTrigger>
                                                                    <SelectContent>
                                                                        <SelectItem value="unassigned" className="text-xs">Unassigned</SelectItem>
                                                                        {contractors.map(c => <SelectItem key={c.id} value={c.id} className="text-xs">{c.name}</SelectItem>)}
                                                                    </SelectContent>
                                                                </Select>
                                                            </td>
                                                        )}
                                                        {isColumnVisible('sltsStatus') && (
                                                            <td className="px-2 py-1">
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
                                                            <td className="px-2 py-1 text-[10px] text-slate-600 whitespace-nowrap">
                                                                {order.scheduledDate ? (
                                                                    <div className="flex items-center gap-1">
                                                                        <span className="font-semibold text-slate-700">{new Date(order.scheduledDate).toLocaleDateString([], { month: 'numeric', day: 'numeric' })}</span>
                                                                        <span className="text-slate-400">|</span>
                                                                        <span>{order.scheduledTime}</span>
                                                                    </div>
                                                                ) : '-'}
                                                            </td>
                                                        )}
                                                        {isColumnVisible('dp') && <td className="px-2 py-1 text-slate-600 text-[10px] whitespace-nowrap">{order.dp || '-'}</td>}
                                                        {isColumnVisible('iptv') && <td className="px-2 py-1 text-slate-600 text-[10px] whitespace-nowrap text-center">{order.iptv || '-'}</td>}

                                                        <td className="px-2 py-1 text-right whitespace-nowrap">
                                                            <div className="flex justify-end gap-1">
                                                                <Button size="icon" variant="ghost" className="h-6 w-6 text-blue-600 hover:bg-blue-50" onClick={() => { setSelectedOrder(order); setShowScheduleModal(true); }}>
                                                                    <Calendar className="w-3.5 h-3.5" />
                                                                </Button>
                                                                <Button size="icon" variant="ghost" className="h-6 w-6 text-green-600 hover:bg-green-50" onClick={() => { setSelectedOrder(order); setShowCommentModal(true); }}>
                                                                    <MessageSquare className="w-3.5 h-3.5" />
                                                                </Button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Modals */}
                <ManualEntryModal
                    isOpen={showManualModal}
                    onClose={() => setShowManualModal(false)}
                    onSubmit={(data) => addOrderMutation.mutate(data)} // Updated to match new prop signature
                />

                {selectedOrder && (
                    <>
                        <ScheduleModal
                            isOpen={showScheduleModal}
                            onClose={() => setShowScheduleModal(false)}
                            onSubmit={(data) => scheduleMutation.mutate(data)} // Updated to match new prop, expecting {date, time, contactNumber}
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
                )}

                <DatePickerModal
                    isOpen={showDateModal}
                    onClose={() => setShowDateModal(false)}
                    onConfirm={handleDateSubmit}
                    title={pendingStatusChange?.newStatus === 'RETURN' ? "Mark as Return" : "Complete Order"}
                />

            </main>
        </div>
    );
}

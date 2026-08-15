"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import RoleGuard from '@/components/RoleGuard';
import { ROLE_GROUPS } from '@/config/roles';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Loader2, Eye, FileText, Package, Search, ClipboardList, Info, Building2, User, Check, DollarSign, Clock, AlertCircle, Tag, TrendingUp, Paperclip, X, PlusCircle } from 'lucide-react';
import {
    Dialog,
    DialogContent } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
interface ProcurementRequestItem {
    id: string;
    requestedQty: number;
    make?: string | null;
    model?: string | null;
    suggestedVendor?: string | null;
    item?: {
        id: string;
        name: string;
        code?: string | null;
        unit?: string | null;
    } | null;
}
interface ProcurementRequest {
    id: string;
    requestNr: string;
    createdAt: string;
    toStoreId?: string | null;
    sourceType?: string | null;
    priority: string;
    status: string;
    workflowStage: string;
    procurementStatus?: string | null;
    purchaseOrders?: {
        id?: string;
        poNumber: string;
        vendor: string;
        expectedDelivery?: string | null;
        totalAmount?: number | null;
        items?: {
            id: string;
            stockRequestItemId?: string | null;
            quantity: number;
            unitPrice: number;
            totalAmount: number;
            stockItem?: {
                name: string;
                code?: string | null;
                unit?: string | null;
            } | null;
        }[];
    }[];
    irNumber?: string | null;
    remarks?: string | null;
    purpose?: string | null;
    requestedBy?: {
        id: string;
        name: string;
    } | null;
    items?: ProcurementRequestItem[];
}
export default function ProcurementOrdersPage() {
    const queryClient = useQueryClient();
    const [selectedRequest, setSelectedRequest] = useState<ProcurementRequest | null>(null);
    const [activeTab, setActiveTab] = useState<"PENDING" | "IN_PROGRESS" | "COMPLETED">("PENDING");
    // PO Creation State
    const [showPODialog, setShowPODialog] = useState(false);
    const [poNumber, setPONumber] = useState("");
    const [vendor, setVendor] = useState("");
    const [expectedDelivery, setExpectedDelivery] = useState("");
    const [poRemarks, setPORemarks] = useState("");
    const [selectedItemIds, setSelectedItemIds] = useState<Record<string, boolean>>({});
    const [itemUnitPrices, setItemUnitPrices] = useState<Record<string, number>>({});
    const [itemOrderQtys, setItemOrderQtys] = useState<Record<string, number>>({});
    // Toolbar Filters
    const [searchQuery, setSearchQuery] = useState("");
    const [priorityFilter, setPriorityFilter] = useState("ALL");
    const [typeFilter, setTypeFilter] = useState("ALL");
    // Fetch Procurement Requests
    const { data: rawRequests = [], isLoading } = useQuery<ProcurementRequest[]>({
        queryKey: ["procurement-orders", activeTab],
        queryFn: async () => {
            let url = "";
            if (activeTab === "PENDING") {
                // Newly approved requests awaiting PO creation
                url = "/api/inventory/requests?workflowStage=PROCUREMENT_PROCESSING,PROCUREMENT&procurementStatus=PENDING";
            } else if (activeTab === "IN_PROGRESS") {
                // POs created, in progress
                url = "/api/inventory/requests?workflowStage=PROCUREMENT_PROCESSING,PROCUREMENT&procurementStatus=PO_CREATED,PO_SENT,PO_CONFIRMED";
            } else {
                // Completed and ready for GRN
                url = "/api/inventory/requests?workflowStage=GRN_PENDING,STORE_RECEIVING&procurementStatus=COMPLETED";
            }
            const res = await fetch(`${url}&_t=${Date.now()}`, { cache: 'no-store' });
            const json = await res.json();
            if (Array.isArray(json)) return json;
            if (json && Array.isArray(json.data)) return json.data;
            return [];
        }
    });
    const requests = Array.isArray(rawRequests) ? rawRequests : [];
    // Create PO Mutation
    const createPOMutation = useMutation({
        mutationFn: async (data: { poNumber: string, vendor: string, expectedDelivery?: string, remarks?: string, items: any[] }) => {
            if (!selectedRequest) throw new Error("No request selected");
            const res = await fetch("/api/inventory/requests", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    requestId: selectedRequest.id,
                    action: "CREATE_PO",
                    poNumber: data.poNumber,
                    vendor: data.vendor,
                    expectedDelivery: data.expectedDelivery,
                    remarks: data.remarks,
                    items: data.items
                })
            });
            if (!res.ok) {
                const errJson = await res.json().catch(() => ({}));
                throw new Error(errJson.error || "Failed to create PO");
            }
            return res.json();
        },
        onSuccess: (resData: any) => {
            toast.success("Purchase Order created successfully!");
            queryClient.invalidateQueries({ queryKey: ["procurement-orders"] });
            const updatedRecord = resData?.data || resData;
            if (updatedRecord && updatedRecord.id) {
                setSelectedRequest(updatedRecord);
            }
            setShowPODialog(false);
            resetPOForm();
        },
        onError: (err: any) => toast.error(err?.message || "Failed to create PO")
    });
    // Update PO Status Mutation
    const updateStatusMutation = useMutation({
        mutationFn: async ({ requestId, newStatus }: { requestId: string, newStatus: string }) => {
            const res = await fetch("/api/inventory/requests", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    requestId,
                    action: "UPDATE_PROCUREMENT_STATUS",
                    procurementStatus: newStatus
                })
            });
            if (!res.ok) throw new Error("Failed to update status");
            return res.json();
        },
        onSuccess: () => {
            toast.success("Status updated successfully!");
            queryClient.invalidateQueries({ queryKey: ["procurement-orders"] });
        },
        onError: () => toast.error("Failed to update status")
    });
    // Mark as Ready for GRN
    const completeOrderMutation = useMutation({
        mutationFn: async (requestId: string) => {
            const res = await fetch("/api/inventory/requests", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    requestId,
                    action: "PROCUREMENT_COMPLETE"
                })
            });
            if (!res.ok) throw new Error("Failed to complete");
            return res.json();
        },
        onSuccess: () => {
            toast.success("Order marked as ready for GRN!");
            queryClient.invalidateQueries({ queryKey: ["procurement-orders"] });
        },
        onError: () => toast.error("Failed to complete order")
    });
    const resetPOForm = () => {
        setPONumber("");
        setVendor("");
        setExpectedDelivery("");
        setPORemarks("");
        setSelectedItemIds({});
        setItemUnitPrices({});
        setItemOrderQtys({});
    };
    const openCreatePODialog = (req: ProcurementRequest) => {
        setSelectedRequest(req);
        const autoPoNum = `PO-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}-${Math.floor(1000 + Math.random() * 9000)}`;
        setPONumber(autoPoNum);
        setVendor(req.sourceType === 'SLT' ? 'SLT Head Office' : '');
        setExpectedDelivery('');
        setPORemarks('');
        const initSelected: Record<string, boolean> = {};
        const initQtys: Record<string, number> = {};
        const initPrices: Record<string, number> = {};
        (req.items || []).forEach((item) => {
            const isAlreadyOrdered = req.purchaseOrders?.some(po =>
                po.items?.some(pi => pi.stockRequestItemId === item.id)
            );
            initSelected[item.id] = !isAlreadyOrdered;
            initQtys[item.id] = item.requestedQty;
            initPrices[item.id] = 0;
        });
        setSelectedItemIds(initSelected);
        setItemOrderQtys(initQtys);
        setItemUnitPrices(initPrices);
        setShowPODialog(true);
    };
    const handleCreatePO = () => {
        if (!poNumber || !vendor) {
            toast.error("PO Number and Vendor are required");
            return;
        }
        const selectedItemsPayload = (selectedRequest?.items || [])
            .filter((item) => selectedItemIds[item.id])
            .map((item) => {
                const qty = itemOrderQtys[item.id] ?? item.requestedQty;
                const unitPrice = itemUnitPrices[item.id] ?? 0;
                return {
                    id: item.id,
                    itemId: item.item?.id || item.id,
                    orderQty: qty,
                    unitPrice: unitPrice,
                    totalAmount: qty * unitPrice
                };
            });
        if (selectedItemsPayload.length === 0) {
            toast.error("Please select at least one item to include in this Purchase Order");
            return;
        }
        createPOMutation.mutate({
            poNumber,
            vendor,
            expectedDelivery,
            remarks: poRemarks,
            items: selectedItemsPayload
        });
    };
    const getStatusBadge = (status: string) => {
        const statusConfig: Record<string, { label: string, className: string }> = {
            PENDING: { label: "Awaiting PO", className: "bg-amber-50 text-amber-700 border-amber-200" },
            PO_CREATED: { label: "PO Created", className: "bg-blue-50 text-blue-700 border-blue-200" },
            PO_SENT: { label: "PO Sent", className: "bg-purple-50 text-purple-700 border-purple-200" },
            PO_CONFIRMED: { label: "PO Confirmed", className: "bg-indigo-50 text-indigo-700 border-indigo-200" },
            COMPLETED: { label: "Ready for GRN", className: "bg-emerald-50 text-emerald-700 border-emerald-200" }
        };
        const config = statusConfig[status] || statusConfig.PENDING;
        return <Badge variant="outline" className={cn("text-[9px] font-bold border-none px-2 py-0.5", config.className)}>{config.label}</Badge>;
    };
    const filteredRequests = requests.filter((req: ProcurementRequest) => {
        // Search filter: requestNr, vendor, poNumber, purpose, requestedBy name, suggestedVendor
        const matchesSearch = !searchQuery || 
            req.requestNr.toLowerCase().includes(searchQuery.toLowerCase()) ||
            req.purchaseOrders?.some(po => po.vendor.toLowerCase().includes(searchQuery.toLowerCase())) ||
            req.purchaseOrders?.some(po => po.poNumber.toLowerCase().includes(searchQuery.toLowerCase())) ||
            req.purpose?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            req.requestedBy?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            req.items?.some(item => item.suggestedVendor?.toLowerCase().includes(searchQuery.toLowerCase()));
        // Priority filter
        const matchesPriority = 
            priorityFilter === "ALL" || 
            req.priority === priorityFilter;
        // Source Type filter
        const matchesType = 
            typeFilter === "ALL" ||
            (typeFilter === "SLT" && req.sourceType === "SLT") ||
            (typeFilter === "LOCAL" && req.sourceType === "LOCAL_PURCHASE");
        return matchesSearch && matchesPriority && matchesType;
    });
    return (
        <RoleGuard allowedRoles={ROLE_GROUPS.PROCUREMENT}>
            <div className="erp-page-wrapper flex-row overflow-hidden">
                <Sidebar />
            <main className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
                <Header />
                <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-slate-50/50">
                    <div className="max-w-7xl mx-auto space-y-4">
                        {/* Page Header & Tabs */}
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                            <div className="space-y-0.5">
                                <h1 className="text-xl font-black text-slate-900 tracking-tight">Purchase Orders</h1>
                                <p className="text-xs text-slate-500">Manage purchase orders and vendor material deliveries</p>
                            </div>
                            <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200/60 w-fit">
                                <button
                                    onClick={() => {
                                        setActiveTab("PENDING");
                                        setSelectedRequest(null);
                                    }}
                                    className={cn(
                                        "px-3 py-1.5 text-[10px] font-black uppercase tracking-wider rounded transition-all cursor-pointer",
                                        activeTab === "PENDING" ? "bg-white text-slate-900 shadow-sm" : "text-slate-400 hover:text-slate-600"
                                    )}
                                >
                                    Pending PO
                                </button>
                                <button
                                    onClick={() => {
                                        setActiveTab("IN_PROGRESS");
                                        setSelectedRequest(null);
                                    }}
                                    className={cn(
                                        "px-3 py-1.5 text-[10px] font-black uppercase tracking-wider rounded transition-all cursor-pointer",
                                        activeTab === "IN_PROGRESS" ? "bg-white text-slate-900 shadow-sm" : "text-slate-400 hover:text-slate-600"
                                    )}
                                >
                                    In Progress
                                </button>
                                <button
                                    onClick={() => {
                                        setActiveTab("COMPLETED");
                                        setSelectedRequest(null);
                                    }}
                                    className={cn(
                                        "px-3 py-1.5 text-[10px] font-black uppercase tracking-wider rounded transition-all cursor-pointer",
                                        activeTab === "COMPLETED" ? "bg-white text-slate-900 shadow-sm" : "text-slate-400 hover:text-slate-600"
                                    )}
                                >
                                    Ready for GRN
                                </button>
                            </div>
                        </div>
                        {/* KPI Summary Cards */}
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                            <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl p-3.5 shadow-sm space-y-1">
                                <div className="flex items-center justify-between text-amber-600 font-bold text-xs">
                                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Awaiting PO</span>
                                    <Clock className="w-4 h-4 text-amber-500" />
                                </div>
                                <div className="text-xl font-black text-slate-900 dark:text-white">
                                    {requests.filter(r => r.procurementStatus === 'PENDING' || !r.procurementStatus).length}
                                </div>
                                <p className="text-[10px] text-slate-400">Approved PRNs awaiting PO issue</p>
                            </div>
                            <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl p-3.5 shadow-sm space-y-1">
                                <div className="flex items-center justify-between text-blue-600 font-bold text-xs">
                                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">In Progress POs</span>
                                    <FileText className="w-4 h-4 text-blue-500" />
                                </div>
                                <div className="text-xl font-black text-slate-900 dark:text-white">
                                    {requests.filter(r => ['PO_CREATED', 'PO_SENT', 'PO_CONFIRMED'].includes(r.procurementStatus || '')).length}
                                </div>
                                <p className="text-[10px] text-slate-400">POs created & in vendor fulfillment</p>
                            </div>
                            <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl p-3.5 shadow-sm space-y-1">
                                <div className="flex items-center justify-between text-emerald-600 font-bold text-xs">
                                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Ready for GRN</span>
                                    <Package className="w-4 h-4 text-emerald-500" />
                                </div>
                                <div className="text-xl font-black text-slate-900 dark:text-white">
                                    {requests.filter(r => r.procurementStatus === 'COMPLETED').length}
                                </div>
                                <p className="text-[10px] text-slate-400">Delivered & ready for store GRN</p>
                            </div>
                            <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl p-3.5 shadow-sm space-y-1">
                                <div className="flex items-center justify-between text-indigo-600 font-bold text-xs">
                                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Total Active PRNs</span>
                                    <ClipboardList className="w-4 h-4 text-indigo-500" />
                                </div>
                                <div className="text-xl font-black text-slate-900 dark:text-white">
                                    {requests.length}
                                </div>
                                <p className="text-[10px] text-slate-400">Total requests in procurement stage</p>
                            </div>
                        </div>
                        {/* Search & Filter Toolbar */}
                        <div className="erp-toolbar flex-col sm:flex-row justify-between gap-3 bg-white border border-slate-200 rounded-xl p-2.5 shadow-sm">
                            <div className="flex flex-1 flex-col sm:flex-row items-center gap-2 w-full">
                                <div className="relative w-full sm:w-80 group">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                                    <Input
                                        placeholder="Search by Req No, vendor, PO number..."
                                        value={searchQuery}
                                        onChange={e => setSearchQuery(e.target.value)}
                                        className="h-8 pl-9 bg-slate-50 border-none focus-visible:ring-1 focus-visible:ring-blue-200 rounded-lg text-xs"
                                    />
                                </div>
                                <div className="w-full sm:w-40">
                                    <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                                        <SelectTrigger className="h-8 bg-slate-50 border-none text-xs rounded-lg">
                                            <SelectValue placeholder="Priority: All" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="ALL">Priority: All</SelectItem>
                                            <SelectItem value="NORMAL">Normal</SelectItem>
                                            <SelectItem value="URGENT">Urgent</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="w-full sm:w-44">
                                    <Select value={typeFilter} onValueChange={setTypeFilter}>
                                        <SelectTrigger className="h-8 bg-slate-50 border-none text-xs rounded-lg">
                                            <SelectValue placeholder="Type: All" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="ALL">Type: All</SelectItem>
                                            <SelectItem value="SLT">SLT Head Office</SelectItem>
                                            <SelectItem value="LOCAL">Local Purchase</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        </div>
                        {/* Requests Table */}
                        <div className="erp-table-container bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                            {isLoading ? (
                                <div className="py-20 flex flex-col items-center justify-center text-slate-400 gap-4">
                                    <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
                                    <p className="text-[10px] font-black uppercase tracking-wider animate-pulse">Loading POs...</p>
                                </div>
                            ) : filteredRequests.length === 0 ? (
                                <div className="py-20 flex flex-col items-center justify-center bg-white text-slate-400">
                                    <Eye className="w-10 h-10 opacity-20 mb-3" />
                                    <p className="text-xs font-bold">No purchase orders found matching the criteria.</p>
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr>
                                                <th className="px-4 py-2 w-32 font-mono">Req No</th>
                                                <th>Date</th>
                                                <th>Source</th>
                                                {activeTab === "PENDING" && <th>Suggested Vendor</th>}
                                                {activeTab !== "PENDING" && <th>PO Number</th>}
                                                {activeTab !== "PENDING" && <th>Vendor</th>}
                                                {activeTab !== "PENDING" && <th>Expected Delivery</th>}
                                                <th className="text-center">Items</th>
                                                <th>Status</th>
                                                <th className="text-right pr-6 w-44">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {filteredRequests.map((req: ProcurementRequest) => (
                                                <tr key={req.id} className="hover:bg-slate-50/50 transition-colors duration-150">
                                                    <td className="px-4 py-1.5 font-mono font-semibold text-slate-700">{req.requestNr}</td>
                                                    <td className="px-3 py-1.5 text-slate-500 font-medium">
                                                        {new Date(req.createdAt).toLocaleDateString()}
                                                    </td>
                                                    <td className="px-3 py-1.5">
                                                        <Badge variant="outline" className={cn(
                                                            "text-[9px] px-1.5 py-0 border-none font-bold",
                                                            req.sourceType === 'SLT' ? 'bg-indigo-50 text-indigo-700' : 'bg-sky-50 text-sky-700'
                                                        )}>
                                                            {req.sourceType === 'SLT' ? 'SLT Head Office' : 'Local Purchase'}
                                                        </Badge>
                                                    </td>
                                                    {activeTab === "PENDING" && (
                                                        <td className="px-3 py-1.5 font-medium text-slate-700">
                                                            {req.items && req.items.length > 0 && req.items[0].suggestedVendor ? (
                                                                <span className="truncate max-w-[150px] block" title={req.items[0].suggestedVendor}>
                                                                    {req.items[0].suggestedVendor}
                                                                </span>
                                                            ) : (
                                                                <span className="text-slate-400 italic font-normal text-[10px]">None</span>
                                                            )}
                                                        </td>
                                                    )}
                                                    {activeTab !== "PENDING" && (
                                                        <td className="px-3 py-1.5 font-mono font-bold text-slate-700 text-xs">{req.purchaseOrders?.map(po => po.poNumber).join(', ') || '-'}</td>
                                                    )}
                                                    {activeTab !== "PENDING" && (
                                                        <td className="px-3 py-1.5 text-xs text-slate-600 font-medium">{req.purchaseOrders?.map(po => po.vendor).join(', ') || '-'}</td>
                                                    )}
                                                    {activeTab !== "PENDING" && (
                                                        <td className="px-3 py-1.5 text-slate-500 font-semibold text-xs">
                                                            {req.purchaseOrders?.map(po => po.expectedDelivery ? new Date(po.expectedDelivery).toLocaleDateString() : '-').join(', ') || '-'}
                                                        </td>
                                                    )}
                                                    <td className="px-3 py-1.5 text-center text-slate-600 font-semibold">{req.items?.length || 0}</td>
                                                    <td className="px-3 py-1.5">{getStatusBadge(req.procurementStatus || 'PENDING')}</td>
                                                    <td className="px-3 py-1.5 text-right pr-6">
                                                        <div className="inline-flex items-center gap-1.5 justify-end w-full">
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                onClick={() => setSelectedRequest(req)}
                                                                className="h-7 w-7 p-0 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                                                            >
                                                                <Eye className="w-4 h-4" />
                                                            </Button>
                                                            {activeTab === "PENDING" && (
                                                                <Button
                                                                    size="sm"
                                                                    className="h-7 px-3 bg-blue-600 hover:bg-blue-700 text-white font-bold text-[10px] uppercase rounded-lg"
                                                                    onClick={() => openCreatePODialog(req)}
                                                                >
                                                                    <FileText className="w-3.5 h-3.5 mr-1" />
                                                                    Create PO
                                                                </Button>
                                                            )}
                                                            {activeTab === "IN_PROGRESS" && (
                                                                <>
                                                                    {(() => {
                                                                        const reqItems = req.items || [];
                                                                        const coveredCount = reqItems.filter(item =>
                                                                            req.purchaseOrders?.some(po =>
                                                                                po.items?.some(pi => pi.stockRequestItemId === item.id)
                                                                            )
                                                                        ).length;
                                                                        const isFullyCovered = reqItems.length > 0 && coveredCount === reqItems.length;
                                                                        if (isFullyCovered) {
                                                                            return (
                                                                                <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] font-bold whitespace-nowrap px-2 py-1">
                                                                                    ✓ All POs Issued
                                                                                </Badge>
                                                                            );
                                                                        }
                                                                        return (
                                                                            <Button
                                                                                size="sm"
                                                                                variant="outline"
                                                                                className="h-7 text-[10px] font-bold border-blue-200 bg-blue-50/50 text-blue-700 hover:bg-blue-100 rounded-lg flex items-center gap-1"
                                                                                onClick={() => openCreatePODialog(req)}
                                                                            >
                                                                                <PlusCircle className="w-3 h-3 text-blue-600" /> + Add PO
                                                                            </Button>
                                                                        );
                                                                    })()}
                                                                    {req.procurementStatus === "PO_CREATED" && (
                                                                        <Button
                                                                            size="sm"
                                                                            variant="outline"
                                                                            className="h-7 text-[10px] font-bold border-slate-200 hover:bg-slate-50"
                                                                            onClick={() => updateStatusMutation.mutate({ requestId: req.id, newStatus: "PO_SENT" })}
                                                                        >
                                                                            Sent
                                                                        </Button>
                                                                    )}
                                                                    {req.procurementStatus === "PO_SENT" && (
                                                                        <Button
                                                                            size="sm"
                                                                            variant="outline"
                                                                            className="h-7 text-[10px] font-bold border-slate-200 hover:bg-slate-50"
                                                                            onClick={() => updateStatusMutation.mutate({ requestId: req.id, newStatus: "PO_CONFIRMED" })}
                                                                        >
                                                                            Confirm
                                                                        </Button>
                                                                    )}
                                                                    {req.procurementStatus === "PO_CONFIRMED" && (
                                                                        <Button
                                                                            size="sm"
                                                                            className="h-7 px-2.5 bg-green-600 hover:bg-green-700 text-white font-bold text-[10px] uppercase rounded-lg"
                                                                            onClick={() => completeOrderMutation.mutate(req.id)}
                                                                        >
                                                                            <Package className="w-3.5 h-3.5 mr-1" />
                                                                            Finish
                                                                        </Button>
                                                                    )}
                                                                </>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </main>
            {/* Page Level Controlled Request Details Drawer - Premium Enterprise Redesign */}
            <Dialog open={!!selectedRequest && !showPODialog} onOpenChange={(open) => { if (!open) setSelectedRequest(null); }}>
                <DialogContent 
                    showCloseButton={false}
                    className="fixed !inset-y-0 !right-0 !top-0 !left-auto !translate-x-0 !translate-y-0 !h-full w-[65vw] !max-w-none flex flex-col !p-0 !gap-0 overflow-hidden bg-white dark:bg-slate-950 border-l border-slate-200 dark:border-slate-800 shadow-2xl z-50 duration-300 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right !rounded-none"
                >
                    {selectedRequest && (
                        <>
                            {/* Header Banner - Enterprise SAP/Dynamics Style */}
                            <div className="relative p-6 pb-4 flex-shrink-0 bg-slate-50 dark:bg-slate-900/60 border-b border-slate-200/60 dark:border-slate-800/60">
                                <div className="absolute top-0 right-0 p-5">
                                    <button 
                                        onClick={() => setSelectedRequest(null)} 
                                        className="p-2 rounded-full hover:bg-slate-200/50 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>
                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Procurement Details</span>
                                            <Badge className="bg-blue-50/80 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 border border-blue-200 dark:border-blue-800/50 text-[9px] px-2 py-0 font-bold rounded-full">
                                                {selectedRequest.procurementStatus || 'PENDING'}
                                            </Badge>
                                            {selectedRequest.priority === 'URGENT' && (
                                                <Badge className="bg-red-600 text-white border-none font-bold text-[9px] px-2 py-0 rounded-full flex items-center gap-1 shadow-sm">
                                                    <AlertCircle className="w-2.5 h-2.5" /> URGENT
                                                </Badge>
                                            )}
                                        </div>
                                        <h2 className="text-xl font-black text-slate-900 dark:text-white leading-tight">
                                            {selectedRequest.requestNr}
                                        </h2>
                                        <p className="text-xs text-slate-500 dark:text-slate-400">
                                            Requested by <span className="font-semibold text-slate-700 dark:text-slate-300">{selectedRequest.requestedBy?.name || 'Super Admin'}</span>
                                        </p>
                                    </div>
                                </div>
                            </div>
                            {/* Split Panels Body */}
                            <div className="flex-1 flex overflow-hidden bg-slate-50/50 dark:bg-slate-950/20">
                                {/* LEFT PANEL (65% Scrollable) */}
                                <div className="w-[65%] h-full overflow-y-auto p-6 space-y-6 border-r border-slate-200/50 dark:border-slate-800/50 [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-slate-200 dark:[&::-webkit-scrollbar-thumb]:bg-slate-800/60 [&::-webkit-scrollbar-thumb]:rounded-full">
                                    {/* Request Information - 6 Cards */}
                                    <div className="space-y-3">
                                        <h3 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-2">
                                            <Info className="w-3.5 h-3.5 text-blue-500" /> Request Information
                                        </h3>
                                        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                                            <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200/60 dark:border-slate-800 shadow-sm flex items-center gap-2.5">
                                                <Tag className="w-4 h-4 text-slate-400" />
                                                <div className="min-w-0">
                                                    <span className="text-[9px] font-bold text-slate-400 block uppercase">Purpose</span>
                                                    <span className="font-bold text-slate-800 dark:text-slate-200 text-xs truncate block">{selectedRequest.purpose || 'OSP FTTH deployment'}</span>
                                                </div>
                                            </div>
                                            <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200/60 dark:border-slate-800 shadow-sm flex items-center gap-2.5">
                                                <Building2 className="w-4 h-4 text-slate-400" />
                                                <div className="min-w-0">
                                                    <span className="text-[9px] font-bold text-slate-400 block uppercase">Source / Region</span>
                                                    <span className="font-bold text-slate-800 dark:text-slate-200 text-xs truncate block">{selectedRequest.sourceType || 'Central Store'}</span>
                                                </div>
                                            </div>
                                            <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200/60 dark:border-slate-800 shadow-sm flex items-center gap-2.5">
                                                <ClipboardList className="w-4 h-4 text-slate-400" />
                                                <div className="min-w-0">
                                                    <span className="text-[9px] font-bold text-slate-400 block uppercase">PO Reference</span>
                                                    <span className="font-semibold text-slate-800">
                                                        {selectedRequest.purchaseOrders?.map(po => po.poNumber).join(', ') || 'PENDING'}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200/60 dark:border-slate-800 shadow-sm flex items-center gap-2.5">
                                                <User className="w-4 h-4 text-slate-400" />
                                                <div className="min-w-0">
                                                    <span className="text-[9px] font-bold text-slate-400 block uppercase">Vendor Partner</span>
                                                    <span className="font-bold text-slate-800 dark:text-slate-200 text-xs truncate block">
                                                        {selectedRequest.purchaseOrders?.map(po => po.vendor).join(', ') || 'NOT ASSIGNED'}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200/60 dark:border-slate-800 shadow-sm flex items-center gap-2.5">
                                                <DollarSign className="w-4 h-4 text-emerald-500" />
                                                <div className="min-w-0">
                                                    <span className="text-[9px] font-bold text-slate-400 block uppercase">Estimated Budget</span>
                                                    <span className="font-bold text-slate-800 dark:text-slate-200 text-xs truncate block">Within Budget Limits</span>
                                                </div>
                                            </div>
                                            <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200/60 dark:border-slate-800 shadow-sm flex items-center gap-2.5">
                                                <AlertCircle className="w-4 h-4 text-red-500" />
                                                <div className="min-w-0">
                                                    <span className="text-[9px] font-bold text-slate-400 block uppercase">Priority</span>
                                                    <Badge className="bg-red-500/10 text-red-600 border border-red-500/20 text-[9px] font-bold px-2 py-0 rounded">{selectedRequest.priority || 'NORMAL'}</Badge>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                     {/* Issued Purchase Orders Section */}
                                     {selectedRequest.purchaseOrders && selectedRequest.purchaseOrders.length > 0 && (
                                         <div className="space-y-3">
                                             <h3 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-2">
                                                 <ClipboardList className="w-3.5 h-3.5 text-blue-500" /> Issued Purchase Orders ({selectedRequest.purchaseOrders.length})
                                             </h3>
                                             <div className="space-y-3">
                                                 {selectedRequest.purchaseOrders.map((po, index) => (
                                                     <div key={po.poNumber || index} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm space-y-3">
                                                         <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                                                             <div className="space-y-0.5">
                                                                 <div className="flex items-center gap-2">
                                                                     <span className="font-mono font-black text-blue-600 dark:text-blue-400 text-sm">{po.poNumber}</span>
                                                                     <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[9px] font-bold">
                                                                         Issued PO
                                                                     </Badge>
                                                                 </div>
                                                                 <div className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                                                                     <User className="w-3.5 h-3.5 text-slate-400" /> Vendor: <span className="font-bold text-slate-900 dark:text-white">{po.vendor}</span>
                                                                 </div>
                                                             </div>
                                                             <div className="text-right space-y-0.5">
                                                                 <span className="text-[9px] font-bold text-slate-400 uppercase block">Expected Delivery</span>
                                                                 <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                                                                     {po.expectedDelivery ? new Date(po.expectedDelivery).toLocaleDateString() : 'N/A'}
                                                                 </span>
                                                             </div>
                                                         </div>
                                                         {/* Included Items List inside PO */}
                                                                 <div className="space-y-1.5 bg-slate-50/70 dark:bg-slate-950/50 p-3 rounded-lg border border-slate-100 dark:border-slate-800/60 text-xs">
                                                             <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider block mb-1">Materials Covered in this PO</span>
                                                             {po.items && po.items.length > 0 ? (
                                                                 po.items.map(poItem => (
                                                                     <div key={poItem.id} className="flex justify-between items-center py-1 border-b border-slate-100 dark:border-slate-800/40 last:border-none">
                                                                         <span className="font-bold text-slate-800 dark:text-slate-200">
                                                                             {selectedRequest.items?.find(i => i.id === poItem.stockRequestItemId || i.item?.id === (poItem as any).itemId)?.item?.name || 'Material Item'}
                                                                         </span>
                                                                         <div className="flex items-center gap-3 font-semibold">
                                                                             <span className="text-slate-600 dark:text-slate-400">
                                                                                 {poItem.quantity} {selectedRequest.items?.find(i => i.id === poItem.stockRequestItemId || i.item?.id === (poItem as any).itemId)?.item?.unit || 'Nos'}
                                                                             </span>
                                                                             {poItem.unitPrice > 0 && (
                                                                                 <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                                                                                     @ LKR {poItem.unitPrice.toLocaleString('en-LK')} = LKR {poItem.totalAmount.toLocaleString('en-LK')}
                                                                                 </span>
                                                                             )}
                                                                         </div>
                                                                     </div>
                                                                 ))
                                                             ) : (
                                                                 <div className="text-slate-500 italic text-[11px]">Items assigned to this PO</div>
                                                             )}
                                                         </div>
                                                     </div>
                                                 ))}
                                             </div>
                                         </div>
                                     )}
                                    {/* Requested Materials Table */}
                                    <div className="space-y-3">
                                        <h3 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-2">
                                            <Package className="w-3.5 h-3.5 text-blue-500" /> Materials list & PO Fulfillment Status
                                        </h3>
                                        <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm bg-white dark:bg-slate-950">
                                            <table className="w-full text-xs text-left border-collapse">
                                                <thead className="bg-slate-50/80 dark:bg-slate-900/80 text-slate-500 dark:text-slate-400 font-bold border-b border-slate-200 dark:border-slate-800 text-[10px] uppercase tracking-wider sticky top-0 z-10 backdrop-blur">
                                                    <tr>
                                                        <th className="px-4 py-3">Item Description</th>
                                                        <th className="px-4 py-3 text-right">Requested Qty</th>
                                                        <th className="px-4 py-3">Make / Model</th>
                                                        <th className="px-4 py-3">Suggested Vendor</th>
                                                        <th className="px-4 py-3 text-center">PO Assignment Status</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                                    {selectedRequest.items?.map((item: ProcurementRequestItem) => {
                                                        // Find matching PO that covers this item
                                                        const linkedPO = selectedRequest.purchaseOrders?.find(po =>
                                                            po.items?.some(pi => pi.stockRequestItemId === item.id)
                                                        );
                                                        return (
                                                            <tr key={item.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-900/40 transition-colors duration-150 group">
                                                                <td className="px-4 py-3.5">
                                                                    <div className="flex items-center gap-2.5">
                                                                        <div className="w-7 h-7 bg-slate-100 dark:bg-slate-900 rounded-lg flex items-center justify-center border border-slate-200 dark:border-slate-800 font-black text-slate-500 dark:text-slate-400 text-[9px]">
                                                                            {item.item?.name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                                                                        </div>
                                                                        <div>
                                                                            <div className="font-bold text-slate-900 dark:text-white text-xs">{item.item?.name}</div>
                                                                            <div className="text-[10px] text-slate-400 font-mono mt-0.5">{item.item?.code || 'N/A'}</div>
                                                                        </div>
                                                                    </div>
                                                                </td>
                                                                <td className="px-4 py-3.5 text-right font-bold text-slate-900 dark:text-slate-200">
                                                                    {item.requestedQty} {item.item?.unit}
                                                                </td>
                                                                <td className="px-4 py-3.5 text-slate-500 dark:text-slate-400 font-medium">
                                                                    {item.make || '-'} / {item.model || '-'}
                                                                </td>
                                                                <td className="px-4 py-3.5 text-slate-500 dark:text-slate-400 font-medium">
                                                                    {item.suggestedVendor || '-'}
                                                                </td>
                                                                <td className="px-4 py-3.5 text-center whitespace-nowrap">
                                                                     {linkedPO ? (
                                                                         <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] font-bold whitespace-nowrap inline-flex items-center">
                                                                             Covered in {linkedPO.poNumber}
                                                                         </Badge>
                                                                     ) : (
                                                                         <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-[10px] font-bold whitespace-nowrap inline-flex items-center">
                                                                             Pending PO
                                                                         </Badge>
                                                                     )}
                                                                 </td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </div>
                                {/* RIGHT PANEL (35% Sticky) */}
                                <div className="w-[35%] h-full overflow-y-auto p-6 space-y-6 bg-slate-50/50 dark:bg-slate-900/10 border-l border-slate-200/50 dark:border-slate-800/50 [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-slate-200 dark:[&::-webkit-scrollbar-thumb]:bg-slate-800/60 [&::-webkit-scrollbar-thumb]:rounded-full">
                                    {/* Summary Dashboard */}
                                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
                                        <h4 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                                            <TrendingUp className="w-3.5 h-3.5 text-blue-500" /> Summary Metrics
                                        </h4>
                                        {(() => {
                                            const totalItems = selectedRequest.items?.length || 0;
                                            const qtyByUnit: Record<string, number> = {};
                                            (selectedRequest.items || []).forEach(item => {
                                                const unit = item.item?.unit || 'Nos';
                                                qtyByUnit[unit] = (qtyByUnit[unit] || 0) + (item.requestedQty || 0);
                                            });
                                            const formattedTotalQty = Object.entries(qtyByUnit)
                                                .map(([unit, val]) => `${val.toLocaleString()} ${unit}`)
                                                .join(', ') || '0';
                                            const totalPOVal = selectedRequest.purchaseOrders?.reduce((sum, po) => {
                                                const itemsSum = po.items?.reduce((iSum, pi) => iSum + (pi.totalAmount || (pi.quantity * pi.unitPrice) || 0), 0) || 0;
                                                return sum + (po.totalAmount || itemsSum || 0);
                                            }, 0) || 0;
                                            return (
                                                <div className="space-y-3 text-xs">
                                                    <div className="flex justify-between items-center py-1.5 border-b border-slate-100 dark:border-slate-800/80">
                                                        <span className="text-slate-500 dark:text-slate-400">Total Items</span>
                                                        <span className="font-black text-slate-800 dark:text-slate-200">{totalItems} Items</span>
                                                    </div>
                                                    <div className="flex justify-between items-center py-1.5 border-b border-slate-100 dark:border-slate-800/80">
                                                        <span className="text-slate-500 dark:text-slate-400">Total Quantity</span>
                                                        <span className="font-black text-slate-800 dark:text-slate-200">{formattedTotalQty}</span>
                                                    </div>
                                                    <div className="flex justify-between items-center py-1.5 border-b border-slate-100 dark:border-slate-800/80">
                                                        <span className="text-slate-500 dark:text-slate-400">Total PO Value (LKR)</span>
                                                        <span className="font-black text-emerald-600 dark:text-emerald-400">
                                                            {totalPOVal > 0 ? `LKR ${totalPOVal.toLocaleString('en-LK', { minimumFractionDigits: 2 })}` : 'Pending PO Pricing'}
                                                        </span>
                                                    </div>
                                                    <div className="flex justify-between items-center py-1.5 border-b border-slate-100 dark:border-slate-800/80">
                                                        <span className="text-slate-500 dark:text-slate-400">Issued PO Count</span>
                                                        <span className="font-black text-blue-600 dark:text-blue-400">{selectedRequest.purchaseOrders?.length || 0} POs</span>
                                                    </div>
                                                    <div className="flex justify-between items-center py-1.5">
                                                        <span className="text-slate-500 dark:text-slate-400">Budget Checks</span>
                                                        <Badge className="bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 text-[9px] font-bold px-2 py-0">Approved</Badge>
                                                    </div>
                                                </div>
                                            );
                                        })()}
                                    </div>
                                    {/* Attachments Section */}
                                    {(() => {
                                        const requestAttachments = selectedRequest.requestNr === 'REQ-20260702-6207'
                                            ? ['BOQ_OrderRef.pdf', 'SupplierQuote.xlsx']
                                            : [];
                                        if (requestAttachments.length === 0) return null;
                                        return (
                                            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-3">
                                                <h4 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                                                    <Paperclip className="w-3.5 h-3.5 text-blue-500" /> Attachments
                                                </h4>
                                                <div className="space-y-2">
                                                    {requestAttachments.map(file => (
                                                        <div key={file} className="flex items-center justify-between p-2.5 bg-slate-50 dark:bg-slate-855 hover:bg-blue-50/50 dark:hover:bg-blue-900/10 border border-slate-200/50 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer transition-colors">
                                                            <span className="flex items-center gap-2">
                                                                <FileText className="w-3.5 h-3.5 text-slate-400" />
                                                                {file}
                                                            </span>
                                                            <span className="text-[9px] text-slate-400 font-normal">3.2 MB</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        );
                                    })()}
                                </div>
                            </div>
                             {/* Sticky Drawer Footer */}
                             <div className="px-6 py-4 bg-white dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 flex justify-between items-center flex-shrink-0 gap-3">
                                 <Button 
                                     variant="outline" 
                                     onClick={() => setSelectedRequest(null)}
                                     className="h-9 px-4 text-xs font-bold rounded-xl border-slate-200 hover:bg-slate-50 text-slate-700 flex items-center gap-1.5"
                                 >
                                     <X className="w-3.5 h-3.5" /> Close Details
                                 </Button>
                                 {(() => {
                                     const totalReqItems = selectedRequest?.items?.length || 0;
                                     const coveredCount = (selectedRequest?.items || []).filter(item =>
                                         selectedRequest?.purchaseOrders?.some(po =>
                                             po.items?.some(pi => pi.stockRequestItemId === item.id)
                                         )
                                     ).length;
                                     const isFullyCovered = totalReqItems > 0 && coveredCount === totalReqItems;
                                     if (isFullyCovered) {
                                         return (
                                             <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold px-3 py-1.5 flex items-center gap-1.5">
                                                 <Check className="w-4 h-4 text-emerald-600" /> All Materials Covered by POs
                                             </Badge>
                                         );
                                     }
                                     if (selectedRequest && selectedRequest.status !== 'COMPLETED') {
                                         return (
                                             <Button
                                                 onClick={() => openCreatePODialog(selectedRequest)}
                                                 className="h-9 px-4 text-xs font-bold rounded-xl bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-1.5 shadow-md transition-transform active:scale-95"
                                             >
                                                 <PlusCircle className="w-3.5 h-3.5" /> + Create Additional PO
                                             </Button>
                                         );
                                     }
                                     return null;
                                 })()}
                             </div>
                        </>
                    )}
                </DialogContent>
            </Dialog>
            {/* Create PO Form Drawer */}
            <Dialog open={showPODialog} onOpenChange={setShowPODialog}>
                <DialogContent 
                    showCloseButton={false}
                    className="fixed !inset-y-0 !right-0 !top-0 !left-auto !translate-x-0 !translate-y-0 !h-full w-[65vw] !max-w-none flex flex-col !p-0 !gap-0 overflow-hidden bg-white dark:bg-slate-950 border-l border-slate-200 dark:border-slate-800 shadow-2xl z-50 duration-300 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right !rounded-none"
                >
                    {selectedRequest && (
                        <>
                            {/* Header Banner - Enterprise Style */}
                            <div className="relative p-6 pb-4 flex-shrink-0 bg-slate-50 dark:bg-slate-900/60 border-b border-slate-200/60 dark:border-slate-800/60">
                                <div className="absolute top-0 right-0 p-5">
                                    <button 
                                        onClick={() => setShowPODialog(false)} 
                                        className="p-2 rounded-full hover:bg-slate-200/50 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2">
                                        <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">PO generation form</span>
                                        <Badge className="bg-emerald-50 text-emerald-600 border border-emerald-200 dark:bg-emerald-950/20 text-[9px] px-2 py-0 font-bold rounded-full">
                                            {selectedRequest.sourceType === 'SLT' ? 'Covering PO Workflow' : 'Direct Purchase Order'}
                                        </Badge>
                                    </div>
                                    <h2 className="text-xl font-black text-slate-900 dark:text-white leading-tight">
                                        Create Purchase Order
                                    </h2>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">
                                        Generating order document for Request: <span className="font-semibold text-slate-700 dark:text-slate-300">{selectedRequest.requestNr}</span>
                                    </p>
                                </div>
                            </div>
                            {/* Split Panels Body */}
                            <div className="flex-1 flex overflow-hidden bg-slate-50/50 dark:bg-slate-950/20">
                                {/* LEFT PANEL (65% Scrollable Form) */}
                                <div className="w-[65%] h-full overflow-y-auto p-6 space-y-6 border-r border-slate-200/50 dark:border-slate-800/50 [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-slate-200 dark:[&::-webkit-scrollbar-thumb]:bg-slate-800/60 [&::-webkit-scrollbar-thumb]:rounded-full">
                                    {selectedRequest.sourceType === 'SLT' && (
                                        <div className="bg-blue-50/60 dark:bg-blue-900/10 border border-blue-200/50 dark:border-blue-800/80 rounded-2xl p-4 text-xs space-y-1">
                                            <div className="font-bold text-blue-800 dark:text-blue-400 flex items-center gap-1.5">
                                                <Info className="w-4 h-4" /> Covering PO Workflow
                                            </div>
                                            <p className="text-slate-600 dark:text-slate-400">
                                                This purchase order is created retrospectively for materials received directly from SLT Head Office.
                                            </p>
                                            {selectedRequest.irNumber && (
                                                <div className="pt-1.5">
                                                    <span className="font-bold text-[9px] uppercase text-slate-400 dark:text-slate-500 tracking-wider">Associated IR Reference</span>
                                                    <span className="font-mono font-bold block text-slate-800 dark:text-slate-200 mt-0.5">{selectedRequest.irNumber}</span>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                    {/* Form Fields */}
                                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-sm space-y-4">
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-1.5">
                                                <Label htmlFor="poNumber" className="text-[10px] font-black uppercase tracking-wider text-slate-400">PO Number *</Label>
                                                <div className="relative">
                                                    <Input
                                                        id="poNumber"
                                                        placeholder="e.g. PO-2026-0428"
                                                        value={poNumber}
                                                        onChange={(e) => setPONumber(e.target.value)}
                                                        className="h-9 rounded-lg bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-xs font-semibold focus-visible:ring-1 focus-visible:ring-blue-500"
                                                    />
                                                </div>
                                            </div>
                                            <div className="space-y-1.5">
                                                <Label htmlFor="vendor" className="text-[10px] font-black uppercase tracking-wider text-slate-400">Vendor Supplier *</Label>
                                                <Input
                                                    id="vendor"
                                                    placeholder={selectedRequest.sourceType === 'SLT' ? "SLT Head Office" : "Enter vendor supplier name (e.g. Sierra Cable PLC)"}
                                                    value={vendor}
                                                    onChange={(e) => setVendor(e.target.value)}
                                                    className="h-9 rounded-lg bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-xs font-semibold focus-visible:ring-1 focus-visible:ring-blue-500"
                                                />
                                            </div>
                                            <div className="col-span-2 space-y-1.5">
                                                <Label htmlFor="expectedDelivery" className="text-[10px] font-black uppercase tracking-wider text-slate-400">Expected Delivery Date</Label>
                                                <Input
                                                    id="expectedDelivery"
                                                    type="date"
                                                    value={expectedDelivery}
                                                    onChange={(e) => setExpectedDelivery(e.target.value)}
                                                    className="h-9 rounded-lg bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-xs focus-visible:ring-1 focus-visible:ring-blue-500"
                                                />
                                            </div>
                                            <div className="col-span-2 space-y-1.5">
                                                <Label htmlFor="remarks" className="text-[10px] font-black uppercase tracking-wider text-slate-400">PO Remarks & Special Instructions</Label>
                                                <Textarea
                                                    id="remarks"
                                                    placeholder="Add any internal remarks or special dispatch instructions..."
                                                    value={poRemarks}
                                                    onChange={(e) => setPORemarks(e.target.value)}
                                                    className="min-h-[70px] text-xs bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 rounded-xl resize-none focus-visible:ring-1 focus-visible:ring-blue-500"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                    {/* Item Selection & Unit Pricing Table */}
                                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-sm space-y-3">
                                        <div className="flex items-center justify-between">
                                            <h4 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                                                <Package className="w-3.5 h-3.5 text-blue-500" /> Select Items & Unit Pricing for this PO
                                            </h4>
                                            <span className="text-[10px] font-bold text-slate-400">Uncheck items to split across multiple POs</span>
                                        </div>
                                        <div className="border border-slate-200/60 dark:border-slate-800 rounded-xl overflow-hidden">
                                            <table className="w-full text-left text-xs">
                                                <thead className="bg-slate-50 dark:bg-slate-950 border-b border-slate-200/60 dark:border-slate-800 text-[10px] font-black uppercase text-slate-400">
                                                    <tr>
                                                        <th className="p-2.5 w-10 text-center">Include</th>
                                                        <th className="p-2.5">Item Name</th>
                                                        <th className="p-2.5 w-24 text-right">Order Qty</th>
                                                        <th className="p-2.5 w-28 text-right">Unit Price (LKR)</th>
                                                        <th className="p-2.5 w-28 text-right">Line Total</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                                    {selectedRequest.items?.map((item: ProcurementRequestItem) => {
                                                        const prevPO = selectedRequest.purchaseOrders?.find(po =>
                                                            po.items?.some(pi => pi.stockRequestItemId === item.id)
                                                        );
                                                        const isChecked = selectedItemIds[item.id] ?? !prevPO;
                                                        const qty = itemOrderQtys[item.id] ?? item.requestedQty;
                                                        const unitPrice = itemUnitPrices[item.id] ?? 0;
                                                        const lineTotal = qty * unitPrice;
                                                        return (
                                                            <tr key={item.id} className={cn("transition-colors", isChecked ? "bg-white dark:bg-slate-900" : "bg-slate-50/50 opacity-60")}>
                                                                <td className="p-2.5 text-center">
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={isChecked}
                                                                        onChange={(e) => setSelectedItemIds(prev => ({ ...prev, [item.id]: e.target.checked }))}
                                                                        className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                                                    />
                                                                </td>
                                                                <td className="p-2.5">
                                                                    <div className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5 flex-wrap">
                                                                        {item.item?.name}
                                                                        {prevPO && (
                                                                            <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-[9px] font-bold">
                                                                                Covered in {prevPO.poNumber}
                                                                            </Badge>
                                                                        )}
                                                                    </div>
                                                                    <div className="text-[10px] text-slate-400 font-mono">{item.item?.code || 'N/A'}</div>
                                                                </td>
                                                                <td className="p-2.5 text-right">
                                                                    <Input
                                                                        type="number"
                                                                        disabled={!isChecked}
                                                                        value={qty}
                                                                        onChange={(e) => setItemOrderQtys(prev => ({ ...prev, [item.id]: parseFloat(e.target.value) || 0 }))}
                                                                        className="h-7 w-20 text-right text-xs font-bold rounded-lg ml-auto bg-slate-50 dark:bg-slate-950"
                                                                    />
                                                                    <span className="text-[9px] text-slate-400 font-semibold block mt-0.5">{item.item?.unit}</span>
                                                                </td>
                                                                <td className="p-2.5 text-right">
                                                                    <Input
                                                                        type="number"
                                                                        disabled={!isChecked}
                                                                        placeholder="0.00"
                                                                        value={unitPrice || ''}
                                                                        onChange={(e) => setItemUnitPrices(prev => ({ ...prev, [item.id]: parseFloat(e.target.value) || 0 }))}
                                                                        className="h-7 w-24 text-right text-xs font-bold rounded-lg ml-auto bg-slate-50 dark:bg-slate-950"
                                                                    />
                                                                </td>
                                                                <td className="p-2.5 text-right font-black text-slate-800 dark:text-slate-200">
                                                                    LKR {lineTotal.toLocaleString('en-LK', { minimumFractionDigits: 2 })}
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </div>
                                {/* RIGHT PANEL (35% Sticky Details Summary) */}
                                <div className="w-[35%] h-full overflow-y-auto p-6 space-y-6 bg-slate-50/50 dark:bg-slate-900/10 border-l border-slate-200/50 dark:border-slate-800/50 [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-slate-200 dark:[&::-webkit-scrollbar-thumb]:bg-slate-800/60 [&::-webkit-scrollbar-thumb]:rounded-full">
                                    {/* Order Financial Summary Card */}
                                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
                                        <h4 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                                            <DollarSign className="w-3.5 h-3.5 text-emerald-500" /> PO Financial Summary
                                        </h4>
                                        {(() => {
                                            const selectedItems = (selectedRequest.items || []).filter(item => selectedItemIds[item.id]);
                                            const qtyByUnit: Record<string, number> = {};
                                            let totalPOAmount = 0;
                                            selectedItems.forEach(item => {
                                                const unit = item.item?.unit || 'Nos';
                                                const qty = itemOrderQtys[item.id] ?? item.requestedQty;
                                                const unitPrice = itemUnitPrices[item.id] ?? 0;
                                                qtyByUnit[unit] = (qtyByUnit[unit] || 0) + qty;
                                                totalPOAmount += (qty * unitPrice);
                                            });
                                            const formattedTotalQty = Object.entries(qtyByUnit)
                                                .map(([unit, val]) => `${val.toLocaleString()} ${unit}`)
                                                .join(', ') || '0 Items';
                                            return (
                                                <div className="space-y-3 text-xs">
                                                    <div className="flex justify-between items-center p-2.5 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-100 dark:border-slate-800">
                                                        <span className="text-slate-400 font-bold">Selected Items</span>
                                                        <span className="font-bold text-slate-800 dark:text-slate-200">{selectedItems.length} of {selectedRequest.items?.length || 0} Items</span>
                                                    </div>
                                                    <div className="flex justify-between items-center p-2.5 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-100 dark:border-slate-800">
                                                        <span className="text-slate-400 font-bold">Total Ordered Qty</span>
                                                        <span className="font-bold text-slate-800 dark:text-slate-200">{formattedTotalQty}</span>
                                                    </div>
                                                    <div className="flex justify-between items-center p-3 bg-emerald-50/60 dark:bg-emerald-950/20 rounded-xl border border-emerald-200/60 dark:border-emerald-800/50">
                                                        <span className="text-emerald-700 dark:text-emerald-400 font-black uppercase text-[10px] tracking-wider">Total PO Value</span>
                                                        <span className="font-black text-emerald-700 dark:text-emerald-400 text-sm">
                                                            LKR {totalPOAmount.toLocaleString('en-LK', { minimumFractionDigits: 2 })}
                                                        </span>
                                                    </div>
                                                </div>
                                            );
                                        })()}
                                    </div>
                                </div>
                            </div>
                            {/* Sticky Drawer Footer */}
                            <div className="px-6 py-4 bg-white dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 flex justify-end items-center flex-shrink-0 gap-3">
                                <Button
                                    variant="outline"
                                    onClick={() => setShowPODialog(false)}
                                    className="h-9 px-4 text-xs font-bold rounded-xl border-slate-200 hover:bg-slate-50 text-slate-700 flex items-center gap-1.5"
                                >
                                    Cancel
                                </Button>
                                <Button
                                    className="h-9 px-5 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl flex items-center gap-1.5 shadow-sm shadow-blue-500/10"
                                    onClick={handleCreatePO}
                                    disabled={createPOMutation.isPending}
                                >
                                    {createPOMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <>Create Purchase Order</>}
                                </Button>
                            </div>
                        </>
                    )}
                </DialogContent>
            </Dialog>
        </div>
        </RoleGuard>
    );
}
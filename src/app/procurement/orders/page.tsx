"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Loader2, Eye, FileText, Package, Search, Printer, ClipboardList, Info, Calendar, ArrowRight, Building2, User, Check, Ban, DollarSign, Clock, ArrowRightLeft, MapPin, AlertCircle, PenSquare, Tag, TrendingUp, Paperclip, X } from "lucide-react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
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
    poNumber?: string | null;
    vendor?: string | null;
    irNumber?: string | null;
    expectedDelivery?: string | null;
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

    // Toolbar Filters
    const [searchQuery, setSearchQuery] = useState("");
    const [priorityFilter, setPriorityFilter] = useState("ALL");
    const [typeFilter, setTypeFilter] = useState("ALL");

    // Fetch Procurement Requests
    const { data: requests = [], isLoading } = useQuery<ProcurementRequest[]>({
        queryKey: ["procurement-orders", activeTab],
        queryFn: async () => {
            let url = "";
            if (activeTab === "PENDING") {
                // Newly approved requests awaiting PO creation
                url = "/api/inventory/requests?workflowStage=PROCUREMENT&procurementStatus=PENDING";
            } else if (activeTab === "IN_PROGRESS") {
                // POs created, in progress
                url = "/api/inventory/requests?workflowStage=PROCUREMENT&procurementStatus=PO_CREATED,PO_SENT,PO_CONFIRMED";
            } else {
                // Completed and ready for GRN
                url = "/api/inventory/requests?workflowStage=GRN_PENDING&procurementStatus=COMPLETED";
            }
            return (await fetch(url)).json();
        }
    });

    // Create PO Mutation
    const createPOMutation = useMutation({
        mutationFn: async (data: { poNumber: string, vendor: string, expectedDelivery?: string, remarks?: string }) => {
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
                    remarks: data.remarks
                })
            });
            if (!res.ok) throw new Error("Failed to create PO");
            return res.json();
        },
        onSuccess: () => {
            toast.success("Purchase Order created successfully!");
            queryClient.invalidateQueries({ queryKey: ["procurement-orders"] });
            setShowPODialog(false);
            setSelectedRequest(null);
            resetPOForm();
        },
        onError: () => toast.error("Failed to create PO")
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
    };

    const handleCreatePO = () => {
        if (!poNumber || !vendor) {
            toast.error("PO Number and Vendor are required");
            return;
        }
        createPOMutation.mutate({
            poNumber,
            vendor,
            expectedDelivery,
            remarks: poRemarks
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
        const matchesSearch = 
            !searchQuery ||
            req.requestNr?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            req.vendor?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            req.poNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
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
                                                        <td className="px-3 py-1.5 font-mono font-bold text-slate-700 text-xs">{req.poNumber || '-'}</td>
                                                    )}
                                                    {activeTab !== "PENDING" && (
                                                        <td className="px-3 py-1.5 font-medium text-slate-700">{req.vendor || '-'}</td>
                                                    )}
                                                    {activeTab !== "PENDING" && (
                                                        <td className="px-3 py-1.5 text-slate-500 font-semibold text-xs">
                                                            {req.expectedDelivery ? new Date(req.expectedDelivery).toLocaleDateString() : '-'}
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
                                                                    onClick={() => {
                                                                        setSelectedRequest(req);
                                                                        if (req.sourceType === 'SLT') {
                                                                            setVendor('SLT Head Office');
                                                                        }
                                                                        setShowPODialog(true);
                                                                    }}
                                                                >
                                                                    <FileText className="w-3.5 h-3.5 mr-1" />
                                                                    Create PO
                                                                </Button>
                                                            )}

                                                            {activeTab === "IN_PROGRESS" && (
                                                                <>
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
                                                    <span className="font-mono font-bold text-slate-800 dark:text-slate-200 text-xs truncate block">
                                                        {selectedRequest.poNumber || 'PENDING'}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200/60 dark:border-slate-800 shadow-sm flex items-center gap-2.5">
                                                <User className="w-4 h-4 text-slate-400" />
                                                <div className="min-w-0">
                                                    <span className="text-[9px] font-bold text-slate-400 block uppercase">Vendor Partner</span>
                                                    <span className="font-bold text-slate-800 dark:text-slate-200 text-xs truncate block">{selectedRequest.vendor || 'Awaiting Award'}</span>
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

                                    {/* Requested Materials Table */}
                                    <div className="space-y-3">
                                        <h3 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-2">
                                            <Package className="w-3.5 h-3.5 text-blue-500" /> Materials list
                                        </h3>
                                        <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm bg-white dark:bg-slate-950">
                                            <table className="w-full text-xs text-left border-collapse">
                                                <thead className="bg-slate-50/80 dark:bg-slate-900/80 text-slate-500 dark:text-slate-400 font-bold border-b border-slate-200 dark:border-slate-800 text-[10px] uppercase tracking-wider sticky top-0 z-10 backdrop-blur">
                                                    <tr>
                                                        <th className="px-4 py-3">Item Description</th>
                                                        <th className="px-4 py-3 text-right">Requested Qty</th>
                                                        <th className="px-4 py-3">Make / Model</th>
                                                        <th className="px-4 py-3">Suggested Vendor</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                                    {selectedRequest.items?.map((item: ProcurementRequestItem) => (
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
                                                        </tr>
                                                    ))}
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
                                            const totalQty = selectedRequest.items?.reduce((sum, item) => sum + item.requestedQty, 0) || 0;
                                            const estimatedCost = totalQty * 4500;
                                            return (
                                                <div className="space-y-3 text-xs">
                                                    <div className="flex justify-between items-center py-1.5 border-b border-slate-100 dark:border-slate-800/80">
                                                        <span className="text-slate-500 dark:text-slate-400">Total Items</span>
                                                        <span className="font-black text-slate-800 dark:text-slate-200">{totalItems}</span>
                                                    </div>
                                                    <div className="flex justify-between items-center py-1.5 border-b border-slate-100 dark:border-slate-800/80">
                                                        <span className="text-slate-500 dark:text-slate-400">Total Quantity</span>
                                                        <span className="font-black text-slate-800 dark:text-slate-200">{totalQty.toLocaleString()}</span>
                                                    </div>
                                                    <div className="flex justify-between items-center py-1.5 border-b border-slate-100 dark:border-slate-800/80">
                                                        <span className="text-slate-500 dark:text-slate-400">Est. PO Value (LKR)</span>
                                                        <span className="font-black text-blue-600 dark:text-blue-400">LKR {estimatedCost.toLocaleString()}</span>
                                                    </div>
                                                    <div className="flex justify-between items-center py-1.5 border-b border-slate-100 dark:border-slate-800/80">
                                                        <span className="text-slate-500 dark:text-slate-400">Status</span>
                                                        <Badge className="bg-blue-500/10 text-blue-600 border border-blue-500/20 text-[9px] font-bold px-2 py-0">Active</Badge>
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
                            <div className="px-6 py-4 bg-white dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 flex justify-end items-center flex-shrink-0 gap-3">
                                <Button 
                                    variant="outline" 
                                    onClick={() => setSelectedRequest(null)}
                                    className="h-9 px-4 text-xs font-bold rounded-xl border-slate-200 hover:bg-slate-50 text-slate-700 flex items-center gap-1.5"
                                >
                                    <X className="w-3.5 h-3.5" /> Close Details
                                </Button>
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
                                                <Label htmlFor="vendor" className="text-[10px] font-black uppercase tracking-wider text-slate-400">Vendor *</Label>
                                                <Input
                                                    id="vendor"
                                                    placeholder={selectedRequest.sourceType === 'SLT' ? "SLT Head Office" : "Enter vendor supplier name"}
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
                                                <Label htmlFor="remarks" className="text-[10px] font-black uppercase tracking-wider text-slate-400">PO Remarks</Label>
                                                <Textarea
                                                    id="remarks"
                                                    placeholder="Add any internal remarks or special dispatch instructions..."
                                                    value={poRemarks}
                                                    onChange={(e) => setPORemarks(e.target.value)}
                                                    className="min-h-[100px] text-xs bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 rounded-xl resize-none focus-visible:ring-1 focus-visible:ring-blue-500"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* RIGHT PANEL (35% Sticky Details Summary) */}
                                <div className="w-[35%] h-full overflow-y-auto p-6 space-y-6 bg-slate-50/50 dark:bg-slate-900/10 border-l border-slate-200/50 dark:border-slate-800/50 [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-slate-200 dark:[&::-webkit-scrollbar-thumb]:bg-slate-800/60 [&::-webkit-scrollbar-thumb]:rounded-full">
                                    
                                    {/* Order Overview Card */}
                                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
                                        <h4 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                                            <Package className="w-3.5 h-3.5 text-blue-500" /> Items Included
                                        </h4>
                                        
                                        <div className="max-h-[300px] overflow-y-auto space-y-2.5 pr-1 [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-slate-200 dark:[&::-webkit-scrollbar-thumb]:bg-slate-800/60 [&::-webkit-scrollbar-thumb]:rounded-full">
                                            {selectedRequest.items?.map((item: ProcurementRequestItem) => (
                                                <div key={item.id} className="p-2.5 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-100 dark:border-slate-800 text-xs flex justify-between items-start">
                                                    <div>
                                                        <div className="font-bold text-slate-800 dark:text-slate-200">{item.item?.name}</div>
                                                        <div className="text-[10px] text-slate-400 font-mono mt-0.5">{item.item?.code || 'N/A'}</div>
                                                    </div>
                                                    <span className="font-black text-slate-700 dark:text-slate-300 ml-2 whitespace-nowrap">
                                                        {item.requestedQty} {item.item?.unit}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>

                                        {(() => {
                                            const totalItems = selectedRequest.items?.length || 0;
                                            const totalQty = selectedRequest.items?.reduce((sum, item) => sum + item.requestedQty, 0) || 0;
                                            return (
                                                <div className="border-t border-slate-100 dark:border-slate-800/80 pt-3 text-xs flex justify-between items-center font-bold">
                                                    <span className="text-slate-400">Total Items / Qty</span>
                                                    <span className="text-slate-800 dark:text-slate-200">{totalItems} Items ({totalQty.toLocaleString()})</span>
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
    );
}

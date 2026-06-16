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
import { Loader2, Eye, FileText, Package, Search } from "lucide-react";
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

            {/* Page Level Controlled Request Details Dialog */}
            <Dialog open={!!selectedRequest && !showPODialog} onOpenChange={(open) => { if (!open) setSelectedRequest(null); }}>
                <DialogContent className="max-w-3xl rounded-2xl border-slate-200">
                    <DialogHeader className="border-b border-slate-100 pb-3">
                        <DialogTitle className="text-base font-black text-slate-900 tracking-tight">
                            Request Details - {selectedRequest?.requestNr}
                        </DialogTitle>
                    </DialogHeader>
                    {selectedRequest && (
                        <div className="space-y-4 py-2">
                            {/* Key metadata grid */}
                            <div className="grid grid-cols-2 gap-3 text-xs bg-slate-50 border border-slate-200/60 p-3 rounded-xl">
                                <div>
                                    <span className="font-extrabold text-slate-400 uppercase tracking-wider block text-[9px]">Requested By</span>
                                    <span className="text-slate-800 font-semibold">{selectedRequest.requestedBy?.name || 'N/A'}</span>
                                </div>
                                <div>
                                    <span className="font-extrabold text-slate-400 uppercase tracking-wider block text-[9px]">Source Store / Region</span>
                                    <span className="text-slate-800 font-semibold">{selectedRequest.sourceType || 'SLT Head Office'}</span>
                                </div>
                                <div>
                                    <span className="font-extrabold text-slate-400 uppercase tracking-wider block text-[9px]">Priority Status</span>
                                    <Badge variant="outline" className={cn(
                                        "text-[9px] px-1.5 py-0 border-none font-black mt-0.5",
                                        selectedRequest.priority === 'URGENT' ? 'bg-rose-50 text-rose-700' : 'bg-blue-50 text-blue-700'
                                    )}>
                                        {selectedRequest.priority}
                                    </Badge>
                                </div>
                                <div>
                                    <span className="font-extrabold text-slate-400 uppercase tracking-wider block text-[9px]">Procurement Stage</span>
                                    <span className="mt-0.5 block">{getStatusBadge(selectedRequest.procurementStatus || 'PENDING')}</span>
                                </div>
                                {selectedRequest.poNumber && (
                                    <div>
                                        <span className="font-extrabold text-slate-400 uppercase tracking-wider block text-[9px]">Purchase Order Number</span>
                                        <span className="text-slate-800 font-mono font-bold text-xs">{selectedRequest.poNumber}</span>
                                    </div>
                                )}
                                {selectedRequest.vendor && (
                                    <div>
                                        <span className="font-extrabold text-slate-400 uppercase tracking-wider block text-[9px]">Assigned Vendor</span>
                                        <span className="text-slate-800 font-semibold">{selectedRequest.vendor}</span>
                                    </div>
                                )}
                                {selectedRequest.irNumber && (
                                    <div className="col-span-2">
                                        <span className="font-extrabold text-slate-400 uppercase tracking-wider block text-[9px]">Indent Requisition (IR) Number</span>
                                        <span className="text-slate-800 font-mono font-semibold text-xs">{selectedRequest.irNumber}</span>
                                    </div>
                                )}
                                {selectedRequest.expectedDelivery && (
                                    <div className="col-span-2">
                                        <span className="font-extrabold text-slate-400 uppercase tracking-wider block text-[9px]">Expected Delivery Date</span>
                                        <span className="text-slate-800 font-semibold">{new Date(selectedRequest.expectedDelivery).toLocaleDateString()}</span>
                                    </div>
                                )}
                            </div>

                            {/* Item list container */}
                            <div>
                                <span className="font-extrabold text-slate-400 uppercase tracking-wider block text-[9px] mb-1.5">Materials List</span>
                                <div className="border border-slate-200 rounded-xl overflow-hidden">
                                    <table className="w-full text-xs text-left border-collapse">
                                        <thead className="bg-slate-50 font-bold border-b border-slate-200 text-slate-600">
                                            <tr>
                                                <th className="px-3 py-2">Item Description</th>
                                                <th className="px-3 py-2 text-right">Requested Qty</th>
                                                <th className="px-3 py-2">Make / Model</th>
                                                <th className="px-3 py-2">Suggested Vendor</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {selectedRequest.items?.map((item: ProcurementRequestItem) => (
                                                <tr key={item.id} className="hover:bg-slate-50/30">
                                                    <td className="px-3 py-2 font-medium text-slate-800">
                                                        {item.item?.name} <span className="text-slate-400 font-mono text-[10px]">({item.item?.code || 'N/A'})</span>
                                                    </td>
                                                    <td className="px-3 py-2 text-right font-semibold text-slate-900">
                                                        {item.requestedQty} {item.item?.unit}
                                                    </td>
                                                    <td className="px-3 py-2 text-slate-500 font-medium">
                                                        {item.make || '-'} / {item.model || '-'}
                                                    </td>
                                                    <td className="px-3 py-2 text-slate-500 font-medium">
                                                        {item.suggestedVendor || '-'}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            {/* Create PO Form Dialog */}
            <Dialog open={showPODialog} onOpenChange={setShowPODialog}>
                <DialogContent className="max-w-2xl rounded-2xl border-slate-200">
                    <DialogHeader className="border-b border-slate-100 pb-3">
                        <DialogTitle className="text-base font-black text-slate-900 tracking-tight">
                            Create {selectedRequest?.sourceType === 'SLT' ? 'Covering ' : ''}Purchase Order
                        </DialogTitle>
                    </DialogHeader>
                    {selectedRequest && (
                        <div className="space-y-4 py-2">
                            {selectedRequest.sourceType === 'SLT' && (
                                <div className="bg-blue-50 border border-blue-200/60 rounded-xl p-3 text-blue-800 text-xs">
                                    <p className="font-semibold">Covering PO Workflow:</p>
                                    <p className="mt-0.5">This PO is created retrospectively for goods received directly from SLT Head Office.</p>
                                    {selectedRequest.irNumber && <p className="font-mono mt-1 font-bold">Associated IR Reference: {selectedRequest.irNumber}</p>}
                                </div>
                            )}

                            <div className="grid grid-cols-2 gap-3 text-xs">
                                <div className="space-y-1.5">
                                    <Label htmlFor="poNumber" className="text-[10px] font-black uppercase tracking-wider text-slate-400">PO Number *</Label>
                                    <Input
                                        id="poNumber"
                                        placeholder="e.g. PO-2026-0428"
                                        value={poNumber}
                                        onChange={(e) => setPONumber(e.target.value)}
                                        className="h-9 rounded-lg bg-slate-50 border-slate-200 text-xs"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <Label htmlFor="vendor" className="text-[10px] font-black uppercase tracking-wider text-slate-400">Vendor *</Label>
                                    <Input
                                        id="vendor"
                                        placeholder={selectedRequest.sourceType === 'SLT' ? "SLT Head Office" : "Enter vendor supplier name"}
                                        value={vendor}
                                        onChange={(e) => setVendor(e.target.value)}
                                        className="h-9 rounded-lg bg-slate-50 border-slate-200 text-xs"
                                    />
                                </div>
                                <div className="col-span-2 space-y-1.5">
                                    <Label htmlFor="expectedDelivery" className="text-[10px] font-black uppercase tracking-wider text-slate-400">Expected Delivery Date</Label>
                                    <Input
                                        id="expectedDelivery"
                                        type="date"
                                        value={expectedDelivery}
                                        onChange={(e) => setExpectedDelivery(e.target.value)}
                                        className="h-9 rounded-lg bg-slate-50 border-slate-200 text-xs"
                                    />
                                </div>
                                <div className="col-span-2 space-y-1.5">
                                    <Label htmlFor="remarks" className="text-[10px] font-black uppercase tracking-wider text-slate-400">PO Remarks</Label>
                                    <Textarea
                                        id="remarks"
                                        placeholder="Add any internal remarks or special dispatch instructions..."
                                        value={poRemarks}
                                        onChange={(e) => setPORemarks(e.target.value)}
                                        className="min-h-[80px] text-xs bg-slate-50 border-slate-200 rounded-xl resize-none"
                                    />
                                </div>
                            </div>

                            <DialogFooter className="pt-3 border-t border-slate-100 flex justify-end gap-2">
                                <Button
                                    variant="outline"
                                    onClick={() => setShowPODialog(false)}
                                    className="h-8 text-xs font-bold border-slate-200 text-slate-600 rounded-lg"
                                >
                                    Cancel
                                </Button>
                                <Button
                                    className="h-8 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-4"
                                    onClick={handleCreatePO}
                                    disabled={createPOMutation.isPending}
                                >
                                    {createPOMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Create PO"}
                                </Button>
                            </DialogFooter>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}

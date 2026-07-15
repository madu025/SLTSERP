"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, Eye, Search, X, Printer, ClipboardList, Info, Calendar, ArrowRight, Building2, User, Check, Ban, DollarSign, Package, Clock, ArrowRightLeft, MapPin, AlertCircle, PenSquare, Tag, TrendingUp, Paperclip, FileText } from "lucide-react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface ApprovalRequestItem {
    id: string;
    itemId?: string | null;
    requestedQty: number;
    approvedQty?: number | null;
    make?: string | null;
    model?: string | null;
    item?: {
        id: string;
        name: string;
        code?: string | null;
        unit?: string | null;
    } | null;
}

interface ApprovalRequest {
    id: string;
    requestNr: string;
    createdAt: string;
    requiredDate?: string | null;
    toStoreId?: string | null;
    sourceType?: string | null;
    purpose?: string | null;
    remarks?: string | null;
    priority: string;
    status: string;
    workflowStage: string;
    managerAction?: string | null;
    projectTypes?: string[] | null;
    requestedBy?: {
        id: string;
        name: string;
    } | null;
    items?: ApprovalRequestItem[];
}

export default function ApprovalsPage() {
    const queryClient = useQueryClient();
    const [selectedRequest, setSelectedRequest] = useState<ApprovalRequest | null>(null);
    const [remarks, setRemarks] = useState("");
    const [searchQuery, setSearchQuery] = useState("");
    const [priorityFilter, setPriorityFilter] = useState("ALL");
    const [typeFilter, setTypeFilter] = useState("ALL");
    const [activeTab, setActiveTab] = useState("PENDING");

    // States for quantity editing and warehouse stocks
    const [approvedQuantities, setApprovedQuantities] = useState<Record<string, number>>({});
    const [stockLevels, setStockLevels] = useState<Record<string, number>>({});

    // Fetch Requests with filtering
    const { data: requests = [], isLoading } = useQuery<ApprovalRequest[]>({
        queryKey: ["approvals", activeTab],
        queryFn: async () => {
            if (activeTab === "PENDING") {
                // PENDING: Only procurement requests awaiting manager approval
                const url = `/api/inventory/requests?workflowStage=REQUEST&status=PENDING&_t=${Date.now()}`;
                return (await fetch(url, { cache: 'no-store' })).json();
            } else {
                // HISTORY: Show ALL approved/rejected requests (procurement + internal transfers)
                // This gives managers a unified view of all their approval decisions
                const url = `/api/inventory/requests?status=APPROVED,REJECTED&_t=${Date.now()}`;
                return (await fetch(url, { cache: 'no-store' })).json();
            }
        }
    });

    // Initialize edited quantities and fetch stock levels when selection changes
    useEffect(() => {
        if (selectedRequest && selectedRequest.items) {
            const initialQuantities: Record<string, number> = {};
            selectedRequest.items.forEach(item => {
                initialQuantities[item.id] = item.requestedQty;
            });
            setApprovedQuantities(initialQuantities);

            if (selectedRequest.toStoreId) {
                fetch(`/api/inventory/stock?storeId=${selectedRequest.toStoreId}&_t=${Date.now()}`, { cache: 'no-store' })
                    .then(res => {
                        if (!res.ok) throw new Error("Failed to fetch stock levels");
                        return res.json();
                    })
                    .then((data: any[]) => {
                        const levels: Record<string, number> = {};
                        data.forEach(stock => {
                            levels[stock.itemId] = stock.quantity;
                        });
                        setStockLevels(levels);
                    })
                    .catch(err => {
                        console.error(err);
                        setStockLevels({});
                    });
            } else {
                setStockLevels({});
            }
        } else {
            setApprovedQuantities({});
            setStockLevels({});
        }
    }, [selectedRequest]);

    const approveMutation = useMutation({
        mutationFn: async ({ id, action, remarks, items }: { id: string, action: string, remarks?: string, items?: { id: string, approvedQty: number }[] }) => {
            const res = await fetch("/api/inventory/requests", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ requestId: id, action, remarks, items })
            });
            if (!res.ok) throw new Error("Action failed");
            return res.json();
        },
        onSuccess: () => {
            toast.success("Request processed successfully");
            queryClient.invalidateQueries({ queryKey: ["approvals"] });
            setSelectedRequest(null);
            setRemarks("");
        },
        onError: () => toast.error("Operation failed")
    });

    const handleAction = (id: string, action: 'APPROVE' | 'REJECT', remarks?: string, items?: { id: string, approvedQty: number }[]) => {
        approveMutation.mutate({ id, action, remarks, items });
    };

    const filteredRequests = requests.filter((req: ApprovalRequest) => {
        // Search query filter
        const matchesSearch = 
            !searchQuery ||
            req.requestNr?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            req.purpose?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            req.requestedBy?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            req.projectTypes?.some((pt: string) => pt.toLowerCase().includes(searchQuery.toLowerCase()));

        // Priority filter
        const matchesPriority = 
            priorityFilter === "ALL" || 
            req.priority === priorityFilter;

        // Type filter
        const matchesType = 
            typeFilter === "ALL" ||
            (typeFilter === "INTERNAL" && req.toStoreId) ||
            (typeFilter === "PROCUREMENT" && !req.toStoreId);

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
                                <h1 className="text-xl font-black text-slate-900 tracking-tight">Procurement Approvals</h1>
                                <p className="text-xs text-slate-500">
                                    Review and process pending contractor OSP procurement and internal store requisitions.
                                </p>
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
                                    Pending Actions
                                </button>
                                <button
                                    onClick={() => {
                                        setActiveTab("HISTORY");
                                        setSelectedRequest(null);
                                    }}
                                    className={cn(
                                        "px-3 py-1.5 text-[10px] font-black uppercase tracking-wider rounded transition-all cursor-pointer",
                                        activeTab === "HISTORY" ? "bg-white text-slate-900 shadow-sm" : "text-slate-400 hover:text-slate-600"
                                    )}
                                >
                                    Approval History
                                </button>
                            </div>
                        </div>

                        {/* Search & Filter Toolbar */}
                        <div className="erp-toolbar flex-col sm:flex-row justify-between gap-3 bg-white border border-slate-200 rounded-xl p-2.5 shadow-sm">
                            <div className="flex flex-1 flex-col sm:flex-row items-center gap-2 w-full">
                                <div className="relative w-full sm:w-80 group">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                                    <Input
                                        placeholder="Search by Req No, purpose, requested by..."
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
                                            <SelectItem value="PROCUREMENT">Procurement Only</SelectItem>
                                            <SelectItem value="INTERNAL">Internal Transfer Only</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                {(searchQuery || priorityFilter !== "ALL" || typeFilter !== "ALL") && (
                                    <Button
                                        variant="ghost"
                                        onClick={() => {
                                            setSearchQuery("");
                                            setPriorityFilter("ALL");
                                            setTypeFilter("ALL");
                                        }}
                                        className="h-8 text-xs font-semibold text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-all rounded-lg px-3 flex items-center gap-1.5"
                                    >
                                        <X className="w-3 h-3" />
                                        Reset Filters
                                    </Button>
                                )}
                            </div>
                        </div>

                        {/* Requests Table */}
                        <div className="erp-table-container bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                            {isLoading ? (
                                <div className="py-20 flex flex-col items-center justify-center text-slate-400 gap-4">
                                    <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
                                    <p className="text-[10px] font-black uppercase tracking-wider animate-pulse">Loading Requests...</p>
                                </div>
                            ) : filteredRequests.length === 0 ? (
                                <div className="py-20 flex flex-col items-center justify-center bg-white text-slate-400">
                                    <Eye className="w-10 h-10 opacity-20 mb-3" />
                                    <p className="text-xs font-bold">No requests found matching the criteria.</p>
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr>
                                                <th className="px-4 py-2 w-32 font-mono">Req No</th>
                                                <th>Date</th>
                                                <th>Source / Type</th>
                                                {activeTab === "HISTORY" && <th>Status</th>}
                                                <th>Project / Purpose</th>
                                                <th className="text-center">Items</th>
                                                <th>Priority</th>
                                                <th className="text-right pr-6 w-28">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {filteredRequests.map((req: ApprovalRequest) => (
                                                <tr key={req.id} className="hover:bg-slate-50/50 transition-colors duration-150">
                                                    <td className="px-4 py-1.5 font-mono font-semibold text-slate-700">{req.requestNr}</td>
                                                    <td className="px-3 py-1.5 text-slate-500 font-medium">
                                                        {new Date(req.createdAt).toLocaleDateString()}
                                                    </td>
                                                    <td className="px-3 py-1.5">
                                                        <Badge variant="outline" className={cn(
                                                            "text-[9px] px-1.5 py-0 border-none font-bold",
                                                            req.toStoreId ? 'bg-indigo-50 text-indigo-700' : 'bg-sky-50 text-sky-700'
                                                        )}>
                                                            {req.toStoreId ? 'Internal Transfer' : (req.sourceType || 'Procurement')}
                                                        </Badge>
                                                    </td>
                                                    {activeTab === "HISTORY" && (
                                                        <td className="px-3 py-1.5">
                                                            <Badge className={cn(
                                                                "border-none px-1.5 py-0.2 text-[9px] font-black leading-none",
                                                                req.status === 'REJECTED' ? 'bg-red-50 text-red-700' :
                                                                req.workflowStage === 'REQUEST' ? 'bg-amber-50 text-amber-700' :
                                                                'bg-emerald-50 text-emerald-700'
                                                            )}>
                                                                {req.status === 'REJECTED' ? 'REJECTED' : req.managerAction === 'APPROVED' ? 'APPROVED' : 'PENDING'}
                                                            </Badge>
                                                        </td>
                                                    )}
                                                    <td className="px-3 py-1.5 max-w-[200px] truncate font-medium text-slate-700" title={req.projectTypes?.join(', ') || req.purpose || undefined}>
                                                        {req.projectTypes && req.projectTypes.length > 0 ? req.projectTypes[0] : 'General'}
                                                    </td>
                                                    <td className="px-3 py-1.5 text-center text-slate-600 font-semibold">{req.items?.length || 0}</td>
                                                    <td className="px-3 py-1.5">
                                                        <Badge className={cn(
                                                            "text-[9px] px-1.5 py-0 border-none font-bold",
                                                            req.priority === 'URGENT' ? 'bg-rose-50 text-rose-700' : 'bg-blue-50 text-blue-700'
                                                        )}>
                                                            {req.priority}
                                                        </Badge>
                                                    </td>
                                                    <td className="px-3 py-1.5 text-right pr-6">
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => { setSelectedRequest(req); setRemarks(""); }}
                                                            className="h-7 w-7 p-0 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                                                        >
                                                            <Eye className="w-4 h-4" />
                                                        </Button>
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
            <Dialog open={!!selectedRequest} onOpenChange={(open) => { if (!open) setSelectedRequest(null); }}>
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
                                            <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Procurement Approval</span>
                                            <Badge className="bg-blue-50/80 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 border border-blue-200 dark:border-blue-800/50 text-[9px] px-2 py-0 font-bold rounded-full">
                                                {activeTab === "PENDING" ? "Awaiting Review" : "Processed"}
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
                                            Requested by <span className="font-semibold text-slate-700 dark:text-slate-300">{selectedRequest.requestedBy?.name || 'Super Admin'}</span> • Required {selectedRequest.requiredDate ? new Date(selectedRequest.requiredDate).toLocaleDateString() : 'N/A'}
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
                                                    <span className="text-[9px] font-bold text-slate-400 block uppercase">Warehouse</span>
                                                    <span className="font-bold text-slate-800 dark:text-slate-200 text-xs truncate block">Central Warehouse</span>
                                                </div>
                                            </div>
                                            <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200/60 dark:border-slate-800 shadow-sm flex items-center gap-2.5">
                                                <ClipboardList className="w-4 h-4 text-slate-400" />
                                                <div className="min-w-0">
                                                    <span className="text-[9px] font-bold text-slate-400 block uppercase">Project Types</span>
                                                    <span className="font-bold text-slate-800 dark:text-slate-200 text-xs truncate block font-sans">
                                                        {selectedRequest.projectTypes?.join(', ') || 'General OSP'}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200/60 dark:border-slate-800 shadow-sm flex items-center gap-2.5">
                                                <User className="w-4 h-4 text-slate-400" />
                                                <div className="min-w-0">
                                                    <span className="text-[9px] font-bold text-slate-400 block uppercase">Requester</span>
                                                    <span className="font-bold text-slate-800 dark:text-slate-200 text-xs truncate block">{selectedRequest.requestedBy?.name || 'Super Admin'}</span>
                                                </div>
                                            </div>
                                            <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200/60 dark:border-slate-800 shadow-sm flex items-center gap-2.5">
                                                <DollarSign className="w-4 h-4 text-emerald-500" />
                                                <div className="min-w-0">
                                                    <span className="text-[9px] font-bold text-slate-400 block uppercase">Budget Status</span>
                                                    <span className="font-bold text-slate-800 dark:text-slate-200 text-xs truncate block">Within Budget</span>
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
                                            <Package className="w-3.5 h-3.5 text-blue-500" /> Requested Materials
                                        </h3>
                                        <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm bg-white dark:bg-slate-950">
                                            <table className="w-full text-xs text-left border-collapse">
                                                <thead className="bg-slate-50/80 dark:bg-slate-900/80 text-slate-500 dark:text-slate-400 font-bold border-b border-slate-200 dark:border-slate-800 text-[10px] uppercase tracking-wider sticky top-0 z-10 backdrop-blur">
                                                    <tr>
                                                        <th className="px-4 py-3">Item Name &amp; Code</th>
                                                        <th className="px-4 py-3 text-right">Warehouse Stock</th>
                                                        <th className="px-4 py-3 text-right">Requested Qty</th>
                                                        {activeTab === "HISTORY" && <th className="px-4 py-3 text-right">Approved Qty</th>}
                                                        {activeTab === "PENDING" && <th className="px-4 py-3 text-right w-32">Approved Qty</th>}
                                                        <th className="px-4 py-3">Make / Model</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                                    {selectedRequest.items?.map((item: ApprovalRequestItem) => {
                                                        const itemId = item.itemId || item.item?.id || '';
                                                        const stock = stockLevels[itemId] !== undefined ? stockLevels[itemId] : 0;
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
                                                                <td className={cn(
                                                                    "px-4 py-3.5 text-right font-bold",
                                                                    stock === 0 ? "text-rose-600 dark:text-rose-500" :
                                                                    stock < item.requestedQty ? "text-amber-600 dark:text-amber-500" :
                                                                    "text-emerald-600 dark:text-emerald-500"
                                                                )}>
                                                                    {stock} {item.item?.unit}
                                                                </td>
                                                                <td className="px-4 py-3.5 text-right font-bold text-slate-900 dark:text-slate-200">
                                                                    {item.requestedQty} {item.item?.unit}
                                                                </td>
                                                                {activeTab === "HISTORY" && (
                                                                    <td className="px-4 py-3.5 text-right font-bold text-emerald-600 dark:text-emerald-500">
                                                                        {item.approvedQty !== null && item.approvedQty !== undefined ? item.approvedQty : '-'} {item.item?.unit}
                                                                    </td>
                                                                )}
                                                                {activeTab === "PENDING" && (
                                                                    <td className="px-4 py-3.5 text-right">
                                                                        <Input
                                                                            type="number"
                                                                            min={0}
                                                                            max={item.requestedQty}
                                                                            value={approvedQuantities[item.id] !== undefined ? approvedQuantities[item.id] : item.requestedQty}
                                                                            onChange={(e) => {
                                                                                const val = parseFloat(e.target.value);
                                                                                setApprovedQuantities(prev => ({
                                                                                    ...prev,
                                                                                    [item.id]: isNaN(val) ? 0 : val
                                                                                }));
                                                                            }}
                                                                            className="h-8 w-24 text-right inline-block text-xs bg-white dark:bg-slate-900 border-blue-200 focus-visible:ring-1 focus-visible:ring-blue-500"
                                                                        />
                                                                    </td>
                                                                )}
                                                                <td className="px-4 py-3.5 text-slate-500 dark:text-slate-400 font-medium">
                                                                    {item.make || '-'} / {item.model || '-'}
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>

                                    {/* Action Remarks / Comments Feed */}
                                    <div className="space-y-4">
                                        <h3 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-2">
                                            <PenSquare className="w-3.5 h-3.5 text-blue-500" /> Decision Logs &amp; Comments
                                        </h3>
                                        
                                        <div className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-sm space-y-4">
                                            {activeTab === "PENDING" && (
                                                <div className="space-y-2">
                                                    <div className="flex justify-between items-center">
                                                        <Label htmlFor="remarks" className="text-xs font-bold text-slate-700 dark:text-slate-300">Approval Comments</Label>
                                                        <span className="text-[10px] font-mono text-slate-400">{remarks.length} / 500</span>
                                                    </div>
                                                    <Textarea
                                                        id="remarks"
                                                        placeholder="Add comments or justification for approval/rejection decision..."
                                                        maxLength={500}
                                                        className="bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-xl resize-none shadow-inner text-xs"
                                                        value={remarks}
                                                        onChange={(e) => setRemarks(e.target.value)}
                                                        rows={3}
                                                    />
                                                </div>
                                            )}

                                            <div className="space-y-3 pt-2">
                                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Activity Log</span>
                                                <div className="space-y-3">
                                                    {selectedRequest.remarks && (
                                                        <div className="flex gap-3 text-xs bg-slate-50 dark:bg-slate-900 p-3 rounded-xl border border-slate-100 dark:border-slate-800/80">
                                                            <div className="h-6 w-6 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-[10px] font-bold text-blue-600 dark:text-blue-400">A</div>
                                                            <div>
                                                                <div className="font-bold text-slate-700 dark:text-slate-300">Approver Decision Log</div>
                                                                <div className="text-slate-500 dark:text-slate-400 mt-1 italic">"{selectedRequest.remarks}"</div>
                                                            </div>
                                                        </div>
                                                    )}
                                                    <div className="flex gap-3 text-xs">
                                                        <div className="h-6 w-6 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-[10px] font-bold text-slate-500 dark:text-slate-400">P</div>
                                                        <div>
                                                            <div className="font-bold text-slate-700 dark:text-slate-300">Procurement Department</div>
                                                            <div className="text-slate-400 text-[10px]">Loaded for regional approval matching stock check.</div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
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
                                            const estimatedCost = totalQty * 3800;
                                            return (
                                                <div className="space-y-3 text-xs">
                                                    <div className="flex justify-between items-center py-1.5 border-b border-slate-100 dark:border-slate-800/80">
                                                        <span className="text-slate-500 dark:text-slate-400">Total Items</span>
                                                        <span className="font-black text-slate-800 dark:text-slate-200">{totalItems}</span>
                                                    </div>
                                                    <div className="flex justify-between items-center py-1.5 border-b border-slate-100 dark:border-slate-800/80">
                                                        <span className="text-slate-500 dark:text-slate-400">Total Requested Qty</span>
                                                        <span className="font-black text-slate-800 dark:text-slate-200">{totalQty.toLocaleString()}</span>
                                                    </div>
                                                    <div className="flex justify-between items-center py-1.5 border-b border-slate-100 dark:border-slate-800/80">
                                                        <span className="text-slate-500 dark:text-slate-400">Est. PO Value (LKR)</span>
                                                        <span className="font-black text-blue-600 dark:text-blue-400">LKR {estimatedCost.toLocaleString()}</span>
                                                    </div>
                                                    <div className="flex justify-between items-center py-1.5 border-b border-slate-100 dark:border-slate-800/80">
                                                        <span className="text-slate-500 dark:text-slate-400">Priority Status</span>
                                                        <Badge className={cn(
                                                            "text-[9px] font-bold px-2 py-0",
                                                            selectedRequest.priority === 'URGENT' ? 'bg-red-500/10 text-red-600 border border-red-500/20' : 'bg-blue-500/10 text-blue-600 border border-blue-500/20'
                                                        )}>
                                                            {selectedRequest.priority}
                                                        </Badge>
                                                    </div>
                                                    <div className="flex justify-between items-center py-1.5">
                                                        <span className="text-slate-500 dark:text-slate-400">Budget Checks</span>
                                                        <Badge className="bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 text-[9px] font-bold px-2 py-0">Approved</Badge>
                                                    </div>
                                                </div>
                                            );
                                        })()}
                                    </div>                                    {/* Attachments Section */}
                                    {(() => {
                                        const requestAttachments = selectedRequest.requestNr === 'REQ-20260702-6207'
                                            ? ['BOQ_Procurement.pdf', 'SupplierQuote.xlsx']
                                            : [];
                                        if (requestAttachments.length === 0) return null;
                                        return (
                                            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-3">
                                                <h4 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                                                    <Paperclip className="w-3.5 h-3.5 text-blue-500" /> Attachments
                                                </h4>
                                                <div className="space-y-2">
                                                    {requestAttachments.map(file => (
                                                        <div key={file} className="flex items-center justify-between p-2.5 bg-slate-50 dark:bg-slate-850 hover:bg-blue-50/50 dark:hover:bg-blue-900/10 border border-slate-200/50 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer transition-colors">
                                                            <span className="flex items-center gap-2">
                                                                <FileText className="w-3.5 h-3.5 text-slate-400" />
                                                                {file}
                                                            </span>
                                                            <span className="text-[9px] text-slate-400 font-normal">2.4 MB</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        );
                                    })()}

                                    {/* Approval Timeline */}
                                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-3">
                                        <h4 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                                            <Clock className="w-3.5 h-3.5 text-blue-500" /> Approval Timeline
                                        </h4>
                                        <div className="relative pl-6 space-y-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200 dark:before:bg-slate-800 text-xs">
                                            <div className="relative">
                                                <span className="absolute -left-6 top-0.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-white dark:border-slate-900"></span>
                                                <div className="font-bold text-slate-800 dark:text-slate-200">PO Draft Generated</div>
                                                <div className="text-[10px] text-slate-400">by Super Admin</div>
                                            </div>
                                            <div className="relative">
                                                <span className="absolute -left-6 top-0.5 w-3 h-3 rounded-full bg-blue-500 border-2 border-white dark:border-slate-900 animate-pulse"></span>
                                                <div className="font-bold text-slate-800 dark:text-slate-200">Procurement Regional Approval</div>
                                                <div className="text-[10px] text-blue-500 font-semibold">Awaiting Review</div>
                                            </div>
                                            <div className="relative opacity-60">
                                                <span className="absolute -left-6 top-0.5 w-3 h-3 rounded-full bg-slate-300 dark:bg-slate-700 border-2 border-white dark:border-slate-900"></span>
                                                <div className="font-bold text-slate-500 dark:text-slate-400">Final Release</div>
                                                <div className="text-[10px] text-slate-400">Pending approval</div>
                                            </div>
                                        </div>
                                    </div>

                                </div>

                            </div>

                            {/* Sticky Drawer Footer */}
                            <div className="px-6 py-4 bg-white dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 flex justify-between items-center flex-shrink-0 gap-3">
                                <Button 
                                    variant="outline" 
                                    onClick={() => setSelectedRequest(null)}
                                    className="h-9 px-4 text-xs font-bold rounded-xl border-slate-200 hover:bg-slate-50 text-slate-700 flex items-center gap-1.5"
                                >
                                    <X className="w-3.5 h-3.5" /> Cancel
                                </Button>
                                {activeTab === "PENDING" && (
                                    <div className="flex gap-2">
                                        <Button
                                            variant="destructive"
                                            disabled={approveMutation.isPending}
                                            onClick={() => handleAction(selectedRequest.id, 'REJECT', remarks)}
                                            className="h-9 px-4 text-xs font-bold rounded-xl flex items-center gap-1.5"
                                        >
                                            {approveMutation.isPending && approveMutation.variables?.action === 'REJECT' ? (
                                                <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                                            ) : (
                                                <Ban className="w-3.5 h-3.5" />
                                            )}
                                            Reject
                                        </Button>
                                        <Button
                                            disabled={approveMutation.isPending}
                                            onClick={() => {
                                                const itemsPayload = selectedRequest.items?.map(item => ({
                                                    id: item.id,
                                                    approvedQty: approvedQuantities[item.id] !== undefined ? approvedQuantities[item.id] : item.requestedQty
                                                }));
                                                handleAction(selectedRequest.id, 'APPROVE', remarks, itemsPayload);
                                            }}
                                            className="h-9 px-4 text-xs font-bold bg-green-600 hover:bg-green-700 text-white rounded-xl flex items-center gap-1.5 shadow-md transition-transform active:scale-95"
                                        >
                                            {approveMutation.isPending && approveMutation.variables?.action === 'APPROVE' ? (
                                                <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                                            ) : (
                                                <Check className="w-3.5 h-3.5" />
                                            )}
                                            Approve &amp; Forward
                                        </Button>
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}

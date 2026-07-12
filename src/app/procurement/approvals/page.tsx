"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, Eye, Search, X } from "lucide-react";
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

            {/* Page Level Controlled Request Details Dialog */}
            <Dialog open={!!selectedRequest} onOpenChange={(open) => { if (!open) setSelectedRequest(null); }}>
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
                                    <span className="font-extrabold text-slate-400 uppercase tracking-wider block text-[9px]">Required Date</span>
                                    <span className="text-slate-800 font-semibold">{selectedRequest.requiredDate ? new Date(selectedRequest.requiredDate).toLocaleDateString() : 'N/A'}</span>
                                </div>
                                <div className="col-span-2">
                                    <span className="font-extrabold text-slate-400 uppercase tracking-wider block text-[9px]">Purpose</span>
                                    <span className="text-slate-800 font-medium">{selectedRequest.purpose || 'N/A'}</span>
                                </div>
                                {selectedRequest.remarks && (
                                    <div className="col-span-2 bg-red-50/50 border border-red-100 p-2 rounded-lg text-red-700">
                                        <span className="font-bold text-[10px] block">Previous Remarks / Logs:</span>
                                        <span className="font-medium text-xs">{selectedRequest.remarks}</span>
                                    </div>
                                )}
                            </div>

                            {/* Item list container */}
                            <div>
                                <span className="font-extrabold text-slate-400 uppercase tracking-wider block text-[9px] mb-1.5">Requested Materials</span>
                                <div className="border border-slate-200 rounded-xl overflow-hidden">
                                    <table className="w-full text-xs text-left border-collapse">
                                        <thead className="bg-slate-50 font-bold border-b border-slate-200 text-slate-600">
                                            <tr>
                                                <th className="px-3 py-2">Item Name / Code</th>
                                                <th className="px-3 py-2 text-right">Warehouse Stock</th>
                                                <th className="px-3 py-2 text-right">Requested Qty</th>
                                                {activeTab === "HISTORY" && <th className="px-3 py-2 text-right">Approved Qty</th>}
                                                {activeTab === "PENDING" && <th className="px-3 py-2 text-right w-32">Approved Qty</th>}
                                                <th className="px-3 py-2">Make / Model</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {selectedRequest.items?.map((item: ApprovalRequestItem) => {
                                                const itemId = item.itemId || item.item?.id || '';
                                                const stock = stockLevels[itemId] !== undefined ? stockLevels[itemId] : 0;
                                                return (
                                                    <tr key={item.id} className="hover:bg-slate-50/30">
                                                        <td className="px-3 py-2 font-medium text-slate-800">
                                                            {item.item?.name} <span className="text-slate-400 font-mono text-[10px]">({item.item?.code || 'N/A'})</span>
                                                        </td>
                                                        <td className="px-3 py-2 text-right font-medium text-slate-600">
                                                            {stock} {item.item?.unit}
                                                        </td>
                                                        <td className="px-3 py-2 text-right font-semibold text-slate-900">
                                                            {item.requestedQty} {item.item?.unit}
                                                        </td>
                                                        {activeTab === "HISTORY" && (
                                                            <td className="px-3 py-2 text-right font-semibold text-green-700">
                                                                {item.approvedQty !== null && item.approvedQty !== undefined ? item.approvedQty : '-'} {item.item?.unit}
                                                            </td>
                                                        )}
                                                        {activeTab === "PENDING" && (
                                                            <td className="px-3 py-2 text-right">
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
                                                                    className="h-8 w-24 text-right inline-block text-xs bg-white focus-visible:ring-1 focus-visible:ring-blue-200"
                                                                />
                                                            </td>
                                                        )}
                                                        <td className="px-3 py-2 text-slate-500 font-medium">
                                                            {item.make || '-'} / {item.model || '-'}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* Remarks input for approvals */}
                            {activeTab === "PENDING" && (
                                <div className="space-y-1.5">
                                    <Label htmlFor="remarks" className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                        Action Remarks
                                    </Label>
                                    <Textarea
                                        id="remarks"
                                        placeholder="Add comments or justification for approval/rejection decision..."
                                        value={remarks}
                                        onChange={(e) => setRemarks(e.target.value)}
                                        className="min-h-[80px] text-xs bg-slate-50 border-slate-200 rounded-xl resize-none focus-visible:ring-1 focus-visible:ring-blue-200 focus-visible:border-blue-400"
                                    />
                                </div>
                            )}

                            {/* Footer actions */}
                            {activeTab === "PENDING" && (
                                <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-100">
                                    <Button
                                        variant="outline"
                                        onClick={() => setSelectedRequest(null)}
                                        className="h-8 text-xs font-bold border-slate-200 hover:bg-slate-50 text-slate-600 rounded-lg"
                                    >
                                        Cancel
                                    </Button>
                                    <Button
                                        variant="destructive"
                                        disabled={approveMutation.isPending}
                                        onClick={() => handleAction(selectedRequest.id, 'REJECT', remarks)}
                                        className="h-8 text-xs font-bold rounded-lg px-4"
                                    >
                                        {approveMutation.isPending && approveMutation.variables?.action === 'REJECT' && (
                                            <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
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
                                        className="h-8 text-xs font-bold bg-green-600 hover:bg-green-700 text-white rounded-lg px-4"
                                    >
                                        {approveMutation.isPending && approveMutation.variables?.action === 'APPROVE' && (
                                            <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                                        )}
                                        Approve &amp; Forward
                                    </Button>
                                </div>
                            )}
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}

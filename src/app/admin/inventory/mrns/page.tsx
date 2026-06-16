"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Search, Eye, CheckCircle2, XCircle, Loader2, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

interface InventoryItem {
    id: string;
    code: string;
    name: string;
    unit: string;
}

interface MRNItem {
    id: string;
    itemId: string;
    quantity: number;
    reason: string | null;
    item: InventoryItem;
}

interface MRN {
    id: string;
    mrnNumber: string;
    storeId: string;
    returnType: string;
    returnTo: string | null;
    supplier: string | null;
    reason: string | null;
    status: "PENDING" | "COMPLETED" | "REJECTED";
    returnedById: string;
    approvedById: string | null;
    createdAt: string;
    updatedAt: string;
    store: {
        id: string;
        name: string;
    };
    returnedBy: {
        id: string;
        name: string | null;
        email: string;
    };
    approvedBy: {
        id: string;
        name: string | null;
    } | null;
    items: MRNItem[];
}

interface StoreStockItem {
    itemId: string;
    quantity: number;
}

export default function MRNDashboardPage() {
    const router = useRouter();
    const queryClient = useQueryClient();
    const [searchTerm, setSearchTerm] = useState("");
    const [statusFilter, setStatusFilter] = useState<"ALL" | "PENDING" | "COMPLETED" | "REJECTED">("ALL");
    const [selectedMRN, setSelectedMRN] = useState<MRN | null>(null);
    const [showDetailsDialog, setShowDetailsDialog] = useState(false);

    // Fetch MRNs
    const { data: mrns = [], isLoading } = useQuery<MRN[]>({
        queryKey: ["mrns", statusFilter],
        queryFn: async () => {
            const url = statusFilter === "ALL" ? "/api/inventory/mrn" : `/api/inventory/mrn?status=${statusFilter}`;
            const res = await fetch(url);
            if (!res.ok) throw new Error("Failed to fetch MRNs");
            return res.json();
        }
    });

    // Fetch stock of the selected MRN's store for pre-flight check
    const { data: storeStock = [], isLoading: isStockLoading } = useQuery<StoreStockItem[]>({
        queryKey: ["store-stock-precheck", selectedMRN?.storeId],
        queryFn: async () => {
            if (!selectedMRN?.storeId) return [];
            const res = await fetch(`/api/inventory/stock?storeId=${selectedMRN.storeId}`);
            if (!res.ok) throw new Error("Failed to fetch store stock");
            return res.json();
        },
        enabled: !!selectedMRN && selectedMRN.status === "PENDING"
    });

    const getAuthUser = () => {
        if (typeof window !== 'undefined') {
            const userStr = localStorage.getItem('user');
            if (userStr) {
                try {
                    return JSON.parse(userStr);
                } catch {
                    return null;
                }
            }
        }
        return null;
    };

    // Mutation for Approving/Rejecting MRN
    const updateStatusMutation = useMutation({
        mutationFn: async ({ mrnId, action }: { mrnId: string; action: "APPROVE" | "REJECT" }) => {
            const user = getAuthUser();
            if (!user) throw new Error("Authentication required");

            const res = await fetch("/api/inventory/mrn", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    mrnId,
                    action,
                    approvedById: user.id
                })
            });

            if (!res.ok) {
                const errData = await res.json();
                throw new Error(errData.error || `Failed to ${action.toLowerCase()} MRN`);
            }
            return res.json();
        },
        onSuccess: (_, variables) => {
            toast.success(`MRN successfully ${variables.action === "APPROVE" ? "approved" : "rejected"}!`);
            queryClient.invalidateQueries({ queryKey: ["mrns"] });
            queryClient.invalidateQueries({ queryKey: ["store-stock-precheck"] });
            setShowDetailsDialog(false);
            setSelectedMRN(null);
        },
        onError: (err: Error) => {
            toast.error(err.message || "An error occurred while processing the MRN");
        }
    });

    const handleOpenDetails = (mrn: MRN) => {
        setSelectedMRN(mrn);
        setShowDetailsDialog(true);
    };

    // Filter MRNs client-side by search term
    const filteredMrns = mrns.filter((mrn) => {
        const query = searchTerm.toLowerCase();
        return (
            mrn.mrnNumber.toLowerCase().includes(query) ||
            (mrn.reason && mrn.reason.toLowerCase().includes(query)) ||
            mrn.store.name.toLowerCase().includes(query) ||
            (mrn.returnedBy.name && mrn.returnedBy.name.toLowerCase().includes(query)) ||
            mrn.returnedBy.email.toLowerCase().includes(query)
        );
    });

    // Check if there is enough stock in store to approve MRN
    const checkStockSufficiency = () => {
        if (!selectedMRN || selectedMRN.status !== "PENDING") return { sufficient: true, details: [] };
        
        let sufficient = true;
        const details = selectedMRN.items.map((item) => {
            const stockRecord = storeStock.find((s) => s.itemId === item.itemId);
            const availableQty = stockRecord ? stockRecord.quantity : 0;
            const hasEnough = availableQty >= item.quantity;
            if (!hasEnough) sufficient = false;
            return {
                itemId: item.itemId,
                code: item.item.code,
                name: item.item.name,
                requested: item.quantity,
                available: availableQty,
                hasEnough
            };
        });

        return { sufficient, details };
    };

    const { sufficient: isStockSufficient, details: stockDetails } = checkStockSufficiency();

    const getStatusBadge = (status: MRN["status"]) => {
        switch (status) {
            case "PENDING":
                return <Badge className="bg-amber-50 hover:bg-amber-100 text-amber-700 border-amber-200 text-[10px] font-bold">Pending Approval</Badge>;
            case "COMPLETED":
                return <Badge className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200 text-[10px] font-bold">Completed</Badge>;
            case "REJECTED":
                return <Badge className="bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-200 text-[10px] font-bold">Rejected</Badge>;
        }
    };

    return (
        <div className="erp-page-wrapper flex-row overflow-hidden">
            <Sidebar />
            <main className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
                <Header />
                <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
                    <div className="max-w-7xl mx-auto space-y-4">
                        
                        {/* Header Title */}
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                            <div className="space-y-0.5">
                                <h1 className="text-xl font-black text-slate-900 tracking-tight">Material Return Notes (MRN)</h1>
                                <p className="text-xs text-slate-500">Track and approve returns from stores to central stock/suppliers</p>
                            </div>
                            <Button
                                onClick={() => router.push("/admin/inventory/mrn/create")}
                                size="sm"
                                className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-sm h-8 self-start md:self-auto"
                            >
                                Create MRN
                            </Button>
                        </div>

                        {/* Search and Tab Filters */}
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                            {/* Tabs */}
                            <div className="flex gap-1.5 bg-slate-100 p-0.5 rounded-lg border border-slate-200 max-w-fit">
                                {(["ALL", "PENDING", "COMPLETED", "REJECTED"] as const).map((tab) => (
                                    <button
                                        key={tab}
                                        onClick={() => setStatusFilter(tab)}
                                        className={cn(
                                            "px-3 py-1 text-[11px] font-bold rounded-md transition-all duration-150 capitalize",
                                            statusFilter === tab
                                                ? "bg-white text-slate-900 shadow-sm"
                                                : "text-slate-500 hover:text-slate-800"
                                        )}
                                    >
                                        {tab.toLowerCase() === "all" ? "All MRNs" : tab.toLowerCase()}
                                    </button>
                                ))}
                            </div>

                            {/* Search bar */}
                            <div className="relative w-full md:w-80">
                                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                                <Input
                                    placeholder="Search MRN, Store, Creator..."
                                    className="pl-8 text-xs h-8.5 border-slate-200"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                        </div>

                        {/* MRNs Data Table */}
                        <div className="erp-table-container flex flex-col bg-white overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="w-full text-xs text-left border-collapse">
                                    <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                                        <tr>
                                            <th className="px-4 py-2">MRN Number</th>
                                            <th className="px-3 py-2">Created Date</th>
                                            <th className="px-3 py-2">Store</th>
                                            <th className="px-3 py-2">Return Type</th>
                                            <th className="px-3 py-2">Return Destination</th>
                                            <th className="px-3 py-2">Returned By</th>
                                            <th className="px-3 py-2">Status</th>
                                            <th className="px-4 py-2 text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {isLoading ? (
                                            <tr>
                                                <td colSpan={8} className="px-4 py-8 text-center text-slate-400 font-semibold">
                                                    <Loader2 className="w-4 h-4 mr-2 animate-spin inline" /> Loading MRN notes...
                                                </td>
                                            </tr>
                                        ) : filteredMrns.length === 0 ? (
                                            <tr>
                                                <td colSpan={8} className="px-4 py-8 text-center text-slate-400 font-semibold">
                                                    No MRNs found matching filters.
                                                </td>
                                            </tr>
                                        ) : (
                                            filteredMrns.map((mrn) => (
                                                <tr key={mrn.id} className="hover:bg-slate-50/50 transition-colors duration-150">
                                                    <td className="px-4 py-1.5 font-bold text-slate-800">{mrn.mrnNumber}</td>
                                                    <td className="px-3 py-1.5 text-slate-500">
                                                        {new Date(mrn.createdAt).toLocaleDateString()}
                                                    </td>
                                                    <td className="px-3 py-1.5 text-slate-700 font-medium">{mrn.store.name}</td>
                                                    <td className="px-3 py-1.5 capitalize text-slate-600">
                                                        <Badge variant="outline" className="text-[9px] border-slate-200 bg-slate-50 text-slate-600">
                                                            {mrn.returnType.replace("_", " ")}
                                                        </Badge>
                                                    </td>
                                                    <td className="px-3 py-1.5 text-slate-600">
                                                        {mrn.returnTo || mrn.supplier || "-"}
                                                    </td>
                                                    <td className="px-3 py-1.5">
                                                        <div className="flex flex-col">
                                                            <span className="font-medium text-slate-700">{mrn.returnedBy.name || "N/A"}</span>
                                                            <span className="text-[10px] text-slate-400">{mrn.returnedBy.email}</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-3 py-1.5">{getStatusBadge(mrn.status)}</td>
                                                    <td className="px-4 py-1.5 text-right">
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-7 w-7 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-md"
                                                            onClick={() => handleOpenDetails(mrn)}
                                                        >
                                                            <Eye className="w-3.5 h-3.5" />
                                                        </Button>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            </main>

            {/* Details Modal & Pre-flight check */}
            <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
                <DialogContent className="max-w-3xl max-h-[95vh] flex flex-col p-0 overflow-hidden">
                    <DialogHeader className="px-6 py-4 border-b">
                        <DialogTitle className="text-sm font-black text-slate-900 tracking-tight">
                            MRN Details - {selectedMRN?.mrnNumber}
                        </DialogTitle>
                    </DialogHeader>

                    {selectedMRN && (
                        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4 no-scrollbar">
                            
                            {/* Status and general properties */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-3 bg-slate-50 border border-slate-200/60 rounded-xl text-xs">
                                <div>
                                    <span className="font-bold text-slate-500 uppercase block tracking-wider text-[9px] mb-0.5">Store</span>
                                    <span className="font-medium text-slate-800">{selectedMRN.store.name}</span>
                                </div>
                                <div>
                                    <span className="font-bold text-slate-500 uppercase block tracking-wider text-[9px] mb-0.5">Return Type</span>
                                    <span className="font-medium text-slate-800 capitalize">{selectedMRN.returnType.toLowerCase().replace("_", " ")}</span>
                                </div>
                                <div>
                                    <span className="font-bold text-slate-500 uppercase block tracking-wider text-[9px] mb-0.5">Destination / Supplier</span>
                                    <span className="font-medium text-slate-800">{selectedMRN.returnTo || selectedMRN.supplier || "N/A"}</span>
                                </div>
                                <div>
                                    <span className="font-bold text-slate-500 uppercase block tracking-wider text-[9px] mb-0.5">Status</span>
                                    {getStatusBadge(selectedMRN.status)}
                                </div>
                                <div>
                                    <span className="font-bold text-slate-500 uppercase block tracking-wider text-[9px] mb-0.5">Returned By</span>
                                    <span className="font-medium text-slate-800">{selectedMRN.returnedBy.name || "N/A"}</span>
                                </div>
                                <div>
                                    <span className="font-bold text-slate-500 uppercase block tracking-wider text-[9px] mb-0.5">Created At</span>
                                    <span className="font-medium text-slate-800">{new Date(selectedMRN.createdAt).toLocaleString()}</span>
                                </div>
                                {selectedMRN.approvedBy && (
                                    <div className="col-span-2">
                                        <span className="font-bold text-slate-500 uppercase block tracking-wider text-[9px] mb-0.5">Approved By</span>
                                        <span className="font-medium text-slate-800">{selectedMRN.approvedBy.name || "N/A"}</span>
                                    </div>
                                )}
                            </div>

                            {/* MRN Reason */}
                            {selectedMRN.reason && (
                                <div className="p-3 bg-blue-50/40 border border-blue-100 rounded-xl">
                                    <span className="font-bold text-blue-900 uppercase block tracking-wider text-[9px] mb-1">Reason / Note</span>
                                    <p className="text-xs text-slate-700 leading-relaxed font-medium">{selectedMRN.reason}</p>
                                </div>
                            )}

                            {/* Stock Level Warning Banner */}
                            {selectedMRN.status === "PENDING" && !isStockLoading && !isStockSufficient && (
                                <div className="bg-rose-50 border border-rose-200/80 rounded-xl p-3 flex gap-3 text-rose-800">
                                    <AlertTriangle className="w-5 h-5 shrink-0 text-rose-600 mt-0.5" />
                                    <div className="space-y-1">
                                        <h4 className="text-xs font-bold">Cannot Approve: Stock Shortage</h4>
                                        <p className="text-[11px] leading-relaxed text-rose-700">
                                            The store has insufficient stock levels for one or more items requested in this MRN. Please review the item quantities below before proceeding.
                                        </p>
                                    </div>
                                </div>
                            )}

                            {/* Items breakdown list */}
                            <div className="space-y-2">
                                <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wide block">Returned Items</label>
                                <div className="border border-slate-200 rounded-xl overflow-hidden">
                                    <table className="w-full text-xs text-left">
                                        <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                                            <tr>
                                                <th className="px-3 py-2">Item Details</th>
                                                <th className="px-3 py-2 text-right">Return Qty</th>
                                                {selectedMRN.status === "PENDING" && (
                                                    <th className="px-3 py-2 text-right">Store Available</th>
                                                )}
                                                <th className="px-3 py-2">Item Reason</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {selectedMRN.items.map((item) => {
                                                const stockCheck = stockDetails.find(d => d.itemId === item.itemId);
                                                return (
                                                    <tr key={item.id} className="hover:bg-slate-50/20">
                                                        <td className="px-3 py-2 font-medium">
                                                            <div className="flex flex-col">
                                                                <span className="font-bold text-slate-800">{item.item.code}</span>
                                                                <span className="text-[10px] text-slate-500">{item.item.name}</span>
                                                            </div>
                                                        </td>
                                                        <td className="px-3 py-2 text-right font-semibold text-slate-700">
                                                            {item.quantity} {item.item.unit}
                                                        </td>
                                                        {selectedMRN.status === "PENDING" && (
                                                            <td className="px-3 py-2 text-right">
                                                                {isStockLoading ? (
                                                                    <span className="text-slate-400">Loading...</span>
                                                                ) : stockCheck ? (
                                                                    <Badge
                                                                        variant="outline"
                                                                        className={cn(
                                                                            "text-[10px] px-1.5 py-0",
                                                                            stockCheck.hasEnough
                                                                                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                                                                : "bg-rose-50 text-rose-700 border-rose-200"
                                                                        )}
                                                                    >
                                                                        {stockCheck.available} {item.item.unit}
                                                                    </Badge>
                                                                ) : (
                                                                    <Badge variant="outline" className="bg-rose-50 text-rose-700 border-rose-200 text-[10px] px-1.5 py-0">
                                                                        0 {item.item.unit}
                                                                    </Badge>
                                                                )}
                                                            </td>
                                                        )}
                                                        <td className="px-3 py-2 text-slate-500 font-medium italic">
                                                            {item.reason || "-"}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}

                    <DialogFooter className="px-6 py-4 border-t bg-slate-50 gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            className="h-8 text-xs font-semibold"
                            onClick={() => setShowDetailsDialog(false)}
                        >
                            Close
                        </Button>
                        
                        {selectedMRN?.status === "PENDING" && (
                            <>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-8 text-xs font-bold text-rose-600 hover:text-white border-rose-200 hover:bg-rose-600"
                                    disabled={updateStatusMutation.isPending}
                                    onClick={() => updateStatusMutation.mutate({ mrnId: selectedMRN.id, action: "REJECT" })}
                                >
                                    {updateStatusMutation.isPending ? (
                                        <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                                    ) : (
                                        <XCircle className="w-3.5 h-3.5 mr-1.5" />
                                    )}
                                    Reject MRN
                                </Button>
                                <Button
                                    size="sm"
                                    className="h-8 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700"
                                    disabled={updateStatusMutation.isPending || isStockLoading || !isStockSufficient}
                                    onClick={() => updateStatusMutation.mutate({ mrnId: selectedMRN.id, action: "APPROVE" })}
                                >
                                    {updateStatusMutation.isPending ? (
                                        <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                                    ) : (
                                        <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                                    )}
                                    Approve & Deduct Stock
                                </Button>
                            </>
                        )}
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

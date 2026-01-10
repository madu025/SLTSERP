"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Loader2, Eye, FileText, CheckCircle, Truck, Package } from "lucide-react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogFooter,
} from "@/components/ui/dialog";

export default function ProcurementOrdersPage() {
    const queryClient = useQueryClient();
    const [selectedRequest, setSelectedRequest] = useState<any>(null);
    const [activeTab, setActiveTab] = useState<"PENDING" | "IN_PROGRESS" | "COMPLETED">("PENDING");

    // PO Creation State
    const [showPODialog, setShowPODialog] = useState(false);
    const [poNumber, setPONumber] = useState("");
    const [vendor, setVendor] = useState("");
    const [expectedDelivery, setExpectedDelivery] = useState("");
    const [poRemarks, setPORemarks] = useState("");

    // Fetch Procurement Requests
    const { data: requests = [], isLoading } = useQuery({
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
        mutationFn: async (data: any) => {
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
            PENDING: { label: "Awaiting PO", className: "bg-orange-100 text-orange-700" },
            PO_CREATED: { label: "PO Created", className: "bg-blue-100 text-blue-700" },
            PO_SENT: { label: "PO Sent", className: "bg-purple-100 text-purple-700" },
            PO_CONFIRMED: { label: "PO Confirmed", className: "bg-indigo-100 text-indigo-700" },
            COMPLETED: { label: "Ready for GRN", className: "bg-green-100 text-green-700" }
        };
        const config = statusConfig[status] || statusConfig.PENDING;
        return <Badge className={config.className}>{config.label}</Badge>;
    };

    return (
        <div className="flex h-screen bg-slate-50 overflow-hidden">
            <Sidebar />
            <main className="flex-1 flex flex-col min-w-0 h-full">
                <Header />
                <div className="flex-1 overflow-y-auto p-4 md:p-6">
                    <div className="max-w-7xl mx-auto space-y-6">
                        {/* Header with Tabs */}
                        <div className="flex justify-between items-center">
                            <div>
                                <h1 className="text-2xl font-bold text-slate-900">Procurement & Purchase Orders</h1>
                                <p className="text-slate-500">Manage procurement workflow step-by-step</p>
                            </div>
                            <div className="flex bg-slate-200 p-1 rounded-lg">
                                <button
                                    onClick={() => setActiveTab("PENDING")}
                                    className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${activeTab === "PENDING" ? "bg-white shadow text-blue-700" : "text-slate-600 hover:text-slate-900"}`}
                                >
                                    Pending PO
                                </button>
                                <button
                                    onClick={() => setActiveTab("IN_PROGRESS")}
                                    className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${activeTab === "IN_PROGRESS" ? "bg-white shadow text-blue-700" : "text-slate-600 hover:text-slate-900"}`}
                                >
                                    In Progress
                                </button>
                                <button
                                    onClick={() => setActiveTab("COMPLETED")}
                                    className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${activeTab === "COMPLETED" ? "bg-white shadow text-blue-700" : "text-slate-600 hover:text-slate-900"}`}
                                >
                                    Ready for GRN
                                </button>
                            </div>
                        </div>

                        {/* Main Card */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-lg">
                                    {activeTab === "PENDING" && "Requests Awaiting Purchase Order Creation"}
                                    {activeTab === "IN_PROGRESS" && "Purchase Orders In Progress"}
                                    {activeTab === "COMPLETED" && "Orders Ready for Goods Receipt"}
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                {isLoading ? (
                                    <div className="flex justify-center p-8"><Loader2 className="animate-spin text-blue-600" /></div>
                                ) : requests.length === 0 ? (
                                    <div className="text-center p-8 text-slate-500">No records found.</div>
                                ) : (
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm text-left">
                                            <thead className="bg-slate-100 text-slate-700 font-bold uppercase border-b">
                                                <tr>
                                                    <th className="px-4 py-3">Req No</th>
                                                    <th className="px-4 py-3">Date</th>
                                                    <th className="px-4 py-3">Source</th>
                                                    <th className="px-4 py-3">Items</th>
                                                    <th className="px-4 py-3">Status</th>
                                                    {activeTab !== "PENDING" && <th className="px-4 py-3">PO Number</th>}
                                                    {activeTab !== "PENDING" && <th className="px-4 py-3">Vendor</th>}
                                                    <th className="px-4 py-3 text-right">Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y">
                                                {requests.map((req: any) => (
                                                    <tr key={req.id} className="hover:bg-slate-50">
                                                        <td className="px-4 py-3 font-medium">{req.requestNr}</td>
                                                        <td className="px-4 py-3 text-slate-500">{new Date(req.createdAt).toLocaleDateString()}</td>
                                                        <td className="px-4 py-3">
                                                            <Badge variant="outline">{req.sourceType || 'SLT'}</Badge>
                                                        </td>
                                                        <td className="px-4 py-3 text-center">{req.items?.length || 0}</td>
                                                        <td className="px-4 py-3">{getStatusBadge(req.procurementStatus || 'PENDING')}</td>
                                                        {activeTab !== "PENDING" && <td className="px-4 py-3 font-mono text-xs">{req.poNumber || '-'}</td>}
                                                        {activeTab !== "PENDING" && <td className="px-4 py-3">{req.vendor || '-'}</td>}
                                                        <td className="px-4 py-3 text-right">
                                                            <div className="flex justify-end gap-2">
                                                                {/* View Details */}
                                                                <Dialog>
                                                                    <DialogTrigger asChild>
                                                                        <Button variant="ghost" size="sm" onClick={() => setSelectedRequest(req)}>
                                                                            <Eye className="w-4 h-4" />
                                                                        </Button>
                                                                    </DialogTrigger>
                                                                    <DialogContent className="max-w-3xl">
                                                                        <DialogHeader>
                                                                            <DialogTitle>Request Details - {req.requestNr}</DialogTitle>
                                                                        </DialogHeader>
                                                                        <div className="space-y-4">
                                                                            <div className="grid grid-cols-2 gap-4 text-sm bg-slate-50 p-3 rounded">
                                                                                <div><span className="font-bold">Requested By:</span> {req.requestedBy?.name}</div>
                                                                                <div><span className="font-bold">Source:</span> {req.sourceType}</div>
                                                                                <div><span className="font-bold">Priority:</span> <Badge>{req.priority}</Badge></div>
                                                                                <div><span className="font-bold">Status:</span> {getStatusBadge(req.procurementStatus)}</div>
                                                                                {req.poNumber && <div className="col-span-2"><span className="font-bold">PO Number:</span> {req.poNumber}</div>}
                                                                                {req.vendor && <div className="col-span-2"><span className="font-bold">Vendor:</span> {req.vendor}</div>}
                                                                            </div>
                                                                            <table className="w-full text-xs border">
                                                                                <thead className="bg-slate-100 font-bold">
                                                                                    <tr>
                                                                                        <th className="p-2 border">Item</th>
                                                                                        <th className="p-2 border">Qty</th>
                                                                                        <th className="p-2 border">Make/Model</th>
                                                                                        <th className="p-2 border">Vendor (Suggested)</th>
                                                                                    </tr>
                                                                                </thead>
                                                                                <tbody>
                                                                                    {req.items?.map((item: any) => (
                                                                                        <tr key={item.id}>
                                                                                            <td className="p-2 border">{item.item?.name}</td>
                                                                                            <td className="p-2 border">{item.requestedQty} {item.item?.unit}</td>
                                                                                            <td className="p-2 border">{item.make} {item.model}</td>
                                                                                            <td className="p-2 border">{item.suggestedVendor || '-'}</td>
                                                                                        </tr>
                                                                                    ))}
                                                                                </tbody>
                                                                            </table>
                                                                        </div>
                                                                    </DialogContent>
                                                                </Dialog>

                                                                {/* Action Buttons */}
                                                                {activeTab === "PENDING" && (
                                                                    <Button
                                                                        size="sm"
                                                                        className="bg-blue-600 hover:bg-blue-700"
                                                                        onClick={() => {
                                                                            setSelectedRequest(req);
                                                                            // Pre-fill vendor for SLT requests
                                                                            if (req.sourceType === 'SLT') {
                                                                                setVendor('SLT Head Office');
                                                                            }
                                                                            setShowPODialog(true);
                                                                        }}
                                                                    >
                                                                        <FileText className="w-4 h-4 mr-1" />
                                                                        Create PO
                                                                    </Button>
                                                                )}

                                                                {activeTab === "IN_PROGRESS" && (
                                                                    <div className="flex gap-1">
                                                                        {req.procurementStatus === "PO_CREATED" && (
                                                                            <Button
                                                                                size="sm"
                                                                                variant="outline"
                                                                                onClick={() => updateStatusMutation.mutate({ requestId: req.id, newStatus: "PO_SENT" })}
                                                                            >
                                                                                Mark as Sent
                                                                            </Button>
                                                                        )}
                                                                        {req.procurementStatus === "PO_SENT" && (
                                                                            <Button
                                                                                size="sm"
                                                                                variant="outline"
                                                                                onClick={() => updateStatusMutation.mutate({ requestId: req.id, newStatus: "PO_CONFIRMED" })}
                                                                            >
                                                                                Mark as Confirmed
                                                                            </Button>
                                                                        )}
                                                                        {req.procurementStatus === "PO_CONFIRMED" && (
                                                                            <Button
                                                                                size="sm"
                                                                                className="bg-green-600 hover:bg-green-700"
                                                                                onClick={() => completeOrderMutation.mutate(req.id)}
                                                                            >
                                                                                <Package className="w-4 h-4 mr-1" />
                                                                                Ready for GRN
                                                                            </Button>
                                                                        )}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </main>

            {/* Create PO Dialog */}
            <Dialog open={showPODialog} onOpenChange={setShowPODialog}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>
                            Create {selectedRequest?.sourceType === 'SLT' ? 'Covering ' : ''}Purchase Order - {selectedRequest?.requestNr}
                        </DialogTitle>
                        {selectedRequest?.sourceType === 'SLT' && selectedRequest?.irNumber && (
                            <p className="text-sm text-slate-500 mt-1">
                                <span className="font-bold">IR Number:</span> {selectedRequest.irNumber}
                            </p>
                        )}
                    </DialogHeader>
                    <div className="space-y-4">
                        {selectedRequest?.sourceType === 'SLT' && (
                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                                <p className="text-sm text-blue-800">
                                    <strong>Covering PO:</strong> This PO is created after receiving goods from SLT Head Office.
                                    {selectedRequest?.irNumber && ` Based on IR: ${selectedRequest.irNumber}`}
                                </p>
                            </div>
                        )}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-sm font-bold">PO Number *</label>
                                <Input
                                    placeholder="PO-2024-001"
                                    value={poNumber}
                                    onChange={(e) => setPONumber(e.target.value)}
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-bold">Vendor *</label>
                                <Input
                                    placeholder={selectedRequest?.sourceType === 'SLT' ? "SLT Head Office" : "Vendor Name"}
                                    value={vendor}
                                    onChange={(e) => setVendor(e.target.value)}
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-bold">Expected Delivery Date</label>
                            <Input
                                type="date"
                                value={expectedDelivery}
                                onChange={(e) => setExpectedDelivery(e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-bold">Remarks</label>
                            <Textarea
                                placeholder="Additional notes..."
                                value={poRemarks}
                                onChange={(e) => setPORemarks(e.target.value)}
                                rows={3}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowPODialog(false)}>Cancel</Button>
                        <Button
                            className="bg-blue-600 hover:bg-blue-700"
                            onClick={handleCreatePO}
                            disabled={createPOMutation.isPending}
                        >
                            {createPOMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Create PO"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

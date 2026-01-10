"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, CheckCircle, XCircle, Eye } from "lucide-react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";

export default function ApprovalsPage() {
    const queryClient = useQueryClient();
    const [selectedRequest, setSelectedRequest] = useState<any>(null);

    const [activeTab, setActiveTab] = useState("PENDING");

    // Fetch Requests with filtering
    const { data: requests = [], isLoading } = useQuery({
        queryKey: ["approvals", activeTab],
        queryFn: async () => {
            if (activeTab === "PENDING") {
                // PENDING: Only procurement requests awaiting manager approval
                const url = "/api/inventory/requests?workflowStage=REQUEST&status=PENDING";
                return (await fetch(url)).json();
            } else {
                // HISTORY: Show ALL approved/rejected requests (procurement + internal transfers)
                // This gives managers a unified view of all their approval decisions
                const url = "/api/inventory/requests?status=APPROVED,REJECTED";
                return (await fetch(url)).json();
            }
        }
    });

    const approveMutation = useMutation({
        mutationFn: async ({ id, action, remarks }: { id: string, action: string, remarks?: string }) => {
            const res = await fetch("/api/inventory/requests", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ requestId: id, action, remarks })
            });
            if (!res.ok) throw new Error("Action failed");
            return res.json();
        },
        onSuccess: () => {
            toast.success("Request processed successfully");
            queryClient.invalidateQueries({ queryKey: ["approvals"] });
            setSelectedRequest(null);
        },
        onError: () => toast.error("Operation failed")
    });

    const handleAction = (id: string, action: 'MANAGER_APPROVE' | 'REJECT') => {
        approveMutation.mutate({ id, action });
    };

    // Helper to format history filter in UI if needed, but API does heavy lifting.
    // Actually for History we might want ALL requests that match criteria.
    // Let's refine the History query.
    // History should show requests that have passed the Manager stage OR were Rejected.
    // i.e. workflowStage != REQUEST OR status = REJECTED.
    // My previous backend filter supported comma separated values.

    // Let's rely on status/stage.
    // If activeTab === HISTORY, fetch workflowStage=PROCUREMENT,GRN_PENDING,COMPLETED
    // AND fetch status=REJECTED (if separate query needed).
    // Simplify: Fetch ALL and filter on client? No.
    // Let's try to fetch specifically.

    // Update queryFn to handle HISTORY better.

    /* Updated Query Logic */
    // PENDING: workflowStage=REQUEST
    // HISTORY: workflowStage=PROCUREMENT,GRN_PENDING,COMPLETED&status=APPROVED,REJECTED

    /* Implementing Tabs UI */

    return (
        <div className="flex h-screen bg-slate-50 overflow-hidden">
            <Sidebar />
            <main className="flex-1 flex flex-col min-w-0 h-full">
                <Header />
                <div className="flex-1 overflow-y-auto p-4 md:p-6">
                    <div className="max-w-7xl mx-auto space-y-6">
                        <div className="flex justify-between items-center">
                            <div>
                                <h1 className="text-2xl font-bold text-slate-900">Approvals</h1>
                                <p className="text-slate-500">Review material requests</p>
                            </div>
                            <div className="flex bg-slate-200 p-1 rounded-lg">
                                <button
                                    onClick={() => setActiveTab("PENDING")}
                                    className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${activeTab === "PENDING" ? "bg-white shadow text-blue-700" : "text-slate-600 hover:text-slate-900"}`}
                                >
                                    Pending Actions
                                </button>
                                <button
                                    onClick={() => setActiveTab("HISTORY")}
                                    className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${activeTab === "HISTORY" ? "bg-white shadow text-blue-700" : "text-slate-600 hover:text-slate-900"}`}
                                >
                                    Approval History
                                </button>
                            </div>
                        </div>

                        <Card>
                            <CardHeader>
                                <CardTitle className="text-lg">
                                    {activeTab === "PENDING" ? "Requests Awaiting Manager Approval" : "Previously Processed Requests"}
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
                                                    {activeTab === "HISTORY" && <th className="px-4 py-3">Status</th>}
                                                    <th className="px-4 py-3">Type</th>
                                                    <th className="px-4 py-3">Items</th>
                                                    <th className="px-4 py-3">Priority</th>
                                                    <th className="px-4 py-3 text-right">Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y">
                                                {requests.map((req: any) => (
                                                    <tr key={req.id} className="hover:bg-slate-50">
                                                        <td className="px-4 py-3 font-medium">{req.requestNr}</td>
                                                        <td className="px-4 py-3 text-slate-500">{new Date(req.createdAt).toLocaleDateString()}</td>
                                                        <td className="px-4 py-3">
                                                            <Badge variant="outline">
                                                                {req.toStoreId ? 'Internal Transfer' : (req.sourceType || 'Procurement')}
                                                            </Badge>
                                                        </td>
                                                        {activeTab === "HISTORY" && (
                                                            <td className="px-4 py-3">
                                                                <Badge className={
                                                                    req.status === 'REJECTED' ? 'bg-red-100 text-red-700 hover:bg-red-100' :
                                                                        req.workflowStage === 'REQUEST' ? 'bg-orange-100 text-orange-700 hover:bg-orange-100' :
                                                                            'bg-green-100 text-green-700 hover:bg-green-100'
                                                                }>
                                                                    {req.status === 'REJECTED' ? 'REJECTED' : req.managerAction === 'APPROVED' ? 'APPROVED' : 'PENDING'}
                                                                </Badge>
                                                            </td>
                                                        )}
                                                        <td className="px-4 py-3 max-w-[200px] truncate" title={req.projectTypes?.join(', ') || req.purpose}>
                                                            {req.projectTypes?.length > 0 ? req.projectTypes[0] : 'General'}
                                                        </td>
                                                        <td className="px-4 py-3 text-center">{req.items?.length || 0}</td>
                                                        <td className="px-4 py-3">
                                                            <Badge className={req.priority === 'URGENT' ? 'bg-red-500' : 'bg-blue-500'}>{req.priority}</Badge>
                                                        </td>
                                                        <td className="px-4 py-3 text-right flex justify-end gap-2">
                                                            <Dialog>
                                                                <DialogTrigger asChild>
                                                                    <Button variant="ghost" size="sm" onClick={() => setSelectedRequest(req)}>
                                                                        <Eye className="w-4 h-4 text-slate-500" />
                                                                    </Button>
                                                                </DialogTrigger>
                                                                <DialogContent className="max-w-3xl">
                                                                    <DialogHeader>
                                                                        <DialogTitle>Request Details - {req.requestNr}</DialogTitle>
                                                                    </DialogHeader>
                                                                    <div className="space-y-4">
                                                                        <div className="grid grid-cols-2 gap-4 text-sm bg-slate-50 p-3 rounded">
                                                                            <div><span className="font-bold">Requested By:</span> {req.requestedBy?.name}</div>
                                                                            <div><span className="font-bold">Required Date:</span> {new Date(req.requiredDate).toLocaleDateString()}</div>
                                                                            <div className="col-span-2"><span className="font-bold">Purpose:</span> {req.purpose}</div>
                                                                            {req.remarks && <div className="col-span-2 text-red-500"><span className="font-bold">Outcome Remarks:</span> {req.remarks}</div>}
                                                                        </div>
                                                                        <table className="w-full text-xs border">
                                                                            <thead className="bg-slate-100 font-bold">
                                                                                <tr>
                                                                                    <th className="p-2 border">Item</th>
                                                                                    <th className="p-2 border">Qty</th>
                                                                                    <th className="p-2 border">Make/Model</th>
                                                                                </tr>
                                                                            </thead>
                                                                            <tbody>
                                                                                {req.items?.map((item: any) => (
                                                                                    <tr key={item.id}>
                                                                                        <td className="p-2 border">{item.item?.name} ({item.item?.code})</td>
                                                                                        <td className="p-2 border">{item.requestedQty} {item.item?.unit}</td>
                                                                                        <td className="p-2 border">{item.make} {item.model}</td>
                                                                                    </tr>
                                                                                ))}
                                                                            </tbody>
                                                                        </table>
                                                                        {activeTab === "PENDING" && (
                                                                            <div className="flex justify-end gap-3 mt-4">
                                                                                <Button variant="destructive" onClick={() => handleAction(req.id, 'REJECT')}>Reject</Button>
                                                                                <Button className="bg-green-600 hover:bg-green-700" onClick={() => handleAction(req.id, 'MANAGER_APPROVE')}>
                                                                                    Approve & Forward
                                                                                </Button>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </DialogContent>
                                                            </Dialog>
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
        </div>
    );
}

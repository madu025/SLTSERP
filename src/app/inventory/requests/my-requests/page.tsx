"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Eye, Edit } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface RequestItemData {
    id: string;
    requestedQty: number;
    make?: string;
    model?: string;
    suggestedVendor?: string;
    item?: {
        name: string;
        unit: string;
    };
}

interface MaterialRequestData {
    id: string;
    requestNr: string;
    createdAt: string;
    sourceType?: string;
    status: string;
    workflowStage: string;
    remarks?: string;
    requestedById: string;
    priority?: string;
    items?: RequestItemData[];
}

export default function MyRequestsPage() {
    const router = useRouter();
    const [selectedRequest, setSelectedRequest] = useState<MaterialRequestData | null>(null);
    const [showDetailsDialog, setShowDetailsDialog] = useState(false);

    // Fetch user's own requests
    const { data: requests = [], isLoading } = useQuery({
        queryKey: ['my-requests'],
        queryFn: async () => {
            const stored = typeof window !== 'undefined' ? localStorage.getItem('user') : null;
            const currentUser = stored ? JSON.parse(stored) : null;
            if (!currentUser?.id) return [];

            const res = await fetch(`/api/inventory/requests`);
            const data = await res.json();
            const allRequests: MaterialRequestData[] = Array.isArray(data) ? data : (data.requests || []);
            // Filter to show only this user's requests
            return allRequests.filter((r) => r.requestedById === currentUser.id);
        }
    });

    const getStatusBadge = (status: string, workflowStage: string) => {
        if (status === 'REJECTED') {
            return <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-rose-50 text-rose-700 border-rose-200">Rejected</Badge>;
        }
        if (status === 'PENDING' && workflowStage === 'REQUEST') {
            return <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-amber-50 text-amber-700 border-amber-200">Pending Approval</Badge>;
        }
        if (workflowStage === 'PROCUREMENT') {
            return <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-blue-50 text-blue-700 border-blue-200">In Procurement</Badge>;
        }
        if (workflowStage === 'GRN_PENDING') {
            return <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-purple-50 text-purple-700 border-purple-200">Ready for GRN</Badge>;
        }
        if (status === 'COMPLETED') {
            return <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-emerald-50 text-emerald-700 border-emerald-200">Completed</Badge>;
        }
        return <Badge variant="outline" className="text-[10px] px-1.5 py-0">{status}</Badge>;
    };

    const handleEdit = (request: MaterialRequestData) => {
        router.push(`/inventory/requests/edit/${request.id}`);
    };

    return (
        <div className="erp-page-wrapper flex-row overflow-hidden">
            <Sidebar />
            <main className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
                <Header />
                <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
                    <div className="max-w-7xl mx-auto space-y-4">
                        {/* Header */}
                        <div className="space-y-0.5">
                            <h1 className="text-xl font-black text-slate-900 tracking-tight">My Material Requests</h1>
                            <p className="text-xs text-slate-500">View and manage your material requests</p>
                        </div>

                        {/* Requests List */}
                        <div className="erp-table-container flex flex-col bg-white overflow-hidden">
                            <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/40 flex justify-between items-center">
                                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Request History</span>
                            </div>
                            {isLoading ? (
                                <div className="text-center p-8 text-slate-400 text-xs font-semibold">Loading...</div>
                            ) : requests.length === 0 ? (
                                <div className="text-center p-8 text-slate-400 text-xs font-semibold">
                                    No requests found
                                    <div className="mt-2">
                                        <Button size="sm" onClick={() => router.push('/inventory/requests/create')} className="h-8 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-md shadow-sm">
                                            Create New Request
                                        </Button>
                                    </div>
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-xs text-left border-collapse">
                                        <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                                            <tr>
                                                <th className="px-4 py-2">Request No</th>
                                                <th className="px-3 py-2">Date</th>
                                                <th className="px-3 py-2">Source</th>
                                                <th className="px-3 py-2 text-center">Items</th>
                                                <th className="px-3 py-2">Status</th>
                                                <th className="px-3 py-2">Remarks</th>
                                                <th className="px-4 py-2 text-right">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {requests.map((req: MaterialRequestData) => (
                                                <tr key={req.id} className="hover:bg-slate-50/50 transition-colors duration-150">
                                                    <td className="px-4 py-1.5 font-bold text-slate-800">{req.requestNr}</td>
                                                    <td className="px-3 py-1.5 text-slate-500">
                                                        {new Date(req.createdAt).toLocaleDateString()}
                                                    </td>
                                                    <td className="px-3 py-1.5">
                                                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-slate-200 bg-white text-slate-600 font-medium">{req.sourceType || 'SLT'}</Badge>
                                                    </td>
                                                    <td className="px-3 py-1.5 text-center font-semibold text-slate-700">{req.items?.length || 0}</td>
                                                    <td className="px-3 py-1.5">
                                                        {getStatusBadge(req.status, req.workflowStage)}
                                                    </td>
                                                    <td className="px-3 py-1.5">
                                                        {req.status === 'REJECTED' && req.remarks && (
                                                            <span className="text-[11px] font-medium text-rose-600 bg-rose-50/50 border border-rose-100 rounded px-1.5 py-0.5">
                                                                {req.remarks}
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="px-4 py-1.5 text-right">
                                                        <div className="flex justify-end gap-1">
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-7 w-7 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-md"
                                                                onClick={() => {
                                                                    setSelectedRequest(req);
                                                                    setShowDetailsDialog(true);
                                                                }}
                                                            >
                                                                <Eye className="w-3.5 h-3.5" />
                                                            </Button>
                                                            {req.status === 'REJECTED' && (
                                                                <Button
                                                                    size="sm"
                                                                    className="h-7 px-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-md shadow-sm"
                                                                    onClick={() => handleEdit(req)}
                                                                >
                                                                    <Edit className="w-3 h-3 mr-1" />
                                                                    Edit
                                                                </Button>
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

            {/* Details Dialog */}
            <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
                <DialogContent className="max-w-3xl">
                    <DialogHeader>
                        <DialogTitle>Request Details - {selectedRequest?.requestNr}</DialogTitle>
                    </DialogHeader>
                    {selectedRequest && (
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4 text-sm bg-slate-50 p-3 rounded">
                                <div><span className="font-bold">Source:</span> {selectedRequest.sourceType}</div>
                                <div><span className="font-bold">Priority:</span> <Badge>{selectedRequest.priority}</Badge></div>
                                <div><span className="font-bold">Status:</span> {getStatusBadge(selectedRequest.status, selectedRequest.workflowStage)}</div>
                                <div><span className="font-bold">Created:</span> {new Date(selectedRequest.createdAt).toLocaleString()}</div>
                                {selectedRequest.remarks && (
                                    <div className="col-span-2">
                                        <span className="font-bold">Remarks:</span>
                                        <p className="text-red-600 mt-1">{selectedRequest.remarks}</p>
                                    </div>
                                )}
                            </div>
                            <table className="w-full text-xs border">
                                <thead className="bg-slate-100 font-bold">
                                    <tr>
                                        <th className="p-2 border">Item</th>
                                        <th className="p-2 border">Qty</th>
                                        <th className="p-2 border">Make/Model</th>
                                        <th className="p-2 border">Vendor</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {selectedRequest.items?.map((item: RequestItemData) => (
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
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}

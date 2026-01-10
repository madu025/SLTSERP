"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Eye, Edit, RefreshCw } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export default function MyRequestsPage() {
    const router = useRouter();
    const queryClient = useQueryClient();
    const [user, setUser] = useState<any>(null);
    const [selectedRequest, setSelectedRequest] = useState<any>(null);
    const [showDetailsDialog, setShowDetailsDialog] = useState(false);

    useEffect(() => {
        const stored = localStorage.getItem('user');
        if (stored) setUser(JSON.parse(stored));
    }, []);

    // Fetch user's own requests
    const { data: requests = [], isLoading } = useQuery({
        queryKey: ['my-requests', user?.id],
        queryFn: async () => {
            if (!user?.id) return [];
            const res = await fetch(`/api/inventory/requests`);
            const data = await res.json();
            const allRequests = Array.isArray(data) ? data : (data.requests || []);
            // Filter to show only this user's requests
            return allRequests.filter((r: any) => r.requestedById === user.id);
        },
        enabled: !!user?.id
    });

    const getStatusBadge = (status: string, workflowStage: string) => {
        if (status === 'REJECTED') {
            return <Badge className="bg-red-100 text-red-700">Rejected</Badge>;
        }
        if (status === 'PENDING' && workflowStage === 'REQUEST') {
            return <Badge className="bg-yellow-100 text-yellow-700">Pending Approval</Badge>;
        }
        if (workflowStage === 'PROCUREMENT') {
            return <Badge className="bg-blue-100 text-blue-700">In Procurement</Badge>;
        }
        if (workflowStage === 'GRN_PENDING') {
            return <Badge className="bg-purple-100 text-purple-700">Ready for GRN</Badge>;
        }
        if (status === 'COMPLETED') {
            return <Badge className="bg-green-100 text-green-700">Completed</Badge>;
        }
        return <Badge variant="outline">{status}</Badge>;
    };

    const handleEdit = (request: any) => {
        // Navigate to edit page with request ID
        router.push(`/admin/inventory/requests/edit/${request.id}`);
    };

    return (
        <div className="flex h-screen bg-slate-50 overflow-hidden">
            <Sidebar />
            <main className="flex-1 flex flex-col min-w-0 h-full">
                <Header />
                <div className="flex-1 overflow-y-auto p-4 md:p-6">
                    <div className="max-w-7xl mx-auto space-y-6">
                        {/* Header */}
                        <div>
                            <h1 className="text-2xl font-bold text-slate-900">My Material Requests</h1>
                            <p className="text-slate-500">View and manage your material requests</p>
                        </div>

                        {/* Requests List */}
                        <Card>
                            <CardHeader>
                                <CardTitle>Request History</CardTitle>
                            </CardHeader>
                            <CardContent>
                                {isLoading ? (
                                    <div className="text-center p-8 text-slate-500">Loading...</div>
                                ) : requests.length === 0 ? (
                                    <div className="text-center p-8 text-slate-500">
                                        No requests found
                                        <div className="mt-4">
                                            <Button onClick={() => router.push('/admin/inventory/requests/create')}>
                                                Create New Request
                                            </Button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm">
                                            <thead className="bg-slate-100 border-b">
                                                <tr>
                                                    <th className="px-4 py-3 text-left">Request No</th>
                                                    <th className="px-4 py-3 text-left">Date</th>
                                                    <th className="px-4 py-3 text-left">Source</th>
                                                    <th className="px-4 py-3 text-left">Items</th>
                                                    <th className="px-4 py-3 text-left">Status</th>
                                                    <th className="px-4 py-3 text-left">Remarks</th>
                                                    <th className="px-4 py-3 text-right">Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y">
                                                {requests.map((req: any) => (
                                                    <tr key={req.id} className="hover:bg-slate-50">
                                                        <td className="px-4 py-3 font-medium">{req.requestNr}</td>
                                                        <td className="px-4 py-3 text-slate-500">
                                                            {new Date(req.createdAt).toLocaleDateString()}
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            <Badge variant="outline">{req.sourceType || 'SLT'}</Badge>
                                                        </td>
                                                        <td className="px-4 py-3 text-center">{req.items?.length || 0}</td>
                                                        <td className="px-4 py-3">
                                                            {getStatusBadge(req.status, req.workflowStage)}
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            {req.status === 'REJECTED' && req.remarks && (
                                                                <span className="text-xs text-red-600">
                                                                    {req.remarks}
                                                                </span>
                                                            )}
                                                        </td>
                                                        <td className="px-4 py-3 text-right">
                                                            <div className="flex justify-end gap-2">
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    onClick={() => {
                                                                        setSelectedRequest(req);
                                                                        setShowDetailsDialog(true);
                                                                    }}
                                                                >
                                                                    <Eye className="w-4 h-4" />
                                                                </Button>
                                                                {req.status === 'REJECTED' && (
                                                                    <Button
                                                                        size="sm"
                                                                        className="bg-blue-600 hover:bg-blue-700"
                                                                        onClick={() => handleEdit(req)}
                                                                    >
                                                                        <Edit className="w-4 h-4 mr-1" />
                                                                        Edit & Resubmit
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
                            </CardContent>
                        </Card>
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
                                    {selectedRequest.items?.map((item: any) => (
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

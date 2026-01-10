"use client";

import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

interface RestoreRequest {
    id: string;
    createdAt: string;
    reason: string;
    status: 'PENDING' | 'APPROVED' | 'REJECTED';
    serviceOrder: {
        id: string;
        soNum: string;
        voiceNumber: string | null;
        customerName: string | null;
        address: string | null;
        opmc: { name: string; rtom: string };
    };
    requestedBy: {
        name: string;
        username: string;
    };
    approvedBy?: {
        name: string;
    };
    approvalComment?: string;
}

export default function RestoreRequestsPage() {
    const queryClient = useQueryClient();
    const [statusFilter, setStatusFilter] = useState<'PENDING' | 'APPROVED' | 'REJECTED'>("PENDING");
    const [user, setUser] = useState<any>(null);

    // Action Modal State
    const [actionModal, setActionModal] = useState<{
        isOpen: boolean;
        requestId: string | null;
        action: 'APPROVE' | 'REJECT' | null;
        comment: string;
    }>({
        isOpen: false,
        requestId: null,
        action: null,
        comment: ""
    });

    useEffect(() => {
        const storedUser = localStorage.getItem('user');
        if (storedUser) setUser(JSON.parse(storedUser));
    }, []);

    const { data: requests = [], isLoading } = useQuery<RestoreRequest[]>({
        queryKey: ["restore-requests", statusFilter],
        queryFn: async () => {
            const res = await fetch(`/api/restore-requests?status=${statusFilter}&page=1&limit=1000`);
            if (!res.ok) return [];
            const data = await res.json();
            return data.requests || (Array.isArray(data) ? data : []);
        }
    });

    const actionMutation = useMutation({
        mutationFn: async ({ id, action, comment }: { id: string, action: 'APPROVE' | 'REJECT', comment: string }) => {
            const res = await fetch("/api/restore-requests", {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                    "x-user-id": user?.id // Identify who is approving
                },
                body: JSON.stringify({
                    id,
                    action,
                    approvedById: user?.id,
                    comment
                })
            });
            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(errorData.message || "Failed to process request");
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["restore-requests"] });
            queryClient.invalidateQueries({ queryKey: ["restore-requests-count"] }); // Update sidebar badge
            closeModal();
            alert("Request processed successfully.");
        },
        onError: (err: any) => {
            alert(err.message);
        }
    });

    const openActionModal = (requestId: string, action: 'APPROVE' | 'REJECT') => {
        setActionModal({ isOpen: true, requestId, action, comment: "" });
    };

    const closeModal = () => {
        setActionModal({ isOpen: false, requestId: null, action: null, comment: "" });
    };

    const handleConfirmAction = () => {
        if (actionModal.requestId && actionModal.action) {
            actionMutation.mutate({
                id: actionModal.requestId,
                action: actionModal.action,
                comment: actionModal.comment
            });
        }
    };

    return (
        <div className="h-screen flex bg-slate-50 overflow-hidden">
            <Sidebar />
            <main className="flex-1 flex flex-col min-w-0 h-full">
                <Header />
                <div className="flex-1 flex flex-col min-h-0 overflow-hidden">

                    {/* Top Section: Fixed Height */}
                    <div className="flex-none p-2 space-y-2">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                            <div>
                                <h1 className="text-lg font-bold text-slate-900 leading-none">Restore Requests</h1>
                                <p className="text-[10px] text-slate-500 mt-0.5">Manage requests to reopen service orders</p>
                            </div>
                        </div>

                        <div className="bg-white p-2 rounded-lg border shadow-sm flex items-center gap-2">
                            <label className="text-[10px] font-semibold text-slate-500 uppercase whitespace-nowrap">Status</label>
                            <Select
                                value={statusFilter}
                                onValueChange={(val: any) => setStatusFilter(val)}
                            >
                                <SelectTrigger className="h-7 w-[120px] text-xs">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="PENDING" className="text-xs">Pending</SelectItem>
                                    <SelectItem value="APPROVED" className="text-xs">Approved</SelectItem>
                                    <SelectItem value="REJECTED" className="text-xs">Rejected</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {/* Table Area */}
                    <div className="flex-1 mx-2 mb-2 bg-white rounded-xl border shadow-sm flex flex-col min-h-0">
                        <div className="flex-1 overflow-auto">
                            {isLoading ? (
                                <div className="p-8 text-center text-slate-500">Loading requests...</div>
                            ) : requests.length === 0 ? (
                                <div className="p-8 text-center text-slate-500">No {statusFilter.toLowerCase()} restore requests found.</div>
                            ) : (
                                <table className="w-full text-xs text-left relative">
                                    <thead className="bg-slate-50 text-slate-600 font-medium border-b sticky top-0 z-10 shadow-sm">
                                        <tr>
                                            <th className="px-3 py-2 whitespace-nowrap">Date</th>
                                            <th className="px-3 py-2 whitespace-nowrap">SO Number</th>
                                            <th className="px-3 py-2 whitespace-nowrap">Voice No</th>
                                            <th className="px-3 py-2 whitespace-nowrap">Customer</th>
                                            <th className="px-3 py-2 whitespace-nowrap">Address</th>
                                            <th className="px-3 py-2 whitespace-nowrap">OPMC</th>
                                            <th className="px-3 py-2 whitespace-nowrap">Requested By</th>
                                            <th className="px-3 py-2 whitespace-nowrap">Reason</th>
                                            <th className="px-3 py-2 whitespace-nowrap">Status</th>
                                            {statusFilter === 'PENDING' && <th className="px-3 py-2 text-right whitespace-nowrap">Actions</th>}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y text-[11px]">
                                        {requests.map(req => (
                                            <tr key={req.id} className="hover:bg-slate-50/50 transition-colors">
                                                <td className="px-3 py-1.5 text-slate-600 whitespace-nowrap">
                                                    {format(new Date(req.createdAt), "MMM d, HH:mm")}
                                                </td>
                                                <td className="px-3 py-1.5 font-mono font-medium text-slate-900 whitespace-nowrap">
                                                    {req.serviceOrder.soNum}
                                                </td>
                                                <td className="px-3 py-1.5 text-slate-600 whitespace-nowrap">
                                                    {req.serviceOrder.voiceNumber || '-'}
                                                </td>
                                                <td className="px-3 py-1.5 text-slate-600 max-w-[150px] truncate" title={req.serviceOrder.customerName || ''}>
                                                    {req.serviceOrder.customerName || '-'}
                                                </td>
                                                <td className="px-3 py-1.5 text-slate-600 max-w-[200px] truncate" title={req.serviceOrder.address || ''}>
                                                    {req.serviceOrder.address || '-'}
                                                </td>
                                                <td className="px-3 py-1.5 text-slate-600 whitespace-nowrap">
                                                    {req.serviceOrder.opmc.rtom}
                                                </td>
                                                <td className="px-3 py-1.5 whitespace-nowrap">
                                                    <div className="font-medium text-slate-900">{req.requestedBy.name}</div>
                                                    <div className="text-[9px] text-slate-500">@{req.requestedBy.username}</div>
                                                </td>
                                                <td className="px-3 py-1.5 text-slate-600 max-w-[200px] truncate" title={req.reason}>
                                                    {req.reason}
                                                </td>
                                                <td className="px-3 py-1.5 whitespace-nowrap">
                                                    <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold border ${req.status === 'PENDING' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                                                        req.status === 'APPROVED' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                                                            'bg-red-50 text-red-700 border-red-200'
                                                        }`}>
                                                        {req.status}
                                                    </span>
                                                </td>
                                                {statusFilter === 'PENDING' && (
                                                    <td className="px-3 py-1.5 text-right space-x-1 whitespace-nowrap">
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            className="h-6 text-[10px] px-2 border-green-200 text-green-700 hover:bg-green-50 hover:text-green-800"
                                                            onClick={() => openActionModal(req.id, 'APPROVE')}
                                                        >
                                                            Approve
                                                        </Button>
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            className="h-6 text-[10px] px-2 border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800"
                                                            onClick={() => openActionModal(req.id, 'REJECT')}
                                                        >
                                                            Reject
                                                        </Button>
                                                    </td>
                                                )}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>
                </div>

                {/* Confirm Action Modal */}
                <Dialog open={actionModal.isOpen} onOpenChange={closeModal}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>
                                {actionModal.action === 'APPROVE' ? 'Approve Request' : 'Reject Request'}
                            </DialogTitle>
                            <DialogDescription>
                                Are you sure you want to {actionModal.action?.toLowerCase()} this restore request?
                                {actionModal.action === 'APPROVE' && " This will move the Service Order back to 'IN PROGRESS'."}
                            </DialogDescription>
                        </DialogHeader>

                        <div className="py-2">
                            <label className="text-sm font-medium text-slate-700 mb-1 block">Comment (Optional)</label>
                            <Textarea
                                value={actionModal.comment}
                                onChange={(e) => setActionModal(prev => ({ ...prev, comment: e.target.value }))}
                                placeholder="Add a note..."
                            />
                        </div>

                        <DialogFooter>
                            <Button variant="outline" onClick={closeModal}>Cancel</Button>
                            <Button
                                onClick={handleConfirmAction}
                                variant={actionModal.action === 'REJECT' ? 'destructive' : 'default'}
                                disabled={actionMutation.isPending}
                            >
                                {actionMutation.isPending ? 'Processing...' : 'Confirm'}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

            </main>
        </div>
    );
}

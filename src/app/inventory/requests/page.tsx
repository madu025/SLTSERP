"use client";

import React, { useState, useEffect } from 'react';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Check, X, ArrowRight, User as UserIcon, Printer, Calendar, AlertCircle } from "lucide-react";
import { toast } from 'sonner';
import { processStockRequestAction } from '@/actions/inventory-actions';
import { generateGatePassPDF } from '@/utils/pdfGenerator';
import { cn } from "@/lib/utils";

export default function RequestsPage() {
    const queryClient = useQueryClient();
    const [activeTab, setActiveTab] = useState<'all' | 'pending'>('all');
    const [user, setUser] = useState<any>(null);

    // Approval State
    const [selectedRequest, setSelectedRequest] = useState<any>(null);
    const [approvalMode, setApprovalMode] = useState(false);
    const [allocation, setAllocation] = useState<Record<string, number>>({});
    const [approverRemarks, setApproverRemarks] = useState("");

    useEffect(() => {
        const stored = localStorage.getItem('user');
        if (stored) setUser(JSON.parse(stored));
    }, []);

    // Fetch Requests (Internal Store-to-Store Transfers ONLY)
    // Procurement requests (toStoreId = NULL) go to OSP Managers > Approvals
    const { data: requests = [], isLoading } = useQuery({
        queryKey: ['requests'],
        queryFn: async () => {
            // Filter: Only fetch requests with toStoreId (internal transfers)
            // Procurement requests have toStoreId = NULL and go through OSP approval workflow
            const res = await fetch(`/api/inventory/requests`);
            const allRequests = await res.json();
            // Client-side filter for now (can optimize with API param later)
            return allRequests.filter((r: any) => r.toStoreId !== null);
        }
    });

    const filteredRequests = requests.filter((r: any) => {
        if (activeTab === 'pending') return r.status === 'PENDING';
        return true;
    });

    const approvalMutation = useMutation({
        mutationFn: async ({ action }: { action: 'APPROVE' | 'REJECT' }) => {
            const body: any = {
                requestId: selectedRequest.id,
                action,
                remarks: approverRemarks,
                userId: user?.id
            };

            if (action === 'APPROVE') {
                body.allocation = selectedRequest.items.map((i: any) => ({
                    itemId: i.itemId,
                    approvedQty: allocation[i.itemId] ?? i.requestedQty
                }));
            }

            return await processStockRequestAction(body);
        },
        onSuccess: (result) => {
            if (result.success) {
                toast.success("Request processed successfully");
                setApprovalMode(false);
                setSelectedRequest(null);
                setApproverRemarks("");
                queryClient.invalidateQueries({ queryKey: ['requests'] });
            } else {
                toast.error(result.error || "Failed to process request");
            }
        },
        onError: () => toast.error("Failed to process request")
    });

    const getPriorityColor = (priority: string) => {
        switch (priority) {
            case 'URGENT': return 'bg-red-100 text-red-700 border-red-200';
            case 'HIGH': return 'bg-orange-100 text-orange-700 border-orange-200';
            case 'MEDIUM': return 'bg-blue-100 text-blue-700 border-blue-200';
            case 'LOW': return 'bg-slate-100 text-slate-700 border-slate-200';
            default: return 'bg-slate-100 text-slate-700 border-slate-200';
        }
    };

    return (
        <div className="h-screen flex bg-slate-50 overflow-hidden">
            <Sidebar />
            <main className="flex-1 flex flex-col min-w-0 h-full">
                <Header />
                <div className="flex-1 flex flex-col min-h-0 overflow-hidden p-4 md:p-8">
                    <div className="max-w-7xl mx-auto w-full flex flex-col h-full space-y-4">

                        <div className="flex justify-between items-center flex-none">
                            <div>
                                <h1 className="text-2xl font-bold text-slate-900">Request Management</h1>
                                <p className="text-sm text-slate-500">
                                    Manage Internal Transfers & External Purchases
                                </p>
                            </div>
                        </div>

                        {/* Tabs */}
                        <div className="flex space-x-1 bg-slate-200/50 p-1 rounded-lg w-fit flex-none">
                            <button
                                onClick={() => setActiveTab('all')}
                                className={cn("px-4 py-1.5 text-xs font-medium rounded-md transition-all", activeTab === 'all' ? "bg-white shadow-sm text-blue-600" : "text-slate-500 hover:text-slate-700")}
                            >
                                All Requests
                            </button>
                            <button
                                onClick={() => setActiveTab('pending')}
                                className={cn("px-4 py-1.5 text-xs font-medium rounded-md transition-all", activeTab === 'pending' ? "bg-white shadow-sm text-blue-600" : "text-slate-500 hover:text-slate-700")}
                            >
                                Pending Approval
                            </button>
                        </div>

                        {/* List */}
                        <div className="flex-1 bg-white rounded-xl border shadow-sm overflow-hidden flex flex-col">
                            <div className="overflow-auto flex-1">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-slate-50 text-slate-600 font-bold border-b sticky top-0 z-10">
                                        <tr>
                                            <th className="px-4 py-3 w-32">Request ID</th>
                                            <th className="px-4 py-3 w-32">Priority</th>
                                            <th className="px-4 py-3">Type</th>
                                            <th className="px-4 py-3">Store</th>
                                            <th className="px-4 py-3">Requested By</th>
                                            <th className="px-4 py-3">Required Date</th>
                                            <th className="px-4 py-3">Status</th>
                                            <th className="px-4 py-3 text-right">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                        {isLoading ? (
                                            <tr><td colSpan={8} className="p-8 text-center text-slate-400">Loading...</td></tr>
                                        ) : filteredRequests.length === 0 ? (
                                            <tr><td colSpan={8} className="p-8 text-center text-slate-400">No requests found.</td></tr>
                                        ) : (
                                            filteredRequests.map((r: any) => (
                                                <tr key={r.id} className="hover:bg-slate-50">
                                                    <td className="px-4 py-3 font-mono text-slate-500 text-xs">{r.requestNr}</td>
                                                    <td className="px-4 py-3">
                                                        <Badge variant="outline" className={cn("text-[10px] px-2 py-0.5", getPriorityColor(r.priority))}>
                                                            {r.priority}
                                                        </Badge>
                                                    </td>
                                                    <td className="px-4 py-3 text-xs font-medium text-slate-600">
                                                        {r.toStoreId ? 'Internal Transfer' : 'SLT Purchase'}
                                                    </td>
                                                    <td className="px-4 py-3 font-semibold text-slate-800">
                                                        {r.fromStore.name}
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <div className="flex items-center gap-1.5 text-xs">
                                                            <div className="h-5 w-5 rounded-full bg-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-500">
                                                                {r.requestedBy.name.charAt(0)}
                                                            </div>
                                                            {r.requestedBy.name}
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3 text-xs text-slate-500">
                                                        {r.requiredDate ? new Date(r.requiredDate).toLocaleDateString() : '-'}
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <Badge variant="outline" className={cn(
                                                            "text-xs px-2",
                                                            r.status === 'PENDING' ? 'border-amber-200 bg-amber-50 text-amber-700' :
                                                                r.status === 'APPROVED' ? 'border-blue-200 bg-blue-50 text-blue-700' :
                                                                    r.status === 'COMPLETED' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' :
                                                                        'border-gray-200 bg-gray-50 text-gray-600'
                                                        )}>
                                                            {r.status}
                                                        </Badge>
                                                    </td>
                                                    <td className="px-4 py-3 text-right">
                                                        {r.status === 'PENDING' ? (
                                                            <Button size="sm" className="h-7 text-xs bg-blue-600" onClick={() => { setSelectedRequest(r); setApprovalMode(true); }}>
                                                                Review
                                                            </Button>
                                                        ) : (
                                                            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => { setSelectedRequest(r); setApprovalMode(false); }}>
                                                                Details
                                                            </Button>
                                                        )}
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

                {/* Approval/Detail Modal */}
                <Dialog open={!!selectedRequest} onOpenChange={(o) => { if (!o) { setSelectedRequest(null); setApproverRemarks(""); } }}>
                    <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                            <div className="flex items-start justify-between">
                                <div>
                                    <DialogTitle className="text-xl flex items-center gap-3">
                                        Request {selectedRequest?.requestNr}
                                        <Badge variant="outline" className={getPriorityColor(selectedRequest?.priority || 'MEDIUM')}>
                                            {selectedRequest?.priority}
                                        </Badge>
                                    </DialogTitle>
                                    <DialogDescription className="mt-1">
                                        Requested by {selectedRequest?.requestedBy?.name} on {new Date(selectedRequest?.createdAt).toLocaleDateString()}
                                    </DialogDescription>
                                </div>
                                <div className="text-right">
                                    <div className="text-sm font-semibold text-slate-700">Required Date</div>
                                    <div className="text-sm text-slate-500">
                                        {selectedRequest?.requiredDate ? new Date(selectedRequest.requiredDate).toLocaleDateString() : 'N/A'}
                                    </div>
                                </div>
                            </div>
                        </DialogHeader>

                        {selectedRequest && (
                            <div className="space-y-6">
                                {/* Details Card */}
                                <div className="bg-slate-50 p-4 rounded-lg border border-slate-100 grid grid-cols-2 gap-4 text-sm">
                                    <div>
                                        <div className="text-xs text-slate-500 uppercase font-semibold">Purpose</div>
                                        <div className="mt-1 text-slate-700 whitespace-pre-wrap">{selectedRequest.purpose || 'No purpose specified'}</div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-xs text-slate-500 uppercase font-semibold">Store Details</div>
                                        <div className="mt-1 text-slate-700">
                                            From: <strong>{selectedRequest.fromStore.name}</strong>
                                            <br />
                                            Type: {selectedRequest.toStoreId ? 'Internal Transfer' : 'External Purchase (SLT)'}
                                        </div>
                                    </div>
                                </div>

                                {/* Items Table */}
                                <div className="border rounded-lg overflow-hidden">
                                    <table className="w-full text-sm text-left">
                                        <thead className="bg-slate-100 border-b text-slate-600">
                                            <tr>
                                                <th className="px-4 py-2 w-12">#</th>
                                                <th className="px-4 py-2">Item</th>
                                                <th className="px-4 py-2">Remarks</th>
                                                <th className="px-4 py-2 text-right">Req. Qty</th>
                                                <th className="px-4 py-2 text-right w-32">
                                                    {approvalMode ? 'Approved Qty' : 'Approved'}
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y">
                                            {selectedRequest.items.map((item: any, idx: number) => (
                                                <tr key={item.id} className="bg-white">
                                                    <td className="px-4 py-2 text-slate-500 text-xs">{idx + 1}</td>
                                                    <td className="px-4 py-2">
                                                        <div className="font-medium text-slate-900">{item.item.name}</div>
                                                        <div className="text-xs text-slate-500 font-mono">{item.item.code} • {item.item.unit}</div>
                                                    </td>
                                                    <td className="px-4 py-2 text-xs text-slate-600 italic">
                                                        {item.remarks || '-'}
                                                    </td>
                                                    <td className="px-4 py-2 text-right font-medium">
                                                        {item.requestedQty}
                                                    </td>
                                                    <td className="px-4 py-2 text-right">
                                                        {approvalMode ? (
                                                            <Input
                                                                type="number"
                                                                className="h-8 w-24 text-right ml-auto text-sm border-blue-200 focus:border-blue-500"
                                                                defaultValue={item.requestedQty} // Default to requested
                                                                onChange={(e) => setAllocation(prev => ({ ...prev, [item.itemId]: parseFloat(e.target.value) }))}
                                                            />
                                                        ) : (
                                                            <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
                                                                {item.approvedQty}
                                                            </Badge>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>

                                {/* Approver Section */}
                                {approvalMode && (
                                    <div className="space-y-2 bg-yellow-50 p-4 rounded-lg border border-yellow-100">
                                        <label className="text-sm font-semibold text-slate-700">Approver Remarks / Notes</label>
                                        <Textarea
                                            placeholder="Enter approval notes or rejection reason..."
                                            className="bg-white"
                                            value={approverRemarks}
                                            onChange={(e) => setApproverRemarks(e.target.value)}
                                        />
                                    </div>
                                )}

                                {selectedRequest.remarks && !approvalMode && (
                                    <div className="space-y-1 bg-slate-50 p-4 rounded-lg">
                                        <div className="text-xs font-semibold text-slate-500 uppercase">Approver Remarks</div>
                                        <div className="text-sm text-slate-700">{selectedRequest.remarks}</div>
                                    </div>
                                )}
                            </div>
                        )}

                        <DialogFooter className="mt-4 gap-2">
                            <Button variant="outline" onClick={() => setSelectedRequest(null)}>Close</Button>
                            {approvalMode && (
                                <>
                                    <Button
                                        variant="destructive"
                                        onClick={() => approvalMutation.mutate({ action: 'REJECT' })}
                                        disabled={approvalMutation.isPending}
                                    >
                                        Reject Request
                                    </Button>
                                    <Button
                                        className="bg-emerald-600 hover:bg-emerald-700 text-white"
                                        onClick={() => approvalMutation.mutate({ action: 'APPROVE' })}
                                        disabled={approvalMutation.isPending}
                                    >
                                        {approvalMutation.isPending ? 'Processing...' : 'Approve & Create Order'}
                                    </Button>
                                </>
                            )}
                        </DialogFooter>

                        {/* Print Button for Approved Requests */}
                        {selectedRequest?.status !== 'PENDING' && !approvalMode && (
                            <div className="flex justify-start pt-2">
                                <Button
                                    variant="outline"
                                    onClick={() => generateGatePassPDF(selectedRequest)}
                                    className="gap-2 text-xs"
                                >
                                    <Printer className="w-4 h-4" /> Print Document
                                </Button>
                            </div>
                        )}
                    </DialogContent>
                </Dialog>
            </main>
        </div>
    );
}

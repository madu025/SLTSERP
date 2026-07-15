"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Eye, Edit, X, Clock, AlertTriangle, FileText } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";

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

            {/* Details Drawer - Premium Design */}
            <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
                <DialogContent 
                    showCloseButton={false}
                    className="fixed !inset-y-0 !right-0 !top-0 !left-auto !translate-x-0 !translate-y-0 !h-full w-[80vw] !max-w-none flex flex-col !p-0 !gap-0 overflow-hidden bg-white dark:bg-slate-950 border-l border-slate-200 dark:border-slate-800 shadow-2xl z-50 duration-300 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right !rounded-none"
                >
                    {selectedRequest && (
                        <>
                            {/* Header */}
                            <div className="relative p-6 pb-4 flex-shrink-0 bg-slate-50 dark:bg-slate-900/60 border-b border-slate-200/60 dark:border-slate-800/60">
                                <div className="absolute top-0 right-0 p-5">
                                    <button 
                                        type="button"
                                        onClick={() => setShowDetailsDialog(false)} 
                                        className="p-2 rounded-full hover:bg-slate-200/50 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>

                                <div className="space-y-1">
                                    <div className="flex items-center gap-2">
                                        <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">My Requests</span>
                                        <Badge className="bg-blue-50 text-blue-600 border border-blue-200 dark:bg-blue-955/20 text-[9px] px-2 py-0 font-bold rounded-full">
                                            {selectedRequest.requestNr}
                                        </Badge>
                                    </div>
                                    <h2 className="text-xl font-black text-slate-900 dark:text-white leading-tight">
                                        Request Details
                                    </h2>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">
                                        Track the workflow progress and specifications of your submitted material request.
                                    </p>
                                </div>
                            </div>

                            {/* Body Split */}
                            <div className="flex-1 flex overflow-hidden bg-slate-50/50 dark:bg-slate-950/20">
                                {/* Left Panel */}
                                <div className="w-[65%] h-full overflow-y-auto p-6 space-y-6 border-r border-slate-200/50 dark:border-slate-800/50 [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-slate-200 dark:[&::-webkit-scrollbar-thumb]:bg-slate-800/60 [&::-webkit-scrollbar-thumb]:rounded-full">
                                    {/* Info Grid */}
                                    <div className="grid grid-cols-3 gap-4">
                                        <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 p-4 rounded-xl shadow-sm">
                                            <span className="text-[9px] font-bold text-slate-400 block uppercase">Source Type</span>
                                            <span className="font-bold text-slate-850 dark:text-slate-200 text-xs mt-1 block">{selectedRequest.sourceType || 'SLT'}</span>
                                        </div>
                                        <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 p-4 rounded-xl shadow-sm">
                                            <span className="text-[9px] font-bold text-slate-400 block uppercase">Priority Level</span>
                                            <Badge className="mt-1 bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-955/20 text-[9px] font-bold">
                                                {selectedRequest.priority || 'MEDIUM'}
                                            </Badge>
                                        </div>
                                        <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 p-4 rounded-xl shadow-sm">
                                            <span className="text-[9px] font-bold text-slate-400 block uppercase">Submission Date</span>
                                            <span className="font-bold text-slate-850 dark:text-slate-200 text-xs mt-1 block">{new Date(selectedRequest.createdAt).toLocaleDateString()}</span>
                                        </div>
                                    </div>

                                    {/* Remarks if Rejected */}
                                    {selectedRequest.remarks && (
                                        <div className="p-4 bg-rose-50 dark:bg-rose-955/15 border border-rose-200 dark:border-rose-900 rounded-xl flex gap-3 text-rose-800 dark:text-rose-400">
                                            <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
                                            <div className="space-y-1">
                                                <span className="text-[10px] font-black uppercase tracking-wider block">Approval / Rejection Remarks</span>
                                                <p className="text-xs leading-normal">{selectedRequest.remarks}</p>
                                            </div>
                                        </div>
                                    )}

                                    {/* Materials Table */}
                                    <div className="space-y-3">
                                        <h3 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-2">
                                            <FileText className="w-3.5 h-3.5 text-blue-500" /> Requested Items List
                                        </h3>
                                        <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-x-auto shadow-sm bg-white dark:bg-slate-950">
                                            <table className="w-full text-xs text-left border-collapse">
                                                <thead className="bg-slate-50/80 dark:bg-slate-900/80 text-slate-500 dark:text-slate-400 font-bold border-b border-slate-200 dark:border-slate-800 text-[10px] uppercase tracking-wider">
                                                    <tr>
                                                        <th className="px-4 py-3">Material Description</th>
                                                        <th className="px-4 py-3 text-right">Requested Qty</th>
                                                        <th className="px-4 py-3">Make / Model</th>
                                                        <th className="px-4 py-3">Suggested Vendor</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                                    {selectedRequest.items?.map((item: RequestItemData) => (
                                                        <tr key={item.id} className="hover:bg-slate-50/30 dark:hover:bg-slate-900/20 transition-colors">
                                                            <td className="px-4 py-3 font-bold text-slate-800 dark:text-slate-250">{item.item?.name}</td>
                                                            <td className="px-4 py-3 text-right font-black text-slate-900 dark:text-white font-mono">{item.requestedQty} {item.item?.unit}</td>
                                                            <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{item.make || '-'} / {item.model || '-'}</td>
                                                            <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{item.suggestedVendor || '-'}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </div>

                                {/* Right Panel */}
                                <div className="w-[35%] h-full overflow-y-auto p-6 space-y-6 bg-slate-50/50 dark:bg-slate-900/10 border-l border-slate-200/50 dark:border-slate-800/50">
                                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
                                        <h4 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                                            <Clock className="w-3.5 h-3.5 text-blue-500" /> Status Overview
                                        </h4>
                                        <div className="space-y-3.5 text-xs">
                                            <div className="pb-3 border-b border-slate-100 dark:border-slate-800/80">
                                                <span className="text-[9px] font-bold text-slate-400 block uppercase">Workflow Stage</span>
                                                <span className="font-bold text-slate-800 dark:text-slate-200 text-xs block mt-1">{selectedRequest.workflowStage}</span>
                                            </div>
                                            <div>
                                                <span className="text-[9px] font-bold text-slate-400 block uppercase">Current Status</span>
                                                <div className="mt-1">{getStatusBadge(selectedRequest.status, selectedRequest.workflowStage)}</div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Footer */}
                            <div className="px-6 py-4 bg-white dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 flex justify-end items-center flex-shrink-0 gap-3">
                                <Button variant="outline" onClick={() => setShowDetailsDialog(false)} className="h-9 px-4 text-xs font-bold rounded-xl border-slate-200 hover:bg-slate-50 text-slate-700">
                                    Close Details
                                </Button>
                            </div>
                        </>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}

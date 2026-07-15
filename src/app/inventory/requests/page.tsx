"use client";

import React, { useState, useEffect } from 'react';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Plus, ClipboardList, Info, Building2, User, Check, Ban, DollarSign, Package, Clock, X, AlertCircle, PenSquare, Tag, TrendingUp, Paperclip, FileText } from "lucide-react";
import { toast } from 'sonner';
import { processStockRequestAction } from '@/actions/inventory-actions';
import { cn } from "@/lib/utils";

interface User {
    id: string;
    name: string;
    role: string;
}

interface InventoryItem {
    id: string;
    itemId: string;
    item: { name: string; code?: string; unit: string };
    requestedQty: number;
    approvedQty?: number;
    remarks?: string;
}

interface InventoryRequest {
    id: string;
    requestNr: string;
    priority: string;
    status: string;
    fromStoreId: string;
    fromStore: { name: string };
    toStoreId?: string | null;
    requestedBy: { name: string };
    requiredDate?: string;
    createdAt: string;
    purpose?: string;
    remarks?: string;
    sltReferenceId?: string | null;
    workflowStage?: string | null;
    items: InventoryItem[];
}

export default function RequestsPage() {
    const queryClient = useQueryClient();
    const router = useRouter();
    const [activeTab, setActiveTab] = useState<'all' | 'pending'>('all');
    const [user] = useState<User | null>(() => {
        if (typeof window !== 'undefined') {
            const stored = localStorage.getItem('user');
            return stored ? JSON.parse(stored) : null;
        }
        return null;
    });

    // Approval State
    const [selectedRequest, setSelectedRequest] = useState<InventoryRequest | null>(null);
    const [approvalMode, setApprovalMode] = useState(false);
    const [allocation, setAllocation] = useState<Record<string, number>>({});
    const [approverRemarks, setApproverRemarks] = useState("");
    const [stockLevels, setStockLevels] = useState<Record<string, number>>({});

    // Fetch stock levels for all stores to display available stock live
    useEffect(() => {
        if (!selectedRequest) return;
        
        const fetchStock = async () => {
            try {
                const res = await fetch(`/api/inventory/stock?storeId=all&_t=${Date.now()}`);
                if (res.ok) {
                    const data = await res.json();
                    const levels: Record<string, number> = {};
                    data.forEach((stock: { store?: { type?: string } | null; itemId: string; quantity: number }) => {
                        // Sum up across all stores, but prioritize MAIN store value if present
                        if (stock.store?.type === 'MAIN' || !levels[stock.itemId]) {
                            levels[stock.itemId] = stock.quantity;
                        }
                    });
                    setStockLevels(levels);
                }
            } catch (err) {
                console.error("Failed to fetch stock levels:", err);
            }
        };
        fetchStock();
    }, [selectedRequest]);


    // Fetch Requests (Internal Store-to-Store Transfers ONLY)
    // Procurement requests (toStoreId = NULL) go to OSP Managers > Approvals
    const { data: requests = [], isLoading } = useQuery<InventoryRequest[]>({
        queryKey: ['requests'],
        queryFn: async () => {
            const res = await fetch(`/api/inventory/requests`);
            const allRequests: InventoryRequest[] = await res.json();
            return allRequests;
        }
    });

    const filteredRequests = requests.filter((r) => {
        if (activeTab === 'pending') return r.status === 'PENDING';
        return true;
    });

    const approvalMutation = useMutation({
        mutationFn: async ({ action }: { action: 'APPROVE' | 'REJECT' }) => {
            if (!selectedRequest) return;

            const body = {
                requestId: selectedRequest.id,
                action,
                remarks: approverRemarks,
                userId: user?.id,
                allocation: action === 'APPROVE' ? selectedRequest.items.map((i) => ({
                    itemId: i.itemId,
                    approvedQty: allocation[i.itemId] ?? i.requestedQty
                })) : undefined
            };

            return await processStockRequestAction(body);
        },
        onSuccess: (result) => {
            if (result && result.success) {
                toast.success("Request processed successfully");
                setApprovalMode(false);
                setSelectedRequest(null);
                setApproverRemarks("");
                queryClient.invalidateQueries({ queryKey: ['requests'] });
            } else {
                toast.error(result?.error || "Failed to process request");
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
        <div className="erp-page-wrapper flex-row overflow-hidden">
            <Sidebar />
            <main className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
                <Header />
                <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
                    <div className="max-w-7xl mx-auto space-y-4">

                        <div className="flex justify-between items-center flex-none">
                            <div className="space-y-0.5">
                                <h1 className="text-xl font-black text-slate-900 tracking-tight">Stock Requests</h1>
                                <p className="text-xs text-slate-500">
                                    Manage Internal Transfers &amp; External Purchases
                                </p>
                            </div>
                            <div className="flex gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => router.push('/inventory/requests/my-requests')}
                                    className="h-8 text-xs font-semibold flex items-center gap-1.5 border-slate-200 text-slate-700 hover:bg-slate-50"
                                >
                                    <ClipboardList className="w-3.5 h-3.5" />
                                    My Requests
                                </Button>
                                <Button
                                    size="sm"
                                    onClick={() => router.push('/inventory/requests/create')}
                                    className="h-8 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-md shadow-sm flex items-center gap-1.5"
                                >
                                    <Plus className="w-3.5 h-3.5" />
                                    New Request
                                </Button>
                            </div>
                        </div>

                        {/* Tabs */}
                        <div className="flex space-x-1 bg-slate-200/40 p-1 rounded-lg w-fit flex-none border border-slate-200/60">
                            <button
                                onClick={() => setActiveTab('all')}
                                className={cn("px-3 py-1 text-xs font-semibold rounded transition-all", activeTab === 'all' ? "bg-white shadow-sm text-blue-600" : "text-slate-500 hover:text-slate-700")}
                            >
                                All Requests
                            </button>
                            <button
                                onClick={() => setActiveTab('pending')}
                                className={cn("px-3 py-1 text-xs font-semibold rounded transition-all", activeTab === 'pending' ? "bg-white shadow-sm text-blue-600" : "text-slate-500 hover:text-slate-700")}
                            >
                                Pending Approval
                            </button>
                        </div>

                        {/* List */}
                        <div className="erp-table-container flex flex-col bg-white overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="w-full text-xs text-left border-collapse">
                                    <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200 sticky top-0 z-10">
                                        <tr>
                                            <th className="px-4 py-2 w-32">Request ID</th>
                                            <th className="px-3 py-2 w-32">Priority</th>
                                            <th className="px-3 py-2">Type</th>
                                            <th className="px-3 py-2">Store</th>
                                            <th className="px-3 py-2">Requested By</th>
                                            <th className="px-3 py-2">Required Date</th>
                                            <th className="px-3 py-2">Status</th>
                                            <th className="px-4 py-2 text-right">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {isLoading ? (
                                            <tr><td colSpan={8} className="p-8 text-center text-slate-400 font-semibold">Loading...</td></tr>
                                        ) : filteredRequests.length === 0 ? (
                                            <tr><td colSpan={8} className="p-8 text-center text-slate-400 font-semibold">No requests found.</td></tr>
                                        ) : (
                                            filteredRequests.map((r: InventoryRequest) => (
                                                <tr key={r.id} className="hover:bg-slate-50/50 transition-colors duration-150">
                                                    <td className="px-4 py-1.5 font-mono text-slate-600">{r.requestNr}</td>
                                                    <td className="px-3 py-1.5">
                                                        <Badge variant="outline" className={cn("text-[9px] px-1.5 py-0", getPriorityColor(r.priority))}>
                                                            {r.priority}
                                                        </Badge>
                                                    </td>
                                                    <td className="px-3 py-1.5 font-medium text-slate-600">
                                                        {r.toStoreId ? 'Internal Transfer' : 'External Purchase'}
                                                    </td>
                                                    <td className="px-3 py-1.5 font-semibold text-slate-900">
                                                        {r.fromStore.name}
                                                    </td>
                                                    <td className="px-3 py-1.5 text-slate-700">
                                                        <div className="flex items-center gap-1.5">
                                                            <div className="h-4 w-4 rounded-full bg-slate-200 flex items-center justify-center text-[9px] font-bold text-slate-500">
                                                                {r.requestedBy.name.charAt(0)}
                                                            </div>
                                                            {r.requestedBy.name}
                                                        </div>
                                                    </td>
                                                    <td className="px-3 py-1.5 text-slate-500">
                                                        {r.requiredDate ? new Date(r.requiredDate).toLocaleDateString() : '-'}
                                                    </td>
                                                    <td className="px-3 py-1.5">
                                                        <Badge variant="outline" className={cn(
                                                            "text-[10px] px-1.5 py-0 font-semibold uppercase",
                                                            r.status === 'PENDING' ? 'border-amber-200 bg-amber-50 text-amber-700' :
                                                                r.status === 'APPROVED' ? 'border-blue-200 bg-blue-50 text-blue-700' :
                                                                    r.status === 'COMPLETED' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' :
                                                                        'border-gray-200 bg-gray-50 text-gray-600'
                                                        )}>
                                                            {r.status}
                                                        </Badge>
                                                    </td>
                                                    <td className="px-4 py-1.5 text-right">
                                                        {r.status === 'PENDING' ? (
                                                            <Button size="sm" className="h-7 px-2.5 text-xs bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-md" onClick={() => { setSelectedRequest(r); setApprovalMode(true); }}>
                                                                Review
                                                            </Button>
                                                        ) : (
                                                            <Button size="sm" variant="ghost" className="h-7 px-2.5 text-xs text-slate-500 hover:text-slate-800" onClick={() => { setSelectedRequest(r); setApprovalMode(false); }}>
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

                {/* Approval/Detail Modal - Premium Enterprise Right-Side Drawer Redesign */}
                <Dialog open={!!selectedRequest} onOpenChange={(o) => { if (!o) { setSelectedRequest(null); setApproverRemarks(""); } }}>
                    <DialogContent 
                        showCloseButton={false}
                        className="fixed !inset-y-0 !right-0 !top-0 !left-auto !translate-x-0 !translate-y-0 !h-full w-[80vw] !max-w-none flex flex-col !p-0 !gap-0 overflow-hidden bg-white dark:bg-slate-950 border-l border-slate-200 dark:border-slate-800 shadow-2xl z-50 duration-300 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right !rounded-none"
                    >
                        
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
                                        <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Material Request</span>
                                        <Badge className="bg-blue-50/80 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 border border-blue-200 dark:border-blue-800/50 text-[9px] px-2 py-0 font-bold rounded-full">
                                            Pending Approval
                                        </Badge>
                                        <Badge className="bg-red-600 text-white border-none font-bold text-[9px] px-2 py-0 rounded-full flex items-center gap-1 shadow-sm">
                                            <AlertCircle className="w-2.5 h-2.5" /> URGENT
                                        </Badge>
                                    </div>
                                    <h2 className="text-xl font-black text-slate-900 dark:text-white leading-tight flex items-center gap-2">
                                        {selectedRequest?.requestNr}
                                    </h2>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">
                                        Requested by <span className="font-semibold text-slate-700 dark:text-slate-300">{selectedRequest?.requestedBy?.name}</span> • 02 Jul 2026 • Required 03 Jul 2026
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Split Panels Body */}
                        <div className="flex-1 flex overflow-hidden bg-slate-50/50 dark:bg-slate-950/20">
                            
                            {/* LEFT PANEL (65% Scrollable) */}
                            <div className="w-[65%] h-full overflow-y-auto p-6 space-y-6 border-r border-slate-200/50 dark:border-slate-800/50 [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-slate-200 dark:[&::-webkit-scrollbar-thumb]:bg-slate-800/60 [&::-webkit-scrollbar-thumb]:rounded-full">
                                {selectedRequest && (
                                    <>
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
                                                        <span className="font-bold text-slate-800 dark:text-slate-200 text-xs truncate block">{selectedRequest.purpose || 'OSP_FTTH'}</span>
                                                    </div>
                                                </div>
                                                <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200/60 dark:border-slate-800 shadow-sm flex items-center gap-2.5">
                                                    <Building2 className="w-4 h-4 text-slate-400" />
                                                    <div className="min-w-0">
                                                        <span className="text-[9px] font-bold text-slate-400 block uppercase">Store</span>
                                                        <span className="font-bold text-slate-800 dark:text-slate-200 text-xs truncate block">{selectedRequest.fromStore.name}</span>
                                                    </div>
                                                </div>
                                                <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200/60 dark:border-slate-800 shadow-sm flex items-center gap-2.5">
                                                    <ClipboardList className="w-4 h-4 text-slate-400" />
                                                    <div className="min-w-0">
                                                        <span className="text-[9px] font-bold text-slate-400 block uppercase">Project</span>
                                                        <span className="font-bold text-slate-800 dark:text-slate-200 text-xs truncate block font-sans">FTTH Phase 04</span>
                                                    </div>
                                                </div>
                                                <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200/60 dark:border-slate-800 shadow-sm flex items-center gap-2.5">
                                                    <User className="w-4 h-4 text-slate-400" />
                                                    <div className="min-w-0">
                                                        <span className="text-[9px] font-bold text-slate-400 block uppercase">Department</span>
                                                        <span className="font-bold text-slate-800 dark:text-slate-200 text-xs truncate block">Network Deployment</span>
                                                    </div>
                                                </div>
                                                <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200/60 dark:border-slate-800 shadow-sm flex items-center gap-2.5">
                                                    <DollarSign className="w-4 h-4 text-emerald-500" />
                                                    <div className="min-w-0">
                                                        <span className="text-[9px] font-bold text-slate-400 block uppercase">Budget</span>
                                                        <span className="font-bold text-slate-800 dark:text-slate-200 text-xs truncate block">LKR 2,500,000.00</span>
                                                    </div>
                                                </div>
                                                <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200/60 dark:border-slate-800 shadow-sm flex items-center gap-2.5">
                                                    <AlertCircle className="w-4 h-4 text-red-500" />
                                                    <div className="min-w-0">
                                                        <span className="text-[9px] font-bold text-slate-400 block uppercase">Priority</span>
                                                        <Badge className="bg-red-500/10 text-red-600 border border-red-500/20 text-[9px] font-bold px-2 py-0 rounded">URGENT</Badge>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Items Table */}
                                        <div className="space-y-3">
                                            <h3 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-2">
                                                <Package className="w-3.5 h-3.5 text-blue-500" /> Requested Items
                                            </h3>
                                            <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-x-auto shadow-sm bg-white dark:bg-slate-950">
                                                <table className="w-full text-xs text-left border-collapse">
                                                    <thead className="bg-slate-50/85 dark:bg-slate-900/85 text-slate-500 dark:text-slate-400 font-bold border-b border-slate-200 dark:border-slate-800 text-[10px] uppercase tracking-wider sticky top-0 z-10 backdrop-blur">
                                                        <tr>
                                                            <th className="px-4 py-3 w-12 text-center">#</th>
                                                            <th className="px-4 py-3">Item Name</th>
                                                            <th className="px-4 py-3">Item Code</th>
                                                            <th className="px-4 py-3 text-right">Requested</th>
                                                            <th className="px-4 py-3 text-right">Available</th>
                                                            <th className="px-4 py-3 text-right w-32">Approved</th>
                                                            <th className="px-4 py-3 text-center">Unit</th>
                                                            <th className="px-4 py-3 text-center w-16">Remarks</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                                        {selectedRequest.items.map((item: InventoryItem, idx: number) => {
                                                            const liveStock = stockLevels[item.itemId] ?? 0;
                                                            return (
                                                                <tr key={item.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-900/40 transition-colors duration-150 group">
                                                                    <td className="px-4 py-3.5 text-center text-slate-400 font-bold font-mono">{idx + 1}</td>
                                                                    <td className="px-4 py-3.5">
                                                                        <div className="flex items-center gap-3">
                                                                            <div className="w-8 h-8 bg-slate-100 dark:bg-slate-900 rounded-lg flex items-center justify-center border border-slate-200 dark:border-slate-800 font-black text-slate-500 dark:text-slate-400 text-[10px]">
                                                                                {item.item.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                                                                            </div>
                                                                            <div className="font-bold text-slate-900 dark:text-white text-xs">{item.item.name}</div>
                                                                        </div>
                                                                    </td>
                                                                    <td className="px-4 py-3.5 font-mono text-slate-500 dark:text-slate-400 font-semibold">{item.item.code || 'NO-CODE'}</td>
                                                                    <td className="px-4 py-3.5 text-right font-bold text-slate-800 dark:text-slate-200">{item.requestedQty.toLocaleString()}</td>
                                                                    <td className={cn(
                                                                        "px-4 py-3.5 text-right font-bold",
                                                                        liveStock === 0 ? "text-rose-600 dark:text-rose-500" :
                                                                        liveStock < item.requestedQty ? "text-amber-600 dark:text-amber-500" :
                                                                        "text-emerald-600 dark:text-emerald-500"
                                                                    )}>
                                                                        {liveStock.toLocaleString()}
                                                                    </td>
                                                                    <td className="px-4 py-3.5 text-right">
                                                                        {approvalMode ? (
                                                                            <Input
                                                                                type="number"
                                                                                className="h-8 w-24 text-right ml-auto text-xs font-bold border-blue-200 focus-visible:ring-blue-500 rounded-lg shadow-sm"
                                                                                defaultValue={item.requestedQty}
                                                                                onChange={(e) => setAllocation(prev => ({ ...prev, [item.itemId]: parseFloat(e.target.value) }))}
                                                                            />
                                                                        ) : (
                                                                            <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 text-[10px] px-2 py-0.5 shadow-sm font-bold">
                                                                                {item.approvedQty}
                                                                            </Badge>
                                                                        )}
                                                                    </td>
                                                                    <td className="px-4 py-3.5 text-center text-slate-500 dark:text-slate-400 font-semibold">{item.item.unit}</td>
                                                                    <td className="px-4 py-3.5 text-center">
                                                                        <button 
                                                                            type="button"
                                                                            onClick={() => {
                                                                                if (item.remarks) {
                                                                                    toast.info(`Remarks: ${item.remarks}`);
                                                                                } else {
                                                                                    toast.info("No remarks for this item");
                                                                                }
                                                                            }}
                                                                            className={cn(
                                                                                "p-1.5 rounded-lg border transition-all active:scale-95",
                                                                                item.remarks 
                                                                                    ? "bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400 hover:bg-blue-100" 
                                                                                    : "bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-400 hover:bg-slate-100"
                                                                            )}
                                                                        >
                                                                            <ClipboardList className="w-3.5 h-3.5" />
                                                                        </button>
                                                                    </td>
                                                                </tr>
                                                            );
                                                        })}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>

                                        {/* Approval Notes, History & Comments */}
                                        <div className="space-y-4">
                                            <h3 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-2">
                                                <PenSquare className="w-3.5 h-3.5 text-blue-500" /> Notes &amp; Activity History
                                            </h3>
                                            
                                            <div className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-sm space-y-4">
                                                {/* Textarea for Current Approval Notes */}
                                                {approvalMode && (
                                                    <div className="space-y-2">
                                                        <div className="flex justify-between items-center">
                                                            <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Approval Comments</label>
                                                            <span className="text-[10px] font-mono text-slate-400">{approverRemarks.length} / 500</span>
                                                        </div>
                                                        <Textarea
                                                            placeholder="Add notes about this approval or rejection reason..."
                                                            maxLength={500}
                                                            className="bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-xl resize-none shadow-inner text-xs"
                                                            value={approverRemarks}
                                                            onChange={(e) => setApproverRemarks(e.target.value)}
                                                            rows={3}
                                                        />
                                                    </div>
                                                )}

                                                {/* Activity Timeline / History logs inside comments block */}
                                                <div className="space-y-3 pt-2">
                                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Activity Log</span>
                                                    <div className="space-y-3">
                                                        {selectedRequest.remarks && (
                                                            <div className="flex gap-3 text-xs bg-slate-50 dark:bg-slate-900 p-3 rounded-xl border border-slate-100 dark:border-slate-800/85">
                                                                <div className="h-6 w-6 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-[10px] font-bold text-blue-600 dark:text-blue-400">A</div>
                                                                <div>
                                                                    <div className="font-bold text-slate-700 dark:text-slate-300">Approver Decision Log</div>
                                                                    <div className="text-slate-500 dark:text-slate-400 mt-1 italic">&ldquo;{selectedRequest.remarks}&rdquo;</div>
                                                                </div>
                                                            </div>
                                                        )}
                                                        <div className="flex gap-3 text-xs">
                                                            <div className="h-6 w-6 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-[10px] font-bold text-slate-500 dark:text-slate-400">SA</div>
                                                            <div>
                                                                <div className="font-bold text-slate-700 dark:text-slate-300">Super Admin (Requester)</div>
                                                                <div className="text-slate-400 text-[10px]">Created material request via Store Hub.</div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>

                            {/* RIGHT PANEL (35% Sticky/Static) */}
                            <div className="w-[35%] h-full overflow-y-auto p-6 space-y-6 bg-slate-50/50 dark:bg-slate-900/10 border-l border-slate-200/50 dark:border-slate-800/50 [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-slate-200 dark:[&::-webkit-scrollbar-thumb]:bg-slate-800/60 [&::-webkit-scrollbar-thumb]:rounded-full">
                                {selectedRequest && (
                                    <>
                                        {/* Summary Panel */}
                                        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
                                            <h4 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                                                <TrendingUp className="w-3.5 h-3.5 text-blue-500" /> Summary Metrics
                                            </h4>
                                            
                                            {(() => {
                                                const totalItems = selectedRequest.items.length;
                                                const totalQty = selectedRequest.items.reduce((sum, item) => sum + item.requestedQty, 0);
                                                const approvedQtyCount = selectedRequest.items.reduce((sum, item) => sum + (allocation[item.itemId] ?? item.approvedQty ?? item.requestedQty), 0);
                                                const estimatedCost = selectedRequest.items.reduce((sum, item) => sum + (item.requestedQty * 4500), 0);
                                                return (
                                                    <div className="space-y-3 text-xs">
                                                        <div className="flex justify-between items-center py-1.5 border-b border-slate-100 dark:border-slate-800/80">
                                                            <span className="text-slate-500 dark:text-slate-400">Total Items</span>
                                                            <span className="font-black text-slate-800 dark:text-slate-200">{totalItems}</span>
                                                        </div>
                                                        <div className="flex justify-between items-center py-1.5 border-b border-slate-100 dark:border-slate-800/80">
                                                            <span className="text-slate-500 dark:text-slate-400">Total Qty</span>
                                                            <span className="font-black text-slate-800 dark:text-slate-200">{totalQty.toLocaleString()}</span>
                                                        </div>
                                                        <div className="flex justify-between items-center py-1.5 border-b border-slate-100 dark:border-slate-800/80">
                                                            <span className="text-slate-500 dark:text-slate-400">Approved Qty</span>
                                                            <span className="font-black text-slate-800 dark:text-slate-200">{approvedQtyCount.toLocaleString()}</span>
                                                        </div>
                                                        <div className="flex justify-between items-center py-1.5 border-b border-slate-100 dark:border-slate-800/80">
                                                            <span className="text-slate-500 dark:text-slate-400">Est. Cost (LKR)</span>
                                                            <span className="font-black text-blue-600 dark:text-blue-400">LKR {estimatedCost.toLocaleString()}</span>
                                                        </div>
                                                        <div className="flex justify-between items-center py-1.5 border-b border-slate-100 dark:border-slate-800/80">
                                                            <span className="text-slate-500 dark:text-slate-400">Stock Status</span>
                                                            <Badge className="bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 text-[9px] font-bold px-2 py-0">Optimal</Badge>
                                                        </div>
                                                        <div className="flex justify-between items-center py-1.5">
                                                            <span className="text-slate-500 dark:text-slate-400">Budget Status</span>
                                                            <Badge className="bg-blue-500/10 text-blue-600 border border-blue-500/20 text-[9px] font-bold px-2 py-0">Within Budget</Badge>
                                                        </div>
                                                    </div>
                                                );
                                            })()}
                                        </div>

                                        {/* Attachments Section */}
                                        {(() => {
                                            const requestAttachments = selectedRequest.requestNr === 'REQ-20260702-6207' 
                                                ? ['BOQ.pdf', 'Drawing.pdf', 'Survey.xlsx'] 
                                                : [];
                                            const hasRealAttachment = !!selectedRequest.sltReferenceId;
                                            if (requestAttachments.length === 0 && !hasRealAttachment) return null;
                                            return (
                                                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-3">
                                                    <h4 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                                                        <Paperclip className="w-3.5 h-3.5 text-blue-500" /> Attachments
                                                    </h4>
                                                    <div className="space-y-2">
                                                        {hasRealAttachment && (
                                                            <a 
                                                                href={selectedRequest.sltReferenceId || undefined} 
                                                                target="_blank" 
                                                                rel="noopener noreferrer"
                                                                className="flex items-center justify-between p-2.5 bg-blue-50/40 dark:bg-blue-900/10 border border-blue-200/50 dark:border-blue-800 rounded-xl text-xs font-bold text-blue-600 dark:text-blue-400 hover:bg-blue-105/50 transition-colors"
                                                            >
                                                                <span className="flex items-center gap-2">
                                                                    <FileText className="w-3.5 h-3.5" />
                                                                    Approved Memo Document
                                                                </span>
                                                                <span className="text-[9px] font-normal">View File</span>
                                                            </a>
                                                        )}
                                                        {requestAttachments.map(file => (
                                                            <div key={file} className="flex items-center justify-between p-2.5 bg-slate-50 dark:bg-slate-850 hover:bg-blue-50/50 dark:hover:bg-blue-900/10 border border-slate-200/50 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer transition-colors">
                                                                <span className="flex items-center gap-2">
                                                                    <FileText className="w-3.5 h-3.5 text-slate-400" />
                                                                    {file}
                                                                </span>
                                                                <span className="text-[9px] text-slate-400 font-normal">1.2 MB</span>
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
                                                {/* Step 1: Request Created */}
                                                <div className="relative">
                                                    <span className="absolute -left-6 top-0.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-white dark:border-slate-900"></span>
                                                    <div className="font-bold text-slate-800 dark:text-slate-200">Request Created</div>
                                                    <div className="text-[10px] text-slate-400">
                                                        by {selectedRequest.requestedBy?.name || 'Requester'} • {new Date(selectedRequest.createdAt).toLocaleDateString()}
                                                    </div>
                                                </div>

                                                {/* Step 2: Approval Stages */}
                                                {selectedRequest.status === 'REJECTED' ? (
                                                    <div className="relative">
                                                        <span className="absolute -left-6 top-0.5 w-3 h-3 rounded-full bg-rose-500 border-2 border-white dark:border-slate-900"></span>
                                                        <div className="font-bold text-rose-600 dark:text-rose-450">Request Rejected</div>
                                                        <div className="text-[10px] text-slate-400">
                                                            {selectedRequest.remarks ? `&ldquo;${selectedRequest.remarks}&rdquo;` : 'Rejected by Approver'}
                                                        </div>
                                                    </div>
                                                ) : selectedRequest.status === 'APPROVED' || selectedRequest.status === 'COMPLETED' ? (
                                                    <div className="relative">
                                                        <span className="absolute -left-6 top-0.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-white dark:border-slate-900"></span>
                                                        <div className="font-bold text-slate-800 dark:text-slate-200">Management Approval</div>
                                                        <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold font-sans">Fully Approved</div>
                                                    </div>
                                                ) : (
                                                    <div className="relative">
                                                        <span className="absolute -left-6 top-0.5 w-3 h-3 rounded-full bg-blue-500 border-2 border-white dark:border-slate-900 animate-pulse"></span>
                                                        <div className="font-bold text-slate-800 dark:text-slate-200">
                                                            {selectedRequest.workflowStage === 'ARM_APPROVAL' ? 'Area Manager (ARM) Review' :
                                                             selectedRequest.workflowStage === 'OSP_MANAGER_APPROVAL' ? 'OSP Manager Review' :
                                                             selectedRequest.workflowStage === 'STORES_MANAGER_APPROVAL' ? 'Stores Manager Review' :
                                                             'Management Review'}
                                                        </div>
                                                        <div className="text-[10px] text-blue-500 font-semibold">Awaiting Review</div>
                                                    </div>
                                                )}

                                                {/* Step 3: Goods Issued / Received */}
                                                {selectedRequest.status === 'COMPLETED' ? (
                                                    <div className="relative">
                                                        <span className="absolute -left-6 top-0.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-white dark:border-slate-900"></span>
                                                        <div className="font-bold text-slate-800 dark:text-slate-200">Materials Received</div>
                                                        <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold font-sans">GRN Processed &amp; Stock Updated</div>
                                                    </div>
                                                ) : selectedRequest.status === 'APPROVED' ? (
                                                    <div className="relative">
                                                        <span className="absolute -left-6 top-0.5 w-3 h-3 rounded-full bg-blue-500 border-2 border-white dark:border-slate-900 animate-pulse"></span>
                                                        <div className="font-bold text-slate-800 dark:text-slate-200">Store Receipt / GRN</div>
                                                        <div className="text-[10px] text-blue-500 font-semibold">Awaiting Store GRN Entry</div>
                                                    </div>
                                                ) : (
                                                    <div className="relative opacity-60">
                                                        <span className="absolute -left-6 top-0.5 w-3 h-3 rounded-full bg-slate-300 dark:bg-slate-700 border-2 border-white dark:border-slate-900"></span>
                                                        <div className="font-bold text-slate-500 dark:text-slate-400">Store Receipt / GRN</div>
                                                        <div className="text-[10px] text-slate-400">Pending previous steps</div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>

                        </div>

                        {/* Dialog Footer Actions - Sticky Bottom */}
                        <div className="px-6 py-4 bg-white dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 flex justify-between items-center flex-shrink-0 gap-3">
                            <Button 
                                variant="outline" 
                                onClick={() => setSelectedRequest(null)}
                                className="h-9 px-4 text-xs font-bold rounded-xl border-slate-200 hover:bg-slate-50 text-slate-700 flex items-center gap-1.5"
                            >
                                <X className="w-3.5 h-3.5" /> Cancel
                            </Button>
                            {approvalMode && (
                                <div className="flex gap-2">
                                    <Button
                                        variant="outline"
                                        className="h-9 px-4 text-xs font-bold rounded-xl border-slate-200 hover:bg-slate-50 text-slate-700 flex items-center gap-1.5"
                                        onClick={() => setSelectedRequest(null)}
                                    >
                                        Save Draft
                                    </Button>
                                    <Button
                                        variant="outline"
                                        onClick={() => approvalMutation.mutate({ action: 'REJECT' })}
                                        disabled={approvalMutation.isPending}
                                        className="h-9 px-4 text-xs font-bold rounded-xl border-red-200 hover:bg-red-50 text-red-600 flex items-center gap-1.5"
                                    >
                                        <Ban className="w-3.5 h-3.5" /> Reject Request
                                    </Button>
                                    <Button
                                        onClick={() => approvalMutation.mutate({ action: 'APPROVE' })}
                                        disabled={approvalMutation.isPending}
                                        className="h-9 px-4 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5 shadow-md transition-transform active:scale-95"
                                    >
                                        <Check className="w-3.5 h-3.5" /> {approvalMutation.isPending ? 'Processing...' : 'Approve & Issue'}
                                    </Button>
                                </div>
                            )}
                        </div>
                    </DialogContent>
                </Dialog>
            </main>
        </div>
    );
}

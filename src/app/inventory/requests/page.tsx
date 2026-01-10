"use client";

import React, { useState, useEffect } from 'react';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Check, X, ArrowRight, User as UserIcon, Printer } from "lucide-react";
import { toast } from 'sonner';
import { generateGatePassPDF } from '@/utils/pdfGenerator';

export default function RequestsPage() {
    const queryClient = useQueryClient();
    const [activeTab, setActiveTab] = useState<'outgoing' | 'incoming'>('outgoing');
    const [user, setUser] = useState<any>(null);
    const [myStore, setMyStore] = useState<any>(null); // Simplified: Assumes User has one primary store or we pick first available

    // Create Request State
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [newItemId, setNewItemId] = useState("");
    const [newItemQty, setNewItemQty] = useState("");
    const [requestItems, setRequestItems] = useState<{ itemId: string, name: string, qty: number }[]>([]); // Draft items

    // Approval State
    const [selectedRequest, setSelectedRequest] = useState<any>(null);
    const [approvalMode, setApprovalMode] = useState(false);
    const [allocation, setAllocation] = useState<Record<string, number>>({}); // itemId -> approvedQty

    useEffect(() => {
        const stored = localStorage.getItem('user');
        if (stored) setUser(JSON.parse(stored));
    }, []);

    // Fetch Stores to find My Store
    const { data: stores = [] } = useQuery({
        queryKey: ['stores'],
        queryFn: async () => (await fetch('/api/inventory/stores')).json()
    });

    useEffect(() => {
        if (stores.length > 0 && user) {
            // Find store managed by me, or just first store if Admin 
            // Better logic: Users should be assigned to stores. Schema has managerId.
            // But User also has managedStores relation.
            // For now, let's assume if I am Admin I can act as Main Store.
            // If I am User, I might be Manager of a Sub Store.
            // For Demo: Select store manually if multiple?
            // Let's autoset to first store that is NOT Main if I am creating request?
            // Actually, let's just pick the first store found for now or allow user to pick current context.
            // To simplify: I'll add a "Current Store" selector in header if user manages multiple.
            const managed = stores.find((s: any) => s.managerId === user.id);
            if (managed) setMyStore(managed);
            else if (stores.length > 0) setMyStore(stores[0]); // Fallback
        }
    }, [stores, user]);

    // Fetch Requests
    const { data: requests = [] } = useQuery({
        queryKey: ['requests', activeTab, myStore?.id],
        queryFn: async () => {
            if (!myStore) return [];
            const isApprover = activeTab === 'incoming';
            const res = await fetch(`/api/inventory/requests?storeId=${myStore.id}&isApprover=${isApprover}`);
            return res.json();
        },
        enabled: !!myStore
    });

    // Fetch Items for Dropdown
    const { data: items = [] } = useQuery({
        queryKey: ['items'],
        queryFn: async () => (await fetch('/api/inventory/items')).json()
    });

    // Fetch Main Stores
    const mainStore = stores.find((s: any) => s.type === 'MAIN');

    // Mutations
    const createMutation = useMutation({
        mutationFn: async () => {
            if (!myStore || !mainStore) throw new Error("Stores not defined");
            const res = await fetch('/api/inventory/requests', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    fromStoreId: myStore.id,
                    toStoreId: mainStore.id,
                    requestedById: user.id,
                    items: requestItems.map(i => ({ itemId: i.itemId, requestedQty: i.qty }))
                })
            });
            if (!res.ok) throw new Error('Failed');
        },
        onSuccess: () => {
            toast.success("Request sent");
            setShowCreateModal(false);
            setRequestItems([]);
            queryClient.invalidateQueries({ queryKey: ['requests'] });
        }
    });

    const approvalMutation = useMutation({
        mutationFn: async ({ action }: { action: 'APPROVE' | 'REJECT' }) => {
            const body: any = {
                requestId: selectedRequest.id,
                action,
                approvedById: user.id
            };

            if (action === 'APPROVE') {
                body.allocation = selectedRequest.items.map((i: any) => ({
                    itemId: i.itemId,
                    approvedQty: allocation[i.itemId] ?? i.requestedQty // Default to requested if not changed
                }));
            }

            const res = await fetch('/api/inventory/requests', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
            if (!res.ok) throw new Error('Failed');
        },
        onSuccess: () => {
            toast.success("Request processed");
            setApprovalMode(false);
            setSelectedRequest(null);
            queryClient.invalidateQueries({ queryKey: ['requests'] });
        }
    });

    const addItemToDraft = () => {
        const item = items.find((i: any) => i.id === newItemId);
        if (!item || !newItemQty) return;
        setRequestItems([...requestItems, { itemId: newItemId, name: item.name, qty: parseFloat(newItemQty) }]);
        setNewItemId("");
        setNewItemQty("");
    };

    return (
        <div className="h-screen flex bg-slate-50 overflow-hidden">
            <Sidebar />
            <main className="flex-1 flex flex-col min-w-0 h-full">
                <Header />
                <div className="flex-1 flex flex-col min-h-0 overflow-hidden p-4 md:p-8">
                    <div className="max-w-6xl mx-auto w-full flex flex-col h-full space-y-4">

                        <div className="flex justify-between items-center flex-none">
                            <div>
                                <h1 className="text-xl font-bold text-slate-900">Stock Requests</h1>
                                <p className="text-xs text-slate-500">
                                    Current Store: <strong className="text-slate-800">{myStore?.name || 'Loading...'}</strong>
                                </p>
                            </div>
                            <Button size="sm" onClick={() => setShowCreateModal(true)} disabled={!mainStore} className="h-8 text-xs">
                                <Plus className="w-4 h-4 mr-2" /> New Request
                            </Button>
                        </div>

                        {/* Tabs */}
                        <div className="flex space-x-1 bg-slate-200/50 p-1 rounded-lg w-fit flex-none">
                            <button
                                onClick={() => setActiveTab('outgoing')}
                                className={`px-4 py-1.5 text-xs font-medium rounded-md transition-all ${activeTab === 'outgoing' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
                            >
                                My Requests
                            </button>
                            <button
                                onClick={() => setActiveTab('incoming')}
                                className={`px-4 py-1.5 text-xs font-medium rounded-md transition-all ${activeTab === 'incoming' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
                            >
                                Incoming Approval
                            </button>
                        </div>

                        {/* List */}
                        <div className="flex-1 bg-white rounded-xl border shadow-sm overflow-hidden flex flex-col">
                            <div className="overflow-auto flex-1">
                                <table className="w-full text-xs text-left">
                                    <thead className="bg-slate-50 text-slate-600 font-bold border-b sticky top-0">
                                        <tr>
                                            <th className="px-4 py-3">Request ID</th>
                                            <th className="px-4 py-3">Date</th>
                                            <th className="px-4 py-3">{activeTab === 'outgoing' ? 'To Store' : 'From Store'}</th>
                                            <th className="px-4 py-3">Requested By</th>
                                            <th className="px-4 py-3">Status</th>
                                            <th className="px-4 py-3 text-right">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                        {requests.length === 0 ? (
                                            <tr><td colSpan={6} className="p-8 text-center text-slate-400">No requests found.</td></tr>
                                        ) : (
                                            requests.map((r: any) => (
                                                <tr key={r.id} className="hover:bg-slate-50">
                                                    <td className="px-4 py-2 font-mono text-slate-500">{r.requestNr}</td>
                                                    <td className="px-4 py-2">{new Date(r.createdAt).toLocaleDateString()}</td>
                                                    <td className="px-4 py-2 font-semibold">
                                                        {activeTab === 'outgoing' ? r.toStore.name : r.fromStore.name}
                                                    </td>
                                                    <td className="px-4 py-2">
                                                        <div className="flex items-center gap-1">
                                                            <UserIcon className="w-3 h-3 text-slate-400" />
                                                            {r.requestedBy.name}
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-2">
                                                        <Badge variant="outline" className={`
                                                            ${r.status === 'PENDING' ? 'border-amber-200 bg-amber-50 text-amber-700' :
                                                                r.status === 'COMPLETED' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' :
                                                                    'border-gray-200 bg-gray-50 text-gray-600'}
                                                        `}>
                                                            {r.status}
                                                        </Badge>
                                                    </td>
                                                    <td className="px-4 py-2 text-right">
                                                        {activeTab === 'incoming' && r.status === 'PENDING' ? (
                                                            <Button size="sm" className="h-6 text-xs bg-blue-600" onClick={() => { setSelectedRequest(r); setApprovalMode(true); }}>
                                                                Review
                                                            </Button>
                                                        ) : (
                                                            <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => { setSelectedRequest(r); setApprovalMode(false); }}>
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

                {/* Create Modal */}
                <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
                    <DialogContent className="max-w-2xl">
                        <DialogHeader>
                            <DialogTitle>New Stock Request</DialogTitle>
                            <DialogDescription>Request items from Main Store ({mainStore?.name})</DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                            <div className="flex gap-2 items-end">
                                <div className="flex-1">
                                    <label className="text-xs font-semibold">Item</label>
                                    <Select value={newItemId} onValueChange={setNewItemId}>
                                        <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select Item" /></SelectTrigger>
                                        <SelectContent className="max-h-60">
                                            {items.map((i: any) => <SelectItem key={i.id} value={i.id} className="text-xs">{i.code} - {i.name}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="w-24">
                                    <label className="text-xs font-semibold">Qty</label>
                                    <Input type="number" className="h-8 text-xs" value={newItemQty} onChange={e => setNewItemQty(e.target.value)} />
                                </div>
                                <Button size="sm" className="h-8" onClick={addItemToDraft} disabled={!newItemId || !newItemQty}>Add</Button>
                            </div>

                            <div className="bg-slate-50 rounded-lg p-2 min-h-[100px]">
                                {requestItems.length === 0 ? (
                                    <div className="text-center text-xs text-slate-400 py-8">No items added yet.</div>
                                ) : (
                                    <div className="space-y-1">
                                        {requestItems.map((item, idx) => (
                                            <div key={idx} className="flex justify-between items-center bg-white p-2 border rounded text-xs">
                                                <span>{item.name}</span>
                                                <div className="flex gap-4 items-center">
                                                    <span className="font-bold">{item.qty} units</span>
                                                    <button onClick={() => setRequestItems(requestItems.filter((_, i) => i !== idx))} className="text-red-500 hover:text-red-700">
                                                        <X className="w-3 h-3" />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setShowCreateModal(false)}>Cancel</Button>
                            <Button onClick={() => createMutation.mutate()} disabled={requestItems.length === 0 || createMutation.isPending}>Send Request</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                {/* Approval/Detail Modal */}
                <Dialog open={!!selectedRequest} onOpenChange={(o) => { if (!o) setSelectedRequest(null); }}>
                    <DialogContent className="max-w-3xl">
                        <DialogHeader>
                            <DialogTitle>Request {selectedRequest?.requestNr}</DialogTitle>
                            <DialogDescription>
                                From: {selectedRequest?.fromStore?.name} • Requested by {selectedRequest?.requestedBy?.name}
                            </DialogDescription>
                        </DialogHeader>

                        <div className="py-4">
                            <table className="w-full text-xs text-left">
                                <thead className="bg-slate-50 border-b">
                                    <tr>
                                        <th className="px-3 py-2">Item Code</th>
                                        <th className="px-3 py-2">Item Name</th>
                                        <th className="px-3 py-2 text-right">Requested</th>
                                        <th className="px-3 py-2 text-right">{approvalMode ? 'Approved' : 'Allocated'}</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    {selectedRequest?.items?.map((item: any) => (
                                        <tr key={item.id}>
                                            <td className="px-3 py-2 font-mono text-slate-500">{item.item.code}</td>
                                            <td className="px-3 py-2">{item.item.name}</td>
                                            <td className="px-3 py-2 text-right font-medium">{item.requestedQty}</td>
                                            <td className="px-3 py-2 text-right">
                                                {approvalMode ? (
                                                    <Input
                                                        type="number"
                                                        className="h-6 w-20 text-right ml-auto text-xs"
                                                        defaultValue={item.requestedQty}
                                                        onChange={(e) => setAllocation(prev => ({ ...prev, [item.itemId]: parseFloat(e.target.value) }))}
                                                    />
                                                ) : (
                                                    <span className="font-bold text-emerald-600">{item.approvedQty}</span>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <DialogFooter>
                            <Button variant="outline" onClick={() => setSelectedRequest(null)}>Close</Button>
                            {approvalMode && (
                                <>
                                    <Button variant="destructive" onClick={() => approvalMutation.mutate({ action: 'REJECT' })}>Reject</Button>
                                    <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={() => approvalMutation.mutate({ action: 'APPROVE' })}>
                                        Approve & Allocate
                                    </Button>
                                </>
                            )}
                        </DialogFooter>
                        {selectedRequest?.status !== 'PENDING' && (
                            <div className="flex justify-start px-6 pb-6">
                                <Button
                                    variant="outline"
                                    onClick={() => generateGatePassPDF(selectedRequest)}
                                    className="gap-2"
                                >
                                    <Printer className="w-4 h-4" /> Print Gate Pass / Issue Note
                                </Button>
                            </div>
                        )}
                    </DialogContent>
                </Dialog>

            </main>
        </div>
    );
}

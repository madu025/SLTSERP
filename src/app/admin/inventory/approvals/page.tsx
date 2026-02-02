"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { CheckCircle, XCircle, Package, Loader2 } from "lucide-react";
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';

interface StockRequest {
    id: string;
    requestNr: string;
    status: string;
    workflowStage: string;
    priority: string;
    sourceType: string;
    purpose: string;
    requiredDate: string;
    createdAt: string;
    fromStore: { id: string; name: string; type: string };
    toStore?: { id: string; name: string };
    requestedBy: { id: string; name: string };
    items: Array<{
        id: string;
        requestedQty: number;
        approvedQty: number;
        issuedQty?: number;
        receivedQty: number;
        item: { id: string; name: string; code: string; unit: string };
    }>;
    armRemarks?: string;
    storesManagerRemarks?: string;
    remarks?: string;
}

interface ProcessActionPayload {
    requestId: string;
    action: string;
    remarks: string;
    userId?: string;
    approvedById?: string;
    allocation?: Array<{ itemId: string; approvedQty?: number; issuedQty?: number; receivedQty?: number }>;
}

export default function ApprovalsPage() {
    const queryClient = useQueryClient();
    const [selectedRequest, setSelectedRequest] = useState<StockRequest | null>(null);
    const [showModal, setShowModal] = useState(false);
    const [actionType, setActionType] = useState<string>("");
    const [remarks, setRemarks] = useState("");
    const [allocation, setAllocation] = useState<Array<{ itemId: string; approvedQty?: number; issuedQty?: number; receivedQty?: number }>>([]);

    // Get current user from localStorage
    const user = typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('user') || '{}') : {};
    const userRole = user.role || '';

    // Determine which requests to show based on role
    const getWorkflowStageFilter = () => {
        switch (userRole) {
            case 'AREA_MANAGER':
                return 'ARM_APPROVAL';
            case 'STORES_MANAGER':
                return 'STORES_MANAGER_APPROVAL';
            case 'OSP_MANAGER':
                return 'OSP_MANAGER_APPROVAL';
            case 'STORES_ASSISTANT':
                return 'MAIN_STORE_RELEASE';
            default:
                return 'SUB_STORE_RECEIVE'; // Sub Store Officers
        }
    };

    // Fetch pending requests
    const { data: requests = [], isLoading } = useQuery<StockRequest[]>({
        queryKey: ['approval-requests', userRole],
        queryFn: async () => {
            const stage = getWorkflowStageFilter();
            const res = await fetch(`/api/inventory/requests?workflowStage=${stage}`);
            if (!res.ok) throw new Error('Failed to fetch requests');
            const data = await res.json();
            return Array.isArray(data) ? data : (data.requests || []);
        },
        enabled: !!userRole
    });

    // Process action mutation
    const processActionMutation = useMutation({
        mutationFn: async (data: ProcessActionPayload) => {
            const res = await fetch('/api/inventory/requests/action', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            if (!res.ok) {
                const error = await res.json();
                throw new Error(error.error || 'Failed to process action');
            }
            return res.json();
        },
        onSuccess: () => {
            toast.success('Action processed successfully');
            queryClient.invalidateQueries({ queryKey: ['approval-requests'] });
            setShowModal(false);
            setSelectedRequest(null);
            setRemarks("");
            setAllocation([]);
        },
        onError: (error: Error) => {
            toast.error(error.message || 'Failed to process action');
        }
    });

    const handleAction = (request: StockRequest, action: string) => {
        setSelectedRequest(request);
        setActionType(action);

        // Initialize allocation based on action type
        if (action === 'OSP_MANAGER_APPROVE' || action === 'ARM_APPROVE' || action === 'STORES_MANAGER_APPROVE') {
            setAllocation(request.items.map(item => ({
                itemId: item.item.id,
                approvedQty: item.requestedQty
            })));
        } else if (action === 'MAIN_STORE_RELEASE') {
            setAllocation(request.items.map(item => ({
                itemId: item.item.id,
                issuedQty: item.approvedQty || item.requestedQty
            })));
        } else if (action === 'SUB_STORE_RECEIVE') {
            setAllocation(request.items.map(item => ({
                itemId: item.item.id,
                receivedQty: item.issuedQty || item.approvedQty || item.requestedQty
            })));
        }

        setShowModal(true);
    };

    const submitAction = () => {
        if (!selectedRequest) return;

        const actionMap: Record<string, string> = {
            'ARM_APPROVAL': actionType === 'approve' ? 'ARM_APPROVE' : 'ARM_REJECT',
            'STORES_MANAGER_APPROVAL': actionType === 'approve' ? 'STORES_MANAGER_APPROVE' : 'STORES_MANAGER_REJECT',
            'OSP_MANAGER_APPROVAL': actionType === 'approve' ? 'OSP_MANAGER_APPROVE' : 'OSP_MANAGER_REJECT',
            'MAIN_STORE_RELEASE': 'MAIN_STORE_RELEASE',
            'SUB_STORE_RECEIVE': 'SUB_STORE_RECEIVE'
        };

        const finalAction = actionMap[selectedRequest.workflowStage] || actionType;

        processActionMutation.mutate({
            requestId: selectedRequest.id,
            action: finalAction,
            approvedById: user.id,
            remarks,
            allocation: allocation.length > 0 ? allocation : undefined
        });
    };

    const updateAllocation = (itemId: string, field: 'approvedQty' | 'issuedQty' | 'receivedQty', value: number) => {
        setAllocation(prev => prev.map(a =>
            a.itemId === itemId ? { ...a, [field]: value } : a
        ));
    };

    const getRoleTitle = () => {
        switch (userRole) {
            case 'AREA_MANAGER': return 'ARM Approvals';
            case 'STORES_MANAGER': return 'Stores Manager Approvals';
            case 'OSP_MANAGER': return 'OSP Manager Approvals';
            case 'STORES_ASSISTANT': return 'Material Release (Main Store)';
            default: return 'Material Receipt Confirmation';
        }
    };

    const getActionButtons = (request: StockRequest) => {
        const stage = request.workflowStage;

        if (stage === 'ARM_APPROVAL' && userRole === 'AREA_MANAGER') {
            return (
                <>
                    <Button size="sm" onClick={() => handleAction(request, 'approve')} className="bg-green-600 hover:bg-green-700">
                        <CheckCircle className="w-4 h-4 mr-1" /> Approve
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => handleAction(request, 'reject')}>
                        <XCircle className="w-4 h-4 mr-1" /> Reject
                    </Button>
                </>
            );
        }

        if (stage === 'STORES_MANAGER_APPROVAL' && userRole === 'STORES_MANAGER') {
            return (
                <>
                    <Button size="sm" onClick={() => handleAction(request, 'approve')} className="bg-green-600 hover:bg-green-700">
                        <CheckCircle className="w-4 h-4 mr-1" /> Approve
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => handleAction(request, 'reject')}>
                        <XCircle className="w-4 h-4 mr-1" /> Reject
                    </Button>
                </>
            );
        }

        if (stage === 'OSP_MANAGER_APPROVAL' && userRole === 'OSP_MANAGER') {
            return (
                <>
                    <Button size="sm" onClick={() => handleAction(request, 'approve')} className="bg-green-600 hover:bg-green-700">
                        <CheckCircle className="w-4 h-4 mr-1" /> Approve
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => handleAction(request, 'reject')}>
                        <XCircle className="w-4 h-4 mr-1" /> Reject
                    </Button>
                </>
            );
        }

        if (stage === 'MAIN_STORE_RELEASE' && userRole === 'STORES_ASSISTANT') {
            return (
                <Button size="sm" onClick={() => handleAction(request, 'MAIN_STORE_RELEASE')} className="bg-blue-600 hover:bg-blue-700">
                    <Package className="w-4 h-4 mr-1" /> Release Materials
                </Button>
            );
        }

        if (stage === 'SUB_STORE_RECEIVE') {
            return (
                <Button size="sm" onClick={() => handleAction(request, 'SUB_STORE_RECEIVE')} className="bg-purple-600 hover:bg-purple-700">
                    <CheckCircle className="w-4 h-4 mr-1" /> Confirm Receipt
                </Button>
            );
        }

        return null;
    };

    if (isLoading) {
        return (
            <div className="flex h-screen bg-slate-50">
                <Sidebar />
                <main className="flex-1 flex items-center justify-center">
                    <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                </main>
            </div>
        );
    }

    return (
        <div className="flex h-screen bg-slate-50 overflow-hidden">
            <Sidebar />
            <main className="flex-1 flex flex-col min-w-0 h-full">
                <Header />
                <div className="flex-1 overflow-y-auto p-4 bg-slate-50/50">
                    <div className="max-w-7xl mx-auto space-y-4">
                        {/* Header */}
                        <div className="bg-white p-4 rounded-lg shadow-sm border">
                            <h1 className="text-xl font-bold text-slate-800">{getRoleTitle()}</h1>
                            <p className="text-sm text-slate-500">
                                {requests.length} pending request{requests.length !== 1 ? 's' : ''}
                            </p>
                        </div>

                        {/* Requests List */}
                        {requests.length === 0 ? (
                            <Card>
                                <CardContent className="p-8 text-center text-slate-500">
                                    No pending requests
                                </CardContent>
                            </Card>
                        ) : (
                            <div className="space-y-3">
                                {requests.map((request: StockRequest) => (
                                    <Card key={request.id} className="hover:shadow-md transition-shadow">
                                        <CardContent className="p-4">
                                            <div className="flex items-start justify-between mb-3">
                                                <div>
                                                    <h3 className="font-bold text-lg text-slate-800">{request.requestNr}</h3>
                                                    <p className="text-sm text-slate-600">
                                                        From: <span className="font-semibold">{request.fromStore.name}</span>
                                                        {request.toStore && ` → To: ${request.toStore.name}`}
                                                    </p>
                                                    <p className="text-xs text-slate-500">
                                                        Requested by: {request.requestedBy.name} •
                                                        Source: <span className="font-medium">{request.sourceType}</span> •
                                                        Priority: <span className={`font-medium ${request.priority === 'URGENT' ? 'text-red-600' :
                                                            request.priority === 'HIGH' ? 'text-orange-600' : 'text-blue-600'
                                                            }`}>{request.priority}</span>
                                                    </p>
                                                </div>
                                                <div className="flex gap-2">
                                                    {getActionButtons(request)}
                                                </div>
                                            </div>

                                            {/* Items Preview */}
                                            <div className="bg-slate-50 rounded p-3 mt-3">
                                                <p className="text-xs font-semibold text-slate-600 mb-2">Items ({request.items.length}):</p>
                                                <div className="space-y-1">
                                                    {request.items.slice(0, 3).map(item => (
                                                        <div key={item.id} className="text-xs text-slate-700 flex justify-between">
                                                            <span>{item.item.name} ({item.item.code})</span>
                                                            <span className="font-medium">Qty: {item.requestedQty} {item.item.unit}</span>
                                                        </div>
                                                    ))}
                                                    {request.items.length > 3 && (
                                                        <p className="text-xs text-slate-500 italic">+ {request.items.length - 3} more items</p>
                                                    )}
                                                </div>
                                            </div>

                                            {request.purpose && (
                                                <p className="text-xs text-slate-600 mt-2">
                                                    <span className="font-semibold">Purpose:</span> {request.purpose}
                                                </p>
                                            )}
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </main>

            {/* Action Modal */}
            {showModal && selectedRequest && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden">
                        <div className="p-6 border-b bg-white">
                            <h2 className="text-xl font-bold text-slate-800">
                                {actionType === 'approve' ? 'Approve' : actionType === 'reject' ? 'Reject' :
                                    actionType === 'MAIN_STORE_RELEASE' ? 'Release Materials' : 'Confirm Receipt'} - {selectedRequest.requestNr}
                            </h2>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6 space-y-4 no-scrollbar">
                            {/* Items Table */}
                            <div>
                                <h3 className="font-semibold text-slate-700 mb-2">Items:</h3>
                                <table className="w-full text-sm border">
                                    <thead className="bg-slate-100">
                                        <tr>
                                            <th className="p-2 text-left">Item</th>
                                            <th className="p-2 text-right">Requested</th>
                                            {(actionType === 'approve' || actionType === 'OSP_MANAGER_APPROVE') && (
                                                <th className="p-2 text-right">Approved Qty</th>
                                            )}
                                            {actionType === 'MAIN_STORE_RELEASE' && (
                                                <th className="p-2 text-right">Issue Qty</th>
                                            )}
                                            {actionType === 'SUB_STORE_RECEIVE' && (
                                                <>
                                                    <th className="p-2 text-right">Issued</th>
                                                    <th className="p-2 text-right">Received Qty</th>
                                                </>
                                            )}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {selectedRequest.items.map((item, idx) => (
                                            <tr key={item.id} className="border-t">
                                                <td className="p-2">{item.item.name} ({item.item.code})</td>
                                                <td className="p-2 text-right">{item.requestedQty} {item.item.unit}</td>
                                                {(actionType === 'approve' || actionType === 'OSP_MANAGER_APPROVE') && (
                                                    <td className="p-2">
                                                        <Input
                                                            type="number"
                                                            className="w-24 ml-auto text-right"
                                                            value={allocation[idx]?.approvedQty || item.requestedQty}
                                                            onChange={(e) => updateAllocation(item.item.id, 'approvedQty', parseFloat(e.target.value))}
                                                        />
                                                    </td>
                                                )}
                                                {actionType === 'MAIN_STORE_RELEASE' && (
                                                    <td className="p-2">
                                                        <Input
                                                            type="number"
                                                            className="w-24 ml-auto text-right"
                                                            value={allocation[idx]?.issuedQty || item.approvedQty}
                                                            onChange={(e) => updateAllocation(item.item.id, 'issuedQty', parseFloat(e.target.value))}
                                                        />
                                                    </td>
                                                )}
                                                {actionType === 'SUB_STORE_RECEIVE' && (
                                                    <>
                                                        <td className="p-2 text-right">{item.issuedQty || item.approvedQty} {item.item.unit}</td>
                                                        <td className="p-2">
                                                            <Input
                                                                type="number"
                                                                className="w-24 ml-auto text-right"
                                                                value={allocation[idx]?.receivedQty || item.issuedQty}
                                                                onChange={(e) => updateAllocation(item.item.id, 'receivedQty', parseFloat(e.target.value))}
                                                            />
                                                        </td>
                                                    </>
                                                )}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {/* Remarks */}
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-1">Remarks:</label>
                                <textarea
                                    className="w-full border rounded p-2 text-sm"
                                    rows={3}
                                    value={remarks}
                                    onChange={(e) => setRemarks(e.target.value)}
                                    placeholder="Enter remarks (optional)"
                                />
                            </div>
                        </div>

                        <div className="p-6 border-t flex justify-end gap-2 bg-slate-50">
                            <Button variant="outline" onClick={() => setShowModal(false)}>
                                Cancel
                            </Button>
                            <Button
                                onClick={submitAction}
                                disabled={processActionMutation.isPending}
                                className={
                                    actionType === 'reject' ? 'bg-red-600 hover:bg-red-700' :
                                        'bg-green-600 hover:bg-green-700'
                                }
                            >
                                {processActionMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                                Confirm
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

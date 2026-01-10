"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter, useParams } from "next/navigation";
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Trash2, Plus } from "lucide-react";
import { toast } from "sonner";

interface RequestItem {
    itemId: string;
    requestedQty: string;
    make: string;
    model: string;
    suggestedVendor: string;
    remarks: string;
}

export default function EditRequestPage() {
    const router = useRouter();
    const params = useParams();
    const queryClient = useQueryClient();
    const requestId = params.id as string;

    const [sourceType, setSourceType] = useState("SLT");
    const [priority, setPriority] = useState("MEDIUM");
    const [irNumber, setIrNumber] = useState("");
    const [purpose, setPurpose] = useState("");
    const [requestItems, setRequestItems] = useState<RequestItem[]>([]);

    // Fetch existing request
    const { data: request, isLoading } = useQuery({
        queryKey: ['request', requestId],
        queryFn: async () => {
            const res = await fetch(`/api/inventory/requests?id=${requestId}`);
            return res.json();
        },
        enabled: !!requestId
    });

    // Fetch items for dropdown
    const { data: items = [] } = useQuery({
        queryKey: ["items"],
        queryFn: async () => (await fetch("/api/inventory/items")).json()
    });

    // Load request data when fetched
    useEffect(() => {
        if (request) {
            setSourceType(request.sourceType || 'SLT');
            setPriority(request.priority || 'MEDIUM');
            setIrNumber(request.irNumber || '');
            setPurpose(request.purpose || '');

            // Load items
            if (request.items && request.items.length > 0) {
                setRequestItems(request.items.map((item: any) => ({
                    itemId: item.itemId,
                    requestedQty: item.requestedQty.toString(),
                    make: item.make || '',
                    model: item.model || '',
                    suggestedVendor: item.suggestedVendor || '',
                    remarks: item.remarks || ''
                })));
            }
        }
    }, [request]);

    // Update mutation
    const updateMutation = useMutation({
        mutationFn: async (data: any) => {
            const res = await fetch('/api/inventory/requests', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            if (!res.ok) throw new Error('Failed to update request');
            return res.json();
        },
        onSuccess: () => {
            toast.success('Request updated and resubmitted successfully!');
            queryClient.invalidateQueries({ queryKey: ['my-requests'] });
            router.push('/admin/inventory/requests/my-requests');
        },
        onError: () => toast.error('Failed to update request')
    });

    const handleSubmit = () => {
        if (requestItems.length === 0) {
            toast.error('Please add at least one item');
            return;
        }

        const payload = {
            requestId,
            action: 'RESUBMIT',
            sourceType,
            priority,
            irNumber: sourceType === 'SLT' ? irNumber : null,
            purpose,
            items: requestItems.map(item => ({
                itemId: item.itemId,
                requestedQty: parseFloat(item.requestedQty),
                make: item.make,
                model: item.model,
                suggestedVendor: item.suggestedVendor,
                remarks: item.remarks
            }))
        };

        updateMutation.mutate(payload);
    };

    const addItem = () => {
        setRequestItems([...requestItems, {
            itemId: '',
            requestedQty: '',
            make: '',
            model: '',
            suggestedVendor: '',
            remarks: ''
        }]);
    };

    const removeItem = (index: number) => {
        setRequestItems(requestItems.filter((_, i) => i !== index));
    };

    const updateItem = (index: number, field: keyof RequestItem, value: string) => {
        const updated = [...requestItems];
        updated[index] = { ...updated[index], [field]: value };
        setRequestItems(updated);
    };

    if (isLoading) {
        return (
            <div className="flex h-screen bg-slate-50">
                <Sidebar />
                <main className="flex-1 flex items-center justify-center">
                    <div className="text-slate-500">Loading...</div>
                </main>
            </div>
        );
    }

    if (!request || request.status !== 'REJECTED') {
        return (
            <div className="flex h-screen bg-slate-50">
                <Sidebar />
                <main className="flex-1 flex items-center justify-center">
                    <div className="text-center">
                        <h2 className="text-xl font-bold text-slate-900">Request Not Found or Not Rejected</h2>
                        <Button className="mt-4" onClick={() => router.back()}>Go Back</Button>
                    </div>
                </main>
            </div>
        );
    }

    return (
        <div className="flex h-screen bg-slate-50 overflow-hidden">
            <Sidebar />
            <main className="flex-1 flex flex-col min-w-0 h-full">
                <Header />
                <div className="flex-1 overflow-y-auto p-4 md:p-6">
                    <div className="max-w-6xl mx-auto space-y-6">
                        {/* Header */}
                        <div className="flex items-center justify-between">
                            <div>
                                <h1 className="text-2xl font-bold text-slate-900">Edit & Resubmit Request</h1>
                                <p className="text-slate-500">Request No: {request.requestNr}</p>
                                {request.remarks && (
                                    <p className="text-sm text-red-600 mt-1">
                                        <span className="font-bold">Rejection Reason:</span> {request.remarks}
                                    </p>
                                )}
                            </div>
                            <Button variant="outline" onClick={() => router.back()}>Cancel</Button>
                        </div>

                        {/* Form */}
                        <Card className="p-6">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                                <div>
                                    <label className="text-xs font-bold text-slate-600 uppercase">Source</label>
                                    <select
                                        className="w-full mt-1 h-9 rounded border px-3 text-sm"
                                        value={sourceType}
                                        onChange={e => setSourceType(e.target.value)}
                                    >
                                        <option value="SLT">SLT (Head Office)</option>
                                        <option value="LOCAL_PURCHASE">Local Purchase</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="text-xs font-bold text-slate-600 uppercase">Priority</label>
                                    <select
                                        className="w-full mt-1 h-9 rounded border px-3 text-sm"
                                        value={priority}
                                        onChange={e => setPriority(e.target.value)}
                                    >
                                        <option value="LOW">Low</option>
                                        <option value="MEDIUM">Medium</option>
                                        <option value="HIGH">High</option>
                                        <option value="URGENT">Urgent</option>
                                    </select>
                                </div>

                                {sourceType === 'SLT' && (
                                    <div>
                                        <label className="text-xs font-bold text-slate-600 uppercase">IR Number</label>
                                        <Input
                                            className="mt-1 h-9 text-sm"
                                            value={irNumber}
                                            onChange={e => setIrNumber(e.target.value)}
                                            placeholder="Optional"
                                        />
                                    </div>
                                )}
                            </div>

                            <div className="mb-6">
                                <label className="text-xs font-bold text-slate-600 uppercase">Purpose</label>
                                <Textarea
                                    className="mt-1 text-sm"
                                    value={purpose}
                                    onChange={e => setPurpose(e.target.value)}
                                    rows={2}
                                />
                            </div>

                            {/* Items Table */}
                            <div>
                                <div className="flex justify-between items-center mb-3">
                                    <label className="text-xs font-bold text-slate-600 uppercase">Items</label>
                                    <Button size="sm" onClick={addItem}>
                                        <Plus className="w-4 h-4 mr-1" />
                                        Add Item
                                    </Button>
                                </div>

                                <div className="overflow-x-auto border rounded">
                                    <table className="w-full text-xs">
                                        <thead className="bg-slate-100 border-b">
                                            <tr>
                                                <th className="px-2 py-2 w-8">#</th>
                                                <th className="px-2 py-2 min-w-[180px]">Item</th>
                                                <th className="px-2 py-2 w-[100px]">Qty</th>
                                                <th className="px-2 py-2 w-[100px]">Make</th>
                                                <th className="px-2 py-2 w-[100px]">Model</th>
                                                <th className="px-2 py-2 w-[120px]">Vendor</th>
                                                <th className="px-2 py-2 w-8"></th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y">
                                            {requestItems.map((item, idx) => (
                                                <tr key={idx}>
                                                    <td className="px-2 py-1 text-center">{idx + 1}</td>
                                                    <td className="px-2 py-1">
                                                        <select
                                                            className="w-full h-7 rounded border text-xs px-1"
                                                            value={item.itemId}
                                                            onChange={e => updateItem(idx, 'itemId', e.target.value)}
                                                        >
                                                            <option value="">Select Item...</option>
                                                            {items.map((i: any) => (
                                                                <option key={i.id} value={i.id}>
                                                                    {i.name} ({i.code})
                                                                </option>
                                                            ))}
                                                        </select>
                                                    </td>
                                                    <td className="px-2 py-1">
                                                        <Input
                                                            type="number"
                                                            className="h-6 text-xs"
                                                            value={item.requestedQty}
                                                            onChange={e => updateItem(idx, 'requestedQty', e.target.value)}
                                                        />
                                                    </td>
                                                    <td className="px-2 py-1">
                                                        <Input
                                                            className="h-6 text-xs"
                                                            value={item.make}
                                                            onChange={e => updateItem(idx, 'make', e.target.value)}
                                                        />
                                                    </td>
                                                    <td className="px-2 py-1">
                                                        <Input
                                                            className="h-6 text-xs"
                                                            value={item.model}
                                                            onChange={e => updateItem(idx, 'model', e.target.value)}
                                                        />
                                                    </td>
                                                    <td className="px-2 py-1">
                                                        <Input
                                                            className="h-6 text-xs"
                                                            value={item.suggestedVendor}
                                                            onChange={e => updateItem(idx, 'suggestedVendor', e.target.value)}
                                                        />
                                                    </td>
                                                    <td className="px-2 py-1 text-center">
                                                        <button
                                                            onClick={() => removeItem(idx)}
                                                            className="text-red-500 hover:text-red-700"
                                                        >
                                                            <Trash2 className="w-3 h-3" />
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            <div className="flex justify-end gap-3 mt-6">
                                <Button variant="outline" onClick={() => router.back()}>
                                    Cancel
                                </Button>
                                <Button
                                    onClick={handleSubmit}
                                    disabled={updateMutation.isPending}
                                    className="bg-blue-600 hover:bg-blue-700"
                                >
                                    {updateMutation.isPending ? 'Submitting...' : 'Update & Resubmit'}
                                </Button>
                            </div>
                        </Card>
                    </div>
                </div>
            </main>
        </div>
    );
}

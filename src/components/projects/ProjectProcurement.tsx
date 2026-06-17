'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
    DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
    ShoppingCart, FileText, Package, Plus, Eye, CheckCircle, XCircle,
    Loader2,
} from 'lucide-react';
import SearchableItemSelect, { InventoryItem } from '@/components/shared/SearchableItemSelect';

interface Project {
    id: string;
    projectCode: string;
    name: string;
    status: string;
}

interface RequisitionItem {
    id?: string;
    itemCode: string;
    description: string;
    unit: string;
    quantity: number;
    estimatedPrice: number;
    totalEstimated?: number;
    materialId?: string;
}

interface Requisition {
    id: string;
    prNumber: string;
    title: string;
    status: string;
    estimatedTotal: number;
    priority: string;
    type: string;
    items?: RequisitionItem[];
}

interface PurchaseOrderItem {
    id?: string;
    itemCode: string;
    description: string;
    unit: string;
    quantity: number;
    unitPrice: number;
    totalPrice?: number;
    materialId?: string;
}

interface PurchaseOrder {
    id: string;
    poNumber: string;
    title: string;
    status: string;
    vendorName: string;
    totalAmount: number;
    items?: PurchaseOrderItem[];
    requisition?: {
        prNumber: string;
    };
}

interface GoodsReceiptItem {
    id?: string;
    itemCode: string;
    quantityReceived: number;
}

interface GoodsReceipt {
    id: string;
    grnNumber: string;
    status: string;
    receivedDate: string;
    purchaseOrder?: {
        poNumber: string;
        vendorName: string;
    };
    items?: GoodsReceiptItem[];
}

interface PRFormItem extends RequisitionItem {
    _key?: number;
}

interface POFormItem extends PurchaseOrderItem {
    _key?: number;
}

interface PRForm {
    title?: string;
    priority?: string;
    type?: string;
    items: PRFormItem[];
}

interface POForm {
    title?: string;
    vendorId?: string;
    items: POFormItem[];
}

interface ProjectProcurementProps {
    project: Project;
    refreshProject: () => void;
}

export default function ProjectProcurement({ project, refreshProject }: ProjectProcurementProps) {
    const [activeTab, setActiveTab] = useState('requisitions');
    const [requisitions, setRequisitions] = useState<Requisition[]>([]);
    const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
    const [goodsReceipts, setGoodsReceipts] = useState<GoodsReceipt[]>([]);
    const [loading, setLoading] = useState(true);

    // Dialog states
    const [showPRDialog, setShowPRDialog] = useState(false);
    const [showPODialog, setShowPODialog] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    // Counter for unique keys (useRef to persist across renders)
    const itemCounterRef = useRef(1);
    const nextKey = () => itemCounterRef.current++;

    // Form data
    const [prForm, setPrForm] = useState<PRForm>({ items: [{ _key: 0, itemCode: '', description: '', unit: 'NOS', quantity: 1, estimatedPrice: 0 }] });
    const [poForm, setPoForm] = useState<POForm>({ items: [{ _key: 0, itemCode: '', description: '', unit: 'NOS', quantity: 1, unitPrice: 0 }] });

    // Track which items have inventory selected
    const [prItemInventory, setPrItemInventory] = useState<Record<number, InventoryItem | null>>({});
    const [poItemInventory, setPoItemInventory] = useState<Record<number, InventoryItem | null>>({});

    const fetchRequisitions = useCallback(async () => {
        try {
            const res = await fetch(`/api/projects/requisitions?projectId=${project.id}`);
            if (res.ok) setRequisitions(await res.json());
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    }, [project.id]);

    const fetchPurchaseOrders = useCallback(async () => {
        try {
            const res = await fetch(`/api/projects/purchase-orders?projectId=${project.id}`);
            if (res.ok) setPurchaseOrders(await res.json());
        } catch (e) { console.error(e); }
    }, [project.id]);

    const fetchGoodsReceipts = useCallback(async () => {
        try {
            const res = await fetch(`/api/projects/goods-receipts?projectId=${project.id}`);
            if (res.ok) setGoodsReceipts(await res.json());
        } catch (e) { console.error(e); }
    }, [project.id]);

    useEffect(() => {
        if (project?.id) {
            fetchRequisitions();
            fetchPurchaseOrders();
            fetchGoodsReceipts();
        }
    }, [project?.id, fetchRequisitions, fetchPurchaseOrders, fetchGoodsReceipts]);

    const handlePRItemSelect = (idx: number, item: InventoryItem | null) => {
        setPrItemInventory(prev => ({ ...prev, [idx]: item }));
        const items = [...prForm.items];
        if (item) {
            items[idx] = {
                ...items[idx],
                itemCode: item.code,
                description: item.name,
                unit: item.unit || 'NOS',
                estimatedPrice: item.unitPrice || items[idx].estimatedPrice,
                materialId: item.id,
            };
        }
        setPrForm({ ...prForm, items });
    };

    const handlePOItemSelect = (idx: number, item: InventoryItem | null) => {
        setPoItemInventory(prev => ({ ...prev, [idx]: item }));
        const items = [...poForm.items];
        if (item) {
            items[idx] = {
                ...items[idx],
                itemCode: item.code,
                description: item.name,
                unit: item.unit || 'NOS',
                unitPrice: item.unitPrice || items[idx].unitPrice,
                materialId: item.id,
            };
        }
        setPoForm({ ...poForm, items });
    };

    const handleCreatePR = async () => {
        setSubmitting(true);
        try {
            const res = await fetch('/api/projects/requisitions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    projectId: project.id,
                    ...prForm,
                    requestedById: 'system',
                }),
            });
            if (res.ok) {
                setShowPRDialog(false);
                setPrForm({ items: [{ _key: nextKey(), itemCode: '', description: '', unit: 'NOS', quantity: 1, estimatedPrice: 0 }] });
                setPrItemInventory({});
                fetchRequisitions();
                refreshProject();
            }
        } catch (e) { console.error(e); }
        finally { setSubmitting(false); }
    };

    const handleCreatePO = async () => {
        setSubmitting(true);
        try {
            const res = await fetch('/api/projects/purchase-orders', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    projectId: project.id,
                    ...poForm,
                }),
            });
            if (res.ok) {
                setShowPODialog(false);
                setPoForm({ items: [{ _key: nextKey(), itemCode: '', description: '', unit: 'NOS', quantity: 1, unitPrice: 0 }] });
                setPoItemInventory({});
                fetchPurchaseOrders();
                refreshProject();
            }
        } catch (e) { console.error(e); }
        finally { setSubmitting(false); }
    };

    const handleApprove = async (type: string, id: string) => {
        const endpoint = type === 'pr' ? '/api/projects/requisitions'
            : type === 'po' ? '/api/projects/purchase-orders'
                : '/api/projects/goods-receipts';
        await fetch(endpoint, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, status: 'APPROVED', approvedById: 'system' }),
        });
        if (type === 'pr') { fetchRequisitions(); }
        else if (type === 'po') { fetchPurchaseOrders(); }
        else if (type === 'gr') { fetchGoodsReceipts(); }
        refreshProject();
    };

    const statusBadge = (status: string) => {
        const colors: Record<string, string> = {
            DRAFT: 'bg-slate-100 text-slate-600',
            PENDING: 'bg-yellow-100 text-yellow-700',
            APPROVED: 'bg-green-100 text-green-700',
            REJECTED: 'bg-red-100 text-red-700',
            CANCELLED: 'bg-slate-100 text-slate-500',
            ISSUED: 'bg-blue-100 text-blue-700',
            PARTIALLY_RECEIVED: 'bg-orange-100 text-orange-700',
            FULLY_RECEIVED: 'bg-emerald-100 text-emerald-700',
            CLOSED: 'bg-slate-200 text-slate-700',
        };
        return <Badge className={colors[status] || 'bg-slate-100'}>{status.replace('_', ' ')}</Badge>;
    };

    return (
        <div className="space-y-6">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="bg-white border border-slate-200 p-1">
                    <TabsTrigger value="requisitions" className="flex items-center gap-2">
                        <FileText className="w-4 h-4" /> Requisitions
                    </TabsTrigger>
                    <TabsTrigger value="purchase-orders" className="flex items-center gap-2">
                        <ShoppingCart className="w-4 h-4" /> Purchase Orders
                    </TabsTrigger>
                    <TabsTrigger value="goods-receipts" className="flex items-center gap-2">
                        <Package className="w-4 h-4" /> Goods Receipts
                    </TabsTrigger>
                </TabsList>

                {/* REQUISITIONS TAB */}
                <TabsContent value="requisitions" className="space-y-4 mt-4">
                    <div className="flex justify-between items-center">
                        <h3 className="text-lg font-semibold">Material Requisitions</h3>
                        <Dialog open={showPRDialog} onOpenChange={setShowPRDialog}>
                            <DialogTrigger asChild>
                                <Button size="sm"><Plus className="w-4 h-4 mr-1" /> New Requisition</Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-2xl">
                                <DialogHeader>
                                    <DialogTitle>Create Material Requisition</DialogTitle>
                                </DialogHeader>
                                <div className="space-y-4">
                                    <div>
                                        <Label>Title</Label>
                                        <Input value={prForm.title || ''} onChange={e => setPrForm({ ...prForm, title: e.target.value })} placeholder="Requisition title" />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <Label>Priority</Label>
                                            <Select value={prForm.priority || 'MEDIUM'} onValueChange={v => setPrForm({ ...prForm, priority: v })}>
                                                <SelectTrigger><SelectValue /></SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="LOW">Low</SelectItem>
                                                    <SelectItem value="MEDIUM">Medium</SelectItem>
                                                    <SelectItem value="HIGH">High</SelectItem>
                                                    <SelectItem value="CRITICAL">Critical</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div>
                                            <Label>Type</Label>
                                            <Select value={prForm.type || 'MATERIAL'} onValueChange={v => setPrForm({ ...prForm, type: v })}>
                                                <SelectTrigger><SelectValue /></SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="MATERIAL">Material</SelectItem>
                                                    <SelectItem value="SERVICE">Service</SelectItem>
                                                    <SelectItem value="EQUIPMENT">Equipment</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                    <div>
                                        <Label>Items</Label>
                                        {prForm.items?.map((item: PRFormItem, i: number) => (
                                            <div key={item._key ?? i} className="space-y-2 mt-2 border p-3 rounded-md">
                                                <div className="flex items-center justify-between">
                                                    <span className="text-xs font-semibold text-slate-500">Item {i + 1}</span>
                                                    <Button variant="ghost" size="sm" onClick={() => {
                                                        setPrForm({ ...prForm, items: prForm.items.filter((_item: PRFormItem, j: number) => j !== i) });
                                                    }}><XCircle className="w-4 h-4 text-red-500" /></Button>
                                                </div>
                                                <SearchableItemSelect
                                                    value={item.materialId || ''}
                                                    onChange={(invItem) => handlePRItemSelect(i, invItem)}
                                                    placeholder="Search inventory item..."
                                                />
                                                <div className="grid grid-cols-4 gap-2">
                                                    <Input placeholder="Code" value={item.itemCode} onChange={e => {
                                                        const items = [...prForm.items];
                                                        items[i].itemCode = e.target.value;
                                                        setPrForm({ ...prForm, items });
                                                    }} />
                                                    <Input placeholder="Description" value={item.description} onChange={e => {
                                                        const items = [...prForm.items];
                                                        items[i].description = e.target.value;
                                                        setPrForm({ ...prForm, items });
                                                    }} />
                                                    <Input type="number" placeholder="Qty" value={item.quantity} onChange={e => {
                                                        const items = [...prForm.items];
                                                        items[i].quantity = +e.target.value;
                                                        setPrForm({ ...prForm, items });
                                                    }} />
                                                    <Input type="number" placeholder="Est. Price" value={item.estimatedPrice} onChange={e => {
                                                        const items = [...prForm.items];
                                                        items[i].estimatedPrice = +e.target.value;
                                                        setPrForm({ ...prForm, items });
                                                    }} />
                                                </div>
                                            </div>
                                        ))}
                                        <Button variant="outline" size="sm" className="mt-2" onClick={() => {
                                            const newKey = nextKey();
                                            setPrForm({ ...prForm, items: [...prForm.items, { _key: newKey, itemCode: '', description: '', unit: 'NOS', quantity: 1, estimatedPrice: 0 }] });
                                        }}><Plus className="w-4 h-4 mr-1" /> Add Item</Button>
                                    </div>
                                </div>
                                <DialogFooter>
                                    <Button variant="outline" onClick={() => setShowPRDialog(false)}>Cancel</Button>
                                    <Button onClick={handleCreatePR} disabled={submitting}>
                                        {submitting && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
                                        Create Requisition
                                    </Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>
                    </div>

                    {loading ? (
                        <div className="flex justify-center py-8"><Loader2 className="w-8 h-8 animate-spin text-slate-400" /></div>
                    ) : requisitions.length === 0 ? (
                        <div className="text-center py-12 text-slate-400">
                            <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
                            <p>No requisitions yet. Create one to get started.</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {requisitions.map((req: Requisition) => (
                                <div key={req.id} className="bg-white rounded-lg border border-slate-200 p-4">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <span className="font-semibold text-sm text-blue-600">{req.prNumber}</span>
                                                {statusBadge(req.status)}
                                            </div>
                                            <h4 className="font-medium mt-1">{req.title}</h4>
                                            <div className="flex gap-4 mt-2 text-sm text-slate-500">
                                                <span>Items: {req.items?.length || 0}</span>
                                                <span>Total: LKR {req.estimatedTotal?.toLocaleString()}</span>
                                                <span>Priority: {req.priority}</span>
                                            </div>
                                        </div>
                                        <div className="flex gap-2">
                                            {req.status === 'DRAFT' && (
                                                <Button size="sm" variant="outline" onClick={() => handleApprove('pr', req.id)}>
                                                    <CheckCircle className="w-4 h-4 mr-1" /> Approve
                                                </Button>
                                            )}
                                            <Dialog>
                                                <DialogTrigger asChild>
                                                    <Button size="sm" variant="ghost">
                                                        <Eye className="w-4 h-4" />
                                                    </Button>
                                                </DialogTrigger>
                                                <DialogContent>
                                                    <DialogHeader>
                                                        <DialogTitle>{req.prNumber} - {req.title}</DialogTitle>
                                                    </DialogHeader>
                                                    <div className="space-y-2">
                                                        {req.items?.map((item: RequisitionItem, i: number) => (
                                                            <div key={i} className="flex justify-between text-sm py-2 border-b">
                                                                <span>{item.itemCode} - {item.description}</span>
                                                                <span>{item.quantity} x LKR {item.estimatedPrice} = LKR {item.totalEstimated?.toLocaleString()}</span>
                                                            </div>
                                                        ))}
                                                        <div className="flex justify-between font-semibold pt-2">
                                                            <span>Total Estimated</span>
                                                            <span>LKR {req.estimatedTotal?.toLocaleString()}</span>
                                                        </div>
                                                    </div>
                                                </DialogContent>
                                            </Dialog>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </TabsContent>

                {/* PURCHASE ORDERS TAB */}
                <TabsContent value="purchase-orders" className="space-y-4 mt-4">
                    <div className="flex justify-between items-center">
                        <h3 className="text-lg font-semibold">Purchase Orders</h3>
                        <Dialog open={showPODialog} onOpenChange={setShowPODialog}>
                            <DialogTrigger asChild>
                                <Button size="sm"><Plus className="w-4 h-4 mr-1" /> New PO</Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-2xl">
                                <DialogHeader>
                                    <DialogTitle>Create Purchase Order</DialogTitle>
                                </DialogHeader>
                                <div className="space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <Label>Title</Label>
                                            <Input value={poForm.title || ''} onChange={e => setPoForm({ ...poForm, title: e.target.value })} />
                                        </div>
                                        <div>
                                            <Label>Vendor ID</Label>
                                            <Input value={poForm.vendorId || ''} onChange={e => setPoForm({ ...poForm, vendorId: e.target.value })} />
                                        </div>
                                    </div>
                                    <div>
                                        <Label>Items</Label>
                                        {poForm.items?.map((item: POFormItem, i: number) => (
                                            <div key={item._key ?? i} className="space-y-2 mt-2 border p-3 rounded-md">
                                                <div className="flex items-center justify-between">
                                                    <span className="text-xs font-semibold text-slate-500">Item {i + 1}</span>
                                                    <Button variant="ghost" size="sm" onClick={() => {
                                                        setPoForm({ ...poForm, items: poForm.items.filter((_item: POFormItem, j: number) => j !== i) });
                                                    }}><XCircle className="w-4 h-4 text-red-500" /></Button>
                                                </div>
                                                <SearchableItemSelect
                                                    value={item.materialId || ''}
                                                    onChange={(invItem) => handlePOItemSelect(i, invItem)}
                                                    placeholder="Search inventory item..."
                                                />
                                                <div className="grid grid-cols-4 gap-2">
                                                    <Input placeholder="Code" value={item.itemCode} onChange={e => {
                                                        const items = [...poForm.items]; items[i].itemCode = e.target.value;
                                                        setPoForm({ ...poForm, items });
                                                    }} />
                                                    <Input placeholder="Description" value={item.description} onChange={e => {
                                                        const items = [...poForm.items]; items[i].description = e.target.value;
                                                        setPoForm({ ...poForm, items });
                                                    }} />
                                                    <Input type="number" placeholder="Qty" value={item.quantity} onChange={e => {
                                                        const items = [...poForm.items]; items[i].quantity = +e.target.value;
                                                        setPoForm({ ...poForm, items });
                                                    }} />
                                                    <Input type="number" placeholder="Unit Price" value={item.unitPrice} onChange={e => {
                                                        const items = [...poForm.items]; items[i].unitPrice = +e.target.value;
                                                        setPoForm({ ...poForm, items });
                                                    }} />
                                                </div>
                                            </div>
                                        ))}
                                        <Button variant="outline" size="sm" className="mt-2" onClick={() => {
                                            const newKey = nextKey();
                                            setPoForm({ ...poForm, items: [...poForm.items, { _key: newKey, itemCode: '', description: '', unit: 'NOS', quantity: 1, unitPrice: 0 }] });
                                        }}><Plus className="w-4 h-4 mr-1" /> Add Item</Button>
                                    </div>
                                </div>
                                <DialogFooter>
                                    <Button variant="outline" onClick={() => setShowPODialog(false)}>Cancel</Button>
                                    <Button onClick={handleCreatePO} disabled={submitting}>
                                        {submitting && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
                                        Create PO
                                    </Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>
                    </div>

                    {purchaseOrders.length === 0 ? (
                        <div className="text-center py-12 text-slate-400">
                            <ShoppingCart className="w-12 h-12 mx-auto mb-2 opacity-50" />
                            <p>No purchase orders yet.</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                             {purchaseOrders.map((po: PurchaseOrder) => (
                                <div key={po.id} className="bg-white rounded-lg border border-slate-200 p-4">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <span className="font-semibold text-sm text-purple-600">{po.poNumber}</span>
                                                {statusBadge(po.status)}
                                            </div>
                                            <h4 className="font-medium mt-1">{po.title}</h4>
                                            <p className="text-sm text-slate-500">Vendor: {po.vendorName}</p>
                                            <div className="flex gap-4 mt-2 text-sm text-slate-500">
                                                <span>Items: {po.items?.length || 0}</span>
                                                <span>Total: LKR {po.totalAmount?.toLocaleString()}</span>
                                                {po.requisition && <span>PR: {po.requisition.prNumber}</span>}
                                            </div>
                                        </div>
                                        <div className="flex gap-2">
                                            {po.status === 'DRAFT' && (
                                                <Button size="sm" variant="outline" onClick={() => handleApprove('po', po.id)}>
                                                    <CheckCircle className="w-4 h-4 mr-1" /> Approve
                                                </Button>
                                            )}
                                            <Dialog>
                                                <DialogTrigger asChild>
                                                    <Button size="sm" variant="ghost">
                                                        <Eye className="w-4 h-4" />
                                                    </Button>
                                                </DialogTrigger>
                                                <DialogContent>
                                                    <DialogHeader>
                                                        <DialogTitle>{po.poNumber} - {po.title}</DialogTitle>
                                                    </DialogHeader>
                                                    <div className="space-y-2">
                                                        {po.items?.map((item: PurchaseOrderItem, i: number) => (
                                                            <div key={i} className="flex justify-between text-sm py-2 border-b">
                                                                <span>{item.itemCode} - {item.description}</span>
                                                                <span>{item.quantity} x LKR {item.unitPrice} = LKR {item.totalPrice?.toLocaleString()}</span>
                                                            </div>
                                                        ))}
                                                        <div className="flex justify-between font-semibold pt-2">
                                                            <span>Total</span>
                                                            <span>LKR {po.totalAmount?.toLocaleString()}</span>
                                                        </div>
                                                    </div>
                                                </DialogContent>
                                            </Dialog>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </TabsContent>

                {/* GOODS RECEIPTS TAB */}
                <TabsContent value="goods-receipts" className="space-y-4 mt-4">
                    <div className="flex justify-between items-center">
                        <h3 className="text-lg font-semibold">Goods Receipts</h3>
                    </div>

                    {goodsReceipts.length === 0 ? (
                        <div className="text-center py-12 text-slate-400">
                            <Package className="w-12 h-12 mx-auto mb-2 opacity-50" />
                            <p>No goods receipts recorded yet.</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {goodsReceipts.map((gr: GoodsReceipt) => (
                                <div key={gr.id} className="bg-white rounded-lg border border-slate-200 p-4">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <span className="font-semibold text-sm text-emerald-600">{gr.grnNumber}</span>
                                                {statusBadge(gr.status)}
                                            </div>
                                            <p className="text-sm text-slate-500 mt-1">
                                                PO: {gr.purchaseOrder?.poNumber} | Vendor: {gr.purchaseOrder?.vendorName}
                                            </p>
                                            <div className="flex gap-4 mt-2 text-sm text-slate-500">
                                                <span>Items: {gr.items?.length || 0}</span>
                                                <span>Date: {new Date(gr.receivedDate).toLocaleDateString()}</span>
                                            </div>
                                        </div>
                                        {gr.status === 'PENDING' && (
                                            <Button size="sm" variant="outline" onClick={() => handleApprove('gr', gr.id)}>
                                                <CheckCircle className="w-4 h-4 mr-1" /> Approve
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </TabsContent>
            </Tabs>
        </div>
    );
}

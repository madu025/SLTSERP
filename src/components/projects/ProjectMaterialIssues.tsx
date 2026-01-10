import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs-new';
import ResponsiveTable from '@/components/ResponsiveTable';
import { Plus, PackageMinus, Warehouse, Search, Undo2, CheckCircle2 } from 'lucide-react';

interface ProjectMaterialIssuesProps {
    project: any;
    refreshProject: () => void;
}

export default function ProjectMaterialIssues({ project, refreshProject }: ProjectMaterialIssuesProps) {
    const [issues, setIssues] = useState<any[]>([]);
    const [returns, setReturns] = useState<any[]>([]);
    const [stores, setStores] = useState<any[]>([]);
    const [inventoryItems, setInventoryItems] = useState<any[]>([]);

    const [isIssueOpen, setIsIssueOpen] = useState(false);
    const [isReturnOpen, setIsReturnOpen] = useState(false);
    const [loading, setLoading] = useState(false);

    // Form State
    const [selectedStore, setSelectedStore] = useState('');
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [remarks, setRemarks] = useState('');
    const [selectedItems, setSelectedItems] = useState<{ itemId: string, quantity: string, condition?: string }[]>([]);

    useEffect(() => {
        if (project?.id) {
            fetchData();
        }
    }, [project?.id]);

    useEffect(() => {
        if (selectedStore) {
            fetchStoreItems(selectedStore);
        }
    }, [selectedStore]);

    const fetchData = async () => {
        // Fetch Issues
        const resIssues = await fetch(`/api/projects/stock-issue?projectId=${project.id}`);
        if (resIssues.ok) setIssues(await resIssues.json());

        // Fetch Returns
        const resReturns = await fetch(`/api/projects/return?projectId=${project.id}`);
        if (resReturns.ok) setReturns(await resReturns.json());

        // Fetch Stores
        const resStores = await fetch('/api/inventory/stores');
        if (resStores.ok) setStores(await resStores.json());
        else setStores([]); // handle fail
    };

    const fetchStoreItems = async (storeId: string) => {
        const res = await fetch(`/api/inventory/stocks?storeId=${storeId}`);
        if (res.ok) setInventoryItems(await res.json());
    };

    const handleAddItemRow = () => setSelectedItems([...selectedItems, { itemId: '', quantity: '' }]);
    const handleRemoveItemRow = (idx: number) => {
        const n = [...selectedItems]; n.splice(idx, 1); setSelectedItems(n);
    };

    const handleSubmitIssue = async () => {
        if (!selectedStore || selectedItems.length === 0) return;
        setLoading(true);
        try {
            const res = await fetch('/api/projects/stock-issue', {
                method: 'POST',
                body: JSON.stringify({
                    projectId: project.id,
                    storeId: selectedStore,
                    issueDate: date,
                    remarks,
                    items: selectedItems
                })
            });
            if (res.ok) {
                setIsIssueOpen(false);
                resetForm();
                fetchData();
            }
        } catch (e) { console.error(e); }
        setLoading(false);
    };

    const handleSubmitReturn = async () => {
        if (!selectedStore || selectedItems.length === 0) return;
        setLoading(true);
        try {
            const res = await fetch('/api/projects/return', {
                method: 'POST',
                body: JSON.stringify({
                    projectId: project.id,
                    storeId: selectedStore,
                    reason: remarks,
                    items: selectedItems // contains condition
                })
            });
            if (res.ok) {
                setIsReturnOpen(false);
                resetForm();
                fetchData();
            }
        } catch (e) { console.error(e); }
        setLoading(false);
    };

    const resetForm = () => {
        setSelectedStore('');
        setRemarks('');
        setSelectedItems([]);
        setDate(new Date().toISOString().split('T')[0]);
    };

    // Approval Mock Actions
    const approveIssue = async (id: string) => {
        if (!confirm('Approve this stock issue? Stock will be deducted.')) return;
        await fetch('/api/projects/stock-issue/approve', {
            method: 'POST',
            body: JSON.stringify({ issueId: id, approvedById: 'ADMIN_ID' })
        });
        fetchData();
        refreshProject();
    };

    const approveReturn = async (id: string) => {
        if (!confirm('Approve this return? Stock will be restored.')) return;
        await fetch('/api/projects/return/approve', {
            method: 'POST',
            body: JSON.stringify({ returnId: id, approvedById: 'ADMIN_ID' })
        });
        fetchData();
        refreshProject();
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h3 className="text-lg font-semibold text-slate-900">Material Management</h3>
                    <p className="text-sm text-slate-500">Manage issues and returns with approval workflow</p>
                </div>
                <div className="flex gap-2">
                    <Button onClick={() => { resetForm(); setIsReturnOpen(true); }} variant="outline" className="gap-2">
                        <Undo2 className="w-4 h-4" /> Return Material
                    </Button>
                    <Button onClick={() => { resetForm(); setIsIssueOpen(true); }} className="gap-2">
                        <PackageMinus className="w-4 h-4" /> Issue Material
                    </Button>
                </div>
            </div>

            <Tabs defaultValue="issues">
                <TabsList>
                    <TabsTrigger value="issues">Issued Materials</TabsTrigger>
                    <TabsTrigger value="returns">Returned Materials</TabsTrigger>
                </TabsList>

                <TabsContent value="issues">
                    <Card>
                        <ResponsiveTable>
                            <table className="min-w-full divide-y divide-slate-200">
                                <thead className="bg-slate-50">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Issue No</th>
                                        <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Date</th>
                                        <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Store</th>
                                        <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Items</th>
                                        <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Status</th>
                                        <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-slate-200">
                                    {issues.map((issue) => (
                                        <tr key={issue.id}>
                                            <td className="px-6 py-4 text-sm font-medium">{issue.issueNumber}</td>
                                            <td className="px-6 py-4 text-sm">{new Date(issue.createdAt).toLocaleDateString()}</td>
                                            <td className="px-6 py-4 text-sm">{issue.store?.name}</td>
                                            <td className="px-6 py-4 text-sm">
                                                {issue.items.map((i: any) => (
                                                    <div key={i.id}>{i.item.name}: {i.quantity} {i.item.unit}</div>
                                                ))}
                                            </td>
                                            <td className="px-6 py-4 text-sm">
                                                <Badge className={issue.status === 'APPROVED' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}>
                                                    {issue.status}
                                                </Badge>
                                            </td>
                                            <td className="px-6 py-4 text-sm">
                                                {issue.status === 'PENDING' && (
                                                    <Button size="sm" onClick={() => approveIssue(issue.id)}>Approve</Button>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                    {issues.length === 0 && <tr><td colSpan={6} className="px-6 py-8 text-center text-slate-500">No issues found</td></tr>}
                                </tbody>
                            </table>
                        </ResponsiveTable>
                    </Card>
                </TabsContent>

                <TabsContent value="returns">
                    <Card>
                        <ResponsiveTable>
                            <table className="min-w-full divide-y divide-slate-200">
                                <thead className="bg-slate-50">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Return No</th>
                                        <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Store</th>
                                        <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Items</th>
                                        <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Status</th>
                                        <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-slate-200">
                                    {returns.map((ret) => (
                                        <tr key={ret.id}>
                                            <td className="px-6 py-4 text-sm font-medium">{ret.returnNumber}</td>
                                            <td className="px-6 py-4 text-sm">{ret.store?.name}</td>
                                            <td className="px-6 py-4 text-sm">
                                                {ret.items.map((i: any) => (
                                                    <div key={i.id}>{i.item.name}: {i.quantity}</div>
                                                ))}
                                            </td>
                                            <td className="px-6 py-4 text-sm">
                                                <Badge className={ret.status === 'APPROVED' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}>
                                                    {ret.status}
                                                </Badge>
                                            </td>
                                            <td className="px-6 py-4 text-sm">
                                                {ret.status === 'PENDING' && (
                                                    <Button size="sm" onClick={() => approveReturn(ret.id)}>Approve</Button>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                    {returns.length === 0 && <tr><td colSpan={5} className="px-6 py-8 text-center text-slate-500">No returns found</td></tr>}
                                </tbody>
                            </table>
                        </ResponsiveTable>
                    </Card>
                </TabsContent>
            </Tabs>

            {/* Issue Dialog */}
            <Dialog open={isIssueOpen} onOpenChange={setIsIssueOpen}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader><DialogTitle>Request Material Issue</DialogTitle></DialogHeader>
                    {/* Reuse your existing form UI here nicely */}
                    <div className="py-4 space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label>From Store</Label>
                                <Select value={selectedStore} onValueChange={setSelectedStore}>
                                    <SelectTrigger><SelectValue placeholder="Select Store" /></SelectTrigger>
                                    <SelectContent>
                                        {stores.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label>Date</Label>
                                <Input type="date" value={date} onChange={e => setDate(e.target.value)} />
                            </div>
                        </div>
                        <div className="border p-3 rounded-md space-y-2 max-h-60 overflow-y-auto">
                            {selectedItems.map((item, idx) => (
                                <div key={idx} className="flex gap-2 items-center">
                                    <Select value={item.itemId} onValueChange={(v) => {
                                        const n = [...selectedItems]; n[idx].itemId = v; setSelectedItems(n);
                                    }}>
                                        <SelectTrigger className="flex-1"><SelectValue placeholder="Item" /></SelectTrigger>
                                        <SelectContent>
                                            {inventoryItems.map((i: any) => (
                                                <SelectItem key={i.item.id} value={i.item.id}>{i.item.name} (Stock: {i.quantity})</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <Input
                                        className="w-24" placeholder="Qty" type="number"
                                        value={item.quantity}
                                        onChange={(e) => {
                                            const n = [...selectedItems]; n[idx].quantity = e.target.value; setSelectedItems(n);
                                        }}
                                    />
                                    <Button variant="ghost" size="icon" onClick={() => handleRemoveItemRow(idx)}>
                                        <PackageMinus className="w-4 h-4 text-red-500" />
                                    </Button>
                                </div>
                            ))}
                            <Button variant="outline" size="sm" onClick={handleAddItemRow} className="w-full">Add Item</Button>
                        </div>
                        <Label>Remarks</Label>
                        <Textarea value={remarks} onChange={e => setRemarks(e.target.value)} />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsIssueOpen(false)}>Cancel</Button>
                        <Button onClick={handleSubmitIssue} disabled={loading}>Submit Request</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Return Dialog */}
            <Dialog open={isReturnOpen} onOpenChange={setIsReturnOpen}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader><DialogTitle>Return Material to Store</DialogTitle></DialogHeader>
                    <div className="py-4 space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label>To Store</Label>
                                <Select value={selectedStore} onValueChange={setSelectedStore}>
                                    <SelectTrigger><SelectValue placeholder="Select Store" /></SelectTrigger>
                                    <SelectContent>
                                        {stores.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div className="border p-3 rounded-md space-y-2 max-h-60 overflow-y-auto">
                            {selectedItems.map((item, idx) => (
                                <div key={idx} className="flex gap-2 items-center">
                                    <Select value={item.itemId} onValueChange={(v) => {
                                        const n = [...selectedItems]; n[idx].itemId = v; setSelectedItems(n);
                                    }}>
                                        <SelectTrigger className="flex-1"><SelectValue placeholder="Item" /></SelectTrigger>
                                        <SelectContent>
                                            {/* Ideally fetch items from Project BOQ Actuals or just all items */}
                                            {inventoryItems.map((i: any) => (
                                                <SelectItem key={i.item.id} value={i.item.id}>{i.item.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <Input
                                        className="w-24" placeholder="Qty" type="number"
                                        value={item.quantity}
                                        onChange={(e) => {
                                            const n = [...selectedItems]; n[idx].quantity = e.target.value; setSelectedItems(n);
                                        }}
                                    />
                                    <Select value={item.condition || 'GOOD'} onValueChange={(v) => {
                                        const n = [...selectedItems]; n[idx].condition = v; setSelectedItems(n);
                                    }}>
                                        <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="GOOD">Good</SelectItem>
                                            <SelectItem value="DAMAGED">Damaged</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <Button variant="ghost" size="icon" onClick={() => handleRemoveItemRow(idx)}>
                                        <PackageMinus className="w-4 h-4 text-red-500" />
                                    </Button>
                                </div>
                            ))}
                            <Button variant="outline" size="sm" onClick={handleAddItemRow} className="w-full">Add Item</Button>
                        </div>
                        <Label>Reason for Return</Label>
                        <Textarea value={remarks} onChange={e => setRemarks(e.target.value)} />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsReturnOpen(false)}>Cancel</Button>
                        <Button onClick={handleSubmitReturn} disabled={loading}>Submit Return</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

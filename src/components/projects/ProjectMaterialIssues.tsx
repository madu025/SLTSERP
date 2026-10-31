import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import ResponsiveTable from '@/components/ResponsiveTable';
import { ClipboardCheck, PackageMinus, Undo2 } from 'lucide-react';

interface ProjectMaterialIssuesProps {
    project: { id: string };
    refreshProject: () => void;
}

interface Store { id: string; name: string; }
interface MaterialItem { id: string; name: string; unit: string; }
interface StockItemRow { id: string; item: MaterialItem; quantity: number; }
interface StockIssue { id: string; issueNumber: string; status: string; store: Store; items: StockItemRow[]; createdAt: string; materialRequirement?: { task?: { name: string; wbsCode?: string | null } | null; contractorAssignment?: { contractor?: { name: string } | null } | null } | null; }
interface MaterialReturn { id: string; returnNumber: string; status: string; store: Store; issue?: { issueNumber: string } | null; items: StockItemRow[]; }
interface MaterialRequirement {
    id: string;
    status: string;
    requiredQty: number | string;
    reservedQty: number | string;
    issuedQty: number | string;
    shortageQty: number | string;
    item?: MaterialItem & { code?: string };
    task?: { name: string; wbsCode?: string | null };
    contractorAssignment?: { contractor?: { name: string } | null } | null;
    reservations?: { reservation: { id: string; reservationNumber: string; storeId: string; status: string } }[];
    availability: { storeId: string; storeName: string; availableToPromise: number; onHand: number; reserved: number; safetyStock: number }[];
}

export default function ProjectMaterialIssues({ project, refreshProject }: ProjectMaterialIssuesProps) {
    const [issues, setIssues] = useState<StockIssue[]>([]);
    const [returns, setReturns] = useState<MaterialReturn[]>([]);
    const [stores, setStores] = useState<Store[]>([]);
    const [requirements, setRequirements] = useState<MaterialRequirement[]>([]);
    const [reservationStore, setReservationStore] = useState('');
    const [reservationLoading, setReservationLoading] = useState(false);
    const [reservationMessage, setReservationMessage] = useState('');

    const [isIssueOpen, setIsIssueOpen] = useState(false);
    const [isReturnOpen, setIsReturnOpen] = useState(false);
    const [loading, setLoading] = useState(false);

    // Form State
    const [selectedStore, setSelectedStore] = useState('');
    const [selectedIssueId, setSelectedIssueId] = useState('');
    const [selectedReservationId, setSelectedReservationId] = useState('');
    const [selectedRequirementId, setSelectedRequirementId] = useState('');
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [remarks, setRemarks] = useState('');
    const [selectedItems, setSelectedItems] = useState<{ itemId: string, quantity: string, condition?: string }[]>([]);

    const selectedRequirement = requirements.find((requirement) => requirement.id === selectedRequirementId);
    const selectedSourceIssue = issues.find((issue) => issue.id === selectedIssueId);
    const handleAddReturnItem = () => {
        const next = selectedSourceIssue?.items.find((line) => !selectedItems.some((item) => item.itemId === line.item.id));
        if (next) setSelectedItems([...selectedItems, { itemId: next.item.id, quantity: '', condition: 'GOOD' }]);
    };
    const issueableRequirements = requirements.filter((requirement) => requirement.item && Number(requirement.requiredQty) > Number(requirement.issuedQty));

    const fetchData = React.useCallback(async () => {
        if (!project?.id) return;
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

        const resRequirements = await fetch(`/api/projects/${project.id}/material-reservations`);
        if (resRequirements.ok) setRequirements(await resRequirements.json());
    }, [project.id]);

    const runReservationAction = async (action: 'SYNC_REQUIREMENTS' | 'RESERVE') => {
        setReservationLoading(true);
        setReservationMessage('');
        try {
            const res = await fetch(`/api/projects/${project.id}/material-reservations`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action, ...(action === 'RESERVE' ? { storeId: reservationStore } : {}) }),
            });
            const payload = await res.json().catch(() => null);
            if (!res.ok) throw new Error(payload?.message || payload?.error || 'Material reservation action failed');
            if (payload?.status === 'SHORTAGE') {
                setReservationMessage(`${payload.shortages?.length || 0} material requirement(s) have a store shortage. Procurement is required.`);
            } else {
                setReservationMessage(action === 'RESERVE' ? 'Materials reserved. Physical stock is unchanged until issue approval.' : 'BOQ material requirements synced.');
            }
            await fetchData();
        } catch (error) {
            setReservationMessage(error instanceof Error ? error.message : 'Material reservation action failed');
        } finally {
            setReservationLoading(false);
        }
    };

    useEffect(() => {
        if (project?.id) {
            Promise.resolve().then(() => fetchData());
        }
    }, [project?.id, fetchData]);

    const handleRemoveItemRow = (idx: number) => {
        const n = [...selectedItems]; n.splice(idx, 1); setSelectedItems(n);
    };

    const handleRequirementSelect = (requirementId: string) => {
        const requirement = requirements.find((row) => row.id === requirementId);
        setSelectedRequirementId(requirementId);
        setSelectedReservationId('');
        const reservation = requirement?.reservations?.find((entry) => ['RESERVED', 'PARTIAL'].includes(entry.reservation.status));
        const storeId = reservation?.reservation.storeId || requirement?.availability[0]?.storeId || '';
        setSelectedStore(storeId);
        setSelectedItems(requirement?.item ? [{
            itemId: requirement.item.id,
            quantity: String(Math.max(0, Number(requirement.requiredQty) - Number(requirement.issuedQty))),
        }] : []);
    };

    const handleSubmitIssue = async () => {
        if (!selectedStore || !selectedRequirementId || selectedItems.length === 0) return;
        setLoading(true);
        try {
            const res = await fetch('/api/projects/stock-issue', {
                method: 'POST',
                body: JSON.stringify({
                    projectId: project.id,
                    storeId: selectedStore,
                    issueDate: date,
                    remarks,
                    requirementId: selectedRequirementId,
                    ...(selectedReservationId ? { reservationId: selectedReservationId } : {}),
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
        if (!selectedStore || !selectedIssueId || selectedItems.length === 0) return;
        setLoading(true);
        try {
            const res = await fetch('/api/projects/return', {
                method: 'POST',
                body: JSON.stringify({
                    projectId: project.id,
                    storeId: selectedStore,
                    issueId: selectedIssueId,
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
        setSelectedIssueId('');
        setSelectedReservationId('');
        setSelectedRequirementId('');
        setRemarks('');
        setSelectedItems([]);
        setDate(new Date().toISOString().split('T')[0]);
    };

    // Approval Mock Actions
    const approveIssue = async (id: string) => {
        if (!confirm('Approve this stock issue? Stock will be deducted.')) return;
        await fetch('/api/projects/stock-issue/approve', {
            method: 'POST',
            body: JSON.stringify({ issueId: id })
        });
        fetchData();
        refreshProject();
    };

    const approveReturn = async (id: string) => {
        if (!confirm('Approve this return? Stock will be restored.')) return;
        await fetch('/api/projects/return/approve', {
            method: 'POST',
            body: JSON.stringify({ returnId: id })
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

            <Card className="p-4 border-cyan-200 bg-cyan-50">
                <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                        <h4 className="font-semibold text-slate-900 flex items-center gap-2"><ClipboardCheck className="w-4 h-4 text-cyan-700" /> Approved BOQ material planning</h4>
                        <p className="text-sm text-slate-700 mt-1">BOQ approval creates requirements. Reserve from Stores using available-to-promise; physical stock changes only after an approved issue.</p>
                    </div>
                    <div className="flex flex-wrap gap-2 items-center">
                        <Button variant="outline" onClick={() => runReservationAction('SYNC_REQUIREMENTS')} disabled={reservationLoading}>Sync BOQ requirements</Button>
                        <Select value={reservationStore} onValueChange={setReservationStore}>
                            <SelectTrigger className="w-44 bg-white"><SelectValue placeholder="Reservation store" /></SelectTrigger>
                            <SelectContent>{stores.map((store) => <SelectItem key={store.id} value={store.id}>{store.name}</SelectItem>)}</SelectContent>
                        </Select>
                        <Button onClick={() => runReservationAction('RESERVE')} disabled={reservationLoading || !reservationStore}>Reserve available</Button>
                    </div>
                </div>
                {reservationMessage && <p className="mt-3 text-sm font-medium text-slate-800">{reservationMessage}</p>}
                <div className="mt-4 overflow-x-auto">
                    <table className="min-w-full text-sm bg-white">
                        <thead><tr className="border-b bg-slate-100 text-slate-800"><th className="px-3 py-2 text-left">Material / task</th><th className="px-3 py-2 text-right">Required</th><th className="px-3 py-2 text-right">Reserved</th><th className="px-3 py-2 text-right">Issued</th><th className="px-3 py-2 text-left">Status / ATP</th></tr></thead>
                        <tbody>
                            {requirements.slice(0, 12).map((requirement) => {
                                const atp = requirement.availability.reduce((max, row) => Math.max(max, row.availableToPromise), 0);
                                return <tr key={requirement.id} className="border-b border-slate-100">
                                    <td className="px-3 py-2 text-slate-900">{requirement.item?.name || 'Material mapping required'}<span className="block text-xs text-slate-600">{requirement.task?.wbsCode || requirement.task?.name || 'Project BOQ'}</span></td>
                                    <td className="px-3 py-2 text-right text-slate-900">{Number(requirement.requiredQty)}</td>
                                    <td className="px-3 py-2 text-right text-slate-900">{Number(requirement.reservedQty)}</td>
                                    <td className="px-3 py-2 text-right text-slate-900">{Number(requirement.issuedQty)}</td>
                                    <td className="px-3 py-2 text-slate-900"><Badge className={requirement.status === 'SHORTAGE' ? 'bg-red-100 text-red-800' : requirement.status === 'RESERVED' ? 'bg-green-100 text-green-800' : 'bg-slate-200 text-slate-800'}>{requirement.status}</Badge><span className="ml-2 text-xs">ATP {atp}</span></td>
                                </tr>;
                            })}
                            {requirements.length === 0 && <tr><td colSpan={5} className="px-3 py-4 text-center text-slate-600">No approved BOQ material requirements yet.</td></tr>}
                        </tbody>
                    </table>
                </div>
            </Card>

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
                                        <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Task / Contractor</th>
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
                                            <td className="px-6 py-4 text-sm text-slate-800">
                                                <div>{issue.materialRequirement?.task?.wbsCode || 'Project'} · {issue.materialRequirement?.task?.name || 'Unassigned task'}</div>
                                                <div className="text-xs text-slate-600">{issue.materialRequirement?.contractorAssignment?.contractor?.name || 'Contractor not assigned'}</div>
                                            </td>
                                            <td className="px-6 py-4 text-sm">
                                                {issue.items.map((i) => (
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
                                    {issues.length === 0 && <tr><td colSpan={7} className="px-6 py-8 text-center text-slate-500">No issues found</td></tr>}
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
                                            <td className="px-6 py-4 text-sm font-medium">{ret.returnNumber}<div className="text-xs text-slate-600">Source: {ret.issue?.issueNumber || 'Legacy - review required'}</div></td>
                                            <td className="px-6 py-4 text-sm">{ret.store?.name}</td>
                                            <td className="px-6 py-4 text-sm">
                                                {ret.items.map((i) => (
                                                    <div key={i.id}>{i.item.name}: {i.quantity}</div>
                                                ))}
                                            </td>
                                            <td className="px-6 py-4 text-sm">
                                                <Badge className={ret.status === 'APPROVED' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}>
                                                    {ret.status}
                                                </Badge>
                                            </td>
                                            <td className="px-6 py-4 text-sm">
                                                {ret.status === 'PENDING' && !ret.issue && (
                                                    <span className="text-xs font-medium text-amber-800">Requires source Issue Note review</span>
                                                )}
                                                {ret.status === 'PENDING' && ret.issue && (
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
                            <div className="col-span-2">
                                <Label>Task material requirement</Label>
                                <Select value={selectedRequirementId} onValueChange={handleRequirementSelect}>
                                    <SelectTrigger><SelectValue placeholder="Select one task/material requirement" /></SelectTrigger>
                                    <SelectContent>
                                        {issueableRequirements.map((requirement) => (
                                            <SelectItem key={requirement.id} value={requirement.id}>
                                                {requirement.task?.wbsCode || 'Project'} · {requirement.task?.name || 'Unassigned task'} · {requirement.item?.name}
                                                {requirement.contractorAssignment?.contractor?.name ? ` · ${requirement.contractorAssignment.contractor.name}` : ''}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <p className="mt-1 text-xs text-slate-600">Each issue request is linked to one task/material requirement and its assigned contractor.</p>
                            </div>
                            <div>
                                <Label>From Store</Label>
                                <Select value={selectedStore} onValueChange={setSelectedStore}>
                                    <SelectTrigger><SelectValue placeholder="Select Store" /></SelectTrigger>
                                    <SelectContent>
                                        {stores.filter((store) => !selectedRequirement || selectedRequirement.availability.some((row) => row.storeId === store.id)).map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label>Date</Label>
                                <Input type="date" value={date} onChange={e => setDate(e.target.value)} />
                            </div>
                            <div className="col-span-2">
                                <Label>Task reservation (optional)</Label>
                                <Select value={selectedReservationId || 'none'} onValueChange={(value) => setSelectedReservationId(value === 'none' ? '' : value)}>
                                    <SelectTrigger><SelectValue placeholder="Direct issue (ATP check)" /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="none">Direct issue (ATP check)</SelectItem>
                                        {(selectedRequirement?.reservations || []).filter((entry) => ['RESERVED', 'PARTIAL'].includes(entry.reservation.status)).map((entry) => entry.reservation).map((reservation) => (
                                            <SelectItem key={reservation.id} value={reservation.id}>{reservation.reservationNumber} ({reservation.status})</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div className="border p-3 rounded-md space-y-2 max-h-60 overflow-y-auto">
                            {selectedItems.map((item, idx) => (
                                <div key={idx} className="flex gap-2 items-center">
                                    <div className="flex-1 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900">
                                        {selectedRequirement?.item?.name || 'Select a task requirement first'}
                                    </div>
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
                            {!selectedItems.length && <p className="text-sm text-slate-600">Select a task requirement to choose its mapped material.</p>}
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
                        <div>
                            <Label htmlFor="project-return-source-issue">Approved source Issue Note</Label>
                            <Select value={selectedIssueId} onValueChange={(id) => {
                                const issue = issues.find((row) => row.id === id);
                                setSelectedIssueId(id);
                                setSelectedStore(issue?.store.id || '');
                                setSelectedItems(issue?.items[0] ? [{ itemId: issue.items[0].item.id, quantity: '', condition: 'GOOD' }] : []);
                            }}>
                                <SelectTrigger id="project-return-source-issue"><SelectValue placeholder="Select an approved Issue Note" /></SelectTrigger>
                                <SelectContent>
                                    {issues.filter((issue) => issue.status === 'APPROVED').map((issue) => (
                                        <SelectItem key={issue.id} value={issue.id}>{issue.issueNumber} - {issue.store.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label>To Store</Label>
                                <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900">{selectedSourceIssue?.store.name || 'Select a source Issue Note'}</div>
                            </div>
                        </div>
                        <div className="border p-3 rounded-md space-y-2 max-h-60 overflow-y-auto">
                            {selectedItems.map((item, idx) => (
                                <div key={idx} className="flex gap-2 items-center">
                                    <Select value={item.itemId} onValueChange={(value) => {
                                        const next = [...selectedItems]; next[idx] = { ...item, itemId: value }; setSelectedItems(next);
                                    }}>
                                        <SelectTrigger className="flex-1"><SelectValue placeholder="Source item" /></SelectTrigger>
                                        <SelectContent>
                                            {selectedSourceIssue?.items.filter((line) => line.item.id === item.itemId || !selectedItems.some((row) => row.itemId === line.item.id)).map((line) => (
                                                <SelectItem key={line.item.id} value={line.item.id}>{line.item.name}</SelectItem>
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
                            {selectedSourceIssue && selectedItems.length < selectedSourceIssue.items.length && <Button variant="outline" size="sm" onClick={handleAddReturnItem} className="w-full">Add source item</Button>}
                            {!selectedSourceIssue && <p className="text-sm text-slate-600">Select an approved Issue Note to choose returned materials.</p>}
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

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
    DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
    FileEdit, Plus, Eye, CheckCircle, XCircle, Loader2,
    AlertTriangle, DollarSign, Activity, ClipboardCheck,
    ThumbsUp, Ban, Hammer, Archive,
} from 'lucide-react';
import { toast } from 'sonner';


interface Project {
    id: string;
    projectCode: string;
    name: string;
    status: string;
}

interface ChangeOrder {
    id: string;
    coNumber: string;
    title: string;
    type: string;
    priority: string;
    costImpact: number;
    timeImpact: number;
    status: string;
    reason?: string;
    description?: string;
    scopeImpact?: string;
    riskAssessment?: string;
    rejectionReason?: string;
    notes?: string;
    requestedDate?: string;
    createdAt: string;
}

interface ProjectClosureProps {
    project: Project;
    refreshProject: () => void;
}

const STATUS_BADGES: Record<string, { variant: string; className: string; label: string }> = {
    DRAFT: { variant: 'outline', className: 'bg-slate-100 text-slate-700 border-slate-300', label: 'Draft' },
    PENDING_APPROVAL: { variant: 'outline', className: 'bg-yellow-100 text-yellow-700 border-yellow-300', label: 'Pending Approval' },
    APPROVED: { variant: 'outline', className: 'bg-blue-100 text-blue-700 border-blue-300', label: 'Approved' },
    REJECTED: { variant: 'outline', className: 'bg-red-100 text-red-700 border-red-300', label: 'Rejected' },
    IMPLEMENTED: { variant: 'outline', className: 'bg-green-100 text-green-700 border-green-300', label: 'Implemented' },
    CANCELLED: { variant: 'outline', className: 'bg-gray-100 text-gray-500 border-gray-300', label: 'Cancelled' },
};

const PRIORITY_BADGES: Record<string, string> = {
    LOW: 'bg-slate-100 text-slate-600',
    MEDIUM: 'bg-blue-100 text-blue-600',
    HIGH: 'bg-orange-100 text-orange-600',
    CRITICAL: 'bg-red-100 text-red-600',
};

const TYPE_BADGES: Record<string, string> = {
    SCOPE: 'bg-purple-100 text-purple-700',
    TIME: 'bg-cyan-100 text-cyan-700',
    COST: 'bg-emerald-100 text-emerald-700',
    RESOURCE: 'bg-indigo-100 text-indigo-700',
    QUALITY: 'bg-rose-100 text-rose-700',
};

interface ClosureCheckItemProps {
    label: string;
    checked: boolean;
    onToggle: () => void;
}

function ClosureCheckItem({ label, checked, onToggle }: ClosureCheckItemProps) {
    return (
        <label className="flex items-center gap-3 p-3 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer transition-colors">
            <input
                type="checkbox"
                checked={checked}
                onChange={onToggle}
                className="w-5 h-5 rounded border-slate-300 text-primary focus:ring-primary"
            />
            <span className={`text-sm font-medium ${checked ? 'text-slate-400 line-through' : 'text-slate-700'}`}>
                {label}
            </span>
        </label>
    );
}

export default function ProjectClosure({ project, refreshProject }: ProjectClosureProps) {
    const [activeTab, setActiveTab] = useState('change-orders');
    const [changeOrders, setChangeOrders] = useState<ChangeOrder[]>([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [closing, setClosing] = useState(false);

    // Dialog states
    const [showCreateDialog, setShowCreateDialog] = useState(false);
    const [showDetailDialog, setShowDetailDialog] = useState(false);
    const [selectedCO, setSelectedCO] = useState<ChangeOrder | null>(null);
    const [showConfirmClose, setShowConfirmClose] = useState(false);

    // Closure checklist
    const [closureChecks, setClosureChecks] = useState({
        tasksCompleted: false,
        milestonesAchieved: false,
        invoicesSettled: false,
        retentionsReleased: false,
        changeOrdersResolved: false,
        materialsReturned: false,
    });

    // Create form
    const [createForm, setCreateForm] = useState({
        title: '',
        description: '',
        type: 'SCOPE',
        priority: 'MEDIUM',
        reason: '',
        costImpact: 0,
        timeImpact: 0,
        scopeImpact: '',
        riskAssessment: '',
        notes: '',
    });

    // Action dialog
    const [actionReason, setActionReason] = useState('');

    const fetchChangeOrders = useCallback(async () => {
        try {
            const res = await fetch(`/api/projects/change-orders?projectId=${project.id}`);
            if (res.ok) setChangeOrders(await res.json());
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    }, [project.id]);

    useEffect(() => {
        if (project?.id) {
            fetchChangeOrders();
        }
    }, [project?.id, fetchChangeOrders]);

    const handleCreate = async () => {
        setSubmitting(true);
        try {
            const res = await fetch('/api/projects/change-orders', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    projectId: project.id,
                    ...createForm,
                    costImpact: Number(createForm.costImpact) || 0,
                    timeImpact: Number(createForm.timeImpact) || 0,
                }),
            });
            if (res.ok) {
                setShowCreateDialog(false);
                setCreateForm({
                    title: '', description: '', type: 'SCOPE', priority: 'MEDIUM',
                    reason: '', costImpact: 0, timeImpact: 0, scopeImpact: '',
                    riskAssessment: '', notes: '',
                });
                fetchChangeOrders();
            } else {
                const err = await res.json();
                toast.error(err.error || 'Failed to create change order');
            }
        } catch {
toast.error('Failed to create change order');
        } finally {
            setSubmitting(false);
        }
    };

    const handleAction = async (action: string) => {
        if (!selectedCO) return;
        setSubmitting(true);
        try {
            const body: { id: string; action: string; rejectionReason?: string } = { id: selectedCO.id, action };
            if (action === 'REJECT') body.rejectionReason = actionReason;
            if (action === 'UPDATE') {
                toast.error('Edit functionality via dialog coming soon. Use the API directly for now.');
                return;
            }
            const res = await fetch('/api/projects/change-orders', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            if (res.ok) {
                setShowDetailDialog(false);
                setSelectedCO(null);
                setActionReason('');
                fetchChangeOrders();
            } else {
                const err = await res.json();
                toast.error(err.error || 'Action failed');
            }
        } catch {
            toast.error('Action failed');
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Delete this change order? This cannot be undone.')) return;
        try {
            const res = await fetch(`/api/projects/change-orders?id=${id}`, { method: 'DELETE' });
            if (res.ok) fetchChangeOrders();
            else {
                const err = await res.json();
                toast.error(err.error || 'Delete failed');
            }
        } catch {
            toast.error('Delete failed');
        }
    };

    const handleCloseProject = async () => {
        setClosing(true);
        try {
            const res = await fetch('/api/projects', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: project.id, status: 'COMPLETED', progress: 100 }),
            });
            if (res.ok) {
                setShowConfirmClose(false);
                refreshProject();
            } else {
                const err = await res.json();
                toast.error(err.error || 'Failed to close project');
            }
        } catch {
toast.error('Failed to close project');
        } finally {
            setClosing(false);
        }
    };

    // Compute summary stats
    const pendingApprovals = changeOrders.filter(co => co.status === 'PENDING_APPROVAL').length;
    const totalCostImpact = changeOrders.reduce((sum, co) => sum + (co.costImpact || 0), 0);
    const totalTimeImpact = changeOrders.reduce((sum, co) => sum + (co.timeImpact || 0), 0);
    const unresolvedCOs = changeOrders.filter(co => !['IMPLEMENTED', 'CANCELLED', 'REJECTED'].includes(co.status)).length;

    const allChecksPassed = Object.values(closureChecks).every(v => v === true);

    const formatCurrency = (val: number) =>
        new Intl.NumberFormat('en-LK', { style: 'currency', currency: 'LKR', minimumFractionDigits: 2 }).format(val);

    return (
        <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white rounded-xl border border-slate-200 p-4 flex items-start gap-3">
                    <div className="p-2.5 bg-blue-50 rounded-lg text-blue-600 shrink-0">
                        <FileEdit className="w-5 h-5" />
                    </div>
                    <div>
                        <p className="text-xs font-semibold text-slate-500 uppercase">Total Change Orders</p>
                        <p className="text-2xl font-bold text-slate-900 mt-0.5">{changeOrders.length}</p>
                    </div>
                </div>
                <div className="bg-white rounded-xl border border-slate-200 p-4 flex items-start gap-3">
                    <div className="p-2.5 bg-emerald-50 rounded-lg text-emerald-600 shrink-0">
                        <DollarSign className="w-5 h-5" />
                    </div>
                    <div>
                        <p className="text-xs font-semibold text-slate-500 uppercase">Cost Impact</p>
                        <p className="text-2xl font-bold text-slate-900 mt-0.5">{formatCurrency(totalCostImpact)}</p>
                    </div>
                </div>
                <div className="bg-white rounded-xl border border-slate-200 p-4 flex items-start gap-3">
                    <div className="p-2.5 bg-amber-50 rounded-lg text-amber-600 shrink-0">
                        <AlertTriangle className="w-5 h-5" />
                    </div>
                    <div>
                        <p className="text-xs font-semibold text-slate-500 uppercase">Pending Approvals</p>
                        <p className="text-2xl font-bold text-slate-900 mt-0.5">{pendingApprovals}</p>
                    </div>
                </div>
                <div className="bg-white rounded-xl border border-slate-200 p-4 flex items-start gap-3">
                    <div className="p-2.5 bg-purple-50 rounded-lg text-purple-600 shrink-0">
                        <Activity className="w-5 h-5" />
                    </div>
                    <div>
                        <p className="text-xs font-semibold text-slate-500 uppercase">Project Status</p>
                        <p className="text-2xl font-bold text-slate-900 mt-0.5">
                            <Badge className={
                                project.status === 'COMPLETED' ? 'bg-green-100 text-green-700' :
                                    project.status === 'IN_PROGRESS' ? 'bg-blue-100 text-blue-700' :
                                        'bg-yellow-100 text-yellow-700'
                            }>
                                {project.status?.replace(/_/g, ' ') || 'N/A'}
                            </Badge>
                        </p>
                    </div>
                </div>
            </div>

            {/* Main Tabs: Change Orders / Project Closure */}
            <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="bg-white border border-slate-200 p-1">
                    <TabsTrigger value="change-orders" className="px-4 py-2 gap-2">
                        <FileEdit className="w-4 h-4" />
                        Change Orders
                        {unresolvedCOs > 0 && (
                            <span className="ml-1.5 w-5 h-5 rounded-full bg-amber-100 text-amber-700 text-xs font-bold flex items-center justify-center">
                                {unresolvedCOs}
                            </span>
                        )}
                    </TabsTrigger>
                    <TabsTrigger value="closure" className="px-4 py-2 gap-2">
                        <ClipboardCheck className="w-4 h-4" />
                        Project Closure
                    </TabsTrigger>
                </TabsList>

                {/* ========== CHANGE ORDERS TAB ========== */}
                <TabsContent value="change-orders" className="space-y-4 mt-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="text-lg font-semibold text-slate-900">Change Orders</h3>
                            <p className="text-sm text-slate-500">Manage scope, time, and cost changes for this project</p>
                        </div>
                        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
                            <DialogTrigger asChild>
                                <Button className="gap-2">
                                    <Plus className="w-4 h-4" />
                                    New Change Order
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                                <DialogHeader>
                                    <DialogTitle>Create Change Order</DialogTitle>
                                    <DialogDescription>
                                        Document a change to the project scope, timeline, or budget
                                    </DialogDescription>
                                </DialogHeader>
                                <div className="grid gap-4 py-4">
                                    <div className="grid gap-2">
                                        <Label>Title *</Label>
                                        <Input
                                            value={createForm.title}
                                            onChange={(e) => setCreateForm({ ...createForm, title: e.target.value })}
                                            placeholder="Brief title describing the change"
                                        />
                                    </div>
                                    <div className="grid gap-2">
                                        <Label>Description</Label>
                                        <Textarea
                                            value={createForm.description}
                                            onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                                            placeholder="Detailed description of the change"
                                            rows={3}
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="grid gap-2">
                                            <Label>Type</Label>
                                            <Select
                                                value={createForm.type}
                                                onValueChange={(v) => setCreateForm({ ...createForm, type: v })}
                                            >
                                                <SelectTrigger><SelectValue /></SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="SCOPE">Scope</SelectItem>
                                                    <SelectItem value="TIME">Time</SelectItem>
                                                    <SelectItem value="COST">Cost</SelectItem>
                                                    <SelectItem value="RESOURCE">Resource</SelectItem>
                                                    <SelectItem value="QUALITY">Quality</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="grid gap-2">
                                            <Label>Priority</Label>
                                            <Select
                                                value={createForm.priority}
                                                onValueChange={(v) => setCreateForm({ ...createForm, priority: v })}
                                            >
                                                <SelectTrigger><SelectValue /></SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="LOW">Low</SelectItem>
                                                    <SelectItem value="MEDIUM">Medium</SelectItem>
                                                    <SelectItem value="HIGH">High</SelectItem>
                                                    <SelectItem value="CRITICAL">Critical</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                    <div className="grid gap-2">
                                        <Label>Reason</Label>
                                        <Select
                                            value={createForm.reason}
                                            onValueChange={(v) => setCreateForm({ ...createForm, reason: v })}
                                        >
                                            <SelectTrigger><SelectValue placeholder="Select reason..." /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="CLIENT_REQUEST">Client Request</SelectItem>
                                                <SelectItem value="DESIGN_CHANGE">Design Change</SelectItem>
                                                <SelectItem value="SITE_CONDITION">Site Condition</SelectItem>
                                                <SelectItem value="REGULATORY">Regulatory</SelectItem>
                                                <SelectItem value="OTHER">Other</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="grid gap-2">
                                            <Label>Cost Impact (LKR)</Label>
                                            <Input
                                                type="number"
                                                value={createForm.costImpact}
                                                onChange={(e) => setCreateForm({ ...createForm, costImpact: parseFloat(e.target.value) || 0 })}
                                            />
                                        </div>
                                        <div className="grid gap-2">
                                            <Label>Time Impact (days)</Label>
                                            <Input
                                                type="number"
                                                value={createForm.timeImpact}
                                                onChange={(e) => setCreateForm({ ...createForm, timeImpact: parseInt(e.target.value) || 0 })}
                                            />
                                        </div>
                                    </div>
                                    <div className="grid gap-2">
                                        <Label>Scope Impact</Label>
                                        <Textarea
                                            value={createForm.scopeImpact}
                                            onChange={(e) => setCreateForm({ ...createForm, scopeImpact: e.target.value })}
                                            placeholder="Describe how the scope is affected"
                                            rows={2}
                                        />
                                    </div>
                                    <div className="grid gap-2">
                                        <Label>Risk Assessment</Label>
                                        <Textarea
                                            value={createForm.riskAssessment}
                                            onChange={(e) => setCreateForm({ ...createForm, riskAssessment: e.target.value })}
                                            placeholder="Identify and assess risks associated with this change"
                                            rows={2}
                                        />
                                    </div>
                                    <div className="grid gap-2">
                                        <Label>Notes</Label>
                                        <Textarea
                                            value={createForm.notes}
                                            onChange={(e) => setCreateForm({ ...createForm, notes: e.target.value })}
                                            placeholder="Additional notes or comments"
                                            rows={2}
                                        />
                                    </div>
                                </div>
                                <DialogFooter>
                                    <Button variant="outline" onClick={() => setShowCreateDialog(false)}>Cancel</Button>
                                    <Button onClick={handleCreate} disabled={submitting || !createForm.title}>
                                        {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                                        Create as Draft
                                    </Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>
                    </div>

                    {/* Change Orders Table */}
                    {loading ? (
                        <div className="flex justify-center py-12">
                            <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
                        </div>
                    ) : changeOrders.length === 0 ? (
                        <div className="text-center py-12 bg-white rounded-xl border border-slate-200">
                            <FileEdit className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                            <p className="text-slate-500 font-medium">No change orders yet</p>
                            <p className="text-sm text-slate-400 mt-1">Create a change order to track modifications to this project</p>
                        </div>
                    ) : (
                        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead>
                                        <tr className="border-b border-slate-200 bg-slate-50">
                                            <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">CO #</th>
                                            <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Title</th>
                                            <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Type</th>
                                            <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Priority</th>
                                            <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Cost Impact</th>
                                            <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Time Impact</th>
                                            <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Status</th>
                                            <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {changeOrders.map((co: ChangeOrder) => (
                                            <tr key={co.id} className="hover:bg-slate-50 transition-colors">
                                                <td className="px-4 py-3">
                                                    <span className="text-sm font-mono font-medium text-slate-900">{co.coNumber}</span>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <span className="text-sm font-medium text-slate-900 line-clamp-1">{co.title}</span>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <span className={`inline-flex text-xs font-semibold px-2 py-0.5 rounded-full ${TYPE_BADGES[co.type] || 'bg-slate-100 text-slate-700'}`}>
                                                        {co.type}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <span className={`inline-flex text-xs font-semibold px-2 py-0.5 rounded-full ${PRIORITY_BADGES[co.priority] || 'bg-slate-100 text-slate-600'}`}>
                                                        {co.priority}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-sm text-slate-700 font-medium">
                                                    {formatCurrency(co.costImpact || 0)}
                                                </td>
                                                <td className="px-4 py-3 text-sm text-slate-700">
                                                    {co.timeImpact ? `${co.timeImpact}d` : '-'}
                                                </td>
                                                <td className="px-4 py-3">
                                                    <Badge variant="outline" className={`text-xs ${STATUS_BADGES[co.status]?.className || ''}`}>
                                                        {STATUS_BADGES[co.status]?.label || co.status}
                                                    </Badge>
                                                </td>
                                                <td className="px-4 py-3 text-right">
                                                    <div className="flex items-center justify-end gap-1">
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="h-8 w-8 p-0"
                                                            onClick={() => { setSelectedCO(co); setShowDetailDialog(true); }}
                                                        >
                                                            <Eye className="w-4 h-4" />
                                                        </Button>
                                                        {co.status === 'DRAFT' && (
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                                                                onClick={() => handleDelete(co.id)}
                                                            >
                                                                <XCircle className="w-4 h-4" />
                                                            </Button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* Change Order Detail / Action Dialog */}
                    <Dialog open={showDetailDialog} onOpenChange={(open) => { if (!open) { setShowDetailDialog(false); setSelectedCO(null); setActionReason(''); } }}>
                        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                            {selectedCO && (
                                <>
                                    <DialogHeader>
                                        <div className="flex items-center gap-3">
                                            <DialogTitle className="flex items-center gap-2">
                                                <span className="font-mono">{selectedCO.coNumber}</span>
                                                <Badge variant="outline" className={`text-xs ${STATUS_BADGES[selectedCO.status]?.className || ''}`}>
                                                    {STATUS_BADGES[selectedCO.status]?.label || selectedCO.status}
                                                </Badge>
                                            </DialogTitle>
                                        </div>
                                        <DialogDescription className="text-base font-medium text-slate-900 pt-1">
                                            {selectedCO.title}
                                        </DialogDescription>
                                    </DialogHeader>

                                    <div className="grid grid-cols-2 gap-4 text-sm">
                                        <div>
                                            <span className="text-slate-500 font-medium">Type</span>
                                            <p><span className={`inline-flex text-xs font-semibold px-2 py-0.5 rounded-full mt-1 ${TYPE_BADGES[selectedCO.type] || 'bg-slate-100 text-slate-700'}`}>{selectedCO.type}</span></p>
                                        </div>
                                        <div>
                                            <span className="text-slate-500 font-medium">Priority</span>
                                            <p><span className={`inline-flex text-xs font-semibold px-2 py-0.5 rounded-full mt-1 ${PRIORITY_BADGES[selectedCO.priority] || 'bg-slate-100 text-slate-600'}`}>{selectedCO.priority}</span></p>
                                        </div>
                                        {selectedCO.reason && (
                                            <div>
                                                <span className="text-slate-500 font-medium">Reason</span>
                                                <p className="text-slate-900 mt-0.5">{selectedCO.reason.replace(/_/g, ' ')}</p>
                                            </div>
                                        )}
                                        <div>
                                            <span className="text-slate-500 font-medium">Requested Date</span>
                                            <p className="text-slate-900 mt-0.5">{new Date(selectedCO.requestedDate || selectedCO.createdAt).toLocaleDateString()}</p>
                                        </div>
                                    </div>

                                    {selectedCO.description && (
                                        <div>
                                            <h4 className="text-sm font-semibold text-slate-700 mb-1">Description</h4>
                                            <p className="text-sm text-slate-600 bg-slate-50 p-3 rounded-lg">{selectedCO.description}</p>
                                        </div>
                                    )}

                                    <div className="grid grid-cols-3 gap-4">
                                        <div className="bg-slate-50 rounded-lg p-3 text-center">
                                            <p className="text-xs text-slate-500 font-medium mb-1">Cost Impact</p>
                                            <p className={`text-lg font-bold ${(selectedCO.costImpact || 0) >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                                                {formatCurrency(selectedCO.costImpact || 0)}
                                            </p>
                                        </div>
                                        <div className="bg-slate-50 rounded-lg p-3 text-center">
                                            <p className="text-xs text-slate-500 font-medium mb-1">Time Impact</p>
                                            <p className={`text-lg font-bold ${(selectedCO.timeImpact || 0) >= 0 ? 'text-amber-600' : 'text-green-600'}`}>
                                                {selectedCO.timeImpact != null ? `${selectedCO.timeImpact > 0 ? '+' : ''}${selectedCO.timeImpact}d` : '-'}
                                            </p>
                                        </div>
                                        <div className="bg-slate-50 rounded-lg p-3 text-center">
                                            <p className="text-xs text-slate-500 font-medium mb-1">Status</p>
                                            <Badge variant="outline" className={`text-xs mt-1 ${STATUS_BADGES[selectedCO.status]?.className || ''}`}>
                                                {STATUS_BADGES[selectedCO.status]?.label || selectedCO.status}
                                            </Badge>
                                        </div>
                                    </div>

                                    {selectedCO.scopeImpact && (
                                        <div>
                                            <h4 className="text-sm font-semibold text-slate-700 mb-1">Scope Impact</h4>
                                            <p className="text-sm text-slate-600 bg-slate-50 p-3 rounded-lg">{selectedCO.scopeImpact}</p>
                                        </div>
                                    )}

                                    {selectedCO.riskAssessment && (
                                        <div>
                                            <h4 className="text-sm font-semibold text-slate-700 mb-1">Risk Assessment</h4>
                                            <p className="text-sm text-slate-600 bg-slate-50 p-3 rounded-lg">{selectedCO.riskAssessment}</p>
                                        </div>
                                    )}

                                    {selectedCO.rejectionReason && (
                                        <div>
                                            <h4 className="text-sm font-semibold text-red-700 mb-1">Rejection Reason</h4>
                                            <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">{selectedCO.rejectionReason}</p>
                                        </div>
                                    )}

                                    {selectedCO.notes && (
                                        <div>
                                            <h4 className="text-sm font-semibold text-slate-700 mb-1">Notes</h4>
                                            <p className="text-sm text-slate-600 bg-slate-50 p-3 rounded-lg">{selectedCO.notes}</p>
                                        </div>
                                    )}

                                    {/* Rejection reason input */}
                                    {selectedCO.status === 'PENDING_APPROVAL' && (
                                        <div className="grid gap-2">
                                            <Label>Rejection Reason (required if rejecting)</Label>
                                            <Textarea
                                                value={actionReason}
                                                onChange={(e) => setActionReason(e.target.value)}
                                                placeholder="Provide reason for rejection..."
                                                rows={2}
                                            />
                                        </div>
                                    )}

                                    {/* Action buttons based on status */}
                                    <DialogFooter className="flex flex-wrap gap-2 border-t border-slate-200 pt-4">
                                        {selectedCO.status === 'DRAFT' && (
                                            <>
                                                <Button variant="outline" onClick={() => handleDelete(selectedCO.id)} disabled={submitting}>
                                                    <XCircle className="w-4 h-4 mr-1" /> Delete
                                                </Button>
                                                <Button onClick={() => handleAction('SUBMIT')} disabled={submitting}>
                                                    {submitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ThumbsUp className="w-4 h-4 mr-1" />}
                                                    Submit for Approval
                                                </Button>
                                            </>
                                        )}
                                        {selectedCO.status === 'PENDING_APPROVAL' && (
                                            <>
                                                <Button variant="outline" onClick={() => handleAction('CANCEL')} disabled={submitting}>
                                                    <Ban className="w-4 h-4 mr-1" /> Cancel
                                                </Button>
                                                <Button variant="destructive" onClick={() => handleAction('REJECT')} disabled={submitting || !actionReason}>
                                                    {submitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <XCircle className="w-4 h-4 mr-1" />}
                                                    Reject
                                                </Button>
                                                <Button className="bg-blue-600 hover:bg-blue-700" onClick={() => handleAction('APPROVE')} disabled={submitting}>
                                                    {submitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle className="w-4 h-4 mr-1" />}
                                                    Approve
                                                </Button>
                                            </>
                                        )}
                                        {selectedCO.status === 'APPROVED' && (
                                            <>
                                                <Button variant="outline" onClick={() => handleAction('CANCEL')} disabled={submitting}>
                                                    <Ban className="w-4 h-4 mr-1" /> Cancel
                                                </Button>
                                                <Button className="bg-green-600 hover:bg-green-700" onClick={() => handleAction('IMPLEMENT')} disabled={submitting}>
                                                    {submitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Hammer className="w-4 h-4 mr-1" />}
                                                    Implement
                                                </Button>
                                            </>
                                        )}
                                        {(selectedCO.status === 'IMPLEMENTED' || selectedCO.status === 'CANCELLED' || selectedCO.status === 'REJECTED') && (
                                            <Button variant="outline" onClick={() => setShowDetailDialog(false)}>
                                                Close
                                            </Button>
                                        )}
                                    </DialogFooter>
                                </>
                            )}
                        </DialogContent>
                    </Dialog>
                </TabsContent>

                {/* ========== PROJECT CLOSURE TAB ========== */}
                <TabsContent value="closure" className="space-y-6 mt-4">
                    <div>
                        <h3 className="text-lg font-semibold text-slate-900">Project Closure Checklist</h3>
                        <p className="text-sm text-slate-500 mt-1">
                            Complete all checks below before closing the project. All change orders must be resolved.
                        </p>
                    </div>

                    {/* Checks */}
                    <div className="space-y-2">
                        <ClosureCheckItem
                            label="All project tasks are completed"
                            checked={closureChecks.tasksCompleted}
                            onToggle={() => setClosureChecks(prev => ({ ...prev, tasksCompleted: !prev.tasksCompleted }))}
                        />
                        <ClosureCheckItem
                            label="All milestones have been achieved"
                            checked={closureChecks.milestonesAchieved}
                            onToggle={() => setClosureChecks(prev => ({ ...prev, milestonesAchieved: !prev.milestonesAchieved }))}
                        />
                        <ClosureCheckItem
                            label="All invoices have been settled"
                            checked={closureChecks.invoicesSettled}
                            onToggle={() => setClosureChecks(prev => ({ ...prev, invoicesSettled: !prev.invoicesSettled }))}
                        />
                        <ClosureCheckItem
                            label="Retentions have been released"
                            checked={closureChecks.retentionsReleased}
                            onToggle={() => setClosureChecks(prev => ({ ...prev, retentionsReleased: !prev.retentionsReleased }))}
                        />
                        <ClosureCheckItem
                            label={`All change orders are resolved (${unresolvedCOs} unresolved)`}
                            checked={closureChecks.changeOrdersResolved}
                            onToggle={() => setClosureChecks(prev => ({ ...prev, changeOrdersResolved: !prev.changeOrdersResolved }))}
                        />
                        <ClosureCheckItem
                            label="All materials have been returned or accounted for"
                            checked={closureChecks.materialsReturned}
                            onToggle={() => setClosureChecks(prev => ({ ...prev, materialsReturned: !prev.materialsReturned }))}
                        />
                    </div>

                    {/* Resolution warning */}
                    {unresolvedCOs > 0 && (
                        <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
                            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                            <div>
                                <p className="text-sm font-semibold text-amber-800">Unresolved Change Orders</p>
                                <p className="text-sm text-amber-700 mt-0.5">
                                    {unresolvedCOs} change order{unresolvedCOs > 1 ? 's are' : ' is'} still pending. Resolve all change orders
                                    (Approve/Implement/Reject/Cancel) before closing the project.
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Project already completed */}
                    {project.status === 'COMPLETED' && (
                        <div className="flex items-start gap-3 p-4 bg-green-50 border border-green-200 rounded-xl">
                            <CheckCircle className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
                            <div>
                                <p className="text-sm font-semibold text-green-800">Project Completed</p>
                                <p className="text-sm text-green-700 mt-0.5">
                                    This project has already been marked as completed.
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Close Button */}
                    {project.status !== 'COMPLETED' && (
                        <div className="flex justify-end pt-4 border-t border-slate-200">
                            <Dialog open={showConfirmClose} onOpenChange={setShowConfirmClose}>
                                <DialogTrigger asChild>
                                    <Button
                                        size="lg"
                                        disabled={!allChecksPassed}
                                        className="gap-2 bg-green-600 hover:bg-green-700 text-lg px-8 py-6 h-auto"
                                    >
                                        <Archive className="w-5 h-5" />
                                        Close Project
                                    </Button>
                                </DialogTrigger>
                                <DialogContent className="max-w-md">
                                    <DialogHeader>
                                        <DialogTitle>Confirm Project Closure</DialogTitle>
                                        <DialogDescription>
                                            Are you sure you want to close this project? This will mark the project as COMPLETED
                                            with 100% progress. This action can be reversed by updating the project status.
                                        </DialogDescription>
                                    </DialogHeader>
                                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-700">
                                        <p className="font-semibold">Please verify before closing:</p>
                                        <ul className="list-disc list-inside mt-1 space-y-0.5">
                                            <li>Project: {project.name} ({project.projectCode})</li>
                                            <li>Change Orders: {changeOrders.length} total, {unresolvedCOs} unresolved</li>
                                            <li>Total Cost Impact: {formatCurrency(totalCostImpact)}</li>
                                            <li>Total Time Impact: {totalTimeImpact} day{totalTimeImpact !== 1 ? 's' : ''}</li>
                                        </ul>
                                    </div>
                                    <DialogFooter>
                                        <Button variant="outline" onClick={() => setShowConfirmClose(false)}>Cancel</Button>
                                        <Button
                                            className="bg-green-600 hover:bg-green-700"
                                            onClick={handleCloseProject}
                                            disabled={closing}
                                        >
                                            {closing && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                                            Confirm Close
                                        </Button>
                                    </DialogFooter>
                                </DialogContent>
                            </Dialog>
                        </div>
                    )}

                    {!allChecksPassed && project.status !== 'COMPLETED' && (
                        <p className="text-sm text-slate-500 text-center">
                            Complete all checks above to enable the Close Project button
                        </p>
                    )}
                </TabsContent>
            </Tabs>
        </div>
    );
}

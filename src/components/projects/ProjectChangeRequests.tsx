"use client";
import React, { useCallback, useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Plus, Loader2, GitBranch, Clock, CheckCircle2,
  XCircle, FileText, ChevronRight, Info
} from 'lucide-react';
import { toast } from 'sonner';

interface ChangeApproval {
  id: string;
  role: string;
  stepOrder: number;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  approvedAt?: string;
  remarks?: string;
}

interface ChangeRequest {
  id: string;
  requestNumber: string;
  changeType: 'SCOPE' | 'ROUTE' | 'MATERIAL' | 'TIMELINE' | 'BUDGET';
  title: string;
  description?: string;
  costImpact?: number;
  timeImpact?: number;
  status: 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED';
  createdAt: string;
  submittedAt?: string;
  approvals: ChangeApproval[];
}

interface ProjectChangeRequestsProps {
  project: { id: string };
}

const CHANGE_TYPES = ['SCOPE', 'ROUTE', 'MATERIAL', 'TIMELINE', 'BUDGET'] as const;

const TYPE_COLOR: Record<string, string> = {
  SCOPE:    'bg-purple-500/10 text-purple-700 border-purple-500/20',
  ROUTE:    'bg-blue-500/10 text-blue-700 border-blue-500/20',
  MATERIAL: 'bg-amber-500/10 text-amber-700 border-amber-500/20',
  TIMELINE: 'bg-orange-500/10 text-orange-700 border-orange-500/20',
  BUDGET:   'bg-red-500/10 text-red-700 border-red-500/20',
};

const STATUS_CONFIG = {
  DRAFT:     { label: 'Draft',     color: 'bg-muted text-muted-foreground border-border', icon: FileText },
  SUBMITTED: { label: 'Submitted', color: 'bg-blue-500/10 text-blue-700 border-blue-500/20', icon: Clock },
  APPROVED:  { label: 'Approved',  color: 'bg-green-500/10 text-green-700 border-green-500/20', icon: CheckCircle2 },
  REJECTED:  { label: 'Rejected',  color: 'bg-red-500/10 text-red-700 border-red-500/20', icon: XCircle },
};

const APPROVAL_STEP_COLOR: Record<string, string> = {
  PENDING:  'text-muted-foreground bg-muted',
  APPROVED: 'text-green-700 bg-green-500/10',
  REJECTED: 'text-red-700 bg-red-500/10',
};

function getApprovalChainNote(costImpact: number) {
  if (costImpact < 100000) return 'Section Manager approval (1 level)';
  if (costImpact < 500000) return 'Section Manager + AE/Engineer approval (2 levels)';
  return 'Section Manager + AE/Engineer + Finance + Director approval (3 levels)';
}

function fmt(n: number) {
  return new Intl.NumberFormat('en-LK', { style: 'currency', currency: 'LKR', minimumFractionDigits: 0 }).format(n);
}

export default function ProjectChangeRequests({ project }: ProjectChangeRequestsProps) {
  const [requests, setRequests] = useState<ChangeRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [form, setForm] = useState({
    changeType: 'SCOPE' as typeof CHANGE_TYPES[number],
    title: '',
    description: '',
    costImpact: '',
    timeImpact: '',
  });

  const fetchRequests = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/projects/${project.id}/change-requests`, {
        headers: { 'x-user-id': 'current-user' },
      });
      if (!res.ok) throw new Error();
      setRequests(await res.json());
    } catch {
      toast.error('Failed to load change requests');
    } finally {
      setLoading(false);
    }
  }, [project.id]);

  useEffect(() => { fetchRequests(); }, [fetchRequests]);

  const handleCreate = async () => {
    if (!form.title.trim()) { toast.error('Title is required'); return; }
    setCreating(true);
    try {
      const res = await fetch(`/api/projects/${project.id}/change-requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-id': 'current-user' },
        body: JSON.stringify({
          changeType: form.changeType,
          title: form.title,
          description: form.description || undefined,
          costImpact: form.costImpact ? parseFloat(form.costImpact) : undefined,
          timeImpact: form.timeImpact ? parseInt(form.timeImpact) : undefined,
        }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error); }
      toast.success('Change request created');
      setDialogOpen(false);
      setForm({ changeType: 'SCOPE', title: '', description: '', costImpact: '', timeImpact: '' });
      await fetchRequests();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to create change request';
      toast.error(msg);
    } finally {
      setCreating(false);
    }
  };

  const costImpactNum = parseFloat(form.costImpact) || 0;

  return (
    <div className="p-4 md:p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-bold text-foreground">Change Requests</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Scope, route, material, timeline, and budget changes with approval workflow</p>
        </div>
        <Button size="sm" className="gap-1.5 h-8 text-xs" onClick={() => setDialogOpen(true)}>
          <Plus className="w-3.5 h-3.5" /> New CR
        </Button>
      </div>

      {/* Approval Chain Info */}
      <Card className="border-border shadow-none bg-blue-500/5 border-blue-500/20">
        <CardContent className="p-3 flex items-start gap-2">
          <Info className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="text-xs text-blue-700 space-y-0.5">
            <p className="font-semibold">Dynamic Approval Chain</p>
            <p>Cost &lt; LKR 100K → Section Manager (1 level)</p>
            <p>Cost &lt; LKR 500K → Section Manager + AE/Engineer (2 levels)</p>
            <p>Cost ≥ LKR 500K → Section Manager + AE/Engineer + Finance + Director (3 levels)</p>
          </div>
        </CardContent>
      </Card>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-10 gap-2 text-muted-foreground text-sm">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading...
        </div>
      )}

      {/* Empty */}
      {!loading && requests.length === 0 && (
        <div className="text-center py-10 text-muted-foreground text-sm">
          <GitBranch className="w-8 h-8 mx-auto mb-2 opacity-40" />
          No change requests yet. Create one to start the approval workflow.
        </div>
      )}

      {/* CR Table */}
      {!loading && requests.length > 0 && (
        <Card className="border-border shadow-none">
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="text-[10px] font-bold uppercase text-muted-foreground h-8 pl-3">CR Number</TableHead>
                <TableHead className="text-[10px] font-bold uppercase text-muted-foreground h-8">Type</TableHead>
                <TableHead className="text-[10px] font-bold uppercase text-muted-foreground h-8">Title</TableHead>
                <TableHead className="text-[10px] font-bold uppercase text-muted-foreground h-8 text-right">Cost Impact</TableHead>
                <TableHead className="text-[10px] font-bold uppercase text-muted-foreground h-8 text-center">Status</TableHead>
                <TableHead className="text-[10px] font-bold uppercase text-muted-foreground h-8 text-center">Approvals</TableHead>
                <TableHead className="h-8 w-8" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {requests.map((cr) => {
                const sc = STATUS_CONFIG[cr.status];
                const StatusIcon = sc.icon;
                const isExpanded = expandedId === cr.id;
                return (
                  <React.Fragment key={cr.id}>
                    <TableRow
                      className="border-border text-xs hover:bg-muted/40 cursor-pointer"
                      onClick={() => setExpandedId(isExpanded ? null : cr.id)}
                    >
                      <TableCell className="pl-3 font-mono font-medium text-foreground">{cr.requestNumber}</TableCell>
                      <TableCell>
                        <Badge className={`text-[9px] px-1.5 py-0 border ${TYPE_COLOR[cr.changeType] ?? ''}`}>{cr.changeType}</Badge>
                      </TableCell>
                      <TableCell className="font-medium text-foreground max-w-[200px] truncate">{cr.title}</TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {cr.costImpact != null ? fmt(cr.costImpact) : '—'}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge className={`text-[9px] px-1.5 py-0 border ${sc.color} gap-1`}>
                          <StatusIcon className="w-2.5 h-2.5" />{sc.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="text-muted-foreground">
                          {cr.approvals.filter(a => a.status === 'APPROVED').length}/{cr.approvals.length}
                        </span>
                      </TableCell>
                      <TableCell>
                        <ChevronRight className={`w-3.5 h-3.5 text-muted-foreground transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                      </TableCell>
                    </TableRow>

                    {/* Expanded Row: approval chain */}
                    {isExpanded && (
                      <TableRow className="border-border bg-muted/20 hover:bg-muted/20">
                        <TableCell colSpan={7} className="p-3">
                          <div className="space-y-2">
                            {cr.description && (
                              <p className="text-xs text-muted-foreground">{cr.description}</p>
                            )}
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Approval Chain:</span>
                              {cr.approvals.map((ap, i) => (
                                <React.Fragment key={ap.id}>
                                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${APPROVAL_STEP_COLOR[ap.status]}`}>
                                    {ap.role.replace(/_/g, ' ')}
                                  </span>
                                  {i < cr.approvals.length - 1 && (
                                    <ChevronRight className="w-3 h-3 text-muted-foreground" />
                                  )}
                                </React.Fragment>
                              ))}
                            </div>
                            {cr.timeImpact != null && (
                              <p className="text-xs text-muted-foreground">Time Impact: <span className="font-medium text-foreground">{cr.timeImpact} days</span></p>
                            )}
                            <p className="text-[10px] text-muted-foreground">Created: {new Date(cr.createdAt).toLocaleDateString()}</p>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Create Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-base">New Change Request</DialogTitle>
            <DialogDescription className="text-xs">Submit a scope, route, material, timeline or budget change</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Change Type *</Label>
              <Select value={form.changeType} onValueChange={(v) => setForm({ ...form, changeType: v as typeof CHANGE_TYPES[number] })}>
                <SelectTrigger className="h-8 text-xs bg-card border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CHANGE_TYPES.map(t => <SelectItem key={t} value={t} className="text-xs">{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Cost Impact (LKR)</Label>
              <Input
                className="h-8 text-xs bg-card border-border"
                type="number"
                placeholder="0"
                value={form.costImpact}
                onChange={e => setForm({ ...form, costImpact: e.target.value })}
              />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label className="text-xs font-medium">Title *</Label>
              <Input
                className="h-8 text-xs bg-card border-border"
                placeholder="Brief title describing the change"
                value={form.title}
                onChange={e => setForm({ ...form, title: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Time Impact (days)</Label>
              <Input
                className="h-8 text-xs bg-card border-border"
                type="number"
                placeholder="0"
                value={form.timeImpact}
                onChange={e => setForm({ ...form, timeImpact: e.target.value })}
              />
            </div>
            {costImpactNum > 0 && (
              <div className="flex items-center gap-1.5 text-xs text-blue-700 bg-blue-500/10 rounded-md px-2 py-1.5 border border-blue-500/20">
                <Info className="w-3 h-3 flex-shrink-0" />
                <span>{getApprovalChainNote(costImpactNum)}</span>
              </div>
            )}
            <div className="col-span-2 space-y-1.5">
              <Label className="text-xs font-medium">Description</Label>
              <Textarea
                className="text-xs bg-card border-border resize-none"
                rows={2}
                placeholder="Detailed description of the change and justification..."
                value={form.description}
                onChange={e => setForm({ ...form, description: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button size="sm" className="h-8 text-xs" onClick={handleCreate} disabled={creating}>
              {creating ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />Creating...</> : 'Create Change Request'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

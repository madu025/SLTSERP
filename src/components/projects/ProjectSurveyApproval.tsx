'use client';

import { useState, useEffect, useCallback } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  CheckCircle2, XCircle, AlertTriangle, Eye, MapPin,
  Layers, RefreshCw, Check, Flag, ChevronDown,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

// ─── Layer Definitions ─────────────────────────────────────────────────────
const SURVEY_LAYERS = [
  { id: 'survey_new_pole',       name: 'New Poles',          icon: '🪵', color: '#3b82f6' },
  { id: 'survey_existing_pole',  name: 'Existing Poles',     icon: '📍', color: '#8b5cf6' },
  { id: 'survey_joint_closure',  name: 'Joint Closures',     icon: '🔗', color: '#f59e0b' },
  { id: 'survey_enclosure',      name: 'Enclosures (ODF)',   icon: '📦', color: '#10b981' },
  { id: 'survey_fdp',            name: 'FDPs',               icon: '🔲', color: '#06b6d4' },
  { id: 'survey_chamber',        name: 'Chambers',           icon: '⬛', color: '#6366f1' },
  { id: 'survey_road_crossing',  name: 'Road Crossings',     icon: '🛣️',  color: '#ef4444' },
  { id: 'survey_obstruction',    name: 'Obstructions',       icon: '⚠️',  color: '#f97316' },
  { id: 'survey_cable_start',    name: 'Cable A-Ends',       icon: '🔴', color: '#dc2626' },
  { id: 'survey_cable_end',      name: 'Cable B-Ends',       icon: '🟢', color: '#16a34a' },
  { id: 'survey_access_point',   name: 'Access Points',      icon: '🏠', color: '#0ea5e9' },
  { id: 'survey_note',           name: 'Field Notes',        icon: '📝', color: '#64748b' },
];

type VerificationStatus =
  | 'PENDING_VERIFICATION' | 'VERIFIED' | 'APPROVED' | 'REJECTED' | 'FLAGGED';

interface SurveyPoint {
  id: string;
  layerId: string;
  layerName: string;
  latitude: number;
  longitude: number;
  verificationStatus: VerificationStatus;
  verificationStep: string;
  attributes: Record<string, unknown>;
  photoUrls: string[];
  verifiedById?: string;
  verifiedAt?: string;
  approvedById?: string;
  approvedAt?: string;
  rejectionReason?: string;
  createdAt: string;
}

interface Props {
  projectId: string;
}

// ─── Status Badge ──────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<VerificationStatus, { label: string; variant: string; icon: React.ReactNode }> = {
  PENDING_VERIFICATION: {
    label: 'Pending',
    variant: 'bg-amber-100 text-amber-700 border-amber-200',
    icon: <AlertTriangle className="h-3 w-3" />,
  },
  VERIFIED: {
    label: 'Verified',
    variant: 'bg-blue-100 text-blue-700 border-blue-200',
    icon: <CheckCircle2 className="h-3 w-3" />,
  },
  APPROVED: {
    label: 'Approved',
    variant: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    icon: <CheckCircle2 className="h-3 w-3" />,
  },
  REJECTED: {
    label: 'Rejected',
    variant: 'bg-red-100 text-red-700 border-red-200',
    icon: <XCircle className="h-3 w-3" />,
  },
  FLAGGED: {
    label: 'Flagged',
    variant: 'bg-orange-100 text-orange-700 border-orange-200',
    icon: <Flag className="h-3 w-3" />,
  },
};

function StatusBadge({ status }: { status: VerificationStatus }) {
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.PENDING_VERIFICATION;
  return (
    <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border', config.variant)}>
      {config.icon}
      {config.label}
    </span>
  );
}

// ─── Layer Summary Card ────────────────────────────────────────────────────
function LayerSummaryCard({
  layer,
  counts,
  isActive,
  onClick,
}: {
  layer: (typeof SURVEY_LAYERS)[0];
  counts: Record<string, number>;
  isActive: boolean;
  onClick: () => void;
}) {
  const total = counts.total ?? 0;
  const approved = counts.APPROVED ?? 0;
  const pending = counts.PENDING_VERIFICATION ?? 0;
  const progress = total > 0 ? (approved / total) * 100 : 0;

  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full text-left p-3 rounded-xl border transition-all duration-200',
        isActive
          ? 'border-indigo-300 bg-indigo-50 shadow-sm ring-2 ring-indigo-200'
          : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm'
      )}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-lg">{layer.icon}</span>
          <span className="text-xs font-semibold text-slate-700">{layer.name}</span>
        </div>
        <span className="text-xs font-bold text-slate-500">{total}</span>
      </div>
      <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${progress}%`, backgroundColor: layer.color }}
        />
      </div>
      <div className="flex justify-between mt-1">
        <span className="text-[10px] text-slate-400">{pending} pending</span>
        <span className="text-[10px] text-emerald-600 font-medium">{approved} approved</span>
      </div>
    </button>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────
export default function ProjectSurveyApproval({ projectId }: Props) {
  const [activeLayer, setActiveLayer] = useState(SURVEY_LAYERS[0].id);
  const [points, setPoints] = useState<SurveyPoint[]>([]);
  const [summary, setSummary] = useState<Record<string, Record<string, number>>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [selectedPoints, setSelectedPoints] = useState<Set<string>>(new Set());
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [rejectionDialog, setRejectionDialog] = useState<{
    open: boolean; pointId: string; action: 'reject' | 'flag';
  }>({ open: false, pointId: '', action: 'reject' });
  const [rejectionReason, setRejectionReason] = useState('');
  const [isActioning, setIsActioning] = useState(false);
  const [detailPoint, setDetailPoint] = useState<SurveyPoint | null>(null);

  const fetchSummary = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/survey/points?limit=1`);
      const data = await res.json();
      // Fetch per-layer counts
      const layerSummary: Record<string, Record<string, number>> = {};
      await Promise.all(
        SURVEY_LAYERS.map(async (layer) => {
          const r = await fetch(
            `/api/projects/${projectId}/survey/points?layerId=${layer.id}&limit=1000`
          );
          const d = await r.json();
          const counts: Record<string, number> = { total: d.total ?? 0 };
          // Count by status
          if (d.points) {
            for (const pt of d.points) {
              counts[pt.verificationStatus] = (counts[pt.verificationStatus] ?? 0) + 1;
            }
          }
          layerSummary[layer.id] = counts;
        })
      );
      setSummary(layerSummary);
    } catch {
      // ignore
    }
  }, [projectId]);

  const fetchPoints = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({ layerId: activeLayer });
      if (statusFilter) params.set('status', statusFilter);
      const res = await fetch(`/api/projects/${projectId}/survey/points?${params}`);
      const data = await res.json();
      setPoints(data.points ?? []);
    } catch {
      toast.error('Failed to load survey points');
    } finally {
      setIsLoading(false);
    }
  }, [projectId, activeLayer, statusFilter]);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  useEffect(() => {
    setSelectedPoints(new Set());
    fetchPoints();
  }, [fetchPoints]);

  const doAction = async (pointId: string, action: string, reason?: string) => {
    setIsActioning(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/survey/points/${pointId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, reason }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error);
      }
      toast.success(`Point ${action}d successfully`);
      fetchPoints();
      fetchSummary();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setIsActioning(false);
    }
  };

  const doBatchAction = async (action: string) => {
    if (!selectedPoints.size) return;
    setIsActioning(true);
    let succeeded = 0;
    let failed = 0;
    for (const id of selectedPoints) {
      try {
        await fetch(`/api/projects/${projectId}/survey/points/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action }),
        });
        succeeded++;
      } catch {
        failed++;
      }
    }
    toast.success(`${succeeded} point(s) ${action}d${failed > 0 ? `, ${failed} failed` : ''}`);
    setSelectedPoints(new Set());
    fetchPoints();
    fetchSummary();
    setIsActioning(false);
  };

  const toggleSelect = (id: string) => {
    setSelectedPoints((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedPoints.size === points.length) {
      setSelectedPoints(new Set());
    } else {
      setSelectedPoints(new Set(points.map((p) => p.id)));
    }
  };

  const openRejection = (pointId: string, action: 'reject' | 'flag') => {
    setRejectionReason('');
    setRejectionDialog({ open: true, pointId, action });
  };

  const submitRejection = () => {
    if (!rejectionReason.trim()) {
      toast.error('Please provide a reason');
      return;
    }
    doAction(rejectionDialog.pointId, rejectionDialog.action, rejectionReason);
    setRejectionDialog((d) => ({ ...d, open: false }));
  };

  const currentLayerDef = SURVEY_LAYERS.find((l) => l.id === activeLayer);

  return (
    <div className="flex gap-4 h-full">
      {/* Left Panel: Layer List */}
      <div className="w-52 shrink-0 space-y-1.5">
        <div className="flex items-center gap-2 mb-3">
          <Layers className="h-4 w-4 text-indigo-600" />
          <span className="text-sm font-bold text-slate-700">Survey Layers</span>
        </div>
        {SURVEY_LAYERS.map((layer) => (
          <LayerSummaryCard
            key={layer.id}
            layer={layer}
            counts={summary[layer.id] ?? {}}
            isActive={activeLayer === layer.id}
            onClick={() => setActiveLayer(layer.id)}
          />
        ))}
      </div>

      {/* Right Panel: Points Table */}
      <div className="flex-1 min-w-0">
        <Card className="h-full flex flex-col border-slate-200 shadow-sm">
          <CardHeader className="pb-3 border-b border-slate-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{currentLayerDef?.icon}</span>
                <div>
                  <CardTitle className="text-base font-bold text-slate-800">
                    {currentLayerDef?.name}
                  </CardTitle>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {points.length} point(s) loaded
                    {selectedPoints.size > 0 && ` · ${selectedPoints.size} selected`}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {selectedPoints.size > 0 && (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 text-blue-600 border-blue-200 hover:bg-blue-50"
                      onClick={() => doBatchAction('verify')}
                      disabled={isActioning}
                    >
                      <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                      Bulk Verify
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 text-emerald-600 border-emerald-200 hover:bg-emerald-50"
                      onClick={() => doBatchAction('approve')}
                      disabled={isActioning}
                    >
                      <Check className="h-3.5 w-3.5 mr-1" />
                      Bulk Approve
                    </Button>
                  </>
                )}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="h-8">
                      {statusFilter || 'All Status'}
                      <ChevronDown className="h-3.5 w-3.5 ml-1" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => setStatusFilter('')}>All Status</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setStatusFilter('PENDING_VERIFICATION')}>Pending</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setStatusFilter('VERIFIED')}>Verified</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setStatusFilter('APPROVED')}>Approved</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setStatusFilter('REJECTED')}>Rejected</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setStatusFilter('FLAGGED')}>Flagged</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={fetchPoints}>
                  <RefreshCw className={cn('h-3.5 w-3.5', isLoading && 'animate-spin')} />
                </Button>
              </div>
            </div>
          </CardHeader>

          <CardContent className="flex-1 overflow-auto p-0">
            {isLoading ? (
              <div className="p-4 space-y-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full rounded-lg" />
                ))}
              </div>
            ) : points.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-slate-400">
                <MapPin className="h-10 w-10 mb-3 opacity-40" />
                <p className="text-sm font-medium">No survey points found</p>
                <p className="text-xs mt-1">Upload QField data to start</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50/80">
                    <TableHead className="w-10">
                      <input
                        type="checkbox"
                        checked={selectedPoints.size === points.length && points.length > 0}
                        onChange={toggleAll}
                        className="rounded border-slate-300"
                      />
                    </TableHead>
                    <TableHead className="text-xs">Point ID</TableHead>
                    <TableHead className="text-xs">Coordinates</TableHead>
                    <TableHead className="text-xs">Status</TableHead>
                    <TableHead className="text-xs">Step</TableHead>
                    <TableHead className="text-xs">Photos</TableHead>
                    <TableHead className="text-xs text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {points.map((pt) => (
                    <TableRow
                      key={pt.id}
                      className={cn(
                        'hover:bg-slate-50/80 transition-colors',
                        selectedPoints.has(pt.id) && 'bg-indigo-50/60'
                      )}
                    >
                      <TableCell>
                        <input
                          type="checkbox"
                          checked={selectedPoints.has(pt.id)}
                          onChange={() => toggleSelect(pt.id)}
                          className="rounded border-slate-300"
                        />
                      </TableCell>
                      <TableCell className="font-mono text-xs text-slate-600">
                        {pt.id.substring(0, 8)}…
                      </TableCell>
                      <TableCell className="text-xs text-slate-600">
                        <div className="flex items-center gap-1">
                          <MapPin className="h-3 w-3 text-slate-400" />
                          {pt.latitude.toFixed(5)}, {pt.longitude.toFixed(5)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={pt.verificationStatus as VerificationStatus} />
                      </TableCell>
                      <TableCell className="text-xs text-slate-500">
                        {pt.verificationStep}
                      </TableCell>
                      <TableCell>
                        {pt.photoUrls.length > 0 && (
                          <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                            <Eye className="h-3 w-3" />
                            {pt.photoUrls.length}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0"
                            onClick={() => setDetailPoint(pt)}
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                          {pt.verificationStatus === 'PENDING_VERIFICATION' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 text-blue-600 hover:bg-blue-50 text-xs"
                              onClick={() => doAction(pt.id, 'verify')}
                              disabled={isActioning}
                            >
                              Verify
                            </Button>
                          )}
                          {pt.verificationStatus === 'VERIFIED' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 text-emerald-600 hover:bg-emerald-50 text-xs"
                              onClick={() => doAction(pt.id, 'approve')}
                              disabled={isActioning}
                            >
                              Approve
                            </Button>
                          )}
                          {['PENDING_VERIFICATION', 'VERIFIED'].includes(pt.verificationStatus) && (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2 text-orange-600 hover:bg-orange-50 text-xs"
                                onClick={() => openRejection(pt.id, 'flag')}
                                disabled={isActioning}
                              >
                                Flag
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2 text-red-600 hover:bg-red-50 text-xs"
                                onClick={() => openRejection(pt.id, 'reject')}
                                disabled={isActioning}
                              >
                                Reject
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Rejection/Flag Dialog */}
      <Dialog
        open={rejectionDialog.open}
        onOpenChange={(o) => setRejectionDialog((d) => ({ ...d, open: o }))}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {rejectionDialog.action === 'reject' ? 'Reject Point' : 'Flag for Review'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <div>
              <Label className="text-sm font-medium">
                {rejectionDialog.action === 'reject' ? 'Rejection Reason' : 'Flag Reason'}
              </Label>
              <Textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Describe the issue..."
                className="mt-1.5 resize-none"
                rows={3}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setRejectionDialog((d) => ({ ...d, open: false }))}
              >
                Cancel
              </Button>
              <Button
                onClick={submitRejection}
                disabled={isActioning}
                className={
                  rejectionDialog.action === 'reject'
                    ? 'bg-red-600 hover:bg-red-700'
                    : 'bg-orange-500 hover:bg-orange-600'
                }
              >
                {rejectionDialog.action === 'reject' ? 'Reject' : 'Flag'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      {detailPoint && (
        <Dialog open={!!detailPoint} onOpenChange={() => setDetailPoint(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Survey Point Details</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-slate-500">Layer</p>
                  <p className="font-medium">{detailPoint.layerName}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Status</p>
                  <StatusBadge status={detailPoint.verificationStatus as VerificationStatus} />
                </div>
                <div>
                  <p className="text-xs text-slate-500">Latitude</p>
                  <p className="font-mono">{detailPoint.latitude}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Longitude</p>
                  <p className="font-mono">{detailPoint.longitude}</p>
                </div>
              </div>
              {Object.keys(detailPoint.attributes).length > 0 && (
                <div>
                  <p className="text-xs text-slate-500 mb-1">Attributes</p>
                  <div className="bg-slate-50 rounded-lg p-3 space-y-1">
                    {Object.entries(detailPoint.attributes).map(([k, v]) => (
                      <div key={k} className="flex justify-between text-xs">
                        <span className="text-slate-500">{k}</span>
                        <span className="font-medium">{String(v)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {detailPoint.photoUrls.length > 0 && (
                <div>
                  <p className="text-xs text-slate-500 mb-1">Photos</p>
                  <div className="grid grid-cols-3 gap-2">
                    {detailPoint.photoUrls.map((url, i) => (
                      <img
                        key={i}
                        src={url}
                        alt={`Photo ${i + 1}`}
                        className="w-full h-20 object-cover rounded-lg border"
                      />
                    ))}
                  </div>
                </div>
              )}
              {detailPoint.rejectionReason && (
                <div className="bg-red-50 border border-red-100 rounded-lg p-3">
                  <p className="text-xs text-red-700 font-medium">Rejection Reason</p>
                  <p className="text-sm text-red-600 mt-0.5">{detailPoint.rejectionReason}</p>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

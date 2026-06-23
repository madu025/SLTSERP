'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import dynamic from 'next/dynamic';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  CheckCircle2, XCircle, AlertTriangle, Eye, MapPin,
  RefreshCw, Flag, ChevronDown, Search, Map, CheckSquare, ExternalLink
} from 'lucide-react';
import { toast } from 'sonner';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

// Dynamically import Leaflet Map to avoid SSR errors
const SurveyApprovalMap = dynamic(
  () => import('./SurveyApprovalMap'),
  { ssr: false }
);

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
    variant: 'bg-amber-500/10 text-amber-700 border-amber-200/50',
    icon: <AlertTriangle className="h-3 w-3" />,
  },
  VERIFIED: {
    label: 'Verified',
    variant: 'bg-blue-500/10 text-blue-700 border-blue-200/50',
    icon: <CheckCircle2 className="h-3 w-3" />,
  },
  APPROVED: {
    label: 'Approved',
    variant: 'bg-emerald-500/10 text-emerald-700 border-emerald-200/50',
    icon: <CheckCircle2 className="h-3 w-3" />,
  },
  REJECTED: {
    label: 'Rejected',
    variant: 'bg-red-500/10 text-red-700 border-red-200/50',
    icon: <XCircle className="h-3 w-3" />,
  },
  FLAGGED: {
    label: 'Flagged',
    variant: 'bg-orange-500/10 text-orange-700 border-orange-200/50',
    icon: <Flag className="h-3 w-3" />,
  },
};

function StatusBadge({ status }: { status: VerificationStatus }) {
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.PENDING_VERIFICATION;
  return (
    <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border', config.variant)}>
      {config.icon}
      {config.label}
    </span>
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
  
  // Custom states for interactive map and search query
  const [selectedPointOnMap, setSelectedPointOnMap] = useState<SurveyPoint | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAllLayers, setShowAllLayers] = useState(false);
  const [allPoints, setAllPoints] = useState<SurveyPoint[]>([]);
  const [isAllPointsLoading, setIsAllPointsLoading] = useState(false);

  const [rejectionDialog, setRejectionDialog] = useState<{
    open: boolean; pointId: string; action: 'reject' | 'flag';
  }>({ open: false, pointId: '', action: 'reject' });
  const [rejectionReason, setRejectionReason] = useState('');
  const [isActioning, setIsActioning] = useState(false);
  const [detailPoint, setDetailPoint] = useState<SurveyPoint | null>(null);

  const fetchSummary = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/survey/points?limit=1`);
      await res.json();
      
      const layerSummary: Record<string, Record<string, number>> = {};
      await Promise.all(
        SURVEY_LAYERS.map(async (layer) => {
          const r = await fetch(
            `/api/projects/${projectId}/survey/points?layerId=${layer.id}&limit=1000`
          );
          const d = await r.json();
          const counts: Record<string, number> = { total: d.total ?? 0 };
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
      const params = new URLSearchParams({ layerId: activeLayer, limit: '500' });
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

  // Fetch all points of project for the global mapping layer
  const fetchAllPoints = useCallback(async () => {
    setIsAllPointsLoading(true);
    try {
      const params = new URLSearchParams({ limit: '2000' });
      if (statusFilter) params.set('status', statusFilter);
      const res = await fetch(`/api/projects/${projectId}/survey/points?${params}`);
      const data = await res.json();
      setAllPoints(data.points ?? []);
    } catch {
      console.error('Failed to load all survey points for global map');
    } finally {
      setIsAllPointsLoading(false);
    }
  }, [projectId, statusFilter]);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  useEffect(() => {
    setSelectedPoints(new Set());
    fetchPoints();
  }, [fetchPoints]);

  useEffect(() => {
    if (showAllLayers) {
      fetchAllPoints();
    }
  }, [showAllLayers, fetchAllPoints]);

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
      if (showAllLayers) fetchAllPoints();
      
      // Update selected point in memory
      if (selectedPointOnMap?.id === pointId) {
        setSelectedPointOnMap((prev) => {
          if (!prev) return null;
          const updatedStatus: VerificationStatus =
            action === 'verify'
              ? 'VERIFIED'
              : action === 'approve'
              ? 'APPROVED'
              : action === 'reject'
              ? 'REJECTED'
              : 'FLAGGED';
          return { ...prev, verificationStatus: updatedStatus, rejectionReason: reason };
        });
      }
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
        const res = await fetch(`/api/projects/${projectId}/survey/points/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action }),
        });
        if (res.ok) succeeded++;
        else failed++;
      } catch {
        failed++;
      }
    }
    toast.success(`${succeeded} point(s) ${action}d${failed > 0 ? `, ${failed} failed` : ''}`);
    setSelectedPoints(new Set());
    fetchPoints();
    fetchSummary();
    if (showAllLayers) fetchAllPoints();
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
    if (selectedPoints.size === filteredPoints.length) {
      setSelectedPoints(new Set());
    } else {
      setSelectedPoints(new Set(filteredPoints.map((p) => p.id)));
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

  const handlePointSelectFromMap = useCallback((point: SurveyPoint) => {
    setSelectedPointOnMap(point);
    
    // Switch active layer if clicked point is from a different layer
    if (point.layerId !== activeLayer) {
      setActiveLayer(point.layerId);
    }
  }, [activeLayer]);

  // ─── Update Coordinates Handler ─────────────────────────────────────────
  const handleUpdateCoordinates = useCallback(async (pointId: string, latitude: number, longitude: number) => {
    const res = await fetch(`/api/projects/${projectId}/survey/points/${pointId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'update_coordinates', latitude, longitude }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to update coordinates');
    }
    const data = await res.json();
    toast.success('Coordinates updated successfully');

    // Refresh all data views
    fetchPoints();
    fetchSummary();
    if (showAllLayers) fetchAllPoints();

    // Update the selected point marker with new coordinates
    setSelectedPointOnMap((prev) => {
      if (!prev || prev.id !== pointId) return prev;
      return { ...prev, latitude: data.point.latitude, longitude: data.point.longitude };
    });
  }, [projectId, fetchPoints, fetchSummary, showAllLayers, fetchAllPoints]);

  // Client-side text search filter
  const filteredPoints = useMemo(() => {
    return points.filter((pt) => {
      if (!searchQuery) return true;
      const term = searchQuery.toLowerCase();
      if (pt.id.toLowerCase().includes(term)) return true;
      if (pt.verificationStep?.toLowerCase().includes(term)) return true;
      for (const val of Object.values(pt.attributes)) {
        if (String(val).toLowerCase().includes(term)) return true;
      }
      return false;
    });
  }, [points, searchQuery]);

  const currentLayerDef = SURVEY_LAYERS.find((l) => l.id === activeLayer);

  // Overall statistics
  const overallStats = useMemo(() => {
    let total = 0;
    let approved = 0;
    Object.values(summary).forEach((layerCounts) => {
      total += layerCounts.total ?? 0;
      approved += layerCounts.APPROVED ?? 0;
    });
    return { total, approved, pct: total > 0 ? Math.round((approved / total) * 100) : 0 };
  }, [summary]);

  return (
    <div className="flex flex-col xl:flex-row gap-4 h-[calc(100vh-230px)] min-h-[500px] w-full bg-slate-50/50 p-1.5 rounded-2xl border border-slate-100 transition-all duration-300">
      
      {/* ─── Left Pane: Survey Points Console & Layer Selector ─────────────────────────────────── */}
      <div className="w-full xl:w-[380px] shrink-0 flex flex-col h-full bg-white rounded-xl border border-slate-200/60 shadow-sm overflow-hidden p-3">
        
        {/* Layer Dropdown Selector */}
        <div className="mb-3">
          <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 block">
            Select Survey Layer
          </Label>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="w-full justify-between h-10 border-slate-250 bg-white hover:bg-slate-50 shadow-sm text-left px-3">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-base flex-shrink-0">{currentLayerDef?.icon}</span>
                  <div className="flex flex-col min-w-0">
                    <span className="text-xs font-bold text-slate-800 leading-tight truncate">
                      {currentLayerDef?.name}
                    </span>
                    <span className="text-[9px] text-slate-400 font-medium">
                      {summary[activeLayer]?.total ?? 0} points · {summary[activeLayer]?.APPROVED ?? 0} approved
                    </span>
                  </div>
                </div>
                <ChevronDown className="h-4 w-4 text-slate-400 flex-shrink-0 ml-2" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-[350px] max-h-[350px] overflow-y-auto scrollbar-thin" align="start">
              {SURVEY_LAYERS.map((layer) => {
                const counts = summary[layer.id] ?? {};
                const total = counts.total ?? 0;
                const approved = counts.APPROVED ?? 0;
                const progress = total > 0 ? Math.round((approved / total) * 100) : 0;
                return (
                  <DropdownMenuItem
                    key={layer.id}
                    onClick={() => {
                      setActiveLayer(layer.id);
                      setSelectedPointOnMap(null);
                    }}
                    className={cn(
                      "flex items-center justify-between p-2 cursor-pointer transition-colors",
                      activeLayer === layer.id ? "bg-indigo-50/50 font-bold" : "hover:bg-slate-50"
                    )}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-base flex-shrink-0">{layer.icon}</span>
                      <span className="text-xs font-semibold text-slate-700 truncate max-w-[150px]">{layer.name}</span>
                    </div>
                    <div className="flex items-center gap-2 text-right">
                      <span className="text-[10px] text-slate-400 font-medium min-w-[70px]">
                        {approved}/{total} ({progress}%)
                      </span>
                      <div className="w-12 h-1.5 rounded-full bg-slate-100 overflow-hidden flex-shrink-0">
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${progress}%`, backgroundColor: layer.color }}
                        />
                      </div>
                    </div>
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Active Layer Progress Indicator */}
        {currentLayerDef && (
          <div className="mb-3 bg-slate-50 border border-slate-100/80 rounded-xl p-2.5">
            <div className="flex justify-between items-center text-[10px] font-bold text-slate-500 mb-1.5">
              <span className="uppercase tracking-wider">Layer Approval Progress</span>
              <span className="text-indigo-600 font-extrabold">
                {summary[activeLayer]?.total ? Math.round(((summary[activeLayer]?.APPROVED ?? 0) / summary[activeLayer].total) * 100) : 0}%
              </span>
            </div>
            <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${summary[activeLayer]?.total ? ((summary[activeLayer]?.APPROVED ?? 0) / summary[activeLayer].total) * 100 : 0}%`,
                  backgroundColor: currentLayerDef.color
                }}
              />
            </div>
          </div>
        )}

        {/* Points list Filter Console Header */}
        <div className="border border-slate-100 rounded-xl bg-slate-50/40 p-2.5 mb-2.5">
          <div className="flex items-center justify-between mb-2 gap-2">
            <div className="flex items-center gap-1.5">
              <input
                type="checkbox"
                checked={selectedPoints.size === filteredPoints.length && filteredPoints.length > 0}
                onChange={toggleAll}
                className="rounded border-slate-300 h-3.5 w-3.5 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                title="Select all points in active list"
              />
              <span className="text-[11px] font-bold text-slate-600">
                {filteredPoints.length} points · {selectedPoints.size} selected
              </span>
            </div>

            <div className="flex items-center gap-1">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-7 text-[10px] px-2 font-semibold">
                    {statusFilter ? STATUS_CONFIG[statusFilter as VerificationStatus]?.label : 'All Status'}
                    <ChevronDown className="h-3 w-3 ml-1" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="text-xs">
                  <DropdownMenuItem onClick={() => setStatusFilter('')}>All Status</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setStatusFilter('PENDING_VERIFICATION')}>Pending</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setStatusFilter('VERIFIED')}>Verified</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setStatusFilter('APPROVED')}>Approved</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setStatusFilter('REJECTED')}>Rejected</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setStatusFilter('FLAGGED')}>Flagged</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <Button variant="ghost" size="sm" className="h-7 w-7 p-0 hover:bg-slate-100" onClick={fetchPoints}>
                <RefreshCw className={cn('h-3.5 w-3.5 text-slate-500', isLoading && 'animate-spin')} />
              </Button>
            </div>
          </div>

          {/* Search bar */}
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search ID or attributes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-250 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white shadow-inner"
            />
          </div>
        </div>

        {/* Batch Actions Banner */}
        {selectedPoints.size > 0 && (
          <div className="bg-indigo-50/80 border border-indigo-100 rounded-xl px-2.5 py-1.5 mb-2.5 flex items-center justify-between transition-all duration-300">
            <span className="text-[10px] font-bold text-indigo-700 flex items-center gap-1">
              <CheckSquare className="h-3.5 w-3.5" />
              {selectedPoints.size} selected
            </span>
            <div className="flex gap-1">
              <Button
                size="sm"
                variant="outline"
                className="h-6 text-[9px] bg-white text-blue-600 border-blue-200 hover:bg-blue-50 font-bold"
                onClick={() => doBatchAction('verify')}
                disabled={isActioning}
              >
                Bulk Verify
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-6 text-[9px] bg-white text-emerald-600 border-emerald-200 hover:bg-emerald-50 font-bold"
                onClick={() => doBatchAction('approve')}
                disabled={isActioning}
              >
                Bulk Approve
              </Button>
            </div>
          </div>
        )}

        {/* Console Points List */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-100 border border-slate-100 rounded-xl pr-0.5 scrollbar-thin">
          {isLoading ? (
            <div className="p-3 space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full rounded-lg" />
              ))}
            </div>
          ) : filteredPoints.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-slate-400 p-6">
              <MapPin className="h-8 w-8 mb-2 opacity-30 text-indigo-600" />
              <p className="text-xs font-semibold text-slate-600">No survey points found</p>
              <p className="text-[10px] text-slate-400 mt-0.5 text-center">
                Try switching filters or upload QField survey packages to start.
              </p>
            </div>
          ) : (
            filteredPoints.map((pt) => {
              const isSelected = selectedPointOnMap?.id === pt.id;
              return (
                <div
                  key={pt.id}
                  onClick={() => setSelectedPointOnMap(pt)}
                  className={cn(
                    'p-3.5 hover:bg-slate-50/60 cursor-pointer transition-all duration-200 flex gap-2.5 items-start relative border-l-4',
                    isSelected
                      ? 'bg-indigo-50/30 border-l-indigo-600 shadow-sm'
                      : 'border-l-transparent'
                  )}
                >
                  {/* Select Checkbox */}
                  <div className="pt-0.5" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selectedPoints.has(pt.id)}
                      onChange={() => toggleSelect(pt.id)}
                      className="rounded border-slate-300 h-3.5 w-3.5 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                    />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-mono text-xs font-bold text-slate-700">
                        #{pt.id.substring(0, 8)}
                      </span>
                      <StatusBadge status={pt.verificationStatus} />
                    </div>

                    {/* Coordinates & Photos */}
                    <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-medium mb-2">
                      <MapPin className="h-3 w-3 text-slate-400" />
                      <span>{pt.latitude.toFixed(5)}, {pt.longitude.toFixed(5)}</span>
                      {pt.photoUrls.length > 0 && (
                        <span className="ml-auto inline-flex items-center gap-0.5 px-1 py-0.5 bg-slate-100 text-slate-500 rounded text-[9px] font-semibold">
                          <Eye className="h-2.5 w-2.5" />
                          {pt.photoUrls.length} pic
                        </span>
                      )}
                    </div>

                    {/* Custom Attributes Snippet */}
                    {Object.keys(pt.attributes).length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-2">
                        {Object.entries(pt.attributes).slice(0, 3).map(([k, v]) => (
                          <span key={k} className="inline-flex items-center px-1.5 py-0.5 rounded bg-slate-50 border border-slate-100 text-[9px] text-slate-500 max-w-[120px] truncate font-medium">
                            <span className="text-slate-400 font-bold mr-0.5">{k.replace(/_/g, ' ')}:</span>
                            {String(v)}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Row Hover Actions */}
                    <div className="flex items-center justify-end gap-1.5 pt-1.5 mt-1 border-t border-slate-100/50">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-slate-400 hover:text-slate-700 text-[10px] font-semibold"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDetailPoint(pt);
                        }}
                      >
                        Details
                      </Button>
                      
                      {pt.verificationStatus === 'PENDING_VERIFICATION' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2 text-blue-600 hover:bg-blue-50 text-[10px] font-bold"
                          onClick={(e) => {
                            e.stopPropagation();
                            doAction(pt.id, 'verify');
                          }}
                          disabled={isActioning}
                        >
                          Verify
                        </Button>
                      )}
                      
                      {pt.verificationStatus === 'VERIFIED' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2 text-emerald-600 hover:bg-emerald-50 text-[10px] font-bold"
                          onClick={(e) => {
                            e.stopPropagation();
                            doAction(pt.id, 'approve');
                          }}
                          disabled={isActioning}
                        >
                          Approve
                        </Button>
                      )}

                      {['PENDING_VERIFICATION', 'VERIFIED'].includes(pt.verificationStatus) && (
                        <div className="flex gap-0.5" onClick={(e) => e.stopPropagation()}>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-1.5 text-orange-500 hover:text-orange-600 text-[10px] font-medium"
                            onClick={() => openRejection(pt.id, 'flag')}
                            disabled={isActioning}
                          >
                            Flag
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-1.5 text-red-500 hover:text-red-600 text-[10px] font-medium"
                            onClick={() => openRejection(pt.id, 'reject')}
                            disabled={isActioning}
                          >
                            Reject
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ─── Pane 3: Right Interactive Leaflet Map ───────────────────────────────── */}
      <div className="flex-1 h-full flex flex-col min-w-[300px] bg-white rounded-xl border border-slate-200/60 p-2 shadow-sm relative overflow-hidden">
        
        {/* Floating Top Left Control Box (Glassmorphic) */}
        <div className="absolute top-4 left-4 z-[1000] bg-white/80 backdrop-blur border border-slate-200/60 shadow-lg rounded-xl p-3 max-w-[280px]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <Map className="h-3.5 w-3.5 text-indigo-600" />
              Project Spatial Canvas
            </span>
          </div>

          {/* Toggle show all layers */}
          <div className="flex items-center justify-between gap-6 pt-1">
            <Label htmlFor="all-layers" className="text-[11px] font-bold text-slate-500 cursor-pointer">
              Show All Project Layers
            </Label>
            <Switch
              id="all-layers"
              checked={showAllLayers}
              onCheckedChange={setShowAllLayers}
              className="data-[state=checked]:bg-indigo-600"
            />
          </div>

          {isAllPointsLoading && (
            <p className="text-[9px] text-indigo-500 font-semibold mt-1 animate-pulse">
              Loading spatial data for all layers...
            </p>
          )}
        </div>

        {/* Floating Bottom Left Completion Overlay */}
        <div className="absolute bottom-4 left-4 z-[1000] bg-slate-900/90 backdrop-blur border border-slate-850 shadow-xl rounded-xl p-3 text-white min-w-[200px]">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Survey Progress</p>
          <div className="flex items-baseline justify-between mt-1 mb-1.5">
            <span className="text-lg font-extrabold text-white">
              {overallStats.pct}%
            </span>
            <span className="text-[10px] text-slate-400 font-semibold">
              {overallStats.approved} of {overallStats.total} approved
            </span>
          </div>
          <div className="h-1 w-full bg-slate-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-indigo-400 rounded-full transition-all duration-700"
              style={{ width: `${overallStats.pct}%` }}
            />
          </div>
        </div>

        {/* Map Canvas */}
        <div className="flex-1 rounded-lg overflow-hidden">
          <SurveyApprovalMap
            points={showAllLayers ? allPoints : points}
            selectedPoint={selectedPointOnMap}
            onPointSelect={handlePointSelectFromMap}
            onAction={doAction}
            onUpdateCoordinates={handleUpdateCoordinates}
          />
        </div>
      </div>

      {/* ─── Dialogs and Details Overlays ────────────────────────────────────────── */}

      {/* Rejection/Flag Dialog */}
      <Dialog
        open={rejectionDialog.open}
        onOpenChange={(o) => setRejectionDialog((d) => ({ ...d, open: o }))}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm font-extrabold text-slate-800">
              {rejectionDialog.action === 'reject' ? 'Reject Point Result' : 'Flag for Review'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-1">
            <div>
              <Label className="text-xs font-bold text-slate-500">
                {rejectionDialog.action === 'reject' ? 'Rejection Reason' : 'Flag Reason'}
              </Label>
              <Textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Provide details about the issue or required modifications..."
                className="mt-1.5 resize-none text-xs"
                rows={3}
              />
            </div>
            <div className="flex justify-end gap-2 text-xs">
              <Button
                variant="outline"
                onClick={() => setRejectionDialog((d) => ({ ...d, open: false }))}
                className="h-8"
              >
                Cancel
              </Button>
              <Button
                onClick={submitRejection}
                disabled={isActioning}
                className={cn(
                  'h-8 font-bold text-white',
                  rejectionDialog.action === 'reject'
                    ? 'bg-red-600 hover:bg-red-700'
                    : 'bg-orange-500 hover:bg-orange-600'
                )}
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
              <DialogTitle className="text-sm font-extrabold text-slate-800">Survey Point Details</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-4 bg-slate-50 border border-slate-100 rounded-xl p-3">
                <div>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Layer</p>
                  <p className="font-semibold text-slate-700">{detailPoint.layerName}</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Status</p>
                  <StatusBadge status={detailPoint.verificationStatus as VerificationStatus} />
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Latitude</p>
                  <p className="font-mono font-medium text-slate-700">{detailPoint.latitude}</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Longitude</p>
                  <p className="font-mono font-medium text-slate-700">{detailPoint.longitude}</p>
                </div>
              </div>

              {Object.keys(detailPoint.attributes).length > 0 && (
                <div>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1.5">Attributes</p>
                  <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 space-y-1.5 max-h-[160px] overflow-y-auto scrollbar-thin">
                    {Object.entries(detailPoint.attributes).map(([k, v]) => (
                      <div key={k} className="flex justify-between border-b border-slate-100/60 pb-1 last:border-b-0 text-[11px]">
                        <span className="text-slate-400 font-medium">{k.replace(/_/g, ' ')}</span>
                        <span className="font-bold text-slate-750">{String(v)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {detailPoint.photoUrls.length > 0 && (
                <div>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1.5">Photos ({detailPoint.photoUrls.length})</p>
                  <div className="grid grid-cols-3 gap-2">
                    {detailPoint.photoUrls.map((url, i) => (
                      <a
                        key={i}
                        href={url}
                        target="_blank"
                        rel="noreferrer"
                        className="group relative w-full h-24 overflow-hidden rounded-lg border border-slate-200 block"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={url}
                          alt={`Photo ${i + 1}`}
                          className="w-full h-full object-cover group-hover:scale-105 transition-all duration-300"
                        />
                        <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center">
                          <ExternalLink className="h-4 w-4 text-white" />
                        </div>
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {detailPoint.rejectionReason && (
                <div className="bg-red-50 border border-red-100 rounded-xl p-3">
                  <p className="text-[10px] text-red-700 font-bold uppercase tracking-wider flex items-center gap-1">
                    <XCircle className="h-3.5 w-3.5 text-red-500" />
                    Rejection / Flag Reason
                  </p>
                  <p className="text-xs text-red-600 mt-1 leading-normal font-medium">{detailPoint.rejectionReason}</p>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

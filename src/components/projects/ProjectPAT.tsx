'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import {
  CheckCircle2, XCircle, AlertTriangle, Plus, ClipboardList,
  Radio, Wifi, Zap, RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

interface PATPointResult {
  id: string;
  pointReference: string;
  measuredPower?: number;
  acceptedPower?: number;
  powerStatus: 'PASS' | 'FAIL' | 'PENDING';
  fineTuneNeeded: boolean;
  fineTuneType?: string;
  fineTuneNotes?: string;
  photoUrls: string[];
}

interface PATSession {
  id: string;
  patType: 'PRE_PAT' | 'SLT_PAT';
  status: string;
  totalPoints: number;
  passedPoints: number;
  failedPoints: number;
  passRate?: number;
  fineTuneNeeded: boolean;
  conductedAt?: string;
  completedAt?: string;
  pointResults: PATPointResult[];
}

interface Props {
  projectId: string;
}

const PAT_TYPE_CONFIG = {
  PRE_PAT: {
    label: 'Pre-PAT (Contractor)',
    icon: <Radio className="h-4 w-4" />,
    color: 'text-blue-600',
    bg: 'bg-blue-50',
    border: 'border-blue-200',
  },
  SLT_PAT: {
    label: 'SLT PAT (Formal)',
    icon: <Wifi className="h-4 w-4" />,
    color: 'text-indigo-600',
    bg: 'bg-indigo-50',
    border: 'border-indigo-200',
  },
};

const STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-amber-100 text-amber-700',
  IN_PROGRESS: 'bg-blue-100 text-blue-700',
  COMPLETED: 'bg-emerald-100 text-emerald-700',
  FAILED: 'bg-red-100 text-red-700',
  CANCELLED: 'bg-slate-100 text-slate-600',
};

const FINE_TUNE_TYPES = [
  'DP_LOCATION_CHANGE',
  'POLE_SHIFTING',
  'CABLE_REROUTE',
  'SPLICE_REDO',
  'CONNECTOR_REPLACEMENT',
  'OTHER',
];

export default function ProjectPAT({ projectId }: Props) {
  const [sessions, setSessions] = useState<PATSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeSession, setActiveSession] = useState<PATSession | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [addPointDialog, setAddPointDialog] = useState(false);
  const [completeDialog, setCompleteDialog] = useState(false);
  const [newPoint, setNewPoint] = useState({
    pointReference: '',
    measuredPower: '',
    acceptedPower: '',
    fineTuneNeeded: false,
    fineTuneType: '',
    fineTuneNotes: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchSessions = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/pat`);
      const data = await res.json();
      setSessions(data);
      if (data.length > 0 && !activeSession) {
        setActiveSession(data[0]);
      }
    } catch {
      toast.error('Failed to load PAT sessions');
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  const startSession = async (patType: 'PRE_PAT' | 'SLT_PAT') => {
    setIsStarting(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/pat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patType }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error);
      }
      toast.success(`${PAT_TYPE_CONFIG[patType].label} session started`);
      fetchSessions();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to start session');
    } finally {
      setIsStarting(false);
    }
  };

  const submitPoint = async () => {
    if (!activeSession || !newPoint.pointReference) {
      toast.error('Point reference is required');
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/pat/${activeSession.id}/points`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pointReference: newPoint.pointReference,
          measuredPower: newPoint.measuredPower ? parseFloat(newPoint.measuredPower) : undefined,
          acceptedPower: newPoint.acceptedPower ? parseFloat(newPoint.acceptedPower) : undefined,
          fineTuneNeeded: newPoint.fineTuneNeeded,
          fineTuneType: newPoint.fineTuneType || undefined,
          fineTuneNotes: newPoint.fineTuneNotes || undefined,
        }),
      });
      if (!res.ok) throw new Error('Failed to add point');
      toast.success('PAT point recorded');
      setAddPointDialog(false);
      setNewPoint({ pointReference: '', measuredPower: '', acceptedPower: '', fineTuneNeeded: false, fineTuneType: '', fineTuneNotes: '' });
      fetchSessions();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to record point');
    } finally {
      setIsSubmitting(false);
    }
  };

  const completeSession = async () => {
    if (!activeSession) return;
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/pat/${activeSession.id}/points`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'complete' }),
      });
      if (!res.ok) throw new Error('Failed to complete session');
      const data = await res.json();
      toast.success(`Session ${data.passed ? 'PASSED' : 'FAILED'} with ${data.passRate?.toFixed(1)}% pass rate`);
      setCompleteDialog(false);
      fetchSessions();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to complete session');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header Actions */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-bold text-slate-800">PAT Management</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Pre-Acceptance Testing — track fiber power levels and fine-tune requirements
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="border-blue-200 text-blue-600 hover:bg-blue-50"
            onClick={() => startSession('PRE_PAT')}
            disabled={isStarting}
          >
            <Radio className="h-3.5 w-3.5 mr-1.5" />
            Start Pre-PAT
          </Button>
          <Button
            size="sm"
            className="bg-indigo-600 hover:bg-indigo-700"
            onClick={() => startSession('SLT_PAT')}
            disabled={isStarting}
          >
            <Wifi className="h-3.5 w-3.5 mr-1.5" />
            Start SLT PAT
          </Button>
        </div>
      </div>

      {sessions.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-slate-400 rounded-xl border-2 border-dashed border-slate-200">
          <ClipboardList className="h-12 w-12 mb-3 opacity-40" />
          <p className="text-sm font-medium">No PAT sessions yet</p>
          <p className="text-xs mt-1">Start a Pre-PAT session to begin testing</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {/* Session List */}
          <div className="grid grid-cols-3 gap-3">
            {sessions.map((session) => {
              const cfg = PAT_TYPE_CONFIG[session.patType];
              const isActive = activeSession?.id === session.id;
              return (
                <button
                  key={session.id}
                  onClick={() => setActiveSession(session)}
                  className={cn(
                    'p-4 rounded-xl border text-left transition-all duration-200',
                    isActive
                      ? `${cfg.border} ${cfg.bg} ring-2 ring-offset-1 ring-indigo-200`
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  )}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className={cn('flex items-center gap-1.5', cfg.color)}>
                      {cfg.icon}
                      <span className="text-xs font-semibold">{cfg.label}</span>
                    </div>
                    <span className={cn('px-2 py-0.5 rounded-full text-[10px] font-medium', STATUS_COLORS[session.status])}>
                      {session.status}
                    </span>
                  </div>
                  <div className="mb-2">
                    <div className="flex justify-between text-xs text-slate-500 mb-1">
                      <span>Pass Rate</span>
                      <span className="font-bold text-slate-700">{session.passRate?.toFixed(1) ?? '—'}%</span>
                    </div>
                    <Progress value={session.passRate ?? 0} className="h-1.5" />
                  </div>
                  <div className="flex justify-between text-[10px] text-slate-500">
                    <span>✓ {session.passedPoints} Pass</span>
                    <span>✗ {session.failedPoints} Fail</span>
                    <span>⟳ {session.totalPoints - session.passedPoints - session.failedPoints} Pending</span>
                  </div>
                  {session.fineTuneNeeded && (
                    <div className="mt-2 flex items-center gap-1 text-[10px] text-orange-600 bg-orange-50 rounded px-2 py-1">
                      <AlertTriangle className="h-3 w-3" />
                      Fine-tune required
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Active Session Detail */}
          {activeSession && (
            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="pb-3 border-b border-slate-100">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-bold text-slate-800">
                    {PAT_TYPE_CONFIG[activeSession.patType].label} — Point Results
                  </CardTitle>
                  {activeSession.status === 'IN_PROGRESS' && (
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8"
                        onClick={() => setAddPointDialog(true)}
                      >
                        <Plus className="h-3.5 w-3.5 mr-1" />
                        Add Point
                      </Button>
                      <Button
                        size="sm"
                        className="h-8 bg-emerald-600 hover:bg-emerald-700"
                        onClick={() => setCompleteDialog(true)}
                      >
                        Complete Session
                      </Button>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {activeSession.pointResults.length === 0 ? (
                  <div className="flex flex-col items-center py-12 text-slate-400">
                    <Zap className="h-8 w-8 mb-2 opacity-40" />
                    <p className="text-sm">No test points recorded yet</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-50/80">
                        <TableHead className="text-xs">Reference</TableHead>
                        <TableHead className="text-xs">Measured (dBm)</TableHead>
                        <TableHead className="text-xs">Accepted (dBm)</TableHead>
                        <TableHead className="text-xs">Result</TableHead>
                        <TableHead className="text-xs">Fine-tune</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {activeSession.pointResults.map((pt) => (
                        <TableRow key={pt.id}>
                          <TableCell className="font-mono text-xs font-medium">{pt.pointReference}</TableCell>
                          <TableCell className="text-xs">{pt.measuredPower ?? '—'}</TableCell>
                          <TableCell className="text-xs">{pt.acceptedPower ?? '—'}</TableCell>
                          <TableCell>
                            {pt.powerStatus === 'PASS' && (
                              <span className="flex items-center gap-1 text-xs text-emerald-600">
                                <CheckCircle2 className="h-3.5 w-3.5" /> PASS
                              </span>
                            )}
                            {pt.powerStatus === 'FAIL' && (
                              <span className="flex items-center gap-1 text-xs text-red-600">
                                <XCircle className="h-3.5 w-3.5" /> FAIL
                              </span>
                            )}
                            {pt.powerStatus === 'PENDING' && (
                              <span className="text-xs text-slate-400">Pending</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {pt.fineTuneNeeded ? (
                              <div>
                                <span className="inline-flex items-center gap-1 text-[10px] bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full">
                                  <AlertTriangle className="h-3 w-3" />
                                  {pt.fineTuneType || 'Required'}
                                </span>
                                {pt.fineTuneNotes && (
                                  <p className="text-[10px] text-slate-500 mt-0.5">{pt.fineTuneNotes}</p>
                                )}
                              </div>
                            ) : (
                              <span className="text-[10px] text-slate-400">None</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Add Point Dialog */}
      <Dialog open={addPointDialog} onOpenChange={setAddPointDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Record PAT Point</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <Label className="text-xs font-medium">Point Reference *</Label>
              <Input
                value={newPoint.pointReference}
                onChange={(e) => setNewPoint((p) => ({ ...p, pointReference: e.target.value }))}
                placeholder="e.g. FDP-001, Pole-25"
                className="mt-1"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-medium">Measured Power (dBm)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={newPoint.measuredPower}
                  onChange={(e) => setNewPoint((p) => ({ ...p, measuredPower: e.target.value }))}
                  placeholder="-20.5"
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs font-medium">Accepted Threshold (dBm)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={newPoint.acceptedPower}
                  onChange={(e) => setNewPoint((p) => ({ ...p, acceptedPower: e.target.value }))}
                  placeholder="-25.0"
                  className="mt-1"
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="fineTune"
                checked={newPoint.fineTuneNeeded}
                onChange={(e) => setNewPoint((p) => ({ ...p, fineTuneNeeded: e.target.checked }))}
                className="rounded"
              />
              <Label htmlFor="fineTune" className="text-sm font-medium cursor-pointer">
                Fine-tune required
              </Label>
            </div>
            {newPoint.fineTuneNeeded && (
              <div className="space-y-2">
                <div>
                  <Label className="text-xs font-medium">Fine-tune Type</Label>
                  <select
                    value={newPoint.fineTuneType}
                    onChange={(e) => setNewPoint((p) => ({ ...p, fineTuneType: e.target.value }))}
                    className="mt-1 w-full h-9 rounded-md border border-slate-200 bg-white px-3 text-sm"
                  >
                    <option value="">Select type</option>
                    {FINE_TUNE_TYPES.map((t) => (
                      <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label className="text-xs font-medium">Fine-tune Notes</Label>
                  <Textarea
                    value={newPoint.fineTuneNotes}
                    onChange={(e) => setNewPoint((p) => ({ ...p, fineTuneNotes: e.target.value }))}
                    placeholder="Describe what needs to be done..."
                    rows={2}
                    className="mt-1 resize-none"
                  />
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddPointDialog(false)}>Cancel</Button>
            <Button onClick={submitPoint} disabled={isSubmitting}>
              Record Point
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Complete Session Confirmation Dialog */}
      <Dialog open={completeDialog} onOpenChange={setCompleteDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Complete PAT Session?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-600">
            This will finalize the session and calculate the overall pass rate.
            {activeSession?.totalPoints === 0 && (
              <span className="text-red-500 block mt-1">⚠ No points recorded yet.</span>
            )}
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCompleteDialog(false)}>Cancel</Button>
            <Button
              onClick={completeSession}
              disabled={isSubmitting}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              Complete Session
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

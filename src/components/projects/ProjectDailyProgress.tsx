'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Plus, TrendingUp, BarChart3, HardHat, Cable,
  Building, Layers, RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface DailyProgress {
  id: string;
  reportDate: string;
  polesErected: number;
  cablePulled: number;
  chambersInstalled: number;
  closuresInstalled: number;
  jointsCompleted: number;
  fdpsInstalled: number;
  teamSize?: number;
  hoursWorked?: number;
  laborCost: number;
  progressPct: number;
  notes?: string;
  reportedById?: string;
}

interface Props {
  projectId: string;
}

const METRIC_CARDS = [
  { key: 'polesErected', label: 'Poles Erected', icon: <HardHat className="h-4 w-4" />, color: 'text-blue-600', bg: 'bg-blue-50' },
  { key: 'cablePulled', label: 'Cable Pulled (m)', icon: <Cable className="h-4 w-4" />, color: 'text-indigo-600', bg: 'bg-indigo-50' },
  { key: 'chambersInstalled', label: 'Chambers', icon: <Building className="h-4 w-4" />, color: 'text-emerald-600', bg: 'bg-emerald-50' },
  { key: 'closuresInstalled', label: 'Closures', icon: <Layers className="h-4 w-4" />, color: 'text-violet-600', bg: 'bg-violet-50' },
];

export default function ProjectDailyProgress({ projectId }: Props) {
  const [records, setRecords] = useState<DailyProgress[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState({
    reportDate: format(new Date(), 'yyyy-MM-dd'),
    polesErected: '0',
    cablePulled: '0',
    chambersInstalled: '0',
    closuresInstalled: '0',
    jointsCompleted: '0',
    fdpsInstalled: '0',
    teamSize: '',
    hoursWorked: '',
    laborCost: '0',
    progressPct: '0',
    notes: '',
  });

  const fetchRecords = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/daily-progress`);
      const data = await res.json();
      setRecords(Array.isArray(data) ? data : data.records ?? []);
    } catch {
      toast.error('Failed to load daily progress');
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  const submitRecord = async () => {
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/daily-progress`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reportDate: new Date(form.reportDate),
          polesErected: parseInt(form.polesErected) || 0,
          cablePulled: parseFloat(form.cablePulled) || 0,
          chambersInstalled: parseInt(form.chambersInstalled) || 0,
          closuresInstalled: parseInt(form.closuresInstalled) || 0,
          jointsCompleted: parseInt(form.jointsCompleted) || 0,
          fdpsInstalled: parseInt(form.fdpsInstalled) || 0,
          teamSize: form.teamSize ? parseInt(form.teamSize) : undefined,
          hoursWorked: form.hoursWorked ? parseFloat(form.hoursWorked) : undefined,
          laborCost: parseFloat(form.laborCost) || 0,
          progressPct: parseFloat(form.progressPct) || 0,
          notes: form.notes || undefined,
        }),
      });
      if (!res.ok) throw new Error('Failed to save');
      toast.success('Daily progress recorded');
      setShowDialog(false);
      fetchRecords();
    } catch {
      toast.error('Failed to save progress record');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Aggregate cumulative totals
  const totals = records.reduce(
    (acc, r) => ({
      polesErected: acc.polesErected + r.polesErected,
      cablePulled: acc.cablePulled + r.cablePulled,
      chambersInstalled: acc.chambersInstalled + r.chambersInstalled,
      closuresInstalled: acc.closuresInstalled + r.closuresInstalled,
    }),
    { polesErected: 0, cablePulled: 0, chambersInstalled: 0, closuresInstalled: 0 }
  );

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
        </div>
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {METRIC_CARDS.map((card) => (
          <div key={card.key} className={`p-4 rounded-xl border border-slate-200 ${card.bg}`}>
            <div className={`flex items-center gap-2 ${card.color} mb-2`}>
              {card.icon}
              <span className="text-xs font-semibold">{card.label}</span>
            </div>
            <div className="text-2xl font-bold text-slate-800">
              {totals[card.key as keyof typeof totals].toLocaleString()}
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">Cumulative</div>
          </div>
        ))}
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-slate-600" />
          <h3 className="text-sm font-bold text-slate-700">Daily Progress Log ({records.length} records)</h3>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={fetchRecords}>
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
          <Button size="sm" onClick={() => setShowDialog(true)}>
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            Log Progress
          </Button>
        </div>
      </div>

      {/* Records Table */}
      <Card className="border-slate-200 shadow-sm">
        <CardContent className="p-0">
          {records.length === 0 ? (
            <div className="flex flex-col items-center py-16 text-slate-400">
              <TrendingUp className="h-10 w-10 mb-3 opacity-40" />
              <p className="text-sm font-medium">No progress records yet</p>
              <p className="text-xs mt-1">Start logging daily construction progress</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/80">
                  <TableHead className="text-xs">Date</TableHead>
                  <TableHead className="text-xs text-center">Poles</TableHead>
                  <TableHead className="text-xs text-center">Cable (m)</TableHead>
                  <TableHead className="text-xs text-center">Chambers</TableHead>
                  <TableHead className="text-xs text-center">Closures</TableHead>
                  <TableHead className="text-xs text-center">Joints</TableHead>
                  <TableHead className="text-xs text-center">Team</TableHead>
                  <TableHead className="text-xs text-center">Progress</TableHead>
                  <TableHead className="text-xs text-right">Labor (LKR)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {records.map((r) => (
                  <TableRow key={r.id} className="hover:bg-slate-50/60">
                    <TableCell className="text-xs font-medium">
                      {format(new Date(r.reportDate), 'dd MMM yyyy')}
                    </TableCell>
                    <TableCell className="text-xs text-center">{r.polesErected}</TableCell>
                    <TableCell className="text-xs text-center">{r.cablePulled.toFixed(1)}</TableCell>
                    <TableCell className="text-xs text-center">{r.chambersInstalled}</TableCell>
                    <TableCell className="text-xs text-center">{r.closuresInstalled}</TableCell>
                    <TableCell className="text-xs text-center">{r.jointsCompleted}</TableCell>
                    <TableCell className="text-xs text-center">{r.teamSize ?? '—'}</TableCell>
                    <TableCell className="text-xs text-center">
                      <span className="inline-flex items-center gap-1 text-emerald-700 font-medium">
                        {r.progressPct}%
                      </span>
                    </TableCell>
                    <TableCell className="text-xs text-right">
                      {r.laborCost > 0 ? r.laborCost.toLocaleString('en-LK') : '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Add Progress Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Log Daily Progress</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <Label className="text-xs font-medium">Report Date</Label>
              <Input
                type="date"
                value={form.reportDate}
                onChange={(e) => setForm((f) => ({ ...f, reportDate: e.target.value }))}
                className="mt-1"
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              {[
                { key: 'polesErected', label: 'Poles Erected', type: 'number' },
                { key: 'cablePulled', label: 'Cable Pulled (m)', type: 'number' },
                { key: 'chambersInstalled', label: 'Chambers', type: 'number' },
                { key: 'closuresInstalled', label: 'Closures', type: 'number' },
                { key: 'jointsCompleted', label: 'Joints', type: 'number' },
                { key: 'fdpsInstalled', label: 'FDPs', type: 'number' },
                { key: 'teamSize', label: 'Team Size', type: 'number' },
                { key: 'hoursWorked', label: 'Hours Worked', type: 'number' },
                { key: 'laborCost', label: 'Labor Cost (LKR)', type: 'number' },
              ].map(({ key, label, type }) => (
                <div key={key}>
                  <Label className="text-xs font-medium">{label}</Label>
                  <Input
                    type={type}
                    min="0"
                    step={key === 'cablePulled' || key === 'hoursWorked' ? '0.1' : '1'}
                    value={form[key as keyof typeof form]}
                    onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                    className="mt-1 h-8"
                  />
                </div>
              ))}
            </div>
            <div>
              <Label className="text-xs font-medium">Overall Progress % Today</Label>
              <Input
                type="number"
                min="0"
                max="100"
                step="0.5"
                value={form.progressPct}
                onChange={(e) => setForm((f) => ({ ...f, progressPct: e.target.value }))}
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-xs font-medium">Notes</Label>
              <Textarea
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                placeholder="Weather, site conditions, issues encountered..."
                rows={2}
                className="mt-1 resize-none"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>Cancel</Button>
            <Button onClick={submitRecord} disabled={isSubmitting}>Save Progress</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

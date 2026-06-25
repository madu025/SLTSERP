"use client";
import React, { useCallback, useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TrendingUp, AlertTriangle, CheckCircle2, Loader2, RefreshCw, Star } from 'lucide-react';
import { toast } from 'sonner';

interface KPIScore {
  id: string;
  contractorId?: string;
  contractor?: { id: string; name: string };
  evaluationMonth: string;
  score: number;
  timelineScore?: number;
  patScore?: number;
  safetyScore?: number;
  adherenceScore?: number;
  productivityScore?: number;
  qualityScore?: number;
  slaComplianceScore?: number;
  scheduleScore?: number;
  ncrCount?: number;
  ncrClosedCount?: number;
  hseIncidentCount?: number;
  completedTasksCount?: number;
  totalTasksAssigned?: number;
  inspectionPassCount?: number;
  inspectionCount?: number;
}

interface ProjectContractorPerformanceProps {
  project: { id: string };
}

const WEIGHT_CONFIG = [
  { key: 'timelineScore',  label: 'Timeline',   weight: '30%', color: 'bg-blue-500' },
  { key: 'patScore',       label: 'PAT Results', weight: '35%', color: 'bg-green-500' },
  { key: 'safetyScore',    label: 'Safety (HSE)', weight: '20%', color: 'bg-amber-500' },
  { key: 'adherenceScore', label: 'Adherence',   weight: '15%', color: 'bg-purple-500' },
];

function getScoreColor(score: number) {
  if (score >= 80) return 'text-green-600';
  if (score >= 60) return 'text-amber-600';
  return 'text-red-600';
}

function getScoreLabel(score: number) {
  if (score >= 80) return { label: 'Excellent', color: 'bg-green-500/10 text-green-700 border-green-500/20' };
  if (score >= 60) return { label: 'Average', color: 'bg-amber-500/10 text-amber-700 border-amber-500/20' };
  return { label: 'Needs Improvement', color: 'bg-red-500/10 text-red-700 border-red-500/20' };
}

export default function ProjectContractorPerformance({ project }: ProjectContractorPerformanceProps) {
  const [scores, setScores] = useState<KPIScore[]>([]);
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [loading, setLoading] = useState(true);
  const [calculating, setCalculating] = useState(false);

  const months = Array.from({ length: 12 }, (_, i) => {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    return d.toISOString().slice(0, 7);
  });

  const fetchScores = useCallback(async () => {
    try {
      setLoading(true);
      // Fixed: use /contractor-kpi endpoint (was incorrectly /contractor-rating)
      const res = await fetch(`/api/projects/${project.id}/contractor-kpi?month=${selectedMonth}`);
      const data = await res.json();
      setScores(Array.isArray(data) ? data : data.scores ?? []);
    } catch (e) {
      console.error(e);
      toast.error('Failed to load contractor KPI data');
    } finally {
      setLoading(false);
    }
  }, [project.id, selectedMonth]);

  useEffect(() => { fetchScores(); }, [fetchScores]);

  const handleCalculate = async () => {
    setCalculating(true);
    try {
      const res = await fetch(`/api/projects/${project.id}/contractor-kpi`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ month: selectedMonth }),
      });
      if (!res.ok) throw new Error();
      toast.success('KPI scores calculated');
      await fetchScores();
    } catch {
      toast.error('Failed to calculate KPI scores');
    } finally {
      setCalculating(false);
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h3 className="text-base font-bold text-foreground">Contractor Performance KPI</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Auto-weighted scoring: Timeline 30% · PAT 35% · Safety 20% · Adherence 15%</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-36 h-8 text-xs bg-card border-border">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {months.map(m => <SelectItem key={m} value={m} className="text-xs">{m}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={fetchScores} disabled={loading}>
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </Button>
          <Button size="sm" className="h-8 text-xs gap-1.5" onClick={handleCalculate} disabled={calculating}>
            {calculating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Star className="w-3.5 h-3.5" />}
            Calculate KPI
          </Button>
        </div>
      </div>

      {/* Weight Legend */}
      <Card className="border-border shadow-none bg-muted/30">
        <CardContent className="p-3 flex items-center gap-4 flex-wrap">
          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Score Weights:</span>
          {WEIGHT_CONFIG.map(w => (
            <div key={w.key} className="flex items-center gap-1.5 text-xs">
              <div className={`w-2.5 h-2.5 rounded-full ${w.color}`} />
              <span className="font-medium text-foreground">{w.label}</span>
              <span className="text-muted-foreground">{w.weight}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-10 gap-2 text-muted-foreground text-sm">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading KPI data...
        </div>
      )}

      {/* Empty */}
      {!loading && scores.length === 0 && (
        <Card className="border-border shadow-none">
          <CardContent className="py-12 text-center">
            <TrendingUp className="w-8 h-8 mx-auto mb-2 text-muted-foreground opacity-40" />
            <p className="text-sm font-medium text-muted-foreground">No KPI data for {selectedMonth}</p>
            <p className="text-xs text-muted-foreground mt-1">Click &quot;Calculate KPI&quot; to generate scores from live project data</p>
            <Button size="sm" className="mt-3 gap-1.5 h-8 text-xs" onClick={handleCalculate} disabled={calculating}>
              {calculating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Star className="w-3.5 h-3.5" />}
              Calculate Now
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Score Cards */}
      {!loading && scores.map((score) => {
        const label = getScoreLabel(score.score);
        return (
          <Card key={score.id} className="border-border shadow-none border-l-4 border-l-primary">
            <CardHeader className="p-4 pb-2">
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-sm font-bold text-foreground">
                    {score.contractor?.name || 'Contractor'}
                  </CardTitle>
                  <CardDescription className="text-[11px] mt-0.5">Evaluation: {score.evaluationMonth}</CardDescription>
                </div>
                <div className="text-right">
                  <p className={`text-3xl font-black ${getScoreColor(score.score)}`}>
                    {score.score.toFixed(1)}
                    <span className="text-lg">%</span>
                  </p>
                  <Badge className={`text-[9px] px-1.5 py-0 border ${label.color}`}>{label.label}</Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-4 pt-0 space-y-4">
              {/* Weighted Score Breakdown */}
              <div className="space-y-2">
                {WEIGHT_CONFIG.map(w => {
                  const val = (score[w.key as keyof KPIScore] as number) ?? 0;
                  return (
                    <div key={w.key} className="space-y-0.5">
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">{w.label} <span className="text-[10px]">({w.weight})</span></span>
                        <span className={`font-semibold ${getScoreColor(val)}`}>{val.toFixed(0)}%</span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-1.5">
                        <div className={`h-1.5 rounded-full ${w.color}`} style={{ width: `${Math.min(100, val)}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 pt-2 border-t border-border">
                {score.ncrCount != null && (
                  <div className="p-2 bg-red-500/5 rounded border border-red-500/10 flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />
                    <div className="text-xs">
                      <p className="font-semibold text-foreground">{score.ncrCount} NCRs</p>
                      <p className="text-[10px] text-muted-foreground">{score.ncrClosedCount ?? 0} closed</p>
                    </div>
                  </div>
                )}
                {score.hseIncidentCount != null && (
                  <div className="p-2 bg-orange-500/5 rounded border border-orange-500/10 flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-orange-500 flex-shrink-0" />
                    <div className="text-xs">
                      <p className="font-semibold text-foreground">{score.hseIncidentCount}</p>
                      <p className="text-[10px] text-muted-foreground">HSE Incidents</p>
                    </div>
                  </div>
                )}
                {score.completedTasksCount != null && (
                  <div className="p-2 bg-green-500/5 rounded border border-green-500/10 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                    <div className="text-xs">
                      <p className="font-semibold text-foreground">{score.completedTasksCount}/{score.totalTasksAssigned ?? '—'}</p>
                      <p className="text-[10px] text-muted-foreground">Tasks</p>
                    </div>
                  </div>
                )}
                {score.inspectionPassCount != null && (
                  <div className="p-2 bg-blue-500/5 rounded border border-blue-500/10 flex items-center gap-1.5">
                    <TrendingUp className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
                    <div className="text-xs">
                      <p className="font-semibold text-foreground">{score.inspectionPassCount}/{score.inspectionCount ?? '—'}</p>
                      <p className="text-[10px] text-muted-foreground">Inspections</p>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

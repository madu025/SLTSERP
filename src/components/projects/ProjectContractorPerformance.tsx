"use client";
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TrendingUp, TrendingDown, AlertTriangle, CheckCircle2 } from 'lucide-react';

interface ProjectContractorPerformanceProps { project: any; }

export default function ProjectContractorPerformance({ project }: ProjectContractorPerformanceProps) {
  const [scores, setScores] = useState<any[]>([]);
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchScores(); }, [project.id, selectedMonth]);

  const fetchScores = async () => {
    try {
      const res = await fetch(`/api/projects/${project.id}/contractor-rating?month=${selectedMonth}`);
      const data = await res.json();
      setScores(Array.isArray(data) ? data : []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-amber-600';
    return 'text-red-600';
  };

  const getScoreBarColor = (score: number) => {
    if (score >= 80) return 'bg-green-500';
    if (score >= 60) return 'bg-amber-500';
    return 'bg-red-500';
  };

  const months = Array.from({ length: 12 }, (_, i) => {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    return d.toISOString().slice(0, 7);
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Contractor Performance Monitoring</h3>
          <p className="text-sm text-slate-500">SLA scores, NCR tracking, quality and safety metrics</p>
        </div>
        <Select value={selectedMonth} onValueChange={setSelectedMonth}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            {months.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {scores.map((score: any) => (
        <Card key={score.id} className="border-l-4 border-l-blue-500">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">{score.contractor?.name || 'Unknown Contractor'}</CardTitle>
                <p className="text-sm text-slate-500">Evaluation: {score.evaluationMonth}</p>
              </div>
              <div className="text-right">
                <p className={`text-3xl font-bold ${getScoreColor(score.score)}`}>{score.score.toFixed(1)}%</p>
                <Badge className={score.score >= 80 ? 'bg-green-100 text-green-700' : score.score >= 60 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}>
                  {score.score >= 80 ? 'Excellent' : score.score >= 60 ? 'Average' : 'Needs Improvement'}
                </Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4">
              <div className="space-y-1">
                <p className="text-xs text-slate-500">Productivity</p>
                <div className="flex items-center gap-2">
                  <Progress value={score.productivityScore || 0} className={getScoreBarColor(score.productivityScore || 0)} />
                  <span className="text-sm font-medium">{score.productivityScore?.toFixed(0) || 0}%</span>
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-slate-500">Quality</p>
                <div className="flex items-center gap-2">
                  <Progress value={score.qualityScore || 0} className={getScoreBarColor(score.qualityScore || 0)} />
                  <span className="text-sm font-medium">{score.qualityScore?.toFixed(0) || 0}%</span>
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-slate-500">Safety</p>
                <div className="flex items-center gap-2">
                  <Progress value={score.safetyScore || 0} className={getScoreBarColor(score.safetyScore || 0)} />
                  <span className="text-sm font-medium">{score.safetyScore?.toFixed(0) || 0}%</span>
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-slate-500">SLA Compliance</p>
                <div className="flex items-center gap-2">
                  <Progress value={score.slaComplianceScore || 0} className={getScoreBarColor(score.slaComplianceScore || 0)} />
                  <span className="text-sm font-medium">{score.slaComplianceScore?.toFixed(0) || 0}%</span>
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-slate-500">Schedule</p>
                <div className="flex items-center gap-2">
                  <Progress value={score.scheduleScore || 0} className={getScoreBarColor(score.scheduleScore || 0)} />
                  <span className="text-sm font-medium">{score.scheduleScore?.toFixed(0) || 0}%</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-4 text-sm">
              <div className="p-2 bg-red-50 rounded flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-500" />
                <span><strong>{score.ncrCount}</strong> NCRs ({score.ncrClosedCount} closed)</span>
              </div>
              <div className="p-2 bg-orange-50 rounded flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-orange-500" />
                <span><strong>{score.hseIncidentCount}</strong> HSE Incidents</span>
              </div>
              <div className="p-2 bg-green-50 rounded flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-500" />
                <span><strong>{score.completedTasksCount}/{score.totalTasksAssigned}</strong> Tasks</span>
              </div>
              <div className="p-2 bg-blue-50 rounded flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-blue-500" />
                <span><strong>{score.inspectionPassCount}/{score.inspectionCount}</strong> Inspections passed</span>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}

      {!loading && scores.length === 0 && (
        <Card><CardContent className="py-12 text-center text-slate-500">No performance data available for this period</CardContent></Card>
      )}
    </div>
  );
}

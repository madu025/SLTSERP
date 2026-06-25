"use client";
import React, { useCallback, useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  DollarSign, TrendingDown, TrendingUp, RefreshCw, AlertTriangle,
  CheckCircle2, Loader2, Wrench, Receipt, Users
} from 'lucide-react';
import { toast } from 'sonner';

interface BudgetDashboard {
  budget: number;
  boqEstimate: number;
  actualCost: number;
  materialCost: number;
  expenseCost: number;
  laborCost: number;
  variance: number;
  variancePct: number;
  varianceStatus: 'UNDER' | 'ON_TRACK' | 'OVER' | 'CRITICAL';
  monthlyTrend: { month: string; cost: number }[];
  progressPct: number;
}

interface ProjectBudgetTrackingProps {
  project: { id: string; name?: string };
}

const STATUS_CONFIG = {
  UNDER:    { label: 'Under Budget',  color: 'bg-green-500/10 text-green-700 border-green-500/20',  icon: CheckCircle2, bar: 'bg-green-500' },
  ON_TRACK: { label: 'On Track',      color: 'bg-blue-500/10 text-blue-700 border-blue-500/20',    icon: TrendingUp,   bar: 'bg-blue-500' },
  OVER:     { label: 'Over Budget',   color: 'bg-amber-500/10 text-amber-700 border-amber-500/20', icon: TrendingDown, bar: 'bg-amber-500' },
  CRITICAL: { label: 'Critical',      color: 'bg-red-500/10 text-red-700 border-red-500/20',       icon: AlertTriangle,bar: 'bg-red-500' },
};

function fmt(n: number) {
  return new Intl.NumberFormat('en-LK', { style: 'currency', currency: 'LKR', minimumFractionDigits: 0 }).format(n);
}

export default function ProjectBudgetTracking({ project }: ProjectBudgetTrackingProps) {
  const [data, setData] = useState<BudgetDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const fetchBudget = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/projects/${project.id}/budget`);
      if (!res.ok) throw new Error('Failed to fetch budget data');
      setData(await res.json());
    } catch {
      toast.error('Failed to load budget data');
    } finally {
      setLoading(false);
    }
  }, [project.id]);

  useEffect(() => { fetchBudget(); }, [fetchBudget]);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await fetch(`/api/projects/${project.id}/budget`, { method: 'POST' });
      if (!res.ok) throw new Error();
      toast.success('Budget synced successfully');
      await fetchBudget();
    } catch {
      toast.error('Failed to sync budget');
    } finally {
      setSyncing(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center gap-2 text-muted-foreground text-sm">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading budget data...
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-6 text-center text-muted-foreground text-sm">
        <AlertTriangle className="w-8 h-8 mx-auto mb-2 text-amber-500" />
        No budget data available. Sync to calculate.
        <div className="mt-3">
          <Button size="sm" onClick={handleSync} disabled={syncing}>
            {syncing ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5 mr-1.5" />}
            Sync Now
          </Button>
        </div>
      </div>
    );
  }

  const status = STATUS_CONFIG[data.varianceStatus];
  const StatusIcon = status.icon;
  const spentPct = data.budget > 0 ? Math.min(100, (data.actualCost / data.budget) * 100) : 0;

  return (
    <div className="p-4 md:p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-bold text-foreground">Budget Tracking</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Real-time cost monitoring vs approved budget</p>
        </div>
        <Button variant="outline" size="sm" className="gap-1.5 h-8 text-xs" onClick={handleSync} disabled={syncing}>
          {syncing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          Sync Actual Cost
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {/* Budget */}
        <Card className="border-border shadow-none">
          <CardHeader className="p-3 pb-1">
            <CardDescription className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Approved Budget</CardDescription>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <p className="text-lg font-bold text-foreground">{fmt(data.budget)}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">Total allocation</p>
          </CardContent>
        </Card>

        {/* BOQ Estimate */}
        <Card className="border-border shadow-none">
          <CardHeader className="p-3 pb-1">
            <CardDescription className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">BOQ Estimate</CardDescription>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <p className="text-lg font-bold text-blue-600">{fmt(data.boqEstimate)}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">From BOQ items</p>
          </CardContent>
        </Card>

        {/* Actual Cost */}
        <Card className="border-border shadow-none">
          <CardHeader className="p-3 pb-1">
            <CardDescription className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Actual Cost</CardDescription>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <p className="text-lg font-bold text-foreground">{fmt(data.actualCost)}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">{spentPct.toFixed(1)}% of budget</p>
          </CardContent>
        </Card>

        {/* Variance */}
        <Card className="border-border shadow-none">
          <CardHeader className="p-3 pb-1">
            <CardDescription className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Variance</CardDescription>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="flex items-center gap-1.5">
              <p className={`text-lg font-bold ${data.variance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {fmt(Math.abs(data.variance))}
              </p>
              <Badge className={`text-[9px] px-1.5 py-0 border ${status.color}`}>
                <StatusIcon className="w-2.5 h-2.5 mr-0.5" />
                {status.label}
              </Badge>
            </div>
            <p className="text-[10px] text-muted-foreground mt-0.5">{data.variancePct.toFixed(1)}% {data.variance >= 0 ? 'under' : 'over'}</p>
          </CardContent>
        </Card>
      </div>

      {/* Budget Utilisation Bar */}
      <Card className="border-border shadow-none">
        <CardHeader className="p-3 pb-2">
          <CardTitle className="text-xs font-bold text-foreground">Budget Utilisation</CardTitle>
        </CardHeader>
        <CardContent className="p-3 pt-0 space-y-3">
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Spent ({spentPct.toFixed(1)}%)</span>
              <span>{fmt(data.actualCost)} / {fmt(data.budget)}</span>
            </div>
            <div className="w-full bg-muted rounded-full h-2.5">
              <div
                className={`h-2.5 rounded-full transition-all ${status.bar}`}
                style={{ width: `${spentPct}%` }}
              />
            </div>
          </div>

          {/* Cost Breakdown */}
          <div className="grid grid-cols-3 gap-3 pt-2 border-t border-border">
            <div className="flex items-center gap-2 text-xs">
              <div className="p-1.5 bg-purple-500/10 rounded text-purple-600">
                <Wrench className="w-3.5 h-3.5" />
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground">Materials</p>
                <p className="font-semibold text-foreground">{fmt(data.materialCost)}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <div className="p-1.5 bg-blue-500/10 rounded text-blue-600">
                <Receipt className="w-3.5 h-3.5" />
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground">Expenses</p>
                <p className="font-semibold text-foreground">{fmt(data.expenseCost)}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <div className="p-1.5 bg-emerald-500/10 rounded text-emerald-600">
                <Users className="w-3.5 h-3.5" />
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground">Labour</p>
                <p className="font-semibold text-foreground">{fmt(data.laborCost)}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Monthly Trend Table */}
      {data.monthlyTrend.length > 0 && (
        <Card className="border-border shadow-none">
          <CardHeader className="p-3 pb-2">
            <CardTitle className="text-xs font-bold text-foreground">Monthly Cost Trend</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="text-[10px] font-bold uppercase text-muted-foreground h-8 pl-3">Month</TableHead>
                  <TableHead className="text-[10px] font-bold uppercase text-muted-foreground h-8 text-right pr-3">Cost</TableHead>
                  <TableHead className="text-[10px] font-bold uppercase text-muted-foreground h-8 text-right pr-3">Cumulative</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.monthlyTrend.reduce((acc, row, i) => {
                  const prev = acc[i - 1]?.cumulative ?? 0;
                  acc.push({ ...row, cumulative: prev + row.cost });
                  return acc;
                }, [] as { month: string; cost: number; cumulative: number }[]).map((row) => (
                  <TableRow key={row.month} className="border-border text-xs hover:bg-muted/40">
                    <TableCell className="pl-3 font-medium text-foreground">{row.month}</TableCell>
                    <TableCell className="text-right pr-3 text-muted-foreground">{fmt(row.cost)}</TableCell>
                    <TableCell className="text-right pr-3 font-semibold text-foreground">{fmt(row.cumulative)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {data.monthlyTrend.length === 0 && (
        <div className="text-center py-6 text-xs text-muted-foreground">
          <DollarSign className="w-6 h-6 mx-auto mb-1 opacity-40" />
          No monthly data yet. Log expenses or daily progress to track costs.
        </div>
      )}
    </div>
  );
}

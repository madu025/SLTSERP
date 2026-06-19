'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import {
  TrendingDown, AlertTriangle, CheckCircle2,
  RefreshCw, Brain, BarChart3, Lightbulb, ShieldAlert,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface AiPrediction {
  id: string;
  predictionType: string;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  probabilityPct: number;
  predictedImpact: string;
  currentMetrics: Record<string, unknown>;
  rootCause?: string;
  recommendation?: string;
  confidenceScore?: number;
  createdAt: string;
}

interface Props {
  projectId: string;
}

const RISK_CONFIG = {
  CRITICAL: {
    bg: 'bg-red-50',
    border: 'border-red-200',
    badge: 'bg-red-100 text-red-700',
    icon: <ShieldAlert className="h-5 w-5 text-red-600" />,
    progressColor: '[&>[role=progressbar]]:bg-red-500',
    title: 'text-red-700',
    ring: 'ring-red-200',
  },
  HIGH: {
    bg: 'bg-orange-50',
    border: 'border-orange-200',
    badge: 'bg-orange-100 text-orange-700',
    icon: <AlertTriangle className="h-5 w-5 text-orange-600" />,
    progressColor: '[&>[role=progressbar]]:bg-orange-500',
    title: 'text-orange-700',
    ring: 'ring-orange-200',
  },
  MEDIUM: {
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    badge: 'bg-amber-100 text-amber-700',
    icon: <TrendingDown className="h-5 w-5 text-amber-600" />,
    progressColor: '[&>[role=progressbar]]:bg-amber-500',
    title: 'text-amber-700',
    ring: 'ring-amber-200',
  },
  LOW: {
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
    badge: 'bg-emerald-100 text-emerald-700',
    icon: <CheckCircle2 className="h-5 w-5 text-emerald-600" />,
    progressColor: '[&>[role=progressbar]]:bg-emerald-500',
    title: 'text-emerald-700',
    ring: 'ring-emerald-200',
  },
};

const PREDICTION_LABELS: Record<string, string> = {
  DELAY: '🕐 Schedule Delay Risk',
  BUDGET_OVERRUN: '💰 Budget Overrun Risk',
  PERMIT_DELAY: '📋 Permit Delay Risk',
  MATERIAL_SHORTAGE: '📦 Material Shortage Risk',
};

export default function ProjectAIForecasting({ projectId }: Props) {
  const [predictions, setPredictions] = useState<AiPrediction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchPredictions = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/predictions`);
      const data = await res.json();
      setPredictions(Array.isArray(data) ? data : []);
    } catch {
      toast.error('Failed to load predictions');
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchPredictions();
  }, [fetchPredictions]);

  const runFreshAnalysis = async () => {
    setIsRefreshing(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/predictions`, { method: 'POST' });
      if (!res.ok) throw new Error('Analysis failed');
      const data = await res.json();
      setPredictions(Array.isArray(data) ? data : []);
      toast.success('AI analysis completed');
    } catch {
      toast.error('Failed to run analysis');
    } finally {
      setIsRefreshing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full rounded-xl" />
        <div className="grid grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-48 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  const sortedPredictions = [...predictions].sort((a, b) => {
    const order = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
    return (order[a.riskLevel] ?? 4) - (order[b.riskLevel] ?? 4);
  });



  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-violet-100 to-indigo-100 border border-violet-200">
            <Brain className="h-5 w-5 text-violet-600" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-800">AI Forecasting Engine</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Heuristic risk predictions based on live project data
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={runFreshAnalysis}
          disabled={isRefreshing}
          className="border-violet-200 text-violet-600 hover:bg-violet-50"
        >
          <RefreshCw className={cn('h-3.5 w-3.5 mr-1.5', isRefreshing && 'animate-spin')} />
          {isRefreshing ? 'Analyzing...' : 'Run Analysis'}
        </Button>
      </div>

      {/* Risk Summary Bar */}
      {predictions.length > 0 && (
        <div className="grid grid-cols-4 gap-3">
          {(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as const).map((level) => {
            const count = predictions.filter((p) => p.riskLevel === level).length;
            const cfg = RISK_CONFIG[level];
            return (
              <div
                key={level}
                className={cn('p-3 rounded-xl border text-center', cfg.bg, cfg.border)}
              >
                <div className={cn('text-2xl font-bold', cfg.title)}>{count}</div>
                <div className="text-[10px] text-slate-500 mt-0.5">{level}</div>
              </div>
            );
          })}
        </div>
      )}

      {/* Predictions Grid */}
      {predictions.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-slate-400 rounded-xl border-2 border-dashed border-slate-200">
          <Brain className="h-12 w-12 mb-3 opacity-40" />
          <p className="text-sm font-medium">No predictions yet</p>
          <p className="text-xs mt-1">Click &quot;Run Analysis&quot; to generate risk predictions</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {sortedPredictions.map((prediction) => {
            const cfg = RISK_CONFIG[prediction.riskLevel];
            const label = PREDICTION_LABELS[prediction.predictionType] ?? prediction.predictionType;

            return (
              <Card
                key={prediction.id}
                className={cn(
                  'border transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md',
                  cfg.border, cfg.bg
                )}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {cfg.icon}
                      <CardTitle className={cn('text-sm font-bold', cfg.title)}>
                        {label}
                      </CardTitle>
                    </div>
                    <span className={cn('px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0', cfg.badge)}>
                      {prediction.riskLevel}
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {/* Probability Bar */}
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-500">Risk Probability</span>
                      <span className="font-bold text-slate-700">{Math.round(prediction.probabilityPct)}%</span>
                    </div>
                    <Progress
                      value={prediction.probabilityPct}
                      className={cn('h-2', cfg.progressColor)}
                    />
                  </div>

                  {/* Predicted Impact */}
                  <div className="flex items-center gap-2 p-2.5 rounded-lg bg-white/70 border border-white">
                    <BarChart3 className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                    <p className="text-xs font-medium text-slate-700">{prediction.predictedImpact}</p>
                  </div>

                  {/* Root Cause */}
                  {prediction.rootCause && (
                    <div>
                      <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider mb-1">
                        Root Cause
                      </p>
                      <p className="text-xs text-slate-600">{prediction.rootCause}</p>
                    </div>
                  )}

                  {/* Recommendation */}
                  {prediction.recommendation && (
                    <div className="flex items-start gap-2 p-2.5 rounded-lg bg-white/60">
                      <Lightbulb className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />
                      <p className="text-xs text-slate-600">{prediction.recommendation}</p>
                    </div>
                  )}

                  {/* Confidence */}
                  {prediction.confidenceScore != null && (
                    <p className="text-[10px] text-slate-400 text-right">
                      Confidence: {prediction.confidenceScore}%
                    </p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

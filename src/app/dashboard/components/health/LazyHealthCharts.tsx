'use client';

import dynamic from 'next/dynamic';
import { Skeleton } from '@/components/ui/skeleton';

// recharts is large; load it after the text, KPIs and tables have rendered.
const fallback = () => <Skeleton className="h-64 w-full rounded-xl" />;
const opts = { ssr: false, loading: fallback } as const;

export const Sparkline = dynamic(() => import('./HealthCharts').then((m) => m.Sparkline), { ssr: false, loading: () => <Skeleton className="h-10 w-full" /> });
export const FinanceTrend = dynamic(() => import('./HealthCharts').then((m) => m.FinanceTrend), opts);
export const CompletedTrend = dynamic(() => import('./HealthCharts').then((m) => m.CompletedTrend), opts);
export const AgeingBars = dynamic(() => import('./HealthCharts').then((m) => m.AgeingBars), opts);
export const ProjectHealthDonut = dynamic(() => import('./HealthCharts').then((m) => m.ProjectHealthDonut), opts);
export { BudgetBar } from './HealthPanel';

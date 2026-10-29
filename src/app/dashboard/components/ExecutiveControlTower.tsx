'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
    AlertTriangle,
    ArrowUpRight,
    BarChart3,
    CheckCircle2,
    Clock3,
    FolderKanban,
    RefreshCw,
    ShieldCheck,
    Wallet,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { formatLKR } from '@/lib/utils';
import type { ExecutiveDashboardData } from './types';

function formatAsOf(value?: string) {
    if (!value) return 'As-of timestamp unavailable from API';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'As-of timestamp unavailable from API';
    return `As of ${date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}`;
}

function statusLabel(value: string) {
    return value.replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function Metric({ label, value, hint, tone = 'text-foreground' }: { label: string; value: string | number; hint?: string; tone?: string }) {
    return (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-400">{label}</p>
            <p className={`mt-1 text-2xl font-black font-mono ${tone}`}>{value}</p>
            {hint && <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">{hint}</p>}
        </div>
    );
}

const EXECUTIVE_REQUEST_TIMEOUT_MS = 12_000;

export default function ExecutiveControlTower({ enabled = true }: { enabled?: boolean }) {
    const { data, isLoading, error, refetch, isFetching } = useQuery<ExecutiveDashboardData | null>({
        queryKey: ['dashboard-executive-control-tower'],
        queryFn: async ({ signal }) => {
            const controller = new AbortController();
            let timedOut = false;
            const timeoutId = setTimeout(() => {
                timedOut = true;
                controller.abort();
            }, EXECUTIVE_REQUEST_TIMEOUT_MS);
            const abortFromQuery = () => controller.abort();
            signal.addEventListener('abort', abortFromQuery, { once: true });

            try {
                const response = await fetch('/api/dashboard/executive', { signal: controller.signal });
                if (response.status === 401 || response.status === 403) return null;
                if (!response.ok) {
                    const requestError = new Error(`Executive dashboard request failed (${response.status})`) as Error & { status?: number };
                    requestError.status = response.status;
                    throw requestError;
                }
                return response.json() as Promise<ExecutiveDashboardData>;
            } catch (requestError) {
                if (timedOut) throw new Error('Executive dashboard data is taking too long to respond. Check your connection and retry.');
                throw requestError;
            } finally {
                clearTimeout(timeoutId);
                signal.removeEventListener('abort', abortFromQuery);
            }
        },
        staleTime: 2 * 60 * 1000,
        gcTime: 30 * 60 * 1000,
        enabled,
        refetchInterval: 2 * 60 * 1000,
        refetchIntervalInBackground: false,
        retry: (failureCount, requestError) => {
            const status = (requestError as Error & { status?: number }).status;
            if (status && status >= 400 && status < 500) return false;
            return failureCount < 1;
        },
        retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 4000),
        refetchOnWindowFocus: false,
        refetchOnReconnect: true,
    });

    if (!enabled) return null;

    if (isLoading) {
        return (
            <div className="space-y-3" role="status" aria-live="polite">
                <p className="px-1 text-sm font-semibold text-slate-900 dark:text-slate-100">Loading executive control tower…</p>
                <Skeleton className="h-72 rounded-3xl" aria-label="Loading executive control tower" />
            </div>
        );
    }

    // The executive endpoint has its own server-side permission gate. A user
    // with normal dashboard access must not see an error banner for a metric
    // set they are not entitled to view.
    if (error && !data) {
        return (
            <Card className="border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30" role="status" aria-live="polite">
                <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <p className="text-sm font-black text-amber-950 dark:text-amber-100">Executive control tower unavailable</p>
                        <p className="mt-1 text-xs text-amber-900/80 dark:text-amber-200/80">The dashboard is still available, but this control-tower snapshot could not be refreshed.</p>
                    </div>
                    <button
                        type="button"
                        onClick={() => void refetch()}
                        disabled={isFetching}
                        className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-amber-400 bg-white px-3 py-2 text-xs font-black text-amber-900 hover:bg-amber-100 disabled:cursor-wait disabled:opacity-60 dark:border-amber-700 dark:bg-slate-950 dark:text-amber-200 dark:hover:bg-amber-950"
                    >
                        <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} />
                        Retry snapshot
                    </button>
                </CardContent>
            </Card>
        );
    }

    if (!data) {
        return (
            <Card className="border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900" role="status">
                <CardContent className="p-4">
                    <p className="text-sm font-black text-slate-900 dark:text-slate-100">Executive control tower is not available for this role.</p>
                    <p className="mt-1 text-xs text-slate-700 dark:text-slate-300">The rest of the Operations dashboard remains available.</p>
                </CardContent>
            </Card>
        );
    }

    const { projectStats, budgetStats, patStats, contractorRankings, recentActivity, controlTower } = data;
    const statusRows = projectStats.byStatus || [];
    const topContractors = (contractorRankings || []).slice(0, 3);
    const highRisk = recentActivity.highRiskPredictions || [];

    return (
        <section aria-label="Executive control tower" className="space-y-4">
            {error && (
                <div className="flex flex-col gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100 sm:flex-row sm:items-center sm:justify-between" role="status">
                    <span>Showing the last available executive snapshot. Refresh did not complete.</span>
                    <button type="button" onClick={() => void refetch()} disabled={isFetching} className="font-semibold underline underline-offset-2 disabled:cursor-wait disabled:opacity-60">{isFetching ? 'Retrying…' : 'Retry snapshot'}</button>
                </div>
            )}
            {isFetching && !error && <p className="text-xs font-medium text-slate-700 dark:text-slate-300" role="status">Refreshing executive snapshot…</p>}
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-primary">Executive control tower</p>
                    <h2 className="mt-1 text-xl font-black text-foreground">Portfolio health, delivery and financial control</h2>
                    <p className="mt-1 text-xs text-muted-foreground">Only metrics returned by the scoped executive API are shown.</p>
                </div>
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground" title={data.generatedAt || undefined}>
                    <Clock3 className="h-3.5 w-3.5" />
                    {formatAsOf(data.generatedAt)}
                </span>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Link href="/projects" className="block rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
                    <Metric label="Portfolio projects" value={projectStats.total} hint={`${projectStats.active} active · ${projectStats.delayed} delayed`} />
                </Link>
                <Link href="/projects" className="block rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
                    <Metric label="Completion rate" value={`${projectStats.completionRate}%`} hint={`${projectStats.completed} completed`} tone="text-emerald-700 dark:text-emerald-400" />
                </Link>
                <Link href="/projects/dashboards/financials" className="block rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
                    <Metric label="Budget utilisation" value={`${budgetStats.spendRate}%`} hint={`${formatLKR(budgetStats.totalSpent)} of ${formatLKR(budgetStats.totalBudget)}`} tone={budgetStats.spendRate > 100 ? 'text-rose-700 dark:text-rose-400' : 'text-blue-700 dark:text-blue-400'} />
                </Link>
                <Link href="/service-orders/work-order/pat" className="block rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
                    <Metric label="PAT pass rate" value={`${patStats.passRate}%`} hint={`${patStats.failed} failed of ${patStats.total} sessions`} tone={patStats.failed > 0 ? 'text-amber-700 dark:text-amber-400' : 'text-emerald-700 dark:text-emerald-400'} />
                </Link>
            </div>

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
                <Card className="border-slate-200 dark:border-slate-800 xl:col-span-2">
                    <CardHeader className="flex flex-row items-center justify-between pb-3">
                        <CardTitle className="flex items-center gap-2 text-sm font-black text-foreground">
                            <FolderKanban className="h-4 w-4 text-primary" />
                            Portfolio status and control signals
                        </CardTitle>
                        <Link href="/projects" className="inline-flex items-center gap-1 text-xs font-bold text-primary hover:underline">
                            Open projects <ArrowUpRight className="h-3.5 w-3.5" />
                        </Link>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                            <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-900"><p className="text-[10px] font-bold uppercase text-slate-600 dark:text-slate-400">Over budget</p><p className="mt-1 text-xl font-black text-rose-700 dark:text-rose-400">{budgetStats.overBudgetProjects}</p></div>
                            <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-900"><p className="text-[10px] font-bold uppercase text-slate-600 dark:text-slate-400">Average progress</p><p className="mt-1 text-xl font-black text-foreground">{budgetStats.avgProgress}%</p></div>
                            <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-900"><p className="text-[10px] font-bold uppercase text-slate-600 dark:text-slate-400">Pre-PAT sessions</p><p className="mt-1 text-xl font-black text-foreground">{patStats.prePATCount}</p></div>
                            <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-900"><p className="text-[10px] font-bold uppercase text-slate-600 dark:text-slate-400">SLT-PAT sessions</p><p className="mt-1 text-xl font-black text-foreground">{patStats.sltPATCount}</p></div>
                        </div>
                        {statusRows.length > 0 ? (
                            <div className="flex flex-wrap gap-2" aria-label="Project status breakdown">
                                {statusRows.map((row) => (
                                    <Badge key={row.status} variant="outline" className="border-slate-300 bg-white px-3 py-1 text-xs font-bold text-slate-800 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200">
                                        {statusLabel(row.status)}: {row.count}
                                    </Badge>
                                ))}
                            </div>
                        ) : <p className="text-xs text-muted-foreground">No project status breakdown was returned.</p>}
                    </CardContent>
                </Card>

                <Card className="border-slate-200 dark:border-slate-800">
                    <CardHeader className="pb-3">
                        <CardTitle className="flex items-center gap-2 text-sm font-black text-foreground"><ShieldCheck className="h-4 w-4 text-emerald-600" /> PAT control</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <div className="flex items-center justify-between text-sm"><span className="text-muted-foreground">Passed</span><span className="font-black text-emerald-700 dark:text-emerald-400">{patStats.passed}</span></div>
                        <div className="flex items-center justify-between text-sm"><span className="text-muted-foreground">Failed</span><span className="font-black text-rose-700 dark:text-rose-400">{patStats.failed}</span></div>
                        <div className="flex items-center justify-between text-sm"><span className="text-muted-foreground">Average pass rate</span><span className="font-black text-foreground">{patStats.avgPassRate == null ? '—' : `${patStats.avgPassRate}%`}</span></div>
                        {highRisk.length > 0 && <Link href="/projects/dashboards/pm" className="mt-2 flex items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200"><AlertTriangle className="h-4 w-4" /> {highRisk.length} unresolved high-risk signal{highRisk.length === 1 ? '' : 's'} <ArrowUpRight className="ml-auto h-3.5 w-3.5" /></Link>}
                    </CardContent>
                </Card>
            </div>

            {controlTower && (
                <>
                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                        <Card className="border-slate-200 dark:border-slate-800">
                            <CardHeader className="pb-3"><CardTitle className="text-sm font-black text-foreground">Workflow control</CardTitle></CardHeader>
                            <CardContent className="grid grid-cols-2 gap-3">
                                <Metric label="Open tasks" value={controlTower.workflow.tasks.open} hint={`${controlTower.workflow.tasks.total} total`} />
                                <Metric label="Overdue tasks" value={controlTower.workflow.tasks.overdue} tone="text-rose-700 dark:text-rose-400" />
                                <Metric label="Blocked tasks" value={controlTower.workflow.tasks.blocked} tone="text-amber-700 dark:text-amber-400" />
                                <Metric label="Critical open" value={controlTower.workflow.tasks.criticalOpen} />
                            </CardContent>
                        </Card>
                        <Card className="border-slate-200 dark:border-slate-800">
                            <CardHeader className="pb-3"><CardTitle className="text-sm font-black text-foreground">Approvals and handoffs</CardTitle></CardHeader>
                            <CardContent className="space-y-2 text-sm">
                                <div className="flex justify-between"><span className="text-muted-foreground">Project requests open</span><span className="font-black text-foreground">{controlTower.workflow.approvals.projectRequestsOpen}</span></div>
                                <div className="flex justify-between"><span className="text-muted-foreground">Stage approvals open</span><span className="font-black text-foreground">{controlTower.workflow.approvals.stageApprovalsOpen}</span></div>
                                <div className="flex justify-between"><span className="text-muted-foreground">Reviews pending / rework</span><span className="font-black text-foreground">{controlTower.workflow.approvals.reviewsPending} / {controlTower.workflow.approvals.reviewsRework}</span></div>
                                <div className="flex justify-between"><span className="text-muted-foreground">Handoffs pending</span><span className="font-black text-foreground">{controlTower.workflow.approvals.handoffsPending}</span></div>
                            </CardContent>
                        </Card>
                        <Card className="border-slate-200 dark:border-slate-800">
                            <CardHeader className="pb-3"><CardTitle className="text-sm font-black text-foreground">Material readiness</CardTitle></CardHeader>
                            <CardContent className="space-y-2 text-sm">
                                <div className="flex justify-between"><span className="text-muted-foreground">Required</span><span className="font-black text-foreground">{controlTower.materials.requiredQty}</span></div>
                                <div className="flex justify-between"><span className="text-muted-foreground">Reserved / issued</span><span className="font-black text-foreground">{controlTower.materials.reservedQty} / {controlTower.materials.issuedQty}</span></div>
                                <div className="flex justify-between"><span className="text-muted-foreground">Shortage quantity</span><span className="font-black text-rose-700 dark:text-rose-400">{controlTower.materials.shortageQty}</span></div>
                                <p className="pt-1 text-[11px] text-muted-foreground">{controlTower.materials.requirementCount} requirement records · {controlTower.materials.shortageRequirementCount} shortage records</p>
                            </CardContent>
                        </Card>
                    </div>

                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                        <Card className="border-slate-200 dark:border-slate-800">
                            <CardHeader className="pb-3"><CardTitle className="text-sm font-black text-foreground">Closeout readiness</CardTitle></CardHeader>
                            <CardContent className="space-y-2 text-sm">
                                <div className="flex justify-between"><span className="text-muted-foreground">PAT completed / open</span><span className="font-black text-foreground">{controlTower.closeout.pat.completed} / {controlTower.closeout.pat.open}</span></div>
                                <div className="flex justify-between"><span className="text-muted-foreground">As-built approved / pending</span><span className="font-black text-foreground">{controlTower.closeout.asBuilt.approvedDocuments} / {controlTower.closeout.asBuilt.pendingDocuments}</span></div>
                                <div className="flex justify-between"><span className="text-muted-foreground">Invoices open</span><span className="font-black text-foreground">{controlTower.closeout.invoices.openCount}</span></div>
                                <Link href="/projects/dashboards/pm" className="inline-flex items-center gap-1 pt-1 text-xs font-bold text-primary hover:underline">Open project control <ArrowUpRight className="h-3.5 w-3.5" /></Link>
                            </CardContent>
                        </Card>
                        <Card className="border-slate-200 dark:border-slate-800">
                            <CardHeader className="pb-3"><CardTitle className="text-sm font-black text-foreground">Risk and change control</CardTitle></CardHeader>
                            <CardContent className="space-y-2 text-sm">
                                <div className="flex justify-between"><span className="text-muted-foreground">Open risks</span><span className="font-black text-rose-700 dark:text-rose-400">{controlTower.risks.openCount}</span></div>
                                <div className="flex justify-between"><span className="text-muted-foreground">Open change requests</span><span className="font-black text-amber-700 dark:text-amber-400">{controlTower.changeRequests.openCount}</span></div>
                                {controlTower.risks.topActionable.slice(0, 2).map((risk) => <Link key={risk.id} href={`/projects/${risk.projectId}`} className="block truncate text-xs font-bold text-primary hover:underline" title={risk.title}>{risk.projectName}: {risk.title}</Link>)}
                            </CardContent>
                        </Card>
                        <Card className="border-slate-200 dark:border-slate-800">
                            <CardHeader className="pb-3"><CardTitle className="text-sm font-black text-foreground">Data coverage</CardTitle></CardHeader>
                            <CardContent>
                                <p className="text-sm font-bold text-emerald-700 dark:text-emerald-400">Scoped project metrics active</p>
                                {controlTower.coverage.unknown.length > 0 && <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-muted-foreground">{controlTower.coverage.unknown.map((note) => <li key={note}>{note}</li>)}</ul>}
                                <p className="mt-3 text-[11px] text-muted-foreground">{formatAsOf(controlTower.asOf || data.generatedAt)}</p>
                            </CardContent>
                        </Card>
                    </div>
                </>
            )}

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <Card className="border-slate-200 dark:border-slate-800">
                    <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-sm font-black text-foreground"><BarChart3 className="h-4 w-4 text-primary" /> Recent project activity</CardTitle></CardHeader>
                    <CardContent>
                        {recentActivity.recentProjects.length === 0 ? <p className="text-xs text-muted-foreground">No recent project activity was returned.</p> : <div className="space-y-2">{recentActivity.recentProjects.map((project) => <Link key={project.id} href={`/projects/${project.id}`} className="flex items-center gap-3 rounded-xl border border-slate-200 p-3 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-900"><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold text-foreground">{project.name}</p><p className="text-xs text-muted-foreground">{statusLabel(project.status)} · {project.progress}%</p></div><ArrowUpRight className="h-4 w-4 shrink-0 text-primary" /></Link>)}</div>}
                    </CardContent>
                </Card>
                <Card className="border-slate-200 dark:border-slate-800">
                    <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-sm font-black text-foreground"><Wallet className="h-4 w-4 text-blue-600" /> Financial accountability</CardTitle></CardHeader>
                    <CardContent className="space-y-3">
                        <div className="flex items-center justify-between text-sm"><span className="text-muted-foreground">Budget</span><span className="font-bold text-foreground">{formatLKR(budgetStats.totalBudget)}</span></div>
                        <div className="flex items-center justify-between text-sm"><span className="text-muted-foreground">Actual spend</span><span className="font-bold text-foreground">{formatLKR(budgetStats.totalSpent)}</span></div>
                        <div className="flex items-center justify-between text-sm"><span className="text-muted-foreground">Variance</span><span className={`font-bold ${budgetStats.totalVariance < 0 ? 'text-rose-700 dark:text-rose-400' : 'text-emerald-700 dark:text-emerald-400'}`}>{formatLKR(budgetStats.totalVariance)}</span></div>
                        <Link href="/finance/reports/pnl" className="inline-flex items-center gap-1 text-xs font-bold text-primary hover:underline">Open finance report <ArrowUpRight className="h-3.5 w-3.5" /></Link>
                    </CardContent>
                </Card>
            </div>

            {topContractors.length > 0 && (
                <Card className="border-slate-200 dark:border-slate-800">
                    <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-sm font-black text-foreground"><CheckCircle2 className="h-4 w-4 text-emerald-600" /> Contractor performance snapshot</CardTitle></CardHeader>
                    <CardContent className="grid grid-cols-1 gap-2 md:grid-cols-3">{topContractors.map((contractor) => <div key={`${contractor.rank}-${contractor.name}`} className="flex items-center justify-between rounded-xl bg-slate-50 p-3 dark:bg-slate-900"><div><p className="text-sm font-bold text-foreground">#{contractor.rank} {contractor.name}</p><p className="text-xs text-muted-foreground">Quality {contractor.qualityScore ?? '—'} · Safety {contractor.safetyScore ?? '—'}</p></div><span className="text-lg font-black text-emerald-700 dark:text-emerald-400">{contractor.score}</span></div>)}</CardContent>
                </Card>
            )}
        </section>
    );
}

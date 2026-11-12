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
import type { ExecutiveDashboardData, Stats } from './types';

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

export default function ExecutiveControlTower({ enabled = true, operationalStats }: { enabled?: boolean; operationalStats?: Stats }) {
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
    const decisionSignals = data.decisionSignals;
    const statusRows = projectStats.byStatus || [];
    const topContractors = (contractorRankings || []).slice(0, 3);
    const highRisk = recentActivity.highRiskPredictions || [];
    const overdueSlaCount = operationalStats?.sla?.slaBreachedCount ?? 0;
    const sodPatRejectedCount = operationalStats?.pat?.rejected ?? 0;
    const priorityActions = [
        controlTower && controlTower.workflow.approvals.stageApprovalsOpen > 0
            ? {
                count: controlTower.workflow.approvals.stageApprovalsOpen,
                title: 'Clear stage approvals',
                detail: 'Project stage approvals are waiting for review.',
                href: '/projects/dashboards/pm',
            }
            : null,
        sodPatRejectedCount > 0
            ? {
                count: sodPatRejectedCount,
                title: 'Resolve SOD PAT rejections',
                detail: 'Service orders have failed PAT outcomes waiting for operational review.',
                href: '/service-orders/work-order/pat',
            }
            : null,
        patStats.failed > 0
            ? {
                count: patStats.failed,
                title: 'Resolve failed PAT sessions',
                detail: 'Failed PAT sessions need corrective action before closeout.',
                href: '/service-orders/work-order/pat',
            }
            : null,
        overdueSlaCount > 0
            ? {
                count: overdueSlaCount,
                title: 'Clear overdue SLA queue',
                detail: 'Pending service orders have exceeded the 48-hour SLA threshold.',
                href: '/service-orders/work-order',
            }
            : null,
        controlTower && controlTower.materials.shortageQty > 0
            ? {
                count: controlTower.materials.shortageQty,
                title: 'Resolve material shortages',
                detail: 'Required project material is not yet available for issue.',
                href: '/inventory/stock',
            }
            : null,
        controlTower && controlTower.closeout.invoices.openCount > 0
            ? {
                count: controlTower.closeout.invoices.openCount,
                title: 'Close open project invoices',
                detail: 'Project invoices remain open in the closeout workflow.',
                href: '/finance/invoices',
            }
            : null,
        controlTower && controlTower.risks.openCount > 0
            ? {
                count: controlTower.risks.openCount,
                title: 'Review open project risks',
                detail: 'Open risks may affect delivery and require an owner decision.',
                href: '/projects/dashboards/pm',
            }
            : null,
    ].filter((action): action is NonNullable<typeof action> => action !== null).slice(0, 3);

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
                    <p className="mt-1 text-xs text-muted-foreground">Only metrics returned by the scoped executive API are shown. This overview covers your whole access scope; the Region and RTOM filters apply to the other tabs.</p>
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

            <Card className="border-indigo-200 bg-indigo-50/60 dark:border-indigo-900 dark:bg-indigo-950/30" aria-label="Dashboard decision brief">
                <CardHeader className="flex flex-col gap-1 pb-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <CardTitle className="flex items-center gap-2 text-sm font-black text-indigo-950 dark:text-indigo-100">
                            <AlertTriangle className="h-4 w-4 text-indigo-700 dark:text-indigo-300" />
                            What needs attention now
                        </CardTitle>
                        <p className="mt-1 text-xs text-indigo-900/80 dark:text-indigo-200/80">Recommended next steps from the live project control signals.</p>
                    </div>
                    <Badge variant="outline" className="w-fit border-indigo-300 bg-white text-indigo-900 dark:border-indigo-700 dark:bg-indigo-950 dark:text-indigo-100">
                        {priorityActions.length > 0 ? `${priorityActions.length} priority action${priorityActions.length === 1 ? '' : 's'}` : 'No immediate actions'}
                    </Badge>
                </CardHeader>
                <CardContent>
                    {priorityActions.length > 0 ? (
                        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                            {priorityActions.map((action) => (
                                <Link key={action.title} href={action.href} className="group rounded-xl border border-indigo-200 bg-white p-3 transition hover:border-indigo-400 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-700 dark:border-indigo-800 dark:bg-slate-950 dark:hover:border-indigo-500">
                                    <div className="flex items-start justify-between gap-3">
                                        <div>
                                            <p className="text-lg font-black text-slate-950 dark:text-slate-100">{action.count.toLocaleString()}</p>
                                            <p className="text-xs font-black text-slate-900 dark:text-slate-100">{action.title}</p>
                                        </div>
                                        <ArrowUpRight className="h-4 w-4 shrink-0 text-indigo-700 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5 dark:text-indigo-300" />
                                    </div>
                                    <p className="mt-1 text-xs text-slate-700 dark:text-slate-300">{action.detail}</p>
                                </Link>
                            ))}
                        </div>
                    ) : (
                        <p className="text-sm font-semibold text-indigo-950 dark:text-indigo-100">No immediate project control exceptions were returned for this scope.</p>
                    )}
                </CardContent>
            </Card>

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

            {decisionSignals && (
                <section aria-label="CEO decision signals" className="space-y-3">
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                        <div>
                            <p className="text-xs font-black uppercase tracking-[0.18em] text-primary">CEO decision signals</p>
                            <h2 className="mt-1 text-lg font-black text-foreground">Forecast, commercial exposure and change impact</h2>
                            <p className="mt-1 text-xs text-muted-foreground">Only persisted EVM, invoice, payment, retention, penalty and change-request values are included.</p>
                        </div>
                        <Link href="/projects/dashboards/financials" className="inline-flex items-center gap-1 text-xs font-bold text-primary hover:underline">Open financial controls <ArrowUpRight className="h-3.5 w-3.5" /></Link>
                    </div>

                    <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
                        <Card className="border-indigo-200 bg-indigo-50/50 dark:border-indigo-900 dark:bg-indigo-950/20">
                            <CardHeader className="pb-3"><CardTitle className="text-sm font-black text-indigo-950 dark:text-indigo-100">Forecast and delivery outlook</CardTitle></CardHeader>
                            <CardContent className="space-y-3">
                                <div className="grid grid-cols-2 gap-3">
                                    <Metric label="Forecast coverage" value={`${decisionSignals.evm.forecastValueCount}/${decisionSignals.evm.projectCount}`} hint={`${decisionSignals.evm.recordCount} EVM records`} />
                                    <Metric label="EVM exceptions" value={decisionSignals.evm.exceptions.length} hint={`${decisionSignals.evm.redCount} red · ${decisionSignals.evm.amberCount} amber`} tone={decisionSignals.evm.exceptions.length > 0 ? 'text-rose-700 dark:text-rose-400' : 'text-emerald-700 dark:text-emerald-400'} />
                                </div>
                                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                                    <div className="flex justify-between gap-2"><span className="text-muted-foreground">EAC</span><span className="font-black text-foreground">{decisionSignals.evm.forecastValueCount > 0 ? formatLKR(decisionSignals.evm.totalEstimateAtCompletion) : '—'}</span></div>
                                    <div className="flex justify-between gap-2"><span className="text-muted-foreground">ETC</span><span className="font-black text-foreground">{decisionSignals.evm.forecastValueCount > 0 ? formatLKR(decisionSignals.evm.totalEstimateToComplete) : '—'}</span></div>
                                    <div className="flex justify-between gap-2"><span className="text-muted-foreground">VAC</span><span className={`font-black ${decisionSignals.evm.totalVarianceAtCompletion < 0 ? 'text-rose-700 dark:text-rose-400' : 'text-emerald-700 dark:text-emerald-400'}`}>{decisionSignals.evm.forecastValueCount > 0 ? formatLKR(decisionSignals.evm.totalVarianceAtCompletion) : '—'}</span></div>
                                    <div className="flex justify-between gap-2"><span className="text-muted-foreground">SPI / CPI</span><span className="font-black text-foreground">{decisionSignals.evm.averageSpi == null ? '—' : `${decisionSignals.evm.averageSpi} / ${decisionSignals.evm.averageCpi ?? '—'}`}</span></div>
                                </div>
                                {decisionSignals.evm.exceptions.length > 0 ? (
                                    <div className="space-y-1 border-t border-indigo-200 pt-2 dark:border-indigo-800">
                                        {decisionSignals.evm.exceptions.slice(0, 3).map((exception) => <Link key={exception.projectId} href={`/projects/${exception.projectId}`} className="flex items-center justify-between gap-2 rounded-lg px-2 py-1 text-xs font-bold text-primary hover:bg-white/70 dark:hover:bg-slate-950/60"><span className="truncate">{exception.projectName}</span><span className="shrink-0">{exception.status}</span></Link>)}
                                    </div>
                                ) : <p className="text-xs text-muted-foreground">No stored EVM exception signals in this scope.</p>}
                                {decisionSignals.evm.latestCalculatedAt && <p className="text-[11px] text-muted-foreground">Latest EVM calculation: {formatAsOf(decisionSignals.evm.latestCalculatedAt)}</p>}
                            </CardContent>
                        </Card>

                        <Card className="border-emerald-200 bg-emerald-50/40 dark:border-emerald-900 dark:bg-emerald-950/20">
                            <CardHeader className="pb-3"><CardTitle className="text-sm font-black text-emerald-950 dark:text-emerald-100">Commercial exposure</CardTitle></CardHeader>
                            <CardContent className="space-y-2 text-sm">
                                <div className="flex justify-between gap-3"><span className="text-muted-foreground">Billed</span><span className="font-black text-foreground">{formatLKR(decisionSignals.commercial.billedAmount)}</span></div>
                                <div className="flex justify-between gap-3"><span className="text-muted-foreground">Collected</span><span className="font-black text-emerald-700 dark:text-emerald-400">{formatLKR(decisionSignals.commercial.collectedAmount)}</span></div>
                                <div className="flex justify-between gap-3"><span className="text-muted-foreground">Receivables</span><span className="font-black text-rose-700 dark:text-rose-400">{formatLKR(decisionSignals.commercial.receivablesAmount)}</span></div>
                                <div className="flex justify-between gap-3"><span className="text-muted-foreground">Pending payment commitments</span><span className="font-black text-amber-700 dark:text-amber-400">{formatLKR(decisionSignals.commercial.pendingPaymentAmount)} <span className="text-xs font-semibold">({decisionSignals.commercial.pendingPaymentCount})</span></span></div>
                                <div className="flex justify-between gap-3"><span className="text-muted-foreground">Retention held</span><span className="font-black text-foreground">{formatLKR(decisionSignals.commercial.retentionHeldAmount)}</span></div>
                                <div className="flex justify-between gap-3"><span className="text-muted-foreground">Open LD penalties</span><span className="font-black text-rose-700 dark:text-rose-400">{formatLKR(decisionSignals.commercial.openPenaltyAmount)} <span className="text-xs font-semibold">({decisionSignals.commercial.openPenaltyCount})</span></span></div>
                                <Link href="/finance/reports/pnl" className="inline-flex items-center gap-1 pt-2 text-xs font-bold text-primary hover:underline">Reconcile finance position <ArrowUpRight className="h-3.5 w-3.5" /></Link>
                            </CardContent>
                        </Card>

                        <Card className="border-amber-200 bg-amber-50/40 dark:border-amber-900 dark:bg-amber-950/20">
                            <CardHeader className="pb-3"><CardTitle className="text-sm font-black text-amber-950 dark:text-amber-100">Decision queue</CardTitle></CardHeader>
                            <CardContent className="space-y-3">
                                <div className="grid grid-cols-3 gap-2">
                                    <Metric label="Open changes" value={decisionSignals.changes.openCount} />
                                    <Metric label="Cost impact" value={formatLKR(decisionSignals.changes.totalCostImpact)} />
                                    <Metric label="Time impact" value={`${decisionSignals.changes.totalTimeImpactDays}d`} />
                                </div>
                                {decisionSignals.changes.topOpen.length > 0 ? (
                                    <div className="space-y-1 border-t border-amber-200 pt-2 dark:border-amber-800">
                                        {decisionSignals.changes.topOpen.slice(0, 3).map((change) => <Link key={change.id} href={`/projects/${change.projectId}`} className="block rounded-lg px-2 py-1 hover:bg-white/70 dark:hover:bg-slate-950/60"><p className="truncate text-xs font-bold text-primary">{change.projectName}: {change.title}</p><p className="text-[11px] text-muted-foreground">{change.requestNumber} · {change.status} · {formatLKR(change.costImpact)} · {change.timeImpact}d</p></Link>)}
                                    </div>
                                ) : <p className="text-xs text-muted-foreground">No open change requests in this scope.</p>}
                                <Link href="/projects/dashboards/pm" className="inline-flex items-center gap-1 text-xs font-bold text-primary hover:underline">Open project decisions <ArrowUpRight className="h-3.5 w-3.5" /></Link>
                            </CardContent>
                        </Card>
                    </div>
                </section>
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

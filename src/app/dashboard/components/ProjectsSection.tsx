import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { FolderKanban, AlertOctagon } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { formatLKR } from '@/lib/utils';
import Link from 'next/link';

interface ProjectOverview {
    overview: {
        activeProjects: number;
        totalBudget: number;
        actualSpend: number;
        scheduleVariance: number;
        delayedCount: number;
    };
    statusBreakdown: { status: string; count: number }[];
    delayedProjects: { id?: string; name: string; delay: number; progress: number; status: string }[];
    updatedAt?: string;
}

interface ProjectsSectionProps {
    user: { id: string; role: string };
    enabled?: boolean;
}

const PROJECTS_REQUEST_TIMEOUT_MS = 12_000;

function statusLabel(status: string) {
    return status.replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function ProjectsLoadingState() {
    return (
        <div className="space-y-4" role="status" aria-live="polite">
            <div className="flex items-center gap-2 px-1 text-sm font-semibold text-slate-900 dark:text-slate-100">
                <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-cyan-600" aria-hidden="true" />
                Loading project dashboard data…
            </div>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <Skeleton className="h-48 rounded-xl" />
                <Skeleton className="h-48 rounded-xl" />
            </div>
            <Skeleton className="h-32 rounded-xl" />
            <span className="sr-only">Project metrics and delayed project information are loading.</span>
        </div>
    );
}

function ProjectsErrorState({ error, onRetry, isRetrying }: { error: Error; onRetry: () => void; isRetrying: boolean }) {
    return (
        <Card className="border-rose-200 bg-rose-50 shadow-sm dark:border-rose-900 dark:bg-rose-950/30" role="alert">
            <CardHeader>
                <CardTitle className="text-sm font-semibold text-rose-900 dark:text-rose-100">Project dashboard unavailable</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-rose-800 dark:text-rose-200">
                    {error.message || 'Project data could not be loaded. Please try again.'}
                </p>
                <button
                    type="button"
                    onClick={onRetry}
                    disabled={isRetrying}
                    className="inline-flex min-h-10 shrink-0 items-center justify-center rounded-md bg-rose-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-700 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-rose-600 dark:hover:bg-rose-500"
                >
                    {isRetrying ? 'Retrying…' : 'Retry'}
                </button>
            </CardContent>
        </Card>
    );
}

export default function ProjectsSection({ user, enabled = true }: ProjectsSectionProps) {
    const { data, isLoading, isFetching, error, refetch } = useQuery<ProjectOverview>({
        queryKey: ['dashboard-projects', user.id],
        queryFn: async ({ signal }) => {
            const controller = new AbortController();
            let timedOut = false;
            const timeoutId = setTimeout(() => {
                timedOut = true;
                controller.abort();
            }, PROJECTS_REQUEST_TIMEOUT_MS);

            const abortFromQuery = () => controller.abort();
            signal.addEventListener('abort', abortFromQuery, { once: true });

            try {
                const resp = await fetch(`/api/dashboard/projects?includeRecentActivities=false`, {
                headers: {
                    'x-user-id': user.id,
                    'x-user-role': user.role,
                    },
                    signal: controller.signal,
                });
                if (!resp.ok) {
                    const message = resp.status === 403
                        ? 'You do not have permission to view project dashboard data.'
                        : `Project data request failed (${resp.status}).`;
                    const requestError = new Error(message) as Error & { status?: number };
                    requestError.status = resp.status;
                    throw requestError;
                }
                return resp.json() as Promise<ProjectOverview>;
            } catch (requestError) {
                if (timedOut) {
                    throw new Error('Project data is taking too long to respond. Check your connection and retry.');
                }
                throw requestError;
            } finally {
                clearTimeout(timeoutId);
                signal.removeEventListener('abort', abortFromQuery);
            }
        },
        staleTime: 5 * 60 * 1000,
        gcTime: 30 * 60 * 1000,
        enabled: enabled && Boolean(user.id),
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
        return <ProjectsLoadingState />;
    }
    if (error && !data) {
        return <ProjectsErrorState error={error as Error} onRetry={() => refetch()} isRetrying={isFetching} />;
    }
    if (!data) {
        return <ProjectsErrorState error={new Error('No project dashboard data was returned.')} onRetry={() => refetch()} isRetrying={isFetching} />;
    }
    const overview = data.overview || { activeProjects: 0, totalBudget: 0, actualSpend: 0, scheduleVariance: 0, delayedCount: 0 };
    const delayedProjects = data.delayedProjects || [];
    const statusBreakdown = data.statusBreakdown || [];
    return (
        <div className="space-y-4">
            {error && (
                <div className="flex flex-col gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100 sm:flex-row sm:items-center sm:justify-between" role="status">
                    <span>Showing the last available project data. Refresh did not complete.</span>
                    <button type="button" onClick={() => refetch()} disabled={isFetching} className="font-semibold underline underline-offset-2 disabled:cursor-not-allowed disabled:opacity-60">
                        {isFetching ? 'Retrying…' : 'Retry'}
                    </button>
                </div>
            )}
            {isFetching && !error && <p className="text-xs font-medium text-slate-700 dark:text-slate-300" role="status">Refreshing project data…</p>}
            <div className="flex flex-col gap-1 px-1 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-muted-foreground">Project health and delivery portfolio</p>
                <span className="text-[11px] text-muted-foreground">{data.updatedAt ? `Data refreshed ${new Date(data.updatedAt).toLocaleString()}` : 'Data refresh timestamp was not supplied by the API.'}</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="shadow-sm transition-all hover:shadow-md border-slate-200 dark:border-slate-800">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium">Projects overview</CardTitle>
                    <FolderKanban className="w-5 h-5 text-slate-500" />
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <span className="text-xs text-muted-foreground">Active Projects</span>
                            <div className="text-2xl font-bold">{overview.activeProjects}</div>
                        </div>
                        <div className="space-y-1">
                            <span className="text-xs text-muted-foreground">Delayed projects</span>
                            <div className="text-2xl font-bold text-rose-500">{overview.delayedCount}</div>
                        </div>
                    </div>
                    <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Budget Utilized</span>
                            <span className="font-semibold">{formatLKR(overview.actualSpend)} / {formatLKR(overview.totalBudget)}</span>
                        </div>
                        <Progress value={overview.totalBudget > 0 ? (overview.actualSpend / overview.totalBudget) * 100 : 0} className="h-2 bg-slate-100" />
                    </div>
                </CardContent>
            </Card>
            <Card className="shadow-sm transition-all hover:shadow-md border-slate-200 dark:border-slate-800">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium text-rose-600 dark:text-rose-400">Critical Delays</CardTitle>
                    <AlertOctagon className="w-5 h-5 text-rose-500" />
                </CardHeader>
                <CardContent>
                    {delayedProjects.length === 0 ? (
                        <div className="text-center text-muted-foreground py-6 text-sm">
                            No delayed projects.
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {delayedProjects.slice(0, 3).map((project, i) => (
                                <div key={project.id || `${project.name}-${i}`} className="flex flex-col gap-1.5 p-2.5 rounded-lg bg-rose-50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/50">
                                    <div className="flex justify-between items-start">
                                        {project.id ? <Link href={`/projects/${project.id}`} className="font-semibold text-sm truncate pr-2 text-slate-900 hover:text-primary hover:underline dark:text-slate-100">{project.name}</Link> : <span className="font-semibold text-sm truncate pr-2 text-slate-900 dark:text-slate-100">{project.name}</span>}
                                        <Badge variant="destructive" className="shrink-0">{project.delay}d late</Badge>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Progress value={project.progress} className="h-1.5 flex-1 bg-rose-200/50" />
                                        <span className="text-xs text-rose-700 font-medium">{project.progress.toFixed(0)}%</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>
            </div>

            <Card className="shadow-sm transition-all hover:shadow-md border-slate-200 dark:border-slate-800">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium">Project status breakdown</CardTitle>
                    <Link href="/projects" className="text-xs font-bold text-primary hover:underline">Open projects →</Link>
                </CardHeader>
                <CardContent>
                    {statusBreakdown.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No status breakdown was returned.</p>
                    ) : (
                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
                            {statusBreakdown.map((row) => (
                                <div key={row.status} className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-950">
                                    <p className="truncate text-[10px] font-bold uppercase text-slate-600 dark:text-slate-400" title={statusLabel(row.status)}>{statusLabel(row.status)}</p>
                                    <p className="mt-1 text-xl font-black text-foreground">{row.count}</p>
                                </div>
                            ))}
                        </div>
                    )}
                    <p className="mt-3 text-xs text-muted-foreground">Workflow stage, BOQ, materials, PAT, as-built and invoice closeout counters are not returned by this dashboard API.</p>
                </CardContent>
            </Card>
        </div>
    );
}

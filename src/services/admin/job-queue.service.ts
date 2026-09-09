import {
    sodImportQueue,
    notificationsQueue,
    statsUpdateQueue,
    sodSyncQueue,
    systemQueue
} from '@/lib/queue';

export interface JobQueueStat {
    name: string;
    active: number;
    waiting: number;
    completed: number;
    failed: number;
    delayed: number;
    recentFailures: Array<{
        id?: string;
        name?: string;
        data?: unknown;
        failedReason?: string;
        processedOn?: number;
        finishedOn?: number;
    }>;
    recentCompleted: Array<{
        id?: string;
        name?: string;
        finishedOn?: number;
    }>;
    repeatableCount: number;
    repeatable: Array<{
        key: string;
        name: string;
        next: string;
    }>;
}

export class JobQueueService {
    /**
     * Fallback stats when Redis is offline or unreachable
     */
    private static getFallbackStats(): JobQueueStat[] {
        const queueNames = ['SOD Import', 'Notifications', 'Stats Update', 'SOD Sync', 'System'];
        return queueNames.map(name => ({
            name,
            active: 0,
            waiting: 0,
            completed: 0,
            failed: 0,
            delayed: 0,
            recentFailures: [],
            recentCompleted: [],
            repeatableCount: 0,
            repeatable: []
        }));
    }

    /**
     * Get statistics for all active queues with a hard 3-second timeout guard
     */
    static async getQueueStats(): Promise<JobQueueStat[]> {
        const queues = [
            { name: 'SOD Import', queue: sodImportQueue },
            { name: 'Notifications', queue: notificationsQueue },
            { name: 'Stats Update', queue: statsUpdateQueue },
            { name: 'SOD Sync', queue: sodSyncQueue },
            { name: 'System', queue: systemQueue }
        ];

        const statsPromise = Promise.all(queues.map(async (q): Promise<JobQueueStat> => {
            const [active, waiting, completed, failed, delayed, repeatable] = await Promise.all([
                q.queue.getActiveCount().catch(() => 0),
                q.queue.getWaitingCount().catch(() => 0),
                q.queue.getCompletedCount().catch(() => 0),
                q.queue.getFailedCount().catch(() => 0),
                q.queue.getDelayedCount().catch(() => 0),
                q.queue.getRepeatableJobs().catch(() => [])
            ]);

            // Get last 5 failed jobs
            const failedJobs = await q.queue.getFailed(0, 5).catch(() => []);
            const recentFailures = failedJobs.map(job => ({
                id: job.id,
                name: job.name,
                data: job.data,
                failedReason: job.failedReason,
                processedOn: job.processedOn,
                finishedOn: job.finishedOn,
            }));

            // Get last 2 completed jobs to show "Last Sync" time
            const completedJobs = await q.queue.getCompleted(0, 1).catch(() => []);
            const recentCompleted = completedJobs.map(job => ({
                id: job.id ? String(job.id) : undefined,
                name: job.name ? String(job.name) : undefined,
                finishedOn: typeof job.finishedOn === 'number' ? job.finishedOn : undefined,
            }));

            return {
                name: q.name,
                active,
                waiting,
                completed,
                failed,
                delayed,
                recentFailures,
                recentCompleted,
                repeatableCount: repeatable.length,
                repeatable: repeatable.map(rj => ({
                    key: rj.key as string,
                    name: rj.name as string,
                    next: rj.next ? new Date(Number(rj.next)).toLocaleString() : 'N/A'
                }))
            };
        }));

        const timeoutPromise = new Promise<JobQueueStat[]>((resolve) => {
            setTimeout(() => {
                console.warn('[JobQueueService] getQueueStats timed out after 3000ms. Returning fallback stats.');
                resolve(this.getFallbackStats());
            }, 3000);
        });

        return await Promise.race([statsPromise, timeoutPromise]);
    }
}

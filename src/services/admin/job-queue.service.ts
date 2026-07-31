import {
    sodImportQueue,
    notificationsQueue,
    statsUpdateQueue,
    sodSyncQueue,
    systemQueue
} from '@/lib/queue';

export class JobQueueService {
    /**
     * Get statistics for all active queues
     */
    static async getQueueStats() {
        const queues = [
            { name: 'SOD Import', queue: sodImportQueue },
            { name: 'Notifications', queue: notificationsQueue },
            { name: 'Stats Update', queue: statsUpdateQueue },
            { name: 'SOD Sync', queue: sodSyncQueue },
            { name: 'System', queue: systemQueue }
        ];

        const stats = await Promise.all(queues.map(async (q) => {
            const [active, waiting, completed, failed, delayed, repeatable] = await Promise.all([
                q.queue.getActiveCount(),
                q.queue.getWaitingCount(),
                q.queue.getCompletedCount(),
                q.queue.getFailedCount(),
                q.queue.getDelayedCount(),
                q.queue.getRepeatableJobs()
            ]);

            // Get last 5 failed jobs
            const failedJobs = await q.queue.getFailed(0, 5);
            const recentFailures = failedJobs.map(job => ({
                id: job.id,
                name: job.name,
                data: job.data,
                failedReason: job.failedReason,
                processedOn: job.processedOn,
                finishedOn: job.finishedOn,
            }));

            // Get last 2 completed jobs to show "Last Sync" time
            const completedJobs = await q.queue.getCompleted(0, 1);
            const recentCompleted = completedJobs.map(job => ({
                id: job.id,
                name: job.name,
                finishedOn: job.finishedOn,
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

        return stats;
    }
}

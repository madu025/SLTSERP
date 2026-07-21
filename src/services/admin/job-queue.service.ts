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

            return {
                name: q.name,
                active,
                waiting,
                completed,
                failed,
                delayed,
                recentFailures,
                repeatableCount: repeatable.length,
                repeatable: repeatable.map(rj => ({
                    key: rj.key,
                    name: rj.name,
                    next: rj.next ? new Date(rj.next).toLocaleString() : 'N/A'
                }))
            };
        }));

        return stats;
    }
}

import { NextResponse } from 'next/server';
import {
    sodImportQueue,
    notificationsQueue,
    statsUpdateQueue,
    sodSyncQueue
} from '@/lib/queue';

export async function GET() {
    try {
        const queues = [
            { name: 'SOD Import', queue: sodImportQueue },
            { name: 'Notifications', queue: notificationsQueue },
            { name: 'Stats Update', queue: statsUpdateQueue },
            { name: 'SOD Sync', queue: sodSyncQueue },
        ];

        const stats = await Promise.all(queues.map(async (q) => {
            const [active, waiting, completed, failed, delayed] = await Promise.all([
                q.queue.getActiveCount(),
                q.queue.getWaitingCount(),
                q.queue.getCompletedCount(),
                q.queue.getFailedCount(),
                q.queue.getDelayedCount(),
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
                recentFailures
            };
        }));

        return NextResponse.json({
            success: true,
            queues: stats,
            timestamp: new Date().toISOString()
        });

    } catch (error: any) {
        console.error('[JOBS-API] Error fetching job stats:', error);
        return NextResponse.json({
            success: false,
            error: error.message || 'Internal Server Error'
        }, { status: 500 });
    }
}

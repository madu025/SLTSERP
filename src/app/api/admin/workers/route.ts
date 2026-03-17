import { NextResponse } from 'next/server';
import { 
    sodImportQueue, 
    notificationsQueue, 
    statsUpdateQueue, 
    sodSyncQueue, 
    systemQueue 
} from '@/lib/queue';

export async function GET() {
    try {
        const queues = [
            { name: 'SOD Import', queue: sodImportQueue },
            { name: 'Notifications', queue: notificationsQueue },
            { name: 'Stats Update', queue: statsUpdateQueue },
            { name: 'SOD Sync', queue: sodSyncQueue },
            { name: 'System', queue: systemQueue }
        ];

        const stats = await Promise.all(queues.map(async (q) => {
            const [waiting, active, completed, failed, delayed, repeatable] = await Promise.all([
                q.queue.getWaitingCount(),
                q.queue.getActiveCount(),
                q.queue.getCompletedCount(),
                q.queue.getFailedCount(),
                q.queue.getDelayedCount(),
                q.queue.getRepeatableJobs()
            ]);

            return {
                name: q.name,
                waiting,
                active,
                completed,
                failed,
                delayed,
                repeatableCount: repeatable.length,
                repeatable: repeatable.map(rj => ({
                    key: rj.key,
                    name: rj.name,
                    next: rj.next ? new Date(rj.next).toLocaleString() : 'N/A'
                }))
            };
        }));

        return NextResponse.json({
            success: true,
            queues: stats,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('[WORKER-STATS-API] Error:', error);
        return NextResponse.json({ error: 'Failed to fetch worker stats' }, { status: 500 });
    }
}

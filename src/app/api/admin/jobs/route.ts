import { apiHandler } from '@/lib/api-handler';
import { JobQueueService } from '@/services/admin/job-queue.service';

export const GET = apiHandler(async () => {
    const stats = await JobQueueService.getQueueStats();
    
    return Response.json({
        success: true,
        queues: stats,
        timestamp: new Date().toISOString()
    });
}, {
    roles: ['SUPER_ADMIN', 'ADMIN']
});

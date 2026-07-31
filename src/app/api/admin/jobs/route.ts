import { ROLE_GROUPS } from '@/config/roles';
export const dynamic = 'force-dynamic';

import { apiHandler } from '@/lib/api-handler';
import { JobQueueService } from '@/services/admin/job-queue.service';

export const GET = apiHandler(async () => {
    const stats = await JobQueueService.getQueueStats();
    
    return {
        queues: stats,
        timestamp: new Date().toISOString()
    };
}, {
    roles: ROLE_GROUPS.ADMINS
});

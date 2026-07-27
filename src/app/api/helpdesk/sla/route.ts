import { apiHandler } from '@/lib/api-handler';
import { SLABreachWorkerService } from '@/services/helpdesk/sla-worker.service';

export const dynamic = 'force-dynamic';

export const GET = apiHandler(async () => {
    return await SLABreachWorkerService.getSLAStats();
});

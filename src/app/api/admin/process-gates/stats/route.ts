export const dynamic = 'force-dynamic';
import { apiHandler } from '@/lib/api-handler';
import { ProcessGateStatsService } from '@/services/admin/process-gate-stats.service';

// GET /api/admin/process-gates/stats - live figures per gate step: items waiting and how many people can act on the step
export const GET = apiHandler(async () => {
    return ProcessGateStatsService.forAllGates();
});

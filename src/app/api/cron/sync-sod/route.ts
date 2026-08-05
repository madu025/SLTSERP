export const dynamic = 'force-dynamic';
export const maxDuration = 60;

import { apiHandler } from '@/lib/api-handler';
import { ServiceOrderService } from '@/services/service-order/sod.service';
import { assertCronAuth } from '@/lib/cron-auth';

/**
 * GET /api/cron/sync-sod
 * This endpoint triggers a complete sync of all RTOMs/OPMCs.
 * Designed to be called by a cron job every 30 minutes.
 */
export const GET = apiHandler(async (req) => {
    assertCronAuth(req);
    const { searchParams } = new URL(req.url);

    const offset = parseInt(searchParams.get('offset') || '0');
    const limit = parseInt(searchParams.get('limit') || '15');

    console.log(`[CRON] Starting Automated SOD Sync (offset=${offset}, limit=${limit}) at ${new Date().toISOString()}...`);

    const syncResult = await ServiceOrderService.syncAllOpmcs(offset, limit);

    // Check for daily tasks trigger
    let automationResults = null;
    const runDailyTasks = searchParams.get('tasks') === 'daily';

    if (runDailyTasks) {
        const { AutomationService } = await import('@/services/automation/automation.service');
        automationResults = await AutomationService.runAllDailyTasks();
    }

    return Response.json({
        success: true,
        timestamp: new Date().toISOString(),
        sync: syncResult,
        automation: automationResults
    });
});

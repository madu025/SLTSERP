import { apiHandler } from '@/lib/api-handler';
import { ServiceOrderService } from '@/services/sod.service';
import { AppError } from '@/lib/error';

/**
 * GET /api/cron/sync-sod
 * This endpoint triggers a complete sync of all RTOMs/OPMCs.
 * Designed to be called by a cron job every 30 minutes.
 */
export const GET = apiHandler(async (req) => {
    const { searchParams } = new URL(req.url);
    const secret = searchParams.get('secret');

    // Simple security: check for a secret token in the URL
    // In production, this should match an environment variable like CRON_SECRET
    if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) {
        throw AppError.unauthorized('Unauthorized: Invalid CRON_SECRET');
    }

    console.log(`[CRON] Starting Automated SOD Sync at ${new Date().toISOString()}...`);

    const syncResult = await ServiceOrderService.syncAllOpmcs();

    // Check for daily tasks trigger
    let automationResults = null;
    const runDailyTasks = searchParams.get('tasks') === 'daily';

    if (runDailyTasks) {
        const { AutomationService } = await import('@/services/automation.service');
        automationResults = await AutomationService.runAllDailyTasks();
    }

    return Response.json({
        success: true,
        timestamp: new Date().toISOString(),
        sync: syncResult,
        automation: automationResults
    });
});

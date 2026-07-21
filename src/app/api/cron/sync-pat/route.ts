import { apiHandler } from '@/lib/api-handler';
import { ServiceOrderService } from '@/services/sod.service';
import { AppError } from '@/lib/error';

export const dynamic = 'force-dynamic';

/**
 * GET /api/cron/sync-pat
 * This endpoint triggers a sync of global PAT results (HO Approved & HO Rejected).
 * Designed to be called by a cron job or triggered manually.
 */
export const GET = apiHandler(async (req) => {
    const { searchParams } = new URL(req.url);
    const secret = searchParams.get('secret');

    // Security check
    if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) {
        throw AppError.unauthorized('Unauthorized: Invalid CRON_SECRET');
    }

    console.log(`[CRON] Starting Automated PAT Sync at ${new Date().toISOString()}...`);

    const approvedResult = await ServiceOrderService.syncHoApprovedResults();
    const rejectedResult = await ServiceOrderService.syncHoRejectedResults();

    return Response.json({
        success: true,
        timestamp: new Date().toISOString(),
        approved: approvedResult,
        rejected: rejectedResult
    });
});

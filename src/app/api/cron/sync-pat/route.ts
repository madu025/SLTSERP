export const dynamic = "force-dynamic";
export const maxDuration = 300;

import { apiHandler } from "@/lib/api-handler";
import { ServiceOrderService } from "@/services/service-order/sod.service";
import { assertCronAuth } from "@/lib/cron-auth";

/**
 * GET /api/cron/sync-pat
 * Triggers HO Approved + Rejected PAT Result sync.
 * Designed to be called every 30 minutes by GitHub Actions.
 */
export const GET = apiHandler(async (req) => {
    assertCronAuth(req);

    console.log(`[CRON] Starting PAT Sync at ${new Date().toISOString()}...`);
    const startTime = Date.now();

    const [approvedResult, rejectedResult] = await Promise.all([
        ServiceOrderService.syncHoApprovedResults(),
        ServiceOrderService.syncHoRejectedResults(),
    ]);

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`[CRON] PAT Sync completed in ${duration}s`);

    return Response.json({
        success: true,
        timestamp: new Date().toISOString(),
        duration: `${duration}s`,
        approvedResult,
        rejectedResult,
    });
});

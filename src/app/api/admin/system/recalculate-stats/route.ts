import { apiHandler } from '@/lib/api-handler';
import { StatsService } from '@/lib/stats.service';

export const dynamic = 'force-dynamic';

export const POST = apiHandler(async () => {
    console.log('[RECALC] Starting system-wide statistics recalculation...');
    const startTime = Date.now();

    await StatsService.globalRecalculate();

    const duration = (Date.now() - startTime) / 1000;
    console.log(`[RECALC] Completed in ${duration}s`);

    return Response.json({
        success: true,
        message: 'All regional stats have been recalculated',
        duration: `${duration}s`
    });
}, {
    roles: ['SUPER_ADMIN'],
    audit: { action: 'SYSTEM_RECALCULATE_STATS', entity: 'Admin' }
});

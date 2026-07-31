export const dynamic = 'force-dynamic';
import { ROLE_GROUPS } from '@/config/roles';
import { apiHandler } from '@/lib/api-handler';
import { StatsService } from '@/lib/stats.service';

export const POST = apiHandler(async () => {
    // Start global recalculation in background (or wait for it if not too many OPMCs)
    await StatsService.globalRecalculate();

    return Response.json({
        success: true,
        message: 'Global stats recalculation completed'
    });
}, {
    roles: ROLE_GROUPS.ADMINS,
    audit: { action: 'RECALCULATE_STATS', entity: 'Admin' }
});

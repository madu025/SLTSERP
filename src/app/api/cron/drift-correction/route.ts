export const dynamic = 'force-dynamic';

import { apiHandler } from '@/lib/api-handler';
import { StatsService } from '@/lib/stats.service';
import { logger } from '@/lib/logger';
import { assertCronAuth } from '@/lib/cron-auth';

export const GET = apiHandler(async (req) => {
    assertCronAuth(req);

    logger.info('Starting scheduled Stats Drift Correction...');
    const corrected = await StatsService.driftCorrection();

    return Response.json({
        message: 'Drift correction completed.',
        rtomsUpdated: corrected
    });
});

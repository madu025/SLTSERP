import { apiHandler } from '@/lib/api-handler';
import { StatsService } from '@/lib/stats.service';
import { logger } from '@/lib/logger';
import { AppError } from '@/lib/error';

export const GET = apiHandler(async (req) => {
    const { searchParams } = new URL(req.url);
    const secret = searchParams.get('secret');
    
    if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) {
        throw AppError.unauthorized('Unauthorized: Invalid CRON_SECRET');
    }

    logger.info('Starting scheduled Stats Drift Correction...');
    const corrected = await StatsService.driftCorrection();

    return Response.json({
        message: 'Drift correction completed.',
        rtomsUpdated: corrected
    });
});

import { NextResponse } from 'next/server';
import { StatsService } from '@/lib/stats.service';
import { logger } from '@/lib/logger';

export async function GET(request: Request) {
    try {
        // Simple security check for cron (could be a secret header)
        const { searchParams } = new URL(request.url);
        const secret = searchParams.get('secret');
        if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) {
            return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
        }

        logger.info('Starting scheduled Stats Drift Correction...');
        const corrected = await StatsService.driftCorrection();

        return NextResponse.json({
            message: 'Drift correction completed.',
            rtomsUpdated: corrected
        });
    } catch (error) {
        logger.error('Drift correction job failed', error);
        return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
    }
}

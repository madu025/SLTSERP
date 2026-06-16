import { NextResponse } from 'next/server';
import { StatsService } from '@/lib/stats.service';
import { handleApiError } from '@/lib/api-utils';

export const dynamic = 'force-dynamic';

export async function POST() {
    try {
        console.log('[RECALC] Starting system-wide statistics recalculation...');
        const startTime = Date.now();

        await StatsService.globalRecalculate();

        const duration = (Date.now() - startTime) / 1000;
        console.log(`[RECALC] Completed in ${duration}s`);

        return NextResponse.json({
            success: true,
            message: 'All regional stats have been recalculated',
            duration: `${duration}s`
        });
    } catch (error) {
        return handleApiError(error);
    }
}

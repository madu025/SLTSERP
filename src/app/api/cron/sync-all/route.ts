import { NextRequest, NextResponse } from 'next/server';
import { ServiceOrderService } from '@/services/sod.service';

/**
 * Scheduled Sync for all Service Orders from SLT API
 * Can be triggered by a Cron Job service (e.g., Vercel Cron, GitHub Actions)
 */
export async function GET(req: NextRequest) {
    // Basic Security: Check for Cron Secret if configured
    const authHeader = req.headers.get('authorization');
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('[CRON] Starting Global SOD Sync...');
    try {
        const startTime = Date.now();
        const results = await ServiceOrderService.syncAllOpmcs();
        const duration = (Date.now() - startTime) / 1000;

        console.log(`[CRON] Global SOD Sync completed in ${duration}s`, results.stats);

        return NextResponse.json({
            success: true,
            message: 'Global sync completed',
            duration: `${duration}s`,
            stats: results.stats
        });
    } catch (error: any) {
        console.error('[CRON] Global SOD Sync failed:', error);
        return NextResponse.json({
            success: false,
            error: error.message
        }, { status: 500 });
    }
}

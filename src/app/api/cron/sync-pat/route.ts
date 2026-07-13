import { NextResponse } from 'next/server';
import { ServiceOrderService } from '@/services/sod.service';

export const dynamic = 'force-dynamic';

/**
 * GET /api/cron/sync-pat
 * This endpoint triggers a sync of global PAT results (HO Approved & HO Rejected).
 * Designed to be called by a cron job or triggered manually.
 */
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const secret = searchParams.get('secret');

        // Security check
        if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) {
            return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
        }

        console.log(`[CRON] Starting Automated PAT Sync at ${new Date().toISOString()}...`);

        const approvedResult = await ServiceOrderService.syncHoApprovedResults();
        const rejectedResult = await ServiceOrderService.syncHoRejectedResults();

        return NextResponse.json({
            success: true,
            timestamp: new Date().toISOString(),
            approved: approvedResult,
            rejected: rejectedResult
        });

    } catch (error: any) {
        console.error('[CRON] PAT Sync Error:', error);
        return NextResponse.json({
            success: false,
            error: error.message || 'Unknown error'
        }, { status: 500 });
    }
}

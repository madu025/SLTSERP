import { NextResponse } from 'next/server';
import { ServiceOrderService } from '@/services/sod.service';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/cron/sync-sod
 * This endpoint triggers a complete sync of all RTOMs/OPMCs.
 * Designed to be called by a cron job every 30 minutes.
 */
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const secret = searchParams.get('secret');

        // Simple security: check for a secret token in the URL
        // In production, this should match an environment variable like CRON_SECRET
        if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) {
            return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
        }

        console.log(`[CRON] Starting Automated SOD Sync at ${new Date().toISOString()}...`);

        const syncResult = await ServiceOrderService.syncAllOpmcs();

        // Check for daily tasks trigger
        let automationResults = null;
        const runDailyTasks = searchParams.get('tasks') === 'daily';

        if (runDailyTasks) {
            const { AutomationService } = await import('@/services/automation.service');
            automationResults = await AutomationService.runAllDailyTasks();
        }

        return NextResponse.json({
            success: true,
            timestamp: new Date().toISOString(),
            sync: syncResult,
            automation: automationResults
        });

    } catch (error: any) {
        console.error('[CRON] Sync Error:', error);
        return NextResponse.json({
            success: false,
            error: error.message || 'Unknown error'
        }, { status: 500 });
    }
}

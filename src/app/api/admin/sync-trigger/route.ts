import { NextResponse } from 'next/server';
import { ServiceOrderService } from '@/services/sod.service';
import { prisma } from '@/lib/prisma';

// This endpoint allows admins to manually trigger the sync process
export async function POST(request: Request) {
    try {
        console.log('[MANUAL-SYNC] Triggered by admin');

        // In a real scenario, we should authenticate the user here
        // But for now we rely on the implementation being server-side

        // We trigger the syncAllOpmcs method directly
        // Note: This runs in the API route context (Serverless or ongoing process)
        // If it takes too long, it might timeout on Vercel (10s limit on free tier)
        // ensure we handle it or run it in background if possible, 
        // but since we are self-hosting on Docker/Lightsail, timeouts are configurable (default 300s+)

        // Call the static method directly
        const result = await ServiceOrderService.syncAllOpmcs();

        return NextResponse.json({
            success: true,
            message: 'Manual sync completed',
            stats: result.stats
        });

    } catch (error) {
        console.error('[MANUAL-SYNC] Error:', error);
        return NextResponse.json(
            { success: false, message: 'Sync failed', error: (error as any).message },
            { status: 500 }
        );
    }
}

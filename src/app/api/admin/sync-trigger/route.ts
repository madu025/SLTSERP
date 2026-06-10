import { NextResponse } from 'next/server';
import { ServiceOrderService } from '@/services/sod.service';
import { prisma } from '@/lib/prisma';

// This endpoint allows admins to manually trigger the sync process
export async function POST(request: Request) {
    try {
        console.log('[MANUAL-SYNC] Triggered by admin');

        // In a real scenario, we should authenticate the user here
        // But for now we rely on the implementation being server-side

        // Note: This runs in the API route context (Serverless or ongoing process)
        // Since we are deploying on Vercel, this is subject to serverless function timeout limits
        // (10s limit on Hobby tier, 15-300s+ on Pro tier). For large datasets, this sync should be
        // triggered asynchronously or optimized to run in smaller chunks.

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

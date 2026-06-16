import { NextResponse } from 'next/server';
import { CompletedSODSyncService } from '@/services/completed-sod-sync.service';

export async function POST(req: Request) {
    try {
        const body = await req.json().catch(() => ({}));
        const { startDate } = body;

        console.log(`[API] Manual Completed SOD Sync triggered (Start Date: ${startDate || 'Default'})`);
        const result = await CompletedSODSyncService.syncCompletedSODs(startDate);

        return NextResponse.json({
            success: true,
            message: 'Manual sync completed',
            data: result
        });
    } catch (error) {
        console.error('[API] Manual sync failed:', error);
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}

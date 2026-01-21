import { NextResponse } from 'next/server';
import { CompletedSODSyncService } from '@/services/completed-sod-sync.service';

export async function POST() {
    try {
        console.log('[API] Manual Completed SOD Sync triggered');
        const result = await CompletedSODSyncService.syncCompletedSODs();

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

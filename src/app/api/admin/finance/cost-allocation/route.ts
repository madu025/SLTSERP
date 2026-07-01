import { NextRequest, NextResponse } from 'next/server';
import { handleApiError } from '@/lib/api-utils';
import { requireAuth } from '@/lib/server-utils';
import { CostAllocationService } from '@/services/finance/cost-allocation.service';
import { runInRealtimeContext } from '@/lib/request-context';

export async function GET() {
    try {
        await requireAuth(['ADMIN', 'SUPER_ADMIN', 'OSP_MANAGER']);
        const memos = await runInRealtimeContext(async () => {
            return await CostAllocationService.getAllocationMemos();
        });
        return NextResponse.json({ success: true, data: memos });
    } catch (error) {
        return handleApiError(error);
    }
}

export async function POST(req: NextRequest) {
    try {
        await requireAuth(['ADMIN', 'SUPER_ADMIN', 'OSP_MANAGER']);
        const body = await req.json();

        const memo = await runInRealtimeContext(async () => {
            return await CostAllocationService.createAllocationMemo(body);
        });

        return NextResponse.json({ success: true, data: memo });
    } catch (error) {
        return handleApiError(error);
    }
}

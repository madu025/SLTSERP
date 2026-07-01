import { NextRequest, NextResponse } from 'next/server';
import { handleApiError } from '@/lib/api-utils';
import { requireAuth } from '@/lib/server-utils';
import { DynamicReportService } from '@/services/inventory/dynamic-report.service';
import { runInRealtimeContext } from '@/lib/request-context';

export async function POST(req: NextRequest) {
    try {
        await requireAuth(['ADMIN', 'SUPER_ADMIN', 'OSP_MANAGER']);
        const body = await req.json();

        const report = await runInRealtimeContext(async () => {
            return await DynamicReportService.generateReport(body);
        });

        return NextResponse.json({ success: true, data: report });
    } catch (error) {
        return handleApiError(error);
    }
}

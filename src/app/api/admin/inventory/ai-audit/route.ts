import { NextResponse } from 'next/server';
import { handleApiError } from '@/lib/api-utils';
import { requireAuth } from '@/lib/server-utils';
import { AiAuditService } from '@/services/inventory/ai-audit.service';
import { runInRealtimeContext } from '@/lib/request-context';

export async function GET() {
    try {
        await requireAuth(['ADMIN', 'SUPER_ADMIN', 'OSP_MANAGER']);
        const auditReport = await runInRealtimeContext(async () => {
            return await AiAuditService.runSystemAudit();
        });
        return NextResponse.json({ success: true, data: auditReport });
    } catch (error) {
        return handleApiError(error);
    }
}

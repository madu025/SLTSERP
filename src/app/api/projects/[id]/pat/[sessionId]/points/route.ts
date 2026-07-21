import { apiHandler } from '@/lib/api-handler';
import { PATService } from '@/services/pat.service';
import { AppError } from '@/lib/error';

export const dynamic = 'force-dynamic';

export const POST = apiHandler(async (_request, params, body) => {
    const { sessionId } = params;
    
    const result = await PATService.recordPointResult(
        sessionId, 
        (body || {}) as unknown as Parameters<typeof PATService.recordPointResult>[1]
    );
    return Response.json(result, { status: 201 });
}, {
    audit: { action: 'RECORD_POINT', entity: 'PAT' },
    rawResponse: true
});

export const PATCH = apiHandler(async (_request, params, body) => {
    const { sessionId } = params;
    const { action, sltOfficers } = body || {};

    if (action === 'complete') {
        return await PATService.completeSession(
            sessionId, 
            sltOfficers as unknown as Parameters<typeof PATService.completeSession>[1]
        );
    }

    throw AppError.badRequest('Invalid action');
}, {
    audit: { action: 'COMPLETE_SESSION', entity: 'PAT' },
    rawResponse: true
});

import { apiHandler } from '@/lib/api-handler';
import { PATService } from '@/services/pat.service';
import { AppError } from '@/lib/error';

export const dynamic = 'force-dynamic';

export const GET = apiHandler(async (_request, params) => {
    const { id: projectId } = params;
    return await PATService.getProjectSessions(projectId);
}, { rawResponse: true });

export const POST = apiHandler(async (request, params, body) => {
    const { id: projectId } = params;
    const userId = request.headers.get('x-user-id');
    
    if (!userId) {
        throw AppError.unauthorized('Unauthorized');
    }

    const { patType } = body || {};

    if (!patType || !['PRE_PAT', 'SLT_PAT'].includes(patType)) {
        throw AppError.badRequest('Invalid patType. Must be PRE_PAT or SLT_PAT');
    }

    const session = await PATService.startSession(projectId, patType as 'PRE_PAT' | 'SLT_PAT', userId);
    return Response.json(session, { status: 201 });
}, {
    audit: { action: 'START_SESSION', entity: 'PAT' },
    rawResponse: true
});

import { apiHandler } from '@/lib/api-handler';
import { ProjectService } from '@/services/project.service';

export const dynamic = 'force-dynamic';

export const GET = apiHandler(async (_request, params) => {
    const { id: projectId } = await params;
    return await ProjectService.checkClosure(projectId);
}, { rawResponse: true });

export const POST = apiHandler(async (request, params, body) => {
    const { id: projectId } = await params;
    const userId = request.headers.get('x-user-id') || '';
    const { remarks, finalAsBuiltGenerated } = body || {};

    try {
        return await ProjectService.closeProject(projectId, userId, remarks, finalAsBuiltGenerated);
    } catch (error: unknown) {
        const err = error as { code?: string; message?: string; openIssues?: Record<string, unknown> };
        if (err.code === 'OPEN_ISSUES_REMAIN') {
            return Response.json({
                error: err.message,
                openIssues: err.openIssues
            }, { status: 400 });
        }
        throw error;
    }
}, {
    audit: { action: 'CLOSE', entity: 'PROJECT' },
    rawResponse: true // We handle a custom Response.json inside catch for specific 400 with payload
});
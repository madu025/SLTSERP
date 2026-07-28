import { apiHandler } from '@/lib/api-handler';
import { ProjectService } from '@/services/project.service';

export const dynamic = 'force-dynamic';

export const GET = apiHandler(async (_request, params) => {
    return await ProjectService.checkClosure(params.id);
}, { rawResponse: true });

export const POST = apiHandler(async (request, params, body) => {
    const userId = request.headers.get('x-user-id') || '';
    const remarks = body.remarks as string | undefined;
    const finalAsBuiltGenerated = body.finalAsBuiltGenerated as boolean | undefined;

    try {
        return await ProjectService.closeProject(params.id, userId, remarks, finalAsBuiltGenerated);
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
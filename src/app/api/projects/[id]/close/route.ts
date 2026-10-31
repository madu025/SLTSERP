import { apiHandler } from '@/lib/api-handler';
import { ProjectService } from '@/services/project/project.service';
import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';
import { assertProjectAccess } from '@/lib/project-access';
import { AppError } from '@/lib/error';

export const dynamic = 'force-dynamic';

export const GET = apiHandler(async (_request, params) => {
    await assertProjectAccess(params.id, params._userId);
    return await ProjectService.checkClosure(params.id, params._userId);
}, { permissions: [RBAC_PERMISSIONS.PROJECT_READ], rawResponse: true });

export const POST = apiHandler(async (_request, params, body) => {
    const userId = params._userId;
    if (!userId) throw AppError.unauthorized('Authentication required');
    await assertProjectAccess(params.id, userId);
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
    permissions: [RBAC_PERMISSIONS.PROJECT_APPROVE],
    audit: { action: 'CLOSE', entity: 'PROJECT' },
    rawResponse: true // We handle a custom Response.json inside catch for specific 400 with payload
});

import { apiHandler } from '@/lib/api-handler';
import { ProjectOTDRService } from '@/services/project/project-otdr.service';
import { AppError } from '@/lib/error';
import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';

export const dynamic = 'force-dynamic';

export const GET = apiHandler(async (_request, params) => {
    const { id: projectId } = params;
    return await ProjectOTDRService.getOTDRTests(projectId);
}, { rawResponse: true });

// PATCH /api/projects/{id}/otdr  { id, status: APPROVED | WAIVED | REJECTED, reviewNotes }
export const PATCH = apiHandler(async (_request, params, body) => {
    if (!params._userId) throw AppError.unauthorized('Authentication required');
    if (!body?.id) throw AppError.badRequest('id is required');
    return ProjectOTDRService.reviewOTDRTest(
        params.id, String(body.id), params._userId, String(body.status ?? ''),
        typeof body.reviewNotes === 'string' ? body.reviewNotes : null,
        params._permissions.includes(RBAC_PERMISSIONS.ADMIN_RBAC),
    );
}, {
    permissions: [RBAC_PERMISSIONS.PROJECT_APPROVE],
    audit: { action: 'REVIEW', entity: 'PROJECT_OTDR' },
    rawResponse: true,
});

export const POST = apiHandler(async (_request, params, body) => {
    const { id: projectId } = params;
    if (!params._userId) throw AppError.unauthorized('Authentication required');

    // The tester is the signed-in user. A client-supplied testedById let anyone record a trace as someone else,
    // and this record is acceptance evidence.
    const otdrTest = await ProjectOTDRService.createOTDRTest(
        projectId,
        { ...(body ?? {}), testedById: params._userId } as unknown as Parameters<typeof ProjectOTDRService.createOTDRTest>[1]
    );
    return Response.json(otdrTest, { status: 201 });
}, {
    audit: { action: 'CREATE', entity: 'PROJECT_OTDR' },
    rawResponse: true
});

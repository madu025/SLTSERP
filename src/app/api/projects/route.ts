import { apiHandler } from '@/lib/api-handler';
import { AppError } from '@/lib/error';
import { ProjectService } from '@/services/project/project.service';
import { resolveOpmcScope } from '@/lib/opmc-scope';
import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';
import { optionalText, optionalUuid, parsePaging, requireText, requireUuid } from '@/lib/input-guards';

export const dynamic = 'force-dynamic';

// GET all projects (rawResponse for compatibility)
export const GET = apiHandler(async (req, params) => {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const type = searchParams.get('type');
    const opmcId = searchParams.get('opmcId');
    const contractorId = searchParams.get('contractorId');
    const projectTypeId = searchParams.get('projectTypeId');
    const search = searchParams.get('search') || searchParams.get('q') || '';

    const { page, limit } = parsePaging(searchParams.get('page'), searchParams.get('limit'));
    for (const [label, value] of [['opmcId', opmcId], ['contractorId', contractorId], ['projectTypeId', projectTypeId]] as const) {
        if (value && value !== 'ALL') requireUuid(value, label);
    }
    if (search.length > 200) throw AppError.badRequest('search must be at most 200 characters');
    const isPaginated = searchParams.has('page') || searchParams.has('limit');

    const filters = { status, type, opmcId, contractorId, projectTypeId, search };
    const pagination = { page, limit, isPaginated };

    // Server-side OPMC scope — client opmcId is intersected with it inside
    // the service (admins unrestricted, empty scope denies all).
    const accessibleOpmcs = await resolveOpmcScope(params._userId);

    return await ProjectService.getProjects(filters, pagination, accessibleOpmcs);
}, {
    // Shared dropdown source for stores/finance/invoice/procurement pages —
    // any authenticated user may list; real protection is the server-side
    // resolveOpmcScope filtering applied above in ProjectService.
    permissions: [RBAC_PERMISSIONS.PROJECT_READ],
    rawResponse: true
});

// POST create new project
export const POST = apiHandler(async (req, params, body) => {
    if (!body.projectCode || !body.name || !body.projectTypeId) {
        throw AppError.badRequest('Project code and name are required');
    }
    const projectCode = requireText(body.projectCode, 'Project code', 64);
    const name = requireText(body.name, 'Project name', 200);
    const type = optionalText(body.type, 'type', 64);
    const contractorId = optionalUuid(body.contractorId, 'contractorId');
    if (!body.opmcId) throw AppError.badRequest('opmcId is required');
    const opmcId = requireUuid(body.opmcId, 'opmcId');
    const projectTypeId = requireUuid(body.projectTypeId, 'projectTypeId');
    const parentId = optionalUuid(body.parentId, 'parentId');
    const planningSource = optionalText(body.planningSource, 'planningSource', 16);

    return await ProjectService.createProject({
        projectCode,
        name,
        type: type ?? undefined,
        contractorId: contractorId ?? undefined,
        opmcId: opmcId ?? undefined,
        projectTypeId: projectTypeId ?? undefined,
        parentId: parentId ?? undefined,
        planningSource: planningSource ?? undefined,
        actorUserId: params._userId,
    });
}, {
    permissions: [RBAC_PERMISSIONS.PROJECT_WRITE],
    audit: { action: 'CREATE', entity: 'PROJECT' },
    rawResponse: true
});

// PATCH update project
export const PATCH = apiHandler(async (req, params, body) => {
    const id = body.id ? requireUuid(body.id, 'Project ID') : undefined;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { id: _id, ...updateData } = body;

    if (!id) {
        throw AppError.badRequest('Project ID required');
    }

    return await ProjectService.updateProject(id, updateData as Record<string, unknown>, params._userId);
}, {
    permissions: [RBAC_PERMISSIONS.PROJECT_WRITE],
    audit: { action: 'UPDATE', entity: 'PROJECT' },
    rawResponse: true
});

// DELETE project (removing the legacy bypass security hole)
export const DELETE = apiHandler(async (req) => {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) {
        throw AppError.badRequest('Project ID required');
    }

    await ProjectService.deleteProject(id);

    return { success: true };
}, {
    permissions: [RBAC_PERMISSIONS.ADMIN_RBAC],
    audit: { action: 'DELETE', entity: 'PROJECT' },
    rawResponse: true
});

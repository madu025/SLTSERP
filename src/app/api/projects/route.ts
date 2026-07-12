import { apiHandler } from '@/lib/api-handler';
import { ProjectService } from '@/services/project.service';

export const dynamic = 'force-dynamic';

// GET all projects (rawResponse for compatibility)
export const GET = apiHandler(async (req) => {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const type = searchParams.get('type');
    const opmcId = searchParams.get('opmcId');
    const contractorId = searchParams.get('contractorId');
    const projectTypeId = searchParams.get('projectTypeId');
    const search = searchParams.get('search') || searchParams.get('q') || '';

    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const isPaginated = searchParams.has('page') || searchParams.has('limit');

    const filters = { status, type, opmcId, contractorId, projectTypeId, search };
    const pagination = { page, limit, isPaginated };

    return await ProjectService.getProjects(filters, pagination);
}, {
    rawResponse: true
});

// POST create new project
export const POST = apiHandler(async (req, _params, body) => {
    const {
        projectCode,
        name,
        type,
        contractorId,
        opmcId,
        projectTypeId
    } = body;

    if (!projectCode || !name) {
        throw new Error('Project code and name are required');
    }

    return await ProjectService.createProject({
        projectCode,
        name,
        type,
        contractorId,
        opmcId,
        projectTypeId
    });
}, {
    roles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'OSP_MANAGER', 'AREA_MANAGER'],
    audit: { action: 'CREATE', entity: 'PROJECT' },
    rawResponse: true
});

// PATCH update project
export const PATCH = apiHandler(async (req, _params, body) => {
    const { id, ...updateData } = body;

    if (!id) {
        throw new Error('Project ID required');
    }

    return await ProjectService.updateProject(id, updateData);
}, {
    roles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'OSP_MANAGER', 'AREA_MANAGER'],
    audit: { action: 'UPDATE', entity: 'PROJECT' },
    rawResponse: true
});

// DELETE project (removing the legacy bypass security hole)
export const DELETE = apiHandler(async (req) => {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const userRole = req.headers.get('x-user-role') || 'ENGINEER';

    if (!id) {
        throw new Error('Project ID required');
    }

    // Pass the actual securely extracted userRole instead of a hardcoded 'ADMIN' override
    await ProjectService.deleteProject(id, userRole);

    return { success: true };
}, {
    roles: ['SUPER_ADMIN', 'ADMIN'],
    audit: { action: 'DELETE', entity: 'PROJECT' },
    rawResponse: true
});

import { apiHandler } from '@/lib/api-handler';
import { ProjectBOQService } from '@/services/project/project-boq.service';
import { AppError } from '@/lib/error';

export const dynamic = 'force-dynamic';

// GET list BOQ items for a project
export const GET = apiHandler(async (request) => {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');

    if (!projectId) {
        throw AppError.badRequest('projectId query parameter is required');
    }

    return await ProjectBOQService.getBOQItems(projectId);
}, { rawResponse: true });

// POST create BOQ item
export const POST = apiHandler(async (_request, _params, body) => {
    const {
        projectId,
        itemCode,
        description,
        unit,
        quantity,
        unitRate
    } = body || {};

    if (!projectId || !itemCode || !description || !unit || quantity === undefined || unitRate === undefined) {
        throw AppError.badRequest('Missing required fields');
    }

    return await ProjectBOQService.createBOQItem(body);
}, {
    audit: { action: 'CREATE', entity: 'PROJECT_BOQ' },
    rawResponse: true
});

// PATCH update BOQ item
export const PATCH = apiHandler(async (_request, _params, body) => {
    const { id, ...updateData } = body || {};

    if (!id) {
        throw AppError.badRequest('BOQ item ID required');
    }

    return await ProjectBOQService.updateBOQItem(id, updateData);
}, {
    audit: { action: 'UPDATE', entity: 'PROJECT_BOQ' },
    rawResponse: true
});

// DELETE BOQ item
export const DELETE = apiHandler(async (request) => {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
        throw AppError.badRequest('BOQ item ID required');
    }

    await ProjectBOQService.deleteBOQItem(id);
    return { success: true };
}, {
    audit: { action: 'DELETE', entity: 'PROJECT_BOQ' },
    rawResponse: true
});

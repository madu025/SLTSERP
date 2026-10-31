import { apiHandler } from '@/lib/api-handler';
import { ProjectBOQService } from '@/services/project/project-boq.service';
import { AppError } from '@/lib/error';
import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';
import { assertProjectAccess } from '@/lib/project-access';
import { assertRecordProjectAccess } from '@/lib/project-record-access';
import { z } from 'zod';

const numericInput = z.union([z.string(), z.number()]);
const createSchema = z.object({
    projectId: z.string().min(1), itemCode: z.string().min(1), description: z.string().min(1),
    unit: z.string().min(1), quantity: numericInput, unitRate: numericInput,
    category: z.string().nullish(), materialId: z.string().nullish(),
    taskId: z.string().nullish(), contractorId: z.string().nullish(), remarks: z.string().nullish(),
});
const updateSchema = z.object({
    quantity: numericInput.optional(), unitRate: numericInput.optional(),
    actualQuantity: numericInput.optional(), actualCost: numericInput.optional(),
    category: z.string().nullish(), materialId: z.string().nullish(), remarks: z.string().nullish(),
    description: z.string().optional(), unit: z.string().optional(),
    taskId: z.string().nullish(), contractorId: z.string().nullish(),
});

export const dynamic = 'force-dynamic';

// GET list BOQ items for a project
export const GET = apiHandler(async (request, params) => {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');

    if (!projectId) {
        throw AppError.badRequest('projectId query parameter is required');
    }

    await assertProjectAccess(projectId, params._userId);
    return await ProjectBOQService.getBOQItems(projectId);
}, { permissions: [RBAC_PERMISSIONS.PROJECT_READ], rawResponse: true });

// POST create BOQ item
export const POST = apiHandler(async (_request, params, body) => {
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

    await assertProjectAccess(projectId as string, params._userId);
    return await ProjectBOQService.createBOQItem(createSchema.parse(body));
}, {
    permissions: [RBAC_PERMISSIONS.PROJECT_WRITE],
    audit: { action: 'CREATE', entity: 'PROJECT_BOQ' },
    rawResponse: true
});

// PATCH update BOQ item
export const PATCH = apiHandler(async (_request, params, body) => {
    const id = body.id as string | undefined;

    if (!id) {
        throw AppError.badRequest('BOQ item ID required');
    }

    await assertRecordProjectAccess('boqItem', id, params._userId);

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { id: _id, projectId: _projectId, ...updateData } = body;

    return await ProjectBOQService.updateBOQItem(id, updateSchema.parse(updateData));
}, {
    permissions: [RBAC_PERMISSIONS.PROJECT_WRITE],
    audit: { action: 'UPDATE', entity: 'PROJECT_BOQ' },
    rawResponse: true
});

// DELETE BOQ item
export const DELETE = apiHandler(async (request, params) => {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
        throw AppError.badRequest('BOQ item ID required');
    }

    await assertRecordProjectAccess('boqItem', id, params._userId);
    await ProjectBOQService.deleteBOQItem(id);
    return { success: true };
}, {
    permissions: [RBAC_PERMISSIONS.PROJECT_WRITE],
    audit: { action: 'DELETE', entity: 'PROJECT_BOQ' },
    rawResponse: true
});

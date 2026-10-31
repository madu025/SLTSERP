import { apiHandler } from '@/lib/api-handler';
import { ProjectBOQService } from '@/services/project/project-boq.service';
import { AppError } from '@/lib/error';
import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export const GET = apiHandler(async (_request, params) => {
    const { id: projectId } = await params;

    return await ProjectBOQService.analyzeBOQ(projectId);
}, { permissions: [RBAC_PERMISSIONS.PROJECT_READ], rawResponse: true });

export const POST = apiHandler(async (_request, params, body) => {
    const { id: projectId } = await params;
    const updates = body; // Array of { boqItemId, source, materialId }

    if (!Array.isArray(updates)) {
        throw AppError.badRequest('Invalid payload, expected array');
    }
    const itemIds = updates.map((item) => item?.boqItemId);
    if (itemIds.some((id) => typeof id !== 'string' || !id)) {
        throw AppError.badRequest('Each BOQ source update requires a BOQ item ID');
    }
    const validItems = await prisma.projectBOQItem.count({ where: { id: { in: itemIds }, projectId } });
    if (validItems !== new Set(itemIds).size) {
        throw AppError.forbidden('BOQ item does not belong to this project');
    }

    await ProjectBOQService.updateBOQSources(updates);
    
    return { success: true, message: 'BOQ Sources updated successfully' };
}, {
    permissions: [RBAC_PERMISSIONS.PROJECT_WRITE],
    audit: { action: 'UPDATE_BOQ_SOURCES', entity: 'PROJECT_BOQ' },
    rawResponse: true
});

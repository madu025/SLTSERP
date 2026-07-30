import { apiHandler } from '@/lib/api-handler';
import { ProjectBOQService } from '@/services/project/project-boq.service';
import { AppError } from '@/lib/error';

export const dynamic = 'force-dynamic';

export const GET = apiHandler(async (_request, params) => {
    const { id: projectId } = await params;

    return await ProjectBOQService.analyzeBOQ(projectId);
}, { rawResponse: true });

export const POST = apiHandler(async (_request, params, body) => {
    const { id: projectId } = await params;
    const updates = body; // Array of { boqItemId, source, materialId }

    if (!Array.isArray(updates)) {
        throw AppError.badRequest('Invalid payload, expected array');
    }

    await ProjectBOQService.updateBOQSources(updates);
    
    return { success: true, message: 'BOQ Sources updated successfully' };
}, {
    audit: { action: 'UPDATE_BOQ_SOURCES', entity: 'PROJECT_BOQ' },
    rawResponse: true
});

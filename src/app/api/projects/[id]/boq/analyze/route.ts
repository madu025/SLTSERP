import { apiHandler } from '@/lib/api-handler';
import { ProjectBOQService } from '@/services/project/project-boq.service';
import { AppError } from '@/lib/error';

export const dynamic = 'force-dynamic';

export const GET = apiHandler(async (_request, params) => {
    const { id: projectId } = await params;

    try {
        return await ProjectBOQService.analyzeBOQ(projectId);
    } catch (error: unknown) {
        const err = error as { message?: string };
        if (err.message === 'PROJECT_NOT_FOUND') {
            throw AppError.notFound('Project not found');
        }
        if (err.message === 'NO_STORE_FOUND') {
            throw AppError.badRequest('No inventory store found to analyze against.');
        }
        throw error;
    }
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

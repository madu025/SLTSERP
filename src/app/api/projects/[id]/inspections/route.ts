import { apiHandler } from '@/lib/api-handler';
import { ProjectInspectionService } from '@/services/project/project-inspection.service';
import { AppError } from '@/lib/error';

export const dynamic = 'force-dynamic';

export const GET = apiHandler(async (_request, params) => {
    const { id: projectId } = params;
    return await ProjectInspectionService.getInspections(projectId);
}, { rawResponse: true });

export const POST = apiHandler(async (_request, params, body) => {
    const { id: projectId } = params;
    const { title, category, checklist, inspectorId } = body || {};

    if (!title || !category || !checklist || !inspectorId) {
        throw AppError.badRequest('Missing required parameters');
    }

    const newInspection = await ProjectInspectionService.createInspection(
        projectId, 
        body as unknown as Parameters<typeof ProjectInspectionService.createInspection>[1]
    );
    return Response.json(newInspection, { status: 201 });
}, {
    audit: { action: 'CREATE', entity: 'PROJECT_INSPECTION' },
    rawResponse: true
});

export const PATCH = apiHandler(async (_request, _params, body) => {
    const { inspectionId, status, checklist, correctiveAction, photoUrls } = body || {};

    if (!inspectionId) {
        throw AppError.badRequest('Inspection ID is required');
    }

    return await ProjectInspectionService.updateInspection(
        inspectionId as string, 
        body as unknown as Parameters<typeof ProjectInspectionService.updateInspection>[1]
    );
}, {
    audit: { action: 'UPDATE', entity: 'PROJECT_INSPECTION' },
    rawResponse: true
});

import { apiHandler } from '@/lib/api-handler';
import { ProjectInspectionService } from '@/services/project/project-inspection.service';
import { assertRecordInProject } from '@/lib/project-record-access';
import { AppError } from '@/lib/error';
import { z } from 'zod';

const checklistItemSchema = z.object({
    item: z.string().trim().min(1).max(500),
    checked: z.boolean(),
}).strict();
const createInspectionSchema = z.object({
    title: z.string().trim().min(1).max(300),
    category: z.string().trim().min(1).max(100),
    checklist: z.array(checklistItemSchema).min(1).max(500),
}).strict();
const updateInspectionSchema = z.object({
    inspectionId: z.string().min(1),
    status: z.string().trim().max(32).optional(),
    checklist: z.array(checklistItemSchema).max(500).optional(),
    correctiveAction: z.string().max(5000).optional(),
    photoUrls: z.array(z.string().url().max(2048)).max(100).optional(),
}).strict();

export const dynamic = 'force-dynamic';

export const GET = apiHandler(async (_request, params) => {
    const { id: projectId } = params;
    return await ProjectInspectionService.getInspections(projectId);
}, { rawResponse: true });

export const POST = apiHandler(async (_request, params, body) => {
    const { id: projectId } = params;
    const userId = params._userId;
    if (!userId) throw AppError.unauthorized('Authentication required');

    const newInspection = await ProjectInspectionService.createInspection(
        projectId, 
        { ...body, inspectorId: userId },
        userId,
    );
    return Response.json(newInspection, { status: 201 });
}, {
    schema: createInspectionSchema,
    audit: { action: 'CREATE', entity: 'PROJECT_INSPECTION' },
    rawResponse: true
});

export const PATCH = apiHandler(async (_request, params, body) => {
    const { inspectionId, status, checklist, correctiveAction, photoUrls } = body;

    if (!inspectionId) {
        throw AppError.badRequest('Inspection ID is required');
    }

    await assertRecordInProject('inspection', inspectionId as string, params.id);
    return await ProjectInspectionService.updateInspection(
        inspectionId as string, 
        { status, checklist, correctiveAction, photoUrls }
    );
}, {
    schema: updateInspectionSchema,
    audit: { action: 'UPDATE', entity: 'PROJECT_INSPECTION' },
    rawResponse: true
});

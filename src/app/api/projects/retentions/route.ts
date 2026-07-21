import { apiHandler } from '@/lib/api-handler';
import { ProjectRetentionService } from '@/services/project/project-retention.service';
import { AppError } from '@/lib/error';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

export const GET = apiHandler(async (request) => {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');
    if (!projectId) throw AppError.badRequest('projectId is required');

    return await ProjectRetentionService.getRetentions(projectId);
}, { rawResponse: true });

const createRetentionSchema = z.object({
    projectId: z.string().min(1),
    invoiceId: z.string().optional().nullable(),
    title: z.string().min(1),
    description: z.string().optional().nullable(),
    retentionPercent: z.number().optional(),
    retentionAmount: z.number().min(0),
    releaseCondition: z.string().optional().nullable(),
    defectLiabilityPeriod: z.number().optional().nullable(),
});

export const POST = apiHandler(async (_request, _params, body) => {
    const data = createRetentionSchema.parse(body);
    const retention = await ProjectRetentionService.createRetention(data);
    return Response.json(retention, { status: 201 });
}, {
    audit: { action: 'CREATE', entity: 'RETENTION' },
    rawResponse: true
});

const patchRetentionSchema = z.object({
    id: z.string().min(1),
    action: z.enum(['RELEASE', 'UPDATE']),
    releaseAmount: z.number().optional(),
    releaseDate: z.string().optional().nullable(),
    approvedById: z.string().optional().nullable(),
    remarks: z.string().optional().nullable(),
    retentionPercent: z.number().optional(),
    retentionAmount: z.number().optional(),
    status: z.string().optional(),
    releaseCondition: z.string().optional().nullable(),
    defectLiabilityPeriod: z.number().optional().nullable(),
});

export const PATCH = apiHandler(async (_request, _params, body) => {
    const data = patchRetentionSchema.parse(body);
    const { id, action, releaseAmount, releaseDate, approvedById, remarks } = data;

    try {
        if (action === 'RELEASE') {
            if (releaseAmount === undefined) throw AppError.badRequest('releaseAmount is required');
            return await ProjectRetentionService.releaseRetention(id, releaseAmount, releaseDate || undefined, approvedById, remarks);
        }

        if (action === 'UPDATE') {
            return await ProjectRetentionService.updateRetention(id, {
                retentionPercent: data.retentionPercent,
                retentionAmount: data.retentionAmount,
                status: data.status,
                releaseCondition: data.releaseCondition,
                defectLiabilityPeriod: data.defectLiabilityPeriod,
            });
        }
    } catch (error: unknown) {
        if (error instanceof Error) {
            if (error.message === 'RETENTION_NOT_FOUND') throw AppError.notFound('Retention not found');
            if (error.message === 'RELEASE_AMOUNT_EXCEEDS_BALANCE') throw AppError.badRequest('Release amount cannot exceed balance');
        }
        throw error;
    }
}, {
    audit: { action: 'UPDATE', entity: 'RETENTION' },
    rawResponse: true
});

export const DELETE = apiHandler(async (request) => {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) throw AppError.badRequest('id is required');

    try {
        await ProjectRetentionService.deleteRetention(id);
        return { success: true };
    } catch (error: unknown) {
        if (error instanceof Error) {
            if (error.message === 'RETENTION_NOT_FOUND') throw AppError.notFound('Retention not found');
            if (error.message === 'HAS_RELEASES') throw AppError.badRequest('Cannot delete retention with releases');
        }
        throw error;
    }
}, {
    audit: { action: 'DELETE', entity: 'RETENTION' },
    rawResponse: true
});

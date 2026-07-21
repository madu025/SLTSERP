import { apiHandler } from '@/lib/api-handler';
import { ProjectLDPenaltyService } from '@/services/project/project-ld-penalty.service';
import { AppError } from '@/lib/error';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

export const GET = apiHandler(async (request) => {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');
    if (!projectId) throw AppError.badRequest('projectId is required');

    return await ProjectLDPenaltyService.getPenalties(projectId);
}, { rawResponse: true });

const createPenaltySchema = z.object({
    projectId: z.string().min(1),
    title: z.string().min(1),
    description: z.string().optional(),
    type: z.string().optional(),
    category: z.string().optional(),
    amount: z.number().min(0),
    percentage: z.number().optional(),
    referenceTable: z.string().optional(),
    referenceId: z.string().optional(),
    referenceDesc: z.string().optional(),
    appliedDate: z.string().optional(),
    leviedById: z.string().optional(),
    remarks: z.string().optional(),
});

export const POST = apiHandler(async (_request, _params, body) => {
    const data = createPenaltySchema.parse(body);
    const penalty = await ProjectLDPenaltyService.createPenalty(data);
    return Response.json(penalty, { status: 201 });
}, {
    audit: { action: 'CREATE', entity: 'LD_PENALTY' },
    rawResponse: true
});

const updatePenaltySchema = z.object({
    id: z.string().min(1),
    status: z.string().min(1),
    approvedById: z.string().optional(),
    waivedAmount: z.number().optional(),
    remarks: z.string().optional(),
});

export const PATCH = apiHandler(async (_request, _params, body) => {
    const data = updatePenaltySchema.parse(body);
    const { id, status, ...options } = data;
    
    try {
        return await ProjectLDPenaltyService.updatePenalty(id, status, options);
    } catch (error: unknown) {
        if (error instanceof Error && error.message === 'LD_PENALTY_NOT_FOUND') {
            throw AppError.notFound('LD/penalty not found');
        }
        throw error;
    }
}, {
    audit: { action: 'UPDATE', entity: 'LD_PENALTY' },
    rawResponse: true
});

export const DELETE = apiHandler(async (request) => {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) throw AppError.badRequest('id is required');

    try {
        await ProjectLDPenaltyService.deletePenalty(id);
        return { success: true };
    } catch (error: unknown) {
        if (error instanceof Error) {
            if (error.message === 'LD_PENALTY_NOT_FOUND') throw AppError.notFound('LD/penalty not found');
            if (error.message === 'PROPOSED_ONLY_DELETION') throw AppError.badRequest('Only PROPOSED LD/penalties can be deleted');
        }
        throw error;
    }
}, {
    audit: { action: 'DELETE', entity: 'LD_PENALTY' },
    rawResponse: true
});

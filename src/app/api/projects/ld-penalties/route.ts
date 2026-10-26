import { apiHandler } from '@/lib/api-handler';
import { ProjectLDPenaltyService } from '@/services/project/project-ld-penalty.service';
import { AppError } from '@/lib/error';
import { ROLE_GROUPS } from '@/config/roles';
import { z } from 'zod';

export const dynamic = 'force-dynamic';
const PROJECT_FINANCE_READERS = [...new Set([...ROLE_GROUPS.PROJECT_MANAGERS, ...ROLE_GROUPS.FINANCE])];

const createPenaltySchema = z.object({
    projectId: z.string().uuid(),
    title: z.string().trim().min(1),
    description: z.string().optional().nullable(),
    type: z.string().trim().min(1).optional(),
    category: z.string().trim().min(1).optional(),
    amount: z.number().finite().positive(),
    percentage: z.number().finite().min(0).max(100).optional().nullable(),
    referenceTable: z.string().optional().nullable(),
    referenceId: z.string().uuid().optional().nullable(),
    referenceDesc: z.string().optional().nullable(),
    appliedDate: z.string().optional(),
    remarks: z.string().optional().nullable(),
});

const updatePenaltySchema = z.object({
    id: z.string().uuid(),
    status: z.enum(['APPROVED', 'WAIVED', 'REJECTED']),
    waivedAmount: z.number().finite().min(0).optional(),
    remarks: z.string().optional().nullable(),
});

function requireFinanceApprover(userId: string | null, role: string | null) {
    if (!userId || !role || !ROLE_GROUPS.FINANCE_APPROVERS.includes(role)) {
        throw AppError.forbidden('A finance approver is required for this LD/penalty action');
    }
}

export const GET = apiHandler(async (request) => {
    const projectId = new URL(request.url).searchParams.get('projectId');
    if (!projectId) throw AppError.badRequest('projectId is required');
    return ProjectLDPenaltyService.getPenalties(projectId);
}, { roles: PROJECT_FINANCE_READERS, rawResponse: true });

export const POST = apiHandler(async (_request, params, body: z.infer<typeof createPenaltySchema>) => {
    if (!params._userId) throw AppError.unauthorized('Authentication required');
    const penalty = await ProjectLDPenaltyService.createPenalty({ ...body, leviedById: params._userId });
    return Response.json(penalty, { status: 201 });
}, {
    schema: createPenaltySchema,
    roles: ROLE_GROUPS.FINANCE,
    audit: { action: 'CREATE', entity: 'LD_PENALTY' },
    rawResponse: true,
});

export const PATCH = apiHandler(async (_request, params, body: z.infer<typeof updatePenaltySchema>) => {
    requireFinanceApprover(params._userId, params._userRole);
    const { id, status, ...options } = body;
    try {
        return await ProjectLDPenaltyService.updatePenalty(id, status, {
            ...options,
            approvedById: params._userId,
        });
    } catch (error: unknown) {
        if (error instanceof Error && error.message === 'LD_PENALTY_NOT_FOUND') {
            throw AppError.notFound('LD/penalty not found');
        }
        throw error;
    }
}, {
    schema: updatePenaltySchema,
    roles: ROLE_GROUPS.FINANCE_APPROVERS,
    audit: { action: 'UPDATE', entity: 'LD_PENALTY' },
    rawResponse: true,
});

export const DELETE = apiHandler(async (request) => {
    const id = new URL(request.url).searchParams.get('id');
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
    roles: ROLE_GROUPS.FINANCE_APPROVERS,
    audit: { action: 'DELETE', entity: 'LD_PENALTY' },
    rawResponse: true,
});

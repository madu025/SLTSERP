import { apiHandler } from '@/lib/api-handler';
import { ProjectLDPenaltyService } from '@/services/project/project-ld-penalty.service';
import { AppError } from '@/lib/error';
import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';
import { userHasPermission } from '@/lib/user-permissions';
import { assertProjectAccess } from '@/lib/project-access';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

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

async function requireFinanceApprover(userId: string | null) {
    const allowed = await userHasPermission(userId, RBAC_PERMISSIONS.PROJECT_FINANCE_APPROVE)
        || await userHasPermission(userId, RBAC_PERMISSIONS.FINANCE_APPROVE);
    if (!allowed) throw AppError.forbidden('A finance approver is required for this LD/penalty action');
}

export const GET = apiHandler(async (request, params) => {
    const projectId = new URL(request.url).searchParams.get('projectId');
    if (!projectId) throw AppError.badRequest('projectId is required');
    await assertProjectAccess(projectId, params._userId);
    return ProjectLDPenaltyService.getPenalties(projectId);
}, { permissions: [RBAC_PERMISSIONS.PROJECT_FINANCE_READ], rawResponse: true });

export const POST = apiHandler(async (_request, params, body: z.infer<typeof createPenaltySchema>) => {
    if (!params._userId) throw AppError.unauthorized('Authentication required');
    await assertProjectAccess(body.projectId, params._userId);
    const penalty = await ProjectLDPenaltyService.createPenalty({ ...body, leviedById: params._userId });
    return Response.json(penalty, { status: 201 });
}, {
    schema: createPenaltySchema,
    permissions: [RBAC_PERMISSIONS.PROJECT_FINANCE_WRITE],
    audit: { action: 'CREATE', entity: 'LD_PENALTY' },
    rawResponse: true,
});

export const PATCH = apiHandler(async (_request, params, body: z.infer<typeof updatePenaltySchema>) => {
    await requireFinanceApprover(params._userId);
    const penalty = await prisma.projectLDPenalty.findUnique({ where: { id: body.id }, select: { projectId: true } });
    if (!penalty) throw AppError.notFound('LD/penalty not found');
    await assertProjectAccess(penalty.projectId, params._userId);
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
    permissions: [RBAC_PERMISSIONS.PROJECT_FINANCE_APPROVE],
    audit: { action: 'UPDATE', entity: 'LD_PENALTY' },
    rawResponse: true,
});

export const DELETE = apiHandler(async (request, params) => {
    const id = new URL(request.url).searchParams.get('id');
    if (!id) throw AppError.badRequest('id is required');
    const penalty = await prisma.projectLDPenalty.findUnique({ where: { id }, select: { projectId: true } });
    if (!penalty) throw AppError.notFound('LD/penalty not found');
    await assertProjectAccess(penalty.projectId, params._userId);
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
    permissions: [RBAC_PERMISSIONS.PROJECT_FINANCE_APPROVE],
    audit: { action: 'DELETE', entity: 'LD_PENALTY' },
    rawResponse: true,
});

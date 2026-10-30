import { apiHandler } from '@/lib/api-handler';
import { ProjectRetentionService } from '@/services/project/project-retention.service';
import { AppError } from '@/lib/error';
import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';
import { userHasPermission } from '@/lib/user-permissions';
import { assertProjectAccess } from '@/lib/project-access';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const createRetentionSchema = z.object({
    projectId: z.string().uuid(),
    invoiceId: z.string().uuid().optional().nullable(),
    title: z.string().trim().min(1),
    description: z.string().optional().nullable(),
    retentionPercent: z.number().finite().positive().max(100).optional(),
    retentionAmount: z.number().finite().positive(),
    releaseCondition: z.string().optional().nullable(),
    defectLiabilityPeriod: z.number().int().nonnegative().optional().nullable(),
});

const patchRetentionSchema = z.object({
    id: z.string().uuid(),
    action: z.enum(['RELEASE', 'UPDATE']),
    releaseAmount: z.number().finite().positive().optional(),
    releaseDate: z.string().optional().nullable(),
    remarks: z.string().optional().nullable(),
    retentionPercent: z.number().finite().positive().max(100).optional(),
    retentionAmount: z.number().finite().positive().optional(),
    releaseCondition: z.string().optional().nullable(),
    defectLiabilityPeriod: z.number().int().nonnegative().optional().nullable(),
}).superRefine((data, ctx) => {
    if (data.action === 'RELEASE' && data.releaseAmount === undefined) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['releaseAmount'], message: 'releaseAmount is required' });
    }
    if (data.action === 'UPDATE' && data.retentionPercent === undefined && data.retentionAmount === undefined
        && data.releaseCondition === undefined && data.defectLiabilityPeriod === undefined) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'At least one retention update is required' });
    }
});

async function requireFinanceApprover(userId: string | null) {
    const allowed = await userHasPermission(userId, RBAC_PERMISSIONS.PROJECT_FINANCE_APPROVE)
        || await userHasPermission(userId, RBAC_PERMISSIONS.FINANCE_APPROVE);
    if (!allowed) throw AppError.forbidden('A finance approver is required for this retention action');
}

export const GET = apiHandler(async (request, params) => {
    const projectId = new URL(request.url).searchParams.get('projectId');
    if (!projectId) throw AppError.badRequest('projectId is required');
    await assertProjectAccess(projectId, params._userId);
    return ProjectRetentionService.getRetentions(projectId);
}, { permissions: [RBAC_PERMISSIONS.PROJECT_FINANCE_READ], rawResponse: true });

export const POST = apiHandler(async (_request, params, body: z.infer<typeof createRetentionSchema>) => {
    await assertProjectAccess(body.projectId, params._userId);
    const retention = await ProjectRetentionService.createRetention(body);
    return Response.json(retention, { status: 201 });
}, {
    schema: createRetentionSchema,
    permissions: [RBAC_PERMISSIONS.PROJECT_FINANCE_WRITE],
    audit: { action: 'CREATE', entity: 'RETENTION' },
    rawResponse: true,
});

export const PATCH = apiHandler(async (_request, params, body: z.infer<typeof patchRetentionSchema>) => {
    await requireFinanceApprover(params._userId);
    const retention = await prisma.projectRetention.findUnique({ where: { id: body.id }, select: { projectId: true } });
    if (!retention) throw AppError.notFound('Retention not found');
    await assertProjectAccess(retention.projectId, params._userId);
    try {
        if (body.action === 'RELEASE') {
            return await ProjectRetentionService.releaseRetention(
                body.id, body.releaseAmount!, body.releaseDate || undefined, params._userId, body.remarks,
            );
        }
        return await ProjectRetentionService.updateRetention(body.id, {
            retentionPercent: body.retentionPercent,
            retentionAmount: body.retentionAmount,
            releaseCondition: body.releaseCondition,
            defectLiabilityPeriod: body.defectLiabilityPeriod,
        });
    } catch (error: unknown) {
        if (error instanceof Error) {
            if (error.message === 'RETENTION_NOT_FOUND') throw AppError.notFound('Retention not found');
            if (error.message === 'RELEASE_AMOUNT_EXCEEDS_BALANCE') throw AppError.badRequest('Release amount cannot exceed balance');
        }
        throw error;
    }
}, {
    schema: patchRetentionSchema,
    permissions: [RBAC_PERMISSIONS.PROJECT_FINANCE_APPROVE],
    audit: { action: 'UPDATE', entity: 'RETENTION' },
    rawResponse: true,
});

export const DELETE = apiHandler(async (request, params) => {
    const id = new URL(request.url).searchParams.get('id');
    if (!id) throw AppError.badRequest('id is required');
    const retention = await prisma.projectRetention.findUnique({ where: { id }, select: { projectId: true } });
    if (!retention) throw AppError.notFound('Retention not found');
    await assertProjectAccess(retention.projectId, params._userId);
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
    permissions: [RBAC_PERMISSIONS.PROJECT_FINANCE_APPROVE],
    audit: { action: 'DELETE', entity: 'RETENTION' },
    rawResponse: true,
});

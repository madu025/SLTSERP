import { apiHandler } from '@/lib/api-handler';
import { ProjectRetentionService } from '@/services/project/project-retention.service';
import { AppError } from '@/lib/error';
import { ROLE_GROUPS } from '@/config/roles';
import { z } from 'zod';

export const dynamic = 'force-dynamic';
const PROJECT_FINANCE_READERS = [...new Set([...ROLE_GROUPS.PROJECT_MANAGERS, ...ROLE_GROUPS.FINANCE])];

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

function requireFinanceApprover(userId: string | null, role: string | null) {
    if (!userId || !role || !ROLE_GROUPS.FINANCE_APPROVERS.includes(role)) {
        throw AppError.forbidden('A finance approver is required for this retention action');
    }
}

export const GET = apiHandler(async (request) => {
    const projectId = new URL(request.url).searchParams.get('projectId');
    if (!projectId) throw AppError.badRequest('projectId is required');
    return ProjectRetentionService.getRetentions(projectId);
}, { roles: PROJECT_FINANCE_READERS, rawResponse: true });

export const POST = apiHandler(async (_request, _params, body: z.infer<typeof createRetentionSchema>) => {
    const retention = await ProjectRetentionService.createRetention(body);
    return Response.json(retention, { status: 201 });
}, {
    schema: createRetentionSchema,
    roles: ROLE_GROUPS.FINANCE,
    audit: { action: 'CREATE', entity: 'RETENTION' },
    rawResponse: true,
});

export const PATCH = apiHandler(async (_request, params, body: z.infer<typeof patchRetentionSchema>) => {
    requireFinanceApprover(params._userId, params._userRole);
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
    roles: ROLE_GROUPS.FINANCE_APPROVERS,
    audit: { action: 'UPDATE', entity: 'RETENTION' },
    rawResponse: true,
});

export const DELETE = apiHandler(async (request) => {
    const id = new URL(request.url).searchParams.get('id');
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
    roles: ROLE_GROUPS.FINANCE_APPROVERS,
    audit: { action: 'DELETE', entity: 'RETENTION' },
    rawResponse: true,
});

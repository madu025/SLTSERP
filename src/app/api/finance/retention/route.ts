import { AppError } from '@/lib/error';
import { apiHandler } from "@/lib/api-handler";
import { RetentionService } from "@/services/finance/retention.service";
import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';
import { prisma } from '@/lib/prisma';
import { assertProjectAccess } from '@/lib/project-access';
import { getAccessibleProjectIds } from '@/lib/project-record-access';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const releaseRetentionSchema = z.object({
    retentionId: z.string().trim().min(1).max(100),
    releaseAmount: z.coerce.number().finite().positive(),
    remarks: z.string().trim().max(1000).optional().nullable(),
}).strict();

// GET /api/finance/retention - List all project retentions (rawResponse for compatibility)
export const GET = apiHandler(async (req, params) => {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status") || undefined;
    const projectId = searchParams.get("projectId") || undefined;

    if (projectId) {
        await assertProjectAccess(projectId, params._userId);
        return await RetentionService.getRetentions({ status, projectId });
    }

    const accessible = await getAccessibleProjectIds(params._userId);
    const rows = await RetentionService.getRetentions({ status });
    return accessible === undefined ? rows : rows.filter((r) => accessible.has(r.projectId));
}, {
    rawResponse: true
});

// POST /api/finance/retention - Release an amount from a project's retention balance
export const POST = apiHandler(async (_req, params, body) => {
    const { retentionId, releaseAmount, remarks } = body;
    const userId = params._userId;
    if (!userId) throw AppError.unauthorized('Authentication required');

    const retention = await prisma.projectRetention.findUnique({ where: { id: retentionId }, select: { projectId: true } });
    if (!retention) throw AppError.notFound('Retention not found');
    await assertProjectAccess(retention.projectId, userId);

    return await RetentionService.releaseRetention({
        retentionId,
        releaseAmount,
        approvedById: userId,
        remarks: remarks ?? undefined
    });
}, {
    schema: releaseRetentionSchema,
    permissions: [RBAC_PERMISSIONS.PROJECT_FINANCE_APPROVE, RBAC_PERMISSIONS.FINANCE_APPROVE],
    audit: { action: 'RELEASE', entity: 'PROJECT_RETENTION' },
    rawResponse: true
});

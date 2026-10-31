import { ROLE_GROUPS } from '@/config/roles';
import { AppError } from '@/lib/error';
import { apiHandler } from "@/lib/api-handler";
import { RetentionService } from "@/services/finance/retention.service";
import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';
import { prisma } from '@/lib/prisma';
import { assertProjectAccess } from '@/lib/project-access';
import { getAccessibleProjectIds } from '@/lib/project-record-access';

export const dynamic = 'force-dynamic';

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
    roles: ROLE_GROUPS.FINANCE,
    rawResponse: true
});

// POST /api/finance/retention - Release an amount from a project's retention balance
export const POST = apiHandler(async (_req, params, body) => {
    const retentionId = body.retentionId as string | undefined;
    const releaseAmount = body.releaseAmount as string | number | undefined;
    const remarks = body.remarks as string | undefined;
    const userId = params._userId ?? undefined;

    if (!retentionId || releaseAmount === undefined) {
        throw AppError.badRequest('retentionId and releaseAmount are required fields');
    }

    const retention = await prisma.projectRetention.findUnique({ where: { id: retentionId }, select: { projectId: true } });
    if (!retention) throw AppError.notFound('Retention not found');
    await assertProjectAccess(retention.projectId, params._userId);

    return await RetentionService.releaseRetention({
        retentionId,
        releaseAmount: Number(releaseAmount),
        approvedById: userId,
        remarks
    });
}, {
    permissions: [RBAC_PERMISSIONS.PROJECT_FINANCE_APPROVE, RBAC_PERMISSIONS.FINANCE_APPROVE],
    audit: { action: 'RELEASE', entity: 'PROJECT_RETENTION' },
    rawResponse: true
});

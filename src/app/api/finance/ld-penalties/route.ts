import { ROLE_GROUPS } from '@/config/roles';
import { AppError } from '@/lib/error';
import { apiHandler } from "@/lib/api-handler";
import { LDPenaltyService } from "@/services/finance/ld-penalty.service";
import { z } from 'zod';
import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';
import { prisma } from '@/lib/prisma';
import { assertProjectAccess } from '@/lib/project-access';
import { getAccessibleProjectIds } from '@/lib/project-record-access';

// Same capabilities as the project-scoped counterpart (/api/projects/ld-penalties), plus the tenant-wide finance grants.
const LD_WRITE_PERMISSIONS = [RBAC_PERMISSIONS.PROJECT_FINANCE_WRITE, RBAC_PERMISSIONS.FINANCE_WRITE];
const LD_APPROVE_PERMISSIONS = [RBAC_PERMISSIONS.PROJECT_FINANCE_APPROVE, RBAC_PERMISSIONS.FINANCE_APPROVE];

async function assertPenaltyAccess(id: string, userId: string | null) {
    const penalty = await prisma.projectLDPenalty.findUnique({ where: { id }, select: { projectId: true } });
    if (!penalty) throw AppError.notFound('LD/penalty not found');
    await assertProjectAccess(penalty.projectId, userId);
}


export const dynamic = 'force-dynamic';

// GET /api/finance/ld-penalties - List all penalties
export const GET = apiHandler(async (req, params) => {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status") || undefined;
    const projectId = searchParams.get("projectId") || undefined;

    if (projectId) {
        await assertProjectAccess(projectId, params._userId);
        return await LDPenaltyService.getPenalties({ status, projectId });
    }

    const accessible = await getAccessibleProjectIds(params._userId);
    const rows = await LDPenaltyService.getPenalties({ status });
    return accessible === undefined ? rows : rows.filter((r) => accessible.has(r.projectId));
}, {
    roles: ROLE_GROUPS.FINANCE_APPROVERS,
    rawResponse: true
});

const proposePenaltySchema = z.object({
    projectId: z.string(),
    title: z.string(),
    description: z.string().nullish(),
    type: z.string().optional(),
    category: z.string().optional(),
    amount: z.number(),
    percentage: z.number().nullish(),
    referenceTable: z.string().nullish(),
    referenceId: z.string().nullish(),
    referenceDesc: z.string().nullish(),
    remarks: z.string().nullish(),
    leviedById: z.string().nullish(),
});

const updatePenaltyStatusSchema = z.object({
    id: z.string(),
    status: z.enum(['APPROVED', 'WAIVED', 'COLLECTED']),
    waivedAmount: z.number().optional(),
    remarks: z.string().optional(),
});

// POST /api/finance/ld-penalties - Propose a new LD / Penalty
export const POST = apiHandler(async (_req, params, body) => {
    if (!params._userId) throw AppError.unauthorized('Authentication required');
    await assertProjectAccess(body.projectId, params._userId);
    // Levying user is always the authenticated user, never a client-supplied id.
    return await LDPenaltyService.proposePenalty({ ...body, leviedById: params._userId });
}, {
    schema: proposePenaltySchema,
    permissions: LD_WRITE_PERMISSIONS,
    audit: { action: 'PROPOSE', entity: 'LD_PENALTY' },
    rawResponse: true
});

// PATCH /api/finance/ld-penalties - Approve or Waive a penalty
export const PATCH = apiHandler(async (_req, params, body) => {
    const { id, status, waivedAmount, remarks } = body;
    const userId = params._userId;

    if (!userId) throw AppError.unauthorized('Authentication required');
    await assertPenaltyAccess(id, userId);

    return await LDPenaltyService.updatePenaltyStatus(id, status, userId, {
        waivedAmount,
        remarks: remarks ?? undefined,
    });
}, {
    schema: updatePenaltyStatusSchema,
    permissions: LD_APPROVE_PERMISSIONS,
    audit: { action: 'UPDATE_STATUS', entity: 'LD_PENALTY' },
    rawResponse: true
});


// DELETE /api/finance/ld-penalties - Delete a proposed penalty
export const DELETE = apiHandler(async (req, params) => {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
        throw AppError.badRequest('id is required');
    }

    await assertPenaltyAccess(id, params._userId);
    return await LDPenaltyService.deletePenalty(id);
}, {
    permissions: LD_APPROVE_PERMISSIONS,
    audit: { action: 'DELETE', entity: 'LD_PENALTY' },
    rawResponse: true
});

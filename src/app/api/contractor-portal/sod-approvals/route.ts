import { z } from 'zod';
import { apiHandler } from '@/lib/api-handler';
import { AppError } from '@/lib/error';
import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';
import { databaseUuidSchema } from '@/lib/validations/uuid.schema';
import { SodApprovalService } from '@/services/service-order/sod-approval.service';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({
    action: z.enum(['APPROVE', 'RETURN']),
    sodIds: z.array(databaseUuidSchema).min(1).max(200),
    note: z.string().max(500).optional(),
});

// GET /api/contractor-portal/sod-approvals - the contractor's own completed orders waiting for its confirmation
export const GET = apiHandler(async (_req, params) => {
    return SodApprovalService.queue(params._userId ?? '');
}, { permissions: [RBAC_PERMISSIONS.CONTRACTOR_WRITE] });

// POST /api/contractor-portal/sod-approvals - confirm completed orders, or dispute them with a reason (they go back to the start of the chain)
export const POST = apiHandler(async (_req, params, body: z.infer<typeof bodySchema>) => {
    const userId = params._userId;
    if (!userId) throw AppError.unauthorized('Authentication required');
    if (body.action === 'RETURN') return SodApprovalService.returnOrders(userId, body.sodIds, body.note ?? '');
    return SodApprovalService.approve(userId, body.sodIds, body.note);
}, { schema: bodySchema, permissions: [RBAC_PERMISSIONS.CONTRACTOR_WRITE], audit: { action: 'SOD_CONTRACTOR_CONFIRMATION', entity: 'ServiceOrder' } });

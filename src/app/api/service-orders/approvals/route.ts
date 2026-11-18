import { z } from 'zod';
import { apiHandler } from '@/lib/api-handler';
import { AppError } from '@/lib/error';
import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';
import { databaseUuidSchema } from '@/lib/validations/uuid.schema';
import { SodApprovalService } from '@/services/service-order/sod-approval.service';

export const dynamic = 'force-dynamic';

// The four stage capabilities of the area approval chain; which stage a person may act on is checked per order in the service.
const STAGE_PERMISSIONS = [
    RBAC_PERMISSIONS.INVOICE_CONFIRM_COORDINATOR,
    RBAC_PERMISSIONS.INVOICE_CONFIRM_QC,
    RBAC_PERMISSIONS.INVOICE_CONFIRM_ENGINEER,
    RBAC_PERMISSIONS.INVOICE_CONFIRM_MANAGER,
];

const bodySchema = z.object({
    action: z.enum(['APPROVE', 'RETURN']),
    sodIds: z.array(databaseUuidSchema).min(1).max(200),
    note: z.string().max(500).optional(),
});

// GET /api/service-orders/approvals?stage=&rtom=&q= - orders waiting at a stage the caller may approve (own area only)
export const GET = apiHandler(async (req, params) => {
    const sp = new URL(req.url).searchParams;
    return SodApprovalService.queue(params._userId ?? '', { stage: sp.get('stage') ?? undefined, rtom: sp.get('rtom') ?? undefined, q: sp.get('q') ?? undefined });
}, { permissions: STAGE_PERMISSIONS });

// POST /api/service-orders/approvals - approve one or many orders at their current stage, or return them with a reason
export const POST = apiHandler(async (_req, params, body: z.infer<typeof bodySchema>) => {
    const userId = params._userId;
    if (!userId) throw AppError.unauthorized('Authentication required');
    if (body.action === 'RETURN') return SodApprovalService.returnOrders(userId, body.sodIds, body.note ?? '');
    return SodApprovalService.approve(userId, body.sodIds, body.note);
}, { schema: bodySchema, permissions: STAGE_PERMISSIONS, audit: { action: 'SOD_APPROVAL_CHAIN', entity: 'ServiceOrder' } });

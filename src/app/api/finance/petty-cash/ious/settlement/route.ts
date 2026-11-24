import { z } from 'zod';
import { apiHandler } from '@/lib/api-handler';
import { AppError } from '@/lib/error';
import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';
import { databaseUuidSchema } from '@/lib/validations/uuid.schema';
import { OspFloatService } from '@/services/finance/osp-float.service';

export const dynamic = 'force-dynamic';

const submit = z.object({
    iouId: databaseUuidSchema,
    bills: z.number().finite().nonnegative().optional(),
    refund: z.number().finite().nonnegative().optional(),
    reference: z.string().trim().max(120).optional(),
    receiptUrl: z.string().trim().max(500).optional(),
    remarks: z.string().trim().max(2000).optional(),
}).strict();

// POST: the custodian settles an issued IOU of the box (bills handed in, cash returned); it waits for the Area Manager of the site office
export const POST = apiHandler(async (_req, params, body) => {
    if (!params._userId) throw AppError.unauthorized('Authentication required');
    return { message: 'Settlement sent to the Area Manager', data: await OspFloatService.submitSettlement(params._userId, body.iouId, body) };
}, { schema: submit, permissions: [RBAC_PERMISSIONS.FINANCE_WRITE, RBAC_PERMISSIONS.PETTY_CASH_SITE], audit: { action: 'SUBMIT_SETTLEMENT', entity: 'OSP_IOU' } });

const decide = z.object({ id: databaseUuidSchema, action: z.enum(['VERIFY', 'REJECT']), reason: z.string().trim().min(3).max(500).optional() }).strict();

// PATCH: the Area Manager of the site office verifies the settlement (the bills and the cash returned are booked), or sends it back with a reason
export const PATCH = apiHandler(async (_req, params, body) => {
    if (!params._userId) throw AppError.unauthorized('Authentication required');
    return { message: body.action === 'VERIFY' ? 'Settlement verified' : 'Settlement sent back', data: await OspFloatService.decideSettlement(params._userId, body.id, body.action, body.reason) };
}, { schema: decide, permissions: [RBAC_PERMISSIONS.PETTY_CASH_SITE, RBAC_PERMISSIONS.FINANCE_APPROVE], audit: { action: 'DECIDE_SETTLEMENT', entity: 'OSP_IOU' } });

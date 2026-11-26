import { z } from 'zod';
import { apiHandler } from '@/lib/api-handler';
import { AppError } from '@/lib/error';
import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';
import { databaseUuidSchema } from '@/lib/validations/uuid.schema';
import { PvChainService } from '@/services/finance/pv-chain.service';

export const dynamic = 'force-dynamic';

// the OSP Account (signatures, documents sent) and the HO Account Executive (documents received)
const STEP_HOLDERS = [RBAC_PERMISSIONS.FINANCE_WRITE, RBAC_PERMISSIONS.PROCUREMENT_HO_PAYMENT_RECORD];
const bodySchema = z.object({
    voucherId: databaseUuidSchema,
    action: z.enum(['SIGNED', 'NOT_SIGNED', 'DOCS_SENT', 'DOCS_RECEIVED', 'DOCS_NOT_RECEIVED']),
    signedVoucherUrl: z.string().max(1000).nullish(),
    remarks: z.string().max(500).nullish(),
});

// GET /api/procurement/payment-approvals
// Vendor payment vouchers of the company flow in the caller's scope: where each one waits, and its trail.
export const GET = apiHandler(async (_req, params) => {
    if (!params._userId) throw AppError.unauthorized('Authentication required');
    return PvChainService.list(params._userId);
}, { permissions: [RBAC_PERMISSIONS.PROCUREMENT_PV_CHAIN_READ] });

// POST /api/procurement/payment-approvals  { voucherId, action: SIGNED | NOT_SIGNED | DOCS_SENT | DOCS_RECEIVED | DOCS_NOT_RECEIVED, remarks?, signedVoucherUrl? }
// Each action is checked by the service against the step the voucher waits at (OSP Account, HO Account Executive).
export const POST = apiHandler(async (_req, params, body: z.infer<typeof bodySchema>) => {
    if (!params._userId) throw AppError.unauthorized('Authentication required');
    return PvChainService.act(body.voucherId, params._userId, body.action, body.remarks, { signedVoucherUrl: body.signedVoucherUrl });
}, { schema: bodySchema, permissions: STEP_HOLDERS, audit: { action: 'PV_CHAIN_ACTION', entity: 'PAYMENT_VOUCHER', entityIdParam: 'voucherId' } });

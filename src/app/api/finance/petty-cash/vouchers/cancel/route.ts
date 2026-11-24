import { z } from 'zod';
import { apiHandler } from '@/lib/api-handler';
import { AppError } from '@/lib/error';
import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';
import { databaseUuidSchema } from '@/lib/validations/uuid.schema';
import { PettyCashService } from '@/services/finance/petty-cash.service';

export const dynamic = 'force-dynamic';

const cancelSchema = z.object({
    id: databaseUuidSchema,
    reason: z.string().trim().min(3).max(500),
    carriedToNumber: z.string().trim().max(60).optional(),
}).strict();

// POST /api/finance/petty-cash/vouchers/cancel: cancel a draft bill with a reason, and the number of the bill it was carried to
export const POST = apiHandler(async (_req, params, body) => {
    if (!params._userId) throw AppError.unauthorized('Authentication required');
    return { message: 'Bill cancelled', data: await PettyCashService.cancelVoucher(body.id, body.reason, body.carriedToNumber, params._userId) };
}, { schema: cancelSchema, permissions: [RBAC_PERMISSIONS.FINANCE_WRITE, RBAC_PERMISSIONS.PETTY_CASH_SITE], audit: { action: 'CANCEL', entity: 'PETTY_CASH_VOUCHER' } });

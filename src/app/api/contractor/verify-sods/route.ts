import { z } from 'zod';
import { apiHandler } from '@/lib/api-handler';
import { AppError } from '@/lib/error';
import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';
import { databaseUuidSchema } from '@/lib/validations/uuid.schema';
import { ContractorVerificationService } from '@/services/service-order/contractor-verification.service';

export const dynamic = 'force-dynamic';

const bodySchema = z.discriminatedUnion('action', [
    z.object({ action: z.literal('VERIFY'), sodIds: z.array(databaseUuidSchema).min(1).max(500) }),
    z.object({ action: z.literal('REPORT'), sodIds: z.array(databaseUuidSchema).min(1).max(500), note: z.string().min(3).max(500) }),
]);

// GET /api/contractor/verify-sods - the finished, checked orders of the signed-in contractor that wait for its verification
export const GET = apiHandler(async (_req, params) => ContractorVerificationService.list(params._userId ?? ''), { permissions: [RBAC_PERMISSIONS.CONTRACTOR_WRITE] });

// POST - verify orders, or report a problem (the orders go back to the Area Coordinator / QC Officer check)
export const POST = apiHandler(async (_req, params, body: z.infer<typeof bodySchema>) => {
    const userId = params._userId;
    if (!userId) throw AppError.unauthorized('Authentication required');
    return body.action === 'VERIFY' ? ContractorVerificationService.verify(userId, body.sodIds) : ContractorVerificationService.report(userId, body.sodIds, body.note);
}, { schema: bodySchema, permissions: [RBAC_PERMISSIONS.CONTRACTOR_WRITE], audit: { action: 'CONTRACTOR_VERIFY_SODS', entity: 'ServiceOrder' } });

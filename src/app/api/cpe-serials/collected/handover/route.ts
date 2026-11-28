import { z } from 'zod';
import { apiHandler } from '@/lib/api-handler';
import { AppError } from '@/lib/error';
import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';
import { databaseUuidSchema } from '@/lib/validations/uuid.schema';
import { CollectedCpeService } from '@/services/inventory/collected-cpe.service';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({
    opmcId: databaseUuidSchema,
    contractorId: databaseUuidSchema,
    month: z.string().regex(/^\d{4}-\d{2}$/),
    ids: z.array(databaseUuidSchema).min(1).max(500),
    handedOverDate: z.string().regex(/^\d{4}-\d{2}-\d{2}/),
    reference: z.string().max(120).nullish(),
    scanUrl: z.string().max(1000).nullish(),
});

// POST /api/cpe-serials/collected/handover: the devices of one contractor, RTOM and month were handed over on a Collected CPE Handing Over Form (CCF-)
export const POST = apiHandler(async (_req, params, body: z.infer<typeof bodySchema>) => {
    if (!params._userId) throw AppError.unauthorized('Authentication required');
    return CollectedCpeService.handover({ userId: params._userId, ...body });
}, { schema: bodySchema, permissions: [RBAC_PERMISSIONS.INVENTORY_CPE_RECEIVE], audit: { action: 'CPE_HANDOVER_FORM', entity: 'CPE_HANDOVER_FORM' } });

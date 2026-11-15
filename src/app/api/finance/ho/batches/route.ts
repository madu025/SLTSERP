import { z } from 'zod';
import { apiHandler } from '@/lib/api-handler';
import { AppError } from '@/lib/error';
import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';
import { databaseUuidSchema } from '@/lib/validations/uuid.schema';
import { HoBatchService } from '@/services/finance/ho-batch.service';

export const dynamic = 'force-dynamic';

const createSchema = z.object({ voucherIds: z.array(databaseUuidSchema).min(1).max(100), note: z.string().max(500).nullish() });

// GET /api/finance/ho/batches?status=&ready=1  - packs sent to Head Office, or (ready=1) approved vouchers not yet in a pack
export const GET = apiHandler(async (req, params) => {
    const sp = new URL(req.url).searchParams;
    if (sp.get('ready')) return HoBatchService.readyToSubmit(params._userId ?? '');
    return HoBatchService.list(params._userId ?? '', sp.get('status') || undefined);
}, { permissions: [RBAC_PERMISSIONS.FINANCE_READ] });

// POST /api/finance/ho/batches  { voucherIds, note }  - submit approved vouchers to Head Office as one pack
export const POST = apiHandler(async (_req, params, body: z.infer<typeof createSchema>) => {
    if (!params._userId) throw AppError.unauthorized('Authentication required');
    return HoBatchService.create(params._userId, body.voucherIds, body.note);
}, { schema: createSchema, permissions: [RBAC_PERMISSIONS.FINANCE_HO_SUBMIT], audit: { action: 'SUBMIT_HO_PACK', entity: 'HO_PAYMENT_BATCH' } });

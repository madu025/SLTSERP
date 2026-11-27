import { z } from 'zod';
import { apiHandler } from '@/lib/api-handler';
import { AppError } from '@/lib/error';
import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';
import { databaseUuidSchema } from '@/lib/validations/uuid.schema';
import { OpeningStockService } from '@/services/inventory/opening-stock.service';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({ action: z.enum(['APPROVE', 'REJECT']), reason: z.string().max(500).nullish() });

// POST /api/inventory/opening-stock/:id  { action: APPROVE | REJECT, reason? }: a second person approves the count (the submitter never does)
export const POST = apiHandler(async (_req, params, body: z.infer<typeof bodySchema>) => {
    if (!params._userId) throw AppError.unauthorized('Authentication required');
    const id = databaseUuidSchema.parse(params.id);
    return body.action === 'APPROVE' ? OpeningStockService.approve(id, params._userId) : OpeningStockService.reject(id, params._userId, body.reason ?? '');
}, { schema: bodySchema, permissions: [RBAC_PERMISSIONS.INVENTORY_APPROVE], audit: { action: 'OPENING_STOCK_DECISION', entity: 'OPENING_STOCK_LOAD', entityIdParam: 'id' } });

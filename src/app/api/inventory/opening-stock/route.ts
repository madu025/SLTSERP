import { z } from 'zod';
import { apiHandler } from '@/lib/api-handler';
import { AppError } from '@/lib/error';
import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';
import { databaseUuidSchema } from '@/lib/validations/uuid.schema';
import { OpeningStockService } from '@/services/inventory/opening-stock.service';

export const dynamic = 'force-dynamic';

const cell = z.union([z.string().max(200), z.number()]).nullish();
const bodySchema = z.object({
    storeId: databaseUuidSchema,
    countDate: z.string().regex(/^\d{4}-\d{2}-\d{2}/),
    countSheetUrl: z.string().max(1000),
    remarks: z.string().max(500).nullish(),
    rows: z.array(z.object({ row: z.number().int(), code: z.string().max(100), quantity: cell, unitCost: cell, batchNumber: cell, expiryDate: cell })).min(1).max(5000),
});

// GET /api/inventory/opening-stock: the opening stock loads of the stores the caller works in
export const GET = apiHandler(async (_req, params) => {
    if (!params._userId) throw AppError.unauthorized('Authentication required');
    return OpeningStockService.list(params._userId);
}, { permissions: [RBAC_PERMISSIONS.INVENTORY_MASTER, RBAC_PERMISSIONS.INVENTORY_APPROVE] });

// POST /api/inventory/opening-stock: submit a store's counted opening stock for approval (store staff)
export const POST = apiHandler(async (_req, params, body: z.infer<typeof bodySchema>) => {
    if (!params._userId) throw AppError.unauthorized('Authentication required');
    return OpeningStockService.submit({ userId: params._userId, ...body, rows: body.rows.map((r) => ({ ...r, quantity: r.quantity ?? '', unitCost: r.unitCost ?? '' })) });
}, { schema: bodySchema, permissions: [RBAC_PERMISSIONS.INVENTORY_MASTER], audit: { action: 'SUBMIT_OPENING_STOCK', entity: 'OPENING_STOCK_LOAD' } });

import { z } from 'zod';
import { apiHandler } from '@/lib/api-handler';
import { AppError } from '@/lib/error';
import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';
import { databaseUuidSchema } from '@/lib/validations/uuid.schema';
import { PurchaseOrderService } from '@/services/procurement/purchase-order.service';

export const dynamic = 'force-dynamic';

const line = z.object({
    requestItemId: databaseUuidSchema,
    quantity: z.number().positive(),
    unitPrice: z.number().min(0),
    taxAmount: z.number().min(0).optional(),
});

const createSchema = z.object({
    action: z.literal('CREATE'),
    requestId: databaseUuidSchema,
    vendorId: databaseUuidSchema.nullish(),
    vendorName: z.string().max(200).nullish(),
    expectedDelivery: z.string().nullish(),
    remarks: z.string().max(1000).nullish(),
    currency: z.string().max(3).nullish(),
    lines: z.array(line).min(1),
});

const amendSchema = z.object({
    action: z.literal('AMEND'),
    poId: databaseUuidSchema,
    vendorId: databaseUuidSchema.nullish(),
    expectedDelivery: z.string().nullish(),
    lines: z.array(z.object({ poItemId: databaseUuidSchema, quantity: z.number().positive().optional(), unitPrice: z.number().min(0).optional(), taxAmount: z.number().min(0).optional() })).optional(),
});

const simple = z.object({ action: z.enum(['ISSUE', 'CLOSE']), poId: databaseUuidSchema });
const cancelSchema = z.object({ action: z.literal('CANCEL'), poId: databaseUuidSchema, reason: z.string().min(3).max(500) });

const bodySchema = z.discriminatedUnion('action', [createSchema, amendSchema, simple, cancelSchema]);

// GET /api/procurement/purchase-orders?status=&vendorId=
// Store purchase orders in the caller's stores, newest first.
export const GET = apiHandler(async (req, params) => {
    const sp = new URL(req.url).searchParams;
    return PurchaseOrderService.listStorePos(params._userId ?? '', { status: sp.get('status') || undefined, vendorId: sp.get('vendorId') || undefined });
}, { permissions: [RBAC_PERMISSIONS.PROCUREMENT_READ] });

// POST /api/procurement/purchase-orders  { action: CREATE | AMEND | ISSUE | CANCEL | CLOSE, ... }
export const POST = apiHandler(async (_req, params, body: z.infer<typeof bodySchema>) => {
    const userId = params._userId;
    if (!userId) throw AppError.unauthorized('Authentication required');
    switch (body.action) {
        case 'CREATE': return PurchaseOrderService.createStorePo({ ...body, userId });
        case 'AMEND': return PurchaseOrderService.amendStorePo({ ...body, userId });
        case 'ISSUE': return PurchaseOrderService.issueStorePo(body.poId, userId);
        case 'CANCEL': return PurchaseOrderService.cancelStorePo(body.poId, userId, body.reason);
        case 'CLOSE': return PurchaseOrderService.closeStorePo(body.poId, userId);
    }
}, {
    schema: bodySchema,
    permissions: [RBAC_PERMISSIONS.PROCUREMENT_WRITE],
    audit: { action: 'STORE_PO_ACTION', entity: 'PURCHASE_ORDER', entityIdParam: 'poId' },
});

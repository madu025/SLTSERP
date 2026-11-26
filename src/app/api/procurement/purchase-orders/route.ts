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
    // HO mode: the approval given in the HO system (required in that mode, checked by the service)
    ho: z.object({ ref: z.string().max(100), date: z.string().max(40), approvedBy: z.string().max(200), documentUrl: z.string().max(1000) }).nullish(),
});

const amendSchema = z.object({
    action: z.literal('AMEND'),
    poId: databaseUuidSchema,
    vendorId: databaseUuidSchema.nullish(),
    expectedDelivery: z.string().nullish(),
    reason: z.string().max(500).nullish(),
    lines: z.array(z.object({ poItemId: databaseUuidSchema, quantity: z.number().positive().optional(), unitPrice: z.number().min(0).optional(), taxAmount: z.number().min(0).optional() })).optional(),
});

const simple = z.object({ action: z.enum(['ISSUE', 'CLOSE']), poId: databaseUuidSchema });
const approveSchema = z.object({ action: z.enum(['APPROVE', 'RESUBMIT']), poId: databaseUuidSchema, remarks: z.string().max(500).nullish() });
const returnSchema = z.object({ action: z.literal('RETURN'), poId: databaseUuidSchema, remarks: z.string().min(3).max(500) });
const cancelSchema = z.object({ action: z.literal('CANCEL'), poId: databaseUuidSchema, reason: z.string().min(3).max(500) });
const hoPaymentSchema = z.object({ action: z.literal('RECORD_HO_PAYMENT'), poId: databaseUuidSchema, invoiceRef: z.string().max(100).nullish(), paymentRef: z.string().min(3).max(100), paidAt: z.string().max(40) });

const bodySchema = z.discriminatedUnion('action', [createSchema, amendSchema, simple, approveSchema, returnSchema, cancelSchema, hoPaymentSchema]);

// GET /api/procurement/purchase-orders?status=&vendorId=
// Store purchase orders in the caller's stores, newest first.
export const GET = apiHandler(async (req, params) => {
    const sp = new URL(req.url).searchParams;
    // ?meta=mode: how orders are approved (HO_DOCUMENTS = in the HO system, recorded here with evidence; NEXUS_CHAIN = three steps here)
    if (sp.get('meta') === 'mode') return { mode: await PurchaseOrderService.approvalMode() };
    return PurchaseOrderService.listStorePos(params._userId ?? '', { status: sp.get('status') || undefined, vendorId: sp.get('vendorId') || undefined });
}, { permissions: [RBAC_PERMISSIONS.PROCUREMENT_READ] });

// POST /api/procurement/purchase-orders  { action: CREATE | AMEND | APPROVE | ISSUE | CANCEL | CLOSE, ... }
export const POST = apiHandler(async (_req, params, body: z.infer<typeof bodySchema>) => {
    const userId = params._userId;
    if (!userId) throw AppError.unauthorized('Authentication required');
    // Approving or returning needs only the capability of the step the order waits at (checked by the service): the Finance Manager
    // signs step 3 without procurement.write. Everything else (raise, amend, resubmit, issue, cancel, close) needs procurement.write.
    const perms = params._permissions ?? [];
    const isStepAction = body.action === 'APPROVE' || body.action === 'RETURN';
    // the HO payment may be recorded by procurement or by finance
    if (body.action === 'RECORD_HO_PAYMENT') {
        if (![RBAC_PERMISSIONS.PROCUREMENT_WRITE, RBAC_PERMISSIONS.FINANCE_WRITE, RBAC_PERMISSIONS.ADMIN_RBAC].some((p) => perms.includes(p))) throw AppError.forbidden('Recording an HO payment needs procurement or finance write access');
        return PurchaseOrderService.recordHoPayment({ poId: body.poId, userId, invoiceRef: body.invoiceRef, paymentRef: body.paymentRef, paidAt: body.paidAt });
    }
    if (!isStepAction && !perms.includes(RBAC_PERMISSIONS.PROCUREMENT_WRITE) && !perms.includes(RBAC_PERMISSIONS.ADMIN_RBAC)) {
        throw AppError.forbidden('This purchase order action needs procurement write access');
    }
    switch (body.action) {
        case 'CREATE': return PurchaseOrderService.createStorePo({ ...body, userId });
        case 'AMEND': return PurchaseOrderService.amendStorePo({ ...body, userId });
        case 'APPROVE': return PurchaseOrderService.approveStorePo(body.poId, userId, body.remarks);
        case 'RESUBMIT': return PurchaseOrderService.resubmitStorePo(body.poId, userId, body.remarks);
        case 'RETURN': return PurchaseOrderService.returnStorePo(body.poId, userId, body.remarks);
        case 'ISSUE': return PurchaseOrderService.issueStorePo(body.poId, userId);
        case 'CANCEL': return PurchaseOrderService.cancelStorePo(body.poId, userId, body.reason);
        case 'CLOSE': return PurchaseOrderService.closeStorePo(body.poId, userId);
    }
    return null;
}, {
    schema: bodySchema,
    permissions: [RBAC_PERMISSIONS.PROCUREMENT_WRITE, RBAC_PERMISSIONS.PROCUREMENT_PO_APPROVE_L1, RBAC_PERMISSIONS.PROCUREMENT_PO_APPROVE_L2, RBAC_PERMISSIONS.PROCUREMENT_PO_APPROVE_L3, RBAC_PERMISSIONS.FINANCE_WRITE],
    audit: { action: 'STORE_PO_ACTION', entity: 'PURCHASE_ORDER', entityIdParam: 'poId' },
});

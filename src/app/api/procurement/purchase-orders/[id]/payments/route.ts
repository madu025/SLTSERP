import { z } from 'zod';
import { apiHandler } from '@/lib/api-handler';
import { AppError } from '@/lib/error';
import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';
import { databaseUuidSchema } from '@/lib/validations/uuid.schema';
import { HoPaymentService } from '@/services/procurement/ho-payment.service';

export const dynamic = 'force-dynamic';

const idSchema = z.object({ id: databaseUuidSchema });
const recordSchema = z.object({ action: z.literal('RECORD'), amount: z.number().positive(), paidDate: z.string().max(40), reference: z.string().min(3).max(100), method: z.string().max(20).nullish(), invoiceRef: z.string().max(100).nullish(), remarks: z.string().max(500).nullish() });
const verifySchema = z.object({ action: z.literal('VERIFY'), installmentId: databaseUuidSchema });
const rejectSchema = z.object({ action: z.literal('REJECT'), installmentId: databaseUuidSchema, reason: z.string().min(3).max(500) });
const bodySchema = z.discriminatedUnion('action', [recordSchema, verifySchema, rejectSchema]);

// GET /api/procurement/purchase-orders/:id/payments
// The order's payment schedule: terms, due date, what it is worth, paid, waiting for verification, still owed, and every HO payment.
export const GET = apiHandler(async (_req, params) => {
    if (!params._userId) throw AppError.unauthorized('Authentication required');
    const { id } = idSchema.parse(params);
    return HoPaymentService.schedule(id, params._userId);
}, { permissions: [RBAC_PERMISSIONS.PROCUREMENT_READ, RBAC_PERMISSIONS.FINANCE_READ] });

// POST /api/procurement/purchase-orders/:id/payments  { action: RECORD | VERIFY | REJECT }
// RECORD: the OSP Finance Officer at HO; VERIFY / REJECT: the OSP Finance Manager (never the person who recorded it).
export const POST = apiHandler(async (_req, params, body: z.infer<typeof bodySchema>) => {
    const userId = params._userId;
    if (!userId) throw AppError.unauthorized('Authentication required');
    const { id } = idSchema.parse(params);
    const perms = params._permissions ?? [];
    const can = (p: string) => perms.includes(p) || perms.includes(RBAC_PERMISSIONS.ADMIN_RBAC);
    switch (body.action) {
        case 'RECORD':
            if (!can(RBAC_PERMISSIONS.PROCUREMENT_HO_PAYMENT_RECORD)) throw AppError.forbidden('Recording an HO payment needs the HO payment recording capability');
            return HoPaymentService.record({ poId: id, userId, amount: body.amount, paidDate: body.paidDate, reference: body.reference, method: body.method, invoiceRef: body.invoiceRef, remarks: body.remarks });
        case 'VERIFY':
            if (!can(RBAC_PERMISSIONS.PROCUREMENT_HO_PAYMENT_VERIFY)) throw AppError.forbidden('Verifying an HO payment needs the HO payment verification capability');
            return HoPaymentService.verify(body.installmentId, userId);
        case 'REJECT':
            if (!can(RBAC_PERMISSIONS.PROCUREMENT_HO_PAYMENT_VERIFY)) throw AppError.forbidden('Rejecting an HO payment needs the HO payment verification capability');
            return HoPaymentService.reject(body.installmentId, userId, body.reason);
    }
    return null;
}, {
    schema: bodySchema,
    permissions: [RBAC_PERMISSIONS.PROCUREMENT_HO_PAYMENT_RECORD, RBAC_PERMISSIONS.PROCUREMENT_HO_PAYMENT_VERIFY],
    audit: { action: 'HO_PAYMENT_ACTION', entity: 'PURCHASE_ORDER', entityIdParam: 'id' },
});

import { z } from 'zod';
import { apiHandler } from '@/lib/api-handler';
import { AppError } from '@/lib/error';
import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';
import { databaseUuidSchema } from '@/lib/validations/uuid.schema';
import { userHasPermission } from '@/lib/user-permissions';
import { HoBillingService } from '@/services/finance/ho-billing.service';

export const dynamic = 'force-dynamic';

const bodySchema = z.discriminatedUnion('action', [
    z.object({ action: z.literal('SEND'), invoiceIds: z.array(databaseUuidSchema).min(1).max(100), note: z.string().max(500).nullish() }),
    z.object({ action: z.literal('COLLECT'), invoiceId: databaseUuidSchema, amount: z.number().finite().positive(), hoReference: z.string().trim().min(1).max(120), hoDate: z.string().datetime() }),
    z.object({ action: z.literal('RETURN'), invoiceId: databaseUuidSchema, reason: z.string().trim().min(1).max(500) }),
]);

// GET /api/finance/ho/billing?ready=1 - invoices ready to send; otherwise the packs sent to Head Office
export const GET = apiHandler(async (req, params) => {
    const sp = new URL(req.url).searchParams;
    if (sp.get('ready')) return HoBillingService.readyToSend(params._userId ?? '');
    return HoBillingService.list(params._userId ?? '');
}, { permissions: [RBAC_PERMISSIONS.FINANCE_READ] });

// POST /api/finance/ho/billing - SEND (OSP Finance), COLLECT / RETURN (Head Office)
export const POST = apiHandler(async (_req, params, body: z.infer<typeof bodySchema>) => {
    const userId = params._userId;
    if (!userId) throw AppError.unauthorized('Authentication required');
    if (body.action === 'SEND') {
        if (!(await userHasPermission(userId, RBAC_PERMISSIONS.FINANCE_HO_SUBMIT))) throw AppError.forbidden('finance.ho.submit is required to send invoices to Head Office');
        return HoBillingService.create(userId, body.invoiceIds, body.note);
    }
    if (!(await userHasPermission(userId, RBAC_PERMISSIONS.FINANCE_HO_CONFIRM))) throw AppError.forbidden('finance.ho.confirm is required to confirm or return a Head Office collection');
    if (body.action === 'RETURN') return HoBillingService.returnInvoice(userId, body.invoiceId, body.reason);
    const recordedOnBehalf = await userHasPermission(userId, RBAC_PERMISSIONS.FINANCE_HO_SUBMIT);
    return HoBillingService.confirmCollection(userId, { invoiceId: body.invoiceId, amount: body.amount, hoReference: body.hoReference, hoDate: new Date(body.hoDate), recordedOnBehalf });
}, { schema: bodySchema, permissions: [RBAC_PERMISSIONS.FINANCE_HO_SUBMIT, RBAC_PERMISSIONS.FINANCE_HO_CONFIRM], audit: { action: 'HO_BILLING_ACTION', entity: 'HO_BILLING_BATCH' } });

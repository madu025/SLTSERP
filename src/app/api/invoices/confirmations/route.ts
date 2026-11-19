import { z } from 'zod';
import { apiHandler } from '@/lib/api-handler';
import { AppError } from '@/lib/error';
import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';
import { databaseUuidSchema } from '@/lib/validations/uuid.schema';
import { InvoiceGateService } from '@/services/invoice/invoice-gate.service';

export const dynamic = 'force-dynamic';

// Which step a person holds (the capability, role and area each step of the gate names) is decided per invoice by the gate, so this
// route only needs a signed-in user; someone who holds no step sees an empty list and cannot approve anything.
const PERMISSIONS = [RBAC_PERMISSIONS.DASHBOARD_READ];

const bodySchema = z.discriminatedUnion('action', [
    z.object({ action: z.literal('APPROVE'), invoiceIds: z.array(databaseUuidSchema).min(1).max(200), note: z.string().max(500).optional() }),
    z.object({ action: z.literal('RETURN'), invoiceIds: z.array(databaseUuidSchema).min(1).max(200), note: z.string().max(500).optional() }),
    z.object({ action: z.literal('REMOVE_SODS'), invoiceId: databaseUuidSchema, sodIds: z.array(databaseUuidSchema).min(1).max(200), note: z.string().max(500) }),
]);

// GET /api/invoices/confirmations?stage=&q= - invoices waiting at a step the caller holds (own area only);
// GET /api/invoices/confirmations?invoiceId= - the service orders of one invoice (and the ones already taken out of it)
export const GET = apiHandler(async (req, params) => {
    const sp = new URL(req.url).searchParams;
    const invoiceId = sp.get('invoiceId');
    if (invoiceId) return InvoiceGateService.sodsOf(params._userId ?? '', databaseUuidSchema.parse(invoiceId));
    return InvoiceGateService.queue(params._userId ?? '', { stage: sp.get('stage') ?? undefined, q: sp.get('q') ?? undefined });
}, { permissions: PERMISSIONS });

// POST /api/invoices/confirmations - approve one or many invoices at their current step, return them with a reason, or take service
// orders out of an invoice (they go back to the verification list)
export const POST = apiHandler(async (_req, params, body: z.infer<typeof bodySchema>) => {
    const userId = params._userId;
    if (!userId) throw AppError.unauthorized('Authentication required');
    if (body.action === 'REMOVE_SODS') return InvoiceGateService.removeSods(userId, body.invoiceId, body.sodIds, body.note);
    if (body.action === 'RETURN') return InvoiceGateService.returnInvoices(userId, body.invoiceIds, body.note ?? '');
    return InvoiceGateService.approve(userId, body.invoiceIds, body.note);
}, { schema: bodySchema, permissions: PERMISSIONS, audit: { action: 'INVOICE_AREA_APPROVAL', entity: 'Invoice' } });

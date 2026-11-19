import { z } from 'zod';
import { apiHandler } from '@/lib/api-handler';
import { AppError } from '@/lib/error';
import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';
import { databaseUuidSchema } from '@/lib/validations/uuid.schema';
import { InvoiceGateService } from '@/services/invoice/invoice-gate.service';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({
    action: z.enum(['APPROVE', 'RETURN']),
    invoiceIds: z.array(databaseUuidSchema).min(1).max(50),
    note: z.string().max(500).optional(),
});

// GET /api/contractor-portal/invoice-approvals?invoiceId= - the contractor's own service orders of an invoice waiting for its step
export const GET = apiHandler(async (req, params) => {
    const invoiceId = new URL(req.url).searchParams.get('invoiceId');
    if (!invoiceId) return InvoiceGateService.queue(params._userId ?? '');
    return InvoiceGateService.sodsOf(params._userId ?? '', databaseUuidSchema.parse(invoiceId));
}, { permissions: [RBAC_PERMISSIONS.CONTRACTOR_WRITE] });

// POST /api/contractor-portal/invoice-approvals - the contractor confirms its invoice, or disputes it with a reason (it goes back to the start)
export const POST = apiHandler(async (_req, params, body: z.infer<typeof bodySchema>) => {
    const userId = params._userId;
    if (!userId) throw AppError.unauthorized('Authentication required');
    if (body.action === 'RETURN') return InvoiceGateService.returnInvoices(userId, body.invoiceIds, body.note ?? '');
    return InvoiceGateService.approve(userId, body.invoiceIds, body.note);
}, { schema: bodySchema, permissions: [RBAC_PERMISSIONS.CONTRACTOR_WRITE], audit: { action: 'INVOICE_CONTRACTOR_STEP', entity: 'Invoice' } });

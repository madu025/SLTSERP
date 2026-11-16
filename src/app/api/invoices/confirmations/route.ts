import { z } from 'zod';
import { apiHandler } from '@/lib/api-handler';
import { AppError } from '@/lib/error';
import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';
import { databaseUuidSchema } from '@/lib/validations/uuid.schema';
import { InvoiceConfirmationService } from '@/services/invoice/invoice-confirmation.service';

export const dynamic = 'force-dynamic';

const CONFIRM_PERMISSIONS = [
    RBAC_PERMISSIONS.INVOICE_CONFIRM_COORDINATOR,
    RBAC_PERMISSIONS.INVOICE_CONFIRM_QC,
    RBAC_PERMISSIONS.INVOICE_CONFIRM_ENGINEER,
    RBAC_PERMISSIONS.INVOICE_CONFIRM_MANAGER,
];

const bodySchema = z.object({
    invoiceId: databaseUuidSchema,
    action: z.enum(['CONFIRM', 'RETURN']),
    note: z.string().max(500).optional(),
});

// GET /api/invoices/confirmations - invoices waiting at a stage the caller may confirm (own area only)
export const GET = apiHandler(async (_req, params) => {
    return InvoiceConfirmationService.queue(params._userId ?? '');
}, { permissions: CONFIRM_PERMISSIONS });

// POST /api/invoices/confirmations - confirm the stage the invoice is at, or return it with a reason
export const POST = apiHandler(async (_req, params, body: z.infer<typeof bodySchema>) => {
    const userId = params._userId;
    if (!userId) throw AppError.unauthorized('Authentication required');
    return InvoiceConfirmationService.act(userId, body.invoiceId, body.action, body.note);
}, { schema: bodySchema, permissions: CONFIRM_PERMISSIONS, audit: { action: 'INVOICE_AREA_CONFIRMATION', entity: 'Invoice' } });

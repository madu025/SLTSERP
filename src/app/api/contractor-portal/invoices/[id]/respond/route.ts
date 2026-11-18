import { z } from 'zod';
import { apiHandler } from '@/lib/api-handler';
import { AppError } from '@/lib/error';
import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';
import { databaseUuidSchema } from '@/lib/validations/uuid.schema';
import { InvoiceContractorConfirmationService } from '@/services/invoice/invoice-contractor-confirmation.service';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({
    action: z.enum(['CONFIRM', 'DISPUTE']),
    note: z.string().max(500).optional(),
});

// POST /api/contractor-portal/invoices/:id/respond - the contractor confirms its new invoice, or disputes it with a reason
export const POST = apiHandler(async (_req, params, body: z.infer<typeof bodySchema>) => {
    const userId = params._userId;
    if (!userId) throw AppError.unauthorized('Authentication required');
    const invoiceId = databaseUuidSchema.parse(params.id);
    return InvoiceContractorConfirmationService.respond(userId, invoiceId, body.action, body.note);
}, { schema: bodySchema, permissions: [RBAC_PERMISSIONS.CONTRACTOR_WRITE], audit: { action: 'INVOICE_CONTRACTOR_RESPONSE', entity: 'Invoice' } });

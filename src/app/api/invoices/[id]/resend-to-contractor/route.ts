import { apiHandler } from '@/lib/api-handler';
import { AppError } from '@/lib/error';
import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';
import { databaseUuidSchema } from '@/lib/validations/uuid.schema';
import { InvoiceContractorConfirmationService } from '@/services/invoice/invoice-contractor-confirmation.service';

export const dynamic = 'force-dynamic';

// POST /api/invoices/:id/resend-to-contractor - after correcting a disputed invoice, ask the contractor to review it again
export const POST = apiHandler(async (_req, params) => {
    const userId = params._userId;
    if (!userId) throw AppError.unauthorized('Authentication required');
    return InvoiceContractorConfirmationService.resend(userId, databaseUuidSchema.parse(params.id));
}, { permissions: [RBAC_PERMISSIONS.SOD_INVOICE], audit: { action: 'INVOICE_RESEND_TO_CONTRACTOR', entity: 'Invoice' } });

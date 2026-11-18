import { z } from 'zod';
import { apiHandler } from '@/lib/api-handler';
import { AppError } from '@/lib/error';
import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';
import { databaseUuidSchema } from '@/lib/validations/uuid.schema';
import { InvoiceOspApprovalService } from '@/services/invoice/invoice-osp-approval.service';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({ invoiceIds: z.array(databaseUuidSchema).min(1).max(200) });

// GET /api/finance/invoice-dispatch - verified invoices ready to send, with the OSP managers, and approved ones on their way to Head Office
export const GET = apiHandler(async (_req, params) => {
    return InvoiceOspApprovalService.financeBoard(params._userId ?? '');
}, { permissions: [RBAC_PERMISSIONS.FINANCE_WRITE] });

// POST /api/finance/invoice-dispatch - Finance sends the selected verified invoices to the OSP managers
export const POST = apiHandler(async (_req, params, body: z.infer<typeof bodySchema>) => {
    const userId = params._userId;
    if (!userId) throw AppError.unauthorized('Authentication required');
    return InvoiceOspApprovalService.send(userId, body.invoiceIds);
}, { schema: bodySchema, permissions: [RBAC_PERMISSIONS.FINANCE_WRITE], audit: { action: 'INVOICES_SENT_TO_OSP_MANAGERS', entity: 'Invoice' } });

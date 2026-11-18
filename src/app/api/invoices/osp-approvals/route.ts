import { z } from 'zod';
import { apiHandler } from '@/lib/api-handler';
import { AppError } from '@/lib/error';
import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';
import { databaseUuidSchema } from '@/lib/validations/uuid.schema';
import { InvoiceOspApprovalService } from '@/services/invoice/invoice-osp-approval.service';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({
    action: z.enum(['APPROVE', 'RETURN']),
    invoiceIds: z.array(databaseUuidSchema).min(1).max(200),
    note: z.string().max(500).optional(),
});

// GET /api/invoices/osp-approvals - invoices Finance sent that wait for an OSP manager, in the caller's area
export const GET = apiHandler(async (_req, params) => {
    return InvoiceOspApprovalService.managerQueue(params._userId ?? '');
}, { permissions: [RBAC_PERMISSIONS.INVOICE_OSP_APPROVE] });

// POST /api/invoices/osp-approvals - approve one or many invoices, or return them to Finance with a reason
export const POST = apiHandler(async (_req, params, body: z.infer<typeof bodySchema>) => {
    const userId = params._userId;
    if (!userId) throw AppError.unauthorized('Authentication required');
    if (body.action === 'RETURN') return InvoiceOspApprovalService.returnToFinance(userId, body.invoiceIds, body.note ?? '');
    return InvoiceOspApprovalService.approve(userId, body.invoiceIds);
}, { schema: bodySchema, permissions: [RBAC_PERMISSIONS.INVOICE_OSP_APPROVE], audit: { action: 'INVOICE_OSP_DECISION', entity: 'Invoice' } });

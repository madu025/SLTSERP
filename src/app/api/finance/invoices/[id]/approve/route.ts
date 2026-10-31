export const dynamic = 'force-dynamic';
import { apiHandler } from "@/lib/api-handler";
import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';
import { z } from 'zod';
import { InvoiceApprovalService } from '@/services/finance/invoice-approval.service';

const approveInvoiceSchema = z.object({
    reason: z.string().optional(),
    action: z.enum(['APPROVE', 'REJECT'])
});

export const POST = apiHandler(
    async (_req, params, body: z.infer<typeof approveInvoiceSchema>) => {
        if (body.action === 'APPROVE') {
            const invoice = await InvoiceApprovalService.approveInvoice(params.id, params._userId);
            return { message: 'Invoice approved successfully', invoice };
        } else {
            const invoice = await InvoiceApprovalService.rejectInvoice(params.id, body.reason || 'Rejected by approver', params._userId);
            return { message: 'Invoice rejected successfully', invoice };
        }
    },
    {
        schema: approveInvoiceSchema,
        permissions: [RBAC_PERMISSIONS.FINANCE_APPROVE],
        audit: {
            action: 'APPROVE_INVOICE',
            entity: 'Invoice'
        }
    }
);

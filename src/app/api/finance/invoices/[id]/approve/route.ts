export const dynamic = 'force-dynamic';
import { ROLE_GROUPS } from '@/config/roles';
import { AppError } from '@/lib/error';
import { apiHandler } from "@/lib/api-handler";
import { z } from 'zod';
import { InvoiceApprovalService } from '@/services/finance/invoice-approval.service';
import { requestContext } from '@/lib/request-context';

const approveInvoiceSchema = z.object({
    reason: z.string().optional(),
    action: z.enum(['APPROVE', 'REJECT'])
});

export const POST = apiHandler(
    async (req, params, body: z.infer<typeof approveInvoiceSchema>) => {
        const userId = req.headers.get('x-user-id');
        const userRole = req.headers.get('x-user-role');
        if (!userId) throw AppError.unauthorized('Authentication required');
        
        if (body.action === 'APPROVE') {
            const invoice = await InvoiceApprovalService.approveInvoice(params.id, userId, userRole || 'USER');
            return { message: 'Invoice approved successfully', invoice };
        } else {
            const invoice = await InvoiceApprovalService.rejectInvoice(params.id, body.reason || 'Rejected by approver');
            return { message: 'Invoice rejected successfully', invoice };
        }
    },
    {
        schema: approveInvoiceSchema,
        roles: ROLE_GROUPS.FINANCE_APPROVERS,
        audit: {
            action: 'APPROVE_INVOICE',
            entity: 'Invoice'
        }
    }
);

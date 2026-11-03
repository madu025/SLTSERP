import { apiHandler } from '@/lib/api-handler';
import { InvoiceService } from '@/services/invoice/invoice.service';
import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';
import { AppError } from '@/lib/error';
import { z } from 'zod';
export const dynamic = 'force-dynamic';
const paramsSchema = z.object({
    id: z.string().min(1, 'Invoice ID is required')
});
export const POST = apiHandler(
    async (_req: Request, params) => {
        const { id: invoiceId } = paramsSchema.parse(params);
        const userId = params._userId;
        if (!userId) throw AppError.unauthorized('Authentication required');
        const { invoice, invoiceNumber } = await InvoiceService.approveBySfAudit(invoiceId, userId);
        return {
            success: true,
            message: `Invoice ${invoiceNumber} successfully cleared and APPROVED by SF Audit Section.`,
            invoice
        };
    },
    {
        permissions: [RBAC_PERMISSIONS.FINANCE_AUDIT]
    }
);

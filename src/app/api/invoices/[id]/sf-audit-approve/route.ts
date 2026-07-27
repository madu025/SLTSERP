import { apiHandler } from '@/lib/api-handler';
import { InvoiceService } from '@/services/invoice.service';
import { AppError } from '@/lib/error';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const paramsSchema = z.object({
    id: z.string().min(1, 'Invoice ID is required')
});

export const POST = apiHandler(
    async (req: Request, params: unknown) => {
        const { id: invoiceId } = paramsSchema.parse(params);
        const userId = req.headers.get('x-user-id') || 'system';

        const { invoice, invoiceNumber } = await InvoiceService.approveBySfAudit(invoiceId, userId);

        return {
            success: true,
            message: `Invoice ${invoiceNumber} successfully cleared and APPROVED by SF Audit Section.`,
            invoice
        };
    },
    {
        roles: ['SF_AUDIT', 'SF_AUDIT_OFFICER', 'SF_AUDIT_MANAGER', 'ADMIN', 'SUPER_ADMIN', 'FINANCE_MANAGER']
    }
);

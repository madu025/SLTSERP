export const dynamic = 'force-dynamic';
import { apiHandler } from '@/lib/api-handler';
import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';
import { z } from 'zod';
import { BillingService } from '@/services/finance/billing.service';
import { AppError } from '@/lib/error';

const generateInvoiceSchema = z.object({
    contractorId: z.string().min(1, 'Contractor ID is required'),
    projectId: z.string().optional(),
    description: z.string().optional(),
    retentionPercent: z.number().min(0).max(100).default(0),
    whtPercent: z.number().min(0).max(100).default(0),
    advanceDeduction: z.number().min(0).default(0),
    month: z.union([z.string(), z.number()]).optional(),
    year: z.union([z.string(), z.number()]).optional(),
});

export const POST = apiHandler(
    async (req, params, body: z.infer<typeof generateInvoiceSchema>) => {
        const userId = params._userId;
        if (!userId) throw AppError.unauthorized('Authenticated billing user is required');
        const invoice = await BillingService.generateContractorInvoice(body, userId);
        return {
            message: 'Draft Invoice Generated successfully',
            invoice
        };
    },
    {
        schema: generateInvoiceSchema,
        permissions: [RBAC_PERMISSIONS.FINANCE_WRITE],
        audit: {
            action: 'GENERATE_INVOICE',
            entity: 'Invoice'
        }
    }
);

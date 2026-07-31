export const dynamic = 'force-dynamic';
import { ROLE_GROUPS } from '@/config/roles';
import { apiHandler } from '@/lib/api-handler';
import { z } from 'zod';
import { BillingService } from '@/services/finance/billing.service';

const generateInvoiceSchema = z.object({
    contractorId: z.string().min(1, 'Contractor ID is required'),
    projectId: z.string().optional(),
    description: z.string().optional(),
    retentionPercent: z.number().min(0).max(100).default(0),
    whtPercent: z.number().min(0).max(100).default(0),
    advanceDeduction: z.number().min(0).default(0),
});

export const POST = apiHandler(
    async (req, params, body: z.infer<typeof generateInvoiceSchema>) => {
        const invoice = await BillingService.generateContractorInvoice(body);
        return {
            message: 'Draft Invoice Generated successfully',
            invoice
        };
    },
    {
        schema: generateInvoiceSchema,
        roles: ROLE_GROUPS.PROJECT_MANAGERS,
        audit: {
            action: 'GENERATE_INVOICE',
            entity: 'Invoice'
        }
    }
);

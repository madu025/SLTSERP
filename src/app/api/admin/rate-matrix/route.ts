import { apiHandler } from '@/lib/api-handler';
import { PricingAuditService } from '@/services/sf-audit/pricing-audit.service';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

// GET Handler: Retrieve all Rate Matrix Rules (Auto-seeds if empty)
export const GET = apiHandler(
    async () => {
        return await PricingAuditService.getRateRules();
    },
    {}
);

// PUT Handler: Update Rate Rule Amount
const updateRateSchema = z.object({
    id: z.string().min(1, 'Rule ID is required'),
    rateAmount: z.number().min(0, 'Rate amount must be >= 0')
});

export const PUT = apiHandler(
    async (_req, _params, body) => {
        const { id, rateAmount } = body;
        const updated = await PricingAuditService.updateRateRule(id, rateAmount);
        return { message: 'Rate amount updated successfully', updated };
    },
    {
        schema: updateRateSchema,
        audit: { action: 'UPDATE', entity: 'RATE_MATRIX' }
    }
);

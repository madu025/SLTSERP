import { apiHandler } from '@/lib/api-handler';
import { PricingAuditService } from '@/services/sf-audit/pricing-audit.service';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

// GET Handler: Retrieve all Rate Matrix Rules (Auto-seeds if empty)
export const GET = apiHandler(
    async () => {
        return await PricingAuditService.getRateRules();
    },
    { roles: ['ADMIN', 'SUPER_ADMIN', 'FINANCE_MANAGER', 'AUDITOR', 'SF_AUDIT', 'SF_AUDIT_OFFICER', 'SF_AUDIT_MANAGER'] }
);

// PUT Handler: Update Rate Rule Amount
const updateRateSchema = z.object({
    id: z.string().min(1, 'Rule ID is required'),
    rateAmount: z.number().min(0, 'Rate amount must be >= 0')
});

export const PUT = apiHandler(
    async (_req: Request, _ctx: { params?: Record<string, string> }, body: { id: string; rateAmount: number }) => {
        const { id, rateAmount } = body;
        const updated = await PricingAuditService.updateRateRule(id, rateAmount);
        return { message: 'Rate amount updated successfully', updated };
    },
    {
        roles: ['ADMIN', 'SUPER_ADMIN', 'FINANCE_MANAGER', 'AUDITOR', 'SF_AUDIT', 'SF_AUDIT_OFFICER', 'SF_AUDIT_MANAGER'],
        schema: updateRateSchema
    }
);

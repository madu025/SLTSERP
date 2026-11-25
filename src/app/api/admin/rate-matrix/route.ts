import { apiHandler } from '@/lib/api-handler';
import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';
import { PricingAuditService } from '@/services/sf-audit/pricing-audit.service';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

// GET Handler: Retrieve all Rate Matrix Rules (Auto-seeds if empty).
// The rates are read by the people who audit pricing (SF Audit, and the Finance Manager and CEO, who hold finance.audit); the Stores Manager,
// who holds finance.approve without being a finance reader, does not read them. Only the administrator changes a rate (PUT).
export const GET = apiHandler(
    async () => {
        return await PricingAuditService.getRateRules();
    },
    { permissions: [RBAC_PERMISSIONS.ADMIN_RBAC, RBAC_PERMISSIONS.FINANCE_AUDIT] }
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
        permissions: [RBAC_PERMISSIONS.ADMIN_RBAC],
        audit: { action: 'UPDATE', entity: 'RATE_MATRIX' }
    }
);

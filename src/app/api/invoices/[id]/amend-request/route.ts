import { apiHandler } from '@/lib/api-handler';
import { PricingAuditService } from '@/services/sf-audit/pricing-audit.service';
import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';
import { AppError } from '@/lib/error';
import { z } from 'zod';
export const dynamic = 'force-dynamic';
const amendRequestSchema = z.object({
    requestedAmount: z.number().min(0, 'Requested amount must be non-negative'),
    reason: z.string().min(5, 'Detailed reason for SF Audit amendment is required (min 5 chars)')
});
export const POST = apiHandler(
    async (_req, params, body) => {
        const userId = params._userId;
        if (!userId) throw AppError.unauthorized('Authentication required');
        const amendmentRequest = await PricingAuditService.createAmendmentRequest(
            params.id, body.requestedAmount, body.reason, userId
        );
        return {
            message: 'Invoice amount amendment request submitted for SF Audit Manager approval.',
            amendmentRequest
        };
    },
    {
        schema: amendRequestSchema,
        permissions: [RBAC_PERMISSIONS.FINANCE_AUDIT]
    }
);

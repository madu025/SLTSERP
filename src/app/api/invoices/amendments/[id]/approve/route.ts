import { apiHandler } from '@/lib/api-handler';
import { PricingAuditService } from '@/services/sf-audit/pricing-audit.service';
import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';
import { AppError } from '@/lib/error';
import { z } from 'zod';
export const dynamic = 'force-dynamic';
const approveSchema = z.object({
    status: z.enum(['APPROVED', 'REJECTED']),
    rejectionReason: z.string().optional()
});
export const POST = apiHandler(
    async (_req, params, body) => {
        const userId = params._userId;
        if (!userId) throw AppError.unauthorized('Authentication required');
        const result = await PricingAuditService.processAmendmentRequest(
            params.id, body.status, userId, body.rejectionReason
        );
        if (result.status === 'REJECTED') {
            return { message: 'Amendment request rejected.', amendmentRequest: result.amendmentRequest };
        }
        return {
            message: `Invoice amount successfully amended following SF Audit approval.`,
            invoice: result.invoice,
            amendmentRequest: result.amendmentRequest
        };
    },
    {
        schema: approveSchema,
        permissions: [RBAC_PERMISSIONS.FINANCE_APPROVE]
    }
);

import { ROLE_GROUPS } from '@/config/roles';
import { apiHandler } from '@/lib/api-handler';
import { PricingAuditService } from '@/services/sf-audit/pricing-audit.service';
import { z } from 'zod';
export const dynamic = 'force-dynamic';
const approveSchema = z.object({
    status: z.enum(['APPROVED', 'REJECTED']),
    rejectionReason: z.string().optional()
});
export const POST = apiHandler(
    async (req, params, body) => {
        const userId = req.headers.get('x-user-id') || 'system';
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
        roles: ROLE_GROUPS.FINANCE_APPROVERS,
        schema: approveSchema
    }
);
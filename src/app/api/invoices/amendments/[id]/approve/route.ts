import { NextResponse } from 'next/server';
import { apiHandler } from '@/lib/api-handler';
import { PricingAuditService } from '@/services/sf-audit/pricing-audit.service';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const approveSchema = z.object({
    status: z.enum(['APPROVED', 'REJECTED']),
    rejectionReason: z.string().optional()
});

export const POST = apiHandler(
    async (req: Request, context: { params: Promise<{ id: string }> }, body: { status: 'APPROVED' | 'REJECTED'; rejectionReason?: string }) => {
        const { id: requestId } = await context.params;
        const userId = req.headers.get('x-user-id') || 'system';

        if (!requestId) {
            return NextResponse.json({ error: 'Amendment Request ID is required' }, { status: 400 });
        }

        const result = await PricingAuditService.processAmendmentRequest(requestId, body.status, userId, body.rejectionReason);

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
        roles: ['SF_AUDIT_MANAGER', 'FINANCE_DIRECTOR', 'SUPER_ADMIN', 'ADMIN'],
        schema: approveSchema
    }
);

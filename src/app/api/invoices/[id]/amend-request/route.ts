import { NextResponse } from 'next/server';
import { apiHandler } from '@/lib/api-handler';
import { PricingAuditService } from '@/services/sf-audit/pricing-audit.service';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const amendRequestSchema = z.object({
    requestedAmount: z.number().min(0, 'Requested amount must be non-negative'),
    reason: z.string().min(5, 'Detailed reason for SF Audit amendment is required (min 5 chars)')
});

export const POST = apiHandler(
    async (req: Request, context: { params: Promise<{ id: string }> }, body: { requestedAmount: number; reason: string }) => {
        const { id: invoiceId } = await context.params;
        const userId = req.headers.get('x-user-id') || 'system';

        if (!invoiceId) {
            return NextResponse.json({ error: 'Invoice ID is required' }, { status: 400 });
        }

        const amendmentRequest = await PricingAuditService.createAmendmentRequest(invoiceId, body.requestedAmount, body.reason, userId);

        return {
            message: 'Invoice amount amendment request submitted for SF Audit Manager approval.',
            amendmentRequest
        };
    },
    {
        roles: ['SF_AUDIT', 'SF_AUDIT_OFFICER', 'ADMIN', 'SUPER_ADMIN', 'FINANCE_MANAGER'],
        schema: amendRequestSchema
    }
);

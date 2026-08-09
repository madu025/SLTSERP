import { apiHandler } from '@/lib/api-handler';
import { z } from 'zod';
import { SfAuditService } from '@/services/finance/sf-audit.service';
import { ROLE_GROUPS } from '@/config/roles';

export const dynamic = 'force-dynamic';

// GET: Fetch Active Payment Split Config
export const GET = apiHandler(async () => {
    const config = await SfAuditService.getPaymentSplitConfig();
    return { success: true, data: config };
});

// POST Schema
const postSchema = z.object({
    splitMode: z.enum(['SINGLE_FULL', 'SPLIT_AB', 'SPLIT_ABC']),
    claimAPercent: z.number().min(0).max(100),
    claimBPercent: z.number().min(0).max(100),
    claimCPercent: z.number().min(0).max(100),
    description: z.string().optional()
}).refine((data) => {
    const sum = data.claimAPercent + data.claimBPercent + data.claimCPercent;
    return Math.abs(sum - 100) < 0.01;
}, {
    message: 'Total split percentages (Claim A + B + C) must equal exactly 100%'
});

// POST: Save SF Auditor Config Settings
export const POST = apiHandler(async (req) => {
    const body = await req.json();
    const validated = postSchema.parse(body);
    const payload = await SfAuditService.savePaymentSplitConfig(validated);

    return { success: true, message: 'Payment split configuration saved successfully', data: payload };
}, {
    // Payment split ratios drive auditor claim payouts — SF Audit + finance scope
    roles: ROLE_GROUPS.SF_AUDITING,
    audit: { action: 'SAVE_CONFIG', entity: 'SF_PAYMENT_SPLIT' }
});

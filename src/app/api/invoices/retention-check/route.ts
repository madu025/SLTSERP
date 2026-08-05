export const dynamic = 'force-dynamic';
import { apiHandler } from '@/lib/api-handler';
import { InvoiceService } from '@/services/invoice/invoice.service';
import { ROLE_GROUPS } from '@/config/roles';

export const POST = apiHandler(async () => {
    console.log('[RETENTION-CHECK] Started');
    const results = await InvoiceService.checkRetentionEligibility();
    return Response.json({ success: true, results });
}, {
    roles: ROLE_GROUPS.FINANCE,
    audit: { action: 'CHECK_RETENTION_ELIGIBILITY', entity: 'Invoice' }
});

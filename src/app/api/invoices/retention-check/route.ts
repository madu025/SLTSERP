import { apiHandler } from '@/lib/api-handler';
import { InvoiceService } from '@/services/invoice.service';

export const POST = apiHandler(async () => {
    console.log('[RETENTION-CHECK] Started');
    const results = await InvoiceService.checkRetentionEligibility();
    return Response.json({ success: true, results });
}, {
    audit: { action: 'CHECK_RETENTION_ELIGIBILITY', entity: 'Invoice' }
});

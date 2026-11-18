import { apiHandler } from '@/lib/api-handler';
import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';
import { InvoiceContractorConfirmationService } from '@/services/invoice/invoice-contractor-confirmation.service';

export const dynamic = 'force-dynamic';

// GET /api/finance/sf-audit/queue - invoices the contractor confirmed that wait for OSP Quality (SF Audit), in the caller's area
export const GET = apiHandler(async (_req, params) => {
    return InvoiceContractorConfirmationService.ospQualityQueue(params._userId ?? '');
}, { permissions: [RBAC_PERMISSIONS.FINANCE_AUDIT] });

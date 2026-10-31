import { apiHandler } from '@/lib/api-handler';
import { InvoiceService } from '@/services/finance/invoice.service';
import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';

export const dynamic = 'force-dynamic';

export const GET = apiHandler(async (req, params) => {
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const search = searchParams.get('search') || '';
    const approvalStatus = searchParams.get('approvalStatus') || '';

    return await InvoiceService.getInvoices({ page, limit, search, approvalStatus }, params._userId);
}, {
    permissions: [RBAC_PERMISSIONS.FINANCE_READ],
    rawResponse: true
});

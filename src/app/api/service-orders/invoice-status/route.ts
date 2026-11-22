import { apiHandler } from '@/lib/api-handler';
import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';
import { InvoiceStatusService } from '@/services/invoice/invoice-status.service';

export const dynamic = 'force-dynamic';

// GET /api/service-orders/invoice-status?rtom=&search=&state= - where the contractor invoices of the caller's own RTOMs are on their way to payment (read-only)
export const GET = apiHandler(async (req, params) => {
    const sp = new URL(req.url).searchParams;
    return InvoiceStatusService.forUser(params._userId ?? '', { rtom: sp.get('rtom') ?? undefined, search: sp.get('search') ?? undefined, state: sp.get('state') ?? undefined });
}, { permissions: [RBAC_PERMISSIONS.SOD_READ] });

import { apiHandler } from '@/lib/api-handler';
import { InvoiceService } from '@/services/invoice/invoice.service';
import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';

export const dynamic = 'force-dynamic';

export const GET = apiHandler(async (_req, params) => {
    const { id } = params;
    const response = await InvoiceService.getInvoiceDetails(id);
    return Response.json(response);
}, { permissions: [RBAC_PERMISSIONS.SOD_INVOICE] });

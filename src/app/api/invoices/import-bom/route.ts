export const dynamic = 'force-dynamic';
import { apiHandler } from '@/lib/api-handler';
import { BOMInvoiceService } from '@/services/finance/bom-invoice.service';
import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';
import { AppError } from '@/lib/error';
import { z } from 'zod';
const importBomSchema = z.object({
    rows: z.array(z.any()).min(1, "Rows must be a non-empty array"),
    bomPath: z.string().optional()
});
export const POST = apiHandler(async (_req, params, body) => {
    const data = importBomSchema.parse(body);
    const userId = params._userId;
    if (!userId) throw AppError.unauthorized('Authentication required');
    const result = await BOMInvoiceService.processBOMImport(data.rows, userId, data.bomPath);
    return Response.json(result);
}, {
    permissions: [RBAC_PERMISSIONS.FINANCE_APPROVE],
    audit: { action: 'IMPORT_BOM_INVOICES', entity: 'Invoice' }
});

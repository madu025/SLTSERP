import { apiHandler } from '@/lib/api-handler';
import { BOMInvoiceService } from '@/services/finance/bom-invoice.service';
import { z } from 'zod';
import { requestContext } from '@/lib/request-context';

const importBomSchema = z.object({
    rows: z.array(z.any()).min(1, "Rows must be a non-empty array"),
    bomPath: z.string().optional()
});

export const POST = apiHandler(async (req, _params, body) => {
    const data = importBomSchema.parse(body);
    const userId = req.headers.get('x-user-id') || 'ADMIN';

    const result = await BOMInvoiceService.processBOMImport(data.rows, userId, data.bomPath);
    return Response.json(result);
}, {
    roles: ['SUPER_ADMIN', 'ADMIN', 'FINANCE_MANAGER', 'REGIONAL_MANAGER'], // Excluded AREA_COORDINATOR, QC_OFFICER based on legacy logic
    audit: { action: 'IMPORT_BOM_INVOICES', entity: 'Invoice' }
});

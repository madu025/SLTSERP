import { apiHandler } from '@/lib/api-handler';
import { BOMInvoiceService } from '@/services/finance/bom-invoice.service';
import { z } from 'zod';
import { AppError } from '@/lib/error';

export async function OPTIONS() {
    return new Response(null, {
        status: 204,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, x-user-id, x-user-role, x-extension-key',
        },
    });
}

const importBomCsvSchema = z.object({
    csvText: z.string().min(1, "csvText must be a non-empty string"),
    bomPath: z.string().optional()
});

export const POST = apiHandler(async (req, _params, body) => {
    const data = importBomCsvSchema.parse(body);

    const extensionKey = req.headers.get('x-extension-key');
    const extensionSecret = process.env.EXTENSION_SECRET || 'slt-bridge-secret-2026';
    const isExtension = extensionKey === extensionSecret;

    const userId = req.headers.get('x-user-id') || 'ADMIN';
    const userRole = req.headers.get('x-user-role');

    const allowedRoles = ['ADMIN', 'SUPER_ADMIN', 'OSP_MANAGER', 'STORES_MANAGER'];
    const hasAllowedRole = userRole && allowedRoles.includes(userRole);

    if (!isExtension && !hasAllowedRole) {
        throw AppError.forbidden('Permission Denied: Unauthorized to import BOM invoices.');
    }

    const result = await BOMInvoiceService.processBOMCSVImport(data.csvText, userId, data.bomPath);

    return Response.json(result, {
        headers: {
            'Access-Control-Allow-Origin': '*',
        }
    });
}, {
    rawResponse: true, // Needed to preserve CORS headers in response
    audit: { action: 'IMPORT_BOM_CSV', entity: 'Invoice' }
});

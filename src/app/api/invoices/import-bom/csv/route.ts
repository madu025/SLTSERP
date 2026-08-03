export const dynamic = 'force-dynamic';
import { apiHandler } from '@/lib/api-handler';
import { BOMInvoiceService } from '@/services/finance/bom-invoice.service';
import { ROLE_GROUPS, hasRole } from '@/config/roles';
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
    // Fail-closed: no hardcoded secret fallback — unset env means extension auth is disabled
    const extensionSecret = process.env.EXTENSION_SECRET;
    const isExtension = !!extensionSecret && extensionKey === extensionSecret;

    const userId = req.headers.get('x-user-id') ?? 'EXTENSION_SYNC';
    const userRole = req.headers.get('x-user-role');

    const hasAllowedRole = !!userRole && hasRole(userRole, ROLE_GROUPS.BOM_IMPORT_ADMINS);

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

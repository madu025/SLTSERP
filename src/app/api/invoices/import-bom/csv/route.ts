export const dynamic = 'force-dynamic';
import { apiHandler } from '@/lib/api-handler';
import { getSessionPermissionsFromCookie } from '@/lib/mixed-auth';
import { BOMInvoiceService } from '@/services/finance/bom-invoice.service';
import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';
import { z } from 'zod';
import { AppError } from '@/lib/error';

export async function OPTIONS() {
    return new Response(null, {
        status: 204,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, x-extension-key',
        },
    });
}

const importBomCsvSchema = z.object({
    csvText: z.string().min(1, "csvText must be a non-empty string"),
    bomPath: z.string().optional()
});

export const POST = apiHandler(async (req, params, body) => {
    const data = importBomCsvSchema.parse(body);

    const extensionKey = req.headers.get('x-extension-key');
    // Fail-closed: no hardcoded secret fallback — unset env means extension auth is disabled
    const extensionSecret = process.env.EXTENSION_SECRET;
    const isExtension = !!extensionSecret && extensionKey === extensionSecret;

    const userId = params._userId ?? 'EXTENSION_SYNC';
    const cookieSession = isExtension ? null : await getSessionPermissionsFromCookie();
    const hasAllowedPermission = (cookieSession?.permissions ?? params._permissions).includes(RBAC_PERMISSIONS.FINANCE_APPROVE);

    if (!isExtension && !hasAllowedPermission) {
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
    audit: { action: 'IMPORT_BOM_CSV', entity: 'Invoice' },
    publicRoute: true,
});

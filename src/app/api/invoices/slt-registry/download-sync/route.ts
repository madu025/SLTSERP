import { apiHandler } from '@/lib/api-handler';
import { BOMInvoiceService } from '@/services/finance/bom-invoice.service';
import { SLTPortalAuthService } from '@/services/slt-portal-auth.service';
import { AppError } from '@/lib/error';
import { z } from 'zod';
import { requestContext } from '@/lib/request-context';

const downloadSyncSchema = z.object({
    bomPath: z.string().min(1, 'bomPath is required')
});

export const POST = apiHandler(async (req, _params, body) => {
    const data = downloadSyncSchema.parse(body);

    const extensionKey = req.headers.get('x-extension-key');
    const extensionSecret = process.env.EXTENSION_SECRET || 'slt-bridge-secret-2026';
    const isExtension = extensionKey === extensionSecret;

    const authUserId = req.headers.get('x-user-id');
    const userRole = req.headers.get('x-user-role') || 'UNKNOWN';
    const allowedRoles = ['ADMIN', 'SUPER_ADMIN', 'OSP_MANAGER', 'STORES_MANAGER'];
    const hasAllowedRole = userRole && allowedRoles.includes(userRole);

    if (!isExtension && !hasAllowedRole) {
        throw AppError.forbidden('Permission Denied: Unauthorized to import BOM invoices.');
    }

    const sltCookie = await SLTPortalAuthService.getOrRefreshCookie();

    if (!sltCookie) {
        throw AppError.badRequest('SLT portal session cookie not set or could not be generated. Please save your cookie or SLT credentials.');
    }

    const cleanPath = data.bomPath.trim().replace(/\//g, '-');
    const downloadUrl = `https://serviceportal.slt.lk/iShamp/files/${cleanPath}.csv`;

    console.log(`Downloading original BOM CSV from SLT portal: ${downloadUrl}`);
    
    const res = await fetch(downloadUrl, {
        headers: {
            'Cookie': sltCookie,
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        },
        next: { revalidate: 0 }
    });

    if (!res.ok) {
        throw AppError.badRequest(`Failed to download file from SLT portal (HTTP ${res.status})`);
    }

    const csvText = await res.text();

    if (csvText.includes('login') || csvText.includes('Username') || csvText.includes('Password') || csvText.includes('<!DOCTYPE html>')) {
        throw AppError.unauthorized('SLT portal session has expired. Please copy and save your active session cookie again.');
    }

    const finalUserId = authUserId || 'ADMIN';
    const result = await BOMInvoiceService.processBOMCSVImport(csvText, finalUserId, data.bomPath);

    return Response.json(result);
}, {
    audit: { action: 'DOWNLOAD_SYNC_BOM_INVOICES', entity: 'Invoice' }
});

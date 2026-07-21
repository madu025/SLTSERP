import { apiHandler } from '@/lib/api-handler';
import { ServiceOrderService } from '@/services/sod.service';
import { AppError } from '@/lib/error';

export const dynamic = 'force-dynamic';

export const GET = apiHandler(async () => {
    const items = await ServiceOrderService.getOspFtthItems();
    return { materials: items };
}, { rawResponse: true });

export const POST = apiHandler(async (_request, _params, body) => {
    const { rows, skipMaterials = false } = body || {};

    if (!rows || !Array.isArray(rows) || rows.length === 0) {
        throw AppError.badRequest('No data to import');
    }

    const { successCount, errorCount, skippedNoOpmc, results } = await ServiceOrderService.bulkImportLegacyServiceOrders(
        rows,
        skipMaterials
    );

    return {
        success: true,
        message: `Import completed: ${successCount} succeeded, ${errorCount} failed${skippedNoOpmc > 0 ? ` (${skippedNoOpmc} skipped - OPMC not found)` : ''}`,
        summary: {
            total: rows.length,
            success: successCount,
            failed: errorCount,
            skippedNoOpmc
        },
        results
    };
}, {
    roles: ['ADMIN', 'SUPER_ADMIN'],
    audit: { action: 'LEGACY_BULK_IMPORT', entity: 'ServiceOrder' },
    rawResponse: true
});

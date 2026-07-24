import { apiHandler } from '@/lib/api-handler';
import { StoreVarianceReconciliationService } from '@/services/inventory/store-variance-reconciliation.service';
import { AppError } from '@/lib/error';

export const dynamic = 'force-dynamic';

export const GET = apiHandler(async (req) => {
    const { searchParams } = new URL(req.url);
    const storeId = searchParams.get('storeId');

    if (!storeId) {
        throw AppError.badRequest('storeId parameter is required for variance reconciliation audit.');
    }

    const report = await StoreVarianceReconciliationService.generateStoreVarianceReport(storeId);

    return {
        success: true,
        count: report.length,
        storeId,
        timestamp: new Date().toISOString(),
        data: report,
    };
}, {
    roles: ['SUPER_ADMIN', 'ADMIN', 'FINANCE_MANAGER', 'STORES_MANAGER'],
    audit: { action: 'GENERATE_STORE_VARIANCE_REPORT', entity: 'InventoryStore' }
});

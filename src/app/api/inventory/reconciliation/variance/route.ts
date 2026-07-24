import { apiHandler } from '@/lib/api-handler';
import { InventoryService } from '@/services/inventory.service';
import { AppError } from '@/lib/error';

export const dynamic = 'force-dynamic';

// GET: Run 3-Way Store Material Variance Audit and Fraud Analysis
export const GET = apiHandler(async (req) => {
    const { searchParams } = new URL(req.url);
    const storeId = searchParams.get('storeId');

    if (!storeId) {
        throw AppError.badRequest('STORE_ID_REQUIRED');
    }

    return await InventoryService.auditStoreVariance(storeId);
}, {
    roles: ['ADMIN', 'SUPER_ADMIN', 'STORES_MANAGER', 'OSP_MANAGER', 'FINANCE_MANAGER'],
    audit: { action: 'AUDIT', entity: 'STORE_VARIANCE' }
});

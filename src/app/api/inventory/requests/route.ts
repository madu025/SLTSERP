import { apiHandler } from '@/lib/api-handler';
import { InventoryService } from '@/services/inventory.service';
import { createStockRequest, processStockRequestAction } from '@/actions/inventory-actions';

export const dynamic = 'force-dynamic';

// GET all stock requests
export const GET = apiHandler(async (req) => {
    const { searchParams } = new URL(req.url);

    const filters = {
        storeId: searchParams.get('storeId') || undefined,
        isApprover: searchParams.get('isApprover') === 'true',
        status: searchParams.get('status') || undefined,
        workflowStage: searchParams.get('workflowStage') || undefined
    };

    return await InventoryService.getStockRequests(filters);
}, {
    rawResponse: true
});

// POST: Create stock request
export const POST = apiHandler(async (req, _params, body) => {
    const result = await createStockRequest(body);
    if (!result.success) {
        throw new Error(result.error || 'Failed to create request');
    }
    return result.data;
}, {
    roles: ['AREA_MANAGER', 'ADMIN', 'SUPER_ADMIN', 'ENGINEER', 'AREA_COORDINATOR', 'STORES_MANAGER'],
    audit: { action: 'CREATE', entity: 'STOCK_REQUEST' },
    rawResponse: true
});

// PATCH: Approve / Reject / Allocate stock request
export const PATCH = apiHandler(async (req, _params, body) => {
    const result = await processStockRequestAction(body);
    if (!result.success) {
        throw new Error(result.error || 'Failed to process request');
    }
    return result.data;
}, {
    roles: ['STORES_MANAGER', 'OSP_MANAGER', 'ADMIN', 'SUPER_ADMIN'],
    audit: { action: 'UPDATE_STATUS', entity: 'STOCK_REQUEST' },
    rawResponse: true
});


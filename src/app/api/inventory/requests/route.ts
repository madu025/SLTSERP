import { apiHandler } from '@/lib/api-handler';
import { InventoryService } from '@/services/inventory/inventory.service';
import { createStockRequest, processStockRequestAction } from '@/actions/inventory-actions';
import { AppError } from '@/lib/error';
import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';

export const dynamic = 'force-dynamic';

// GET all stock requests
export const GET = apiHandler(async (req, params) => {
    const { searchParams } = new URL(req.url);

    const filters = {
        storeId: searchParams.get('storeId') || undefined,
        isApprover: searchParams.get('isApprover') === 'true',
        status: searchParams.get('status') || undefined,
        workflowStage: searchParams.get('workflowStage') || undefined,
        sourceType: searchParams.get('sourceType') || undefined,
        procurementStatus: searchParams.get('procurementStatus') || undefined,
        awaitingApproval: searchParams.get('awaitingApproval') === 'true'
    };

    if (!params._userId) throw AppError.unauthorized('Authentication required');
    return await InventoryService.getStockRequests(filters, params._userId);
}, {
    permissions: [RBAC_PERMISSIONS.INVENTORY_READ],
    rawResponse: true
});

// POST: Create stock request
export const POST = apiHandler(async (req, _params, body) => {
    const result = await createStockRequest(body);
    if (!result.success) {
        throw AppError.badRequest(result.error || 'Failed to create request');
    }
    return result.data;
}, {
    permissions: [RBAC_PERMISSIONS.INVENTORY_WRITE, RBAC_PERMISSIONS.PROJECT_WRITE, RBAC_PERMISSIONS.PROCUREMENT_WRITE],
    audit: { action: 'CREATE', entity: 'STOCK_REQUEST' },
    rawResponse: true
});

// PATCH: Approve / Reject / Allocate stock request
export const PATCH = apiHandler(async (req, _params, body) => {
    const result = await processStockRequestAction(body);
    if (!result.success) {
        throw AppError.badRequest(result.error || 'Failed to process request');
    }
    return result.data;
}, {
    permissions: [RBAC_PERMISSIONS.INVENTORY_WRITE, RBAC_PERMISSIONS.INVENTORY_APPROVE, RBAC_PERMISSIONS.PROCUREMENT_WRITE],
    audit: { action: 'UPDATE_STATUS', entity: 'STOCK_REQUEST' },
    rawResponse: true
});


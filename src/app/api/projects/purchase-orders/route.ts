import { apiHandler } from '@/lib/api-handler';
import { ProjectPurchaseOrderService } from '@/services/project-purchase-order.service';

export const dynamic = 'force-dynamic';

// GET /api/projects/purchase-orders?projectId=xxx - List POs by project
export const GET = apiHandler(async (req) => {
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get('projectId');

    if (!projectId) {
        throw new Error('projectId is required');
    }

    return await ProjectPurchaseOrderService.getPurchaseOrders(projectId);
}, {
    rawResponse: true
});

// POST /api/projects/purchase-orders - Create a new PO with items
export const POST = apiHandler(async (req, _params, body) => {
    const { projectId, vendorId, title, items } = body;

    if (!projectId || !vendorId || !title || !items?.length) {
        throw new Error('projectId, vendorId, title, and items are required');
    }

    return await ProjectPurchaseOrderService.createPurchaseOrder(body);
}, {
    roles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'FINANCE_MANAGER', 'OSP_MANAGER'],
    audit: { action: 'CREATE', entity: 'PROJECT_PURCHASE_ORDER' },
    rawResponse: true
});

// PATCH /api/projects/purchase-orders - Update PO status (secure userId mapping)
export const PATCH = apiHandler(async (req, _params, body) => {
    const { id, status, cancellationReason } = body;
    const userId = req.headers.get("x-user-id") || undefined;

    if (!id || !status) {
        throw new Error("id and status are required");
    }

    const payload: any = { cancellationReason };
    if (status === 'APPROVED') payload.approvedById = userId;
    if (status === 'ISSUED') payload.issuedById = userId;
    if (status === 'CLOSED') payload.closedById = userId;

    return await ProjectPurchaseOrderService.updatePurchaseOrderStatus(id, status, payload);
}, {
    roles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'FINANCE_MANAGER', 'OSP_MANAGER'],
    audit: { action: 'UPDATE_STATUS', entity: 'PROJECT_PURCHASE_ORDER' },
    rawResponse: true
});

// DELETE /api/projects/purchase-orders - Delete a PO (DRAFT only)
export const DELETE = apiHandler(async (req) => {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
        throw new Error('id is required');
    }

    await ProjectPurchaseOrderService.deletePurchaseOrder(id);
    return { message: 'Purchase order deleted successfully' };
}, {
    roles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'FINANCE_MANAGER', 'OSP_MANAGER'],
    audit: { action: 'DELETE', entity: 'PROJECT_PURCHASE_ORDER' },
    rawResponse: true
});

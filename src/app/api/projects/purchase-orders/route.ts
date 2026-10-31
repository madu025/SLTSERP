import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';
import { assertProjectAccess } from '@/lib/project-access';
import { assertRecordProjectAccess, requireAnyPermission } from '@/lib/project-record-access';

const PO_APPROVAL_STATUSES = new Set(['APPROVED', 'ISSUED', 'CLOSED']);
const PO_APPROVER_PERMISSIONS = [RBAC_PERMISSIONS.PROJECT_APPROVE, RBAC_PERMISSIONS.PROJECT_FINANCE_APPROVE, RBAC_PERMISSIONS.FINANCE_APPROVE];
import { apiHandler } from '@/lib/api-handler';
import { AppError } from '@/lib/error';
import { ProjectPurchaseOrderService } from '@/services/project/project-purchase-order.service';
import { z } from 'zod';

const createPurchaseOrderSchema = z.object({
    projectId: z.string().min(1), requisitionId: z.string().nullable().optional(),
    vendorId: z.string().min(1), vendorName: z.string().optional(), title: z.string().min(1),
    description: z.string().nullable().optional(), priority: z.string().optional(), type: z.string().optional(),
    expectedDelivery: z.string().nullable().optional(), deliveryLocation: z.string().nullable().optional(),
    paymentTerms: z.string().nullable().optional(), deliveryTerms: z.string().nullable().optional(),
    notes: z.string().nullable().optional(),
    items: z.array(z.object({
        requisitionItemId: z.string().nullable().optional(), itemCode: z.string().min(1),
        description: z.string().min(1), unit: z.string().optional(), quantity: z.number().positive(),
        unitPrice: z.number().min(0), deliveryDate: z.string().nullable().optional(), notes: z.string().nullable().optional(),
    })).min(1),
});

export const dynamic = 'force-dynamic';

// GET /api/projects/purchase-orders?projectId=xxx - List POs by project
export const GET = apiHandler(async (req, params) => {
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get('projectId');

    if (!projectId) {
        throw AppError.badRequest('projectId is required');
    }

    await assertProjectAccess(projectId, params._userId);
    return await ProjectPurchaseOrderService.getPurchaseOrders(projectId);
}, {
    permissions: [RBAC_PERMISSIONS.PROCUREMENT_READ],
    rawResponse: true
});

// POST /api/projects/purchase-orders - Create a new PO with items
export const POST = apiHandler(async (req, params, body) => {
    const data = createPurchaseOrderSchema.parse(body);
    const { projectId } = data;

    await assertProjectAccess(projectId, params._userId);
    return await ProjectPurchaseOrderService.createPurchaseOrder(data);
}, {
    permissions: [RBAC_PERMISSIONS.PROCUREMENT_WRITE],
    audit: { action: 'CREATE', entity: 'PROJECT_PURCHASE_ORDER' },
    rawResponse: true
});

// PATCH /api/projects/purchase-orders - Update PO status (secure userId mapping)
export const PATCH = apiHandler(async (req, params, body) => {
    const id = body.id as string | undefined;
    const status = body.status as string | undefined;
    const cancellationReason = body.cancellationReason as string | undefined;
    const userId = params._userId || undefined;

    if (!id || !status) {
        throw AppError.badRequest("id and status are required");
    }

    await assertRecordProjectAccess('purchaseOrder', id, params._userId);
    if (PO_APPROVAL_STATUSES.has(status)) {
        await requireAnyPermission(params._userId, PO_APPROVER_PERMISSIONS, 'An approver capability is required to approve, issue or close a purchase order');
    } else {
        await requireAnyPermission(params._userId, [RBAC_PERMISSIONS.PROCUREMENT_WRITE], 'procurement.write is required to update a purchase order');
    }

    const payload: Parameters<typeof ProjectPurchaseOrderService.updatePurchaseOrderStatus>[2] = { cancellationReason };
    if (status === 'APPROVED') payload.approvedById = userId;
    if (status === 'ISSUED') payload.issuedById = userId;
    if (status === 'CLOSED') payload.closedById = userId;

    return await ProjectPurchaseOrderService.updatePurchaseOrderStatus(id, status, payload);
}, {
    permissions: [RBAC_PERMISSIONS.PROCUREMENT_WRITE, ...PO_APPROVER_PERMISSIONS],
    audit: { action: 'UPDATE_STATUS', entity: 'PROJECT_PURCHASE_ORDER' },
    rawResponse: true
});

// DELETE /api/projects/purchase-orders - Delete a PO (DRAFT only)
export const DELETE = apiHandler(async (req, params) => {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
        throw AppError.badRequest('id is required');
    }

    await assertRecordProjectAccess('purchaseOrder', id, params._userId);
    await ProjectPurchaseOrderService.deletePurchaseOrder(id);
    return { message: 'Purchase order deleted successfully' };
}, {
    permissions: [RBAC_PERMISSIONS.PROCUREMENT_WRITE],
    audit: { action: 'DELETE', entity: 'PROJECT_PURCHASE_ORDER' },
    rawResponse: true
});

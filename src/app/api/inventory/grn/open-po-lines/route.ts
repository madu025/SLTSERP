import { apiHandler } from '@/lib/api-handler';
import { AppError } from '@/lib/error';
import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';
import { PurchaseOrderService } from '@/services/procurement/purchase-order.service';

export const dynamic = 'force-dynamic';

// GET /api/inventory/grn/open-po-lines
// Lines still to receive on approved purchase orders of the caller's stores, for one GRN that receives several orders of one vendor.
export const GET = apiHandler(async (_req, params) => {
    if (!params._userId) throw AppError.unauthorized('Authentication required');
    return PurchaseOrderService.openLinesForReceipt(params._userId);
}, { permissions: [RBAC_PERMISSIONS.INVENTORY_GRN] });

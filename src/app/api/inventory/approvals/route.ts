import { apiHandler } from '@/lib/api-handler';
import { AppError } from '@/lib/error';
import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';
import { InventoryApprovalQueueService } from '@/services/inventory/approval-queue.service';

export const dynamic = 'force-dynamic';

// GET /api/inventory/approvals: what waits for an approval in the caller's stores (requests, MRN, wastage, stock takes)
export const GET = apiHandler(async (_req, params) => {
    if (!params._userId) throw AppError.unauthorized('Authentication required');
    return InventoryApprovalQueueService.forUser(params._userId);
}, { permissions: [RBAC_PERMISSIONS.INVENTORY_APPROVE] });

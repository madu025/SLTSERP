import { apiHandler } from '@/lib/api-handler';
import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';
import { InventoryHealthService } from '@/services/inventory/inventory-health.service';

export const dynamic = 'force-dynamic';

// GET /api/inventory/health
// Stock value, reorder and stock-out, dead stock, cover and expiry for the stores the caller may access.
// Money values are only returned to callers holding the inventory cost capability.
export const GET = apiHandler(async (_req, params) => {
    const showValues = (params._permissions ?? []).includes(RBAC_PERMISSIONS.INVENTORY_COST_READ);
    return InventoryHealthService.getReport(params._userId ?? '', showValues);
}, { permissions: [RBAC_PERMISSIONS.INVENTORY_READ] });

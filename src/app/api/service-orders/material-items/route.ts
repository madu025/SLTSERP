import { apiHandler } from '@/lib/api-handler';
import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';
import { InventoryService } from '@/services/inventory/inventory.service';

export const dynamic = 'force-dynamic';

// GET /api/service-orders/material-items - the material list the service order screens pick from (completion, manual entry), without the store's prices and stock levels.
// Reading it needs the service order capability, so a person who only works on orders does not need access to the inventory module.
export const GET = apiHandler(async () => {
    const items = await InventoryService.getItems();
    return items.map((raw) => {
        const { unitPrice: _u, costPrice: _c, minLevel: _m, ...item } = raw as unknown as Record<string, unknown>;
        return item;
    });
}, { permissions: [RBAC_PERMISSIONS.SOD_READ], rawResponse: true });

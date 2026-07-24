import { apiHandler } from '@/lib/api-handler';
import { InventoryService } from '@/services/inventory.service';

export const dynamic = 'force-dynamic';

// GET: Fetch Non-Serialized Consumable Materials Audit (Drop Wire, Fast Connectors, Splitters, Clamps, Rosettes)
export const GET = apiHandler(async (req) => {
    const { searchParams } = new URL(req.url);
    const storeId = searchParams.get('storeId') || undefined;
    const contractorId = searchParams.get('contractorId') || undefined;
    const month = searchParams.get('month') || undefined;

    return await InventoryService.auditConsumables({
        storeId,
        contractorId,
        month
    });
}, {
    roles: ['ADMIN', 'SUPER_ADMIN', 'STORES_MANAGER', 'OSP_MANAGER', 'FINANCE_MANAGER'],
    audit: { action: 'AUDIT', entity: 'CONSUMABLE_VARIANCE' }
});

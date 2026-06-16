import { apiHandler } from '@/lib/api-handler';
import { InventoryService } from '@/services/inventory.service';
import { grnSchema } from '@/lib/validations/inventory.schema';

// POST: Create a new GRN
export const POST = apiHandler(async (req, _params, body) => {
    const userId = req.headers.get('x-user-id');
    
    return await InventoryService.createGRN({
        ...body,
        receivedById: userId || 'SYSTEM'
    });
}, { 
    schema: grnSchema,
    roles: ['STORES_MANAGER', 'STORES_ASSISTANT', 'ADMIN', 'SUPER_ADMIN'],
    audit: { action: 'CREATE', entity: 'GRN' }
});

// GET: Fetch GRNs
export const GET = apiHandler(async (req) => {
    const { searchParams } = new URL(req.url);
    const storeId = searchParams.get('storeId') || undefined;

    return await InventoryService.getGRNs(storeId);
});

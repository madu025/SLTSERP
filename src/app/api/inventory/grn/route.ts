import { apiHandler } from '@/lib/api-handler';
import { InventoryService } from '@/services/inventory.service';
import { grnSchema } from '@/lib/validations/inventory.schema';

// POST: Create a new GRN
export const POST = apiHandler(async (req, _params, body) => {
    // Current user identification from headers
    const userId = req.headers.get('x-user-id');
    const userRole = req.headers.get('x-user-role');

    if (!userRole || !['STORES_MANAGER', 'STORES_ASSISTANT', 'ADMIN', 'SUPER_ADMIN'].includes(userRole)) {
        throw new Error('Unauthorized');
    }

    if (!userId) {
        throw new Error('User ID is required in headers');
    }

    return await InventoryService.createGRN({
        ...body,
        receivedById: userId
    });
}, { schema: grnSchema });

// GET: Fetch GRNs
export const GET = apiHandler(async (req) => {
    const { searchParams } = new URL(req.url);
    const storeId = searchParams.get('storeId') || undefined;

    return await InventoryService.getGRNs(storeId);
});

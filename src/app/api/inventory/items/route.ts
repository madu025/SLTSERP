import { apiHandler } from '@/lib/api-handler';
import { InventoryService } from '@/services/inventory.service';
import { inventoryItemSchema } from '@/lib/validations/inventory.schema';

export const dynamic = 'force-dynamic';

// GET: Fetch all active items (rawResponse for compatibility)
export const GET = apiHandler(async (req) => {
    const { searchParams } = new URL(req.url);
    const context = searchParams.get('context') || undefined;
    return await InventoryService.getItems(context);
}, {
    rawResponse: true
});

// POST: Create a new inventory item
export const POST = apiHandler(async (req, _params, body) => {
    const data = {
        ...body,
        description: body.description ?? undefined
    };
    return await InventoryService.createItem(data);
}, {
    schema: inventoryItemSchema,
    roles: ['ADMIN', 'SUPER_ADMIN'],
    audit: { action: 'CREATE', entity: 'ITEM' },
    rawResponse: true
});

// PUT: Update an existing inventory item
export const PUT = apiHandler(async (req, _params, body) => {
    const { id, ...data } = body;
    if (!id) {
        throw new Error('ID_REQUIRED');
    }
    return await InventoryService.updateItem(id, data);
}, {
    roles: ['ADMIN', 'SUPER_ADMIN'],
    audit: { action: 'UPDATE', entity: 'ITEM' },
    rawResponse: true
});

// PATCH: Bulk items update
export const PATCH = apiHandler(async (req, _params, body) => {
    const { updates } = body;
    if (!updates) {
        throw new Error('UPDATES_REQUIRED');
    }
    return await InventoryService.patchBulkItems(updates);
}, {
    roles: ['ADMIN', 'SUPER_ADMIN'],
    audit: { action: 'BULK_UPDATE', entity: 'ITEM' },
    rawResponse: true
});

// DELETE: Delete an item
export const DELETE = apiHandler(async (req) => {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) {
        throw new Error('ID_REQUIRED');
    }
    return await InventoryService.deleteItem(id);
}, {
    roles: ['ADMIN', 'SUPER_ADMIN'],
    audit: { action: 'DELETE', entity: 'ITEM' },
    rawResponse: true
});

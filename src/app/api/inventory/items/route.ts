import { ROLE_GROUPS } from '@/config/roles';
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
    roles: ROLE_GROUPS.ADMINS,
    audit: { action: 'CREATE', entity: 'ITEM' },
    rawResponse: true
});

// PUT: Update an existing inventory item
export const PUT = apiHandler(async (_req, _params, body) => {
    const id = body.id as string | undefined;
    if (!id) {
        throw new Error('ID_REQUIRED');
    }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { id: _id, ...data } = body;
    return await InventoryService.updateItem(id, data);
}, {
    roles: ROLE_GROUPS.ADMINS,
    audit: { action: 'UPDATE', entity: 'ITEM' },
    rawResponse: true
});

// PATCH: Bulk items update
export const PATCH = apiHandler(async (_req, _params, body) => {
    const updates = body.updates as unknown[] | undefined;
    if (!updates) {
        throw new Error('UPDATES_REQUIRED');
    }
    return await InventoryService.patchBulkItems(updates);
}, {
    roles: ROLE_GROUPS.ADMINS,
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
    roles: ROLE_GROUPS.ADMINS,
    audit: { action: 'DELETE', entity: 'ITEM' },
    rawResponse: true
});

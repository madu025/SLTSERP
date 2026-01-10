import { NextResponse } from 'next/server';
import { InventoryService } from '@/services/inventory.service';
import { handleApiError, validateBody } from '@/lib/api-utils';
import { inventoryItemSchema } from '@/lib/validations/inventory.schema';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const context = searchParams.get('context') || undefined;
        const items = await InventoryService.getItems(context);
        return NextResponse.json(items);
    } catch (error) {
        return handleApiError(error);
    }
}

export async function POST(request: Request) {
    try {
        const body = await validateBody(request, inventoryItemSchema);
        const item = await InventoryService.createItem(body);
        return NextResponse.json(item);
    } catch (error: any) {
        return handleApiError(error);
    }
}

export async function PUT(request: Request) {
    try {
        const body = await request.json();
        const validation = inventoryItemSchema.safeParse(body);
        if (!validation.success) {
            return handleApiError(validation.error);
        }

        const { id, ...data } = body;
        const item = await InventoryService.updateItem(id, data);
        return NextResponse.json(item);
    } catch (error: any) {
        return handleApiError(error);
    }
}

// Bulk Update
export async function PATCH(request: Request) {
    try {
        const body = await request.json();
        const { updates } = body;
        const result = await InventoryService.patchBulkItems(updates);
        return NextResponse.json({ success: true, ...result });
    } catch (error: any) {
        return handleApiError(error);
    }
}

export async function DELETE(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');
        if (!id) throw new Error('ID_REQUIRED');

        await InventoryService.deleteItem(id);
        return NextResponse.json({ message: 'Item deleted' });
    } catch (error: any) {
        return handleApiError(error);
    }
}

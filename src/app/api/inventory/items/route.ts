import { NextResponse } from 'next/server';
import { InventoryService } from '@/services/inventory.service';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const context = searchParams.get('context') || undefined;

        const items = await InventoryService.getItems(context);
        return NextResponse.json(items);
    } catch (error) {
        console.error("Fetch items error:", error);
        return NextResponse.json({ error: 'Failed to fetch items' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const item = await InventoryService.createItem(body);
        return NextResponse.json(item);
    } catch (error: any) {
        if (error.message === 'CODE_AND_NAME_REQUIRED') {
            return NextResponse.json({ error: 'Code and Name are required' }, { status: 400 });
        }
        if (error.message === 'ITEM_EXISTS') {
            return NextResponse.json({ error: 'Item code already exists' }, { status: 409 });
        }
        console.error("Create item error:", error);
        return NextResponse.json({ error: 'Failed to create item' }, { status: 500 });
    }
}

export async function PUT(request: Request) {
    try {
        const body = await request.json();
        const { id, ...data } = body;
        const item = await InventoryService.updateItem(id, data);
        return NextResponse.json(item);
    } catch (error: any) {
        if (error.message === 'ID_REQUIRED') {
            return NextResponse.json({ error: 'ID required' }, { status: 400 });
        }
        return NextResponse.json({ error: 'Failed to update item' }, { status: 500 });
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
        if (error.message === 'UPDATES_MUST_BE_ARRAY') {
            return NextResponse.json({ error: 'Updates must be an array' }, { status: 400 });
        }
        return NextResponse.json({ error: 'Failed to update items' }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (id) {
            await InventoryService.deleteItem(id);
            return NextResponse.json({ message: 'Item deleted' });
        }
        return NextResponse.json({ error: 'ID required' }, { status: 400 });

    } catch (error: any) {
        if (error.message === 'ITEM_HAS_STOCK') {
            return NextResponse.json({ error: 'Cannot delete item with existing stock.' }, { status: 400 });
        }
        if (error.message === 'ITEM_USED_IN_TRANSACTIONS') {
            return NextResponse.json({ error: 'Failed to delete item. It may be used in transactions.' }, { status: 500 });
        }
        return NextResponse.json({ error: 'Failed to delete item' }, { status: 500 });
    }
}

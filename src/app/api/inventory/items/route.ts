import { NextResponse } from 'next/server';
import { InventoryService } from '@/services/inventory.service';
import { handleApiError } from '@/lib/api-utils';
import { createItem, updateItem, deleteItem, patchBulkItemsAction } from '@/actions/inventory-actions';

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
        const body = await request.json();
        const result = await createItem(body);
        if (result.success) {
            return NextResponse.json(result.data);
        } else {
            return NextResponse.json({ error: result.error }, { status: 400 });
        }
    } catch (error: any) {
        return handleApiError(error);
    }
}

export async function PUT(request: Request) {
    try {
        const body = await request.json();
        const { id, ...data } = body;
        const result = await updateItem(id, data);
        if (result.success) {
            return NextResponse.json(result.data);
        } else {
            return NextResponse.json({ error: result.error }, { status: 400 });
        }
    } catch (error: any) {
        return handleApiError(error);
    }
}

export async function PATCH(request: Request) {
    try {
        const body = await request.json();
        const { updates } = body;
        const result = await patchBulkItemsAction(updates);
        if (result.success) {
            return NextResponse.json({ success: true });
        } else {
            return NextResponse.json({ error: result.error }, { status: 400 });
        }
    } catch (error: any) {
        return handleApiError(error);
    }
}

export async function DELETE(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');
        if (!id) throw new Error('ID_REQUIRED');

        const result = await deleteItem(id);
        if (result.success) {
            return NextResponse.json({ message: 'Item deleted' });
        } else {
            return NextResponse.json({ error: result.error }, { status: 400 });
        }
    } catch (error: any) {
        return handleApiError(error);
    }
}

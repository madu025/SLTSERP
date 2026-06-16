import { NextResponse } from 'next/server';
import { InventoryService } from '@/services/inventory.service';

// GET - Get single store
export async function GET(
    request: Request,
    props: { params: Promise<{ storeId: string }> }
) {
    const params = await props.params;
    try {
        const store = await InventoryService.getStore(params.storeId);

        if (!store) {
            return NextResponse.json({ error: 'Store not found' }, { status: 404 });
        }

        return NextResponse.json(store);
    } catch (error) {
        console.error('Error fetching store:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// PUT - Update store
export async function PUT(
    request: Request,
    props: { params: Promise<{ storeId: string }> }
) {
    const params = await props.params;
    try {
        const body = await request.json();
        const store = await InventoryService.updateStore(params.storeId, body);
        return NextResponse.json(store);
    } catch (error) {
        console.error('Error updating store:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// DELETE - Delete store
export async function DELETE(
    request: Request,
    props: { params: Promise<{ storeId: string }> }
) {
    const params = await props.params;
    try {
        await InventoryService.deleteStore(params.storeId);
        return NextResponse.json({ success: true });
    } catch (error: any) {
        if (error.message === 'STORE_HAS_STOCK' || error.message === 'STORE_HAS_TRANSACTIONS') {
            return NextResponse.json({ error: 'Store cannot be deleted as it has associated stock or transactions' }, { status: 400 });
        }
        console.error('Error deleting store:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

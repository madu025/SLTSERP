import { NextResponse } from 'next/server';
import { InventoryService } from '@/services/inventory.service';
import { createStore, updateStore, deleteStore } from '@/actions/inventory-actions';

export async function GET(request: Request) {
    try {
        const stores = await InventoryService.getStores();
        return NextResponse.json(stores);
    } catch (error) {
        return NextResponse.json({ error: 'Failed to fetch stores' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const result = await createStore(body);
        if (result.success) {
            return NextResponse.json(result.data);
        } else {
            return NextResponse.json({ error: result.error }, { status: 400 });
        }
    } catch (error) {
        return NextResponse.json({ error: 'Failed to create store' }, { status: 500 });
    }
}

export async function PUT(request: Request) {
    try {
        const body = await request.json();
        const { id, ...data } = body;
        if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });

        const result = await updateStore(id, data);
        if (result.success) {
            return NextResponse.json(result.data);
        } else {
            return NextResponse.json({ error: result.error }, { status: 400 });
        }
    } catch (error) {
        return NextResponse.json({ error: 'Failed to update store' }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });

        const result = await deleteStore(id);
        if (result.success) {
            return NextResponse.json({ message: 'Store deleted' });
        } else {
            return NextResponse.json({ error: result.error }, { status: 400 });
        }
    } catch (error: any) {
        return NextResponse.json({ error: 'Failed to delete store' }, { status: 500 });
    }
}

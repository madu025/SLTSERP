import { NextResponse } from 'next/server';
import { InventoryService } from '@/services/inventory.service';

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
        const store = await InventoryService.createStore(body);
        return NextResponse.json(store);
    } catch (error) {
        return NextResponse.json({ error: 'Failed to create store' }, { status: 500 });
    }
}

export async function PUT(request: Request) {
    try {
        const body = await request.json();
        const { id, ...data } = body;

        if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });

        const store = await InventoryService.updateStore(id, data);
        return NextResponse.json(store);
    } catch (error) {
        return NextResponse.json({ error: 'Failed to update store' }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });

        await InventoryService.deleteStore(id);
        return NextResponse.json({ message: 'Store deleted' });

    } catch (error: any) {
        if (error.message === 'STORE_HAS_STOCK') return NextResponse.json({ error: 'Cannot delete store with active stock.' }, { status: 400 });
        if (error.message === 'STORE_HAS_TRANSACTIONS') return NextResponse.json({ error: 'Cannot delete store with transaction history.' }, { status: 400 });

        return NextResponse.json({ error: 'Failed to delete store' }, { status: 500 });
    }
}

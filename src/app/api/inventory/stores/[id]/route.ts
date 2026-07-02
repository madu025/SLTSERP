import { NextResponse } from 'next/server';
import { InventoryService } from '@/services/inventory.service';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        if (!id) {
            return NextResponse.json({ error: 'Store ID is required' }, { status: 400 });
        }

        const store = await InventoryService.getStore(id);
        if (!store) {
            return NextResponse.json({ error: 'Store not found' }, { status: 404 });
        }

        return NextResponse.json(store);
    } catch (error: unknown) {
        console.error('Error fetching store:', error);
        return NextResponse.json({ error: 'Failed to fetch store' }, { status: 500 });
    }
}

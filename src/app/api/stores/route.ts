import { NextResponse } from 'next/server';
import { InventoryService } from '@/services/inventory.service';

// GET - Get all stores with their OPMCs (Filtered by User Role)
export async function GET(request: Request) {
    try {
        const userId = request.headers.get('x-user-id');
        const userRole = request.headers.get('x-user-role');

        if (!userId || !userRole) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const stores = await InventoryService.getAccessibleStores(userId, userRole);
        return NextResponse.json(stores);
    } catch (error: any) {
        console.error('Error fetching stores:', error);
        if (error.message === 'USER_NOT_FOUND') {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// POST - Create new store
export async function POST(request: Request) {
    try {
        const body = await request.json();

        if (!body.name) {
            return NextResponse.json({ error: 'Store name is required' }, { status: 400 });
        }

        const store = await InventoryService.createStore(body);
        return NextResponse.json(store);
    } catch (error) {
        console.error('Error creating store:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

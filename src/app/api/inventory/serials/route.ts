import { NextResponse } from 'next/server';
import { InventoryService } from '@/services/inventory.service';
import { handleApiError } from '@/lib/api-utils';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const storeId = searchParams.get('storeId');
        const itemId = searchParams.get('itemId');

        if (!storeId || !itemId) {
            return NextResponse.json({ error: 'MISSING_PARAMS' }, { status: 400 });
        }

        const serials = await InventoryService.getItemSerials(storeId, itemId);

        return NextResponse.json(serials);
    } catch (error) {
        return handleApiError(error);
    }
}

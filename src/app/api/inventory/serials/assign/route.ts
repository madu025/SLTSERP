import { NextResponse } from 'next/server';
import { InventoryService } from '@/services/inventory.service';
import { handleApiError } from '@/lib/api-utils';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { serialNumber, staffId } = body;
        const userId = request.headers.get('x-user-id') || 'SYSTEM';

        if (!serialNumber || !staffId) {
            return NextResponse.json({ error: 'MISSING_PARAMS' }, { status: 400 });
        }

        const result = await InventoryService.assignAsset(serialNumber, staffId, userId);
        return NextResponse.json(result);
    } catch (error) {
        return handleApiError(error);
    }
}

import { NextResponse } from 'next/server';
import { InventoryService } from '@/services/inventory.service';
import { handleApiError } from '@/lib/api-utils';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { serialNumber, fromStaffId, toStaffId } = body;
        const userId = request.headers.get('x-user-id') || 'SYSTEM';

        if (!serialNumber || !fromStaffId || !toStaffId) {
            return NextResponse.json({ error: 'MISSING_PARAMS' }, { status: 400 });
        }

        const result = await InventoryService.handoverAsset(serialNumber, fromStaffId, toStaffId, userId);
        return NextResponse.json(result);
    } catch (error) {
        return handleApiError(error);
    }
}

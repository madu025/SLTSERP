import { NextRequest, NextResponse } from 'next/server';
import { InventoryService } from '@/services/inventory.service';
import { handleApiError, ApiError } from '@/lib/api-utils';

export async function POST(req: NextRequest) {
    try {
        const role = req.headers.get('x-user-role');
        const userId = req.headers.get('x-user-id');

        if (!['SUPER_ADMIN', 'ADMIN', 'STORES_MANAGER'].includes(role || '')) {
            throw new ApiError('Forbidden', 403);
        }

        const body = await req.json();
        const result = await InventoryService.recordWastage({
            ...body,
            userId: userId || undefined
        });

        return NextResponse.json({ success: true, data: result });
    } catch (error) {
        return handleApiError(error);
    }
}

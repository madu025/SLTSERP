import { NextResponse } from 'next/server';
import { InventoryService } from '@/services/inventory.service';
import { requireAuth } from '@/lib/server-utils';
import { ApiError, handleApiError } from '@/lib/api-utils';

export async function GET(request: Request) {
    try {
        let user;
        try {
            user = await requireAuth();
        } catch {
            throw new ApiError('Unauthorized', 401);
        }

        const allowedRoles = ['STORES_MANAGER', 'STORES_ASSISTANT', 'ADMIN', 'SUPER_ADMIN', 'OSP_MANAGER', 'AREA_MANAGER'];
        if (!allowedRoles.includes(user.role)) {
            throw new ApiError('Forbidden', 403);
        }

        const { searchParams } = new URL(request.url);

        const filters = {
            itemId: searchParams.get('itemId') || undefined,
            storeId: searchParams.get('storeId') || undefined,
            type: searchParams.get('type') || undefined,
            startDate: searchParams.get('startDate') || undefined,
            endDate: searchParams.get('endDate') || undefined,
        };

        const transactions = await InventoryService.getTransactions(filters);
        return NextResponse.json(transactions);
    } catch (error) {
        return handleApiError(error);
    }
}

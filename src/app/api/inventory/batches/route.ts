import { NextResponse } from 'next/server';
import { InventoryService } from '@/services/inventory.service';
import { requireAuth } from '@/lib/server-utils';
import { ApiError, handleApiError } from '@/lib/api-utils';

export const dynamic = 'force-dynamic';

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
        const storeId = searchParams.get('storeId');
        const contractorId = searchParams.get('contractorId');
        const itemId = searchParams.get('itemId') || undefined;

        if (storeId) {
            const batches = await InventoryService.getStoreBatches(storeId, itemId);
            return NextResponse.json(batches);
        }

        if (contractorId) {
            const batches = await InventoryService.getContractorBatches(contractorId, itemId);
            return NextResponse.json(batches);
        }

        return NextResponse.json({ error: 'Store ID or Contractor ID is required' }, { status: 400 });
    } catch (error) {
        return handleApiError(error);
    }
}

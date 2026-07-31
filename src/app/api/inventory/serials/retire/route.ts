export const dynamic = 'force-dynamic';
import { InventoryService } from '@/services/inventory/inventory.service';
import { apiHandler } from '@/lib/api-handler';
import { AppError } from '@/lib/error';

export const POST = apiHandler(async (request, _params, body) => {
    const serialNumber = body.serialNumber as string | undefined;
    const status = body.status as string | undefined;
    const storeId = body.storeId as string | null | undefined;
    const userId = request.headers.get('x-user-id') || 'SYSTEM';

    if (!serialNumber || !status) {
        throw AppError.badRequest('MISSING_PARAMS');
    }

    const result = await InventoryService.retireAsset(serialNumber, status as any, storeId ?? null, userId);
    return result;
}, {
    audit: { action: 'POST_ACTION', entity: 'SERIAL_RETIRE' },
    rawResponse: true
});

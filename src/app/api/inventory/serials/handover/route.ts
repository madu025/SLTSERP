import { InventoryService } from '@/services/inventory.service';
import { apiHandler } from '@/lib/api-handler';
import { AppError } from '@/lib/error';

export const POST = apiHandler(async (request, _params, body) => {
    const serialNumber = body.serialNumber as string | undefined;
    const fromStaffId = body.fromStaffId as string | undefined;
    const toStaffId = body.toStaffId as string | undefined;
    const userId = request.headers.get('x-user-id') || 'SYSTEM';

    if (!serialNumber || !fromStaffId || !toStaffId) {
        throw AppError.badRequest('MISSING_PARAMS');
    }

    const result = await InventoryService.handoverAsset(serialNumber, fromStaffId, toStaffId, userId);
    return result;
}, {
    audit: { action: 'POST_ACTION', entity: 'SERIAL_HANDOVER' },
    rawResponse: true
});

import { InventoryService } from '@/services/inventory.service';
import { apiHandler } from '@/lib/api-handler';
import { AppError } from '@/lib/error';

export const POST = apiHandler(async (request, _params, body) => {
    const { contractorId, storeId, month } = body; 

    if (!contractorId || !storeId || !month) {
        throw AppError.badRequest('Missing required parameters');
    }

    const reportData = await InventoryService.generateReportData({
        contractorId,
        storeId,
        month
    });

    return {
        month,
        contractorId,
        storeId,
        items: reportData
    };
}, { rawResponse: true });

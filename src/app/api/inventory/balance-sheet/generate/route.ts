import { InventoryService } from '@/services/inventory/inventory.service';
import { apiHandler } from '@/lib/api-handler';
import { AppError } from '@/lib/error';

export const POST = apiHandler(async (_request, _params, body) => {
    const contractorId = body.contractorId as string | undefined;
    const storeId = body.storeId as string | undefined;
    const month = body.month as string | undefined;

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

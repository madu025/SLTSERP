import { InventoryService } from '@/services/inventory';
import { apiHandler } from '@/lib/api-handler';
import { AppError } from '@/lib/error';

export const GET = apiHandler(async () => {
    try {
        const report = await InventoryService.generateAbcReport();
        return {
            success: true,
            data: report
        };
    } catch (err: any) {
        throw AppError.internal(err.message || String(err));
    }
}, { rawResponse: true });

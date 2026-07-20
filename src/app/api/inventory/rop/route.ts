import { InventoryService } from '@/services/inventory';
import { apiHandler } from '@/lib/api-handler';
import { AppError } from '@/lib/error';

export const POST = apiHandler(async () => {
    try {
        const results = await InventoryService.updateDynamicSafetyLevels();
        return {
            success: true,
            message: 'Dynamic Safety Stocks and Reorder Points updated successfully.',
            data: results
        };
    } catch (err: any) {
        throw AppError.internal(err.message || String(err));
    }
}, { rawResponse: true });

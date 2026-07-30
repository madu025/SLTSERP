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
    } catch (err: unknown) {
        throw AppError.internal((err instanceof Error ? err.message : "Unknown error") || String(err));
    }
}, { rawResponse: true });

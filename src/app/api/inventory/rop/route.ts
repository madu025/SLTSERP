export const dynamic = 'force-dynamic';
import { InventoryService } from '@/services/inventory';
import { apiHandler } from '@/lib/api-handler';
export const POST = apiHandler(async () => {
    const results = await InventoryService.updateDynamicSafetyLevels();
    return {
        success: true,
        message: 'Dynamic Safety Stocks and Reorder Points updated successfully.',
        data: results
    };
}, { rawResponse: true });
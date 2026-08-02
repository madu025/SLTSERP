import { InventoryService } from '@/services/inventory';
import { apiHandler } from '@/lib/api-handler';
import { AppError } from '@/lib/error';

export const GET = apiHandler(async () => {
    const report = await InventoryService.generateAbcReport();
    return {
        success: true,
        data: report
    };
}, { rawResponse: true });

export const dynamic = 'force-dynamic';

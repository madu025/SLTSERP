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
    } catch (err: unknown) {
        throw AppError.internal((err instanceof Error ? err.message : "Unknown error") || String(err));
    }
}, { rawResponse: true });

export const dynamic = 'force-dynamic';

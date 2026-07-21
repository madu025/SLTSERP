import { apiHandler } from '@/lib/api-handler';
import { MaterialService } from '@/services/material.service';
import { AppError } from '@/lib/error';

// GET - Preview balance sheet data before generation
export const GET = apiHandler(async (req) => {
    const { searchParams } = new URL(req.url);
    const contractorId = searchParams.get('contractorId');
    const storeId = searchParams.get('storeId');
    const month = searchParams.get('month');

    if (!contractorId || !storeId || !month) {
        throw AppError.badRequest('contractorId, storeId, and month are required');
    }

    const previewData = await MaterialService.previewBalanceSheet(contractorId, storeId, month);
    return Response.json(previewData);
});

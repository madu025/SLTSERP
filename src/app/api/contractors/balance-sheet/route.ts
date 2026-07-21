import { apiHandler } from '@/lib/api-handler';
import { MaterialService } from '@/services/material.service';
import { AppError } from '@/lib/error';

// GET - Retrieve contractor balance sheet
export const GET = apiHandler(async (req) => {
    const { searchParams } = new URL(req.url);
    const contractorId = searchParams.get('contractorId');
    const storeId = searchParams.get('storeId');
    const month = searchParams.get('month'); // Format: "2025-01"

    if (!contractorId || !storeId || !month) {
        throw AppError.badRequest('contractorId, storeId, and month are required');
    }

    const balanceSheet = await MaterialService.getBalanceSheet(contractorId, storeId, month);
    return Response.json(balanceSheet);
});

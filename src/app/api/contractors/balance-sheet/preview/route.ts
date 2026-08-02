export const dynamic = 'force-dynamic';

import { apiHandler } from '@/lib/api-handler';
import { TransactionService } from '@/services/inventory/transaction.service';
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

    const previewData = await TransactionService.previewBalanceSheet(contractorId, storeId, month);
    return Response.json(previewData);
});

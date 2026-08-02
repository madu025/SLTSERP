export const dynamic = 'force-dynamic';
import { apiHandler } from '@/lib/api-handler';
import { TransactionService } from '@/services/inventory/transaction.service';
import { z } from 'zod';

const generateSchema = z.object({
    contractorId: z.string().min(1, "contractorId is required"),
    storeId: z.string().min(1, "storeId is required"),
    month: z.string().min(1, "month is required")
});

// POST - Generate contractor balance sheet for a month
export const POST = apiHandler(async (_req, _params, body) => {
    const data = generateSchema.parse(body);

    await TransactionService.generateBalanceSheet(data.contractorId, data.storeId, data.month);
    const balanceSheet = await TransactionService.getBalanceSheet(data.contractorId, data.storeId, data.month);

    return Response.json({
        message: 'Balance sheet generated successfully',
        balanceSheet
    });
}, {
    audit: { action: 'GENERATE_BALANCE_SHEET', entity: 'ContractorBalanceSheet' }
});

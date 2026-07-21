import { apiHandler } from '@/lib/api-handler';
import { BankService } from '@/services/bank.service';
import { z } from 'zod';

const importBankSchema = z.array(z.object({
    bankCode: z.string(),
    bankName: z.string(),
    branchCode: z.string().optional(),
    branchName: z.string().optional()
})).min(1, 'Invalid data format or empty array');

export const POST = apiHandler(async (_req, _params, body) => {
    const banksData = importBankSchema.parse(body);

    const result = await BankService.importBulk(banksData);

    return Response.json({
        message: 'Import complete',
        ...result
    });
}, {
    roles: ['SUPER_ADMIN', 'ADMIN', 'FINANCE'],
    audit: { action: 'IMPORT_BANKS_BULK', entity: 'Finance' }
});

import { ROLE_GROUPS } from '@/config/roles';
import { apiHandler } from '@/lib/api-handler';
import { BankService } from '@/services/finance/bank.service';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const importBankSchema = z.array(z.object({
    bankCode: z.string(),
    bankName: z.string(),
    branchCode: z.string().optional(),
    branchName: z.string().optional()
})).min(1, 'Invalid data format or empty array');

export const POST = apiHandler(async (_req, _params, body) => {
    const banksData = importBankSchema.parse(body);

    const result = await BankService.importBulk(banksData);

    return {
        message: 'Import complete',
        ...result
    };
}, {
    roles: ROLE_GROUPS.FINANCE_APPROVERS,
    audit: { action: 'IMPORT_BANKS_BULK', entity: 'Finance' },
    rawResponse: true
});

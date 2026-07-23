import { apiHandler } from '@/lib/api-handler';
import { BankService } from '@/services/bank.service';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const createBankSchema = z.object({
    code: z.string().min(1, "Bank code is required"),
    name: z.string().min(1, "Bank name is required")
});

export const GET = apiHandler(async () => {
    return await BankService.getBanks();
}, { rawResponse: true });

export const POST = apiHandler(async (_request: Request, _params: any, body: any) => {
    const data = createBankSchema.parse(body);
    return await BankService.createBank(data);
}, {
    audit: { action: 'CREATE', entity: 'Bank' },
    rawResponse: true
});

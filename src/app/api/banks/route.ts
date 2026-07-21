import { apiHandler } from '@/lib/api-handler';
import { BankService } from '@/services/bank.service';
import { z } from 'zod';

const createBankSchema = z.object({
    code: z.string().min(1, "Bank code is required"),
    name: z.string().min(1, "Bank name is required")
});

export const GET = apiHandler(async () => {
    const banks = await BankService.getBanks();
    return Response.json(banks);
});

export const POST = apiHandler(async (_request: Request, _params: any, body: any) => {
    const data = createBankSchema.parse(body);
    const bank = await BankService.createBank(data);
    return Response.json(bank, { status: 201 });
}, {
    audit: { action: 'CREATE', entity: 'Bank' }
});

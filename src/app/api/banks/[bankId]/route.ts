import { apiHandler } from '@/lib/api-handler';
import { BankService } from '@/services/bank.service';
import { z } from 'zod';

const updateBankSchema = z.object({
    code: z.string().min(1, "Bank code is required"),
    name: z.string().min(1, "Bank name is required")
});

export const PUT = apiHandler(async (_request: Request, params: any, body: any) => {
    const { bankId } = params;
    const data = updateBankSchema.parse(body);
    const bank = await BankService.updateBank(bankId, data);
    return Response.json(bank);
}, {
    audit: { action: 'UPDATE', entity: 'Bank' }
});

export const DELETE = apiHandler(async (_request: Request, params: any) => {
    const { bankId } = params;
    await BankService.deleteBank(bankId);
    return Response.json({ message: "Bank deleted successfully" });
}, {
    audit: { action: 'DELETE', entity: 'Bank' }
});

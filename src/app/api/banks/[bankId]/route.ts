import { apiHandler } from '@/lib/api-handler';
import { BankService } from '@/services/finance/bank.service';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const updateBankSchema = z.object({
    code: z.string().min(1, "Bank code is required"),
    name: z.string().min(1, "Bank name is required")
});

export const PUT = apiHandler(async (uestreq$3: Request, params: Record<string, string>, body: import("@prisma/client").Prisma.JsonObject) => {
    const { bankId } = params;
    const data = updateBankSchema.parse(body);
    return await BankService.updateBank(bankId, data);
}, {
    audit: { action: 'UPDATE', entity: 'Bank' },
    rawResponse: true
});

export const DELETE = apiHandler(async (uestreq$3: Request, params: Record<string, string>) => {
    const { bankId } = params;
    await BankService.deleteBank(bankId);
    return { message: "Bank deleted successfully" };
}, {
    audit: { action: 'DELETE', entity: 'Bank' },
    rawResponse: true
});

import { apiHandler } from '@/lib/api-handler';
import { BankService } from '@/services/finance/bank.service';
import { ROLE_GROUPS } from '@/config/roles';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const createBankSchema = z.object({
    code: z.string().min(1, "Bank code is required"),
    name: z.string().min(1, "Bank name is required")
});

export const GET = apiHandler(async () => {
    return await BankService.getBanks();
}, { rawResponse: true });

export const POST = apiHandler(async (_request: Request, _params: Record<string, unknown>, body: Record<string, unknown>) => {
    const data = createBankSchema.parse(body);
    return await BankService.createBank(data);
}, {
    // GET stays public (contractor registration form lookup); bank master data
    // writes restricted to finance/admin
    roles: [...ROLE_GROUPS.CORE_ADMINS, 'CEO', 'FINANCE_MANAGER'],
    audit: { action: 'CREATE', entity: 'Bank' },
    rawResponse: true
});

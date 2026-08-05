import { apiHandler } from '@/lib/api-handler';
import { BankService } from '@/services/finance/bank.service';
import { ROLE_GROUPS } from '@/config/roles';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const createBranchSchema = z.object({
    code: z.string().min(1, "Branch code is required"),
    name: z.string().min(1, "Branch name is required")
});

export const GET = apiHandler(async (uestreq$3: Request, params: Record<string, string>) => {
    const { bankId } = params;
    return await BankService.getBranches(bankId);
}, { rawResponse: true });

export const POST = apiHandler(async (uestreq$3: Request, params: Record<string, string>, body: import("@prisma/client").Prisma.JsonObject) => {
    const { bankId } = params;
    const data = createBranchSchema.parse(body);
    return await BankService.createBranch(bankId, data);
}, {
    roles: [...ROLE_GROUPS.CORE_ADMINS, 'CEO', 'FINANCE_MANAGER'],
    audit: { action: 'CREATE', entity: 'BankBranch' },
    rawResponse: true
});

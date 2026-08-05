import { apiHandler } from '@/lib/api-handler';
import { BankService } from '@/services/finance/bank.service';
import { ROLE_GROUPS } from '@/config/roles';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const updateBranchSchema = z.object({
    code: z.string().min(1, "Branch code is required"),
    name: z.string().min(1, "Branch name is required")
});

export const PUT = apiHandler(async (uestreq$3: Request, params: Record<string, string>, body: import("@prisma/client").Prisma.JsonObject) => {
    const { bankId, branchId } = params;
    const data = updateBranchSchema.parse(body);
    return await BankService.updateBranch(bankId, branchId, data);
}, {
    roles: [...ROLE_GROUPS.CORE_ADMINS, 'CEO', 'FINANCE_MANAGER'],
    audit: { action: 'UPDATE', entity: 'BankBranch' },
    rawResponse: true
});

export const DELETE = apiHandler(async (uestreq$3: Request, params: Record<string, string>) => {
    const { branchId } = params;
    await BankService.deleteBranch(branchId);
    return { message: "Branch deleted successfully" };
}, {
    roles: [...ROLE_GROUPS.CORE_ADMINS, 'CEO', 'FINANCE_MANAGER'],
    audit: { action: 'DELETE', entity: 'BankBranch' },
    rawResponse: true
});
